from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel, Field


class ReportRequest(BaseModel):
    site_name: str = Field("", max_length=200)
    analyst_name: str = Field("", max_length=200)
    currency_symbol: str = Field("$", max_length=5)
    replacement_result: Optional[dict[str, Any]] = None
    vfd_result: Optional[dict[str, Any]] = None
    pq_result: Optional[dict[str, Any]] = None


class ModuleBreakdown(BaseModel):
    module: str
    kwh_saved: float
    cost_saved: float
    investment: float


class ReportSummary(BaseModel):
    total_annual_kwh_saved: float
    total_annual_cost_saved: float
    total_co2_kg_reduced: Optional[float]
    total_investment: float
    blended_payback_years: float
    breakdown: list[ModuleBreakdown]
    power_quality_flags: int
    disclaimer: str
