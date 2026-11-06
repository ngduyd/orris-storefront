import { googleEnabled } from "@/lib/google";

/** Nút Google là link thường: không cần JS, không cần client component. */
export function GoogleButton({ next }: { next: string }) {
  if (!googleEnabled) return null;
  return (
    <>
      <a
        href={`/api/auth/google/start?next=${encodeURIComponent(next)}`}
        className="mt-8 flex w-full items-center justify-center gap-3 border border-line px-6 py-3 text-[0.7rem] uppercase tracking-[0.18em] transition-colors duration-300 ease-[var(--ease-out-soft)] hover:border-ink"
      >
        <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6C12.3 13.2 17.6 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-2.8-.4-4.1H24v7.8h12.5c-.3 2.1-1.6 5.2-4.6 7.3l7.6 5.9c4.5-4.2 6.6-10.3 6.6-16.9z" />
          <path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C.9 16.5 0 20.2 0 24s.9 7.5 2.6 10.7l7.8-6z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.5-5.8l-7.6-5.9c-2 1.4-4.7 2.4-7.9 2.4-6.4 0-11.7-3.7-13.6-8.8l-7.8 6C6.5 42.6 14.6 48 24 48z" />
        </svg>
        Continue with Google
      </a>
      <p className="mt-4 text-center text-xs text-taupe">or</p>
    </>
  );
}
