"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ProfileFields, { PasswordFields, type ProfileFieldsValue } from "@/components/ProfileFields";
import { completeOnboarding } from "./actions";

export default function OnboardingForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fields, setFields] = useState<ProfileFieldsValue>({
    fullName: "",
    dateOfBirth: "",
    heightCm: "",
    weightKg: "",
    sex: "",
    primaryGoal: "",
    targetWeightKg: "",
    experienceLevel: "",
    trainingDaysPerWeek: "",
  });
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
      const result = await completeOnboarding({
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
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      <ProfileFields value={fields} onChange={setFields} />

      <div className="border-t border-neutral-800 pt-5">
        <p className="mb-3 text-xs text-neutral-500">
          Already have a password, or prefer to keep signing in with a magic link? Leave this
          blank — you can set or change a password anytime from your profile.
        </p>
        <PasswordFields
          password={password}
          confirmPassword={confirmPassword}
          onPasswordChange={setPassword}
          onConfirmPasswordChange={setConfirmPassword}
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending}
        className="rounded-xl bg-white px-4 py-3 font-medium text-neutral-900 disabled:opacity-50"
      >
        {pending ? "Saving..." : "Finish setup"}
      </button>
    </div>
  );
}
