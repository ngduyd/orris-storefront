import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center px-6">
      <p className="label">Orris</p>
      <h1 className="mt-4 font-display text-4xl tracking-tight">This page is not in the archive.</h1>
      <p className="mt-3 text-sm text-taupe">The house, the bottle or the order you were looking for does not exist.</p>
      <div className="mt-8 flex gap-4">
        <Link href="/shop" className="label link-underline">Browse the collection</Link>
        <Link href="/" className="label link-underline">Home</Link>
      </div>
    </main>
  );
}
