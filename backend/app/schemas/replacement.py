from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field, model_validator


class ExistingMotorInput(BaseModel):
    rated_power_kw: float = Field(..., gt=0, le=10_000, description="Rated shaft output power in kW")
    ie_class: Optional[str] = Field(None, pattern=r"^IE[1-4]$", description="IEC efficiency class")
    efficiency_override_pct: Optional[float] = Field(None, ge=50.0, le=100.0,
                                                      description="Explicit full-load efficiency %; overrides ie_class lookup")
    load_factor: float = Field(0.75, ge=0.05, le=1.0, description="Fraction of rated shaft load (0–1)")

    @model_validator(mode="after")
    def require_efficiency_source(self) -> "ExistingMotorInput":
        if self.ie_class is None and self.efficiency_override_pct is None:
            raise ValueError("Provide either ie_class or efficiency_override_pct")
        return self


class ReplacementMotorInput(BaseModel):
    ie_class: Optional[str] = Field(None, pattern=r"^IE[1-4]$")
    efficiency_override_pct: Optional[float] = Field(None, ge=50.0, le=100.0)
    cost: float = Field(..., ge=0.0, description="Replacement motor purchase cost (currency units)")

    @model_validator(mode="after")
    def require_efficiency_source(self) -> "ReplacementMotorInput":
        if self.ie_class is None and self.efficiency_override_pct is None:
            raise ValueError("Provide either ie_class or efficiency_override_pct")
        return self


class ReplacementRequest(BaseModel):
    existing_motor: ExistingMotorInput
    replacement_motor: ReplacementMotorInput
    operating_hours_per_year: float = Field(4_000, ge=0, le=8_760)
    tariff_per_kwh: float = Field(0.12, gt=0, description="Electricity tariff (currency/kWh)")
    co2_factor_kg_per_kwh: Optional[float] = Field(None, ge=0, le=10,
                                                    description="Grid CO₂ intensity (kg CO₂ per kWh); omit to skip CO₂ calc")
    lifetime_years: int = Field(20, ge=1, le=50)


# ── Response models ────────────────────────────────────────────────────────────

class MotorOperatingPoint(BaseModel):
    eta_at_load: float
    input_power_kw: float
    annual_kwh: float
    annual_cost: float


class SavingsSummary(BaseModel):
    annual_kwh: float
    annual_cost: float
    annual_co2_kg: Optional[float]
    payback_years: float
    lifetime_net_savings: float


class EfficiencyCurve(BaseModel):
    load_points: list[float]
    existing_eta: list[float]
    replacement_eta: list[float]


class PaybackTimeline(BaseModel):
    years: list[int]
    cumulative_savings: list[float]
    net_position: list[float]


class ReplacementResponse(BaseModel):
    existing: MotorOperatingPoint
    replacement: MotorOperatingPoint
    savings: SavingsSummary
    efficiency_curve: EfficiencyCurve
    payback_timeline: PaybackTimeline
    assumptions: list[str]
