import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import "./shop.css";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import DetailSheet from "@/components/DetailSheet";
import Toast from "@/components/Toast";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-inter", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: { default: "niche", template: "%s · niche" },
  description:
    "Clothing, shoes and accessories with low hype and high regard. Curated by AI, approved by people, sold elsewhere.",
  openGraph: { siteName: "niche", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable}`}>
      <body>
        <Suspense fallback={<div style={{ height: "var(--top)" }} />}>
          <TopBar />
        </Suspense>
        <main>{children}</main>
        <Footer />
        <BottomNav />
        <Suspense fallback={null}>
          <DetailSheet />
        </Suspense>
        <Toast />
      </body>
    </html>
  );
}
