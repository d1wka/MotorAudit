"""
Module 3 — Power Quality DSP Engine.

Definitions used throughout:
──────────────────────────────────────────────────────────────────────────────
THD (Total Harmonic Distortion):
    THD = √( Σ_{h=2}^{N} I_h² ) / I_1 × 100 %
    where I_h is the RMS amplitude of the h-th harmonic component.
    (IEEE 519-2022 definition for current THD.)

RMS:
    X_rms = √( (1/N) Σ x_i² )

Power Factor:
    PF = P / S = mean(v·i) / (V_rms × I_rms)

Displacement Power Factor (cos φ):
    Phase angle between fundamental voltage and current phasors.

Phase Unbalance (NEMA MG-1 method):
    UB% = max(|I_x − Ī|) / Ī × 100
    where Ī = (Ia_rms + Ib_rms + Ic_rms) / 3

Reactive power correction:
    Q_corr = P × (tan φ_actual − tan φ_target)  [kVAr]
──────────────────────────────────────────────────────────────────────────────

FFT amplitude extraction:
    - Hanning window applied to reduce spectral leakage.
    - Normalization: peak_amplitude = 2 × |FFT[k]| / Σ(window)
    - RMS amplitude = peak_amplitude / √2
    - A ±3 Hz search window around each harmonic target accounts for
      slight frequency drift between signal and sample-rate grid.
"""

from __future__ import annotations

import csv
import io
from typing import Optional

import numpy as np

from app.schemas.power_quality import (
    PQRequest,
    PQResponse,
    ChannelAnalysis,
    HarmonicComponent,
    PowerMetrics,
    PhaseUnbalance,
    StatusFlag,
    WaveformPreview,
    FFTPreview,
)


# ── Preset waveform generators ─────────────────────────────────────────────────

def _generate_preset(
    name: str,
    sample_rate_hz: float = 10_000.0,
    duration_s: float = 0.2,
    fundamental_hz: float = 50.0,
) -> dict[str, list[float]]:
    t = np.arange(0, duration_s, 1.0 / sample_rate_hz)
    f = fundamental_hz

    if name == "clean_sinusoid":
        ia = 42.0 * np.sin(2 * np.pi * f * t)
        va = 325.3 * np.sin(2 * np.pi * f * t)          # 230 V RMS
        return {"ia": ia.tolist(), "va": va.tolist()}

    elif name == "vfd_harmonics":
        # Typical 6-pulse VFD input current: dominant 5th and 7th, weaker 11th, 13th
        i1 = 42.0
        ia = (
            i1 * np.sin(2 * np.pi * f * t)
            + 0.14 * i1 * np.sin(2 * np.pi * 5 * f * t + 0.20)
            + 0.09 * i1 * np.sin(2 * np.pi * 7 * f * t + 0.50)
            + 0.05 * i1 * np.sin(2 * np.pi * 11 * f * t + 0.10)
            + 0.03 * i1 * np.sin(2 * np.pi * 13 * f * t + 0.30)
        )
        va = 325.3 * np.sin(2 * np.pi * f * t)           # Clean supply voltage
        return {"ia": ia.tolist(), "va": va.tolist()}

    elif name == "unbalanced_3phase":
        i1 = 42.0
        ia = i1 * np.sin(2 * np.pi * f * t)
        ib = i1 * 0.92 * np.sin(2 * np.pi * f * t - 2 * np.pi / 3)   # −8 %
        ic = i1 * 1.06 * np.sin(2 * np.pi * f * t + 2 * np.pi / 3)   # +6 %
        va = 325.3 * np.sin(2 * np.pi * f * t)
        vb = 321.0 * np.sin(2 * np.pi * f * t - 2 * np.pi / 3)
        vc = 327.5 * np.sin(2 * np.pi * f * t + 2 * np.pi / 3)
        return {
            "ia": ia.tolist(), "ib": ib.tolist(), "ic": ic.tolist(),
            "va": va.tolist(), "vb": vb.tolist(), "vc": vc.tolist(),
        }

    elif name == "low_power_factor":
        # Current lagging voltage by 37° → displacement PF ≈ 0.80
        phi_lag = np.radians(37.0)
        ia = 52.5 * np.sin(2 * np.pi * f * t - phi_lag)
        va = 325.3 * np.sin(2 * np.pi * f * t)
        return {"ia": ia.tolist(), "va": va.tolist()}

    raise ValueError(f"Unknown preset: {name!r}")


# ── Single-channel FFT analysis ────────────────────────────────────────────────

def _analyze_channel(
    data: np.ndarray,
    sample_rate_hz: float,
    fundamental_hz: float,
    search_hz: float = 3.0,
) -> ChannelAnalysis:
    n = len(data)
    window = np.hanning(n)
    window_sum = window.sum()

    fft_vals = np.fft.rfft(data * window)
    freqs = np.fft.rfftfreq(n, d=1.0 / sample_rate_hz)

    # Amplitude correction for Hanning window → peak amplitudes
    amplitudes_peak = np.abs(fft_vals) * 2.0 / window_sum
    amplitudes_rms = amplitudes_peak / np.sqrt(2.0)

    harmonics: dict[str, HarmonicComponent] = {}
    h1_rms: Optional[float] = None
    sum_harmonic_rms_sq = 0.0

    for h in range(1, 51):
        target = fundamental_hz * h
        if target > freqs[-1]:
            break

        mask = (freqs >= target - search_hz) & (freqs <= target + search_hz)
        if not np.any(mask):
            continue

        amp_rms = float(amplitudes_rms[mask].max())

        if h == 1:
            h1_rms = amp_rms
        else:
            sum_harmonic_rms_sq += amp_rms ** 2

        # Include h1–h15 and any harmonic above 0.3 % of fundamental
        threshold = (h1_rms or 1.0) * 0.003
        if h <= 15 or amp_rms > threshold:
            harmonics[str(h)] = HarmonicComponent(
                freq_hz=round(float(target), 2),
                amplitude_rms=round(float(amp_rms), 5),
            )

    thd_pct = (
        np.sqrt(sum_harmonic_rms_sq) / h1_rms * 100.0
        if (h1_rms and h1_rms > 1e-10)
        else 0.0
    )
    rms = float(np.sqrt(np.mean(data ** 2)))
    peak = float(np.max(np.abs(data)))

    return ChannelAnalysis(
        rms=round(rms, 4),
        peak=round(peak, 4),
        thd_pct=round(float(thd_pct), 3),
        harmonics=harmonics,
    )


# ── Power metrics ──────────────────────────────────────────────────────────────

def _compute_power_metrics(
    ia: np.ndarray,
    va: np.ndarray,
    sample_rate_hz: float,
    fundamental_hz: float,
    pf_target: float = 0.95,
) -> PowerMetrics:
    P = float(np.mean(va * ia))
    V_rms = float(np.sqrt(np.mean(va ** 2)))
    I_rms = float(np.sqrt(np.mean(ia ** 2)))
    S = V_rms * I_rms
    Q = float(np.sqrt(max(S ** 2 - P ** 2, 0.0)))
    PF = abs(P / S) if S > 1e-10 else 0.0

    # Displacement PF: phase angle between fundamental phasors
    n = len(ia)
    window = np.hanning(n)
    fft_i = np.fft.rfft(ia * window)
    fft_v = np.fft.rfft(va * window)
    freqs = np.fft.rfftfreq(n, d=1.0 / sample_rate_hz)
    fund_idx = int(np.argmin(np.abs(freqs - fundamental_hz)))
    phi = float(np.angle(fft_v[fund_idx]) - np.angle(fft_i[fund_idx]))
    cos_phi = abs(float(np.cos(phi)))

    # Capacitor bank to correct PF to target
    if PF < pf_target and P > 0:
        phi_actual = np.arccos(np.clip(PF, 0, 1))
        phi_target = np.arccos(pf_target)
        q_corr_kvar = round(P / 1000.0 * (np.tan(phi_actual) - np.tan(phi_target)), 3)
    else:
        q_corr_kvar = None

    return PowerMetrics(
        active_power_w=round(P, 2),
        apparent_power_va=round(S, 2),
        reactive_power_var=round(Q, 2),
        power_factor=round(PF, 5),
        displacement_cos_phi=round(cos_phi, 5),
        capacitor_bank_kvar=q_corr_kvar,
    )


# ── Phase unbalance ────────────────────────────────────────────────────────────

def _compute_unbalance(
    ia: np.ndarray,
    ib: np.ndarray,
    ic: np.ndarray,
    va: Optional[np.ndarray],
    vb: Optional[np.ndarray],
    vc: Optional[np.ndarray],
) -> PhaseUnbalance:
    rms_a = float(np.sqrt(np.mean(ia ** 2)))
    rms_b = float(np.sqrt(np.mean(ib ** 2)))
    rms_c = float(np.sqrt(np.mean(ic ** 2)))
    i_avg = (rms_a + rms_b + rms_c) / 3.0
    i_ub = max(abs(rms_a - i_avg), abs(rms_b - i_avg), abs(rms_c - i_avg)) / i_avg * 100.0 if i_avg > 1e-10 else 0.0

    v_ub: Optional[float] = None
    if va is not None and vb is not None and vc is not None:
        rv_a = float(np.sqrt(np.mean(va ** 2)))
        rv_b = float(np.sqrt(np.mean(vb ** 2)))
        rv_c = float(np.sqrt(np.mean(vc ** 2)))
        v_avg = (rv_a + rv_b + rv_c) / 3.0
        v_ub = max(abs(rv_a - v_avg), abs(rv_b - v_avg), abs(rv_c - v_avg)) / v_avg * 100.0 if v_avg > 1e-10 else 0.0

    return PhaseUnbalance(
        current_unbalance_pct=round(i_ub, 3),
        voltage_unbalance_pct=round(v_ub, 3) if v_ub is not None else None,
        method="NEMA MG-1: max(|Ix − Iavg|) / Iavg × 100",
    )


# ── Status table & recommendations ────────────────────────────────────────────

def _status_table(
    channels: dict[str, ChannelAnalysis],
    power_metrics: Optional[PowerMetrics],
    unbalance: Optional[PhaseUnbalance],
    thresholds,
) -> list[StatusFlag]:
    flags: list[StatusFlag] = []

    def _flag(metric, value, limit, unit, low_is_bad=False):
        if low_is_bad:
            st = "PASS" if value >= limit else ("WARN" if value >= limit * 0.98 else "FAIL")
        else:
            if value <= limit:
                st = "PASS"
            elif value <= limit * 1.20:
                st = "WARN"
            else:
                st = "FAIL"
        return StatusFlag(metric=metric, value=round(value, 3), limit=round(limit, 3), unit=unit, status=st)

    if "ia" in channels:
        flags.append(_flag("Current THD (ia)", channels["ia"].thd_pct, thresholds.thd_current_pct, "%"))
    if "va" in channels:
        flags.append(_flag("Voltage THD (va)", channels["va"].thd_pct, thresholds.thd_voltage_pct, "%"))
    if power_metrics:
        flags.append(_flag("Power Factor", power_metrics.power_factor, thresholds.power_factor_min, "", low_is_bad=True))
    if unbalance:
        flags.append(_flag("Current Unbalance", unbalance.current_unbalance_pct, thresholds.current_unbalance_pct, "%"))
        if unbalance.voltage_unbalance_pct is not None:
            flags.append(_flag("Voltage Unbalance", unbalance.voltage_unbalance_pct, 2.0, "%"))
    return flags


def _recommendations(
    channels: dict[str, ChannelAnalysis],
    power_metrics: Optional[PowerMetrics],
    unbalance: Optional[PhaseUnbalance],
    status_flags: list[StatusFlag],
    thresholds,
) -> list[str]:
    recs: list[str] = []
    fail_warn = {f.metric for f in status_flags if f.status in ("FAIL", "WARN")}

    if "Current THD (ia)" in fail_warn:
        thd = channels["ia"].thd_pct
        h5 = channels["ia"].harmonics.get("5")
        h7 = channels["ia"].harmonics.get("7")
        dom = []
        if h5 and h5.amplitude_rms > (channels["ia"].rms * 0.05):
            dom.append("5th")
        if h7 and h7.amplitude_rms > (channels["ia"].rms * 0.05):
            dom.append("7th")
        filter_note = f"targeting {', '.join(dom)} harmonic(s)" if dom else "broadband"
        recs.append(
            f"Current THD {thd:.1f}% exceeds {thresholds.thd_current_pct:.0f}% limit — "
            f"consider passive C-type or active harmonic filter ({filter_note})."
        )

    if "Voltage THD (va)" in fail_warn and "va" in channels:
        recs.append(
            f"Voltage THD {channels['va'].thd_pct:.1f}% elevated — audit upstream harmonic sources "
            "and verify supply impedance."
        )

    if "Power Factor" in fail_warn and power_metrics:
        pf = power_metrics.power_factor
        qc = power_metrics.capacitor_bank_kvar
        recs.append(
            f"Power factor {pf:.3f} below {thresholds.power_factor_min:.2f} target — "
            + (f"install ≈ {qc:.1f} kVAr capacitor bank to reach target." if qc else "install PF correction capacitors.")
        )

    if "Current Unbalance" in fail_warn and unbalance:
        recs.append(
            f"Current unbalance {unbalance.current_unbalance_pct:.1f}% — "
            "check feeder cable impedances, fuse conditions, and motor winding resistance."
        )

    if "Voltage Unbalance" in fail_warn and unbalance and unbalance.voltage_unbalance_pct:
        recs.append(
            f"Voltage unbalance {unbalance.voltage_unbalance_pct:.1f}% — "
            "investigate transformer loading asymmetry and single-phase loads on feeder."
        )

    if not recs:
        recs.append("All measured metrics are within configured limits. No corrective action required.")

    return recs


# ── Public analysis entry point ────────────────────────────────────────────────

def analyze(req: PQRequest) -> PQResponse:
    fs = req.sample_rate_hz
    f0 = req.fundamental_freq_hz

    # Resolve waveform data
    if req.source == "preset":
        if not req.preset_name:
            raise ValueError("preset_name required when source='preset'")
        raw = _generate_preset(req.preset_name, fs, 0.2, f0)
    else:
        if req.data is None:
            raise ValueError("data required when source='json'")
        raw = {
            k: v for k, v in {
                "ia": req.data.ia,
                "ib": req.data.ib,
                "ic": req.data.ic,
                "va": req.data.va,
                "vb": req.data.vb,
                "vc": req.data.vc,
            }.items() if v is not None
        }

    # Convert to numpy
    arrays: dict[str, np.ndarray] = {k: np.array(v, dtype=float) for k, v in raw.items()}

    # Validate consistent lengths
    lengths = {k: len(v) for k, v in arrays.items()}
    if len(set(lengths.values())) > 1:
        raise ValueError(f"All channels must have equal length; got {lengths}")

    n_samples = len(next(iter(arrays.values())))
    duration_s = n_samples / fs

    # Detect actual fundamental from ia FFT
    fft_mag = np.abs(np.fft.rfft(arrays.get("ia", arrays.get("va", next(iter(arrays.values()))))))
    freqs_all = np.fft.rfftfreq(n_samples, d=1.0 / fs)
    search = (freqs_all >= f0 - 5) & (freqs_all <= f0 + 5)
    actual_f0 = float(freqs_all[search][np.argmax(fft_mag[search])]) if np.any(search) else f0

    # Per-channel analysis
    channels = {k: _analyze_channel(v, fs, actual_f0) for k, v in arrays.items()}

    # Power metrics (requires ia + va)
    power_metrics: Optional[PowerMetrics] = None
    if "ia" in arrays and "va" in arrays:
        power_metrics = _compute_power_metrics(
            arrays["ia"], arrays["va"], fs, actual_f0,
            pf_target=req.thresholds.power_factor_min
        )

    # Phase unbalance (3-phase)
    unbalance: Optional[PhaseUnbalance] = None
    if all(k in arrays for k in ("ia", "ib", "ic")):
        unbalance = _compute_unbalance(
            arrays["ia"], arrays["ib"], arrays["ic"],
            arrays.get("va"), arrays.get("vb"), arrays.get("vc"),
        )

    status = _status_table(channels, power_metrics, unbalance, req.thresholds)
    recs = _recommendations(channels, power_metrics, unbalance, status, req.thresholds)

    # Waveform preview (max 1 000 points)
    step = max(1, n_samples // 1000)
    t_ms = (np.arange(n_samples)[::step] / fs * 1000.0).tolist()
    wp = WaveformPreview(
        time_ms=[round(x, 4) for x in t_ms],
        ia=[round(x, 4) for x in arrays["ia"][::step].tolist()] if "ia" in arrays else None,
        ib=[round(x, 4) for x in arrays["ib"][::step].tolist()] if "ib" in arrays else None,
        ic=[round(x, 4) for x in arrays["ic"][::step].tolist()] if "ic" in arrays else None,
        va=[round(x, 4) for x in arrays["va"][::step].tolist()] if "va" in arrays else None,
    )

    # FFT preview (0–2 kHz, log-magnitude in dBFS)
    fft_len = n_samples
    window = np.hanning(fft_len)
    w_sum = window.sum()
    freq_pts = np.fft.rfftfreq(fft_len, d=1.0 / fs)
    max_freq_idx = np.searchsorted(freq_pts, 2000)
    freq_display = freq_pts[:max_freq_idx].tolist()

    def _db_mag(arr: np.ndarray) -> list[float]:
        mag = np.abs(np.fft.rfft(arr * window)) * 2.0 / w_sum
        mag_db = 20.0 * np.log10(np.clip(mag[:max_freq_idx], 1e-12, None))
        return [round(float(x), 2) for x in mag_db]

    fp = FFTPreview(
        freq_hz=[round(float(x), 2) for x in freq_display],
        ia_magnitude=_db_mag(arrays["ia"]) if "ia" in arrays else None,
        va_magnitude=_db_mag(arrays["va"]) if "va" in arrays else None,
    )

    return PQResponse(
        duration_s=round(duration_s, 5),
        actual_fundamental_hz=round(actual_f0, 3),
        channels=channels,
        power_metrics=power_metrics,
        phase_unbalance=unbalance,
        status_table=status,
        recommendations=recs,
        waveform_preview=wp,
        fft_preview=fp,
    )


# ── CSV parsing helper (used by upload endpoint) ───────────────────────────────

def parse_csv(content: bytes) -> dict[str, list[float]]:
    """
    Accept a CSV with a header row and columns: time, ia [, ib, ic, va, vb, vc].
    The 'time' column is ignored (sample rate is taken from the request).
    Returns a dict of column_name → float list.
    """
    text = content.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise ValueError("CSV has no header row")

    cols: dict[str, list[float]] = {}
    known = {"ia", "ib", "ic", "va", "vb", "vc"}
    for row in reader:
        for col in reader.fieldnames:
            if col.strip().lower() not in known:
                continue
            key = col.strip().lower()
            try:
                cols.setdefault(key, []).append(float(row[col]))
            except (ValueError, KeyError):
                raise ValueError(f"Non-numeric value in column '{col}'")

    if "ia" not in cols:
        raise ValueError("CSV must contain at least an 'ia' column")
    return cols
