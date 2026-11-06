import { BRAND_IMAGE_SIZE, brandImage } from "@/lib/brandImage";
import { getInvitePreview, placeOf } from "@/lib/invitePreview";

// The picture under a gym's invite link in WhatsApp and the like: which gym it's from (migration 0050).
export const alt = "An invite to a gym on GymJourno";
export const size = BRAND_IMAGE_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const invite = await getInvitePreview("gym", code);
  if (invite?.state !== "open" || invite.kind !== "gym") {
    return brandImage({ eyebrow: "You're invited", title: "Join your gym on GymJourno", subtitle: "Plan your workouts and log every set." });
  }
  const title = invite.role === "trainer" ? `Train at ${invite.name}` : invite.role === "admin" ? `Help run ${invite.name}` : `Join ${invite.name}`;
  return brandImage({
    eyebrow: "You're invited",
    title,
    subtitle: placeOf(invite.area, invite.city) ?? "Plan your workouts and log every set.",
  });
}
