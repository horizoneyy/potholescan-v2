from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status, Depends, Request, Query
from backend.app.models.schemas import (
    ReportCreateResponse,
    ReportListResponse,
    ReportListItem,
    StatusUpdatePayload,
    SeverityEnum,
    StatusEnum,
    DetectionItem
)
from backend.app.services.geo import resolve_location
from backend.app.services.inference import InferenceEngine
from backend.app.services.supabase_client import SupabaseService
from backend.app.core.security import require_role, get_current_user_from_cookie
from backend.app.core.config import settings
from backend.app.core.limiter import limiter

router = APIRouter(prefix="/api/reports", tags=["Laporan Kerusakan Jalan"])

inference_engine = InferenceEngine.get_instance()
supabase_svc = SupabaseService.get_instance()

# Validasi Magic Bytes citra (JPEG / PNG)
def validate_image_magic_bytes(header: bytes) -> str:
    if header.startswith(b"\xff\xd8\xff"):
        return "jpg"
    elif header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        detail="Berkas bukan citra JPEG/PNG yang valid. Sistem menolak berkas rusak/format palsu."
    )

@router.post("", response_model=ReportCreateResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.RATE_LIMIT_PUBLIC)
async def submit_report(
    request: Request,
    file: UploadFile = File(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None)
):
    """
    Unggah foto jalan rusak dari pengendara/warga tanpa kewajiban login (FR-01, FR-02).
    Rate Limit: 5 request/menit per IP.
    """
    contents = await file.read()
    
    # 1. Validasi Ukuran Berkas (Maksimal 10 MB)
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Ukuran berkas melebihi batas maksimal 10 MB."
        )

    # 2. Validasi Magic Bytes
    ext = validate_image_magic_bytes(contents[:16])

    # 3. Penentuan Lokasi Bertingkat (EXIF GPS -> Browser GPS -> Pin Manual)
    lat, lon, loc_source = resolve_location(contents, latitude, longitude)

    # 4. Deteksi AI YOLOv8 & Formulasi Keparahan 2-Jalur
    detections, max_severity, max_conf, annotated_bytes = inference_engine.predict(
        image_bytes=contents,
        conf_min=settings.CONFIDENCE_THRESHOLD_MIN
    )

    # 5. Aturan Bisnis Penyimpanan Selektif (Section 12 PRD)
    if not detections or max_conf < settings.CONFIDENCE_THRESHOLD_MIN:
        return ReportCreateResponse(
            success=True,
            status="NORMAL",
            message="Jalan terpantau normal. Tidak ditemukan objek kerusakan lubang/retak yang signifikan.",
            is_published_immediately=False,
            detections=[]
        )

    # 6. Penyaringan Visibilitas Bertingkat (Tiered Confidence)
    if max_conf >= settings.CONFIDENCE_THRESHOLD_PUBLISH:
        report_status = StatusEnum.BARU
        is_published = True
    else:
        report_status = StatusEnum.PENDING_REVIEW
        is_published = False

    # 7. Unggah Berkas Foto Asli & Anotasi ke Supabase Storage
    original_url = supabase_svc.upload_image(contents, folder="original", extension=ext)
    annotated_url = supabase_svc.upload_image(annotated_bytes, folder="annotated", extension="jpg")

    # 8. Simpan Laporan ke Supabase PostgreSQL
    report_id = supabase_svc.create_report(
        image_url=original_url,
        annotated_image_url=annotated_url,
        latitude=lat,
        longitude=lon,
        location_source=loc_source,
        max_severity=max_severity.value,
        max_confidence=max_conf,
        status=report_status.value,
        model_version=inference_engine.model_version,
        detections=[d.model_dump() for d in detections]
    )

    # 9. Peringatan Proksimitas Radius 500 Meter
    nearby_count, _ = supabase_svc.count_nearby_damages(lat, lon, radius_m=settings.PROXIMITY_RADIUS_METERS)

    return ReportCreateResponse(
        success=True,
        status=report_status.value,
        report_id=report_id,
        is_published_immediately=is_published,
        location={"latitude": lat, "longitude": lon, "source": loc_source},
        severity=max_severity,
        max_confidence=max_conf,
        image_url=original_url,
        annotated_image_url=annotated_url,
        detections=detections,
        nearby_unresolved_count=nearby_count,
        message="Laporan berhasil dianalisis dengan AI."
    )

@router.get("", response_model=ReportListResponse)
async def list_reports(
    status_filter: Optional[StatusEnum] = Query(None, alias="status"),
    severity: Optional[SeverityEnum] = None,
    limit: int = 100
):
    """Mendapatkan daftar laporan publik yang aktif (FR-10)"""
    reports = supabase_svc.get_reports(
        status=status_filter.value if status_filter else None,
        severity=severity.value if severity else None,
        include_hidden=False,
        limit=limit
    )
    return ReportListResponse(total=len(reports), items=reports)

@router.get("/{id}")
async def get_report_detail(id: int):
    """Melihat detail lengkap satu laporan"""
    report = supabase_svc.get_report_by_id(id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Laporan #{id} tidak ditemukan."
        )
    return report

@router.patch("/{id}/status", dependencies=[Depends(require_role(["petugas", "admin"]))])
async def update_status(
    id: int,
    payload: StatusUpdatePayload,
    current_user: dict = Depends(get_current_user_from_cookie)
):
    """Pembaruan siklus status laporan dan moderasi sembunyikan false positive (FR-14, FR-15)"""
    actor = current_user.get("sub", "petugas")
    success = supabase_svc.update_report_status(
        report_id=id,
        new_status=payload.new_status.value,
        changed_by=actor,
        notes=payload.notes,
        is_hidden=payload.hide_false_positive
    )
    return {
        "success": success,
        "report_id": id,
        "new_status": payload.new_status,
        "is_hidden": payload.hide_false_positive,
        "changed_by": actor
    }
