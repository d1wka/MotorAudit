from fastapi import APIRouter, HTTPException
from app.db.seed import get_all_motors, get_motor_by_id

router = APIRouter(prefix="/motors", tags=["motors"])


@router.get("")
def list_motors():
    return get_all_motors()


@router.get("/{motor_id}")
def get_motor(motor_id: str):
    m = get_motor_by_id(motor_id)
    if m is None:
        raise HTTPException(status_code=404, detail=f"Motor '{motor_id}' not found")
    return m
