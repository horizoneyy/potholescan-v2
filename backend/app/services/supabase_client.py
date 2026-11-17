import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from backend.app.core.config import settings

class SupabaseService:
    _instance: Optional["SupabaseService"] = None

    def __init__(self):
        self.client = None
        self._init_client()

    @classmethod
    def get_instance(cls) -> "SupabaseService":
        if cls._instance is None:
            cls._instance = SupabaseService()
        return cls._instance

    def _init_client(self):
        if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
            try:
                from supabase import create_client, Client
                self.client: Client = create_client(
                    settings.SUPABASE_URL,
                    settings.SUPABASE_SERVICE_ROLE_KEY
                )
                print("[+] Berhasil terhubung ke Supabase Cloud API.")
            except Exception as e:
                print(f"[ERR] Gagal menginisialisasi klien Supabase: {e}")
                self.client = None
        else:
            print("[!] SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diisi di berkas .env")
            self.client = None

    def is_configured(self) -> bool:
        return self.client is not None

    def upload_image(self, image_bytes: bytes, folder: str = "original", extension: str = "jpg") -> str:
        """
        Mengunggah berkas foto ke Supabase Storage (bucket: potholescan-media).
        Path: potholescan-media/{folder}/YYYY/MM/UUID.jpg
        """
        now = datetime.now(timezone.utc)
        file_id = str(uuid.uuid4())
        storage_path = f"{folder}/{now.year}/{now.strftime('%m')}/{file_id}.{extension}"

        if self.client:
            try:
                bucket = self.client.storage.from_(settings.SUPABASE_STORAGE_BUCKET)
                bucket.upload(
                    path=storage_path,
                    file=image_bytes,
                    file_options={"content-type": f"image/{extension}", "upsert": "true"}
                )
                public_url = bucket.get_public_url(storage_path)
                return public_url
            except Exception as e:
                print(f"[ERR] Gagal upload foto ke Supabase Storage: {e}")
                raise e
        else:
            # Fallback mock URL jika belum terkoneksi
            return f"https://mock-storage.supabase.co/{settings.SUPABASE_STORAGE_BUCKET}/{storage_path}"

    def create_report(
        self,
        image_url: str,
        annotated_image_url: str,
        latitude: float,
        longitude: float,
        location_source: str,
        max_severity: str,
        max_confidence: float,
        status: str,
        model_version: str,
        detections: List[Dict[str, Any]]
    ) -> int:
        """
        Menyimpan laporan baru ke tabel `reports` dan tabel `detections`.
        """
        if not self.client:
            return 99999  # Mock ID

        # 1. Simpan baris ke tabel reports
        report_data = {
            "image_url": image_url,
            "annotated_image_url": annotated_image_url,
            "latitude": latitude,
            "longitude": longitude,
            "location_source": location_source,
            "max_severity": max_severity,
            "max_confidence": max_confidence,
            "status": status,
            "is_hidden": False,
            "model_version": model_version,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        res = self.client.table("reports").insert(report_data).execute()
        if not res.data:
            raise RuntimeError("Gagal menambahkan rekaman ke tabel reports di Supabase.")
        
        report_id = res.data[0]["id"]

        # 2. Simpan rincian kotak ke tabel detections
        if detections:
            detection_rows = []
            for d in detections:
                bbox = d.get("bbox", [0, 0, 0, 0])
                detection_rows.append({
                    "report_id": report_id,
                    "class_name": d["class_name"],
                    "confidence": d["confidence"],
                    "bbox_x": bbox[0],
                    "bbox_y": bbox[1],
                    "bbox_w": bbox[2],
                    "bbox_h": bbox[3],
                    "area_ratio": d.get("area_ratio", 0.0),
                    "severity": d["severity"],
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
            self.client.table("detections").insert(detection_rows).execute()

        # 3. Rekam entri status history awal
        history_entry = {
            "report_id": report_id,
            "old_status": "NONE",
            "new_status": status,
            "changed_by": "SYSTEM_AI",
            "notes": f"Auto-classified based on confidence ({max_confidence})",
            "changed_at": datetime.now(timezone.utc).isoformat()
        }
        self.client.table("status_history").insert(history_entry).execute()

        return report_id

    def count_nearby_damages(self, lat: float, lon: float, radius_m: int = 500) -> Tuple[int, Optional[str]]:
        """
        Menghitung kerusakan aktif dalam radius 500 meter menggunakan PostGIS.
        """
        if not self.client:
            return 0, None

        try:
            # Query laporan aktif yang belum selesai dan tidak disembunyikan
            # Menggunakan RPC fungsi PostGIS jika ada atau kueri jarak
            res = self.client.table("reports") \
                .select("id, max_severity, latitude, longitude") \
                .eq("is_hidden", False) \
                .neq("status", "SELESAI") \
                .neq("status", "PENDING_REVIEW") \
                .execute()

            from backend.app.services.geo import haversine_distance_meters
            nearby_items = []
            highest_sev = None

            for r in res.data:
                dist = haversine_distance_meters(lat, lon, r["latitude"], r["longitude"])
                if dist <= radius_m:
                    nearby_items.append(r)
                    sev = r["max_severity"]
                    if highest_sev is None:
                        highest_sev = sev
                    elif sev == "BERAT":
                        highest_sev = "BERAT"
                    elif sev == "SEDANG" and highest_sev != "BERAT":
                        highest_sev = "SEDANG"

            return len(nearby_items), highest_sev
        except Exception as e:
            print(f"[!] Error kalkulasi nearby: {e}")
            return 0, None

    def get_reports(
        self,
        status: Optional[str] = None,
        severity: Optional[str] = None,
        include_hidden: bool = False,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        if not self.client:
            return []

        q = self.client.table("reports").select("*, detections(*)")
        if not include_hidden:
            q = q.eq("is_hidden", False)
        if status:
            q = q.eq("status", status)
        if severity:
            q = q.eq("max_severity", severity)

        res = q.order("created_at", desc=True).limit(limit).execute()
        return res.data or []

    def get_report_by_id(self, report_id: int) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None
        res = self.client.table("reports").select("*, detections(*), status_history(*)").eq("id", report_id).execute()
        if res.data:
            return res.data[0]
        return None

    def update_report_status(
        self,
        report_id: int,
        new_status: str,
        changed_by: str,
        notes: Optional[str] = None,
        is_hidden: bool = False
    ) -> bool:
        if not self.client:
            return True

        # Ambil status saat ini
        curr = self.client.table("reports").select("status").eq("id", report_id).execute()
        old_status = curr.data[0]["status"] if curr.data else "UNKNOWN"

        patch = {
            "status": new_status,
            "is_hidden": is_hidden,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        self.client.table("reports").update(patch).eq("id", report_id).execute()

        # Rekam ke status_history
        self.client.table("status_history").insert({
            "report_id": report_id,
            "old_status": old_status,
            "new_status": new_status,
            "changed_by": changed_by,
            "notes": notes or "",
            "changed_at": datetime.now(timezone.utc).isoformat()
        }).execute()

        # Rekam ke audit_logs
        self.log_audit(
            actor=changed_by,
            action="UPDATE_STATUS",
            target_entity="reports",
            target_id=report_id,
            details=f"Status diubah dari {old_status} ke {new_status}. is_hidden={is_hidden}. Catatan: {notes}"
        )
        return True

    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None
        res = self.client.table("users").select("*").eq("username", username).eq("is_active", True).execute()
        if res.data:
            return res.data[0]
        return None

    def log_audit(self, actor: str, action: str, target_entity: str, target_id: Optional[int], details: str):
        if not self.client:
            return
        try:
            self.client.table("audit_logs").insert({
                "actor_username": actor,
                "action": action,
                "target_entity": target_entity,
                "target_id": target_id,
                "details": details,
                "created_at": datetime.now(timezone.utc).isoformat()
            }).execute()
        except Exception as e:
            print(f"[!] Gagal menulis audit log: {e}")
