import pytest
from backend.app.services.inference import InferenceEngine
from backend.app.models.schemas import SeverityEnum

def test_pothole_severity_ringan():
    engine = InferenceEngine.get_instance()
    # Citra 1000x1000, kotak 100x100 -> Area ratio = 0.01 (< 0.02) -> RINGAN
    sev, ratio = engine.calculate_severity("pothole", 100, 100, 1000, 1000)
    assert sev == SeverityEnum.RINGAN
    assert ratio == 0.01

def test_pothole_severity_sedang():
    engine = InferenceEngine.get_instance()
    # Citra 1000x1000, kotak 200x200 -> Area ratio = 0.04 (0.02 <= ratio < 0.08) -> SEDANG
    sev, ratio = engine.calculate_severity("pothole", 200, 200, 1000, 1000)
    assert sev == SeverityEnum.SEDANG
    assert ratio == 0.04

def test_pothole_severity_berat():
    engine = InferenceEngine.get_instance()
    # Citra 1000x1000, kotak 300x300 -> Area ratio = 0.09 (>= 0.08) -> BERAT
    sev, ratio = engine.calculate_severity("pothole", 300, 300, 1000, 1000)
    assert sev == SeverityEnum.BERAT
    assert ratio == 0.09

def test_crack_severity_ringan():
    engine = InferenceEngine.get_instance()
    # Citra 1000x1000, bentang max 40 -> r_span = 0.04 (< 0.05) -> RINGAN
    sev, ratio = engine.calculate_severity("crack", 40, 10, 1000, 1000)
    assert sev == SeverityEnum.RINGAN
    assert ratio == 0.04

def test_crack_severity_berat():
    engine = InferenceEngine.get_instance()
    # Citra 1000x1000, bentang max 150 -> r_span = 0.15 (>= 0.05) -> BERAT
    sev, ratio = engine.calculate_severity("crack", 150, 10, 1000, 1000)
    assert sev == SeverityEnum.BERAT
    assert ratio == 0.15
