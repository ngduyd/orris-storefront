import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";

const serif = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const sans = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "ORRIS — Maison de Parfum", template: "%s · ORRIS" },
  description: "A curated house of fragrance. Notes, accords and houses, edited.",
  openGraph: {
    type: "website",
    siteName: "ORRIS",
    title: "ORRIS — Maison de Parfum",
    description: "A curated house of fragrance. Notes, accords and houses, edited.",
    images: ["/images/mont-blanc-mont-blanc-explorer-100ml.webp"],
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
