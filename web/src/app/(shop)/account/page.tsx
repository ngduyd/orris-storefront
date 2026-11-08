import Link from "next/link";
import { changePasswordAction, customerLogoutAction, resendVerifyAction, setPasswordAction } from "@/actions/account";
import { listOrdersFor } from "@/lib/account";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { usd } from "@/lib/money";

export const metadata = { title: "Your account" };
export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ verify?: string; pw?: string }> }) {
  const user = await requireUser();
  const { verify, pw } = await searchParams;
  const [me] = await db
    .select({ verified: users.emailVerifiedAt, hasPassword: sql<boolean>`${users.passwordHash} is not null` })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  const rows = await listOrdersFor(user);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Account</p>
          <h1 className="mt-2 font-serif text-4xl font-light">{user.email}</h1>
        </div>
        <form action={customerLogoutAction}>
          <button className="label min-h-6 hover:text-ink">Sign out</button>
        </form>
      </div>

      {me?.verified ? null : (
        <div className="mt-8 flex flex-wrap items-center gap-4 border border-line bg-ivory-deep px-4 py-3">
          <p className="text-sm text-ink-soft">Your email is not verified yet.</p>
          <form action={resendVerifyAction}>
            <button className="label min-h-6 text-brass hover:text-ink">
              {verify === "sent" ? "Sent again — check your inbox" : "Resend link"}
            </button>
          </form>
        </div>
      )}

      {verify === "slow" ? (
        <p role="alert" className="mt-6 text-sm text-brass">
          Verification email already sent — check your inbox, or try again in an hour.
        </p>
      ) : null}
      {verify === "ok" ? <p className="mt-6 text-sm text-brass">Email verified.</p> : null}
      {verify === "expired" ? <p className="mt-6 text-sm text-brass">That verification link has expired.</p> : null}

      <p className="mt-8 flex gap-6">
        <Link href="/account/wishlist" className="label link-underline text-brass hover:text-ink">Wishlist →</Link>
      </p>

      <form action={me?.hasPassword ? changePasswordAction : setPasswordAction} className="mt-12 max-w-sm space-y-4 border-t border-line pt-8">
        <p className="label">{me?.hasPassword ? "Change password" : "Set a password"}</p>
        {me?.hasPassword ? (
          <input
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Current password"
            className="w-full border border-line bg-transparent px-3 py-2.5 text-sm focus:border-ink focus:outline-none"
          />
        ) : (
          <p className="text-xs leading-relaxed text-taupe">
            This account signs in with Google. Set a password to also sign in with your email.
          </p>
        )}
        <input
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="New password (min 8)"
          className="w-full border border-line bg-transparent px-3 py-2.5 text-sm focus:border-ink focus:outline-none"
        />
        {pw === "ok" ? (
          <p className="text-sm text-brass">Password changed. Other sessions were signed out.</p>
        ) : pw === "wrong" ? (
          <p role="alert" className="text-sm text-brass">Current password is wrong.</p>
        ) : pw === "short" ? (
          <p role="alert" className="text-sm text-brass">New password needs at least 8 characters.</p>
        ) : pw === "exists" ? (
          <p className="text-sm text-brass">This account already has a password — use the change form.</p>
        ) : pw === "slow" ? (
          <p role="alert" className="text-sm text-brass">Too many password changes — try again in an hour.</p>
        ) : null}
        <button className="border border-ink px-5 py-2 text-[0.7rem] uppercase tracking-[0.18em] hover:bg-ink hover:text-ivory">
          {me?.hasPassword ? "Save password" : "Set password"}
        </button>
      </form>

      <h2 className="label mt-12">Orders</h2>

      {rows.length ? (
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="label py-2 font-normal">Order</th>
              <th className="label py-2 font-normal">Status</th>
              <th className="label py-2 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="border-b border-line/60">
                <td className="py-3">
                  <Link href={`/checkout/${o.id}`} className="link-underline">{o.id.slice(0, 8)}</Link>
                  <span className="ml-2 text-xs text-taupe">{o.createdAt.toISOString().slice(0, 10)}</span>
                </td>
                <td className="py-3 text-taupe">{o.paid ? "paid" : o.status}</td>
                <td className="py-3 text-right">{usd(o.totalMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-4 text-sm text-taupe">
          No orders yet.{" "}
          <Link href="/shop" className="link-underline text-ink">Browse the collection</Link>
        </p>
      )}
    </div>
  );
}
