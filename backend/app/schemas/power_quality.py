from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field


PRESET_NAMES = Literal[
    "clean_sinusoid",
    "vfd_harmonics",
    "unbalanced_3phase",
    "low_power_factor",
]


class PQThresholds(BaseModel):
    thd_voltage_pct: float = Field(5.0, ge=0)
    thd_current_pct: float = Field(8.0, ge=0)
    power_factor_min: float = Field(0.95, ge=0, le=1.0)
    current_unbalance_pct: float = Field(3.0, ge=0)


class WaveformData(BaseModel):
    """
    Time-domain samples for up to three-phase current and voltage.
    All lists must have the same length. Single-phase: provide only ia (and va).
    """
    ia: list[float] = Field(..., min_length=64, description="Phase A current samples (A)")
    ib: Optional[list[float]] = Field(None, description="Phase B current samples (A)")
    ic: Optional[list[float]] = Field(None, description="Phase C current samples (A)")
    va: Optional[list[float]] = Field(None, description="Phase A voltage samples (V)")
    vb: Optional[list[float]] = Field(None, description="Phase B voltage samples (V)")
    vc: Optional[list[float]] = Field(None, description="Phase C voltage samples (V)")


class PQRequest(BaseModel):
    source: Literal["json", "preset"] = "preset"
    preset_name: Optional[PRESET_NAMES] = None
    sample_rate_hz: float = Field(10_000.0, gt=100, le=1_000_000)
    fundamental_freq_hz: float = Field(50.0, ge=45, le=65)
    thresholds: PQThresholds = Field(default_factory=PQThresholds)
    data: Optional[WaveformData] = None


# ── Response models ────────────────────────────────────────────────────────────

class HarmonicComponent(BaseModel):
    freq_hz: float
    amplitude_rms: float


class ChannelAnalysis(BaseModel):
    rms: float
    peak: float
    thd_pct: float
    harmonics: dict[str, HarmonicComponent]  # key = harmonic order "1", "3", …


class PowerMetrics(BaseModel):
    active_power_w: float
    apparent_power_va: float
    reactive_power_var: float
    power_factor: float
    displacement_cos_phi: float
    capacitor_bank_kvar: Optional[float] = None  # to reach PF target


class PhaseUnbalance(BaseModel):
    current_unbalance_pct: float
    voltage_unbalance_pct: Optional[float]
    method: str


class StatusFlag(BaseModel):
    metric: str
    value: float
    limit: float
    unit: str
    status: Literal["PASS", "WARN", "FAIL"]


class WaveformPreview(BaseModel):
    time_ms: list[float]
    ia: Optional[list[float]]
    ib: Optional[list[float]]
    ic: Optional[list[float]]
    va: Optional[list[float]]


class FFTPreview(BaseModel):
    freq_hz: list[float]
    ia_magnitude: Optional[list[float]]
    va_magnitude: Optional[list[float]]


class PQResponse(BaseModel):
    duration_s: float
    actual_fundamental_hz: float
    channels: dict[str, ChannelAnalysis]
    power_metrics: Optional[PowerMetrics]
    phase_unbalance: Optional[PhaseUnbalance]
    status_table: list[StatusFlag]
    recommendations: list[str]
    waveform_preview: WaveformPreview
    fft_preview: FFTPreview
