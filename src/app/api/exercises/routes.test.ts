import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodeCursor, encodeCursor, EXERCISE_PAGE_SIZE } from "@/lib/exerciseLibrary";

type Result = { data: unknown; error: unknown };

const getUser = vi.fn();
const rpc = vi.fn();
let tutorialResult: Result = { data: null, error: null };
const tutorialQuery = { eq: vi.fn(() => tutorialQuery), maybeSingle: vi.fn(async () => tutorialResult) };
const from = vi.fn(() => ({ select: () => tutorialQuery }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, rpc, from }),
}));

const list = await import("./route");
const groups = await import("./groups/route");
const tutorial = await import("./[id]/route");

const VIEWER = "11111111-1111-4111-8111-111111111111";
const GROUP = "22222222-2222-4222-8222-222222222222";
const EXERCISE = "33333333-3333-4333-8333-333333333333";

const request = (query = "") => new Request(`http://localhost/api/exercises${query}`);
const row = (n: number, userId: string | null = null) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  name: `Lift ${String(n).padStart(2, "0")}`,
  equipment: "Barbell",
  user_id: userId,
  has_tutorial: n % 2 === 0,
});
const tutorialCtx = (id: string) => ({ params: Promise.resolve({ id }) }) as Parameters<typeof tutorial.GET>[1];

beforeEach(() => {
  getUser.mockResolvedValue({ data: { user: { id: VIEWER } } });
  rpc.mockReset();
  rpc.mockResolvedValue({ data: [], error: null });
  tutorialResult = { data: null, error: null };
});

describe("GET /api/exercises", () => {
  it("is 401 when signed out, without querying", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const response = await list.GET(request());
    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("is 400 for invalid params or a cursor it didn't issue", async () => {
    expect((await list.GET(request("?equipment=Spaceship"))).status).toBe(400);
    expect((await list.GET(request("?muscleGroup=chest"))).status).toBe(400);
    expect((await list.GET(request("?cursor=garbage"))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("asks for one row more than a page, with expanded search words and the cursor position", async () => {
    const cursor = encodeCursor({ name: "Lift 10", id: EXERCISE });
    await list.GET(request(`?muscleGroup=${GROUP}&q=db%20press&equipment=Dumbbell&cursor=${cursor}`));
    expect(rpc).toHaveBeenCalledWith("browse_exercises", {
      p_muscle_group_id: GROUP,
      p_words: ["dumbbell", "press"],
      p_equipment: "Dumbbell",
      p_after_name: "Lift 10",
      p_after_id: EXERCISE,
      p_limit: EXERCISE_PAGE_SIZE + 1,
    });
  });

  it("sends null filters when none are given", async () => {
    await list.GET(request("?q=%20%20"));
    expect(rpc).toHaveBeenCalledWith("browse_exercises", expect.objectContaining({ p_muscle_group_id: null, p_words: null, p_equipment: null }));
  });

  it("returns a page with a cursor to the next one when more rows exist", async () => {
    rpc.mockResolvedValue({ data: Array.from({ length: EXERCISE_PAGE_SIZE + 1 }, (_, i) => row(i + 1, i === 0 ? VIEWER : null)), error: null });
    const response = await list.GET(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(body.items).toHaveLength(EXERCISE_PAGE_SIZE);
    expect(body.items[0]).toEqual({ id: row(1).id, name: "Lift 01", equipment: "Barbell", isOwn: true, hasTutorial: false });
    expect(body.items[1].isOwn).toBe(false);
    expect(decodeCursor(body.nextCursor)).toEqual({ name: "Lift 10", id: row(10).id });
  });

  it("has no next cursor on the last page", async () => {
    rpc.mockResolvedValue({ data: [row(1), row(2)], error: null });
    expect((await (await list.GET(request())).json()).nextCursor).toBeNull();
  });

  it("is 500 when the query fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect((await list.GET(request())).status).toBe(500);
  });
});

describe("GET /api/exercises/groups", () => {
  it("is 401 when signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await groups.GET(request("/groups"))).status).toBe(401);
  });

  it("maps counts and passes the filters", async () => {
    rpc.mockResolvedValue({ data: [{ muscle_group_id: GROUP, name: "Chest", exercise_count: 88 }], error: null });
    const response = await groups.GET(request("/groups?q=bench&equipment=Barbell"));
    expect(rpc).toHaveBeenCalledWith("exercise_group_counts", { p_words: ["bench"], p_equipment: "Barbell" });
    expect(await response.json()).toEqual([{ id: GROUP, name: "Chest", exerciseCount: 88 }]);
  });

  it("is 400 for invalid params and 500 when the query fails", async () => {
    expect((await groups.GET(request("/groups?equipment=nope"))).status).toBe(400);
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect((await groups.GET(request("/groups"))).status).toBe(500);
  });
});

describe("GET /api/exercises/:id", () => {
  it("is 401 when signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await tutorial.GET(request(), tutorialCtx(EXERCISE))).status).toBe(401);
  });

  it("is 404 for a malformed id without querying", async () => {
    expect((await tutorial.GET(request(), tutorialCtx("groups"))).status).toBe(404);
    expect(from).not.toHaveBeenCalled();
  });

  it("is 404 when the exercise isn't visible and 500 when the query fails", async () => {
    expect((await tutorial.GET(request(), tutorialCtx(EXERCISE))).status).toBe(404);
    tutorialResult = { data: null, error: { message: "boom" } };
    expect((await tutorial.GET(request(), tutorialCtx(EXERCISE))).status).toBe(500);
  });

  it("returns steps, demo images and sorted muscle groups, cacheable by the browser", async () => {
    tutorialResult = {
      data: {
        id: EXERCISE,
        name: "Deadlift",
        equipment: "Barbell",
        instructions: "Bar over mid-foot.\nStand up.",
        demo_images: ["/exercise-demos/Barbell_Deadlift/0.webp"],
        exercise_muscle_groups: [{ muscle_group: { name: "Hamstrings" } }, { muscle_group: { name: "Back" } }],
      },
      error: null,
    };
    const response = await tutorial.GET(request(), tutorialCtx(EXERCISE));
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=3600");
    expect(await response.json()).toEqual({
      id: EXERCISE,
      name: "Deadlift",
      equipment: "Barbell",
      muscleGroups: ["Back", "Hamstrings"],
      steps: ["Bar over mid-foot.", "Stand up."],
      demoImages: ["/exercise-demos/Barbell_Deadlift/0.webp"],
    });
    expect(tutorialQuery.eq).toHaveBeenCalledWith("id", EXERCISE);
  });
});
