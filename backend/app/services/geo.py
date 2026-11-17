import io
import math
from typing import Optional, Tuple
import exifread

def _convert_to_degrees(value) -> float:
    """Helper konversi koordinat EXIF rasio [deg, min, sec] ke decimal degrees"""
    d = float(value.values[0].num) / float(value.values[0].den)
    m = float(value.values[1].num) / float(value.values[1].den)
    s = float(value.values[2].num) / float(value.values[2].den)
    return d + (m / 60.0) + (s / 3600.0)

def extract_exif_gps(image_bytes: bytes) -> Optional[Tuple[float, float]]:
    """
    Mengekstrak latitude dan longitude dari tag EXIF GPS citra.
    Mengembalikan tuple (latitude, longitude) atau None jika tidak ditemukan.
    """
    try:
        tags = exifread.process_file(io.BytesIO(image_bytes), details=False)
        gps_latitude = tags.get("GPS GPSLatitude")
        gps_latitude_ref = tags.get("GPS GPSLatitudeRef")
        gps_longitude = tags.get("GPS GPSLongitude")
        gps_longitude_ref = tags.get("GPS GPSLongitudeRef")

        if not (gps_latitude and gps_latitude_ref and gps_longitude and gps_longitude_ref):
            return None

        lat = _convert_to_degrees(gps_latitude)
        if gps_latitude_ref.values[0] != "N":
            lat = -lat

        lon = _convert_to_degrees(gps_longitude)
        if gps_longitude_ref.values[0] != "E":
            lon = -lon

        # Validasi rentang koordinat bumi (NFR-05)
        if -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0:
            return round(lat, 6), round(lon, 6)
        return None
    except Exception:
        return None

def resolve_location(
    image_bytes: bytes,
    browser_lat: Optional[float] = None,
    browser_lon: Optional[float] = None
) -> Tuple[float, float, str]:
    """
    Penentuan lokasi bertingkat (FR-03):
    1. EXIF GPS dari foto
    2. Fallback ke GPS peramban
    3. Fallback ke Pin Manual / Default
    """
    exif_coords = extract_exif_gps(image_bytes)
    if exif_coords:
        return exif_coords[0], exif_coords[1], "exif"

    if browser_lat is not None and browser_lon is not None:
        if -90.0 <= browser_lat <= 90.0 and -180.0 <= browser_lon <= 180.0:
            return round(browser_lat, 6), round(browser_lon, 6), "browser"

    # Default fallback: Titik pusat kota Jakarta (-6.208763, 106.845599)
    return -6.208763, 106.845599, "manual"

def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Kalkulasi jarak Haversine (meter) antar dua titik koordinat sebagai fallback kalkulasi lokal"""
    R = 6371000.0  # Radius bumi dalam meter
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2) + math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c
