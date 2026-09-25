import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser }, rpc }) }));

const getAdaptSuggestions = vi.fn();
vi.mock("@/lib/queries", () => ({ getAdaptSuggestions: () => getAdaptSuggestions() }));

const { decideSuggestion } = await import("./actions");

const suggestion = {
  plannedExerciseId: "pe-1",
  exerciseId: "ex-1",
  exerciseName: "Back Squat",
  planDate: "2026-09-28",
  planTitle: "Legs",
  suggestion: {
    kind: "increase" as const,
    currentWeight: 100,
    proposedWeight: 102.5,
    unit: "kg" as const,
    evidence: { date: "2026-09-21", sets: [{ weight: 100, reps: 5, unit: "kg" }], targetSets: 1, targetReps: 5 },
    plateauBestE1rmKg: null,
  },
};

describe("decideSuggestion", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpc.mockReset();
    rpc.mockResolvedValue({ data: {}, error: null });
    getAdaptSuggestions.mockResolvedValue([suggestion]);
  });

  it("records an accept with the server-computed weight and reason", async () => {
    expect(await decideSuggestion("pe-1", true)).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith(
      "decide_recommendation",
      expect.objectContaining({
        p_planned_exercise_id: "pe-1",
        p_kind: "increase",
        p_current_weight: 100,
        p_proposed_weight: 102.5,
        p_weight_unit: "kg",
        p_accept: true,
        p_reason: expect.stringContaining("Next step: 102.5 kg"),
      })
    );
  });

  it("records a reject", async () => {
    await decideSuggestion("pe-1", false);
    expect(rpc).toHaveBeenCalledWith("decide_recommendation", expect.objectContaining({ p_accept: false }));
  });

  it("refuses a suggestion that is no longer current, without writing", async () => {
    getAdaptSuggestions.mockResolvedValue([]);
    expect(await decideSuggestion("pe-1", true)).toEqual({ error: expect.stringContaining("no longer current") });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns a safe error when the database refuses", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Already decided" } });
    expect(await decideSuggestion("pe-1", true)).toEqual({ error: expect.stringContaining("Nothing was changed") });
  });

  it("requires sign-in and valid input", async () => {
    expect(await decideSuggestion(123 as unknown as string, true)).toEqual({ error: "Invalid request." });
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await decideSuggestion("pe-1", true)).toEqual({ error: "Not signed in" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
