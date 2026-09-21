import { describe, expect, it } from "vitest";
import { initialsOf, joinName, namePartsOf, splitFullName, validateName } from "./names";

describe("splitFullName", () => {
  it("splits at the first space", () => {
    expect(splitFullName("Vijay Nirmal")).toEqual({ firstName: "Vijay", lastName: "Nirmal" });
    expect(splitFullName("Mary Ann Smith")).toEqual({ firstName: "Mary", lastName: "Ann Smith" });
  });

  it("handles a single name, extra spaces, and nothing", () => {
    expect(splitFullName("Vijay")).toEqual({ firstName: "Vijay", lastName: "" });
    expect(splitFullName("  Vijay    Nirmal  ")).toEqual({ firstName: "Vijay", lastName: "Nirmal" });
    expect(splitFullName("   ")).toEqual({ firstName: "", lastName: "" });
    expect(splitFullName(null)).toEqual({ firstName: "", lastName: "" });
  });
});

describe("joinName", () => {
  it("joins the parts that exist, with single spaces", () => {
    expect(joinName("Vijay", "Nirmal")).toBe("Vijay Nirmal");
    expect(joinName("  Vijay ", "")).toBe("Vijay");
    expect(joinName("", "Nirmal")).toBe("Nirmal");
    expect(joinName(null, undefined)).toBe("");
    expect(joinName("Mary", " Ann   Smith ")).toBe("Mary Ann Smith");
  });
});

describe("namePartsOf", () => {
  it("prefers the stored first and last name", () => {
    expect(namePartsOf({ first_name: "Vijay", last_name: "Nirmal", full_name: "Old Name" })).toEqual({
      firstName: "Vijay",
      lastName: "Nirmal",
    });
  });

  it("falls back to splitting full_name for a profile that has no separate parts yet", () => {
    expect(namePartsOf({ first_name: null, last_name: null, full_name: "Vijay Nirmal" })).toEqual({
      firstName: "Vijay",
      lastName: "Nirmal",
    });
  });

  it("a first name alone is respected (no fallback overriding it)", () => {
    expect(namePartsOf({ first_name: "Vijay", last_name: null, full_name: "Vijay Nirmal" })).toEqual({
      firstName: "Vijay",
      lastName: "",
    });
  });

  it("is empty for no profile", () => {
    expect(namePartsOf(null)).toEqual({ firstName: "", lastName: "" });
  });
});

describe("initialsOf", () => {
  it("is the first letter of each part, capitalised", () => {
    expect(initialsOf("vijay", "nirmal")).toBe("VN");
    expect(initialsOf("Vijay", "")).toBe("V");
    expect(initialsOf("", "Nirmal")).toBe("N");
  });

  it("uses a placeholder when there is no name, and copes with non-Latin names", () => {
    expect(initialsOf("", "")).toBe("?");
    expect(initialsOf("विजय", "")).toBe("व");
  });
});

describe("validateName", () => {
  it("requires a name only when required", () => {
    expect(validateName("  ", "first name", true)).toBe("Enter your first name.");
    expect(validateName("", "last name", false)).toBeNull();
  });

  it("accepts ordinary names, including spaces, hyphens and apostrophes", () => {
    expect(validateName("Mary Ann", "first name", true)).toBeNull();
    expect(validateName("O'Brien-Smith", "last name", true)).toBeNull();
  });

  it("rejects a name over 50 characters, and accepts exactly 50", () => {
    expect(validateName("x".repeat(50), "first name", true)).toBeNull();
    expect(validateName("x".repeat(51), "first name", true)).toBe("First name must be 50 characters or fewer.");
  });
});
