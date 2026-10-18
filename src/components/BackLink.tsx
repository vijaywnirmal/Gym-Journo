import Link from "next/link";
import Icon from "@/components/Icon";

// iOS-style back button: chevron plus the previous screen's name, in the tint color.
export default function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="-ml-2 mb-1 inline-flex items-center gap-0.5 rounded-lg py-1 pr-2 text-base text-tint">
      <Icon name="chevronLeft" className="size-6" strokeWidth={2.25} />
      {label}
    </Link>
  );
}
