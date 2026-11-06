import Link from "next/link";
import { customerLogoutAction, resendVerifyAction } from "@/actions/account";
import { listOrdersFor } from "@/lib/account";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { usd } from "@/lib/money";

export const metadata = { title: "Your account" };
export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ verify?: string }> }) {
  const user = await requireUser();
  const { verify } = await searchParams;
  const [me] = await db.select({ verified: users.emailVerifiedAt }).from(users).where(eq(users.id, user.id)).limit(1);
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
          <p className="text-sm text-ink-soft">Email chưa xác thực.</p>
          <form action={resendVerifyAction}>
            <button className="label min-h-6 text-brass hover:text-ink">
              {verify === "sent" ? "Đã gửi lại — kiểm tra hộp thư" : "Gửi lại link"}
            </button>
          </form>
        </div>
      )}

      {verify === "ok" ? <p className="mt-6 text-sm text-brass">Email đã xác thực.</p> : null}
      {verify === "expired" ? <p className="mt-6 text-sm text-brass">Link xác thực đã hết hạn.</p> : null}

      <p className="mt-8 flex gap-6">
        <Link href="/account/wishlist" className="label link-underline text-brass hover:text-ink">Wishlist →</Link>
      </p>

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
