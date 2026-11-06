export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-[3px] ${className}`}>
      <span className="font-serif text-[1.4rem] leading-none tracking-[0.22em] uppercase">Orris</span>
      <span aria-hidden className="mb-[2px] size-[3px] rounded-full bg-brass translate-y-[-1px]" />
    </span>
  );
}
