"""products.csv -> data/processed/shopify_products.csv (format import Shopify, 1 variant/SKU)."""
import csv
from pathlib import Path

ROOT = Path(__file__).parent.parent
SRC = ROOT / "data/processed/products.csv"
OUT = ROOT / "data/processed/shopify_products.csv"

HEADER = ["Handle", "Title", "Body (HTML)", "Vendor", "Type", "Tags", "Published",
          "Option1 Name", "Option1 Value", "Variant SKU", "Variant Grams",
          "Variant Inventory Tracker", "Variant Inventory Qty", "Variant Inventory Policy",
          "Variant Fulfillment Service", "Variant Price", "Variant Requires Shipping",
          "Variant Taxable", "Image Src", "Image Position", "Image Alt Text",
          "SEO Title", "SEO Description", "Status"]


def pills(title, text):
    if not text:
        return ""
    items = "".join(f"<span>{p.strip()}</span>" for p in text.split("|") if p.strip())
    return f"<p><strong>{title}</strong> {items}</p>"


def body(p):
    rating = f"<p>Rating {p['rating']}/5 ({p['rating_count'] or 0} đánh giá)</p>" if p["rating"] else ""
    return "".join([
        f"<p>{p['description']}</p>" if p["description"] else "",
        pills("Accords:", p["accords"]),
        pills("Top:", p["notes_top"]),
        pills("Middle:", p["notes_mid"]),
        pills("Base:", p["notes_base"]),
        f"<p>{p['family']} · {p['concentration'] or 'N/A'} · {p['size_ml']} ml"
        + (f" · {p['year']}" if p["year"] else "") + "</p>",
        rating,
    ])


def tags(p):
    t = [p["gender"], p["family"], p["concentration"], f"{p['size_ml']}ml", p["brand"]]
    t += [a.strip() for a in p["accords"].split("|") if a.strip()]
    return ", ".join(dict.fromkeys(x for x in t if x))


def row(p):
    alt = f"{p['brand']} {p['title']} {p['size_ml']}ml"
    return {
        "Handle": p["handle"], "Title": p["title"], "Body (HTML)": body(p),
        "Vendor": p["brand"], "Type": p["family"] or "Perfume", "Tags": tags(p),
        "Published": "TRUE",
        "Option1 Name": "Size", "Option1 Value": f"{p['size_ml']} ml",
        "Variant SKU": p["handle"].upper()[:60],
        "Variant Grams": p["size_ml"] * 2,  # ponytail: ~chai + hộp; cân nặng thật cần dữ liệu vận chuyển
        "Variant Inventory Tracker": "shopify", "Variant Inventory Qty": 100,
        "Variant Inventory Policy": "deny", "Variant Fulfillment Service": "manual",
        "Variant Price": f"{float(p['price_sar']):.2f}",
        "Variant Requires Shipping": "TRUE", "Variant Taxable": "TRUE",
        "Image Src": p["image_url"], "Image Position": 1, "Image Alt Text": alt,
        "SEO Title": alt[:70], "SEO Description": (p["description"] or alt)[:160],
        "Status": "active",
    }


def main():
    rows = list(csv.DictReader(SRC.open(encoding="utf-8")))
    out = [row(p) for p in rows]
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=HEADER)
        w.writeheader()
        w.writerows(out)
    assert len({r["Handle"] for r in out}) == len(out) == len(rows)
    assert all(float(r["Variant Price"]) > 0 for r in out)
    assert all(r["Image Src"].startswith("https://") for r in out)
    print(f"{len(out)} dòng -> {OUT}")


if __name__ == "__main__":
    main()
