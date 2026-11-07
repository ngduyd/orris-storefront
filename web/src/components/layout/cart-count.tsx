"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

/** Item count badge: reads the `cart_n` cookie so the header stays static. */
const subscribe = () => () => {};
const read = () => Number(document.cookie.match(/(?:^|; )cart_n=(\d+)/)?.[1] ?? 0);

export function CartCount() {
  usePathname(); // a new snapshot is read on every navigation
  const n = useSyncExternalStore(subscribe, read, () => 0);
  if (!n) return null;
  return <span className="ml-1.5 text-brass">{n}</span>;
}
