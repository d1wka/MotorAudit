from fastapi import APIRouter, HTTPException
from app.schemas.vfd import VFDRequest, VFDResponse
from app.core.vfd_calc import compute_vfd

router = APIRouter(prefix="/vfd", tags=["vfd"])

DEMO_PRESET = {
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


@router.post("/calculate", response_model=VFDResponse)
def calculate_vfd(req: VFDRequest):
    try:
        return compute_vfd(req)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/demo")
def get_demo():
    return DEMO_PRESET
