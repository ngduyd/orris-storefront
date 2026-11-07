import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";

/**
 * Serves locally uploaded images. `next start` snapshots public/ at boot, so files
 * written afterwards 404 — this route reads from disk on every request instead.
 */
const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const rel = normalize(path.join("/"));
  if (rel.includes("..")) return new Response("bad path", { status: 400 });

  const ext = rel.split(".").pop()?.toLowerCase() ?? "";
  const type = TYPES[ext];
  if (!type) return new Response("unsupported", { status: 415 });

  try {
    const buf = await readFile(join(process.cwd(), "public", "uploads", rel));
    return new Response(new Uint8Array(buf), {
      headers: { "content-type": type, "cache-control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
