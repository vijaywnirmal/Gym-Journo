import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activeProvider, generateText, providerLabel, providerModelId } from "./ai";

describe("activeProvider", () => {
  it("defaults to Gemini when AI_PROVIDER is unset or blank", () => {
    expect(activeProvider({}).id).toBe("gemini");
    expect(activeProvider({ AI_PROVIDER: "" }).id).toBe("gemini");
    expect(activeProvider({ AI_PROVIDER: "   " }).id).toBe("gemini");
  });

  it("recognises providers regardless of case and stray spaces", () => {
    expect(activeProvider({ AI_PROVIDER: " AgentRouter " }).id).toBe("agentrouter");
    expect(activeProvider({ AI_PROVIDER: "GEMINI" }).id).toBe("gemini");
  });

  it("AgentRouter defaults to the low-cost model, and the model can be overridden", () => {
    expect(activeProvider({ AI_PROVIDER: "agentrouter" }).model).toBe("deepseek-v4-flash");
    expect(activeProvider({ AI_PROVIDER: "agentrouter", AGENTROUTER_MODEL: " glm-5.3 " }).model).toBe("glm-5.3");
    expect(activeProvider({ AI_PROVIDER: "agentrouter", AGENTROUTER_MODEL: "" }).model).toBe("deepseek-v4-flash");
  });

  it("throws on a provider it doesn't know, rather than quietly using another one", () => {
    expect(() => activeProvider({ AI_PROVIDER: "gemin" })).toThrow(/Unknown AI_PROVIDER "gemin"/);
  });
});

describe("providerLabel — the recipient named in Coach's consent text", () => {
  it("names Google for Gemini and the gateway for AgentRouter", () => {
    expect(providerLabel({})).toBe("Google's Gemini model");
    expect(providerLabel({ AI_PROVIDER: "agentrouter" })).toMatch(/^AgentRouter, a third-party AI gateway/);
  });

  it("never throws: a mistyped provider gets a neutral label so a page can't break", () => {
    expect(providerLabel({ AI_PROVIDER: "nonsense" })).toBe("an external AI model");
  });
});

describe("providerModelId", () => {
  it("records provider and model together", () => {
    expect(providerModelId({})).toMatch(/^gemini:gemini-/);
    expect(providerModelId({ AI_PROVIDER: "agentrouter" })).toBe("agentrouter:deepseek-v4-flash");
  });
});

describe("generateText", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    process.env.GEMINI_API_KEY = "gem-key";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("with Gemini, calls Google's API", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "from gemini" }] } }] }),
    });
    expect(await generateText("p", {}, {})).toBe("from gemini");
    expect(fetchMock.mock.calls[0][0]).toContain("generativelanguage.googleapis.com");
  });

  it("with AgentRouter, calls its chat-completions endpoint with the configured model and key", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "from agentrouter" } }] }),
    });
    const env = { AI_PROVIDER: "agentrouter", AGENTROUTER_API_KEY: "ar-key" };
    expect(await generateText("p", { json: true }, env)).toBe("from agentrouter");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://agentrouter.org/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer ar-key");
    expect(JSON.parse(init.body).model).toBe("deepseek-v4-flash");
  });

  it("honours a base URL override, so a paid gateway can replace it without code changes", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });
    await generateText("p", {}, { AI_PROVIDER: "agentrouter", AGENTROUTER_API_KEY: "k", AGENTROUTER_BASE_URL: "https://other.example/v1" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://other.example/v1/chat/completions");
  });

  it("with AgentRouter but no key, fails naming the variable — and makes no request", async () => {
    await expect(generateText("p", {}, { AI_PROVIDER: "agentrouter" })).rejects.toThrow("AGENTROUTER_API_KEY is not configured.");
    await expect(generateText("p", {}, { AI_PROVIDER: "agentrouter", AGENTROUTER_API_KEY: "  " })).rejects.toThrow(
      /AGENTROUTER_API_KEY/
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never sends the Gemini key to AgentRouter", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });
    await generateText("p", {}, { AI_PROVIDER: "agentrouter", AGENTROUTER_API_KEY: "ar-key" });
    expect(JSON.stringify(fetchMock.mock.calls[0])).not.toContain("gem-key");
  });

  it("rejects an unknown provider without making a request", async () => {
    await expect(generateText("p", {}, { AI_PROVIDER: "nonsense" })).rejects.toThrow(/Unknown AI_PROVIDER/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
