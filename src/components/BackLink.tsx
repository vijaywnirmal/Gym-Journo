import Link from "next/link";
import Icon from "@/components/Icon";

// Link back to the parent screen, shown above a sub-page's title.
export default function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-ml-1.5 mb-2 inline-flex h-8 items-center gap-0.5 rounded-lg pr-2 pl-0.5 text-sm font-medium text-label-2 hover:bg-fill hover:text-label"
    >
      <Icon name="chevronLeft" className="size-[18px]" strokeWidth={2} />
      {label}
    </Link>
  );
}
