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

    # 2. Check reports count in Supabase
    reps = client.table("reports").select("id").execute()
    print(f"[*] Current reports count in Supabase: {len(reps.data)}")

    # 3. Print all users in Supabase
    res = client.table("users").select("id, username, full_name, role, is_active").execute()
    print("[+] Users currently in Supabase:")
    for row in res.data:
        print(f"    - ID: {row['id']} | Username: {row['username']} | Name: {row['full_name']} | Role: {row['role']}")

if __name__ == "__main__":
    seed_database()
