import os, sys
from pathlib import Path
_root = Path(__file__).resolve().parent.parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from datetime import datetime, timezone
from backend.app.core.config import settings
from backend.app.core.security import get_password_hash
from supabase import create_client

def seed_database():
    url = settings.SUPABASE_URL
    key = settings.SUPABASE_SERVICE_ROLE_KEY
    if not url or not key:
        print("[!] Supabase credentials not found in settings.")
        return

    client = create_client(url, key)
    print("[+] Connecting to Supabase...")

    # 1. Seed Users (Andi Daniel, Daniel, Niyel)
    users_to_seed = [
        {
            "username": "admin",
            "password_hash": get_password_hash("admin123"),
            "full_name": "Andi Daniel",
            "role": "admin",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "username": "daniel",
            "password_hash": get_password_hash("petugas123"),
            "full_name": "Daniel",
            "role": "petugas",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "username": "niyel",
            "password_hash": get_password_hash("petugas123"),
            "full_name": "Niyel",
            "role": "petugas",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]

    for u in users_to_seed:
        existing = client.table("users").select("id, username").eq("username", u["username"]).execute()
        if existing.data:
            client.table("users").update({
                "full_name": u["full_name"],
                "password_hash": u["password_hash"],
                "role": u["role"],
                "is_active": True
            }).eq("username", u["username"]).execute()
            print(f"[*] Updated user: {u['username']} ({u['full_name']})")
        else:
            client.table("users").insert(u).execute()
            print(f"[+] Inserted user: {u['username']} ({u['full_name']})")

    # 2. Seed System Settings (Standar Kalibrasi AI best.pt)
    settings_to_seed = [
        {
            "key": "confidence_threshold_min",
            "value": "0.25",
            "description": "Ambang batas minimal agar deteksi diterima (Kalibrasi F1-Score optimal best.pt)",
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "key": "confidence_threshold_publish",
            "value": "0.65",
            "description": "Ambang batas keyakinan langsung tampil di peta publik",
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "key": "proximity_radius_meters",
            "value": "500",
            "description": "Radius peringatan lubang aktif sekitar pengendara",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    ]

    for s in settings_to_seed:
        client.table("system_settings").upsert(s).execute()
        print(f"[+] Upserted setting: {s['key']} = {s['value']}")

    # 3. Check reports count in Supabase
    reps = client.table("reports").select("id").execute()
    print(f"[*] Current reports count in Supabase: {len(reps.data)}")

    # 4. Print all users in Supabase
    res = client.table("users").select("id, username, full_name, role, is_active").execute()
    print("[+] Users currently in Supabase:")
    for row in res.data:
        print(f"    - ID: {row['id']} | Username: {row['username']} | Name: {row['full_name']} | Role: {row['role']}")

    # 5. Klarifikasi Skema Basis Data Spasial
    print("\n" + "=" * 70)
    print("KLARIFIKASI SKEMA BASIS DATA SPASIAL SUPABASE POSTGRESQL + POSTGIS")
    print("=" * 70)
    print("A. 6 Tabel Operasional Aplikasi:")
    print("   1. public.users           : Akun admin & staf petugas lapangan (Argon2id)")
    print("   2. public.reports         : Entitas agregasi laporan jalan, koordinat GPS, status & keparahan")
    print("   3. public.detections      : Bounding box AI YOLOv8, area ratio, confidence, kelas kerusakan")
    print("   4. public.status_history  : Jejak audit siklus hidup perubahan status laporan")
    print("   5. public.system_settings : Ambang batas dinamis AI (min, publish, radius proksimitas)")
    print("   6. public.audit_logs      : Log kepatuhan aktivitas pengguna dan administrator")
    print("\nB. 1 Tabel Sistem PostGIS Internal:")
    print("   - public.spatial_ref_sys  : Tabel standar metadata proyeksi koordinat EPSG dari ekstensi")
    print("                               PostGIS (bukan tabel operasional aplikasi PotholeScan).")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    seed_database()
