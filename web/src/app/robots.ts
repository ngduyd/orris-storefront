import type { MetadataRoute } from "next";

const base = process.env.SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/account",
        "/checkout",
        "/cart",
        "/api",
        // filtered collections are infinite permutations of the same catalogue; the sitemap lists
        // the canonical pages, and crawling /shop?page=N.. only burns database time
        "/*?*",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
