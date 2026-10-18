import { createHash, timingSafeEqual } from "node:crypto";

// Scheduled jobs (app/api/cron) are called by a scheduler, not a signed-in person, and prove it with
// `Authorization: Bearer <CRON_SECRET>`. Compared in constant time (both sides hashed to equal
// length) so the response time says nothing about the secret.
export function isAuthorizedCronRequest(request: Request, secret: string | undefined = process.env.CRON_SECRET): boolean {
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return presented.length > 0 && timingSafeEqual(digest(presented), digest(secret));
}
