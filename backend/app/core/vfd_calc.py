"""
Module 2 — VFD Sizing & Savings Calculator.

Physics:
──────────────────────────────────────────────────────────────────────────────
Pump / fan (affinity laws):
    Flow     ∝ speed (n)
    Head     ∝ speed² (n²)
    Shaft power ∝ speed³ (n³)
    → P_shaft_vfd(n_frac) = P_rated_kW × n_frac³

Conveyor / constant-torque:
    Torque ≈ constant  →  P_shaft ∝ speed
    → P_shaft_vfd(n_frac) = P_rated_kW × n_frac

Throttling baseline:
    The motor runs near rated speed regardless of flow demand.
    The throttle or damper dissipates the excess hydraulic/pneumatic energy.
    Electrical input to motor ≈ P_rated_kW / η_motor  at all operating points.
    (Minor deviations due to slip change are neglected — conservative assumption.)

VFD electrical input:
    P_elec_vfd = P_shaft_vfd / (η_motor × η_vfd)

Annual energy per profile point i:
    E_i = P_i × tf_i × H      [kWh/yr]   (tf_i = fraction of operating hours)

VFD rating recommendation:
    P_vfd_rated ≥ P_rated_kW × headroom_factor   (headroom accounts for starting
    torque boost, motor cable losses, VFD derating at altitude/temperature)
──────────────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations
import numpy as np
from app.schemas.vfd import VFDRequest, VFDResponse


def compute_vfd(req: VFDRequest) -> VFDResponse:
    H = req.operating_hours_per_year
    eta_m = req.motor_efficiency
    eta_v = req.vfd_efficiency
    P_rated = req.motor_power_kw

    # Rated electrical input (baseline: throttle, motor at full speed)
    p_baseline_elec = P_rated / eta_m

    profile_analysis = []
    total_baseline_kwh = 0.0
    total_vfd_kwh = 0.0

    for pt in req.load_profile:
        sf = pt.speed_fraction
        tf = pt.time_fraction

        # Baseline: motor draws full rated electrical input
        p_base = p_baseline_elec
        e_base = p_base * tf * H

        # VFD shaft power follows affinity or torque law
        if req.load_type in ("pump", "fan"):
            p_shaft_vfd = P_rated * (sf ** 3)
        else:  # conveyor / constant torque
            p_shaft_vfd = P_rated * sf

        # Electrical input through motor and VFD
        p_elec_vfd = p_shaft_vfd / (eta_m * eta_v)
        e_vfd = p_elec_vfd * tf * H

        total_baseline_kwh += e_base
        total_vfd_kwh += e_vfd

        profile_analysis.append({
            "speed_fraction": sf,
            "time_fraction": tf,
            "baseline_power_kw": round(p_base, 3),
            "vfd_input_power_kw": round(p_elec_vfd, 3),
            "baseline_annual_kwh": round(e_base, 1),
            "vfd_annual_kwh": round(e_vfd, 1),
        })

    saved_kwh = total_baseline_kwh - total_vfd_kwh
    saved_cost = saved_kwh * req.tariff_per_kwh
    payback = req.vfd_cost / saved_cost if saved_cost > 1e-9 else float("inf")
    recommended_vfd_kw = P_rated * req.headroom_factor

    # Power-vs-speed curve (10 % → 100 %)
    speed_pts = [round(i / 10, 2) for i in range(1, 11)]
    if req.load_type in ("pump", "fan"):
        vfd_frac = [round(s ** 3, 5) for s in speed_pts]
    else:
        vfd_frac = [round(s, 5) for s in speed_pts]
    baseline_frac = [1.0] * len(speed_pts)

    law_desc = "P_shaft ∝ speed³ (affinity law)" if req.load_type in ("pump", "fan") else "P_shaft ∝ speed (constant torque)"
    assumptions = [
        f"Load type: {req.load_type} — {law_desc}",
        f"Throttling baseline: motor electrical input ≈ {p_baseline_elec:.1f} kW at all flow points",
        f"Motor efficiency: {eta_m*100:.1f}% (constant across speed range — conservative for lower loads)",
        f"VFD efficiency: {eta_v*100:.0f}% (flat — typical for modern drives ≥ 20% speed)",
        f"VFD rating: {recommended_vfd_kw:.1f} kW = {P_rated} kW × {req.headroom_factor} headroom factor",
        "time_fraction values define annual hour distribution across speed/flow points",
    ]

    return VFDResponse(
        recommended_vfd_kw=round(recommended_vfd_kw, 1),
        headroom_factor=req.headroom_factor,
        profile_analysis=profile_analysis,
        totals={
            "baseline_annual_kwh": round(total_baseline_kwh, 1),
            "vfd_annual_kwh": round(total_vfd_kwh, 1),
            "saved_kwh": round(saved_kwh, 1),
            "saved_cost": round(saved_cost, 2),
            "payback_years": round(payback, 3),
        },
        power_vs_speed={
            "speed_fractions": speed_pts,
            "baseline_fraction": baseline_frac,
            "vfd_fraction": vfd_frac,
        },
        assumptions=assumptions,
    )
