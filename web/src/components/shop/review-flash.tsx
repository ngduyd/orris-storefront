"use client";

import { useSearchParams } from "next/navigation";

/** Product pages stay static, so the post-submit message is read on the client instead of via searchParams. */
export function ReviewFlash() {
  if (useSearchParams().get("review") !== "slow") return null;
  return <p className="mt-3 text-sm text-brass">Too many reviews in the last hour. Try again later.</p>;
}
