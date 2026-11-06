import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppNav from "@/components/AppNav";
import AppFrame from "@/components/AppFrame";
import TimezoneSync from "@/components/TimezoneSync";
import OfflineBanner from "@/components/OfflineBanner";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { getUserTimeZone } from "@/lib/userDate";
import { getMyTrainerProfile } from "@/lib/trainers";
import { getAdminGym } from "@/lib/gyms";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const DESCRIPTION = "Plan your workouts and log what you actually do.";

export const metadata: Metadata = {
  // Link previews need absolute image URLs.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000"),
  // Each page sets its own title, so screen readers announce where a navigation landed.
  title: { default: "GymJourno", template: "%s · GymJourno" },
  description: DESCRIPTION,
  // What WhatsApp, Instagram and others show for a shared link (the image is opengraph-image.tsx).
  openGraph: { siteName: "GymJourno", type: "website", title: "GymJourno", description: DESCRIPTION },
  twitter: { card: "summary_large_image" },
  appleWebApp: { capable: true, title: "GymJourno", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0d" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [{ signedIn, timeZone }, trainer, gym] = await Promise.all([getUserTimeZone(), getMyTrainerProfile(), getAdminGym()]);
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-label">
        {/* First stop for keyboard users, past the navigation. */}
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-popover"
        >
          Skip to content
        </a>
        <OfflineBanner />
        <AppNav isTrainer={trainer !== null} isGymAdmin={gym !== null} signedIn={signedIn} />
        <AppFrame signedIn={signedIn}>{children}</AppFrame>
        {signedIn && <TimezoneSync stored={timeZone} />}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
