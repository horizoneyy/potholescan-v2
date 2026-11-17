from fastapi import APIRouter, Depends
from backend.app.models.schemas import SystemSettingsUpdate
from backend.app.core.security import require_role, get_current_user_from_cookie
from backend.app.core.config import settings
from backend.app.services.supabase_client import SupabaseService

router = APIRouter(prefix="/api/settings", tags=["Pengaturan Sistem Dinamis"])
supabase_svc = SupabaseService.get_instance()

@router.get("")
async def get_settings():
    return {
        "confidence_threshold_min": settings.CONFIDENCE_THRESHOLD_MIN,
        "confidence_threshold_publish": settings.CONFIDENCE_THRESHOLD_PUBLISH,
        "proximity_radius_meters": settings.PROXIMITY_RADIUS_METERS
    }

@router.patch("", dependencies=[Depends(require_role(["admin"]))])
async def update_settings(
    payload: SystemSettingsUpdate,
    current_user: dict = Depends(get_current_user_from_cookie)
):
    actor = current_user.get("sub", "admin")
    if payload.confidence_threshold_min is not None:
        settings.CONFIDENCE_THRESHOLD_MIN = payload.confidence_threshold_min
    if payload.confidence_threshold_publish is not None:
        settings.CONFIDENCE_THRESHOLD_PUBLISH = payload.confidence_threshold_publish
    if payload.proximity_radius_meters is not None:
        settings.PROXIMITY_RADIUS_METERS = payload.proximity_radius_meters

    supabase_svc.log_audit(
        actor=actor,
        action="UPDATE_SETTING",
        target_entity="system_settings",
        target_id=None,
        details=f"Ambang batas diperbarui: min={settings.CONFIDENCE_THRESHOLD_MIN}, publish={settings.CONFIDENCE_THRESHOLD_PUBLISH}, radius={settings.PROXIMITY_RADIUS_METERS}m"
    )

    return {
        "success": True,
        "confidence_threshold_min": settings.CONFIDENCE_THRESHOLD_MIN,
        "confidence_threshold_publish": settings.CONFIDENCE_THRESHOLD_PUBLISH,
        "proximity_radius_meters": settings.PROXIMITY_RADIUS_METERS
    }
