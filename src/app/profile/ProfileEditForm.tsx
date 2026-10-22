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

    if (!password && confirmPassword) {
      setError("Enter the new password as well, or clear Confirm password.");
      return;
    }
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

      <section className="card p-4">
        <h2 className="mb-4 text-sm font-semibold">Password</h2>
        <PasswordFields
          password={password}
          confirmPassword={confirmPassword}
          onPasswordChange={setPassword}
          onConfirmPasswordChange={setConfirmPassword}
        />
      </section>

      {/* Stays in view on a phone while the long form scrolls; errors show here, next to Save,
          so a failed save is never off-screen. */}
      <div className="material sticky bottom-20 z-10 -mx-1 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-separator p-2 shadow-popover md:bottom-4">
        {error && (
          <p role="alert" className="mr-auto min-w-0 flex-1 basis-48 px-1 text-sm text-red">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="h-10 rounded-[10px] border border-separator px-4 text-sm font-semibold hover:bg-fill disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="h-10 rounded-[10px] bg-accent px-5 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
