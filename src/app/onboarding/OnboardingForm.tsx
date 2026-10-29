"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import ProfileFields, { PasswordFields, type ProfileFieldsValue } from "@/components/ProfileFields";
import { EMPTY_PROFILE_FIELDS, missingFieldsMessage, missingOnboardingFields } from "@/lib/profile-fields";
import { completeOnboarding } from "./actions";

export default function OnboardingForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fields, setFields] = useState<ProfileFieldsValue>(EMPTY_PROFILE_FIELDS);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmedAdult, setConfirmedAdult] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    setError(null);

    const missing = missingFieldsMessage(missingOnboardingFields(fields, confirmedAdult));
    if (missing) {
      setError(missing);
      return;
    }
    if (password && password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    startTransition(async () => {
      const result = await completeOnboarding({
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
        trainingLocation: fields.trainingLocation,
        password: password || undefined,
        confirmedAdult,
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

      <div className="border-t border-separator pt-5">
        <p className="mb-3 text-xs text-label-2">
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

      {error && (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending}
        className="h-11 rounded-[10px] bg-accent px-4 text-[15px] font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Saving..." : "Finish setup"}
      </button>
    </div>
  );
}
