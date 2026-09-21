import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ProfileFieldsValue } from "@/lib/profile-fields";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("./actions", () => ({ updateProfile: vi.fn() }));

const { default: ProfileCard } = await import("./ProfileCard");
const { default: ProfileFields } = await import("@/components/ProfileFields");

const fields: ProfileFieldsValue = {
  firstName: "Vijay",
  lastName: "Nirmal",
  dateOfBirth: "1995-09-19",
  heightCm: "174",
  weightKg: "71",
  gender: "male",
  primaryGoal: "build_muscle",
  targetWeightKg: "",
  experienceLevel: "intermediate",
  trainingDaysPerWeek: "5",
};

const render = (initial: ProfileFieldsValue, email: string | null = "v@example.com") =>
  renderToStaticMarkup(createElement(ProfileCard, { initial, email }));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("ProfileCard (view mode)", () => {
  it("shows the person as a card — name, email, initials — not a form", () => {
    const html = render(fields);
    expect(text(html)).toContain("Vijay Nirmal");
    expect(text(html)).toContain("v@example.com");
    expect(html).toContain(">VN<");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<select");
  });

  it("offers Edit, and no Save until editing", () => {
    const html = render(fields);
    expect(html).toMatch(/<button[^>]*>Edit<\/button>/);
    expect(html).not.toContain("Save changes");
  });

  it("shows details as label/value rows, with Gender (not Sex)", () => {
    const t = text(render(fields));
    expect(t).toContain("Date of birth Sep 19, 1995");
    expect(t).toContain("Gender Male");
    expect(t).toContain("Height 174 cm");
    expect(t).toContain("Primary goal Build muscle");
    expect(t).toContain("Training days 5 per week");
    expect(t).not.toMatch(/\bSex\b/);
  });

  it("says 'Not set' for what is missing and prompts for a name when there is none", () => {
    const empty = render({ ...fields, firstName: "", lastName: "", dateOfBirth: "", gender: "" }, null);
    expect(text(empty)).toContain("Add your name");
    expect(text(empty)).toContain("Date of birth Not set");
    expect(text(empty)).toContain("Gender Not set");
    expect(empty).toContain(">?<");
    expect(text(empty)).not.toMatch(/\bnull\b|\bundefined\b/);
  });

  it("omits the email line when there is none", () => {
    expect(text(render(fields, null))).not.toContain("@");
  });
});

describe("ProfileFields (edit and onboarding)", () => {
  const html = renderToStaticMarkup(createElement(ProfileFields, { value: fields, onChange: () => {} }));

  it("captures first and last name separately, and Gender", () => {
    expect(html).toContain("First name");
    expect(html).toContain("Last name");
    expect(html).toContain("Gender");
    expect(html).not.toMatch(/>Name</);
    expect(html).not.toMatch(/\bSex\b/);
  });

  it("offers each gender option plus 'Prefer not to say', with a prompt to choose", () => {
    for (const label of ["Select gender", "Male", "Female", "Other", "Prefer not to say"]) {
      expect(html).toContain(`>${label}</option>`);
    }
  });

  it("gives every text control, dropdown and date field the same height", () => {
    const controls = html.match(/<(input|select)\b[^>]*>/g) ?? [];
    expect(controls.length).toBeGreaterThanOrEqual(8);
    for (const c of controls) expect(c).toContain("h-12");
  });

  it("wraps each control in a label so clicking the label focuses it", () => {
    expect((html.match(/<label/g) ?? []).length).toBeGreaterThanOrEqual(9);
  });
});
