"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isPublicPage } from "@/lib/publicPages";

// Where a page's content sits. App screens: a reading-width column above the phone's bottom bar,
// beside the sidebar from tablet width. The public front door: the full width, with its own header.
export default function AppFrame({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  const pathname = usePathname();
  if (isPublicPage(pathname, signedIn)) {
    return (
      <div id="content" tabIndex={-1} className="outline-none">
        {children}
      </div>
    );
  }
  return (
    <div className="pt-[env(safe-area-inset-top)] pb-24 md:pb-10 md:pl-60">
      <div id="content" tabIndex={-1} className="mx-auto w-full max-w-2xl outline-none">
        {children}
      </div>
    </div>
  );
}
