import { emailUsers } from "@/lib/email/emailUsers";
import { notifyUser } from "@/lib/push/notifyUser";
import type { PushPayload } from "@/lib/push/reminderMessage";

// For news someone shouldn't miss: a notification on their devices, and an email for those without.
export async function tellPeople(userIds: string[], message: PushPayload): Promise<void> {
  await Promise.all([...userIds.map((id) => notifyUser(id, message)), emailUsers(userIds, message)]);
}
