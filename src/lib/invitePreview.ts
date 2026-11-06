import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import type { GymRole } from "@/lib/types";

// Who sent an invite link, for the welcome page someone sees before they have an account, and for
// the link's preview in WhatsApp and the like (migration 0050). Only for a link that still works,
// and never a phone number.
export type InvitePreview =
  | { state: "open"; kind: "trainer"; name: string; gymName: string | null; city: string | null }
  | { state: "open"; kind: "gym"; role: GymRole; name: string; city: string | null; area: string | null }
  | { state: "expired" | "not_found" };

type Row = { state: string; role: string | null; name: string | null; gym_name: string | null; city: string | null; area: string | null };

export function toInvitePreview(kind: "trainer" | "gym", row: Row | undefined): InvitePreview | null {
  if (!row) return null;
  if (row.state === "expired" || row.state === "not_found") return { state: row.state };
  if (row.state !== "open" || !row.name) return null;
  if (kind === "trainer") return { state: "open", kind, name: row.name, gymName: row.gym_name, city: row.city };
  const role = row.role === "trainer" || row.role === "admin" ? row.role : "member";
  return { state: "open", kind, role, name: row.name, city: row.city, area: row.area };
}

// Asked as a signed-out visitor (no cookies), which is who the function is for. Null when the
// lookup itself failed.
export const getInvitePreview = cache(async (kind: "trainer" | "gym", code: string): Promise<InvitePreview | null> => {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("invite_preview", { p_kind: kind, p_code: code });
  if (error) return null;
  return toInvitePreview(kind, (data as Row[] | null)?.[0]);
});

// "Pune" or "Baner, Pune", or null.
export function placeOf(...parts: (string | null | undefined)[]): string | null {
  return parts.filter((p) => p?.trim()).join(", ") || null;
}
