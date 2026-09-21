import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildBodyWeightLines } from "./bodyWeightLines";
import BodyWeightFacts from "./BodyWeightFacts";
import { summarizeBodyWeight, type BodyWeightFacts as Facts } from "@/lib/analyze/bodyWeight";
import { getTargetWeightKg, formatGoalSummary } from "@/lib/home";
import { shiftDate, today } from "@/lib/date";
import type { BodyMeasurement } from "@/lib/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("./actions", () => ({ saveMeasurement: vi.fn(), deleteMeasurement: vi.fn() }));
const { default: BodyMeasurementsSection } = await import("./BodyMeasurementsSection");

const facts = (over: Partial<Facts> = {}): Facts => ({
  measurementCount: 2,
  earliest: { date: "2026-07-02", weightKg: 70 },
  latest: { date: "2026-09-18", weightKg: 72 },
  changeKg: 2,
  ...over,
});

describe("buildBodyWeightLines", () => {
  it("shows dated latest and earliest values, the raw change, the target and the distance", () => {
    expect(buildBodyWeightLines(facts(), 68)).toEqual({
      latestLine: "Latest: 72.0 kg · Sep 18, 2026",
      earliestLine: "Earliest: 70.0 kg · Jul 2, 2026",
      changeLine: "Change: +2.0 kg",
      targetLine: "Target: 68.0 kg",
      distanceLine: "Distance to target: +4.0 kg",
    });
  });

  it("9. no target: no target or distance lines", () => {
    const lines = buildBodyWeightLines(facts(), null);
    expect(lines.targetLine).toBeNull();
    expect(lines.distanceLine).toBeNull();
    expect(lines.latestLine).toBe("Latest: 72.0 kg · Sep 18, 2026");
  });

  it("6. a negative and a zero change", () => {
    expect(buildBodyWeightLines(facts({ changeKg: -2.5 }), null).changeLine).toBe("Change: −2.5 kg");
    expect(buildBodyWeightLines(facts({ changeKg: 0 }), null).changeLine).toBe("Change: 0.0 kg");
  });

  it("10. distance below the target and at the target", () => {
    expect(buildBodyWeightLines(facts({ latest: { date: "2026-09-18", weightKg: 65 } }), 68).distanceLine).toBe(
      "Distance to target: −3.0 kg"
    );
    expect(buildBodyWeightLines(facts({ latest: { date: "2026-09-18", weightKg: 68 } }), 68).distanceLine).toBe(
      "Distance to target: 0.0 kg"
    );
  });

  it("2. a single measurement is stated once, with no earliest or change lines — but the target still applies", () => {
    const single = facts({
      measurementCount: 1,
      earliest: { date: "2026-09-18", weightKg: 72 },
      changeKg: null,
    });
    const lines = buildBodyWeightLines(single, 68);
    expect(lines.latestLine).toBe("Latest: 72.0 kg · Sep 18, 2026");
    expect(lines.earliestLine).toBeNull();
    expect(lines.changeLine).toBeNull();
    expect(lines.distanceLine).toBe("Distance to target: +4.0 kg");
  });

  it("floating-point noise never reaches the display", () => {
    expect(buildBodyWeightLines(facts({ changeKg: 72.3 - 70.1 }), null).changeLine).toBe("Change: +2.2 kg");
  });

  it("shows the year so a multi-year history is unambiguous", () => {
    const lines = buildBodyWeightLines(
      facts({ earliest: { date: "2025-06-02", weightKg: 80 }, latest: { date: "2026-09-18", weightKg: 72 }, changeKg: -8 }),
      null
    );
    expect(lines.earliestLine).toBe("Earliest: 80.0 kg · Jun 2, 2025");
  });
});

describe("getTargetWeightKg — the goal rule shared with Home", () => {
  it("8. returns the target for goals that use one", () => {
    expect(getTargetWeightKg("lose_fat", 68)).toBe(68);
    expect(getTargetWeightKg("build_muscle", 85)).toBe(85);
  });

  it("9. returns null when there is no target, no goal, or a goal that doesn't use a target", () => {
    expect(getTargetWeightKg("lose_fat", null)).toBeNull();
    expect(getTargetWeightKg(null, 68)).toBeNull();
    expect(getTargetWeightKg("maintain", 68)).toBeNull();
    expect(getTargetWeightKg("general_fitness", 68)).toBeNull();
  });

  it("Home's goal line still shows the same target under the shared rule", () => {
    const summary = (goal: string, target: number | null) =>
      formatGoalSummary({ primary_goal: goal, training_days_per_week: 4, target_weight_kg: target });
    expect(summary("lose_fat", 68)?.targetLine).toBe("Target: 68 kg");
    expect(summary("maintain", 68)?.targetLine).toBeNull();
    expect(summary("lose_fat", null)?.targetLine).toBeNull();
  });
});

describe("BodyWeightFacts component", () => {
  const html = (f: Facts | null, target: number | null) =>
    renderToStaticMarkup(createElement(BodyWeightFacts, { facts: f, targetWeightKg: target }));

  it("1. no measurements: a plain empty state", () => {
    const out = html(null, 68);
    expect(out).toContain("No weight measurements recorded yet.");
    expect(out).not.toContain("Latest:");
    expect(out).not.toContain("Distance");
  });

  it("renders the dated facts in order", () => {
    const out = html(facts(), 68).replace(/<[^>]+>/g, "|");
    expect(out).toContain("Body weight");
    const positions = [
      "Latest: 72.0 kg · Sep 18, 2026",
      "Earliest: 70.0 kg · Jul 2, 2026",
      "Change: +2.0 kg",
      "Target: 68.0 kg",
      "Distance to target: +4.0 kg",
    ].map((line) => out.indexOf(line));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("uses no evaluative, direction, or coaching language", () => {
    const text = (html(facts(), 68) + html(facts({ changeKg: -2 }), null))
      .replace(/<[^>]+>/g, " ")
      .toLowerCase();
    for (const forbidden of [
      "progress",
      "improv",
      "toward",
      "away",
      "on track",
      "healthy",
      "good",
      "bad",
      "should",
      "gained",
      "lost",
      "goal met",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe("Latest weight card ignores future-dated measurements", () => {
  const row = (date: string, weight_kg: number): BodyMeasurement => ({
    id: date,
    user_id: "u",
    date,
    weight_kg,
    notes: null,
    created_at: "",
    updated_at: "",
  });
  const card = (measurements: BodyMeasurement[]) => {
    const out = renderToStaticMarkup(createElement(BodyMeasurementsSection, { measurements }));
    return out.slice(out.indexOf("Latest weight"), out.indexOf("</div>", out.indexOf("Latest weight")));
  };

  it("7. shows the newest non-future record, not a future one", () => {
    const html = card([row(shiftDate(today(), 2), 90), row(shiftDate(today(), -3), 75)]);
    expect(html).toContain("75 kg");
    expect(html).not.toContain("90 kg");
  });

  it("12. with only ordinary past records the card is unchanged (newest first)", () => {
    expect(card([row(shiftDate(today(), -1), 74), row(shiftDate(today(), -9), 75)])).toContain("74 kg");
  });

  it("1. with no records it shows the empty dash", () => {
    expect(card([])).toContain("—");
  });
});

describe("summarizeBodyWeight feeds the same figures the page shows", () => {
  it("3. end to end from raw measurement rows to display lines", () => {
    const rows = [
      { date: "2026-09-18", weight_kg: 72 },
      { date: "2026-08-05", weight_kg: 71 },
      { date: "2026-07-02", weight_kg: 70 },
      { date: "2026-09-30", weight_kg: 99 }, // future
    ];
    const lines = buildBodyWeightLines(summarizeBodyWeight(rows, "2026-09-21")!, 68);
    expect(lines.latestLine).toBe("Latest: 72.0 kg · Sep 18, 2026");
    expect(lines.earliestLine).toBe("Earliest: 70.0 kg · Jul 2, 2026");
    expect(lines.changeLine).toBe("Change: +2.0 kg");
    expect(lines.distanceLine).toBe("Distance to target: +4.0 kg");
  });
});
