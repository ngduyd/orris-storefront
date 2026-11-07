"use client";

/** window.print() needs a client component; the invoice page itself stays a server component. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="border border-ink px-6 py-2.5 text-[0.7rem] uppercase tracking-[0.18em] transition-colors duration-300 ease-[var(--ease-out-soft)] hover:bg-ink hover:text-ivory print:hidden"
    >
      Print
    </button>
  );
}
