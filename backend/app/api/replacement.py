from fastapi import APIRouter, HTTPException
from app.schemas.replacement import ReplacementRequest, ReplacementResponse
from app.core.replacement_calc import compute_replacement

router = APIRouter(prefix="/replacement", tags=["replacement"])

DEMO_PRESET = {
    "existing_motor": {
        "rated_power_kw": 37.0,
        "ie_class": "IE1",
        "load_factor": 0.75,
    },
    "replacement_motor": {
        "ie_class": "IE3",
        "cost": 4200.0,
    },
    "operating_hours_per_year": 6000,
    "tariff_per_kwh": 0.12,
    "co2_factor_kg_per_kwh": 0.233,
    "lifetime_years": 20,
}


@router.post("/calculate", response_model=ReplacementResponse)
def calculate_replacement(req: ReplacementRequest):
    try:
        return compute_replacement(req)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/demo")
def get_demo():
    """Return demo preset inputs so the UI can pre-fill the form."""
    return DEMO_PRESET
