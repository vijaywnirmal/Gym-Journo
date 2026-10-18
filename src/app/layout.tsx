import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import TimezoneSync from "@/components/TimezoneSync";
import OfflineBanner from "@/components/OfflineBanner";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { getUserTimeZone } from "@/lib/userDate";

export const metadata: Metadata = {
  title: "Gym Journal & Scheduler",
  description: "Plan your workouts and log what you actually do.",
  appleWebApp: { capable: true, title: "Gym Journo", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { signedIn, timeZone } = await getUserTimeZone();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-background text-label">
        <OfflineBanner />
        <div className="mx-auto w-full max-w-md flex-1 pt-[env(safe-area-inset-top)] pb-28">{children}</div>
        <BottomNav />
        {signedIn && <TimezoneSync stored={timeZone} />}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
