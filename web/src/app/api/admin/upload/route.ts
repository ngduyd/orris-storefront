import { currentStaff } from "@/lib/auth";
import { imageUrl } from "@/lib/image";
import { uploadImage } from "@/lib/upload";
import { hit } from "@/lib/rate-limit";

const HOUR = 60 * 60 * 1000;

/** POST multipart (field "files", nhiều file) -> { images: string[] } */
export async function POST(req: Request) {
  const staff = await currentStaff();
  if (!staff) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (hit(`upload:${staff.id}`, 30, HOUR)) return Response.json({ error: "too many uploads, try again later" }, { status: 429 });

  const form = await req.formData();
  const handle = String(form.get("handle") ?? "product").replace(/[^a-z0-9-]/gi, "").slice(0, 80) || "product";
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) return Response.json({ error: "no file" }, { status: 400 });
  if (files.length > 8) return Response.json({ error: "too many files (max 8)" }, { status: 400 });

  try {
    const images = await Promise.all(files.map((f) => uploadImage(f, handle)));
    return Response.json({ images: images.map((name) => ({ name, url: imageUrl(name, 200) })) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "upload failed" }, { status: 500 });
  }
}
