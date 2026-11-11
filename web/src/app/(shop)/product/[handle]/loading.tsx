/** Shown while one product is fetched: gallery on the left, text column on the right, same grid. */
export default function ProductLoading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the product</span>
      <div className="grid gap-10 md:grid-cols-2">
        <div className="aspect-[4/5] w-full bg-line/40" />
        <div>
          <div className="h-3 w-24 bg-line/60" />
          <div className="mt-5 h-8 w-4/5 bg-line/60" />
          <div className="mt-3 h-3 w-1/3 bg-line/40" />
          <div className="mt-8 h-3 w-20 bg-line/50" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-3 w-full bg-line/30" />
            ))}
          </div>
          <div className="mt-10 h-11 w-full border border-line" />
        </div>
      </div>
    </div>
  );
}
