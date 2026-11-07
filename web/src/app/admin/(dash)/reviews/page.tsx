import Link from "next/link";
import { listReviewsForAdmin } from "@/lib/admin";
import { toggleReviewHiddenAction } from "@/actions/admin";
import { requireManager } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reviews · Staff · ORRIS" };

const excerpt = (body: string) => (body.length > 120 ? `${body.slice(0, 120)}…` : body);

export default async function AdminReviews({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requireManager();
  const sp = await searchParams;
  const items = await listReviewsForAdmin();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-3xl font-light">Reviews</h1>
        <p className="label">newest {items.length}</p>
      </div>

      {sp.saved ? <p className="mt-4 text-sm text-brass">Saved.</p> : null}
      {sp.error ? <p className="mt-4 text-sm text-brass">That review no longer exists.</p> : null}

      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="label py-2 pr-6 font-normal">Product</th>
            <th className="label py-2 pr-6 font-normal">Author</th>
            <th className="label py-2 pr-6 font-normal">Rating</th>
            <th className="label py-2 pr-6 font-normal">Review</th>
            <th className="label py-2 font-normal" />
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id} className={`border-b border-line/60 align-top ${r.hidden ? "opacity-50" : ""}`}>
              <td className="py-3 pr-6">
                <Link href={`/product/${r.handle}`} className="link-underline">
                  {r.brand ? `${r.brand} · ` : ""}
                  {r.title ?? r.handle}
                </Link>
                <span className="ml-2 text-xs text-taupe">{r.createdAt.toISOString().slice(0, 10)}</span>
              </td>
              <td className="py-3 pr-6">
                {r.authorName ?? "—"}
                <span className="ml-2 text-xs text-taupe">{r.email}</span>
              </td>
              <td className="py-3 pr-6 whitespace-nowrap text-brass">{"★".repeat(r.rating)}</td>
              <td className="py-3 pr-6 text-ink-soft">{r.body ? excerpt(r.body) : <span className="text-taupe">no text</span>}</td>
              <td className="py-3">
                <form action={toggleReviewHiddenAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="hide" value={r.hidden ? "0" : "1"} />
                  <button className="label min-h-6 text-brass hover:text-ink">{r.hidden ? "Unhide" : "Hide"}</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!items.length ? <p className="mt-6 text-sm text-taupe">No reviews yet.</p> : null}
    </div>
  );
}
