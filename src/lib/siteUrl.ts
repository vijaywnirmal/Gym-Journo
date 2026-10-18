import { headers } from "next/headers";

// The base URL that auth emails (sign-up confirmation, magic links, password resets) link back to.
// NEXT_PUBLIC_SITE_URL pins it to the production domain, so an email requested from a Vercel preview
// deployment (which sits behind Vercel's login) still lands on the real app. Without it — local
// development — fall back to the URL the request came from.
export function resolveSiteUrl(
  configured: string | undefined,
  requestHeaders: Pick<Headers, "get">,
): string {
  const fromEnv = configured?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return (
    requestHeaders.get("origin") ?? `http://${requestHeaders.get("host") ?? "localhost:3000"}`
  );
}

export async function getSiteUrl(): Promise<string> {
  return resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, await headers());
}
