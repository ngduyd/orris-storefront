import { redirect } from "next/navigation";
import { loginAction } from "@/actions/auth";
import { currentAdmin } from "@/lib/auth";

export const metadata = { title: "Sign in · ORRIS admin" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentAdmin()) redirect("/admin");
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6">
      <p className="label">ORRIS · Admin</p>
      <h1 className="mt-3 font-serif text-3xl font-light">Sign in</h1>
      <form action={loginAction} className="mt-8 space-y-4">
        <label className="block">
          <span className="label">Email</span>
          <input name="email" type="email" required autoComplete="username" className="mt-2 w-full border border-line bg-transparent px-3 py-2.5 text-sm focus:border-ink focus:outline-none" />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input name="password" type="password" required autoComplete="current-password" className="mt-2 w-full border border-line bg-transparent px-3 py-2.5 text-sm focus:border-ink focus:outline-none" />
        </label>
        {error === "slow" ? (
          <p className="text-sm text-brass">Too many attempts. Wait 15 minutes.</p>
        ) : error ? (
          <p className="text-sm text-brass">Wrong email or password.</p>
        ) : null}
        <button className="w-full border border-ink px-6 py-3 text-[0.7rem] uppercase tracking-[0.18em] transition-colors duration-300 ease-[var(--ease-out-soft)] hover:bg-ink hover:text-ivory">
          Sign in
        </button>
      </form>
    </main>
  );
}
