from typing import Any, Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core import gemini

router = APIRouter(prefix="/ai", tags=["ai"])


class InsightsRequest(BaseModel):
    module: Literal["replacement", "vfd", "power_quality"]
    result: dict[str, Any]


class InsightsResponse(BaseModel):
    insights: str
    model: str


@router.post("/insights", response_model=InsightsResponse)
def get_insights(req: InsightsRequest):
    try:
        if req.module == "replacement":
            text = gemini.insights_replacement(req.result)
        elif req.module == "vfd":
            text = gemini.insights_vfd(req.result)
        else:
            text = gemini.insights_power_quality(req.result)
    except RuntimeError as exc:
        # API key not configured
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gemini API error: {exc}")

    return InsightsResponse(insights=text, model=gemini.MODEL)


@router.get("/status")
def ai_status():
    """Check whether Gemini is configured without making an API call."""
    from app.config import settings
    configured = bool(settings.gemini_api_key)
    return {"configured": configured, "model": gemini.MODEL if configured else None}
