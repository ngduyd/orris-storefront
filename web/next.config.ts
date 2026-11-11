import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // standalone is for the Docker image; Vercel builds its own output and rejects this option
  output: process.env.BUILD_TARGET === "docker" ? "standalone" : undefined,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  /* config options here */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// source maps are only uploaded when a token is present; without one the build stays as it was
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      widenClientFileUpload: true,
      // no proxy route: fewer moving parts, and the DSN is public anyway
      tunnelRoute: undefined,
    })
  : nextConfig;
