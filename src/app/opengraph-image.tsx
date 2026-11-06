import { BRAND_IMAGE_SIZE, brandImage } from "@/lib/brandImage";

// The default link preview for every GymJourno page that doesn't have its own.
export const alt = "GymJourno: plan your week, log every set, see yourself get stronger";
export const size = BRAND_IMAGE_SIZE;
export const contentType = "image/png";

export default function Image() {
  return brandImage({
    title: "Plan your week. Log every set. See yourself get stronger.",
    subtitle: "A training journal for your phone. Free to start.",
  });
}
