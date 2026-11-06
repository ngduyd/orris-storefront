import Link from "next/link";
import { forgotAction } from "@/actions/account";

export const metadata = { title: "Reset password" };

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { sent, error } = await searchParams;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-5 py-16 sm:px-8">
      <p className="label">Account</p>
      <h1 className="mt-3 font-serif text-3xl font-light">Reset password</h1>

      {sent ? (
        <p className="mt-6 text-sm text-ink-soft">
          If an account exists for that email, a reset link is on its way. The link expires in 1 hour.
        </p>
      ) : (
        <form action={forgotAction} className="mt-8 space-y-4">
          <label className="block">
            <span className="label">Email</span>
            <input name="email" type="email" required autoComplete="email" className="mt-2 w-full border border-line bg-transparent px-3 py-2.5 text-sm focus:border-ink focus:outline-none" />
          </label>
          {error ? <p className="text-sm text-brass">That email doesn't look valid.</p> : null}
          <button className="w-full border border-ink px-6 py-3 text-[0.7rem] uppercase tracking-[0.18em] hover:bg-ink hover:text-ivory">
            Send reset link
          </button>
        </form>
      )}

      <p className="mt-6 text-sm text-taupe">
        <Link href="/account/login" className="link-underline text-ink">Back to sign in</Link>
      </p>
    </div>
  );
}
