import { describe, expect, it, vi, beforeEach } from "vitest";

const { getUserMock, signOutMock, deleteUserMock, createAdminClientMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  signOutMock: vi.fn(),
  deleteUserMock: vi.fn(),
  createAdminClientMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock, signOut: signOutMock },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

import { deleteAccount } from "./actions";

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  getUserMock.mockReset();
  signOutMock.mockReset();
  deleteUserMock.mockReset();
  createAdminClientMock.mockReset();
  createAdminClientMock.mockReturnValue({ auth: { admin: { deleteUser: deleteUserMock } } });
});

describe("deleteAccount", () => {
  it("refuses without the exact confirmation phrase", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    const result = await deleteAccount(null, formData({ confirmation: "delete" }));
    expect(result).toEqual({ error: "Type DELETE to confirm." });
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("refuses when there is no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const result = await deleteAccount(null, formData({ confirmation: "DELETE" }));
    expect(result).toEqual({ error: "Not signed in" });
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("calls admin.deleteUser for the authenticated user's id and signs out", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    deleteUserMock.mockResolvedValue({ error: null });
    const result = await deleteAccount(null, formData({ confirmation: "DELETE" }));
    expect(deleteUserMock).toHaveBeenCalledWith("u1");
    expect(signOutMock).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it("surfaces a Supabase admin error instead of pretending success", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    deleteUserMock.mockResolvedValue({ error: { message: "boom" } });
    const result = await deleteAccount(null, formData({ confirmation: "DELETE" }));
    expect(result).toEqual({ error: "boom" });
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("fails clearly (not silently) when the service-role client isn't configured", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    createAdminClientMock.mockImplementation(() => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) must be set to perform admin operations.");
    });
    const result = await deleteAccount(null, formData({ confirmation: "DELETE" }));
    expect(result).toEqual({
      error: "SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) must be set to perform admin operations.",
    });
  });
});
