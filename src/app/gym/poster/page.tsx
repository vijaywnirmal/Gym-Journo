import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getSiteUrl } from "@/lib/siteUrl";
import { getAdminGym, getGymInvites } from "@/lib/gyms";
import { gymInviteUrl } from "@/lib/trainerInvites";
import PrintButton from "./PrintButton";

export const metadata: Metadata = { title: "Poster" };

// The front-desk poster: members scan the QR code to join the gym.
export default async function GymPosterPage() {
  const gym = await getAdminGym();
  if (!gym) redirect("/gym/setup");
  const [invites, siteUrl] = await Promise.all([getGymInvites(gym.id), getSiteUrl()]);
  if (!invites.member) redirect("/gym/invite");
  const url = gymInviteUrl(siteUrl, invites.member.code);
  // Black on white whatever the theme: phone cameras read that best.
  const qr = await QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });

  return (
    <main className="flex flex-col items-center px-4 pt-10 pb-10 text-center print:pt-0">
      <div className="mb-8 flex gap-2 print:hidden">
        <Link href="/gym/invite" className="flex h-10 items-center rounded-[10px] border border-separator px-4 text-sm font-semibold hover:bg-fill">
          Back
        </Link>
        <PrintButton />
      </div>
      <h1 className="text-4xl font-bold tracking-tight">{gym.name}</h1>
      <p className="mt-3 text-xl text-label-2">Scan to join us on Gym Journal</p>
      {/* The SVG is generated here from our own link, not from user input. */}
      <div className="mt-8 w-72 max-w-full rounded-2xl bg-white p-3 sm:w-96" dangerouslySetInnerHTML={{ __html: qr }} />
      <p className="mt-4 font-mono text-sm text-label-2">{url.replace(/^https?:\/\/(www\.)?/, "")}</p>
    </main>
  );
}
