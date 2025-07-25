"""Tests for the power quality / DSP module."""
import math
import numpy as np
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.dsp import _analyze_channel, _generate_preset, _compute_power_metrics

client = TestClient(app)

FS = 10_000.0
F0 = 50.0


def _sine(amplitude: float, freq: float, phase: float = 0.0, n: int = 2000) -> np.ndarray:
    t = np.arange(n) / FS
    return amplitude * np.sin(2 * np.pi * freq * t + phase)


def test_clean_sinusoid_low_thd():
    sig = _sine(42.0, F0)
    result = _analyze_channel(sig, FS, F0)
    assert result.thd_pct < 1.0, "Pure sine should have THD < 1 %"


def test_rms_of_sine():
    amplitude = 42.0
    sig = _sine(amplitude, F0)
    result = _analyze_channel(sig, FS, F0)
    expected_rms = amplitude / math.sqrt(2)
    assert abs(result.rms - expected_rms) < 0.5, f"RMS {result.rms:.3f} != expected {expected_rms:.3f}"


def test_thd_known_harmonics():
    """Signal with 5th harmonic at 14 % → THD ≈ 14 %."""
    i1 = 42.0
    sig = _sine(i1, F0) + _sine(0.14 * i1, 5 * F0)
    result = _analyze_channel(sig, FS, F0)
    # THD = sqrt(0.14²) / 1 = 14 %  (only one harmonic)
    assert abs(result.thd_pct - 14.0) < 2.0, f"THD {result.thd_pct:.2f} % not near 14 %"


def test_harmonic_components_detected():
    """5th harmonic should appear in harmonics dict."""
    i1 = 42.0
    sig = _sine(i1, F0) + _sine(0.14 * i1, 5 * F0)
    result = _analyze_channel(sig, FS, F0)
    assert "5" in result.harmonics, "5th harmonic not detected"
    h5 = result.harmonics["5"].amplitude_rms
    expected = 0.14 * i1 / math.sqrt(2)
    assert abs(h5 - expected) < 1.0, f"5th harmonic amplitude {h5:.3f} != expected {expected:.3f}"


def test_power_factor_unity():
    """In-phase V and I → PF = 1."""
    ia = _sine(42.0, F0)
    va = _sine(325.3, F0)
    pm = _compute_power_metrics(ia, va, FS, F0)
    assert pm.power_factor > 0.995


def test_power_factor_lagging():
    """Current lagging by 37° → PF ≈ cos(37°) ≈ 0.799."""
    va = _sine(325.3, F0)
    ia = _sine(42.0, F0, phase=-math.radians(37))
    pm = _compute_power_metrics(ia, va, FS, F0)
    assert abs(pm.power_factor - 0.799) < 0.03, f"PF {pm.power_factor:.3f} not near 0.80"


def test_preset_clean_sinusoid_api():
    r = client.post("/api/power-quality/analyze", json={
        "source": "preset",
        "preset_name": "clean_sinusoid",
    })
    assert r.status_code == 200
    d = r.json()
    assert d["channels"]["ia"]["thd_pct"] < 1.0


def test_preset_vfd_harmonics_fails_thd():
    r = client.post("/api/power-quality/analyze", json={
        "source": "preset",
        "preset_name": "vfd_harmonics",
        "thresholds": {"thd_current_pct": 8.0},
    })
    assert r.status_code == 200
    d = r.json()
    flags = {f["metric"]: f["status"] for f in d["status_table"]}
    assert flags.get("Current THD (ia)") in ("WARN", "FAIL"), "VFD harmonics preset should breach THD limit"


def test_preset_unbalanced_3phase():
    r = client.post("/api/power-quality/analyze", json={
        "source": "preset",
        "preset_name": "unbalanced_3phase",
        "thresholds": {"current_unbalance_pct": 3.0},
    })
    assert r.status_code == 200
    d = r.json()
    assert d["phase_unbalance"] is not None
    assert d["phase_unbalance"]["current_unbalance_pct"] > 3.0


def test_missing_preset_name_returns_422():
    r = client.post("/api/power-quality/analyze", json={"source": "preset"})
    assert r.status_code == 422


def test_json_source_without_data_returns_422():
    r = client.post("/api/power-quality/analyze", json={"source": "json"})
    assert r.status_code == 422


def test_waveform_preview_max_1000_points():
    r = client.post("/api/power-quality/analyze", json={
        "source": "preset", "preset_name": "vfd_harmonics"
    })
    d = r.json()
    assert len(d["waveform_preview"]["time_ms"]) <= 1000


def test_presets_list():
    r = client.get("/api/power-quality/presets")
    assert r.status_code == 200
    d = r.json()
    assert len(d["presets"]) == 4
