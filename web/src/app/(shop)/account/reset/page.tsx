import Link from "next/link";
import { resetAction } from "@/actions/account";

export const metadata = { title: "New password" };

const MESSAGES: Record<string, string> = {
  format: "Password must be at least 8 characters.",
  expired: "That link was already used or has expired — request a new one.",
};

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-5 py-16 sm:px-8">
      <p className="label">Account</p>
      <h1 className="mt-3 font-serif text-3xl font-light">New password</h1>

      {token ? (
        <form action={resetAction} className="mt-8 space-y-4">
          <input type="hidden" name="token" value={token} />
          <label className="block">
            <span className="label">Password (8+ characters)</span>
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className="mt-2 w-full border border-line bg-transparent px-3 py-2.5 text-sm focus:border-ink focus:outline-none" />
          </label>
          {error ? <p className="text-sm text-brass">{MESSAGES[error] ?? "Check your password."}</p> : null}
          <button className="w-full border border-ink px-6 py-3 text-[0.7rem] uppercase tracking-[0.18em] hover:bg-ink hover:text-ivory">
            Save password
          </button>
        </form>
      ) : (
        <p className="mt-6 text-sm text-brass">{MESSAGES[error ?? "expired"]}</p>
      )}

      <p className="mt-6 text-sm text-taupe">
        <Link href="/account/forgot" className="link-underline text-ink">Request a new link</Link>
      </p>
    </div>
  );
}
