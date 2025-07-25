"""Tests for the VFD sizing & savings module."""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

BASE_PAYLOAD = {
    "motor_power_kw": 55.0,
    "load_type": "pump",
    "motor_efficiency": 0.946,
    "vfd_efficiency": 0.97,
    "load_profile": [
        {"speed_fraction": 1.00, "time_fraction": 0.10},
        {"speed_fraction": 0.85, "time_fraction": 0.30},
        {"speed_fraction": 0.70, "time_fraction": 0.40},
        {"speed_fraction": 0.50, "time_fraction": 0.20},
    ],
    "operating_hours_per_year": 7000,
    "tariff_per_kwh": 0.12,
    "vfd_cost": 7500.0,
    "headroom_factor": 1.10,
}


def test_api_valid_pump_request():
    r = client.post("/api/vfd/calculate", json=BASE_PAYLOAD)
    assert r.status_code == 200
    d = r.json()
    assert d["totals"]["saved_kwh"] > 0
    assert d["totals"]["payback_years"] > 0
    assert d["recommended_vfd_kw"] == pytest.approx(55.0 * 1.10, rel=0.01)


def test_affinity_law_saves_more_at_part_speed():
    """VFD must use less energy than baseline at speed < 1.0."""
    r = client.post("/api/vfd/calculate", json=BASE_PAYLOAD)
    d = r.json()
    for pt in d["profile_analysis"]:
        if pt["speed_fraction"] < 1.0:
            assert pt["vfd_annual_kwh"] < pt["baseline_annual_kwh"], (
                f"VFD should save energy at {pt['speed_fraction']} speed fraction"
            )


def test_pump_cubic_law():
    """At 50 % speed, pump shaft power = 0.5³ = 12.5 % of rated."""
    payload = dict(BASE_PAYLOAD)
    payload["load_profile"] = [{"speed_fraction": 0.50, "time_fraction": 1.0}]
    r = client.post("/api/vfd/calculate", json=payload)
    d = r.json()
    pt = d["profile_analysis"][0]
    # VFD shaft power fraction ≈ 0.5³ = 0.125
    # VFD electrical = shaft / (eta_m * eta_v)
    expected_elec = 55.0 * (0.5 ** 3) / (0.946 * 0.97)
    assert abs(pt["vfd_input_power_kw"] - expected_elec) < 0.05


def test_conveyor_linear_law():
    """At 70 % speed, conveyor shaft power = 70 % of rated."""
    payload = {**BASE_PAYLOAD, "load_type": "conveyor",
               "load_profile": [{"speed_fraction": 0.70, "time_fraction": 1.0}]}
    r = client.post("/api/vfd/calculate", json=payload)
    d = r.json()
    pt = d["profile_analysis"][0]
    expected_elec = 55.0 * 0.70 / (0.946 * 0.97)
    assert abs(pt["vfd_input_power_kw"] - expected_elec) < 0.05


def test_time_fraction_validation():
    """time_fraction values must sum to 1.0 (within ±0.02)."""
    bad = dict(BASE_PAYLOAD)
    bad["load_profile"] = [
        {"speed_fraction": 1.0, "time_fraction": 0.5},
        {"speed_fraction": 0.7, "time_fraction": 0.6},   # sum = 1.1
    ]
    r = client.post("/api/vfd/calculate", json=bad)
    assert r.status_code == 422


def test_power_vs_speed_curve_length():
    r = client.post("/api/vfd/calculate", json=BASE_PAYLOAD)
    d = r.json()
    pvs = d["power_vs_speed"]
    assert len(pvs["speed_fractions"]) == 10
    assert len(pvs["vfd_fraction"]) == 10
    assert len(pvs["baseline_fraction"]) == 10


def test_power_vs_speed_monotone_pump():
    """For a pump, VFD power fraction must be strictly increasing with speed."""
    r = client.post("/api/vfd/calculate", json=BASE_PAYLOAD)
    d = r.json()
    vfd = d["power_vs_speed"]["vfd_fraction"]
    assert all(vfd[i] < vfd[i+1] for i in range(len(vfd)-1))


def test_demo_preset_returns_200():
    r = client.get("/api/vfd/demo")
    assert r.status_code == 200
