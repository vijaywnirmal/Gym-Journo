import { describe, expect, it } from "vitest";
import { resolveSiteUrl } from "./siteUrl";

const requestHeaders = (values: Record<string, string>) => new Headers(values);

describe("resolveSiteUrl", () => {
  it("uses NEXT_PUBLIC_SITE_URL over the request's origin", () => {
    expect(
      resolveSiteUrl("https://gym.example.com", requestHeaders({ origin: "https://preview-abc.vercel.app" })),
    ).toBe("https://gym.example.com");
  });

  it("drops trailing slashes so paths can be appended", () => {
    expect(resolveSiteUrl("https://gym.example.com/ ", requestHeaders({}))).toBe("https://gym.example.com");
  });

  it("falls back to the request's origin, then its host, when unset or blank", () => {
    expect(resolveSiteUrl(undefined, requestHeaders({ origin: "http://localhost:3000" }))).toBe(
      "http://localhost:3000",
    );
    expect(resolveSiteUrl("  ", requestHeaders({ host: "192.168.1.8:3000" }))).toBe("http://192.168.1.8:3000");
    expect(resolveSiteUrl(undefined, requestHeaders({}))).toBe("http://localhost:3000");
  });
});
