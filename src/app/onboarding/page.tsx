import type { Metadata } from "next";
import Link from "next/link";
import OnboardingForm from "./OnboardingForm";

export const metadata: Metadata = { title: "Welcome" };

export default function OnboardingPage() {
  return (
    <main className="px-4 pt-6 md:px-8 md:pt-10">
      <h1 className="mb-1 page-title">Welcome</h1>
      <p className="mb-6 text-sm text-label-2">
        Tell us a bit about yourself and set a password so you can sign in with your email and
        password from now on.{" "}
        <Link href="/trainer/setup" className="text-link">
          Are you a trainer?
        </Link>
      </p>
      <OnboardingForm />
    </main>
  );
}
