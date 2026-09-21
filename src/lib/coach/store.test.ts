import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const insert = vi.fn();
const from = vi.fn(() => ({ insert }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from }),
}));

const { saveCoachRecord } = await import("./store");
const { coachEvidence } = await import("./testFixtures");

const record = {
  question: "What changed?",
  evidence: coachEvidence(),
  status: "accepted" as const,
  reply: { statements: [{ kind: "fact" as const, text: "Set 1 was 80 kg for 8 reps.", cites: ["exercise.ex-bench"] }], questions: [] },
  rawReply: "{...}",
  issues: [],
  model: "test-model",
};

describe("saveCoachRecord", () => {
  beforeEach(() => {
    getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } } });
    insert.mockReset().mockResolvedValue({ error: null });
    from.mockClear();
  });

  it("inserts the exchange into coach_replies as the signed-in user", async () => {
    expect(await saveCoachRecord(record)).toEqual({ success: true });
    expect(from).toHaveBeenCalledWith("coach_replies");
    expect(insert).toHaveBeenCalledWith({
      user_id: "user-1",
      question: "What changed?",
      evidence: record.evidence,
      status: "accepted",
      reply: record.reply,
      raw_reply: "{...}",
      issues: [],
      model: "test-model",
    });
  });

  it("stores blocked and rejected exchanges too, with a null reply", async () => {
    await saveCoachRecord({ ...record, status: "rejected", reply: null });
    expect(insert.mock.calls[0][0]).toMatchObject({ status: "rejected", reply: null });
  });

  it("does nothing when signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await saveCoachRecord(record)).toEqual({ error: "Not signed in" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns a generic error, not the database message, on failure", async () => {
    insert.mockResolvedValue({ error: { message: 'relation "coach_replies" does not exist' } });
    const result = await saveCoachRecord(record);
    expect(result).toEqual({ error: "Couldn't save this exchange." });
    expect(JSON.stringify(result)).not.toContain("relation");
  });
});
