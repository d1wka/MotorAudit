"""
PDF report generator using ReportLab Platypus.

Produces a self-contained PDF with:
  • Cover page (site meta)
  • Executive summary table
  • Per-module result sections
  • Formulas & assumptions appendix
  • Disclaimer
"""

from __future__ import annotations

import io
from datetime import date
from typing import Any, Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# ── Colour palette ─────────────────────────────────────────────────────────────
PRIMARY = colors.HexColor("#1e3a5f")
ACCENT = colors.HexColor("#f59e0b")
PASS_C = colors.HexColor("#16a34a")
WARN_C = colors.HexColor("#d97706")
FAIL_C = colors.HexColor("#dc2626")
LIGHT_GRAY = colors.HexColor("#f8fafc")
MID_GRAY = colors.HexColor("#e2e8f0")


# ── Style helpers ──────────────────────────────────────────────────────────────

def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("MA_Title", parent=base["Normal"],
                                 fontSize=26, textColor=PRIMARY, alignment=TA_CENTER,
                                 leading=32, spaceAfter=4),
        "subtitle": ParagraphStyle("MA_Sub", parent=base["Normal"],
                                    fontSize=14, textColor=colors.gray, alignment=TA_CENTER,
                                    spaceAfter=20),
        "h1": ParagraphStyle("MA_H1", parent=base["Normal"],
                              fontSize=15, textColor=PRIMARY, leading=20,
                              spaceBefore=18, spaceAfter=6, fontName="Helvetica-Bold"),
        "h2": ParagraphStyle("MA_H2", parent=base["Normal"],
                              fontSize=11, textColor=PRIMARY, leading=16,
                              spaceBefore=12, spaceAfter=4, fontName="Helvetica-Bold"),
        "body": ParagraphStyle("MA_Body", parent=base["Normal"],
                                fontSize=9, leading=13, spaceAfter=4),
        "small": ParagraphStyle("MA_Small", parent=base["Normal"],
                                  fontSize=7.5, textColor=colors.gray, leading=11),
        "mono": ParagraphStyle("MA_Mono", parent=base["Normal"],
                                fontSize=8, fontName="Courier", leading=12),
        "meta": ParagraphStyle("MA_Meta", parent=base["Normal"],
                                fontSize=10, leading=14),
    }


def _std_table_style(header_row: bool = True) -> TableStyle:
    cmds = [
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.4, MID_GRAY),
        ("ROWBACKGROUNDS", (0, 1 if header_row else 0), (-1, -1), [LIGHT_GRAY, colors.white]),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ]
    if header_row:
        cmds += [
            ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ]
    return TableStyle(cmds)


def _hr(story, color=MID_GRAY):
    story.append(HRFlowable(width="100%", thickness=0.6, color=color, spaceAfter=6))


# ── Section builders ───────────────────────────────────────────────────────────

def _cover_page(story, site_name, analyst_name, sym, S):
    story.append(Spacer(1, 2 * cm))
    story.append(Paragraph("MotorAudit", S["title"]))
    story.append(Paragraph("Energy Audit Report", S["subtitle"]))
    story.append(HRFlowable(width="100%", thickness=2, color=ACCENT, spaceAfter=20))

    meta = [
        ["Site", site_name or "—"],
        ["Analyst", analyst_name or "—"],
        ["Report date", str(date.today())],
        ["Currency", sym],
    ]
    t = Table(meta, colWidths=[4 * cm, 13 * cm])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("TEXTCOLOR", (0, 0), (0, -1), PRIMARY),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, MID_GRAY),
    ]))
    story.append(t)
    story.append(PageBreak())


def _exec_summary(story, summary: dict, sym: str, S):
    story.append(Paragraph("Executive Summary", S["h1"]))
    _hr(story)

    rows = [["Metric", "Value"]]
    rows.append(["Total Annual Energy Saved",
                 f"{summary.get('total_annual_kwh_saved', 0):,.0f} kWh / yr"])
    rows.append(["Total Annual Cost Saved",
                 f"{sym}{summary.get('total_annual_cost_saved', 0):,.2f} / yr"])
    if summary.get("total_co2_kg_reduced"):
        rows.append(["CO₂ Reduction", f"{summary['total_co2_kg_reduced']:,.0f} kg / yr"])
    rows.append(["Total Investment", f"{sym}{summary.get('total_investment', 0):,.2f}"])
    rows.append(["Blended Simple Payback", f"{summary.get('blended_payback_years', 0):.2f} years"])
    if summary.get("power_quality_flags", 0):
        rows.append(["Power Quality Issues", str(summary["power_quality_flags"]) + " flag(s)"])

    t = Table(rows, colWidths=[10 * cm, 7 * cm])
    t.setStyle(_std_table_style())
    story.append(t)
    story.append(Spacer(1, 0.4 * cm))

    if summary.get("breakdown"):
        story.append(Paragraph("Breakdown by Measure", S["h2"]))
        bd_rows = [["Measure", "kWh / yr saved", f"{sym} / yr saved", "Investment"]]
        for b in summary["breakdown"]:
            bd_rows.append([
                b["module"],
                f"{b['kwh_saved']:,.0f}",
                f"{sym}{b['cost_saved']:,.2f}",
                f"{sym}{b['investment']:,.2f}",
            ])
        t2 = Table(bd_rows, colWidths=[7 * cm, 3.5 * cm, 3.5 * cm, 3 * cm])
        t2.setStyle(_std_table_style())
        story.append(t2)


def _replacement_section(story, result: dict, sym: str, S):
    story.append(PageBreak())
    story.append(Paragraph("Module 1 — Motor Replacement Analysis", S["h1"]))
    _hr(story)

    ex = result.get("existing", {})
    rep = result.get("replacement", {})
    sav = result.get("savings", {})

    compare = [
        ["Parameter", "Existing Motor", "Replacement Motor"],
        ["Efficiency at operating load", f"{ex.get('eta_at_load',0)*100:.2f}%", f"{rep.get('eta_at_load',0)*100:.2f}%"],
        ["Electrical input power", f"{ex.get('input_power_kw',0):.2f} kW", f"{rep.get('input_power_kw',0):.2f} kW"],
        ["Annual energy", f"{ex.get('annual_kwh',0):,.0f} kWh", f"{rep.get('annual_kwh',0):,.0f} kWh"],
        ["Annual energy cost", f"{sym}{ex.get('annual_cost',0):,.2f}", f"{sym}{rep.get('annual_cost',0):,.2f}"],
    ]
    t = Table(compare, colWidths=[7 * cm, 4.5 * cm, 4.5 * cm])
    t.setStyle(_std_table_style())
    story.append(t)
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("Savings Summary", S["h2"]))
    sav_rows = [
        ["Annual energy saved", f"{sav.get('annual_kwh',0):,.0f} kWh / yr"],
        ["Annual cost saved", f"{sym}{sav.get('annual_cost',0):,.2f} / yr"],
        ["CO₂ reduction", f"{sav.get('annual_co2_kg') or '—'} kg / yr"],
        ["Simple payback", f"{sav.get('payback_years',0):.2f} years"],
        ["Lifetime net savings", f"{sym}{sav.get('lifetime_net_savings',0):,.2f}"],
    ]
    t2 = Table(sav_rows, colWidths=[8 * cm, 9 * cm])
    t2.setStyle(_std_table_style(header_row=False))
    story.append(t2)

    _assumptions_block(story, result.get("assumptions", []), S)


def _vfd_section(story, result: dict, sym: str, S):
    story.append(PageBreak())
    story.append(Paragraph("Module 2 — VFD Sizing & Savings Analysis", S["h1"]))
    _hr(story)

    tot = result.get("totals", {})
    rows = [
        ["Recommended VFD rating", f"{result.get('recommended_vfd_kw',0):.1f} kW "
                                    f"(×{result.get('headroom_factor',1.1)} headroom)"],
        ["Baseline annual energy", f"{tot.get('baseline_annual_kwh',0):,.0f} kWh / yr"],
        ["VFD annual energy", f"{tot.get('vfd_annual_kwh',0):,.0f} kWh / yr"],
        ["Annual energy saved", f"{tot.get('saved_kwh',0):,.0f} kWh / yr"],
        ["Annual cost saved", f"{sym}{tot.get('saved_cost',0):,.2f} / yr"],
        ["Simple payback", f"{tot.get('payback_years',0):.2f} years"],
    ]
    t = Table(rows, colWidths=[8 * cm, 9 * cm])
    t.setStyle(_std_table_style(header_row=False))
    story.append(t)
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("Load Profile Analysis", S["h2"]))
    profile = result.get("profile_analysis", [])
    if profile:
        ph = [["Speed", "Time%", "Baseline kW", "VFD kW", "Baseline kWh", "VFD kWh"]]
        for p in profile:
            ph.append([
                f"{p['speed_fraction']*100:.0f}%",
                f"{p['time_fraction']*100:.0f}%",
                f"{p['baseline_power_kw']:.1f}",
                f"{p['vfd_input_power_kw']:.1f}",
                f"{p['baseline_annual_kwh']:,.0f}",
                f"{p['vfd_annual_kwh']:,.0f}",
            ])
        t2 = Table(ph, colWidths=[2.5*cm]*6)
        t2.setStyle(_std_table_style())
        story.append(t2)

    _assumptions_block(story, result.get("assumptions", []), S)


def _pq_section(story, result: dict, S):
    story.append(PageBreak())
    story.append(Paragraph("Module 3 — Power Quality Analysis", S["h1"]))
    _hr(story)

    story.append(Paragraph(
        f"Signal duration: {result.get('duration_s',0):.3f} s  |  "
        f"Detected fundamental: {result.get('actual_fundamental_hz',50):.2f} Hz",
        S["body"]
    ))
    story.append(Spacer(1, 0.2 * cm))

    # Status table
    story.append(Paragraph("Status Flags", S["h2"]))
    flags = result.get("status_table", [])
    if flags:
        fh = [["Metric", "Value", "Limit", "Unit", "Status"]]
        for f in flags:
            status_color = {"PASS": PASS_C, "WARN": WARN_C, "FAIL": FAIL_C}.get(f["status"], PRIMARY)
            fh.append([f["metric"], str(f["value"]), str(f["limit"]), f["unit"],
                        Paragraph(f"<font color='#{status_color.hexval()[2:]}'><b>{f['status']}</b></font>",
                                  ParagraphStyle("st", fontSize=9))])
        t = Table(fh, colWidths=[5*cm, 2.5*cm, 2.5*cm, 1.5*cm, 2*cm])
        t.setStyle(_std_table_style())
        story.append(t)

    # Recommendations
    recs = result.get("recommendations", [])
    if recs:
        story.append(Paragraph("Recommendations", S["h2"]))
        for r in recs:
            story.append(Paragraph(f"• {r}", S["body"]))

    # Channel summary
    channels = result.get("channels", {})
    if channels:
        story.append(Paragraph("Channel Summary", S["h2"]))
        ch_rows = [["Channel", "RMS", "Peak", "THD"]]
        for ch, v in channels.items():
            ch_rows.append([ch.upper(), f"{v['rms']:.3f}", f"{v['peak']:.3f}", f"{v['thd_pct']:.2f}%"])
        t2 = Table(ch_rows, colWidths=[3*cm, 3.5*cm, 3.5*cm, 3*cm])
        t2.setStyle(_std_table_style())
        story.append(t2)


def _assumptions_block(story, assumptions: list[str], S):
    if not assumptions:
        return
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("Assumptions & Formula References", S["h2"]))
    for a in assumptions:
        story.append(Paragraph(f"• {a}", S["small"]))


def _formulas_appendix(story, S):
    story.append(PageBreak())
    story.append(Paragraph("Appendix — Engineering Formulas", S["h1"]))
    _hr(story)

    formulas = [
        ("Annual energy (motor)", "E = P_rated × LF / η(LF) × H  [kWh/yr]"),
        ("Simple payback", "PB = C_invest / ΔCost_annual  [years]"),
        ("CO₂ reduction", "ΔCO₂ = ΔE × CF  [kg/yr]   (CF = grid carbon factor)"),
        ("Affinity law (pump/fan)", "P_shaft(n) = P_rated × (n / n_rated)³"),
        ("Constant-torque VFD", "P_shaft(n) = P_rated × (n / n_rated)"),
        ("VFD electrical input", "P_elec = P_shaft / (η_motor × η_VFD)"),
        ("THD definition", "THD = √(Σ Ih² for h≥2) / I₁ × 100 %   (IEEE 519-2022)"),
        ("True RMS", "X_rms = √( (1/N) Σ xᵢ² )"),
        ("Power factor", "PF = P / S = mean(v·i) / (V_rms × I_rms)"),
        ("Reactive power correction", "Q_corr = P × (tan φ_actual − tan φ_target)  [kVAr]"),
        ("Phase unbalance (NEMA MG-1)", "UB% = max(|Ix − Ī|) / Ī × 100"),
    ]

    rows = [["Formula", "Expression"]] + formulas
    t = Table(rows, colWidths=[7 * cm, 10 * cm])
    t.setStyle(_std_table_style())
    story.append(t)


def _disclaimer(story, S):
    story.append(Spacer(1, 1 * cm))
    _hr(story, color=MID_GRAY)
    story.append(Paragraph(
        "<i>Disclaimer: All results in this report are engineering estimates based on the inputs provided "
        "and standard IEC reference efficiency data (IEC 60034-30-1:2014). Actual energy savings depend on "
        "real-site operating conditions, motor loading, and installation quality. Power quality thresholds "
        "are advisory only and do not constitute legal or regulatory compliance certification under IEEE 519 "
        "or any other standard. MotorAudit is a decision-support tool; qualified engineers should validate "
        "findings before making capital investments.</i>",
        S["small"],
    ))


# ── Public entry points ────────────────────────────────────────────────────────

def build_summary(
    replacement_result: Optional[dict],
    vfd_result: Optional[dict],
    pq_result: Optional[dict],
    currency_symbol: str = "$",
) -> dict[str, Any]:
    breakdown = []
    total_kwh = 0.0
    total_cost = 0.0
    total_co2 = 0.0
    has_co2 = False
    total_invest = 0.0

    if replacement_result:
        sav = replacement_result.get("savings", {})
        kwh = sav.get("annual_kwh", 0)
        cost = sav.get("annual_cost", 0)
        co2 = sav.get("annual_co2_kg")
        invest = replacement_result.get("replacement", {}).get("annual_cost", 0)
        # Reconstruct investment from payback * annual_savings
        pb = sav.get("payback_years", 0)
        invest = cost * pb if pb else 0
        breakdown.append({"module": "Motor Replacement", "kwh_saved": kwh,
                           "cost_saved": cost, "investment": invest})
        total_kwh += kwh
        total_cost += cost
        total_invest += invest
        if co2 is not None:
            total_co2 += co2
            has_co2 = True

    if vfd_result:
        tot = vfd_result.get("totals", {})
        kwh = tot.get("saved_kwh", 0)
        cost = tot.get("saved_cost", 0)
        pb = tot.get("payback_years", 0)
        invest = cost * pb if pb else 0
        breakdown.append({"module": "VFD Installation", "kwh_saved": kwh,
                           "cost_saved": cost, "investment": invest})
        total_kwh += kwh
        total_cost += cost
        total_invest += invest

    pq_flags = len([f for f in (pq_result or {}).get("status_table", []) if f["status"] != "PASS"])

    blended_pb = total_invest / total_cost if total_cost > 1e-9 else 0.0

    return {
        "total_annual_kwh_saved": round(total_kwh, 1),
        "total_annual_cost_saved": round(total_cost, 2),
        "total_co2_kg_reduced": round(total_co2, 1) if has_co2 else None,
        "total_investment": round(total_invest, 2),
        "blended_payback_years": round(blended_pb, 3),
        "breakdown": breakdown,
        "power_quality_flags": pq_flags,
        "disclaimer": (
            "All figures are engineering estimates. Actual savings depend on real operating conditions. "
            "This report does not constitute professional engineering certification."
        ),
    }


def generate_pdf(
    site_name: str = "",
    analyst_name: str = "",
    currency_symbol: str = "$",
    replacement_result: Optional[dict] = None,
    vfd_result: Optional[dict] = None,
    pq_result: Optional[dict] = None,
) -> bytes:
    summary = build_summary(replacement_result, vfd_result, pq_result, currency_symbol)
    S = _styles()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=1.8 * cm, bottomMargin=1.8 * cm,
        leftMargin=2 * cm, rightMargin=2 * cm,
        title="MotorAudit Report",
        author=analyst_name or "MotorAudit",
    )
    story = []
    _cover_page(story, site_name, analyst_name, currency_symbol, S)
    _exec_summary(story, summary, currency_symbol, S)

    if replacement_result:
        _replacement_section(story, replacement_result, currency_symbol, S)
    if vfd_result:
        _vfd_section(story, vfd_result, currency_symbol, S)
    if pq_result:
        _pq_section(story, pq_result, S)

    _formulas_appendix(story, S)
    _disclaimer(story, S)

    doc.build(story)
    buf.seek(0)
    return buf.read()
