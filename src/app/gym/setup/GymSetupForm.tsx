"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import DetailsView from "@/components/DetailsView";
import { formatPhone } from "@/lib/trainerInvites";
import { saveGym } from "./actions";

export default function GymSetupForm({
  initial,
  askOwner,
  editing,
}: {
  initial: { name: string; city: string; area: string; phone: string; ownerName: string };
  // A new account gives its name and confirms it's 18 or older here instead of in regular onboarding.
  askOwner: boolean;
  editing: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fields, setFields] = useState(initial);
  const [confirmedAdult, setConfirmedAdult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Saved details show as text until Edit; a new gym goes straight to the form.
  const [viewing, setViewing] = useState(editing);
  const [saved, setSaved] = useState<string | null>(null);
  const [savedFields, setSavedFields] = useState(initial);

  function set(key: keyof typeof fields) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setFields((f) => ({ ...f, [key]: e.target.value }));
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await saveGym({ ...fields, confirmedAdult });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (editing) {
        setSavedFields(fields);
        setViewing(true);
        setSaved("Gym details saved.");
        return;
      }
      // The action revalidates the layout, so no refresh (see TrainerSetupForm).
      router.push("/gym/invite");
    });
  }

  if (viewing) {
    return (
      <DetailsView
        rows={[
          { label: "Gym name", value: savedFields.name },
          { label: "City", value: savedFields.city },
          { label: "Area", value: savedFields.area },
          { label: "Phone", value: savedFields.phone ? formatPhone(savedFields.phone) : null },
        ]}
        onEdit={() => {
          setSaved(null);
          setFields(savedFields);
          setViewing(false);
        }}
        saved={saved}
      />
    );
  }

  return (
    <form
      className="flex flex-col gap-4 pb-6"
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <Field label="Gym name" value={fields.name} onChange={set("name")} autoComplete="organization" placeholder="e.g. Iron Gym" />
      <Field label="City" value={fields.city} onChange={set("city")} autoComplete="address-level2" placeholder="e.g. Pune" />
      <Field label="Area" value={fields.area} onChange={set("area")} autoComplete="address-level3" placeholder="e.g. Kothrud" />
      <Field
        label="Phone"
        value={fields.phone}
        onChange={set("phone")}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="98765 43210"
      />

      {askOwner && (
        <>
          <Field label="Your name" value={fields.ownerName} onChange={set("ownerName")} autoComplete="name" placeholder="e.g. Vikram Rao" />
          <button
            type="button"
            role="checkbox"
            aria-checked={confirmedAdult}
            onClick={() => setConfirmedAdult((value) => !value)}
            className="flex items-center gap-2.5 text-left text-sm font-medium"
          >
            <span
              className={`grid size-5 shrink-0 place-items-center rounded-md border ${
                confirmedAdult ? "border-transparent bg-accent text-on-accent" : "border-label-3 bg-surface"
              }`}
            >
              {confirmedAdult && <Icon name="checkmark" className="size-3.5" strokeWidth={3} />}
            </span>
            I&apos;m 18 or older
          </button>
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {editing && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setViewing(true);
            }}
            className="h-11 flex-1 rounded-[10px] border border-separator px-4 text-[15px] font-semibold hover:bg-fill"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={pending || (askOwner && !confirmedAdult)}
          className="h-11 flex-1 rounded-[10px] bg-accent px-4 text-[15px] font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Saving…" : editing ? "Save" : "Continue"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input {...props} className="field h-11 w-full rounded-[10px] px-3.5 text-base" />
    </label>
  );
}
