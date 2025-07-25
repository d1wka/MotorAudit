from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field, model_validator


class LoadPoint(BaseModel):
    speed_fraction: float = Field(..., ge=0.05, le=1.0,
                                  description="Operating speed as fraction of rated speed (0–1)")
    time_fraction: float = Field(..., ge=0.0, le=1.0,
                                 description="Fraction of total operating hours spent at this speed")


class VFDRequest(BaseModel):
    motor_power_kw: float = Field(..., gt=0, le=10_000)
    load_type: Literal["pump", "fan", "conveyor"] = Field(
        "pump",
        description="pump/fan → affinity law (P ∝ speed³); conveyor → constant torque (P ∝ speed)"
    )
    motor_efficiency: float = Field(0.923, ge=0.5, le=1.0,
                                    description="Motor efficiency fraction (used for both baseline and VFD modes)")
    vfd_efficiency: float = Field(0.97, ge=0.5, le=1.0,
                                  description="VFD drive efficiency fraction (typically 0.96–0.98)")
    load_profile: list[LoadPoint] = Field(..., min_length=1, max_length=20,
                                          description="List of (speed_fraction, time_fraction) operating points")
    operating_hours_per_year: float = Field(4_000, ge=0, le=8_760)
    tariff_per_kwh: float = Field(0.12, gt=0)
    vfd_cost: float = Field(..., ge=0, description="VFD purchase and installation cost (currency units)")
    headroom_factor: float = Field(1.10, ge=1.0, le=2.0,
                                   description="VFD power rating headroom over motor rated power (default 10 %)")

    @model_validator(mode="after")
    def validate_time_fractions(self) -> "VFDRequest":
        total = sum(p.time_fraction for p in self.load_profile)
        if abs(total - 1.0) > 0.02:
            raise ValueError(f"time_fraction values must sum to 1.0 (got {total:.3f})")
        return self


# ── Response models ────────────────────────────────────────────────────────────

class ProfilePoint(BaseModel):
    speed_fraction: float
    time_fraction: float
    baseline_power_kw: float
    vfd_input_power_kw: float
    baseline_annual_kwh: float
    vfd_annual_kwh: float


class VFDTotals(BaseModel):
    baseline_annual_kwh: float
    vfd_annual_kwh: float
    saved_kwh: float
    saved_cost: float
    payback_years: float


class PowerVsSpeedCurve(BaseModel):
    speed_fractions: list[float]
    baseline_fraction: list[float]
    vfd_fraction: list[float]


class VFDResponse(BaseModel):
    recommended_vfd_kw: float
    headroom_factor: float
    profile_analysis: list[ProfilePoint]
    totals: VFDTotals
    power_vs_speed: PowerVsSpeedCurve
    assumptions: list[str]
