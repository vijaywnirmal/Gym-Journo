"use client";

import { useState, useTransition } from "react";
import TrainerSeesList from "@/components/TrainerSeesList";
import type { GymTrainerOffer } from "@/lib/types";
import { answerTrainerOffer } from "./gymActions";

// A trainer the member's gym suggested: who they are, what they'd see, and the member's choice.
export default function GymOfferCard({
  offer,
  currentTrainer,
}: {
  offer: GymTrainerOffer;
  currentTrainer: { id: string; name: string } | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const name = offer.trainer_name;
  const switching = currentTrainer !== null && currentTrainer.id !== offer.trainer_id;

  function answer(accept: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await answerTrainerOffer(offer.offer_id, accept);
      if (result.error) setError(result.error);
    });
  }

  return (
    <section id="gym-offer" className="card mt-8 border-accent/30 p-4">
      <h2 className="text-base font-semibold">
        {offer.gym_name} suggests {name} as your trainer
      </h2>
      {offer.trainer_runs_gym && <p className="mt-1 text-sm text-label-2">{name} also runs {offer.gym_name}.</p>}
      <TrainerSeesList name={name} heading="h3" className="mt-3" />
      {switching && <p className="mt-3 text-sm font-medium">You&apos;ll stop training with {currentTrainer.name}.</p>}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => answer(true)}
          disabled={pending}
          className="h-10 flex-1 rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
        >
          {switching ? `Switch to ${name}` : "Accept"}
        </button>
        <button
          type="button"
          onClick={() => answer(false)}
          disabled={pending}
          className="h-10 flex-1 rounded-[10px] border border-separator px-4 text-sm font-semibold hover:bg-fill disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </section>
  );
}
