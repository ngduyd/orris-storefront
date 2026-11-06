import { salesStats } from "@/lib/admin";
import { requireManager } from "@/lib/auth";
import { usd } from "@/lib/money";

export default async function AdminStats() {
  await requireManager();
  const { totals, daily, topBrands } = await salesStats();
  const max = Math.max(1, ...daily.map((d) => d.revenue));

  return (
    <div>
      <h1 className="font-serif text-3xl font-light">Sales</h1>

      <div className="mt-8 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
        {[
          { label: "Revenue (paid)", value: usd(totals.revenue) },
          { label: "Paid orders", value: String(totals.paidOrders) },
          { label: "Avg order", value: usd(totals.avgOrder) },
          { label: "Open orders", value: String(totals.openOrders) },
        ].map((c) => (
          <div key={c.label} className="bg-ivory px-4 py-5">
            <p className="label">{c.label}</p>
            <p className="mt-2 font-serif text-2xl font-light">{c.value}</p>
          </div>
        ))}
      </div>

      <h2 className="label mt-12">Last 14 days</h2>
      {daily.length ? (
        <table className="mt-4 w-full border-collapse text-sm">
          <tbody>
            {daily.map((d) => (
              <tr key={d.day} className="border-b border-line/60">
                <td className="w-28 py-2 text-taupe">{d.day}</td>
                <td className="py-2">
                  <div className="h-2 bg-ivory-deep">
                    <div className="h-2 bg-brass" style={{ width: `${Math.round((d.revenue / max) * 100)}%` }} />
                  </div>
                </td>
                <td className="w-20 py-2 text-right text-taupe">{d.orders}</td>
                <td className="w-24 py-2 text-right">{usd(d.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-4 text-sm text-taupe">No orders in the last 14 days.</p>
      )}

      <h2 className="label mt-12">Top houses by revenue</h2>
      {topBrands.length ? (
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="label py-2 font-normal">House</th>
              <th className="label py-2 text-right font-normal">Units</th>
              <th className="label py-2 text-right font-normal">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {topBrands.map((b) => (
              <tr key={b.brand} className="border-b border-line/60">
                <td className="py-2">{b.brand}</td>
                <td className="py-2 text-right text-taupe">{b.units}</td>
                <td className="py-2 text-right">{usd(b.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-4 text-sm text-taupe">No data yet — sales are counted on paid orders.</p>
      )}
    </div>
  );
}
