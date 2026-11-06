import Link from "next/link";
import { AUDIT_PAGE_SIZE, listAudit } from "@/lib/audit";
import { requireManager } from "@/lib/auth";

export default async function AdminAudit({ searchParams }: { searchParams: Promise<{ action?: string; page?: string }> }) {
  await requireManager();
  const sp = await searchParams;
  const action = sp.action || undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total, pages, actions } = await listAudit({ action, page });

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ action, page: String(page), ...over })) if (v) p.set(k, v);
    return `/admin/audit?${p}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-3xl font-light">Audit log</h1>
        <p className="label">{total.toLocaleString("en-US")} · page {page} · {AUDIT_PAGE_SIZE}/page</p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href={qs({ action: undefined, page: "1" })} className={`border px-3 py-1.5 text-xs ${!action ? "border-ink bg-ink text-ivory" : "border-line text-ink-soft hover:border-ink"}`}>all</Link>
        {actions.map((a) => (
          <Link key={a} href={qs({ action: a, page: "1" })} className={`border px-3 py-1.5 text-xs ${action === a ? "border-ink bg-ink text-ivory" : "border-line text-ink-soft hover:border-ink"}`}>{a}</Link>
        ))}
      </div>

      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="label py-2 font-normal">When</th>
            <th className="label py-2 font-normal">Actor</th>
            <th className="label py-2 font-normal">Action</th>
            <th className="label py-2 font-normal">Target</th>
            <th className="label py-2 font-normal">Detail</th>
          </tr>
        </thead>
        <tbody>
          {items.map((l) => (
            <tr key={l.id} className="border-b border-line/60 align-top">
              <td className="py-2 whitespace-nowrap text-taupe">{l.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
              <td className="py-2">{l.actorEmail}</td>
              <td className="py-2 text-ink-soft">{l.action}</td>
              <td className="py-2 text-taupe">
                {l.targetType}
                {l.targetId ? (
                  <>
                    {" · "}
                    {l.targetType === "order" ? (
                      <Link href={`/admin/orders/${l.targetId}`} className="link-underline">{l.targetId.slice(0, 8)}</Link>
                    ) : l.targetType === "product" ? (
                      <Link href={`/admin/products/${l.targetId}`} className="link-underline">{l.targetId}</Link>
                    ) : (
                      l.targetId.slice(0, 8)
                    )}
                  </>
                ) : null}
              </td>
              <td className="py-2 text-taupe">{l.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {!items.length ? <p className="mt-6 text-sm text-taupe">Nothing recorded yet.</p> : null}

      {pages > 1 ? (
        <nav className="mt-8 flex items-center justify-between">
          <Link href={qs({ page: String(page - 1) })} aria-disabled={page <= 1} className={`label ${page <= 1 ? "pointer-events-none opacity-40" : "hover:text-ink"}`}>← Newer</Link>
          <span className="label">{page} / {pages}</span>
          <Link href={qs({ page: String(page + 1) })} aria-disabled={page >= pages} className={`label ${page >= pages ? "pointer-events-none opacity-40" : "hover:text-ink"}`}>Older →</Link>
        </nav>
      ) : null}
    </div>
  );
}
