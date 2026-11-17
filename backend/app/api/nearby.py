from fastapi import APIRouter, Query
from backend.app.models.schemas import NearbyResponse, NearbyCenter, SeverityEnum
from backend.app.services.supabase_client import SupabaseService
from backend.app.core.config import settings

router = APIRouter(prefix="/api/nearby", tags=["Geospasial & Peringatan Dini"])
supabase_svc = SupabaseService.get_instance()

@router.get("", response_model=NearbyResponse)
async def get_nearby_warnings(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Latitude pelapor"),
    lon: float = Query(..., ge=-180.0, le=180.0, description="Longitude pelapor"),
    radius_m: int = Query(500, ge=50, le=5000, description="Radius pencarian dalam meter")
):
    """
    Kueri radius proksimitas peringatan dini lubang aktif sekitar pengendara (FR-11).
    """
    count, highest_sev = supabase_svc.count_nearby_damages(lat=lat, lon=lon, radius_m=radius_m)
    
    return NearbyResponse(
        center=NearbyCenter(lat=lat, lon=lon),
        radius_meters=radius_m,
        unresolved_damages_count=count,
        highest_severity=SeverityEnum(highest_sev) if highest_sev else None
    )
