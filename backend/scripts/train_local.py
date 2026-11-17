"""
Skrip Pelatihan Model YOLOv8 Lokal dengan Akselerasi GPU NVIDIA RTX 4050
Sesuai Dokumen METODOLOGI.md:
- Model: YOLOv8s (atau YOLOv8n)
- Input Size: 640 x 640
- Early stopping (patience=15), seed=42
- Output: backend/weights/best.pt
- Dioptimalkan untuk Windows (workers=0 untuk menghemat memori RAM)
"""
import os
import shutil
import sys
from pathlib import Path

def train():
    try:
        import torch
        from ultralytics import YOLO
    except ImportError:
        print("[!] Ultralytics / PyTorch belum terpasang.")
        print("    Jalankan: pip install ultralytics torch torchvision")
        sys.exit(1)

    base_dir = Path(__file__).resolve().parent.parent
    yaml_path = base_dir / "data" / "processed" / "data.yaml"
    weights_dir = base_dir / "weights"
    weights_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 65)
    print("POTHOLESCAN - PELATIHAN MODEL YOLOv8 LOKAL")
    print("=" * 65)

    # Deteksi akselerasi GPU NVIDIA CUDA
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
        print(f"[+] GPU Terdeteksi : {gpu_name} ({vram_gb:.1f} GB VRAM)")
        device = 0
        amp = True
        batch_size = 8  # Dioptimalkan untuk stabilitas memori Windows
    else:
        print("[!] GPU CUDA tidak terdeteksi, beralih ke komputasi CPU.")
        device = "cpu"
        amp = False
        batch_size = 4

    if not yaml_path.exists():
        print(f"[ERR] File data.yaml tidak ditemukan di: {yaml_path}")
        print("      Jalankan `python scripts/prepare_dataset.py` terlebih dahulu.")
        sys.exit(1)

    print(f"[-] Konfigurasi Dataset : {yaml_path}")
    print("[-] Base Pre-trained     : yolov8s.pt (Small Model)")
    print(f"[-] Dimensi Citra        : 640 x 640")
    print(f"[-] Batch Size           : {batch_size}")
    print(f"[-] Workers              : 0 (Hemat Memori RAM Windows)")
    print(f"[-] Perangkat Komputasi  : {device}")
    print("=" * 65)

    # Inisialisasi model dari pre-trained COCO
    model = YOLO("yolov8s.pt")

    # Mulai pelatihan sesuai metodologi
    results = model.train(
        data=str(yaml_path),
        epochs=50,
        imgsz=640,
        batch=batch_size,
        device=device,
        workers=0,      # Sangat krusial di Windows agar tidak terjadi MemoryError
        patience=15,
        seed=42,
        optimizer="AdamW",
        lr0=0.01,
        lrf=0.01,
        amp=amp,
        cache=False,    # Tidak memuat seluruh dataset ke RAM
        project=str(base_dir / "runs" / "train"),
        name="potholescan_yolov8",
        exist_ok=True,
        verbose=True
    )

    # Salin best.pt ke backend/weights/best.pt
    best_weights_src = base_dir / "runs" / "train" / "potholescan_yolov8" / "weights" / "best.pt"
    best_weights_dst = weights_dir / "best.pt"

    if best_weights_src.exists():
        shutil.copy2(best_weights_src, best_weights_dst)
        print("\n" + "=" * 65)
        print(f"[OK] Pelatihan selesai!")
        print(f"[+] Bobot terbaik (best.pt) berhasil disalin ke: {best_weights_dst}")
        print("Langkah selanjutnya: Jalankan `python scripts/evaluate_model.py` untuk menguji metrik.")
        print("=" * 65)
    else:
        print("[!] Pelatihan selesai namun file best.pt tidak ditemukan di direktori runs.")

if __name__ == "__main__":
    train()
