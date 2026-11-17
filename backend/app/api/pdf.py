from typing import Optional
from fastapi import APIRouter, Query, Depends, Response
from backend.app.core.security import require_role
from backend.app.services.supabase_client import SupabaseService
from backend.app.services.pdf_generator import generate_reports_pdf

router = APIRouter(prefix="/api/reports/pdf", tags=["Ekspor Rekapitulasi PDF Resmi"])
supabase_svc = SupabaseService.get_instance()

@router.get("", dependencies=[Depends(require_role(["petugas", "admin"]))])
async def export_pdf(
    from_date: str = Query(..., description="Format: YYYY-MM-DD"),
    to_date: str = Query(..., description="Format: YYYY-MM-DD"),
    status: Optional[str] = Query("SEMUA", description="Filter status atau SEMUA")
):
    """
    Ekspor dokumen PDF resmi rekapitulasi penanganan kerusakan jalan dinas (FR-16).
    """
    # Ambil seluruh laporan dari Supabase
    all_reports = supabase_svc.get_reports(include_hidden=False, limit=500)
    
    # Filter berdasarkan rentang tanggal dan status
    filtered = []
    for r in all_reports:
        c_date = str(r.get("created_at", ""))[:10]
        if from_date <= c_date <= to_date:
            if status == "SEMUA" or r.get("status") == status:
                filtered.append(r)

    # Buat dokumen PDF
    pdf_bytes = generate_reports_pdf(
        reports=filtered,
        from_date=from_date,
        to_date=to_date,
        status_filter=status
    )

    filename = f"rekap-resmi-potholescan-{from_date}_{to_date}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )
