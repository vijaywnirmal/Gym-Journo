import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CoachReplyView from "./CoachReplyView";
import { COACH_CONSENT } from "@/lib/coach/consent";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: unknown }) =>
    createElement("a", { href }, children as never),
}));
vi.mock("@/app/profile/actions", () => ({ setCoachConsent: vi.fn() }));
vi.mock("./actions", () => ({ askCoach: vi.fn() }));

const { default: CoachConsentSection } = await import("@/app/profile/CoachConsentSection");
const { default: CoachChat } = await import("./CoachChat");

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

describe("CoachReplyView", () => {
  const html = renderToStaticMarkup(
    createElement(CoachReplyView, {
      reply: {
        statements: [
          { kind: "fact", text: "Bench Press was last performed on Sep 18.", cites: ["exercise.ex-bench"] },
          { kind: "interpretation", text: "Set 1 reps differ by 2 between Sep 11 and Sep 18.", cites: ["exercise.ex-bench"] },
        ],
        questions: ["Was Sep 11 a lighter session?"],
      },
      sources: [{ id: "exercise.ex-bench", label: "Bench Press" }],
    })
  );

  it("presents each statement with whether it restates the records or is a reading of them", () => {
    const out = text(html);
    expect(out).toContain("From your records Bench Press was last performed on Sep 18.");
    expect(out).toContain("A reading of your records Set 1 reps differ by 2 between Sep 11 and Sep 18.");
  });

  it("shows what the answer is based on, Coach's questions, and the honest caveat", () => {
    const out = text(html);
    expect(out).toContain("Based on: Bench Press");
    expect(out).toContain("Coach asks");
    expect(out).toContain("Was Sep 11 a lighter session?");
    expect(out).toContain("Checked against your records");
    expect(out).toContain("effort isn't tracked");
  });

  it("omits the questions and sources blocks when there are none", () => {
    const bare = text(
      renderToStaticMarkup(
        createElement(CoachReplyView, {
          reply: { statements: [{ kind: "fact", text: "x", cites: ["goal"] }], questions: [] },
          sources: [],
        })
      )
    );
    expect(bare).not.toContain("Coach asks");
    expect(bare).not.toContain("Based on");
  });
});

describe("CoachConsentSection", () => {
  const render = (consentedAt: string | null) =>
    text(renderToStaticMarkup(createElement(CoachConsentSection, { consentedAt })));

  it("without consent: explains what is and isn't sent, and offers to allow — no withdraw, no link to Coach", () => {
    const out = render(null);
    for (const line of [...COACH_CONSENT.shared, ...COACH_CONSENT.notShared]) expect(out).toContain(line);
    expect(out).toContain(COACH_CONSENT.summary);
    expect(out).toContain(COACH_CONSENT.dataUse);
    expect(out).toContain(COACH_CONSENT.kept);
    expect(out).toContain(COACH_CONSENT.withdraw);
    expect(out).toContain("Allow Coach to use my training data");
    expect(out).not.toContain("Withdraw consent");
    expect(out).not.toContain("Open Coach");
  });

  it("with consent: shows since when, a way to open Coach, and how to withdraw", () => {
    const out = render("2026-09-01T10:00:00Z");
    expect(out).toContain("Allowed since Sep 1, 2026");
    expect(out).toContain("Open Coach");
    expect(out).toContain("Withdraw consent");
    expect(out).not.toContain("Allow Coach to use my training data");
  });
});

describe("CoachChat", () => {
  const out = text(renderToStaticMarkup(createElement(CoachChat)));

  it("offers an input and explain-style suggestions only", () => {
    expect(out).toContain("Ask Coach");
    expect(out).toContain("What changed in the last two weeks?");
    expect(out).not.toMatch(/should i|recommend|advice/i);
  });
});
