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
    Ekspor dokumen resmi Excel (.xlsx) rekapitulasi penanganan kerusakan jalan dinas PUPR (FR-16).
    """
    all_reports = supabase_svc.get_reports(include_hidden=False, limit=1000)

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

    # 3. Filter laporan berdasarkan tanggal dan status
    filtered = []
    for r in all_reports:
        c_date = str(r.get("created_at", ""))[:10]
        if f_date <= c_date <= t_date:
            if not norm_status or r.get("status") == norm_status:
                filtered.append(r)

    # 4. Fallback pengaman jika tanggal tidak dikirimkan dan filtered kosong padahal data ada di database
    if not filtered and not from_date and not to_date and all_reports:
        if norm_status:
            filtered = [r for r in all_reports if r.get("status") == norm_status]
        else:
            filtered = all_reports

    # Buat Workbook Excel
    wb = openpyxl.Workbook()
    wb.properties.title = "Rekapitulasi Kerusakan Jalan PotholeScan"
    wb.properties.subject = "Laporan Resmi Dinas PUPR"
    wb.properties.creator = "PotholeScan System"

    ws = wb.active
    ws.title = "Rekapitulasi Kerusakan"
    ws.views.sheetView[0].showGridLines = True

    # Styling Palet Resmi PUPR & Dark Slate
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")  # Dark Slate #1E293B
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

    # Palet Pewarnaan Tingkat Keparahan
    sev_styles = {
        "BERAT": {
            "fill": PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid"),
            "font": Font(name="Calibri", size=10, bold=True, color="991B1B"),
        },
        "SEDANG": {
            "fill": PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid"),
            "font": Font(name="Calibri", size=10, bold=True, color="92400E"),
        },
        "RINGAN": {
            "fill": PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid"),
            "font": Font(name="Calibri", size=10, bold=True, color="166534"),
        },
    }

    # 1. KOP RESMI DINAS PUPR
    ws.merge_cells("A1:I1")
    ws["A1"] = "DINAS PEKERJAAN UMUM DAN PENATAAN RUANG (PUPR)"
    ws["A1"].font = Font(name="Calibri", size=14, bold=True, color="0F172A")
    ws["A1"].alignment = center_align
    ws.row_dimensions[1].height = 28

    ws.merge_cells("A2:I2")
    ws["A2"] = "REKAPITULASI RESMI TATA KELOLA PENANGANAN KERUSAKAN JALAN (POTHOLESCAN)"
    ws["A2"].font = Font(name="Calibri", size=11, bold=True, color="334155")
    ws["A2"].alignment = center_align
    ws.row_dimensions[2].height = 20

    ws.merge_cells("A3:I3")
    print_time = datetime.now(timezone.utc).strftime("%d %B %Y, %H:%M UTC")
    filter_label = norm_status or "SEMUA"
    ws["A3"] = f"Dicetak pada: {print_time} | Rentang: {f_date} s.d. {t_date} | Filter Status: {filter_label} | Total: {len(filtered)} Laporan"
    ws["A3"].font = Font(name="Calibri", size=9, italic=True, color="64748B")
    ws["A3"].alignment = center_align
    ws.row_dimensions[3].height = 18

    ws.row_dimensions[4].height = 10  # Pemisah kosong

    # 2. Header Tabel
    headers = [
        "No", "ID Laporan", "Tanggal Lapor", "Koordinat GPS",
        "Sumber Lokasi", "Tingkat Keparahan", "Keyakinan AI", "Status Penanganan", "Tautan Foto Anotasi"
    ]

    row_idx = 5
    ws.row_dimensions[row_idx].height = 26
    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=row_idx, column=col_idx, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = center_align
        cell.border = thin_border

    # 3. Baris Data Laporan
    for i, r in enumerate(filtered, 1):
        row_idx += 1
        ws.row_dimensions[row_idx].height = 22

        lat = float(r.get("latitude", 0.0) or 0.0)
        lon = float(r.get("longitude", 0.0) or 0.0)
        gps_str = f"{lat:.6f}, {lon:.6f}"
        c_date = str(r.get("created_at", ""))[:19].replace("T", " ")
        conf = f"{int(float(r.get('max_confidence', 0) or 0) * 100)}%"
        photo_url = r.get("annotated_image_url") or r.get("image_url") or "-"
        sev_val = str(r.get("max_severity", "SEDANG")).upper()
        status_val = str(r.get("status", "BARU")).replace("_", " ").upper()

        row_data = [
            i,
            f"#{r.get('id', i)}",
            c_date,
            gps_str,
            str(r.get("location_source", "GPS")).upper(),
            sev_val,
            conf,
            status_val,
            photo_url
        ]

        for col_idx, val in enumerate(row_data, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.font = data_font
            cell.border = thin_border

            # Styling khusus per kolom
            if col_idx == 1:  # No
                cell.alignment = center_align
            elif col_idx == 2:  # ID Laporan
                cell.alignment = center_align
                cell.font = Font(name="Calibri", size=10, bold=True)
            elif col_idx in [3, 4, 5, 7]:  # Tanggal, Koordinat, Sumber, Keyakinan
                cell.alignment = center_align
            elif col_idx == 6:  # Tingkat Keparahan (dengan pewarnaan status)
                cell.alignment = center_align
                if sev_val in sev_styles:
                    cell.fill = sev_styles[sev_val]["fill"]
                    cell.font = sev_styles[sev_val]["font"]
            elif col_idx == 8:  # Status Penanganan
                cell.alignment = center_align
                if status_val == "SELESAI":
                    cell.font = Font(name="Calibri", size=10, bold=True, color="15803D")
                elif status_val == "DALAM PENANGANAN":
                    cell.font = Font(name="Calibri", size=10, bold=True, color="0369A1")
                elif status_val == "PENDING REVIEW":
                    cell.font = Font(name="Calibri", size=10, bold=True, color="B45309")
                else:
                    cell.font = Font(name="Calibri", size=10, color="0F172A")
            elif col_idx == 9:  # Tautan Foto Anotasi
                cell.alignment = left_align
                if str(val).startswith("http"):
                    cell.hyperlink = str(val)
                    cell.font = Font(name="Calibri", size=9, color="0284C7", underline="single")
                else:
                    cell.alignment = center_align

    # 4. Dimensi Lebar Kolom yang Rapi
    col_widths = {
        "A": 7,    # No
        "B": 14,   # ID Laporan
        "C": 22,   # Tanggal Lapor
        "D": 26,   # Koordinat GPS
        "E": 16,   # Sumber Lokasi
        "F": 20,   # Tingkat Keparahan
        "G": 16,   # Keyakinan AI
        "H": 22,   # Status Penanganan
        "I": 46,   # Tautan Foto Anotasi
    }
    for col_letter, width in col_widths.items():
        ws.column_dimensions[col_letter].width = width

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"rekap-kerusakan-jalan-{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
