"use client";

import { useState, useTransition } from "react";

type Trainer = { id: string; name: string };

// The member's trainer, from the gym's side: suggest one (the member accepts or declines), withdraw
// a suggestion, or take back the trainer the gym arranged.
export default function MemberTrainerCard({
  firstName,
  trainers,
  current,
  offered,
  declined,
  suggest,
  unassign,
}: {
  firstName: string;
  trainers: Trainer[];
  current: Trainer | null;
  offered: Trainer | null;
  // The trainer they said no to last, if they still have none.
  declined: Trainer | null;
  suggest: (trainerId: string) => Promise<{ error?: string }>;
  unassign: () => Promise<{ error?: string }>;
}) {
  const [pending, startTransition] = useTransition();
  // The one they declined goes last, so the obvious choice is someone else.
  const choices = trainers
    .filter((t) => t.id !== current?.id && t.id !== offered?.id)
    .sort((a, b) => Number(a.id === declined?.id) - Number(b.id === declined?.id));
  // With a trainer or a suggestion in place, choosing another is a second step, so the main button
  // on the card isn't a different trainer right after suggesting one.
  const [changing, setChanging] = useState(false);
  const [choice, setChoice] = useState(choices[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // Removing a trainer ends their access at once, so it asks first, like every other removal.
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  function run(action: () => Promise<{ error?: string }>, message: string) {
    setError(null);
    setDone(null);
    startTransition(async () => {
      const result = await action();
      // In the same transition as the refreshed page, so the message shows with the new trainer.
      startTransition(() => {
        setConfirmingRemove(false);
        if (result.error) {
          setError(result.error);
          return;
        }
        setChanging(false);
        setDone(message);
      });
    });
  }

  const chosen = choices.find((t) => t.id === choice) ?? choices[0];

  return (
    <section className="card divide-y divide-separator">
      {(error || done) && (
        <p role={error ? "alert" : "status"} className={`px-4 py-3 text-sm ${error ? "text-red" : "font-medium"}`}>
          {error ?? done}
        </p>
      )}
      {declined && !current && !offered && (
        <p className="px-4 py-3 text-sm text-label-2">
          {firstName} declined {declined.name}.
        </p>
      )}
      {(current || offered) && (
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{current ? current.name : `Suggested ${offered!.name}`}</p>
            <p className="text-sm text-label-2">
              {current ? `Trains ${firstName}` : `Waiting for ${firstName} to accept`}
              {current && offered && ` · suggested ${offered.name}`}
            </p>
          </div>
          {!confirmingRemove && (
            <button
              type="button"
              onClick={() => (current ? setConfirmingRemove(true) : run(unassign, "Suggestion withdrawn."))}
              disabled={pending}
              className="h-8 shrink-0 rounded-lg border border-separator px-2.5 text-sm font-semibold hover:bg-fill disabled:opacity-50"
            >
              {current ? "Remove" : "Withdraw"}
            </button>
          )}
        </div>
      )}
      {current && confirmingRemove && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <p className="min-w-40 flex-1 text-sm text-label-2">
            {current.name} will stop training {firstName}
            {offered ? `, and your suggestion of ${offered.name} is withdrawn.` : "."}
          </p>
          <button
            type="button"
            onClick={() => setConfirmingRemove(false)}
            className="h-8 rounded-lg px-2.5 text-sm font-medium hover:bg-fill"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => run(unassign, offered ? "Trainer removed and suggestion withdrawn." : "Trainer removed.")}
            disabled={pending}
            className="h-8 rounded-lg bg-red px-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Removing…" : "Remove"}
          </button>
        </div>
      )}

      {chosen && (current || offered) && !changing && (
        <div className="px-4 py-3">
          <button type="button" onClick={() => setChanging(true)} className="text-sm font-medium text-link">
            Suggest a different trainer
          </button>
        </div>
      )}

      {chosen && (!(current || offered) || changing) && (
        <div className="flex flex-col gap-2 px-4 py-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              {current || offered ? "Suggest a different trainer" : "Suggest a trainer"}
            </span>
            <select
              value={chosen.id}
              onChange={(e) => setChoice(e.target.value)}
              className="field h-11 w-full rounded-[10px] px-3 text-base"
            >
              {choices.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => run(() => suggest(chosen.id), `Suggested ${chosen.name}. ${firstName} can accept in the app.`)}
            disabled={pending}
            className="h-10 rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
          >
            {pending ? "Saving…" : `Suggest ${chosen.name}`}
          </button>
          <p className="text-xs text-label-2">
            {firstName} chooses whether to accept. Once they do, their trainer sees their plans, workouts and body weight.
          </p>
        </div>
      )}
    </section>
  );
}
