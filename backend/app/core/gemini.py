"""
Gemini AI integration for engineering insights.

Each public function receives a parsed module result dict and returns a
plain-text expert commentary string.  Prompts are engineered to produce
concise, quantitative, actionable output — not generic advice.

The client is lazily initialised so the rest of the app starts fine even
when GEMINI_API_KEY is absent (the endpoint itself will return 503).
"""

from __future__ import annotations
from typing import Any

from google import genai

from app.config import settings

_client: genai.Client | None = None

MODEL = "gemini-3-flash-preview"

ENGINEER_ROLE = (
    "You are a senior energy engineer with 20 years of experience auditing "
    "industrial electric motors and power systems. You give concise, "
    "technically rigorous interpretations of audit results to plant engineers "
    "and facility managers. You are specific and quantitative; you never give "
    "generic advice."
)


def _client_instance() -> genai.Client:
    global _client
    if _client is None:
        if not settings.gemini_api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not configured. "
                "Set it in the .env file to enable AI insights."
            )
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def _generate(prompt: str) -> str:
    client = _client_instance()
    response = client.models.generate_content(model=MODEL, contents=prompt)
    return response.text.strip()


# ── Module 1: Motor Replacement ────────────────────────────────────────────────

def insights_replacement(result: dict[str, Any]) -> str:
    ex = result.get("existing", {})
    rep = result.get("replacement", {})
    sav = result.get("savings", {})

    eta_old_pct = ex.get("eta_at_load", 0) * 100
    eta_new_pct = rep.get("eta_at_load", 0) * 100
    annual_kwh = sav.get("annual_kwh", 0)
    baseline_kwh = ex.get("annual_kwh", 1)
    saving_pct = annual_kwh / baseline_kwh * 100 if baseline_kwh else 0
    payback = sav.get("payback_years", 0)
    co2 = sav.get("annual_co2_kg")

    prompt = f"""{ENGINEER_ROLE}

A motor replacement audit produced the following results:

Existing motor:
  - Full-load equivalent efficiency at operating point: {eta_old_pct:.2f}%
  - Annual electricity consumption: {baseline_kwh:,.0f} kWh/yr
  - Annual energy cost: {ex.get('annual_cost', 0):,.2f}

Replacement motor:
  - Efficiency at operating point: {eta_new_pct:.2f}%
  - Annual electricity consumption: {rep.get('annual_kwh', 0):,.0f} kWh/yr
  - Annual energy cost: {rep.get('annual_cost', 0):,.2f}

Savings:
  - Annual energy saved: {annual_kwh:,.0f} kWh ({saving_pct:.1f}% reduction)
  - Annual cost saved: {sav.get('annual_cost', 0):,.2f}
  - CO2 reduction: {f"{co2:,.0f} kg/yr" if co2 else "not calculated"}
  - Simple payback period: {payback:.2f} years
  - Lifetime net savings: {sav.get('lifetime_net_savings', 0):,.2f}

Write exactly three paragraphs (no headers, no bullet points):

Paragraph 1 — Business case: Is {payback:.2f} years an attractive payback for a motor upgrade? Compare to typical industry benchmarks (3–7 years is common). Comment on how the {saving_pct:.1f}% energy reduction compares to typical IE1→IE3 upgrades.

Paragraph 2 — Sensitivity: Which of the input assumptions (load factor, operating hours, tariff, efficiency class) has the largest leverage on the result, and by how much? Give a concrete example (e.g., "reducing annual hours from X to Y would extend payback to Z years").

Paragraph 3 — Implementation: What practical checks must be done before ordering the replacement motor (torque-speed curve, starting current, frame size, coupling compatibility)? Any commissioning traps to avoid?

Keep the total response under 300 words."""

    return _generate(prompt)


# ── Module 2: VFD Sizing & Savings ────────────────────────────────────────────

def insights_vfd(result: dict[str, Any]) -> str:
    tot = result.get("totals", {})
    rec_kw = result.get("recommended_vfd_kw", 0)
    headroom = result.get("headroom_factor", 1.1)
    assumptions = result.get("assumptions", [])
    load_type = next((a for a in assumptions if "Load type:" in a), "pump/fan")

    baseline = tot.get("baseline_annual_kwh", 1)
    saved = tot.get("saved_kwh", 0)
    saving_pct = saved / baseline * 100 if baseline else 0
    payback = tot.get("payback_years", 0)

    prompt = f"""{ENGINEER_ROLE}

A VFD (Variable Frequency Drive) installation audit produced the following results:

Load: {load_type}
Recommended VFD rating: {rec_kw:.1f} kW (headroom factor {headroom})
Baseline annual energy (throttling/damping): {baseline:,.0f} kWh/yr
VFD annual energy: {tot.get('vfd_annual_kwh', 0):,.0f} kWh/yr
Annual energy saved: {saved:,.0f} kWh ({saving_pct:.1f}% reduction)
Annual cost saved: {tot.get('saved_cost', 0):,.2f}
Simple payback period: {payback:.2f} years

Write exactly three paragraphs (no headers, no bullet points):

Paragraph 1 — Why the savings are this large: Explain the cubic affinity law and why a {saving_pct:.0f}% energy reduction is physically expected for this load profile. Is this saving typical or exceptional? Reference what fraction of total pump/fan system energy is typically recovered.

Paragraph 2 — Critical VFD installation risks that are often overlooked: motor insulation stress from PWM voltage spikes (dV/dt), minimum speed constraints for self-cooled motors (typically 20–30 Hz), harmonic current injection (a 6-pulse drive typically produces 30–40% ITHD without a line reactor), and bearing current damage mechanisms. Be specific.

Paragraph 3 — Beyond basic VFD: What additional control strategies could further improve savings beyond what this calculation shows (pressure/flow setpoint optimisation, sleep mode, pump scheduling if multiple units)?

Keep the total response under 300 words."""

    return _generate(prompt)


# ── Module 3: Power Quality ────────────────────────────────────────────────────

def insights_power_quality(result: dict[str, Any]) -> str:
    channels = result.get("channels", {})
    pm = result.get("power_metrics") or {}
    ub = result.get("phase_unbalance") or {}
    flags = result.get("status_table", [])

    ia_ch = channels.get("ia", {})
    va_ch = channels.get("va", {})
    ia_thd = ia_ch.get("thd_pct", 0)
    va_thd = va_ch.get("thd_pct", 0)

    harmonics = ia_ch.get("harmonics", {})
    # Top 6 non-fundamental harmonics by amplitude
    top_harmonics = sorted(
        [(k, v.get("amplitude_rms", 0)) for k, v in harmonics.items() if k != "1"],
        key=lambda x: x[1],
        reverse=True,
    )[:6]
    harmonic_str = ", ".join(f"h{k}: {v:.3f} A rms" for k, v in top_harmonics) or "none significant"

    fail_warn = [f"{f['metric']} = {f['value']:.2f} {f['unit']} (limit {f['limit']:.2f}, {f['status']})"
                 for f in flags if f["status"] != "PASS"]
    flags_str = "; ".join(fail_warn) if fail_warn else "all metrics within limits"

    pf = pm.get("power_factor", "N/A")
    cos_phi = pm.get("displacement_cos_phi", "N/A")
    q_corr = pm.get("capacitor_bank_kvar")
    i_ub = ub.get("current_unbalance_pct", "N/A")
    v_ub = ub.get("voltage_unbalance_pct")

    prompt = f"""{ENGINEER_ROLE}

A power quality analysis produced the following results:

Current THD (ia): {ia_thd:.2f}%
Voltage THD (va): {va_thd:.2f}%
Power factor (true): {pf}
Displacement power factor (cos phi): {cos_phi}
Reactive power: {pm.get('reactive_power_var', 0):.0f} VAr
Capacitor bank needed for PF correction: {f"{q_corr:.2f} kVAr" if q_corr is not None else "not required"}
Current phase unbalance: {i_ub}%{f", voltage unbalance: {v_ub:.2f}%" if v_ub is not None else ""}
Status flags: {flags_str}
Dominant current harmonics: {harmonic_str}

Write exactly three paragraphs (no headers, no bullet points):

Paragraph 1 — Source diagnosis: Based on which harmonic orders are dominant, what type of equipment is most likely causing this distortion? (e.g., h5+h7 dominant = 6-pulse rectifier or VFD; h3 dominant = single-phase switching loads; h5 only without h7 = controlled rectifier; high even harmonics = half-wave rectification or DC offset). Be specific about the probable source.

Paragraph 2 — Quantified consequences: What is the practical impact of this THD level on connected motors (additional I²R heating, torque pulsations, insulation stress), on transformers (K-factor derating), and on electricity bills (reactive power penalty)? Use the measured numbers.

Paragraph 3 — Corrective strategy: Given these specific harmonic orders and levels, recommend a specific mitigation sequence: which problem to fix first, what filter topology is most cost-effective (passive single-tuned, C-type, or active), approximate sizing, and expected post-correction THD.

Keep the total response under 320 words."""

    return _generate(prompt)
