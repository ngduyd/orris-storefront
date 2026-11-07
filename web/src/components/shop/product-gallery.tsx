"use client";

import Image from "next/image";
import { useRef, useState } from "react";

type Img = { name: string; url: string };

/**
 * Product gallery: swipe on touch (scroll-snap, no JS needed for the gesture),
 * clickable thumbnails + prev/next on desktop. Falls back to a single image.
 */
export function ProductGallery({ images, alt }: { images: Img[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  if (!images.length) return null;

  const go = (i: number) => {
    const next = (i + images.length) % images.length;
    setIndex(next);
    trackRef.current?.children[next]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  return (
    <div>
      <div
        ref={trackRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== index && i >= 0 && i < images.length) setIndex(i);
        }}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label={`${alt} images`}
      >
        {images.map((img, i) => (
          <div key={img.name + i} className="relative aspect-4/5 w-full shrink-0 snap-center bg-ivory-deep md:aspect-square">
            <Image
              src={img.url}
              alt={`${alt} — view ${i + 1}`}
              fill
              sizes="(min-width:768px) 50vw, 100vw"
              priority={i === 0}
              className="fade-in object-contain p-10"
            />
          </div>
        ))}
      </div>

      {images.length > 1 ? (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous image"
            className="hidden size-9 place-items-center border border-line text-taupe transition-colors duration-300 ease-[var(--ease-out-soft)] hover:border-ink hover:text-ink sm:grid"
          >
            ←
          </button>

          <ul className="flex flex-1 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {images.map((img, i) => (
              <li key={`thumb-${img.name}-${i}`}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={i === index ? "true" : undefined}
                  aria-label={`View image ${i + 1}`}
                  className={`relative size-16 shrink-0 border bg-ivory-deep transition-colors duration-300 ease-[var(--ease-out-soft)] ${i === index ? "border-ink" : "border-line hover:border-taupe"}`}
                >
                  <Image src={img.url} alt="" fill sizes="64px" className="object-contain p-1" />
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next image"
            className="hidden size-9 place-items-center border border-line text-taupe transition-colors duration-300 ease-[var(--ease-out-soft)] hover:border-ink hover:text-ink sm:grid"
          >
            →
          </button>

          <p className="label shrink-0 tabular-nums">{index + 1} / {images.length}</p>
        </div>
      ) : null}
    </div>
  );
}
