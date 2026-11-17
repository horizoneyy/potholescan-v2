from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, status, Response, Depends, Request
from backend.app.models.schemas import LoginRequest, LoginResponse, UserCreate, UserResponse, RoleEnum
from backend.app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user_from_cookie,
    require_role
)
from backend.app.services.supabase_client import SupabaseService
from backend.app.core.config import settings

router = APIRouter(prefix="/api/auth", tags=["Autentikasi Dinas"])
supabase_svc = SupabaseService.get_instance()

# Default in-memory / fallback users untuk testing sebelum Supabase disinkronkan
LOCAL_USERS = {
    "admin": {
        "id": 1,
        "username": "admin",
        "password_hash": get_password_hash("admin123"),
        "full_name": "Andi Daniel",
        "role": RoleEnum.ADMIN,
        "is_active": True
    },
    "daniel": {
        "id": 2,
        "username": "daniel",
        "password_hash": get_password_hash("petugas123"),
        "full_name": "Daniel",
        "role": RoleEnum.PETUGAS,
        "is_active": True
    },
    "niyel": {
        "id": 3,
        "username": "niyel",
        "password_hash": get_password_hash("petugas123"),
        "full_name": "Niyel",
        "role": RoleEnum.PETUGAS,
        "is_active": True
    }
}

@router.post("/login", response_model=LoginResponse)
async def login(credentials: LoginRequest, response: Response):
    user = None
    # 1. Coba cari di Supabase jika terkoneksi
    if supabase_svc.is_configured():
        user = supabase_svc.get_user_by_username(credentials.username)
    
    # 2. Fallback ke akun default jika belum ada di Supabase
    if not user and credentials.username in LOCAL_USERS:
        user = LOCAL_USERS[credentials.username]

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nama pengguna atau kata sandi salah."
        )

    # Verifikasi hash kata sandi (Argon2id)
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nama pengguna atau kata sandi salah."
        )

    # Terbitkan token JWT
    access_token = create_access_token(
        data={"sub": user["username"], "role": user["role"], "user_id": user["id"]}
    )

    # Simpan di HTTP-Only Cookie yang aman
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=False  # True saat produksi HTTPS
    )

    return LoginResponse(
        success=True,
        username=user["username"],
        full_name=user["full_name"],
        role=user["role"],
        access_token=access_token
    )

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    return {"success": True, "message": "Berhasil keluar (logout)."}

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user_from_cookie)):
    return {
        "username": current_user.get("sub"),
        "role": current_user.get("role"),
        "user_id": current_user.get("user_id")
    }

@router.get("/users", dependencies=[Depends(require_role(["admin"]))])
async def list_users():
    """Mendapatkan daftar seluruh user untuk dashboard admin"""
    if supabase_svc.is_configured():
        users = supabase_svc.get_all_users()
        if users:
            return users
    return [
        {
            "id": u["id"],
            "username": u["username"],
            "full_name": u["full_name"],
            "role": u["role"],
            "is_active": u["is_active"],
            "created_at": "2026-11-16T20:00:00Z"
        }
        for u in LOCAL_USERS.values()
    ]

@router.delete("/users/{user_id}", dependencies=[Depends(require_role(["admin"]))])
async def delete_user(user_id: int, current_user: dict = Depends(get_current_user_from_cookie)):
    """Menghapus akun staf oleh administrator"""
    deleted = False
    if supabase_svc.is_configured():
        deleted = supabase_svc.delete_user(user_id)
    
    # Juga hapus dari in-memory fallback
    to_delete = None
    for uname, u in LOCAL_USERS.items():
        if u["id"] == user_id:
            to_delete = uname
            break
    if to_delete:
        del LOCAL_USERS[to_delete]
        deleted = True

    supabase_svc.log_audit(
        actor=current_user.get("sub", "admin"),
        action="DELETE_USER",
        target_entity="users",
        target_id=user_id,
        details=f"Menghapus user ID #{user_id}"
    )
    return {"success": True, "message": f"User #{user_id} berhasil dihapus."}

@router.post("/users", response_model=UserResponse, dependencies=[Depends(require_role(["admin"]))])
async def create_user(payload: UserCreate, current_user: dict = Depends(get_current_user_from_cookie)):
    pwd_hash = get_password_hash(payload.password)
    role_val = payload.role.value if hasattr(payload.role, "value") else str(payload.role)

    user_id = len(LOCAL_USERS) + 1
    if supabase_svc.is_configured():
        existing = supabase_svc.get_user_by_username(payload.username)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Username '{payload.username}' sudah dipakai."
            )
        created = supabase_svc.create_user(
            username=payload.username,
            password_hash=pwd_hash,
            full_name=payload.full_name,
            role=role_val
        )
        if created:
            user_id = created["id"]

    new_user = {
        "id": user_id,
        "username": payload.username,
        "password_hash": pwd_hash,
        "full_name": payload.full_name,
        "role": payload.role,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    LOCAL_USERS[payload.username] = new_user
    supabase_svc.log_audit(
        actor=current_user.get("sub", "admin"),
        action="CREATE_USER",
        target_entity="users",
        target_id=new_user["id"],
        details=f"Membuat user baru: {payload.username} ({role_val})"
    )
    return new_user
