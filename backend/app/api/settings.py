from fastapi import APIRouter, Depends
from backend.app.models.schemas import SystemSettingsUpdate
from backend.app.core.security import require_role, get_current_user_from_cookie
from backend.app.core.config import settings
from backend.app.services.supabase_client import SupabaseService

router = APIRouter(prefix="/api/settings", tags=["Pengaturan Sistem Dinamis"])
supabase_svc = SupabaseService.get_instance()

@router.get("")
async def get_settings():
    db_settings = supabase_svc.get_system_settings()
    return db_settings

@router.patch("", dependencies=[Depends(require_role(["admin"]))])
async def update_settings(
    payload: SystemSettingsUpdate,
    current_user: dict = Depends(get_current_user_from_cookie)
):
    actor = current_user.get("sub", "admin")
    updated = supabase_svc.update_system_settings(
        confidence_threshold_min=payload.confidence_threshold_min,
        confidence_threshold_publish=payload.confidence_threshold_publish,
        proximity_radius_meters=payload.proximity_radius_meters
    )

    supabase_svc.log_audit(
        actor=actor,
        action="UPDATE_SETTING",
        target_entity="system_settings",
        target_id=None,
        details=f"Ambang batas diperbarui: min={updated['confidence_threshold_min']}, publish={updated['confidence_threshold_publish']}, radius={updated['proximity_radius_meters']}m"
    )

    return {
        "success": True,
        **updated
    }
