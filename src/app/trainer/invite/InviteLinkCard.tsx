"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { whatsappShareUrl } from "@/lib/trainerInvites";
import { createInviteLink } from "./actions";

// expiresOn is formatted on the server, in the trainer's time zone, so it renders the same in the browser.
export default function InviteLinkCard({ invite }: { invite: { url: string; expiresOn: string } | null }) {
  const url = invite?.url ?? null;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [confirmingNew, setConfirmingNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function makeLink() {
    setError(null);
    startTransition(async () => {
      const result = await createInviteLink();
      if (result.error) {
        setError(result.error);
        return;
      }
      setConfirmingNew(false);
      setCopied(false);
      router.refresh();
    });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("Couldn't copy. Press and hold the link to copy it.");
    }
  }

  if (!invite || !url) {
    return (
      <section className="card flex flex-col gap-3 p-4">
        <button
          type="button"
          onClick={makeLink}
          disabled={pending}
          className="h-11 rounded-[10px] bg-accent px-4 text-[15px] font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Making a link…" : "Make an invite link"}
        </button>
        {error && <p role="alert" className="text-sm text-red">{error}</p>}
      </section>
    );
  }

  return (
    <section className="card flex flex-col gap-3 p-4">
      {/* Shown without https://www. so it fits a phone on one line; copying and sharing use the full link. */}
      <p className="select-all break-all rounded-[10px] bg-fill px-3 py-2.5 font-mono text-sm">
        {url.replace(/^https?:\/\/(www\.)?/, "")}
      </p>
      <p className="text-xs text-label-2">Works until {invite.expiresOn}.</p>
      <div className="flex flex-wrap gap-2">
        <a
          href={whatsappShareUrl(`Join me on Gym Journal: ${url}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-10 items-center gap-1.5 rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover"
        >
          <Icon name="share" className="size-4" strokeWidth={2} />
          Share on WhatsApp
        </a>
        <button
          type="button"
          onClick={copy}
          className="h-10 rounded-[10px] border border-separator px-4 text-sm font-semibold hover:bg-fill"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>

      {confirmingNew ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-separator pt-3">
          <p className="flex-1 text-sm text-label-2">Your current link will stop working.</p>
          <button
            type="button"
            onClick={() => setConfirmingNew(false)}
            className="h-8 rounded-lg px-2.5 text-sm font-medium hover:bg-fill"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={makeLink}
            disabled={pending}
            className="h-8 rounded-lg border border-separator px-2.5 text-sm font-semibold hover:bg-fill disabled:opacity-50"
          >
            Make new link
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmingNew(true)}
          className="self-start text-sm font-medium text-link"
        >
          Make a new link
        </button>
      )}
      {error && <p role="alert" className="text-sm text-red">{error}</p>}
    </section>
  );
}
