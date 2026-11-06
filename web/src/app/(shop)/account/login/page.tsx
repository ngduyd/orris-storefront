import Link from "next/link";
import { customerLoginAction } from "@/actions/account";
import { GoogleButton } from "@/components/auth/google-button";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Sign in" };

export default async function AccountLogin({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; reset?: string }> }) {
  const { error, next, reset } = await searchParams;
  if (await currentUser()) redirect("/account");

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-5 py-16 sm:px-8">
      <p className="label">Account</p>
      <h1 className="mt-3 font-serif text-3xl font-light">Sign in</h1>
      <p className="mt-3 text-sm text-ink-soft">Your orders, in one place.</p>

      <GoogleButton next={next ?? "/account"} />

      <form action={customerLoginAction} className="space-y-4">
        <input type="hidden" name="next" value={next ?? "/account"} />
        <label className="block">
          <span className="label">Email</span>
          <input name="email" type="email" required autoComplete="email" className="mt-2 w-full border border-line bg-transparent px-3 py-2.5 text-sm focus:border-ink focus:outline-none" />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input name="password" type="password" required autoComplete="current-password" className="mt-2 w-full border border-line bg-transparent px-3 py-2.5 text-sm focus:border-ink focus:outline-none" />
        </label>
        {error === "slow" ? (
          <p className="text-sm text-brass">Too many attempts. Try again in 15 minutes.</p>
        ) : error === "google" ? (
          <p className="text-sm text-brass">Google sign-in is unavailable. Use email and password instead.</p>
        ) : error === "state" ? (
          <p className="text-sm text-brass">That sign-in link expired. Try again.</p>
        ) : error ? (
          <p className="text-sm text-brass">Wrong email or password.</p>
        ) : null}
        {reset ? <p className="text-sm text-taupe">Password changed — sign in again.</p> : null}
        <button className="w-full border border-ink px-6 py-3 text-[0.7rem] uppercase tracking-[0.18em] transition-colors duration-300 ease-[var(--ease-out-soft)] hover:bg-ink hover:text-ivory">
          Sign in
        </button>
      </form>

      <p className="mt-3 text-sm text-taupe">
        <Link href="/account/forgot" className="link-underline">Forgot password?</Link>
      </p>

      <p className="mt-6 text-sm text-taupe">
        No account?{" "}
        <Link href={`/account/register?next=${encodeURIComponent(next ?? "/account")}`} className="link-underline text-ink">
          Create one
        </Link>
      </p>
    </div>
  );
}
