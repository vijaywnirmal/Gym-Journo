import { describe, expect, it } from "vitest";
import {
  decodeCursor,
  encodeCursor,
  exerciseGroupsUrl,
  exerciseListQuerySchema,
  exerciseListUrl,
  exerciseTutorialUrl,
  instructionSteps,
} from "./exerciseLibrary";

const ID = "3f1c2b8e-5d4a-4c6b-9a7e-2b1d0c9e8f7a";

describe("cursors", () => {
  it("round-trip a name and id, including punctuation and non-ASCII names", () => {
    for (const name of ["Barbell Bench Press", "Rowing, Stationary", "Farmer's Walk", "Élévation « 3/4 »"]) {
      expect(decodeCursor(encodeCursor({ name, id: ID }))).toEqual({ name, id: ID });
    }
  });

  it("are URL-safe", () => {
    expect(encodeCursor({ name: "???>>>~~~", id: ID })).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("reject anything this API didn't issue", () => {
    expect(decodeCursor("not a cursor")).toBeNull();
    expect(decodeCursor(btoa(JSON.stringify({ name: "x", id: ID })))).toBeNull();
    expect(decodeCursor(btoa(JSON.stringify(["x", "not-a-uuid"])))).toBeNull();
    expect(decodeCursor(btoa(JSON.stringify(["", ID])))).toBeNull();
  });
});

describe("exerciseListQuerySchema", () => {
  it("accepts the documented params and trims the search term", () => {
    expect(exerciseListQuerySchema.parse({ muscleGroup: ID, q: "  bench ", equipment: "Barbell" })).toEqual({
      muscleGroup: ID,
      q: "bench",
      equipment: "Barbell",
    });
    expect(exerciseListQuerySchema.parse({})).toEqual({});
  });

  it("rejects unknown equipment, bad ids and overlong searches", () => {
    expect(exerciseListQuerySchema.safeParse({ equipment: "Spaceship" }).success).toBe(false);
    expect(exerciseListQuerySchema.safeParse({ muscleGroup: "chest" }).success).toBe(false);
    expect(exerciseListQuerySchema.safeParse({ q: "x".repeat(101) }).success).toBe(false);
  });
});

describe("URLs", () => {
  it("include only the params that are set", () => {
    expect(exerciseListUrl({})).toBe("/api/exercises");
    expect(exerciseListUrl({ term: "  ", equipment: null, muscleGroupId: ID })).toBe(`/api/exercises?muscleGroup=${ID}`);
    expect(exerciseListUrl({ term: "db press", cursor: "abc" })).toBe("/api/exercises?q=db+press&cursor=abc");
    expect(exerciseGroupsUrl({ equipment: "Cable" })).toBe("/api/exercises/groups?equipment=Cable");
    expect(exerciseTutorialUrl(ID)).toBe(`/api/exercises/${ID}`);
  });
});

describe("instructionSteps", () => {
  it("splits stored instructions into trimmed, non-empty steps", () => {
    expect(instructionSteps("Stand tall.\n\n  Brace.  \nLift.")).toEqual(["Stand tall.", "Brace.", "Lift."]);
    expect(instructionSteps("One paragraph only.")).toEqual(["One paragraph only."]);
    expect(instructionSteps(null)).toEqual([]);
  });
});
