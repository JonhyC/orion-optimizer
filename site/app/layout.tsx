import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";

import SmoothScroll from "@/components/providers/SmoothScroll";
import Cursor from "@/components/ui/Cursor";
import ScrollProgress from "@/components/ui/ScrollProgress";
import PageLoader from "@/components/ui/PageLoader";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Orion Optimizer 2.0 — Unlock Your PC's True Performance",
  description:
    "Professional Windows optimization for gamers. More FPS, less input lag, maximum performance. Every change measured, logged and fully reversible.",
  keywords: [
    "PC optimization",
    "FPS boost",
    "Windows optimization",
    "gaming performance",
    "input lag",
    "debloat Windows",
  ],
  openGraph: {
    title: "Orion Optimizer 2.0 — Unlock Your PC's True Performance",
    description:
      "More FPS. Less Input Lag. Maximum Performance. Professional Windows optimization with full rollback.",
    type: "website",
    locale: "en",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`}>
      <body className="bg-void" style={{ backgroundColor: "#000000" }}>
        <PageLoader />
        <ScrollProgress />
        <Cursor />
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
