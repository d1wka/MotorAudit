"""
Motor efficiency lookup and interpolation.

The IEC table provides η at 4 load points: 25 %, 50 %, 75 %, 100 %.
We fit a quadratic polynomial through these 4 points (least-squares) and
evaluate it at any requested load factor.  A quadratic is adequate for the
smooth, unimodal η-vs-LF curve typical of induction motors.

For the 'efficiency_override_pct' case (user provides a single number) we use
a parametric Gaussian-like model:
    η(lf) = η_peak · exp(−k · (lf − lf_peak)²)
with lf_peak = 0.75 and k chosen so η(1.0) ≈ 0.985 · η_peak.
"""

from __future__ import annotations
import numpy as np
from app.db.seed import MOTORS, nearest_rated_power

# Build a fast lookup: (ie_class, power_kw) → np arrays of (lf_pts, eta_pts)
_LF_POINTS = np.array([0.25, 0.50, 0.75, 1.00])

_TABLE: dict[tuple[str, float], np.ndarray] = {}
for _m in MOTORS:
    _TABLE[(_m["ie_class"], _m["rated_power_kw"])] = np.array(
        [_m["eta_25"], _m["eta_50"], _m["eta_75"], _m["eta_100"]]
    )

# Gaussian peak-shape constant: η(1.0) = η_peak · exp(−k · 0.0625) ≈ 0.985 · η_peak
_GAUSS_K = -np.log(0.985) / 0.0625  # ≈ 0.243


def get_efficiency_at_load(
    ie_class: str | None,
    rated_power_kw: float,
    load_factor: float,
    efficiency_override_pct: float | None = None,
) -> float:
    """
    Return estimated η at *load_factor* for the requested motor spec.

    If efficiency_override_pct is given, the IEC table is ignored and a
    Gaussian-peak model is applied around 75 % load.
    """
    lf = float(np.clip(load_factor, 0.05, 1.05))

    if efficiency_override_pct is not None:
        eta_peak = efficiency_override_pct / 100.0
        eta = eta_peak * np.exp(-_GAUSS_K * (lf - 0.75) ** 2)
        return float(np.clip(eta, 0.0, 1.0))

    # Nearest tabulated power rating
    nearest_kw = nearest_rated_power(rated_power_kw)
    key = (ie_class, nearest_kw)

    if key not in _TABLE:
        raise ValueError(f"No efficiency data for {ie_class} {nearest_kw} kW")

    eta_pts = _TABLE[key]
    # Quadratic least-squares fit through the 4 IEC load points
    coeffs = np.polyfit(_LF_POINTS, eta_pts, 2)
    eta = float(np.polyval(coeffs, lf))
    return float(np.clip(eta, 0.30, 1.0))


def get_efficiency_curve(
    ie_class: str | None,
    rated_power_kw: float,
    efficiency_override_pct: float | None = None,
    load_points: list[float] | None = None,
) -> tuple[list[float], list[float]]:
    """Return (load_points, eta_values) for plotting."""
    pts = load_points or [0.25, 0.50, 0.75, 1.00]
    etas = [
        get_efficiency_at_load(ie_class, rated_power_kw, lf, efficiency_override_pct)
        for lf in pts
    ]
    return pts, etas
