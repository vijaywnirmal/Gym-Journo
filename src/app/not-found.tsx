import Link from "next/link";
import PageHeader from "@/components/PageHeader";

// A page that doesn't exist, or one this person can no longer open (a client who removed their
// trainer, a member who left the gym).
export default function NotFound() {
  return (
    <main className="px-4 pt-6 pb-10 md:px-8 md:pt-10">
      <PageHeader title="This page isn't available" subtitle="It may have moved, or you may no longer have access to it." />
      <Link href="/" className="text-sm font-semibold text-link">
        Go to Today
      </Link>
    </main>
  );
}
