"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** Item count badge: reads the `cart_n` cookie so the header stays static. */
export function CartCount() {
  const pathname = usePathname();
  const [n, setN] = useState(0);

  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )cart_n=(\d+)/);
    setN(m ? Number(m[1]) : 0);
  }, [pathname]);

  if (!n) return null;
  return <span className="ml-1.5 text-brass">{n}</span>;
}
