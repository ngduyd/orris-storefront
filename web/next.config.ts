import type { NextConfig } from "next";

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

export default nextConfig;
