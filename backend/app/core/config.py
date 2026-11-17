import os
from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("backend/.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    APP_ENV: str = "development"
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    CORS_ORIGINS: Union[str, List[str]] = [
        "http://localhost:5173",
        "http://localhost:8443",
        "http://127.0.0.1:5173",
        "http://localhost:3000"
    ]

    # Supabase Configuration
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_STORAGE_BUCKET: str = "potholescan-media"

    # AI Model & Thresholds
    MODEL_WEIGHTS_PATH: str = "backend/weights/best.pt"
    FALLBACK_MODEL_NAME: str = "yolov8s.pt"
    CONFIDENCE_THRESHOLD_MIN: float = 0.25
    CONFIDENCE_THRESHOLD_PUBLISH: float = 0.65
    PROXIMITY_RADIUS_METERS: int = 500

    # Security
    JWT_SECRET_KEY: str = "potholescan-secret-super-key-2026-very-secure"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Rate Limiting
    RATE_LIMIT_PUBLIC: str = "5/minute"

    @field_validator("SUPABASE_URL", mode="before")
    @classmethod
    def clean_supabase_url(cls, v: str) -> str:
        if isinstance(v, str):
            clean = v.strip().rstrip("/")
            for suffix in ["/rest/v1", "/rest"]:
                if clean.endswith(suffix):
                    clean = clean[:-len(suffix)]
            return clean.rstrip("/")
        return v

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return ["*"]

settings = Settings()
