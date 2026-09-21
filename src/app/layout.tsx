import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import TimezoneSync from "@/components/TimezoneSync";
import { getUserTimeZone } from "@/lib/userDate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gym Journal & Scheduler",
  description: "Plan your workouts and log what you actually do.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0a0a",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { signedIn, timeZone } = await getUserTimeZone();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">
        <div className="mx-auto w-full max-w-md flex-1 pb-20">{children}</div>
        <BottomNav />
        {signedIn && <TimezoneSync stored={timeZone} />}
      </body>
    </html>
  );
}
