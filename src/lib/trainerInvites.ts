// Trainer invite links (gymjourno.fit/join/<code>) and what's remembered while someone signs up.
//
// A visitor who opens an invite (or "I'm a trainer") before they have an account goes through
// sign-in, email confirmation and onboarding first. The proxy keeps where they were heading in a
// short-lived cookie and sends them back there once they're set up.

// Same alphabet and length as create_trainer_invite (migration 0034).
const INVITE_CODE = /^[a-z0-9]{10}$/;

export const JOIN_COOKIE = "gj-join";
export const SIGNUP_COOKIE = "gj-signup";
export const INTENT_COOKIE_MAX_AGE = 60 * 60 * 24; // a day: long enough to confirm an email

export function isInviteCode(value: string | null | undefined): value is string {
  return typeof value === "string" && INVITE_CODE.test(value);
}

// The invite code in a /join/<code> path, lowercased (codes are read out and typed), else null.
export function joinCodeOf(pathname: string): string | null {
  const match = /^\/join\/([A-Za-z0-9]+)\/?$/.exec(pathname);
  const code = match?.[1].toLowerCase() ?? null;
  return isInviteCode(code) ? code : null;
}

export function inviteUrl(siteUrl: string, code: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/join/${code}`;
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

// A chat link for a trainer's stored number (digits with an optional +).
export function whatsappChatUrl(number: string): string {
  return `https://wa.me/${number.replace(/\D/g, "")}`;
}

// A WhatsApp number as typed ("98765 43210", "+91-98765-43210") to the stored form: digits with a
// leading +. India first: ten digits on their own get +91. Null for blank; "invalid" for anything
// that isn't 10–15 digits.
export function normalizeWhatsapp(value: string): string | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\+?[\d\s()-]+$/.test(trimmed)) return "invalid";
  const digits = trimmed.replace(/\D/g, "");
  if (!trimmed.startsWith("+") && digits.length === 10) return `+91${digits}`;
  if (digits.length < 10 || digits.length > 15) return "invalid";
  return `+${digits}`;
}

// What the proxy should do with someone's pending invite or trainer sign-up, given where they are.
export function pendingRedirect({
  pathname,
  joinCookie,
  signupCookie,
}: {
  pathname: string;
  joinCookie: string | undefined;
  signupCookie: string | undefined;
}): string | null {
  // Only from the home page, where every sign-in and onboarding flow lands.
  if (pathname !== "/") return null;
  if (isInviteCode(joinCookie)) return `/join/${joinCookie}`;
  if (signupCookie === "trainer") return "/trainer/setup";
  return null;
}
