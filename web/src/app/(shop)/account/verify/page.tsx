import Link from "next/link";
import { verifyEmailAction } from "@/actions/account";

export const metadata = { title: "Verify email" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-5 py-16 sm:px-8">
      <p className="label">Account</p>
      <h1 className="mt-3 font-serif text-3xl font-light">Verify email</h1>

      {token ? (
        <form action={verifyEmailAction} className="mt-8">
          <input type="hidden" name="token" value={token} />
          <button className="w-full border border-ink px-6 py-3 text-[0.7rem] uppercase tracking-[0.18em] hover:bg-ink hover:text-ivory">
            Confirm this address
          </button>
        </form>
      ) : (
        <p className="mt-6 text-sm text-brass-text">That link is invalid or has expired.</p>
      )}

      <p className="mt-6 text-sm text-taupe">
        <Link href="/account" className="link-underline text-ink">Back to account</Link>
      </p>
    </div>
  );
}
