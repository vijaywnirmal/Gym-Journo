import type { renderEmail } from "./template";

// Sending through Resend's API (server only). Without these settings no email goes out and nothing
// else changes, like push without its keys.
export type EmailConfig = { apiKey: string; from: string };

export function emailConfigFromEnv(env: Record<string, string | undefined> = process.env): EmailConfig | null {
  const apiKey = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM;
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

export type OutgoingEmail = ReturnType<typeof renderEmail> & { to: string };

// Resend takes up to 100 at a time, so a trainer's whole client list is one or two requests.
const BATCH_SIZE = 100;

// Never throws; a failed email mustn't fail what triggered it. The log says how many, not who.
export async function sendEmails(emails: OutgoingEmail[], config: EmailConfig, send: typeof fetch = fetch): Promise<void> {
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    try {
      const response = await send("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(batch.map((email) => ({ ...email, from: config.from }))),
      });
      if (!response.ok) console.error(`Couldn't send ${batch.length} email(s): status ${response.status}`);
    } catch (error) {
      console.error(`Couldn't send ${batch.length} email(s)`, error);
    }
  }
}
