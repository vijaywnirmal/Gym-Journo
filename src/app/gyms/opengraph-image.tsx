import { BRAND_IMAGE_SIZE, brandImage } from "@/lib/brandImage";

export const alt = "GymJourno for gyms";
export const size = BRAND_IMAGE_SIZE;
export const contentType = "image/png";

export default function Image() {
  return brandImage({
    eyebrow: "For gyms",
    title: "Members, trainers and fees in one place.",
    subtitle: "Members join with a QR code at your front desk.",
  });
}
