"""
Module 1 — Motor Replacement & Payback Calculator.

Key formula:
    E_annual = (P_rated_kW × LF / η(LF)) × H          [kWh / yr]

where:
    P_rated_kW  = rated shaft output power
    LF          = load factor (fraction of rated shaft load)
    η(LF)       = motor efficiency at operating load factor (interpolated from IEC table)
    H           = annual operating hours

Annual savings:
    ΔE    = E_old − E_new                              [kWh / yr]
    ΔCost = ΔE × tariff                               [currency / yr]
    ΔCO₂  = ΔE × co2_factor                           [kg CO₂ / yr]

Simple payback:
    PB    = C_motor / ΔCost                          [years]

Lifetime net savings (undiscounted):
    LNS   = ΔCost × lifetime_years − C_motor          [currency]
"""

from __future__ import annotations
from app.core.motor_db import get_efficiency_at_load, get_efficiency_curve
from app.schemas.replacement import ReplacementRequest, ReplacementResponse


def compute_replacement(req: ReplacementRequest) -> ReplacementResponse:
    ex = req.existing_motor
    rep = req.replacement_motor
    H = req.operating_hours_per_year
    tariff = req.tariff_per_kwh
    co2 = req.co2_factor_kg_per_kwh
    life = req.lifetime_years

    eta_old = get_efficiency_at_load(
        ex.ie_class, ex.rated_power_kw, ex.load_factor, ex.efficiency_override_pct
    )
    eta_new = get_efficiency_at_load(
        rep.ie_class, ex.rated_power_kw, ex.load_factor, rep.efficiency_override_pct
    )

    # Shaft output power at operating load factor
    p_shaft_kw = ex.rated_power_kw * ex.load_factor

    # Electrical input power = shaft power / efficiency
    p_in_old = p_shaft_kw / eta_old
    p_in_new = p_shaft_kw / eta_new

    e_old = p_in_old * H       # kWh/yr
    e_new = p_in_new * H       # kWh/yr
    delta_e = e_old - e_new    # kWh/yr saved

    delta_cost = delta_e * tariff
    delta_co2 = (delta_e * co2) if co2 is not None else None
    payback = rep.cost / delta_cost if delta_cost > 1e-9 else float("inf")
    lifetime_net = delta_cost * life - rep.cost

    # Efficiency curves for chart (5 load points, smoother)
    lf_pts = [0.25, 0.50, 0.75, 1.00]
    _, old_eta_curve = get_efficiency_curve(
        ex.ie_class, ex.rated_power_kw, ex.efficiency_override_pct, lf_pts
    )
    _, new_eta_curve = get_efficiency_curve(
        rep.ie_class, ex.rated_power_kw, rep.efficiency_override_pct, lf_pts
    )

    # Payback timeline (year 0 = investment date)
    years = list(range(life + 1))
    cumulative = [round(delta_cost * y, 2) for y in years]
    net_pos = [round(cs - rep.cost, 2) for cs in cumulative]

    # Describe which efficiency source was used
    old_src = f"IE{ex.ie_class}" if ex.ie_class else f"{ex.efficiency_override_pct:.1f}% override"
    new_src = f"IE{rep.ie_class}" if rep.ie_class else f"{rep.efficiency_override_pct:.1f}% override"

    assumptions = [
        f"Existing motor: {old_src}, rated {ex.rated_power_kw} kW — η at {ex.load_factor*100:.0f}% load = {eta_old*100:.2f}%",
        f"Replacement motor: {new_src}, rated {ex.rated_power_kw} kW — η at {ex.load_factor*100:.0f}% load = {eta_new*100:.2f}%",
        "IEC 60034-30-1:2014 Table 1 reference values; quadratic interpolation between load points",
        f"Load factor held constant at {ex.load_factor*100:.0f}% over entire operating life",
        "Electricity tariff and CO₂ factor assumed constant (no escalation)",
        "Lifetime net savings are undiscounted (NPV analysis not included)",
    ]

    return ReplacementResponse(
        existing={
            "eta_at_load": round(eta_old, 5),
            "input_power_kw": round(p_in_old, 3),
            "annual_kwh": round(e_old, 1),
            "annual_cost": round(e_old * tariff, 2),
        },
        replacement={
            "eta_at_load": round(eta_new, 5),
            "input_power_kw": round(p_in_new, 3),
            "annual_kwh": round(e_new, 1),
            "annual_cost": round(e_new * tariff, 2),
        },
        savings={
            "annual_kwh": round(delta_e, 1),
            "annual_cost": round(delta_cost, 2),
            "annual_co2_kg": round(delta_co2, 1) if delta_co2 is not None else None,
            "payback_years": round(payback, 3),
            "lifetime_net_savings": round(lifetime_net, 2),
        },
        efficiency_curve={
            "load_points": lf_pts,
            "existing_eta": [round(e, 5) for e in old_eta_curve],
            "replacement_eta": [round(e, 5) for e in new_eta_curve],
        },
        payback_timeline={
            "years": years,
            "cumulative_savings": cumulative,
            "net_position": net_pos,
        },
        assumptions=assumptions,
    )
