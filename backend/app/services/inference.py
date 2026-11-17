import io
from pathlib import Path
from typing import List, Tuple, Optional
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from backend.app.core.config import settings
from backend.app.models.schemas import DetectionItem, SeverityEnum

# Hierarki keparahan untuk worst-case escalation
SEVERITY_ORDER = {
    SeverityEnum.RINGAN: 1,
    SeverityEnum.SEDANG: 2,
    SeverityEnum.BERAT: 3
}

SEVERITY_COLORS = {
    SeverityEnum.RINGAN: (48, 164, 108),   # Hijau
    SeverityEnum.SEDANG: (245, 165, 36),   # Oranye / Kuning
    SeverityEnum.BERAT: (229, 72, 77)      # Merah
}

class InferenceEngine:
    _instance: Optional["InferenceEngine"] = None

    def __init__(self):
        self.model = None
        self.model_version = "yolov8-init"
        self._load_model()

    @classmethod
    def get_instance(cls) -> "InferenceEngine":
        if cls._instance is None:
            cls._instance = InferenceEngine()
        return cls._instance

    def _load_model(self):
        """Memuat model YOLOv8 (Singleton) sesuai spesifikasi Section 3.2 TECH_STACK"""
        try:
            from ultralytics import YOLO
            custom_path = Path(settings.MODEL_WEIGHTS_PATH)
            if not custom_path.exists():
                alt_path = Path(__file__).resolve().parent.parent.parent / "weights" / "best.pt"
                if alt_path.exists():
                    custom_path = alt_path

            if custom_path.exists():
                print(f"[+] Memuat model custom YOLOv8: {custom_path}")
                self.model = YOLO(str(custom_path))
                self.model_version = custom_path.name
            else:
                fallback_name = settings.FALLBACK_MODEL_NAME
                print(f"[-] Bobot custom belum ditemukan. Memuat model dasar: {fallback_name}")
                self.model = YOLO(fallback_name)
                self.model_version = fallback_name
        except Exception as e:
            print(f"[ERR] Gagal memuat YOLOv8: {e}")
            self.model = None

    def calculate_severity(self, class_name: str, box_w: float, box_h: float, img_w: int, img_h: int) -> Tuple[SeverityEnum, float]:
        """
        Formulasi Keparahan 2-Jalur Terkalibrasi (METODOLOGI.md Langkah 5.3):
        - Pothole: Rasio Luas R_area
        - Crack: Rasio Bentang Terpanjang R_span
        """
        class_clean = class_name.lower().strip()
        
        if "crack" in class_clean:
            # Jalur Retak (Crack): Rasio bentang terpanjang terhadap dimensi maksimum citra
            r_span = max(box_w, box_h) / max(img_w, img_h)
            area_ratio = round(r_span, 4)
            if r_span < 0.05:
                return SeverityEnum.RINGAN, area_ratio
            else:
                return SeverityEnum.BERAT, area_ratio
        else:
            # Jalur Lubang (Pothole): Rasio luas kotak terhadap luas total citra
            r_area = (box_w * box_h) / (img_w * img_h)
            area_ratio = round(r_area, 4)
            if r_area < 0.02:
                return SeverityEnum.RINGAN, area_ratio
            elif r_area < 0.08:
                return SeverityEnum.SEDANG, area_ratio
            else:
                return SeverityEnum.BERAT, area_ratio

    def predict(
        self,
        image_bytes: bytes,
        conf_min: float = 0.25
    ) -> Tuple[List[DetectionItem], Optional[SeverityEnum], float, bytes]:
        """
        Menjalankan inferensi YOLOv8 dan kalkulasi keparahan.
        Mengembalikan: (detections, max_severity, max_conf, annotated_image_bytes)
        """
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_w, img_h = pil_img.size

        detections: List[DetectionItem] = []
        max_severity: Optional[SeverityEnum] = None
        max_conf: float = 0.0

        if self.model is not None:
            # Forward pass model YOLOv8 (640x640)
            results = self.model.predict(pil_img, imgsz=640, conf=conf_min, verbose=False)
            result = results[0]

            for box in result.boxes:
                conf = float(box.conf[0].cpu().numpy())
                cls_id = int(box.cls[0].cpu().numpy())
                cls_name = result.names.get(cls_id, "pothole")

                # Remap nama kelas
                clean_cls = "pothole" if "pothole" in cls_name.lower() or cls_id == 0 else "crack"

                # Koordinat xywh piksel
                x_c, y_c, w, h = box.xywh[0].cpu().numpy()
                sev, ratio = self.calculate_severity(clean_cls, float(w), float(h), img_w, img_h)

                # Koordinat normalisasi [0..1]
                norm_bbox = [
                    round(float(x_c) / img_w, 4),
                    round(float(y_c) / img_h, 4),
                    round(float(w) / img_w, 4),
                    round(float(h) / img_h, 4),
                ]

                det = DetectionItem(
                    class_name=clean_cls,
                    confidence=round(conf, 2),
                    bbox=norm_bbox,
                    area_ratio=ratio,
                    severity=sev
                )
                detections.append(det)

                if conf > max_conf:
                    max_conf = conf

                # Worst-case severity escalation
                if max_severity is None or SEVERITY_ORDER[sev] > SEVERITY_ORDER[max_severity]:
                    max_severity = sev

        # Gambar Bounding Box anotasi pada citra (Annotated Image)
        annotated_pil = pil_img.copy()
        draw = ImageDraw.Draw(annotated_pil)

        for det in detections:
            x_c_norm, y_c_norm, w_norm, h_norm = det.bbox
            box_w = w_norm * img_w
            box_h = h_norm * img_h
            x1 = (x_c_norm * img_w) - (box_w / 2.0)
            y1 = (y_c_norm * img_h) - (box_h / 2.0)
            x2 = x1 + box_w
            y2 = y1 + box_h

            color = SEVERITY_COLORS.get(det.severity, (229, 72, 77))
            line_width = max(3, int(min(img_w, img_h) * 0.005))
            draw.rectangle([x1, y1, x2, y2], outline=color, width=line_width)

            label_text = f"{det.class_name.upper()} ({int(det.confidence * 100)}%) - {det.severity.value}"
            text_bbox = draw.textbbox((x1, max(0, y1 - 20)), label_text)
            draw.rectangle(text_bbox, fill=color)
            draw.text((x1 + 3, max(0, y1 - 20) + 1), label_text, fill=(255, 255, 255))

        out_buffer = io.BytesIO()
        annotated_pil.save(out_buffer, format="JPEG", quality=85)
        annotated_bytes = out_buffer.getvalue()

        return detections, max_severity, round(max_conf, 2), annotated_bytes
