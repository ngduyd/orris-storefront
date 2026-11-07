import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { imageUrl } from "@/lib/image";
import "./globals.css";

const serif = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const sans = Inter({ variable: "--font-inter", subsets: ["latin"] });

const BASE = process.env.SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: { default: "ORRIS — Maison de Parfum", template: "%s · ORRIS" },
  description: "A curated house of fragrance. Notes, accords and houses, edited.",
  openGraph: {
    type: "website",
    siteName: "ORRIS",
    title: "ORRIS — Maison de Parfum",
    description: "A curated house of fragrance. Notes, accords and houses, edited.",
    // Cloudinary when configured, so a shared link never points at a file the image does not ship
    images: [imageUrl("mont-blanc-mont-blanc-explorer-100ml.webp", 1200)],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
