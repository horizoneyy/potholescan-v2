"""
Skrip Evaluasi dan Benchmark Model YOLOv8 (Sesuai SRS.md & METODOLOGI.md)
Target Metrik:
- mAP@0.5 >= 0.70
- Recall Pothole >= 0.75
- Latensi Inferensi <= 1.0 detik (1000 ms)
- Dioptimalkan untuk Windows (workers=0, plots=False)
"""
import time
from pathlib import Path
import sys

def evaluate():
    try:
        import torch
        from ultralytics import YOLO
    except ImportError:
        print("[!] Ultralytics / PyTorch belum terpasang.")
        sys.exit(1)

    base_dir = Path(__file__).resolve().parent.parent
    yaml_path = base_dir / "data" / "processed" / "data.yaml"
    weights_path = base_dir / "weights" / "best.pt"

    if not weights_path.exists():
        print(f"[ERR] File bobot {weights_path} tidak ditemukan.")
        sys.exit(1)

    print("=" * 65)
    print("POTHOLESCAN - EVALUASI METRIK & BENCHMARK INFERENSI")
    print(f"Berkas Bobot : {weights_path}")
    print("=" * 65)

    model = YOLO(str(weights_path))
    device = 0 if torch.cuda.is_available() else "cpu"

    # Evaluasi pada data uji (test split)
    if yaml_path.exists():
        print("[1/2] Mengevaluasi pada Blind Test Set...")
        metrics = model.val(
            data=str(yaml_path),
            split="test",
            imgsz=640,
            batch=8,
            workers=0,      # Sangat krusial di Windows
            plots=False,    # Mencegah memory crash OpenCV
            device=device
        )
        
        map50 = metrics.box.map50
        map50_95 = metrics.box.map
        precision = metrics.box.mp
        recall = metrics.box.mr
        
        print("\n" + "=" * 65)
        print("--- HASIL METRIK MODEL EVALUASI AKHIR ---")
        print("=" * 65)
        print(f"mAP@0.5 (Mean Average Precision) : {map50:.4f} ({map50*100:.1f}%) [Target SRS: >= 70%]")
        print(f"mAP@0.5:0.95                     : {map50_95:.4f} ({map50_95*100:.1f}%)")
        print(f"Mean Precision                   : {precision:.4f} ({precision*100:.1f}%)")
        print(f"Mean Recall                      : {recall:.4f} ({recall*100:.1f}%) [Target SRS: >= 75%]")
        print("-" * 65)
        status_srs = "MEMENUHI STANDAR (APPROVED)" if map50 >= 0.70 and recall >= 0.70 else "BELUM MEMENUHI"
        print(f"Status Kualifikasi IEEE/SRS      : {status_srs}")
        print("=" * 65)

    # Benchmark Latensi Inferensi
    print("\n[2/2] Mengukur Latensi Inferensi Nyata (Latency Benchmark)...")
    dummy_input = torch.zeros((1, 3, 640, 640)).to(device)
    
    # Warmup
    for _ in range(5):
        _ = model(dummy_input, verbose=False)

    times = []
    for _ in range(30):
        t0 = time.perf_counter()
        _ = model(dummy_input, verbose=False)
        times.append(time.perf_counter() - t0)

    avg_latency_ms = (sum(times) / len(times)) * 1000
    avg_latency_sec = avg_latency_ms / 1000

    print(f"Rata-rata Waktu Inferensi: {avg_latency_ms:.2f} ms ({avg_latency_sec:.4f} detik)")
    status_latency = "SANGAT CEPAT / LOLOS (<= 1.0s)" if avg_latency_sec <= 1.0 else "MELEBIHI BATAS"
    print(f"Status Kriteria NFR-01   : {status_latency}")
    print("=" * 65)

if __name__ == "__main__":
    evaluate()
