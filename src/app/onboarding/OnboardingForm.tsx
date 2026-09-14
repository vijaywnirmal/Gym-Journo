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
    age: "",
    heightCm: "",
    weightKg: "",
    sex: "",
    goal: "",
  });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    startTransition(async () => {
      const result = await completeOnboarding({
        fullName: fields.fullName,
        age: fields.age ? parseInt(fields.age, 10) : null,
        heightCm: fields.heightCm ? parseFloat(fields.heightCm) : null,
        weightKg: fields.weightKg ? parseFloat(fields.weightKg) : null,
        sex: fields.sex,
        goal: fields.goal,
        password,
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
        <PasswordFields
          password={password}
          confirmPassword={confirmPassword}
          onPasswordChange={setPassword}
          onConfirmPasswordChange={setConfirmPassword}
          required
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending || !password}
        className="rounded-xl bg-white px-4 py-3 font-medium text-neutral-900 disabled:opacity-50"
      >
        {pending ? "Saving..." : "Finish setup"}
      </button>
    </div>
  );
}
