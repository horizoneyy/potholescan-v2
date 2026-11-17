from typing import Optional
from datetime import datetime, timezone
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
    Ekspor dokumen PDF resmi rekapitulasi penanganan kerusakan jalan dinas PUPR (FR-16).
    """
    # Ambil seluruh laporan aktif dari Supabase
    all_reports = supabase_svc.get_reports(include_hidden=False, limit=500)

    # 1. Normalisasi status filter (mengakomodasi SEMUA, ALL, dan lowercase)
    norm_status = None
    if status and status.strip().upper() not in ("SEMUA", "ALL", ""):
        norm_status = status.strip().upper()

    # 2. Penentuan batas tanggal default dinamis jika parameter tanggal tidak dikirimkan
    valid_dates = [
        str(r.get("created_at", ""))[:10]
        for r in all_reports
        if r.get("created_at")
    ]
    min_date = min(valid_dates) if valid_dates else "2020-01-01"
    max_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if valid_dates and max(valid_dates) > max_date:
        max_date = max(valid_dates)

    f_date = from_date.strip() if from_date and from_date.strip() else min_date
    t_date = to_date.strip() if to_date and to_date.strip() else max_date

    # 3. Filter berdasarkan rentang tanggal dan status
    filtered = []
    for r in all_reports:
        c_date = str(r.get("created_at", ""))[:10]
        if f_date <= c_date <= t_date:
            if not norm_status or r.get("status") == norm_status:
                filtered.append(r)

    # 4. Fallback pengaman: jika parameter tanggal tidak dikirimkan dan filtered kosong padahal data ada di database
    if not filtered and not from_date and not to_date and all_reports:
        if norm_status:
            filtered = [r for r in all_reports if r.get("status") == norm_status]
        else:
            filtered = all_reports

    display_from = from_date.strip() if from_date and from_date.strip() else min_date
    display_to = to_date.strip() if to_date and to_date.strip() else max_date
    status_label = norm_status or "SEMUA"

    # Buat dokumen PDF
    pdf_bytes = generate_reports_pdf(
        reports=filtered,
        from_date=display_from,
        to_date=display_to,
        status_filter=status_label
    )

    filename = f"rekap-resmi-potholescan-{display_from}_{display_to}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )
