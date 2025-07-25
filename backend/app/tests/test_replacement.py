"""Tests for the motor replacement & payback module."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.motor_db import get_efficiency_at_load
from app.core.replacement_calc import compute_replacement
from app.schemas.replacement import ReplacementRequest

client = TestClient(app)

BASE_PAYLOAD = {
    "existing_motor": {"rated_power_kw": 37.0, "ie_class": "IE1", "load_factor": 0.75},
    "replacement_motor": {"ie_class": "IE3", "cost": 4200.0},
    "operating_hours_per_year": 6000,
    "tariff_per_kwh": 0.12,
    "co2_factor_kg_per_kwh": 0.233,
    "lifetime_years": 20,
}


def test_ie3_more_efficient_than_ie1():
    eta_ie1 = get_efficiency_at_load("IE1", 37.0, 0.75)
    eta_ie3 = get_efficiency_at_load("IE3", 37.0, 0.75)
    assert eta_ie3 > eta_ie1, "IE3 must have higher efficiency than IE1 at same load"


def test_efficiency_within_physical_range():
    for ie in ("IE1", "IE2", "IE3", "IE4"):
        for lf in (0.25, 0.50, 0.75, 1.00):
            eta = get_efficiency_at_load(ie, 37.0, lf)
            assert 0.5 < eta < 1.0, f"Efficiency {eta} out of range for {ie} at LF={lf}"


def test_efficiency_peak_near_75pct():
    """For IE3 37 kW, η should be highest around 75 % load per IEC data."""
    eta_50 = get_efficiency_at_load("IE3", 37.0, 0.50)
    eta_75 = get_efficiency_at_load("IE3", 37.0, 0.75)
    eta_100 = get_efficiency_at_load("IE3", 37.0, 1.00)
    assert eta_75 >= eta_50
    assert eta_75 >= eta_100


def test_api_valid_request():
    r = client.post("/api/replacement/calculate", json=BASE_PAYLOAD)
    assert r.status_code == 200
    d = r.json()
    assert d["savings"]["annual_kwh"] > 0
    assert d["savings"]["payback_years"] > 0
    assert d["savings"]["annual_co2_kg"] > 0
    assert len(d["efficiency_curve"]["load_points"]) == 4
    assert len(d["payback_timeline"]["years"]) == 21  # year 0 … 20


def test_api_missing_efficiency_source_returns_422():
    bad = dict(BASE_PAYLOAD)
    bad["existing_motor"] = {"rated_power_kw": 37.0, "load_factor": 0.75}  # no ie_class or override
    r = client.post("/api/replacement/calculate", json=bad)
    assert r.status_code == 422


def test_api_invalid_load_factor():
    bad = dict(BASE_PAYLOAD)
    bad["existing_motor"] = {"rated_power_kw": 37.0, "ie_class": "IE1", "load_factor": 1.5}
    r = client.post("/api/replacement/calculate", json=bad)
    assert r.status_code == 422


def test_energy_savings_positive_for_upgrade():
    """Upgrading from IE1 to IE3 must save energy."""
    r = client.post("/api/replacement/calculate", json=BASE_PAYLOAD)
    d = r.json()
    assert d["existing"]["annual_kwh"] > d["replacement"]["annual_kwh"]


def test_payback_timeline_monotone():
    r = client.post("/api/replacement/calculate", json=BASE_PAYLOAD)
    d = r.json()
    cs = d["payback_timeline"]["cumulative_savings"]
    assert all(cs[i] <= cs[i+1] for i in range(len(cs)-1)), "Cumulative savings must be non-decreasing"


def test_efficiency_override():
    payload = {
        "existing_motor": {"rated_power_kw": 37.0, "efficiency_override_pct": 88.0, "load_factor": 0.75},
        "replacement_motor": {"efficiency_override_pct": 95.0, "cost": 5000.0},
        "operating_hours_per_year": 6000,
        "tariff_per_kwh": 0.12,
        "lifetime_years": 20,
    }
    r = client.post("/api/replacement/calculate", json=payload)
    assert r.status_code == 200
    d = r.json()
    assert abs(d["existing"]["eta_at_load"] - 0.88) < 0.005


def test_demo_preset_returns_200():
    r = client.get("/api/replacement/demo")
    assert r.status_code == 200
