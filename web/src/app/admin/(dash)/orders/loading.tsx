/** The orders list runs a count plus a page of rows; keep the table frame while it does. */
export default function AdminOrdersLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading orders</span>
      <div className="h-3 w-16 bg-line/70" />
      <div className="mt-5 h-9 w-40 bg-line/60" />
      <div className="mt-10 h-10 w-full border border-line" />
      <div className="mt-6 space-y-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between border-b border-line/60 py-4">
            <div className="h-3 w-32 bg-line/60" />
            <div className="h-3 w-24 bg-line/40" />
            <div className="h-3 w-16 bg-line/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
