import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTrainingEvidence } from "@/lib/analyze/evidence";
import { buildCoachPrompt } from "./prompt";
import { coachEvidence } from "./testFixtures";
import { generateWithGemini } from "@/lib/gemini";

const build = (over: Partial<Parameters<typeof buildTrainingEvidence>[0]> = {}) =>
  buildTrainingEvidence({
    todayStr: "2026-09-21",
    profile: null,
    performedDates: [],
    lastPerformedWorkoutDate: null,
    bodyMeasurements: [],
    exercises: [],
    exercisesTruncated: false,
    ...over,
  });

describe("evidence.notRecorded", () => {
  it("lists body weight and recent exercises when neither has records", () => {
    expect(build().notRecorded).toEqual(["body.weight", "exercises.recent"]);
  });

  it("lists only what is actually missing", () => {
    expect(build({ bodyMeasurements: [{ date: "2026-09-18", weight_kg: 72 }] }).notRecorded).toEqual(["exercises.recent"]);
    expect(coachEvidence().notRecorded).toEqual([]);
  });

  it("a future-dated weight does not count as a record", () => {
    expect(build({ bodyMeasurements: [{ date: "2026-09-30", weight_kg: 99 }] }).notRecorded).toContain("body.weight");
  });

  it("stays plain JSON", () => {
    const e = build();
    expect(JSON.parse(JSON.stringify(e))).toEqual(e);
  });
});

describe("Coach prompt — wording rules", () => {
  const prompt = buildCoachPrompt(build(), "What do my records show?");

  it("tells the model to say null as 'not recorded' and never write raw values", () => {
    expect(prompt).toMatch(/null means "not recorded" or "not set"/);
    expect(prompt).toMatch(/never write null, undefined or NaN/);
  });

  it("asks for dates in words and only dates from the cited evidence", () => {
    expect(prompt).toMatch(/like "Sep 21, 2026", not "2026-09-21"/);
    expect(prompt).toMatch(/must be a date that appears in a section you cite/);
  });

  it("explains how to cite an absence and lists the absent ids", () => {
    expect(prompt).toMatch(/cite the section id that starts with "absent:"/);
    expect(prompt).toContain("\nabsent:body.weight\n");
    expect(prompt).toContain("\nabsent:exercises.recent\n");
  });

  it("lists no absent ids when everything is recorded", () => {
    expect(buildCoachPrompt(coachEvidence(), "q")).not.toContain("\nabsent:");
  });
});

describe("generateWithGemini retryDelayMs", () => {
  const fetchMock = vi.fn();
  const ok = { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "hello" }] } }] }) };
  const busy = { ok: false, status: 503, text: async () => "high demand" };

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("waits before retrying a 503, then succeeds", async () => {
    fetchMock.mockResolvedValueOnce(busy).mockResolvedValueOnce(busy).mockResolvedValueOnce(ok);
    const promise = generateWithGemini("p", { retries: 2, retryDelayMs: 1500 });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1); // first attempt made; now waiting
    await vi.advanceTimersByTimeAsync(1499);
    expect(fetchMock).toHaveBeenCalledTimes(1); // still waiting
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1500);
    expect(await promise).toBe("hello");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not wait when no delay is set", async () => {
    fetchMock.mockResolvedValueOnce(busy).mockResolvedValueOnce(ok);
    expect(await generateWithGemini("p", { retries: 1 })).toBe("hello");
  });
});
