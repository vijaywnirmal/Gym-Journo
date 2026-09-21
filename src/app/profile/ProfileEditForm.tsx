"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ProfileFields, { PasswordFields, type ProfileFieldsValue } from "@/components/ProfileFields";
import { updateProfile } from "./actions";

export default function ProfileEditForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: ProfileFieldsValue;
  onCancel: () => void;
  onSaved: (saved: ProfileFieldsValue) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fields, setFields] = useState<ProfileFieldsValue>(initial);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    setError(null);

    if (password && password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    startTransition(async () => {
      const result = await updateProfile({
        firstName: fields.firstName,
        lastName: fields.lastName,
        dateOfBirth: fields.dateOfBirth || null,
        heightCm: fields.heightCm ? parseFloat(fields.heightCm) : null,
        weightKg: fields.weightKg ? parseFloat(fields.weightKg) : null,
        gender: fields.gender,
        primaryGoal: fields.primaryGoal,
        targetWeightKg: fields.targetWeightKg ? parseFloat(fields.targetWeightKg) : null,
        experienceLevel: fields.experienceLevel,
        trainingDaysPerWeek: fields.trainingDaysPerWeek ? parseInt(fields.trainingDaysPerWeek, 10) : null,
        password: password || undefined,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      onSaved(fields);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <ProfileFields value={fields} onChange={setFields} />

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
        <h2 className="mb-4 text-sm font-semibold text-neutral-100">Password</h2>
        <PasswordFields
          password={password}
          confirmPassword={confirmPassword}
          onPasswordChange={setPassword}
          onConfirmPasswordChange={setConfirmPassword}
        />
      </section>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      {/* Stays in view on a phone while the long form scrolls. */}
      <div className="sticky bottom-20 z-10 -mx-4 flex gap-3 border-t border-neutral-800 bg-neutral-950/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="h-12 flex-1 rounded-xl border border-neutral-700 px-4 font-medium text-neutral-200 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="h-12 flex-[2] rounded-xl bg-white px-4 font-medium text-neutral-900 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
