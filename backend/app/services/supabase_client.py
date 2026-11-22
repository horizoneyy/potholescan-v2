import uuid
import time
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from backend.app.core.config import settings

class SupabaseService:
    _instance: Optional["SupabaseService"] = None

    def __init__(self):
        self.client = None
        # In-memory TTL Caches untuk mempercepat respons API
        self._reports_cache: Dict[str, List[Dict[str, Any]]] = {}
        self._reports_cache_time: Dict[str, float] = {}
        self._active_damages_cache: Optional[List[Dict[str, Any]]] = None
        self._active_damages_cache_time: float = 0.0
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

        # Invalidate in-memory caches agar data baru langsung tampil
        self._reports_cache.clear()
        self._active_damages_cache = None

        return report_id

    def count_nearby_damages(self, lat: float, lon: float, radius_m: int = 500) -> Tuple[int, Optional[str]]:
        """
        Menghitung kerusakan aktif dalam radius 500 meter menggunakan PostGIS.
        Menggunakan in-memory cache TTL 10 detik untuk menghindari blocking I/O berulang.
        """
        if not self.client:
            return 0, None

        now = time.time()
        active_reports = None
        if self._active_damages_cache is not None and (now - self._active_damages_cache_time) < 10.0:
            active_reports = self._active_damages_cache
        else:
            try:
                res = self.client.table("reports") \
                    .select("id, max_severity, latitude, longitude") \
                    .eq("is_hidden", False) \
                    .neq("status", "SELESAI") \
                    .neq("status", "PENDING_REVIEW") \
                    .execute()
                active_reports = res.data or []
                self._active_damages_cache = active_reports
                self._active_damages_cache_time = now
            except Exception as e:
                print(f"[!] Error kalkulasi nearby: {e}")
                return 0, None

        from backend.app.services.geo import haversine_distance_meters
        nearby_items = []
        highest_sev = None

        for r in active_reports:
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

    def get_reports(
        self,
        status: Optional[str] = None,
        severity: Optional[str] = None,
        include_hidden: bool = False,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        if not self.client:
            return []

        # Cek in-memory TTL cache (5 detik) untuk respons ultra-cepat
        cache_key = f"{status}_{severity}_{include_hidden}_{limit}"
        now = time.time()
        if cache_key in self._reports_cache and (now - self._reports_cache_time.get(cache_key, 0)) < 5.0:
            return self._reports_cache[cache_key]

        q = self.client.table("reports").select("*, detections(*)")
        if not include_hidden:
            q = q.eq("is_hidden", False)
        if status:
            q = q.eq("status", status)
        if severity:
            q = q.eq("max_severity", severity)

        res = q.order("created_at", desc=True).limit(limit).execute()
        data = res.data or []
        self._reports_cache[cache_key] = data
        self._reports_cache_time[cache_key] = now
        return data

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
        self._reports_cache.clear()
        self._active_damages_cache = None
        return True

    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None
        res = self.client.table("users").select("*").eq("username", username).eq("is_active", True).execute()
        if res.data:
            return res.data[0]
        return None

    def get_all_users(self) -> List[Dict[str, Any]]:
        if not self.client:
            return []
        res = self.client.table("users").select("id, username, full_name, role, is_active, created_at").order("id").execute()
        return res.data or []

    def create_user(self, username: str, password_hash: str, full_name: str, role: str) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None
        try:
            res = self.client.table("users").insert({
                "username": username,
                "password_hash": password_hash,
                "full_name": full_name,
                "role": role,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            print(f"[ERR] Gagal membuat user di Supabase: {e}")
            return None

    def update_user_status(self, user_id: int, is_active: bool) -> bool:
        if not self.client:
            return False
        try:
            res = self.client.table("users").update({"is_active": is_active}).eq("id", user_id).execute()
            return len(res.data) > 0 if res.data else True
        except Exception as e:
            print(f"[ERR] Gagal mengubah status user di Supabase: {e}")
            return False

    def delete_user(self, user_id: int) -> bool:
        if not self.client:
            return False
        res = self.client.table("users").delete().eq("id", user_id).execute()
        return len(res.data) > 0 if res.data else True

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

    def get_system_settings(self) -> Dict[str, Any]:
        """
        Mengambil konfigurasi sistem dinamis secara instan dari singleton memori (0ms I/O).
        """
        return {
            "confidence_threshold_min": settings.CONFIDENCE_THRESHOLD_MIN,
            "confidence_threshold_publish": settings.CONFIDENCE_THRESHOLD_PUBLISH,
            "proximity_radius_meters": settings.PROXIMITY_RADIUS_METERS
        }

    def update_system_settings(
        self,
        confidence_threshold_min: Optional[float] = None,
        confidence_threshold_publish: Optional[float] = None,
        proximity_radius_meters: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Memperbarui konfigurasi sistem dinamis ke tabel `system_settings` di Supabase
        dan memperbarui singleton konfigurasi runtime in-memory.
        """
        if confidence_threshold_min is not None:
            settings.CONFIDENCE_THRESHOLD_MIN = confidence_threshold_min
            if self.client:
                try:
                    self.client.table("system_settings").upsert({
                        "key": "confidence_threshold_min",
                        "value": str(confidence_threshold_min),
                        "description": "Ambang batas minimal agar deteksi diterima",
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }).execute()
                except Exception as e:
                    print(f"[ERR] Gagal upsert confidence_threshold_min ke Supabase: {e}")

        if confidence_threshold_publish is not None:
            settings.CONFIDENCE_THRESHOLD_PUBLISH = confidence_threshold_publish
            if self.client:
                try:
                    self.client.table("system_settings").upsert({
                        "key": "confidence_threshold_publish",
                        "value": str(confidence_threshold_publish),
                        "description": "Ambang batas keyakinan langsung tampil di peta publik",
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }).execute()
                except Exception as e:
                    print(f"[ERR] Gagal upsert confidence_threshold_publish ke Supabase: {e}")

        if proximity_radius_meters is not None:
            settings.PROXIMITY_RADIUS_METERS = proximity_radius_meters
            if self.client:
                try:
                    self.client.table("system_settings").upsert({
                        "key": "proximity_radius_meters",
                        "value": str(proximity_radius_meters),
                        "description": "Radius peringatan lubang aktif sekitar pengendara",
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }).execute()
                except Exception as e:
                    print(f"[ERR] Gagal upsert proximity_radius_meters ke Supabase: {e}")

        return {
            "confidence_threshold_min": settings.CONFIDENCE_THRESHOLD_MIN,
            "confidence_threshold_publish": settings.CONFIDENCE_THRESHOLD_PUBLISH,
            "proximity_radius_meters": settings.PROXIMITY_RADIUS_METERS
        }

    def sync_system_settings_to_config(self) -> None:
        """
        Sinkronisasi parameter ambang batas dari tabel `system_settings` ke memori config saat startup.
        """
        res = self.get_system_settings()
        print(f"[+] Konfigurasi ambang AI disinkronkan dari Supabase: min={res['confidence_threshold_min']}, publish={res['confidence_threshold_publish']}, radius={res['proximity_radius_meters']}m")
