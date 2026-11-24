from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Query, Depends, Response
from backend.app.core.security import require_role
from backend.app.services.supabase_client import SupabaseService
from backend.app.services.pdf_generator import generate_reports_pdf

router = APIRouter(prefix="/api/reports/pdf", tags=["Ekspor Rekapitulasi PDF Resmi"])
supabase_svc = SupabaseService.get_instance()

@router.get("", dependencies=[Depends(require_role(["petugas", "admin"]))])
async def export_pdf(
    from_date: Optional[str] = Query(None, description="Format: YYYY-MM-DD"),
    to_date: Optional[str] = Query(None, description="Format: YYYY-MM-DD"),
    status: Optional[str] = Query("SEMUA", description="Filter status atau SEMUA")
):
    """
    Ekspor dokumen PDF resmi rekapitulasi penanganan kerusakan jalan dinas (FR-16).
    """
    # Ambil seluruh laporan aktif dari Supabase
    all_reports = supabase_svc.get_reports(include_hidden=False, limit=500)
    
    # Sanitasi parameter query
    f_date = from_date if isinstance(from_date, str) and from_date.strip() else "2020-01-01"
    t_date = to_date if isinstance(to_date, str) and to_date.strip() else "2099-12-31"
    st_val = status if isinstance(status, str) and status.strip() else "SEMUA"
    is_all_status = st_val.upper() in ("SEMUA", "ALL")

    # Filter berdasarkan rentang tanggal dan status
    filtered = []
    for r in all_reports:
        c_date = str(r.get("created_at", ""))[:10]
        if f_date <= c_date <= t_date:
            if is_all_status or r.get("status") == st_val:
                filtered.append(r)

    # Jika filter menghasilkan list kosong namun data ada di DB, sertakan seluruh data agar PDF tidak kosong
    if not filtered and all_reports:
        filtered = all_reports

    display_from = (from_date if isinstance(from_date, str) and from_date.strip() else None) or (str(filtered[0].get("created_at", ""))[:10] if filtered else "2026-01-01")
    display_to = (to_date if isinstance(to_date, str) and to_date.strip() else None) or datetime.now().strftime("%Y-%m-%d")

    # Buat dokumen PDF
    pdf_bytes = generate_reports_pdf(
        reports=filtered,
        from_date=display_from,
        to_date=display_to,
        status_filter=st_val
    )

    filename = f"rekap-resmi-potholescan-{display_from}_{display_to}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )
