import Link from "next/link";
import { changePasswordAction, customerLogoutAction, resendVerifyAction, setPasswordAction } from "@/actions/account";
import { countOrdersFor } from "@/lib/account";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

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
  const orderCount = await countOrdersFor(user);

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
            <button className="label min-h-6 text-brass-text hover:text-ink">
              {verify === "sent" ? "Sent again — check your inbox" : "Resend link"}
            </button>
          </form>
        </div>
      )}

      {verify === "wait" ? (
        <p role="alert" className="mt-6 text-sm text-brass-text">
          A verification email was sent a moment ago — check your inbox. You can request another in five minutes.
        </p>
      ) : null}
      {verify === "slow" ? (
        <p role="alert" className="mt-6 text-sm text-brass-text">
          Verification email already sent — check your inbox, or try again in an hour.
        </p>
      ) : null}
      {verify === "ok" ? <p className="mt-6 text-sm text-brass-text">Email verified.</p> : null}
      {verify === "expired" ? <p className="mt-6 text-sm text-brass-text">That verification link has expired.</p> : null}

      <p className="mt-8 flex gap-6">
        <Link href="/account/wishlist" className="label link-underline text-brass-text hover:text-ink">Wishlist →</Link>
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
          <p className="text-sm text-brass-text">Password changed. Other sessions were signed out.</p>
        ) : pw === "wrong" ? (
          <p role="alert" className="text-sm text-brass-text">Current password is wrong.</p>
        ) : pw === "short" ? (
          <p role="alert" className="text-sm text-brass-text">New password needs at least 8 characters.</p>
        ) : pw === "exists" ? (
          <p className="text-sm text-brass-text">This account already has a password — use the change form.</p>
        ) : pw === "slow" ? (
          <p role="alert" className="text-sm text-brass-text">Too many password changes — try again in an hour.</p>
        ) : null}
        <button className="border border-ink px-5 py-2 text-[0.7rem] uppercase tracking-[0.18em] hover:bg-ink hover:text-ivory">
          {me?.hasPassword ? "Save password" : "Set password"}
        </button>
      </form>

      <h2 className="label mt-12">Orders</h2>
      <p className="mt-4 text-sm text-ink-soft">
        {orderCount ? `${orderCount} order${orderCount === 1 ? "" : "s"} on this account.` : "No orders yet."}{" "}
        {/* always reachable: the history page carries its own empty state */}
        <Link href="/account/orders" className="link-underline text-ink">See every order</Link>
        {orderCount ? null : (
          <>
            {" or "}
            <Link href="/shop" className="link-underline text-ink">browse the collection</Link>
          </>
        )}
      </p>
    </div>
  );
}
