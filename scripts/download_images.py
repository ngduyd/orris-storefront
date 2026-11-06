"""Tải ảnh sản phẩm về data/images/<handle>.<ext>. Chạy lại an toàn: bỏ qua file đã có."""
import csv
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).parent.parent
SRC = ROOT / "data/processed/products.csv"
DIR = ROOT / "data/images"
MAGIC = {b"\xff\xd8\xff": "jpg", b"\x89PNG": "png", b"\x89PN": "png", b"RIFF": "webp", b"GIF8": "gif"}


def save(row):
    h, url = row["handle"], row["image_url"]
    # ponytail: giữ đuôi theo magic bytes; nếu Shopify cần đúng tên file thì map ext -> cột Image Src
    for ext in ("jpg", "png", "webp", "gif"):
        if (DIR / f"{h}.{ext}").exists():
            return h, "skip", 0
    try:
        req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(req, timeout=25) as r:
            data = r.read()
    except Exception as e:
        return h, f"err:{type(e).__name__}", 0
    if len(data) < 1000:
        return h, "err:tiny", 0
    ext = next((v for k, v in MAGIC.items() if data.startswith(k)), None)
    if not ext:
        return h, "err:notimage", 0
    (DIR / f"{h}.{ext}").write_bytes(data)
    return h, "ok", len(data)


def main():
    DIR.mkdir(parents=True, exist_ok=True)
    rows = list(csv.DictReader(SRC.open(encoding="utf-8")))
    with ThreadPoolExecutor(max_workers=16) as ex:
        res = list(ex.map(save, rows))
    ok = sum(r[1] in ("ok", "skip") for r in res)
    bad = [r for r in res if not r[1].startswith(("ok", "skip"))]
    print(f"{ok}/{len(res)} ảnh có local | lỗi {len(bad)} | {sum(r[2] for r in res)/1e6:.1f} MB")
    for r in bad[:10]:
        print("  ", r[0], r[1])


if __name__ == "__main__":
    main()
