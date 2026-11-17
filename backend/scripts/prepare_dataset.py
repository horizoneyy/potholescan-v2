"""
Skrip Kurasi, Penyelarasan Label (2 Kelas), dan Partisi Dataset (LOKAL)
Mendukung format Pascal VOC (XML) dan YOLO (TXT)
Sesuai Dokumen METODOLOGI.md:
- Kelas 0: pothole (lubang)
- Kelas 1: crack (retak)
- Partisi Data: 70% Train, 20% Val, 10% Test (seed=42)
"""
import os
import random
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path

def parse_voc_xml(xml_path: Path):
    """Mengubah format Pascal VOC XML ke format TXT YOLO [cls, xc, yc, w, h]"""
    tree = ET.parse(xml_path)
    root = tree.getroot()

    size = root.find("size")
    if size is None:
        return []

    img_w = float(size.find("width").text)
    img_h = float(size.find("height").text)

    if img_w == 0 or img_h == 0:
        return []

    yolo_lines = []
    for obj in root.findall("object"):
        name = obj.find("name").text.lower().strip()
        cls_id = 0 if "pothole" in name else 1

        bndbox = obj.find("bndbox")
        xmin = float(bndbox.find("xmin").text)
        ymin = float(bndbox.find("ymin").text)
        xmax = float(bndbox.find("xmax").text)
        ymax = float(bndbox.find("ymax").text)

        # Konversi ke normalized center format (YOLO)
        x_c = ((xmin + xmax) / 2.0) / img_w
        y_c = ((ymin + ymax) / 2.0) / img_h
        w = (xmax - xmin) / img_w
        h = (ymax - ymin) / img_h

        # Batasi rentang [0..1]
        x_c = max(0.0, min(1.0, x_c))
        y_c = max(0.0, min(1.0, y_c))
        w = max(0.0, min(1.0, w))
        h = max(0.0, min(1.0, h))

        yolo_lines.append(f"{cls_id} {x_c:.6f} {y_c:.6f} {w:.6f} {h:.6f}")

    return yolo_lines

def prepare_yolo_dataset():
    base_dir = Path(__file__).resolve().parent.parent
    raw_dir = base_dir / "data" / "raw"
    processed_dir = base_dir / "data" / "processed"

    print("=" * 60)
    print("POTHOLESCAN - PREPROCESSING DATASET YOLOv8 (2 KELAS)")
    print(f"Sumber Data Mentah : {raw_dir}")
    print(f"Hasil Terstruktur  : {processed_dir}")
    print("=" * 60)

    # Bersihkan & siapkan sub-direktori output
    for split in ["train", "val", "test"]:
        p_img = processed_dir / "images" / split
        p_lbl = processed_dir / "labels" / split
        p_img.mkdir(parents=True, exist_ok=True)
        p_lbl.mkdir(parents=True, exist_ok=True)

    # 1. Cari seluruh gambar di data mentah
    image_extensions = {".jpg", ".jpeg", ".png", ".bmp"}
    all_images = []
    for ext in image_extensions:
        all_images.extend(list(raw_dir.rglob(f"*{ext}")))
        all_images.extend(list(raw_dir.rglob(f"*{ext.upper()}")))

    # Filter agar tidak mengambil gambar dari processed
    all_images = [img for img in all_images if "processed" not in str(img)]

    if not all_images:
        print("[!] Belum ditemukan file gambar di `backend/data/raw`.")
        return

    print(f"[+] Ditemukan {len(all_images)} gambar di data mentah.")

    # 2. Pasangkan gambar dengan anotasi (XML atau TXT)
    dataset_items = []
    for img_path in all_images:
        # Cek XML di folder paralel / annotations
        xml_path = img_path.with_suffix(".xml")
        if not xml_path.exists():
            xml_alt = Path(str(img_path.parent).replace("images", "annotations")) / f"{img_path.stem}.xml"
            if xml_alt.exists():
                xml_path = xml_alt

        # Cek TXT
        txt_path = img_path.with_suffix(".txt")
        if not txt_path.exists():
            txt_alt = Path(str(img_path.parent).replace("images", "labels")) / f"{img_path.stem}.txt"
            if txt_alt.exists():
                txt_path = txt_alt

        if xml_path.exists():
            dataset_items.append((img_path, "xml", xml_path))
        elif txt_path.exists():
            dataset_items.append((img_path, "txt", txt_path))

    if not dataset_items:
        print("[!] Tidak ditemukan berkas anotasi (XML/TXT) untuk gambar.")
        return

    print(f"[+] Berhasil memasangkan {len(dataset_items)} gambar dengan anotasi.")

    # 3. Acak deterministik (seed=42)
    random.seed(42)
    random.shuffle(dataset_items)

    n_total = len(dataset_items)
    n_train = int(n_total * 0.70)
    n_val = int(n_total * 0.20)

    train_set = dataset_items[:n_train]
    val_set = dataset_items[n_train:n_train + n_val]
    test_set = dataset_items[n_train + n_val:]

    print(f"[-] Distribusi: Train={len(train_set)}, Val={len(val_set)}, Test={len(test_set)}")

    def process_and_copy(subset, split_name):
        for img_path, anno_type, anno_path in subset:
            dst_img = processed_dir / "images" / split_name / img_path.name
            dst_txt = processed_dir / "labels" / split_name / f"{img_path.stem}.txt"

            shutil.copy2(img_path, dst_img)

            if anno_type == "xml":
                lines = parse_voc_xml(anno_path)
                with open(dst_txt, "w", encoding="utf-8") as f:
                    f.write("\n".join(lines) + "\n")
            else:
                # Normalisasi TXT
                with open(anno_path, "r", encoding="utf-8") as f_in, open(dst_txt, "w", encoding="utf-8") as f_out:
                    for line in f_in:
                        parts = line.strip().split()
                        if len(parts) >= 5:
                            cls_id = 0 if int(parts[0]) == 0 else 1
                            f_out.write(f"{cls_id} {' '.join(parts[1:5])}\n")

    print("[*] Mengonversi anotasi ke YOLO dan menyusun partisi train/val/test...")
    process_and_copy(train_set, "train")
    process_and_copy(val_set, "val")
    process_and_copy(test_set, "test")

    # 4. Tulis file data.yaml
    yaml_content = f"""# PotholeScan Dataset YAML
path: {processed_dir.as_posix()}
train: images/train
val: images/val
test: images/test

names:
  0: pothole
  1: crack
"""
    yaml_path = processed_dir / "data.yaml"
    with open(yaml_path, "w", encoding="utf-8") as f:
        f.write(yaml_content)

    print(f"[OK] Selesai! data.yaml tersimpan di: {yaml_path}")
    print("Dataset siap untuk dilatih dengan `python scripts/train_local.py`.")

if __name__ == "__main__":
    prepare_yolo_dataset()
