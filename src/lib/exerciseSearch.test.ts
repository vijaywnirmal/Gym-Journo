import { describe, expect, it } from "vitest";
import { searchWords } from "./exerciseSearch";

describe("searchWords", () => {
  it("lowercases and splits on whitespace", () => {
    expect(searchWords("  Bench   PRESS ")).toEqual(["bench", "press"]);
  });

  it("expands common gym shorthand", () => {
    expect(searchWords("db press")).toEqual(["dumbbell", "press"]);
    expect(searchWords("OHP")).toEqual(["overhead", "press"]);
    expect(searchWords("rdl")).toEqual(["romanian", "deadlift"]);
  });

  it("drops apostrophes and turns other punctuation into word breaks", () => {
    expect(searchWords("Farmer's")).toEqual(["farmers"]);
    expect(searchWords("close-grip")).toEqual(["close", "grip"]);
  });

  it("strips accents", () => {
    expect(searchWords("Élévation")).toEqual(["elevation"]);
  });

  it("returns nothing for a blank term", () => {
    expect(searchWords("   ")).toEqual([]);
    expect(searchWords("!!")).toEqual([]);
  });
});
