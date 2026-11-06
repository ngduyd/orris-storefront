export function NotePyramid({ notes }: { notes: { top: string[]; mid: string[]; base: string[] } }) {
  const rows = [
    { label: "Top", items: notes.top },
    { label: "Middle", items: notes.mid },
    { label: "Base", items: notes.base },
  ].filter((r) => r.items.length);

  if (!rows.length) return null;

  return (
    <div className="border-y border-line">
      {rows.map((r) => (
        <div key={r.label} className="flex gap-6 border-b border-line py-4 last:border-b-0">
          <span className="label w-16 shrink-0 pt-1">{r.label}</span>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm capitalize text-ink-soft">
            {r.items.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
