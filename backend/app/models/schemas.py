from datetime import datetime
from typing import List, Optional, Tuple, Any
from enum import Enum
from pydantic import BaseModel, Field, model_validator

class SeverityEnum(str, Enum):
    RINGAN = "RINGAN"
    SEDANG = "SEDANG"
    BERAT = "BERAT"

class StatusEnum(str, Enum):
    PENDING_REVIEW = "PENDING_REVIEW"
    BARU = "BARU"
    DIVERIFIKASI = "DIVERIFIKASI"
    DALAM_PENANGANAN = "DALAM_PENANGANAN"
    SELESAI = "SELESAI"

class LocationSourceEnum(str, Enum):
    EXIF = "exif"
    BROWSER = "browser"
    MANUAL = "manual"

class RoleEnum(str, Enum):
    PETUGAS = "petugas"
    ADMIN = "admin"

class DetectionItem(BaseModel):
    class_name: str
    confidence: float
    bbox: Optional[List[float]] = Field(default_factory=list, description="[x_c, y_c, w, h] normalized")
    bbox_x: Optional[float] = None
    bbox_y: Optional[float] = None
    bbox_w: Optional[float] = None
    bbox_h: Optional[float] = None
    area_ratio: float
    severity: SeverityEnum

    @model_validator(mode="before")
    @classmethod
    def populate_bbox(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("bbox"):
                data["bbox"] = [
                    data.get("bbox_x", 0.0) or 0.0,
                    data.get("bbox_y", 0.0) or 0.0,
                    data.get("bbox_w", 0.0) or 0.0,
                    data.get("bbox_h", 0.0) or 0.0,
                ]
        return data

class ReportCreateResponse(BaseModel):
    success: bool
    status: str
    report_id: Optional[int] = None
    is_published_immediately: bool = False
    location: Optional[dict] = None
    severity: Optional[SeverityEnum] = None
    max_confidence: Optional[float] = None
    image_url: Optional[str] = None
    annotated_image_url: Optional[str] = None
    detections: List[DetectionItem] = []
    nearby_unresolved_count: int = 0
    message: Optional[str] = None

class ReportListItem(BaseModel):
    id: int
    image_url: Optional[str] = ""
    annotated_image_url: Optional[str] = ""
    latitude: float
    longitude: float
    location_source: str
    max_severity: SeverityEnum
    max_confidence: float
    status: StatusEnum
    is_hidden: bool
    model_version: str
    created_at: datetime
    updated_at: datetime
    detections: Optional[List[DetectionItem]] = []

class ReportListResponse(BaseModel):
    total: int
    items: List[ReportListItem]

class NearbyCenter(BaseModel):
    lat: float
    lon: float

class NearbyResponse(BaseModel):
    center: NearbyCenter
    radius_meters: int
    unresolved_damages_count: int
    highest_severity: Optional[SeverityEnum] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    success: bool
    username: str
    full_name: str
    role: RoleEnum
    access_token: str
    token_type: str = "bearer"

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: RoleEnum

class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    role: RoleEnum
    is_active: bool
    created_at: datetime

class StatusUpdatePayload(BaseModel):
    new_status: StatusEnum
    notes: Optional[str] = None
    hide_false_positive: bool = False

class SystemSettingsUpdate(BaseModel):
    confidence_threshold_min: Optional[float] = Field(None, ge=0.0, le=1.0)
    confidence_threshold_publish: Optional[float] = Field(None, ge=0.0, le=1.0)
    proximity_radius_meters: Optional[int] = Field(None, ge=50, le=5000)
