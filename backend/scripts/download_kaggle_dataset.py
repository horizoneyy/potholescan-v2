"""
Skrip Pengunduh Otomatis Dataset Kaggle (100% LOKAL)
CATATAN PENTING: Dataset ini HANYA disimpan di komputer lokal (backend/data/raw)
dan TIDAK PERNAH diunggah ke Supabase.
"""
import os
import shutil
import sys
from pathlib import Path

def download_dataset(dataset_handle: str = "aniruddhsharma/structural-defects-pothole-detection"):
    """
    Mengunduh dataset dari Kaggle menggunakan library kagglehub.
    Default dataset: structural-defects-pothole-detection (memuat anotasi pothole & crack)
    """
    base_dir = Path(__file__).resolve().parent.parent
    target_dir = base_dir / "data" / "raw"
    target_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("POTHOLESCAN - PENGUNDUH DATASET KAGGLE (LOKAL)")
    print(f"Target Direktori Lokal : {target_dir}")
    print(f"Dataset Kaggle         : {dataset_handle}")
    print("=" * 60)

    try:
        import kagglehub
        print("[1/2] Menghubungi repositori Kaggle melalui kagglehub...")
        download_path = kagglehub.dataset_download(dataset_handle)
        print(f"[+] Dataset berhasil diunduh ke cache: {download_path}")

        print(f"[2/2] Menyinkronkan file ke direktori proyek lokal: {target_dir}")
        for item in os.listdir(download_path):
            src_item = os.path.join(download_path, item)
            dst_item = target_dir / item
            if os.path.isdir(src_item):
                if dst_item.exists():
                    shutil.rmtree(dst_item)
                shutil.copytree(src_item, dst_item)
            else:
                shutil.copy2(src_item, dst_item)

        print("[OK] Selesai! Seluruh data mentah tersimpan di folder lokal `backend/data/raw`.")
        print("Langkah selanjutnya: Jalankan `python scripts/prepare_dataset.py` untuk memproses label.")
        return str(target_dir)

    except ImportError:
        print("[!] Library 'kagglehub' belum terpasang.")
        print("    Jalankan: pip install kagglehub")
        sys.exit(1)
    except Exception as e:
        print(f"[ERR] Gagal mengunduh dataset: {e}")
        print("\nAlternatif: Anda dapat mengunduh dataset ZIP manual dari Kaggle lalu mengekstraknya ke:")
        print(f"  {target_dir}")
        sys.exit(1)

if __name__ == "__main__":
    handle = sys.argv[1] if len(sys.argv) > 1 else "aniruddhsharma/structural-defects-pothole-detection"
    download_dataset(handle)
