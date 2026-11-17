import pytest
from backend.app.services.geo import haversine_distance_meters, resolve_location

def test_haversine_distance():
    # Bundaran HI (-6.1950, 106.8230) ke Monas (-6.1754, 106.8272) sekitar ~2.2 km
    dist = haversine_distance_meters(-6.1950, 106.8230, -6.1754, 106.8272)
    assert 2100 <= dist <= 2300

def test_resolve_location_browser_fallback():
    dummy_bytes = b"not_an_exif_image"
    lat, lon, src = resolve_location(dummy_bytes, browser_lat=-6.2100, browser_lon=106.8400)
    assert lat == -6.2100
    assert lon == 106.8400
    assert src == "browser"

def test_resolve_location_manual_fallback():
    dummy_bytes = b"not_an_exif_image"
    lat, lon, src = resolve_location(dummy_bytes, browser_lat=None, browser_lon=None)
    assert lat == -6.208763
    assert lon == 106.845599
    assert src == "manual"
