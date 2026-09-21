const MODEL = "gemini-3.6-flash";
export const GEMINI_MODEL = MODEL;

export type GeminiOptions = {
  // Ask for a JSON response (Coach's contract is JSON). Off by default: AI Plan wants markdown.
  json?: boolean;
  // Per-attempt timeout.
  timeoutMs?: number;
  // How much the model "thinks" before answering. Unset leaves the model's default, which for this
  // model can take 20+ seconds even for a one-word reply; a structured, evidence-bound task needs
  // little reasoning, so Coach asks for "minimal".
  thinkingLevel?: "minimal" | "low";
  // Extra attempts after a transient 503 ("high demand"). Unset means no retry.
  retries?: number;
  // Pause before each retry, so a retry doesn't land in the same overload. Default none.
  retryDelayMs?: number;
};

export async function generateWithGemini(prompt: string, options: GeminiOptions = {}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const generationConfig = {
    ...(options.json ? { responseMimeType: "application/json" } : {}),
    ...(options.thinkingLevel ? { thinkingConfig: { thinkingLevel: options.thinkingLevel } } : {}),
  };
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
  });

  let res: Response;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey,
        },
        body,
        signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
      }
    );
    if (res.status === 503 && attempt < (options.retries ?? 0)) {
      if (options.retryDelayMs) await new Promise((resolve) => setTimeout(resolve, options.retryDelayMs));
      continue;
    }
    break;
  }

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Gemini request failed (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  const parts: { text?: string; thought?: boolean }[] = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .filter((part) => part.text && !part.thought)
    .map((part) => part.text)
    .join("");
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}
