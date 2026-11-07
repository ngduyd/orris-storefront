"use client";

import { useRef, useState, useTransition } from "react";

export type GalleryImage = { name: string; url: string };

/** Gallery editor: multi-upload with previews, remove, set primary. Posts names as JSON. */
export function ImageManager({ handle, initial }: { handle: string; initial: GalleryImage[] }) {
  const [images, setImages] = useState<GalleryImage[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setBusy(true);
    const form = new FormData();
    form.set("handle", handle);
    for (const f of Array.from(files).slice(0, 8)) form.append("files", f);

    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const json = (await res.json()) as { images?: GalleryImage[]; error?: string };
      if (!res.ok || !json.images) throw new Error(json.error ?? `upload ${res.status}`);
      startTransition(() => setImages((cur) => [...cur, ...json.images!].slice(0, 12)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input type="hidden" name="images" value={JSON.stringify(images.map((i) => i.name))} />

      <p className="label">Images · {images.length} (first is the primary)</p>

      <div className="mt-2 flex flex-wrap gap-3">
        {images.map((img, i) => (
          <figure key={img.name + i} className={`relative w-24 border ${i === 0 ? "border-brass" : "border-line"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" className="h-28 w-full bg-ivory-deep object-contain p-1" />
            <figcaption className="flex items-center justify-between px-1 py-1 text-[0.6rem] text-taupe">
              <span>{i === 0 ? "primary" : `#${i + 1}`}</span>
              <span className="flex gap-1">
                {i > 0 ? (
                  <button
                    type="button"
                    title="Make primary"
                    onClick={() => setImages((cur) => [cur[i], ...cur.filter((_, j) => j !== i)])}
                    className="hover:text-ink"
                  >
                    ↑
                  </button>
                ) : null}
                <button
                  type="button"
                  title="Remove"
                  onClick={() => setImages((cur) => cur.filter((_, j) => j !== i))}
                  className="hover:text-ink"
                >
                  ×
                </button>
              </span>
            </figcaption>
          </figure>
        ))}

        <label className="flex h-[7.5rem] w-24 cursor-pointer flex-col items-center justify-center border border-dashed border-line text-center text-[0.6rem] text-taupe hover:border-ink hover:text-ink">
          {busy ? "uploading…" : "+ add"}
          <span className="mt-1 px-1 leading-tight">JPG/PNG/WEBP, up to 8 at once</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            disabled={busy}
            onChange={(e) => upload(e.target.files)}
          />
        </label>
      </div>

      {error ? <p className="mt-2 text-xs text-brass">{error}</p> : null}
      <p className="mt-2 text-xs text-taupe">
        Upload several at once; the first image is the primary. Use ↑ to promote, × to remove.
      </p>
    </div>
  );
}
