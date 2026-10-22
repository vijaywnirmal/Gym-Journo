"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { whatsappChatUrl } from "@/lib/trainerInvites";
import type { MyTrainer } from "@/lib/types";
import { removeTrainer } from "./trainerActions";

// since is formatted on the server, in the person's time zone, so it renders the same in the browser.
export default function YourTrainerSection({ myTrainer, since }: { myTrainer: MyTrainer; since: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { trainer } = myTrainer;
  const details = [trainer.gym_name, trainer.city, `since ${since}`]
    .filter(Boolean)
    .join(" · ");

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeTrainer(myTrainer.linkId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <>
      <h2 className="section-title mt-8">Your trainer</h2>
      <section className="card px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{trainer.display_name}</p>
            <p className="text-sm text-label-2">{details}</p>
          </div>
          {trainer.whatsapp && (
            <a
              href={whatsappChatUrl(trainer.whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 shrink-0 rounded-lg border border-separator px-3 text-sm font-semibold leading-8 hover:bg-fill"
            >
              WhatsApp
            </a>
          )}
          {!confirming && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="h-8 shrink-0 rounded-lg px-2.5 text-sm font-medium text-label-2 hover:bg-fill"
            >
              Remove
            </button>
          )}
        </div>
        {confirming && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-separator pt-3">
            <p className="flex-1 text-sm text-label-2">
              {trainer.display_name} will stop seeing your plans and workouts.
            </p>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="h-8 rounded-lg px-2.5 text-sm font-medium hover:bg-fill"
            >
              Keep
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="h-8 rounded-lg bg-red px-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-red">{error}</p>}
      </section>
    </>
  );
}
