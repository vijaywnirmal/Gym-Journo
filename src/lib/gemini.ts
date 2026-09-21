const MODEL = "gemini-3.6-flash";
export const GEMINI_MODEL = MODEL;

export type GeminiOptions = {
  // Ask for a JSON response (Coach's contract is JSON). Off by default: AI Plan wants markdown.
  json?: boolean;
  timeoutMs?: number;
};

export async function generateWithGemini(prompt: string, options: GeminiOptions = {}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        ...(options.json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
      }),
      signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}
