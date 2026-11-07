"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center px-6">
      <p className="label">Orris</p>
      <h1 className="mt-4 font-display text-4xl tracking-tight">Something went wrong.</h1>
      <p className="mt-3 text-sm text-taupe">The page could not be rendered. Nothing was charged and your bag is intact.</p>
      <button onClick={reset} className="label link-underline mt-8">Try again</button>
    </main>
  );
}
