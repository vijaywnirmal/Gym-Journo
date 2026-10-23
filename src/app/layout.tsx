import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppNav from "@/components/AppNav";
import TimezoneSync from "@/components/TimezoneSync";
import OfflineBanner from "@/components/OfflineBanner";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { getUserTimeZone } from "@/lib/userDate";
import { getMyTrainerProfile } from "@/lib/trainers";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  // Each page sets its own title, so screen readers announce where a navigation landed.
  title: { default: "Gym Journal", template: "%s · Gym Journal" },
  description: "Plan your workouts and log what you actually do.",
  appleWebApp: { capable: true, title: "Gym Journal", statusBarStyle: "default" },
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
  const [{ signedIn, timeZone }, trainer] = await Promise.all([getUserTimeZone(), getMyTrainerProfile()]);
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
        <AppNav isTrainer={trainer !== null} />
        {/* Phones: content above the bottom bar. Wider screens: content beside the sidebar. */}
        <div className="pt-[env(safe-area-inset-top)] pb-24 md:pb-10 md:pl-60">
          <div id="content" tabIndex={-1} className="mx-auto w-full max-w-2xl outline-none">
            {children}
          </div>
        </div>
        {signedIn && <TimezoneSync stored={timeZone} />}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
