import { z } from "zod";

// On-device backup of a workout log's unsynced edits. The logger writes it on every edit and
// clears it once the server confirms the latest state, so it only survives when the app was closed
// (or crashed) before an edit reached the server — e.g. logging offline in a basement gym. On the
// next visit to that day the backup is restored and saved. Browser-only; every storage access is
// guarded, since storage can be missing or throw (private mode, blocked site data).

const KEY_PREFIX = "gym-journo:unsynced-log:";

const setSchema = z.object({
  reps: z.string(),
  weight: z.string(),
  weightUnit: z.string(),
  setType: z.enum(["working", "warmup", "drop", "failure"]).catch("working"),
  rpe: z.string().catch(""),
});

const entrySchema = z.object({
  exerciseId: z.string().min(1),
  name: z.string(),
  notes: z.string().catch(""),
  target: z.object({ sets: z.number().nullable(), reps: z.number().nullable() }).nullable().catch(null),
  sets: z.array(setSchema),
  done: z.boolean().catch(false),
});

const backupSchema = z.object({
  version: z.literal(1),
  savedAt: z.number(),
  entries: z.array(entrySchema),
  notes: z.string(),
  workoutCompleted: z.boolean(),
});

export type LogBackup = z.infer<typeof backupSchema>;
export type LogBackupState = Omit<LogBackup, "version" | "savedAt">;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function backupKey(userScope: string, date: string): string {
  return `${KEY_PREFIX}${userScope}:${date}`;
}

export function writeLogBackup(
  storage: StorageLike | null,
  key: string,
  state: LogBackupState,
  now: number = Date.now()
): void {
  if (!storage) return;
  try {
    const backup: LogBackup = { version: 1, savedAt: now, ...state };
    storage.setItem(key, JSON.stringify(backup));
  } catch {
    // Full or blocked — the in-memory retry still covers the page staying open.
  }
}

export function readRawLogBackup(storage: StorageLike | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function parseLogBackup(raw: string | null): LogBackup | null {
  if (!raw) return null;
  try {
    const parsed = backupSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function readLogBackup(storage: StorageLike | null, key: string): LogBackup | null {
  return parseLogBackup(readRawLogBackup(storage, key));
}

export function clearLogBackup(storage: StorageLike | null, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // Ignore.
  }
}

export function browserLocalStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
