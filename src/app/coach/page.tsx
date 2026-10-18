import { getProfile } from "@/lib/queries";
import { hasCoachConsent } from "@/lib/coach/consent";
import PageHeader from "@/components/PageHeader";
import { CoachConsentPrompt } from "@/app/profile/CoachConsentSection";
import CoachChat from "./CoachChat";

export default async function CoachPage() {
  const profile = await getProfile();
  const consented = hasCoachConsent(profile);

  return (
    <main className="px-4 pt-6 md:px-8 md:pt-10">
      <PageHeader
        title="Coach"
        subtitle="Explains what your training records show. It doesn't give advice or help with pain or injuries."
        back={{ href: "/", label: "Today" }}
      />
      {consented ? <CoachChat /> : <CoachConsentPrompt />}
    </main>
  );
}
