"""goldenscent.csv -> products.csv (1 dòng = 1 SKU sẵn sàng cho Shopify)."""
import csv, re, unicodedata
from pathlib import Path

RAW = Path(__file__).parent.parent / "data/raw/goldenscent.csv"
OUT = Path(__file__).parent.parent / "data/processed/products.csv"

MISS = {"", "none", "unknown", "nan", "0", "0.0", "n/a"}


def val(v):
    v = (v or "").strip()
    return "" if v.lower() in MISS else v


def num(v, pat):
    m = re.search(pat, v or "", re.I)
    return float(m.group(1).replace(",", "")) if m else None


def notes(v):
    v = val(v).replace("\n", " ")
    return " | ".join(p.strip(" .") for p in v.split(",") if p.strip(" ."))


def size_ml(v):
    # ponytail: coi 1g ≈ 1ml cho nước hoa; nếu cần chính xác thì tách cột size_g
    return num(v, r"(\d+(?:\.\d+)?)\s*(?:ml|g)\b")


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower())).strip("-")


CONC = {
    "eau de parfum": "EDP", "eau de toilette": "EDT", "eau de cologne": "EDC",
    "perfume oil": "Oil", "extrait de parfum": "Extrait", "parfum": "Parfum",
}
GENDERS = {"men": "Men", "women": "Women", "unisex": "Unisex"}
# loại hẳn: không phải chai nước hoa bán lẻ
DROP_TYPE = {"room spray", "bakhoor", "bundles", "candle", "diffuser",
             "accessories", "home fragrance set", "mabkhara", "coal", "minis"}

FIELDS = ["handle", "title", "brand", "gender", "concentration", "family", "accords",
          "notes_top", "notes_mid", "notes_base", "size_ml", "price_sar", "rating",
          "rating_count", "year", "image_url", "description"]


# cờ này lọt qua whitelist gender + Product_Type vì gender ghi sai -> lọc thêm theo tên
DROP_TITLE = ("candle", "bakhoor", "bukhoor", "diffuser", "room spray", "reed ", "mabkhara",
              "incense burner", "air freshener", "linen mist")


def build(row):
    ptype = val(row["Product_Type"]).lower()
    if any(k in val(row["Name"]).lower() for k in DROP_TITLE):
        return None
    gender = GENDERS.get(val(row["Gender"]).lower())
    if not gender or ptype in DROP_TYPE:
        return None
    title, brand = val(row["Name"]), val(row["Brand"])
    price, ml = num(val(row["Price"]), r"([\d.]+)\s*SAR"), size_ml(row["Size"])
    top, mid, base = notes(row["Top_note"]), notes(row["Middle_note"]), notes(row["Base_note"])
    img = val(row["image"])
    # trang sản phẩm không ảnh / không giá / không dung tích / không nốt hương = không dùng được
    if not all([title, brand, price, ml, img, top, base]):
        return None
    if not img.startswith("https://"):
        return None
    # handle tính từ tên gốc để không lệch tên file ảnh đã tải; title thì bỏ brand lặp
    disp = title[len(brand):].lstrip(" -&") if title.lower().startswith(brand.lower()) else title
    return {
        "handle": slug(f"{brand}-{title}-{int(ml)}ml")[:80],
        "title": disp or title,
        "brand": brand,
        "gender": gender,
        "concentration": CONC.get(val(row["Concentration"]).lower(), ""),
        "family": val(row["Fragrance_Family"]),
        "accords": notes(row["Character"]),
        "notes_top": top, "notes_mid": mid, "notes_base": base,
        "size_ml": int(ml),
        "price_sar": round(price, 2),
        "rating": num(val(row["Rate"]), r"(\d+(?:\.\d+)?)"),
        "rating_count": int(num(val(row["Rating_count"]), r"(\d+)")) if num(val(row["Rating_count"]), r"(\d+)") else None,
        "year": int(v) if (v := num(val(row["Year"]), r"(\d{4})")) else None,
        "image_url": img,
        "description": re.sub(r"\s+", " ", val(row["Description"]))[:2000],
    }


def main():
    rows = [p for p in (build(r) for r in csv.DictReader(RAW.open(encoding="utf-8", errors="replace"))) if p]

    # 1 SKU = brand + tên + dung tích; giữ bản đầy đủ trường nhất
    filled = lambda p: sum(bool(p[f]) for f in FIELDS)
    best = {}
    for p in rows:
        k = (p["brand"].lower(), p["title"].lower(), p["size_ml"])
        if k not in best or filled(p) > filled(best[k]):
            best[k] = p
    out = sorted(best.values(), key=lambda p: (p["brand"].lower(), p["title"].lower(), p["size_ml"]))

    # handle trùng -> hậu tố tăng dần theo base (deterministic, để không lệch tên file ảnh)
    seen = {}
    for p in out:
        base = p["handle"]
        seen[base] = seen.get(base, 0) + 1
        if seen[base] > 1:
            p["handle"] = f"{base}-{seen[base]}"

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(out)

    assert len({p["handle"] for p in out}) == len(out), "handle phải unique"
    assert all(p["size_ml"] > 0 and p["price_sar"] > 0 for p in out)
    print(f"raw {len(rows)} -> {len(out)} SKU -> {OUT}")
    print(f"có ảnh 100% | rating {sum(p['rating'] is not None for p in out)} "
          f"| EDP/EDT {sum(bool(p['concentration']) for p in out)} "
          f"| gender {sorted({p['gender'] for p in out})}")


if __name__ == "__main__":
    main()
