import { describe, expect, it } from "vitest";
import { renderEmail } from "./template";

const content = {
  title: "You're no longer a member of Iron Temple",
  body: "Your workouts and history are still here.",
  buttonLabel: "Open GymJourno",
  buttonUrl: "https://example.test/profile",
};

describe("renderEmail", () => {
  it("has the message and the link, in both versions", () => {
    const { subject, html, text } = renderEmail(content);
    expect(subject).toBe(content.title);
    expect(html).toContain("You&#39;re no longer a member of Iron Temple");
    expect(html).toContain('href="https://example.test/profile"');
    expect(text).toContain(content.title);
    expect(text).toContain("Open GymJourno: https://example.test/profile");
  });

  it("doesn't let a gym's name put markup into the email", () => {
    const { html } = renderEmail({ ...content, title: 'You left <img src=x onerror="a()">' });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=&quot;a()&quot;&gt;");
  });
});
