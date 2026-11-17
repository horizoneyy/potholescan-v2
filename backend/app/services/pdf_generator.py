import io
from datetime import datetime
from typing import List, Dict, Any
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm

def generate_reports_pdf(
    reports: List[Dict[str, Any]],
    from_date: str,
    to_date: str,
    status_filter: str = "SEMUA"
) -> bytes:
    """
    Menghasilkan dokumen PDF rekapitulasi resmi dinas PUPR (FR-16 & US-03).
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        "KopTitle",
        parent=styles["Heading1"],
        fontSize=13,
        leading=16,
        alignment=1, # Center
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#0f172a")
    )
    subtitle_style = ParagraphStyle(
        "KopSub",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        alignment=1,
        fontName="Helvetica",
        textColor=colors.HexColor("#475569")
    )
    section_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontSize=11,
        leading=14,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=6
    )
    cell_style = ParagraphStyle(
        "CellText",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
        fontName="Helvetica"
    )
    cell_bold = ParagraphStyle(
        "CellBold",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
        fontName="Helvetica-Bold"
    )

    story = []

    # 1. KOP RESMI DINAS
    story.append(Paragraph("PEMERINTAH DAERAH PROVINSI DAERAH KHUSUS JAKARTA", title_style))
    story.append(Paragraph("DINAS PEKERJAAN UMUM DAN PENATAAN RUANG (PUPR)", title_style))
    story.append(Paragraph("BIDANG BINA MARGA & PEMELIHARAAN INFRASTRUKTUR JALAN", subtitle_style))
    story.append(Paragraph("Sistem Manajemen Spasial PotholeScan · Berkas Rekapitulasi Resmi", subtitle_style))
    story.append(Spacer(1, 0.3 * cm))

    # Garis Pembatas Kop
    divider = Table([[""]], colWidths=[18 * cm], rowHeights=[2])
    divider.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -1), 1.5, colors.HexColor("#0f172a")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(divider)
    story.append(Spacer(1, 0.4 * cm))

    # 2. Metadata Periode & Parameter Laporan
    now_str = datetime.now().strftime("%d %B %Y %H:%M WIB")
    meta_data = [
        [
            Paragraph("<b>Nomor Dokumen:</b> PS-REKAP/" + datetime.now().strftime("%Y%m%d/%H%M"), cell_style),
            Paragraph(f"<b>Tanggal Cetak:</b> {now_str}", cell_style)
        ],
        [
            Paragraph(f"<b>Rentang Tanggal:</b> {from_date} s.d. {to_date}", cell_style),
            Paragraph(f"<b>Filter Status:</b> {status_filter}", cell_style)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[9 * cm, 9 * cm])
    meta_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 0.4 * cm))

    # 3. Ringkasan Statistik
    total_laporan = len(reports)
    total_berat = sum(1 for r in reports if r.get("max_severity") == "BERAT")
    total_sedang = sum(1 for r in reports if r.get("max_severity") == "SEDANG")
    total_ringan = sum(1 for r in reports if r.get("max_severity") == "RINGAN")
    total_selesai = sum(1 for r in reports if r.get("status") == "SELESAI")

    story.append(Paragraph("I. RINGKASAN DATA KERUSAKAN JALAN", section_style))
    stat_data = [
        [
            Paragraph("Total Laporan Terdata", cell_bold),
            Paragraph("Kategori Berat", cell_bold),
            Paragraph("Kategori Sedang", cell_bold),
            Paragraph("Kategori Ringan", cell_bold),
            Paragraph("Tuntas Ditangani (Selesai)", cell_bold),
        ],
        [
            Paragraph(str(total_laporan), cell_bold),
            Paragraph(str(total_berat), cell_style),
            Paragraph(str(total_sedang), cell_style),
            Paragraph(str(total_ringan), cell_style),
            Paragraph(str(total_selesai), cell_bold),
        ]
    ]
    stat_table = Table(stat_data, colWidths=[3.6 * cm] * 5)
    stat_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(stat_table)
    story.append(Spacer(1, 0.5 * cm))

    # 4. Tabel Rincian Titik Kerusakan
    story.append(Paragraph("II. RINCIAN DAFTAR LAPORAN KERUSAKAN JALAN", section_style))
    table_headers = [
        Paragraph("ID", cell_bold),
        Paragraph("Tanggal Masuk", cell_bold),
        Paragraph("Koordinat (Lat, Lon)", cell_bold),
        Paragraph("Keparahan", cell_bold),
        Paragraph("Keyakinan AI", cell_bold),
        Paragraph("Status Penanganan", cell_bold)
    ]
    detail_data = [table_headers]

    for r in reports[:150]:  # Batas wajar halaman rekap
        dt_str = str(r.get("created_at", ""))[:10]
        lat = round(float(r.get("latitude", 0)), 5)
        lon = round(float(r.get("longitude", 0)), 5)
        sev = str(r.get("max_severity", ""))
        conf = f"{int(float(r.get('max_confidence', 0)) * 100)}%"
        st = str(r.get("status", ""))

        detail_data.append([
            Paragraph(f"#{r.get('id', '')}", cell_style),
            Paragraph(dt_str, cell_style),
            Paragraph(f"{lat}, {lon}", cell_style),
            Paragraph(sev, cell_bold),
            Paragraph(conf, cell_style),
            Paragraph(st, cell_style)
        ])

    detail_table = Table(
        detail_data,
        colWidths=[1.8 * cm, 2.7 * cm, 4.5 * cm, 2.5 * cm, 2.5 * cm, 4.0 * cm]
    )
    detail_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))
    story.append(detail_table)
    story.append(Spacer(1, 0.8 * cm))

    # 5. Lembar Pengesahan / Tanda Tangan
    sign_data = [
        [
            Paragraph("", cell_style),
            Paragraph("Jakarta, " + datetime.now().strftime("%d %B %Y") + "<br/>Kepala Seksi Pemeliharaan Jalan & Jembatan<br/><br/><br/><br/><b>Ir. Hendra Kusuma, M.T.</b><br/>NIP. 19780512 200312 1 002", cell_style)
        ]
    ]
    sign_table = Table(sign_data, colWidths=[10 * cm, 8 * cm])
    sign_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "CENTER"),
    ]))
    story.append(sign_table)

    # Build PDF
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
