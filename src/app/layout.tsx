import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { AdSenseGuard } from "@/components/ads/adsense-guard";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Clipwave — Turn long videos into viral shorts with AI",
    template: "%s · Clipwave",
  },
  description:
    "Clipwave analyses your YouTube or Kick video, finds the most clippable moments, cuts them into vertical shorts with animated captions, and writes the titles, descriptions and hashtags for you.",
  keywords: [
    "AI video clipping",
    "YouTube to shorts",
    "Kick VOD clips",
    "auto captions",
    "viral clip generator",
  ],
  openGraph: {
    title: "Clipwave — Turn long videos into viral shorts with AI",
    description:
      "Paste a YouTube or Kick link. Get ready-to-post vertical clips with animated subtitles and SEO-optimised metadata.",
    type: "website",
  },
  icons: {
    icon: [
      {
        url:
          "data:image/svg+xml," +
          encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6D5EF8"/><stop offset="1" stop-color="#38E8FF"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="#070812"/><path d="M20 18h9v11l10-11h10L36 33l13 13H38L29 37v9h-9z" fill="url(#g)"/></svg>`,
          ),
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#05060d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable} dark`} suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <ToastProvider>
          <AdSenseGuard>{children}</AdSenseGuard>
        </ToastProvider>
      </body>
    </html>
  );
}
