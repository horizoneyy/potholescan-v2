import sys
from pathlib import Path

# Pastikan direktori root dan backend masuk ke sys.path agar impor 'backend.app...' selalu berhasil
_current_file = Path(__file__).resolve()
_backend_dir = _current_file.parent.parent
_root_dir = _backend_dir.parent
for _p in [str(_root_dir), str(_backend_dir)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from backend.app.core.config import settings
from backend.app.core.limiter import limiter
from backend.app.services.inference import InferenceEngine
from backend.app.services.supabase_client import SupabaseService

from backend.app.api.auth import router as auth_router
from backend.app.api.reports import router as reports_router
from backend.app.api.nearby import router as nearby_router
from backend.app.api.pdf import router as pdf_router
from backend.app.api.settings import router as settings_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inisialisasi Singleton Model AI & Klien Supabase saat startup
    print("=" * 60)
    print("Memulai Server PotholeScan API (FastAPI + YOLOv8 + Supabase)")
    print("=" * 60)
    inference_engine = InferenceEngine.get_instance()
    supabase_service = SupabaseService.get_instance()
    yield
    print("Mematikan Server PotholeScan API...")

app = FastAPI(
    title="PotholeScan API Platform",
    description="REST API Deteksi Kerusakan Jalan Berbasis YOLOv8 & Supabase Cloud GIS",
    version="1.0.0",
    lifespan=lifespan
)

# Integrasi Rate Limiter SlowAPI
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "error": "Rate limit exceeded",
            "message": "Terlalu banyak permintaan unggah. Batas kuota: 5 request per menit per IP."
        },
        headers={"Retry-After": "60"}
    )

# Middleware CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mendaftarkan Router API
app.include_router(auth_router)
app.include_router(pdf_router)
app.include_router(reports_router)
app.include_router(nearby_router)
app.include_router(settings_router)

@app.get("/", tags=["Root"])
async def root():
    return {
        "app": "PotholeScan API",
        "version": "1.0.0",
        "status": "online",
        "docs_url": "/docs"
    }

@app.get("/api/health", tags=["Health"])
async def health():
    return {
        "status": "healthy",
        "ai_engine": InferenceEngine.get_instance().model_version,
        "supabase_connected": SupabaseService.get_instance().is_configured()
    }
