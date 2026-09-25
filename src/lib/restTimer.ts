// Rest timer logic — pure, no React. The timer is stored as an absolute end time (ms since epoch)
// rather than a ticking counter, so it stays correct when the phone locks or the tab is hidden and
// timers are throttled.

export const REST_PRESETS_SEC = [60, 90, 120, 180] as const;
export const DEFAULT_REST_SEC = 90;
export const MIN_REST_SEC = 15;
export const MAX_REST_SEC = 600;
export const ADJUST_STEP_SEC = 15;

export function remainingSeconds(endAt: number, now: number): number {
  return Math.max(0, Math.ceil((endAt - now) / 1000));
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Shifts a running timer by deltaSec. The result never lies in the past, and never more than
// MAX_REST_SEC ahead.
export function adjustEndAt(endAt: number, now: number, deltaSec: number): number {
  const shifted = endAt + deltaSec * 1000;
  return Math.min(Math.max(shifted, now), now + MAX_REST_SEC * 1000);
}

export function isValidRestSeconds(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isInteger(value) && value >= MIN_REST_SEC && value <= MAX_REST_SEC
  );
}

// Per-exercise rest preference, remembered in this browser only (a per-viewer convenience). Every
// storage access is guarded: storage can be missing or throw (private mode, blocked site data).
const STORAGE_KEY = "gym-journo:rest-seconds";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function readAll(storage: StorageLike | null): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(([, v]) => isValidRestSeconds(v))
    ) as Record<string, number>;
  } catch {
    return {};
  }
}

export function readRestSeconds(storage: StorageLike | null, exerciseId: string): number {
  return readAll(storage)[exerciseId] ?? DEFAULT_REST_SEC;
}

export function writeRestSeconds(storage: StorageLike | null, exerciseId: string, seconds: number): void {
  if (!storage || !isValidRestSeconds(seconds)) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(storage), [exerciseId]: seconds }));
  } catch {
    // Storage full or blocked — the preference just isn't remembered.
  }
}

export function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
