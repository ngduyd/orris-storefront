"""Upload data/images_norm/*.webp lên Cloudinary với public_id = handle.

    export CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
    python3 scripts/upload_cloudinary.py [--limit N] [--dry-run]

URL ảnh sau upload là tất định nên DB không cần lưu URL:
    https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto,w_800/perfumes/<handle>
"""
import hashlib
import os
import sys
import time
from pathlib import Path
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data/images_norm"
FOLDER = "perfumes"
MANIFEST = ROOT / "data/.cloudinary_uploaded"  # resume: KHÔNG đặt trong public/images (Turbopack panic)


def creds() -> tuple[str, str, str]:
    url = os.environ.get("CLOUDINARY_URL", "")
    if not url.startswith("cloudinary://"):
        sys.exit("thiếu CLOUDINARY_URL (cloudinary://key:secret@cloud)")
    u = urlparse(url)
    return u.username, u.password, u.hostname or ""


def sign(params: dict[str, str], secret: str) -> str:
    raw = "&".join(f"{k}={params[k]}" for k in sorted(params))
    return hashlib.sha1(f"{raw}{secret}".encode()).hexdigest()


def upload(path: Path, key: str, secret: str, cloud: str) -> str:
    ts = str(int(time.time()))
    params = {"folder": FOLDER, "public_id": path.stem, "timestamp": ts, "overwrite": "true"}
    boundary = "----orris"
    parts: list[bytes] = []
    for k, v in {**params, "api_key": key, "signature": sign(params, secret)}.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    parts.append(
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{path.name}"\r\n'
        f"Content-Type: image/webp\r\n\r\n".encode()
        + path.read_bytes()
        + b"\r\n"
    )
    parts.append(f"--{boundary}--\r\n".encode())
    req = Request(
        f"https://api.cloudinary.com/v1_1/{cloud}/image/upload",
        data=b"".join(parts),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    with urlopen(req, timeout=60) as r:
        return r.read().decode()[:80]


def main() -> None:
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
    workers = int(sys.argv[sys.argv.index("--workers") + 1]) if "--workers" in sys.argv else 8
    dry = "--dry-run" in sys.argv
    key, secret, cloud = creds()
    files = sorted(SRC.glob("*.webp"))[:limit]
    print(f"{len(files)} ảnh -> cloud '{cloud}' folder '{FOLDER}'{' (dry-run)' if dry else ''}")
    if dry:
        for f in files[:3]:
            print("  ", f.stem)
        return
    done = set(MANIFEST.read_text().split()) if MANIFEST.exists() else set()
    todo = [f for f in files if f.stem not in done]
    print(f"đã upload trước đó: {len(done)} · còn lại: {len(todo)} · workers {workers}")

    ok = 0
    with MANIFEST.open("a") as manifest, ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {ex.submit(upload, f, key, secret, cloud): f for f in todo}
        for i, (fut, f) in enumerate(futures.items(), 1):
            try:
                fut.result()
                manifest.write(f.stem + "\n")
                ok += 1
            except Exception as e:  # noqa: BLE001
                print("  fail", f.name, str(e)[:120])
            if i % 250 == 0:
                manifest.flush()
                print(f"  {i}/{len(todo)}")
    print(f"uploaded {ok}/{len(todo)}")


if __name__ == "__main__":
    main()
