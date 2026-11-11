/** Shown while the catalogue query runs (cache miss): the page shell paints immediately. */
export default function ShopLoading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the collection</span>
      <div className="h-3 w-16 bg-line/70" />
      <div className="mt-5 h-9 w-56 bg-line/60" />
      <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-[4/5] w-full bg-line/40" />
            <div className="mt-4 h-3 w-3/4 bg-line/60" />
            <div className="mt-2 h-3 w-1/3 bg-line/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
