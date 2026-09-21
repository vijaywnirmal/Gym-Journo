import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateWithGemini, GEMINI_MODEL } from "./gemini";

const okResponse = { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "hello" }] } }] }) };
const fetchMock = vi.fn();

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-key";
  fetchMock.mockReset().mockResolvedValue(okResponse);
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const lastCall = () => {
  const [url, init] = fetchMock.mock.calls[0];
  return { url: url as string, init: init as { body: string; signal?: AbortSignal; headers: Record<string, string> } };
};

describe("generateWithGemini", () => {
  it("default call is unchanged (AI Plan): plain contents, no JSON mode, no timeout", async () => {
    expect(await generateWithGemini("prompt")).toBe("hello");
    const { url, init } = lastCall();
    expect(url).toContain(GEMINI_MODEL);
    expect(JSON.parse(init.body)).toEqual({ contents: [{ parts: [{ text: "prompt" }] }] });
    expect(init.signal).toBeUndefined();
    expect(init.headers["X-goog-api-key"]).toBe("test-key");
  });

  it("json mode asks for a JSON response", async () => {
    await generateWithGemini("prompt", { json: true });
    expect(JSON.parse(lastCall().init.body).generationConfig).toEqual({ responseMimeType: "application/json" });
  });

  it("a timeout adds an abort signal", async () => {
    await generateWithGemini("prompt", { timeoutMs: 5000 });
    expect(lastCall().init.signal).toBeInstanceOf(AbortSignal);
  });

  it("throws without an API key", async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(generateWithGemini("prompt")).rejects.toThrow(/not configured/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws on a failed response and on an empty one", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => "boom" });
    await expect(generateWithGemini("prompt")).rejects.toThrow(/failed \(500\)/);
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await expect(generateWithGemini("prompt")).rejects.toThrow(/empty response/);
  });
});
