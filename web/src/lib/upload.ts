import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

/**
 * Upload ảnh sản phẩm. Có CLOUDINARY_URL thì đẩy lên Cloudinary (public_id tự sinh),
 * chưa cấu hình thì ghi vào public/uploads để dev vẫn thử được.
 * ponytail: chưa xoá file Cloudinary khi bỏ ảnh; thêm khi cần dọn rác.
 */
const CLOUD = process.env.CLOUDINARY_URL;

export async function uploadImage(file: File, handle: string): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const slug = `${handle}-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;

  if (CLOUD?.startsWith("cloudinary://")) {
    const u = new URL(CLOUD.replace("cloudinary://", "https://"));
    const apiKey = decodeURIComponent(u.username);
    const apiSecret = decodeURIComponent(u.password);
    const cloud = u.hostname;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = "perfumes";

    const toSign = `folder=${folder}&public_id=${slug}&timestamp=${timestamp}`;
    const signature = createHash("sha1").update(toSign + apiSecret).digest("hex");

    const form = new FormData();
    form.set("file", file);
    form.set("api_key", apiKey);
    form.set("timestamp", timestamp);
    form.set("folder", folder);
    form.set("public_id", slug);
    form.set("signature", signature);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`cloudinary ${res.status}: ${(await res.text()).slice(0, 120)}`);
    const json = (await res.json()) as { public_id: string };
    return `${json.public_id}.${ext}`;
  }

  const dir = join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const name = `${slug}.${ext}`;
  await writeFile(join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${name}`;
}
