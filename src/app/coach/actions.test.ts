import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildTrainingEvidence } from "@/lib/analyze/evidence";
import { coachEvidence, BENCH_ID } from "@/lib/coach/testFixtures";
import { COACH_ATTEMPT_CEILING_PER_DAY, COACH_LIMIT_PER_DAY } from "@/lib/coach/limits";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const getUser = vi.fn();
type CountResult = { count: number | null; error: unknown };
// Two count queries run per question: one that leaves out exchanges whose model call failed (the
// daily allowance) and one that includes them (the attempt backstop). They are told apart by whether
// .not(...) was applied.
let answeredCount: CountResult = { count: 0, error: null };
let attemptedCount: CountResult = { count: 0, error: null };
type CountQuery = { eq: unknown[][]; in: unknown[][]; gte: unknown[][]; not: unknown[][] };
let countQueries: CountQuery[] = [];

function makeCountBuilder() {
  const q: CountQuery = { eq: [], in: [], gte: [], not: [] };
  countQueries.push(q);
  const builder = {
    eq: (...args: unknown[]) => (q.eq.push(args), builder),
    in: (...args: unknown[]) => (q.in.push(args), builder),
    gte: (...args: unknown[]) => (q.gte.push(args), builder),
    not: (...args: unknown[]) => (q.not.push(args), builder),
    then: (resolve: (v: CountResult) => unknown) =>
      Promise.resolve(q.not.length > 0 ? answeredCount : attemptedCount).then(resolve),
  };
  return builder;
}
const from = vi.fn(() => ({ select: () => makeCountBuilder() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser }, from }) }));

const getProfile = vi.fn();
const getTrainingEvidence = vi.fn();
vi.mock("@/lib/queries", () => ({
  getProfile: () => getProfile(),
  getTrainingEvidence: () => getTrainingEvidence(),
}));

const generateWithGemini = vi.fn();
vi.mock("@/lib/gemini", () => ({
  GEMINI_MODEL: "test-model",
  generateWithGemini: (...args: unknown[]) => generateWithGemini(...args),
}));

const saveCoachRecord = vi.fn();
vi.mock("@/lib/coach/store", () => ({ saveCoachRecord: (r: unknown) => saveCoachRecord(r) }));

const { askCoach } = await import("./actions");

const goodReply = JSON.stringify({
  statements: [
    { kind: "fact", text: "Bench Press was last performed on Sep 18, 7 days after Sep 11.", cites: [BENCH_ID] },
  ],
  questions: [],
});

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } } });
  getProfile.mockReset().mockResolvedValue({ coach_consent_at: "2026-09-01T10:00:00Z" });
  getTrainingEvidence.mockReset().mockResolvedValue(coachEvidence());
  generateWithGemini.mockReset().mockResolvedValue(goodReply);
  saveCoachRecord.mockReset().mockResolvedValue({ success: true });
  answeredCount = { count: 0, error: null };
  attemptedCount = { count: 0, error: null };
  countQueries = [];
  from.mockClear();
});

describe("askCoach — gates before anything is sent", () => {
  it("requires a signed-in user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await askCoach("What changed?")).toEqual({ status: "error", message: "Not signed in" });
    expect(generateWithGemini).not.toHaveBeenCalled();
  });

  it("requires consent, enforced on the server — nothing is fetched or sent without it", async () => {
    getProfile.mockResolvedValue({ coach_consent_at: null });
    const result = await askCoach("What changed?");
    expect(result.status).toBe("needs_consent");
    expect(getTrainingEvidence).not.toHaveBeenCalled();
    expect(generateWithGemini).not.toHaveBeenCalled();
  });

  it("a missing profile counts as no consent", async () => {
    getProfile.mockResolvedValue(null);
    expect((await askCoach("What changed?")).status).toBe("needs_consent");
  });

  it("turns away a recommendation request before fetching evidence or calling the model", async () => {
    const result = await askCoach("Should I increase the weight?");
    expect(result.status).toBe("blocked");
    expect(getTrainingEvidence).not.toHaveBeenCalled();
    expect(generateWithGemini).not.toHaveBeenCalled();
    expect(saveCoachRecord).not.toHaveBeenCalled();
  });

  it("turns away a pain question with the fixed safe message", async () => {
    const result = await askCoach("My shoulder hurts");
    expect(result).toMatchObject({ status: "blocked" });
    expect("message" in result && result.message).toMatch(/doctor or physiotherapist/);
    expect(generateWithGemini).not.toHaveBeenCalled();
  });

  it("stops at the daily limit, counting only accepted/rejected exchanges from the last 24 hours", async () => {
    answeredCount = { count: COACH_LIMIT_PER_DAY, error: null };
    const result = await askCoach("What changed?");
    expect(result.status).toBe("rate_limited");
    expect("message" in result && result.message).toMatch(/today's limit of 10 Coach questions/);
    expect(generateWithGemini).not.toHaveBeenCalled();
    expect(getTrainingEvidence).not.toHaveBeenCalled();

    const [answered] = countQueries;
    expect(answered.eq).toContainEqual(["user_id", "user-1"]);
    expect(answered.in).toEqual([["status", ["accepted", "rejected"]]]);
    const since = Date.parse(answered.gte[0][1] as string);
    expect(Math.abs(Date.now() - since - 24 * 60 * 60 * 1000)).toBeLessThan(5000);
  });

  it("the daily allowance leaves out exchanges whose model call failed", async () => {
    await askCoach("What changed?");
    const answered = countQueries.find((q) => q.not.length > 0);
    expect(answered?.not).toEqual([["issues", "cs", JSON.stringify([{ code: "generation_failed" }])]]);
  });

  it("failed calls don't use up the allowance: many failures + few answers still lets a question through", async () => {
    // What the person hit: lots of saved exchanges, nearly all failed provider calls.
    attemptedCount = { count: 12, error: null };
    answeredCount = { count: 1, error: null };
    expect((await askCoach("What changed?")).status).toBe("accepted");
  });

  it("allows a question just under the limit", async () => {
    answeredCount = { count: COACH_LIMIT_PER_DAY - 1, error: null };
    expect((await askCoach("What changed?")).status).toBe("accepted");
  });

  it("but failures are bounded: past the attempt ceiling, Coach stops even with few answers", async () => {
    attemptedCount = { count: COACH_ATTEMPT_CEILING_PER_DAY, error: null };
    answeredCount = { count: 0, error: null };
    const result = await askCoach("What changed?");
    expect(result.status).toBe("rate_limited");
    expect(generateWithGemini).not.toHaveBeenCalled();
    expect(getTrainingEvidence).not.toHaveBeenCalled();
    // A different message from the daily limit, so it isn't read as "10 questions".
    expect("message" in result && result.message).not.toMatch(/limit of 10/);

    attemptedCount = { count: COACH_ATTEMPT_CEILING_PER_DAY - 1, error: null };
    expect((await askCoach("What changed?")).status).toBe("accepted");
  });

  it("fails closed when exchanges can't be counted (e.g. the record table is missing)", async () => {
    const missing = { count: null, error: { message: 'relation "coach_replies" does not exist' } };
    for (const [answered, attempted] of [
      [missing, { count: 0, error: null }],
      [{ count: 0, error: null }, missing],
    ]) {
      answeredCount = answered;
      attemptedCount = attempted;
      generateWithGemini.mockClear();
      const result = await askCoach("What changed?");
      expect(result.status).toBe("error");
      expect(JSON.stringify(result)).not.toContain("relation");
      expect(generateWithGemini).not.toHaveBeenCalled();
    }
  });

  it("reports unavailability when the training history can't be read", async () => {
    getTrainingEvidence.mockResolvedValue(null);
    expect((await askCoach("What changed?")).status).toBe("error");
    expect(generateWithGemini).not.toHaveBeenCalled();
  });

  it("says so plainly when there are no records, without spending a model call", async () => {
    getTrainingEvidence.mockResolvedValue(
      buildTrainingEvidence({
        todayStr: "2026-09-21",
        profile: null,
        performedDates: [],
        lastPerformedWorkoutDate: null,
        bodyMeasurements: [],
        exercises: [],
        exercisesTruncated: false,
      })
    );
    const result = await askCoach("What changed?");
    expect(result.status).toBe("empty");
    expect(generateWithGemini).not.toHaveBeenCalled();
  });
});

describe("askCoach — an exchange", () => {
  it("returns the verified reply with labelled sources, and records the exchange", async () => {
    const result = await askCoach("  What changed in Bench Press?  ");
    expect(result).toMatchObject({
      status: "accepted",
      sources: [{ id: BENCH_ID, label: "Bench Press" }],
    });
    expect(result.status === "accepted" && result.reply.statements).toHaveLength(1);

    expect(saveCoachRecord).toHaveBeenCalledTimes(1);
    expect(saveCoachRecord.mock.calls[0][0]).toMatchObject({
      question: "What changed in Bench Press?",
      status: "accepted",
      model: "test-model",
    });
  });

  it("asks Gemini for JSON with minimal thinking, a timeout and retries, and sends only the evidence prompt", async () => {
    await askCoach("What changed?");
    const [prompt, options] = generateWithGemini.mock.calls[0];
    expect(options).toEqual({
      json: true,
      timeoutMs: 40_000,
      thinkingLevel: "minimal",
      retries: 2,
      retryDelayMs: 1500,
    });
    expect(prompt).toContain(JSON.stringify(coachEvidence()));
    expect(prompt).not.toContain("full_name");
  });

  it("a failing model call is rejected with a generic message and the record shows why — no provider text leaks", async () => {
    generateWithGemini.mockRejectedValue(new Error("Gemini request failed (500): key=AIza-secret"));
    const result = await askCoach("What changed?");
    expect(result.status).toBe("rejected");
    expect(JSON.stringify(result)).not.toContain("AIza-secret");
    expect(saveCoachRecord.mock.calls[0][0]).toMatchObject({ status: "rejected" });
    expect(JSON.stringify(saveCoachRecord.mock.calls[0][0])).not.toContain("AIza-secret");
  });

  it("a reply that fails verification is rejected, shown as a fixed message, and still recorded", async () => {
    generateWithGemini.mockResolvedValue(
      JSON.stringify({ statements: [{ kind: "fact", text: "You should add 5 kg.", cites: [BENCH_ID] }] })
    );
    const result = await askCoach("What changed?");
    expect(result.status).toBe("rejected");
    expect("message" in result && result.message).toMatch(/couldn't produce an answer it could verify/);
    expect(saveCoachRecord.mock.calls[0][0]).toMatchObject({ status: "rejected" });
  });

  it("failing to save the record does not hide a verified answer", async () => {
    saveCoachRecord.mockResolvedValue({ error: "Couldn't save this exchange." });
    expect((await askCoach("What changed?")).status).toBe("accepted");
  });
});
