// Person names: first and last are stored separately; `full_name` stays as the joined display name
// so everything that only needs "a name" (greeting, AI plan) keeps working.

export const MAX_NAME_LENGTH = 50;

// Trimmed, with runs of whitespace collapsed to one space — how every stored name part is kept.
export function cleanName(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

// "Mary Ann Smith" -> first "Mary", last "Ann Smith". Only a fallback for profiles that still have a
// full name and no separate parts; anything the person edits is stored as they entered it, tidied by cleanName.
export function splitFullName(fullName: string | null | undefined): { firstName: string; lastName: string } {
  const name = cleanName(fullName);
  if (!name) return { firstName: "", lastName: "" };
  const space = name.indexOf(" ");
  if (space === -1) return { firstName: name, lastName: "" };
  return { firstName: name.slice(0, space), lastName: name.slice(space + 1) };
}

export function joinName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  return [cleanName(firstName), cleanName(lastName)].filter(Boolean).join(" ");
}

// The parts to show for a profile: the stored first/last when present, else split from full_name.
export function namePartsOf(profile: {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
} | null): { firstName: string; lastName: string } {
  if (!profile) return { firstName: "", lastName: "" };
  const first = cleanName(profile.first_name);
  const last = cleanName(profile.last_name);
  if (first || last) return { firstName: first, lastName: last };
  return splitFullName(profile.full_name);
}

// Up to two capital letters for an avatar: first + last initial, or just the first.
export function initialsOf(firstName: string, lastName: string): string {
  const letters = [cleanName(firstName), cleanName(lastName)]
    .filter(Boolean)
    .map((part) => Array.from(part)[0].toUpperCase());
  return letters.join("") || "?";
}

export function validateName(value: string, label: string, required: boolean): string | null {
  const name = cleanName(value);
  if (!name) return required ? `Enter your ${label}.` : null;
  if (name.length > MAX_NAME_LENGTH) return `${label[0].toUpperCase()}${label.slice(1)} must be ${MAX_NAME_LENGTH} characters or fewer.`;
  return null;
}
