"""Chuẩn hoá ảnh catalog: tách nền -> cắt sát -> canvas 1200x1500 ivory + bóng mềm -> webp.

Dùng mask theo alpha nếu có, nếu không thì theo khoảng cách màu so với màu viền.
Không dùng model AI: tất định, chạy lại cho cùng kết quả.

    python3 scripts/normalize_images.py [--limit N]
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFile, ImageFilter



ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data/images"
OUT = ROOT / "data/images_norm"
BG = (239, 233, 225)  # --color-ivory-deep
W, H = 1200, 1500
INNER_W, INNER_H = 1040, 1160
QUALITY = 82


def load_mask(im: Image.Image) -> Image.Image:
    """Trả mask trắng = sản phẩm."""
    if im.mode in ("RGBA", "LA", "P"):
        rgba = im.convert("RGBA")
        alpha = np.array(rgba)[:, :, 3]
        if (alpha < 16).mean() > 0.02:
            return Image.fromarray(alpha)
        im = rgba.convert("RGB")
    else:
        im = im.convert("RGB")

    a = np.array(im).astype(np.int16)
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    ref = np.median(border, axis=0)
    dist = np.abs(a - ref).sum(axis=2)
    mask = (dist > 40).astype(np.uint8) * 255
    return Image.fromarray(mask).filter(ImageFilter.MedianFilter(3))


def longest_run(flags: np.ndarray, min_len: int = 8) -> tuple[int, int] | None:
    """Trả (start, end) của dải True liên tục dài nhất, bỏ dải ngắn hơn min_len (nhiễu 1-2 pixel)."""
    best = cur = None
    for i, on in enumerate(flags):
        if on:
            cur = (cur[0], i) if cur else (i, i)
            if (not best or cur[1] - cur[0] > best[1] - best[0]) and cur[1] - cur[0] + 1 >= min_len:
                best = cur
        else:
            cur = None
    return best


def normalize(path: Path) -> tuple[str, int]:
    # đọc nghiêm ngặt trước; chỉ nới lỏng khi file thật sự hỏng (vài ảnh CDN có chunk lỗi)
    try:
        im = Image.open(path)
        im.load()
    except Exception:
        ImageFile.LOAD_TRUNCATED_IMAGES = True
        im = Image.open(path)
        im.load()
        print(f"  cảnh báo: đọc lỏng {path.name}", file=sys.stderr)
    mask = load_mask(im)
    box = mask.getbbox()
    if not box:
        raise ValueError("mask rỗng")
    # nới 2% quanh sản phẩm để không cắt sát viền
    pad = int(max(box[2] - box[0], box[3] - box[1]) * 0.02)
    box = (max(box[0] - pad, 0), max(box[1] - pad, 0),
           min(box[2] + pad, im.width), min(box[3] + pad, im.height))

    rgb = im.convert("RGBA")
    rgb.putalpha(mask)
    crop = rgb.crop(box)

    # Bỏ đảo rời (bóng/phản chiếu dưới đáy): chỉ giữ dải hàng và cột liên tục dài nhất.
    m = np.array(crop)[:, :, 3] > 24
    rows = longest_run(m.mean(axis=1) > 0.02)
    cols = longest_run(m.mean(axis=0) > 0.02)
    if rows and cols:
        crop = crop.crop((cols[0], rows[0], cols[1] + 1, rows[1] + 1))

    # phóng để sản phẩm chiếm ~78% chiều cao khung, không tràn bề ngang
    scale = min((W * 0.86) / crop.width, (H * 0.78) / crop.height)
    crop = crop.resize((max(1, int(crop.width * scale)), max(1, int(crop.height * scale))), Image.LANCZOS)

    canvas = Image.new("RGB", (W, H), BG)
    # bóng mềm dưới đáy chai
    shadow = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(shadow)
    sw = int(crop.width * 0.72)
    sh = max(30, int(crop.height * 0.05))
    cx = W // 2
    base_y = (H - crop.height) // 2 + crop.height
    d.ellipse((cx - sw // 2, base_y - sh, cx + sw // 2, base_y + sh), fill=90)
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    canvas.paste(Image.new("RGB", (W, H), (120, 108, 94)), (0, 0), shadow)

    canvas.paste(crop, (cx - crop.width // 2, (H - crop.height) // 2), crop)
    OUT.mkdir(parents=True, exist_ok=True)
    dst = OUT / f"{path.stem}.webp"
    canvas.save(dst, "WEBP", quality=QUALITY, method=4)
    return dst.name, dst.stat().st_size


def main() -> None:
    limit = None
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])
    files = sorted(p for p in SRC.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"})
    if limit:
        files = files[:limit]

    ok, failed, total = 0, [], 0
    for p in files:
        try:
            name, size = normalize(p)
            ok += 1
            total += size
        except Exception as e:  # noqa: BLE001 - cần biết file nào hỏng
            failed.append((p.name, str(e)))

    print(f"{ok}/{len(files)} ảnh -> {OUT} · {total / 1e6:.1f} MB · TB {total / max(ok, 1) / 1024:.0f} KB")
    for n, e in failed[:10]:
        print("  fail", n, e)


if __name__ == "__main__":
    main()
