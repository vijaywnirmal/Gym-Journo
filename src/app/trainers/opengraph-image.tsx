import { BRAND_IMAGE_SIZE, brandImage } from "@/lib/brandImage";

export const alt = "GymJourno for trainers";
export const size = BRAND_IMAGE_SIZE;
export const contentType = "image/png";

export default function Image() {
  return brandImage({
    eyebrow: "For trainers and creators",
    title: "Your clients' training in one place, not in WhatsApp.",
    subtitle: "Plan their days, see who trained, and track fees.",
  });
}
