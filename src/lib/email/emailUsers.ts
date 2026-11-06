import { createAdminClient } from "@/lib/supabase/admin";
import type { PushPayload } from "@/lib/push/reminderMessage";
import { emailConfigFromEnv, sendEmails } from "./send";
import { renderEmail } from "./template";

// Links in emails always go to the real app, whichever deployment sent them.
const PRODUCTION_URL = "https://gymjourno.fit";

// Emails a message to these people. Reads their addresses with the service role, so like notifyUser
// call it only after the database has confirmed the right to. Never throws.
export async function emailUsers(userIds: string[], message: PushPayload): Promise<void> {
  const config = emailConfigFromEnv();
  const admin = createAdminClient();
  if (!config || !admin || userIds.length === 0) return;
  try {
    const users = await Promise.all(userIds.map((id) => admin.auth.admin.getUserById(id)));
    const addresses = users.flatMap(({ data }) => (data.user?.email ? [data.user.email] : []));
    const site = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || PRODUCTION_URL).replace(/\/+$/, "");
    const email = renderEmail({
      title: message.title,
      body: message.body,
      buttonLabel: "Open GymJourno",
      buttonUrl: `${site}${message.url}`,
    });
    await sendEmails(addresses.map((to) => ({ ...email, to })), config);
  } catch (error) {
    console.error("Couldn't send an email", error);
  }
}
