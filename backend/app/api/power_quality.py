import json
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from app.schemas.power_quality import PQRequest, PQResponse, PQThresholds, PRESET_NAMES
from app.core.dsp import analyze, parse_csv

router = APIRouter(prefix="/power-quality", tags=["power-quality"])


@router.get("/presets")
def list_presets():
    return {
        "presets": [
            {"name": "clean_sinusoid",   "description": "Pure 50 Hz sine — baseline reference, zero THD"},
            {"name": "vfd_harmonics",    "description": "6-pulse VFD current: 5th (14%), 7th (9%), 11th, 13th harmonics"},
            {"name": "unbalanced_3phase","description": "3-phase supply with ~4% current unbalance and slight voltage unbalance"},
            {"name": "low_power_factor", "description": "Single-phase load with PF ≈ 0.80 (37° current lag)"},
        ]
    }


@router.post("/analyze", response_model=PQResponse)
def analyze_waveform(req: PQRequest):
    if req.source == "preset" and req.preset_name is None:
        raise HTTPException(status_code=422, detail="preset_name required when source='preset'")
    if req.source == "json" and req.data is None:
        raise HTTPException(status_code=422, detail="data required when source='json'")
    try:
        return analyze(req)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/upload", response_model=PQResponse)
async def upload_csv(
    file: UploadFile = File(..., description="CSV with header: time,ia[,ib,ic,va,vb,vc]"),
    sample_rate_hz: float = Form(10_000.0),
    fundamental_freq_hz: float = Form(50.0),
    thd_current_pct: float = Form(8.0),
    thd_voltage_pct: float = Form(5.0),
    power_factor_min: float = Form(0.95),
    current_unbalance_pct: float = Form(3.0),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:  # 10 MB hard limit
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    try:
        raw = parse_csv(content)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"CSV parse error: {exc}")

    from app.schemas.power_quality import WaveformData
    try:
        data = WaveformData(**raw)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    req = PQRequest(
        source="json",
        sample_rate_hz=sample_rate_hz,
        fundamental_freq_hz=fundamental_freq_hz,
        thresholds=PQThresholds(
            thd_current_pct=thd_current_pct,
            thd_voltage_pct=thd_voltage_pct,
            power_factor_min=power_factor_min,
            current_unbalance_pct=current_unbalance_pct,
        ),
        data=data,
    )
    try:
        return analyze(req)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
