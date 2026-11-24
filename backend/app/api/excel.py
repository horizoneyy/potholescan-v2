import io
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Query, Depends, Response
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

from backend.app.core.security import require_role
from backend.app.services.supabase_client import SupabaseService

router = APIRouter(prefix="/api/reports/export", tags=["Ekspor Data Resmi"])
supabase_svc = SupabaseService.get_instance()

@router.get("/excel", dependencies=[Depends(require_role(["petugas", "admin"]))])
async def export_excel(
    from_date: Optional[str] = Query(None, description="Format: YYYY-MM-DD"),
    to_date: Optional[str] = Query(None, description="Format: YYYY-MM-DD"),
    status: Optional[str] = Query("SEMUA", description="Filter status atau SEMUA")
):
    """
    Ekspor dokumen resmi Excel (.xlsx) rekapitulasi penanganan kerusakan jalan dinas.
    """
    all_reports = supabase_svc.get_reports(include_hidden=False, limit=1000)

    # Sanitasi parameter query
    f_date = from_date if isinstance(from_date, str) and from_date.strip() else None
    t_date = to_date if isinstance(to_date, str) and to_date.strip() else None
    st_val = status if isinstance(status, str) and status.strip() else "SEMUA"
    is_all_status = st_val.upper() in ("SEMUA", "ALL")

    # Filter data jika parameter tanggal disertakan
    filtered = []
    for r in all_reports:
        c_date = str(r.get("created_at", ""))[:10]
        if f_date and c_date < f_date:
            continue
        if t_date and c_date > t_date:
            continue
        if not is_all_status and r.get("status") != st_val:
            continue
        filtered.append(r)

    # Jika filter tidak menyaring apa-apa, gunakan seluruh laporan aktif agar tidak kosong
    if not filtered and not f_date and not t_date:
        filtered = all_reports

    # Buat Workbook Excel
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Rekapitulasi Kerusakan"

    # Styling
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid") # Dark slate
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    data_font = Font(name="Calibri", size=10)
    center_align = Alignment(horizontal="center", vertical="center")
    left_align = Alignment(horizontal="left", vertical="center")
    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1")
    )

    # Judul Dokumen
    ws.merge_cells("A1:I1")
    ws["A1"] = "DINAS PEKERJAAN UMUM DAN PENATAAN RUANG (PUPR)"
    ws["A1"].font = Font(name="Calibri", size=14, bold=True, color="0F172A")
    ws["A1"].alignment = center_align

    ws.merge_cells("A2:I2")
    ws["A2"] = "REKAPITULASI RESMI TATA KELOLA PENANGANAN KERUSAKAN JALAN (POTHOLESCAN)"
    ws["A2"].font = Font(name="Calibri", size=11, bold=True, color="334155")
    ws["A2"].alignment = center_align

    ws.merge_cells("A3:I3")
    ws["A3"] = f"Dicetak pada: {datetime.now(timezone.utc).strftime('%d %B %Y, %H:%M UTC')} | Total Data: {len(filtered)}"
    ws["A3"].font = Font(name="Calibri", size=9, italic=True, color="64748B")
    ws["A3"].alignment = center_align

    headers = [
        "No", "ID Laporan", "Tanggal Lapor", "Koordinat GPS", 
        "Sumber Lokasi", "Tingkat Keparahan", "Keyakinan AI", "Status Penanganan", "Tautan Foto Anotasi"
    ]

    row_idx = 5
    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=row_idx, column=col_idx, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = center_align
        cell.border = thin_border

    # Isi Data
    for i, r in enumerate(filtered, 1):
        row_idx += 1
        lat = r.get("latitude", 0.0)
        lon = r.get("longitude", 0.0)
        gps_str = f"{lat:.6f}, {lon:.6f}"
        c_date = str(r.get("created_at", ""))[:19].replace("T", " ")
        conf = f"{int(r.get('max_confidence', 0) * 100)}%"
        photo_url = r.get("annotated_image_url") or r.get("image_url") or "-"

        row_data = [
            i,
            f"#{r.get('id', i)}",
            c_date,
            gps_str,
            r.get("location_source", "GPS").upper(),
            r.get("max_severity", "SEDANG"),
            conf,
            r.get("status", "BARU").replace("_", " "),
            photo_url
        ]

        for col_idx, val in enumerate(row_data, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.font = data_font
            cell.border = thin_border
            if col_idx in [1, 2, 5, 6, 7, 8]:
                cell.alignment = center_align
            else:
                cell.alignment = left_align

    # Auto-fit column widths
    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"rekap-kerusakan-jalan-{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )
