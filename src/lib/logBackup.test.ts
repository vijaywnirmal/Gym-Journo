import { describe, expect, it } from "vitest";
import { backupKey, clearLogBackup, readLogBackup, writeLogBackup, type LogBackupState } from "./logBackup";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

const state: LogBackupState = {
  entries: [
    {
      exerciseId: "ex-1",
      name: "Bench",
      notes: "",
      target: { sets: 3, reps: 5 },
      sets: [{ reps: "5", weight: "100", weightUnit: "kg", setType: "working", rpe: "8" }],
      done: false,
    },
  ],
  notes: "good",
  workoutCompleted: false,
};

describe("log backup", () => {
  const key = backupKey("user-1", "2026-09-25");

  it("round-trips the logger state", () => {
    const storage = memoryStorage();
    writeLogBackup(storage, key, state, 123);
    expect(readLogBackup(storage, key)).toEqual({ version: 1, savedAt: 123, ...state });
  });

  it("is scoped per user and per date", () => {
    expect(backupKey("user-1", "2026-09-25")).not.toBe(backupKey("user-2", "2026-09-25"));
    expect(backupKey("user-1", "2026-09-25")).not.toBe(backupKey("user-1", "2026-09-26"));
  });

  it("returns null when missing, cleared, corrupt or the wrong shape", () => {
    const storage = memoryStorage();
    expect(readLogBackup(storage, key)).toBeNull();
    writeLogBackup(storage, key, state);
    clearLogBackup(storage, key);
    expect(readLogBackup(storage, key)).toBeNull();
    storage.data.set(key, "{not json");
    expect(readLogBackup(storage, key)).toBeNull();
    storage.data.set(key, JSON.stringify({ version: 1, entries: "nope" }));
    expect(readLogBackup(storage, key)).toBeNull();
  });

  it("fills defaults for fields older backups may lack", () => {
    const storage = memoryStorage();
    storage.data.set(
      key,
      JSON.stringify({
        version: 1,
        savedAt: 1,
        notes: "",
        workoutCompleted: true,
        entries: [{ exerciseId: "ex-1", name: "Bench", sets: [{ reps: "5", weight: "", weightUnit: "kg" }] }],
      })
    );
    const backup = readLogBackup(storage, key);
    expect(backup?.entries[0]).toMatchObject({ notes: "", done: false, target: null });
    expect(backup?.entries[0].sets[0]).toMatchObject({ setType: "working", rpe: "" });
  });

  it("never throws when storage is missing or throws", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => writeLogBackup(throwing, key, state)).not.toThrow();
    expect(readLogBackup(throwing, key)).toBeNull();
    expect(() => clearLogBackup(throwing, key)).not.toThrow();
    expect(readLogBackup(null, key)).toBeNull();
  });
});
