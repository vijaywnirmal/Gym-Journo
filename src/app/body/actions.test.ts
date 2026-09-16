import { describe, expect, it, vi, beforeEach } from "vitest";
import { today } from "@/lib/date";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });
const upsert = vi.fn();
const deleteResult = vi.fn();
const deleteEq = vi.fn().mockImplementation(() => deleteResult());
const del = vi.fn().mockReturnValue({ eq: deleteEq });
const from = vi.fn().mockReturnValue({ upsert, delete: del });

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from,
  }),
}));

const { saveMeasurement, deleteMeasurement } = await import("./actions");

const validInput = { date: "2026-09-15", weightKg: 72.5, notes: "" };

describe("saveMeasurement", () => {
  beforeEach(() => {
    upsert.mockReset();
    upsert.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("requires the user to be signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await saveMeasurement(validInput);
    expect(result).toEqual({ error: "Not signed in" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("creates a new dated entry via upsert on (user_id, date)", async () => {
    const result = await saveMeasurement(validInput);
    expect(result).toEqual({ success: true });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        date: "2026-09-15",
        weight_kg: 72.5,
        notes: null,
      }),
      { onConflict: "user_id,date" }
    );
  });

  it("updates an existing date's entry in place (same upsert path)", async () => {
    const result = await saveMeasurement({ date: "2026-09-15", weightKg: 74, notes: "felt heavier" });
    expect(result).toEqual({ success: true });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ date: "2026-09-15", weight_kg: 74, notes: "felt heavier" }),
      { onConflict: "user_id,date" }
    );
  });

  it("trims and stores a note, or null when blank", async () => {
    await saveMeasurement({ ...validInput, notes: "  good progress  " });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ notes: "good progress" }),
      expect.anything()
    );
  });

  it("rejects a missing/NaN weight", async () => {
    const result = await saveMeasurement({ ...validInput, weightKg: NaN });
    expect(result.error).toBeTruthy();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects zero weight", async () => {
    const result = await saveMeasurement({ ...validInput, weightKg: 0 });
    expect(result.error).toBeTruthy();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects negative weight", async () => {
    const result = await saveMeasurement({ ...validInput, weightKg: -10 });
    expect(result.error).toBeTruthy();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects an unreasonably large weight", async () => {
    const result = await saveMeasurement({ ...validInput, weightKg: 5000 });
    expect(result.error).toBeTruthy();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects a malformed date", async () => {
    const result = await saveMeasurement({ ...validInput, date: "not-a-date" });
    expect(result.error).toBeTruthy();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("accepts an entry dated today (regression: today() must never be rejected as a future date)", async () => {
    const result = await saveMeasurement({ ...validInput, date: today() });
    expect(result).toEqual({ success: true });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ date: today() }),
      { onConflict: "user_id,date" }
    );
  });

  it("rejects a future date", async () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const result = await saveMeasurement({ ...validInput, date: future.toISOString().slice(0, 10) });
    expect(result.error).toBeTruthy();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects an overly long note", async () => {
    const result = await saveMeasurement({ ...validInput, notes: "a".repeat(501) });
    expect(result.error).toBeTruthy();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("returns a safe generic error on an unexpected DB failure", async () => {
    upsert.mockResolvedValue({ error: { message: "connection reset" } });
    const result = await saveMeasurement(validInput);
    expect(result.error).toBe("Something went wrong saving this entry. Please try again.");
    expect(result.error).not.toContain("connection reset");
  });
});

describe("deleteMeasurement", () => {
  beforeEach(() => {
    deleteResult.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("requires the user to be signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await deleteMeasurement("m-1");
    expect(result).toEqual({ error: "Not signed in" });
  });

  it("deletes an owned entry", async () => {
    deleteResult.mockResolvedValue({ error: null, count: 1 });
    const result = await deleteMeasurement("m-1");
    expect(result).toEqual({ success: true });
  });

  it("does not affect other entries (RLS/ownership scoped by id, count reflects exactly one row)", async () => {
    deleteResult.mockResolvedValue({ error: null, count: 1 });
    await deleteMeasurement("m-1");
    expect(deleteEq).toHaveBeenCalledWith("id", "m-1");
  });

  it("returns a generic error when nothing was deleted (e.g. another user's entry)", async () => {
    deleteResult.mockResolvedValue({ error: null, count: 0 });
    const result = await deleteMeasurement("someone-elses-entry");
    expect(result.error).toBe("Unable to delete this entry.");
  });

  it("returns a safe generic error for other DB failures", async () => {
    deleteResult.mockResolvedValue({ error: { code: "08000", message: "connection reset" }, count: null });
    const result = await deleteMeasurement("m-1");
    expect(result.error).toBe("Something went wrong deleting this entry. Please try again.");
    expect(result.error).not.toContain("connection reset");
  });
});
