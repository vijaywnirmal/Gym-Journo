// Only allow same-origin, path-relative redirect targets — prevents open redirects via a crafted `next` param.
export function safeRedirectPath(next: string | null | undefined, fallback = "/"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (next.includes("://")) return fallback;
  return next;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Loose sanity bounds — not a precise policy, just enough to catch typos (e.g. future dates,
// or a birth year so old it's clearly a mistake).
export function validateDateOfBirth(dateOfBirth: string): string | null {
  const parsed = new Date(dateOfBirth);
  if (Number.isNaN(parsed.getTime())) return "Enter a valid date of birth.";
  const now = new Date();
  if (parsed > now) return "Date of birth can't be in the future.";
  const minDate = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
  if (parsed < minDate) return "Enter a valid date of birth.";
  return null;
}

export const MIN_PASSWORD_LENGTH = 8;

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}
