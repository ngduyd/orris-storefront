import Link from "next/link";
import { listUsers } from "@/lib/admin";
import { saveUserRoleAction } from "@/actions/admin";
import { requireManager } from "@/lib/auth";
import { usd } from "@/lib/money";

const ROLES = ["customer", "manager", "carrier"] as const;

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; page?: string }> }) {
  await requireManager();
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const role = ROLES.includes(sp.role as (typeof ROLES)[number]) ? sp.role : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total, pages } = await listUsers({ q, role, page });

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, role, page: String(page), ...over })) if (v) p.set(k, v);
    return `/admin/users?${p}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-3xl font-light">Users</h1>
        <p className="label">{total.toLocaleString("en-US")} · page {page}</p>
      </div>

      <form className="mt-6 flex flex-wrap gap-2" action="/admin/users">
        <input name="q" defaultValue={q} placeholder="Email" className="min-w-56 flex-1 border border-line bg-transparent px-3 py-2 text-sm focus:border-ink focus:outline-none" />
        {role ? <input type="hidden" name="role" value={role} /> : null}
        <button className="border border-ink px-5 py-2 text-[0.7rem] uppercase tracking-[0.18em] hover:bg-ink hover:text-ivory">Search</button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={qs({ role: undefined, page: "1" })} className={`border px-3 py-1.5 text-xs ${!role ? "border-ink bg-ink text-ivory" : "border-line text-ink-soft hover:border-ink"}`}>all</Link>
        {ROLES.map((r) => (
          <Link key={r} href={qs({ role: r, page: "1" })} className={`border px-3 py-1.5 text-xs ${role === r ? "border-ink bg-ink text-ivory" : "border-line text-ink-soft hover:border-ink"}`}>{r}</Link>
        ))}
      </div>

      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="label py-2 font-normal">Email</th>
            <th className="label py-2 font-normal">Orders</th>
            <th className="label py-2 text-right font-normal">Spent</th>
            <th className="label py-2 font-normal">Verified</th>
            <th className="label py-2 font-normal">Role</th>
          </tr>
        </thead>
        <tbody>
          {items.map((u) => (
            <tr key={u.id} className="border-b border-line/60">
              <td className="py-3">
                {u.email}
                <span className="ml-2 text-xs text-taupe">{u.provider ?? "password"}{u.name ? ` · ${u.name}` : ""}</span>
              </td>
              <td className="py-3 text-taupe">{u.orders}</td>
              <td className="py-3 text-right">{usd(u.spent)}</td>
              <td className="py-3 text-taupe">{u.verified ? "yes" : "no"}</td>
              <td className="py-3">
                <form action={saveUserRoleAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={u.id} />
                  <select name="role" defaultValue={u.role} className="border border-line bg-transparent px-2 py-1 text-xs focus:border-ink focus:outline-none">
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button className="label min-h-6 text-brass hover:text-ink">Save</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!items.length ? <p className="mt-6 text-sm text-taupe">No match.</p> : null}

      {pages > 1 ? (
        <nav className="mt-8 flex items-center justify-between">
          <Link href={qs({ page: String(page - 1) })} aria-disabled={page <= 1} className={`label ${page <= 1 ? "pointer-events-none opacity-40" : "hover:text-ink"}`}>← Prev</Link>
          <span className="label">{page} / {pages}</span>
          <Link href={qs({ page: String(page + 1) })} aria-disabled={page >= pages} className={`label ${page >= pages ? "pointer-events-none opacity-40" : "hover:text-ink"}`}>Next →</Link>
        </nav>
      ) : null}
    </div>
  );
}
