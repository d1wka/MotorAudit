from fastapi import APIRouter, HTTPException, Response
from app.schemas.report import ReportRequest, ReportSummary
from app.core.report_gen import build_summary, generate_pdf

router = APIRouter(prefix="/report", tags=["report"])


@router.post("/summary", response_model=ReportSummary)
def get_report_summary(req: ReportRequest):
    try:
        summary = build_summary(
            replacement_result=req.replacement_result,
            vfd_result=req.vfd_result,
            pq_result=req.pq_result,
            currency_symbol=req.currency_symbol,
        )
        return ReportSummary(**summary)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/pdf")
def get_report_pdf(req: ReportRequest):
    try:
        pdf_bytes = generate_pdf(
            site_name=req.site_name,
            analyst_name=req.analyst_name,
            currency_symbol=req.currency_symbol,
            replacement_result=req.replacement_result,
            vfd_result=req.vfd_result,
            pq_result=req.pq_result,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="motoraudit_report.pdf"'},
    )
