import type { GeminiOptions } from "@/lib/gemini";

// A client for any "OpenAI-style" chat-completions endpoint (AgentRouter, OpenRouter, DeepSeek's own
// API, ...). Same call shape as generateWithGemini so the two are interchangeable behind ai.ts.

export type OpenAiCompatibleConfig = {
  // e.g. https://agentrouter.org/v1 — the path /chat/completions is added here.
  baseUrl: string;
  apiKey: string;
  model: string;
  // Used in error messages only ("AgentRouter request failed (402)").
  name: string;
};

// Gateways answer 502/503/504 when their upstream hiccups; those are worth a retry. Anything else
// (auth, quota, bad request) won't change by asking again.
const RETRYABLE_STATUSES = new Set([502, 503, 504]);
const MAX_ERROR_BODY_CHARS = 500;

// Some models wrap JSON in a ``` fence even when asked not to; Coach's contract is strict JSON, so
// unwrap that one harmless case rather than reject a good answer.
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  const firstNewline = trimmed.indexOf("\n");
  if (firstNewline === -1) return trimmed;
  const body = trimmed.slice(firstNewline + 1);
  const closing = body.lastIndexOf("```");
  return (closing === -1 ? body : body.slice(0, closing)).trim();
}

function contentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string" ? (part as { text: string }).text : ""))
      .join("");
  }
  return "";
}

export async function generateWithOpenAiCompatible(
  prompt: string,
  config: OpenAiCompatibleConfig,
  options: GeminiOptions = {}
): Promise<string> {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const body = JSON.stringify({
    model: config.model,
    messages: [{ role: "user", content: prompt }],
    ...(options.json ? { response_format: { type: "json_object" } } : {}),
  });

  let res: Response;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body,
      signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
    });
    if (RETRYABLE_STATUSES.has(res.status) && attempt < (options.retries ?? 0)) {
      if (options.retryDelayMs) await new Promise((resolve) => setTimeout(resolve, options.retryDelayMs));
      continue;
    }
    break;
  }

  if (!res.ok) {
    const errorBody = (await res.text()).slice(0, MAX_ERROR_BODY_CHARS);
    throw new Error(`${config.name} request failed (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  const text = contentText(data?.choices?.[0]?.message?.content);
  if (!text.trim()) throw new Error(`${config.name} returned an empty response.`);
  return options.json ? stripCodeFence(text) : text;
}
