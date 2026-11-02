import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import SignOutButton from "@/components/SignOutButton";
import { getProfile } from "@/lib/queries";
import ReactivateButton from "./ReactivateButton";

export const metadata: Metadata = { title: "Account disabled" };

export default async function AccountDisabledPage() {
  const profile = await getProfile();
  if (!profile?.disabled_at) redirect("/");
  return (
    <main className="px-4 pt-6 pb-10 md:px-8 md:pt-10">
      <PageHeader
        title="Your account is disabled"
        subtitle="Nothing was deleted. Turn it back on to carry on where you left off."
      />
      <div className="flex items-start gap-3">
        <ReactivateButton />
        <SignOutButton />
      </div>
    </main>
  );
}
