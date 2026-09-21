import { generateWithGemini, GEMINI_MODEL, type GeminiOptions } from "@/lib/gemini";
import { generateWithOpenAiCompatible } from "@/lib/openaiCompatible";

// Which model provider the app talks to, chosen by the AI_PROVIDER environment variable so it can be
// changed without touching code:
//
//   gemini       (default) Google's Gemini API — GEMINI_API_KEY
//   agentrouter  a third-party gateway, for the development build only — AGENTROUTER_API_KEY
//                (optional: AGENTROUTER_MODEL, AGENTROUTER_BASE_URL)
//
// Before a production launch, run on a provider with published pricing, retention and data terms
// (Gemini, Claude, ...). Changing the provider changes who receives people's training data, so
// Coach's consent wording (providerLabel below) and people's consent must be revisited with it.

export type AiOptions = GeminiOptions;

export type AiProviderId = "gemini" | "agentrouter";

export type AiProviderInfo = {
  id: AiProviderId;
  // Who receives the data, in words a person would recognise — used in Coach's consent text.
  label: string;
  model: string;
};

type Env = Record<string, string | undefined>;

const DEFAULT_AGENTROUTER_MODEL = "deepseek-v4-flash";
const DEFAULT_AGENTROUTER_BASE_URL = "https://agentrouter.org/v1";

const UNKNOWN_LABEL = "an external AI model";

export function activeProvider(env: Env = process.env): AiProviderInfo {
  const id = (env.AI_PROVIDER ?? "gemini").trim().toLowerCase() || "gemini";
  if (id === "gemini") {
    return { id, label: "Google's Gemini model", model: GEMINI_MODEL };
  }
  if (id === "agentrouter") {
    return {
      id,
      label: "AgentRouter, a third-party AI gateway that passes it on to a model provider",
      model: env.AGENTROUTER_MODEL?.trim() || DEFAULT_AGENTROUTER_MODEL,
    };
  }
  throw new Error(`Unknown AI_PROVIDER "${id}". Use "gemini" or "agentrouter".`);
}

// For screens that only describe the provider: never throws, so a mistyped setting can't break a page.
export function providerLabel(env: Env = process.env): string {
  try {
    return activeProvider(env).label;
  } catch {
    return UNKNOWN_LABEL;
  }
}

// What Coach records as the model that produced a reply: provider and model, so the same model name
// reached through two different gateways can still be told apart.
export function providerModelId(env: Env = process.env): string {
  const info = activeProvider(env);
  return `${info.id}:${info.model}`;
}

export async function generateText(prompt: string, options: AiOptions = {}, env: Env = process.env): Promise<string> {
  const info = activeProvider(env);
  if (info.id === "gemini") return generateWithGemini(prompt, options);

  const apiKey = env.AGENTROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("AGENTROUTER_API_KEY is not configured.");
  return generateWithOpenAiCompatible(
    prompt,
    {
      baseUrl: env.AGENTROUTER_BASE_URL?.trim() || DEFAULT_AGENTROUTER_BASE_URL,
      apiKey,
      model: info.model,
      name: "AgentRouter",
    },
    options
  );
}
