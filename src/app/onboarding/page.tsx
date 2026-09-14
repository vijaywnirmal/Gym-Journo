import OnboardingForm from "./OnboardingForm";

export default function OnboardingPage() {
  return (
    <main className="px-4 pt-6">
      <h1 className="mb-1 text-xl font-bold text-neutral-100">Welcome 👋</h1>
      <p className="mb-6 text-sm text-neutral-400">
        Tell us a bit about yourself and set a password so you can sign in with your email and
        password from now on.
      </p>
      <OnboardingForm />
    </main>
  );
}
