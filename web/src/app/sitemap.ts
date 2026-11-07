import type { MetadataRoute } from "next";
import { getHandles } from "@/lib/products";

/** Crawlers see the catalog as of the last daily build. */
export const revalidate = 86400;

const base = process.env.SITE_URL ?? "http://localhost:3000";

const STATIC_PAGES = ["", "/shop", "/terms", "/privacy"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const handles = await getHandles();
  return [
    ...STATIC_PAGES.map((path) => ({ url: `${base}${path}` })),
    ...handles.map(({ handle }) => ({ url: `${base}/product/${handle}` })),
  ];
}
