import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateWithOpenAiCompatible } from "./openaiCompatible";

const config = {
  baseUrl: "https://gateway.example/v1",
  apiKey: "test-key-123",
  model: "cheap-model",
  name: "TestGateway",
};

const fetchMock = vi.fn();
const completion = (content: unknown) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content } }] }),
});
const failure = (status: number, body = "nope") => ({ ok: false, status, text: async () => body });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("request shape", () => {
  it("posts a chat-completions request with the key as a bearer token", async () => {
    fetchMock.mockResolvedValue(completion("hello"));
    expect(await generateWithOpenAiCompatible("the prompt", config)).toBe("hello");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://gateway.example/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-key-123");
    expect(JSON.parse(init.body)).toEqual({
      model: "cheap-model",
      messages: [{ role: "user", content: "the prompt" }],
    });
  });

  it("tolerates a trailing slash on the base URL", async () => {
    fetchMock.mockResolvedValue(completion("ok"));
    await generateWithOpenAiCompatible("p", { ...config, baseUrl: "https://gateway.example/v1///" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://gateway.example/v1/chat/completions");
  });

  it("asks for a JSON object only when json is requested", async () => {
    fetchMock.mockResolvedValue(completion("{}"));
    await generateWithOpenAiCompatible("p", config, { json: true });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).response_format).toEqual({ type: "json_object" });

    await generateWithOpenAiCompatible("p", config);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty("response_format");
  });

  it("ignores Gemini-only options such as thinkingLevel", async () => {
    fetchMock.mockResolvedValue(completion("ok"));
    await generateWithOpenAiCompatible("p", config, { thinkingLevel: "minimal" });
    expect(fetchMock.mock.calls[0][1].body).not.toMatch(/thinking/i);
  });

  it("applies a per-attempt timeout only when one is set", async () => {
    fetchMock.mockResolvedValue(completion("ok"));
    await generateWithOpenAiCompatible("p", config, { timeoutMs: 5000 });
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    await generateWithOpenAiCompatible("p", config);
    expect(fetchMock.mock.calls[1][1].signal).toBeUndefined();
  });
});

describe("reading the reply", () => {
  it("joins content that arrives as text parts", async () => {
    fetchMock.mockResolvedValue(completion([{ type: "text", text: "Hel" }, { type: "text", text: "lo" }]));
    expect(await generateWithOpenAiCompatible("p", config)).toBe("Hello");
  });

  it("throws on an empty or missing reply", async () => {
    for (const content of ["", "   ", null, undefined, []]) {
      fetchMock.mockResolvedValueOnce(completion(content));
      await expect(generateWithOpenAiCompatible("p", config)).rejects.toThrow("TestGateway returned an empty response.");
    }
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    await expect(generateWithOpenAiCompatible("p", config)).rejects.toThrow(/empty response/);
  });

  it("unwraps a ```json fence around a JSON answer, and leaves plain JSON and prose alone", async () => {
    const fenced = "```json\n{\"statements\":[]}\n```";
    fetchMock.mockResolvedValueOnce(completion(fenced));
    expect(await generateWithOpenAiCompatible("p", config, { json: true })).toBe('{"statements":[]}');

    fetchMock.mockResolvedValueOnce(completion('{"a":1}'));
    expect(await generateWithOpenAiCompatible("p", config, { json: true })).toBe('{"a":1}');

    // Without json, the text is returned exactly as the model wrote it (AI Plan wants markdown).
    fetchMock.mockResolvedValueOnce(completion(fenced));
    expect(await generateWithOpenAiCompatible("p", config)).toBe(fenced);
  });
});

describe("failures", () => {
  it("reports the status in a form the Coach failure classifier recognises, and never includes the key", async () => {
    fetchMock.mockResolvedValue(failure(402, "Budget pool quota has been exhausted"));
    const error = await generateWithOpenAiCompatible("p", config).catch((e: Error) => e);
    expect((error as Error).message).toBe("TestGateway request failed (402): Budget pool quota has been exhausted");
    expect((error as Error).message).not.toContain("test-key-123");
  });

  it("keeps only the start of a very long error body", async () => {
    fetchMock.mockResolvedValue(failure(500, "x".repeat(5000)));
    const error = (await generateWithOpenAiCompatible("p", config).catch((e: Error) => e)) as Error;
    expect(error.message.length).toBeLessThan(600);
  });

  it("does not retry auth, quota or bad-request errors, even when retries are allowed", async () => {
    for (const status of [400, 401, 402, 429]) {
      fetchMock.mockReset().mockResolvedValue(failure(status));
      await expect(generateWithOpenAiCompatible("p", config, { retries: 2 })).rejects.toThrow(`(${status})`);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it("does not retry at all unless retries is set", async () => {
    fetchMock.mockResolvedValue(failure(503));
    await expect(generateWithOpenAiCompatible("p", config)).rejects.toThrow("(503)");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("retrying a gateway hiccup", () => {
  it("retries 502/503/504, pausing between attempts, then succeeds", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(failure(502))
      .mockResolvedValueOnce(failure(504))
      .mockResolvedValueOnce(completion("finally"));
    const promise = generateWithOpenAiCompatible("p", config, { retries: 2, retryDelayMs: 1500 });

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1499);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1500);
    expect(await promise).toBe("finally");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gives up after the allowed retries and reports the last status", async () => {
    fetchMock.mockResolvedValue(failure(503, "busy"));
    await expect(generateWithOpenAiCompatible("p", config, { retries: 2 })).rejects.toThrow("(503): busy");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
