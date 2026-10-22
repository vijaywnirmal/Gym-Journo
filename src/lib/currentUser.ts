import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// The signed-in person for this request, looked up once and shared by every query helper (each
// used to call auth.getUser() itself: about 30 Auth requests per Today page). React's cache() scopes
// it to one server request.
export const getCurrentUser = cache(async (): Promise<{ id: string } | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id } : null;
});
