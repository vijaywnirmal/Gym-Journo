import { BRAND_IMAGE_SIZE, brandImage } from "@/lib/brandImage";
import { getInvitePreview } from "@/lib/invitePreview";

// The picture under a trainer's invite link in WhatsApp and the like: who it's from (migration 0050).
export const alt = "An invite to train on GymJourno";
export const size = BRAND_IMAGE_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const invite = await getInvitePreview("trainer", code);
  if (invite?.state !== "open" || invite.kind !== "trainer") {
    return brandImage({ eyebrow: "You're invited", title: "Train on GymJourno", subtitle: "Plan your workouts and log every set." });
  }
  return brandImage({
    eyebrow: "You're invited",
    title: `Train with ${invite.name}`,
    subtitle: [invite.gymName, invite.city].filter(Boolean).join(" · ") || "Plan your workouts and log every set.",
  });
}
