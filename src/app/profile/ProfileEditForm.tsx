"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ProfileFields, { PasswordFields, type ProfileFieldsValue } from "@/components/ProfileFields";
import { updateProfile } from "./actions";

export default function ProfileEditForm({ initial }: { initial: ProfileFieldsValue }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fields, setFields] = useState<ProfileFieldsValue>(initial);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit() {
    setError(null);
    setSaved(false);

    if (password && password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    startTransition(async () => {
      const result = await updateProfile({
        fullName: fields.fullName,
        dateOfBirth: fields.dateOfBirth || null,
        heightCm: fields.heightCm ? parseFloat(fields.heightCm) : null,
        weightKg: fields.weightKg ? parseFloat(fields.weightKg) : null,
        sex: fields.sex,
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
      setPassword("");
      setConfirmPassword("");
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      <ProfileFields value={fields} onChange={setFields} />

      <div className="border-t border-neutral-800 pt-5">
        <PasswordFields
          password={password}
          confirmPassword={confirmPassword}
          onPasswordChange={setPassword}
          onConfirmPasswordChange={setConfirmPassword}
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {saved && <p className="text-sm text-green-400">Saved!</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending}
        className="rounded-xl bg-white px-4 py-3 font-medium text-neutral-900 disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save changes"}
      </button>
    </div>
  );
}
