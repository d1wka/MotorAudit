from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api import motors, replacement, vfd, power_quality, report, ai

app = FastAPI(
    title="MotorAudit API",
    version="1.0.0",
    description=(
        "Energy audit platform for industrial electric motors. "
        "Provides three engineering modules: motor replacement payback analysis, "
        "VFD sizing and savings, and power quality analysis."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(motors.router,        prefix="/api")
app.include_router(replacement.router,   prefix="/api")
app.include_router(vfd.router,           prefix="/api")
app.include_router(power_quality.router, prefix="/api")
app.include_router(report.router,        prefix="/api")
app.include_router(ai.router,            prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
