import { describe, expect, it } from "vitest";
import { editedByClient, planAuthorLabel, planAuthorNote } from "./planAuthors";

const ME = "client-1";
const RAVI = { id: "trainer-1", name: "Ravi" };

describe("planAuthorLabel", () => {
  it("credits the trainer, and the client once they edit it", () => {
    expect(planAuthorLabel({ created_by: "trainer-1", updated_by: "trainer-1" }, ME, RAVI)).toBe("Planned by Ravi");
    expect(planAuthorLabel({ created_by: "trainer-1", updated_by: ME }, ME, RAVI)).toBe("Planned by Ravi · edited by you");
    expect(planAuthorLabel({ created_by: ME, updated_by: "trainer-1" }, ME, RAVI)).toBe("Changed by Ravi");
  });

  it("says nothing for the person's own plans or plans from before trainers", () => {
    expect(planAuthorLabel({ created_by: ME, updated_by: ME }, ME, RAVI)).toBeNull();
    expect(planAuthorLabel({ created_by: null, updated_by: null }, ME, RAVI)).toBeNull();
    expect(planAuthorLabel({}, ME, null)).toBeNull();
  });

  it("falls back to 'your trainer' for a trainer whose name isn't known (a past one)", () => {
    expect(planAuthorLabel({ created_by: "trainer-0", updated_by: "trainer-0" }, ME, RAVI)).toBe("Planned by your trainer");
    expect(planAuthorLabel({ created_by: "trainer-0", updated_by: "trainer-0" }, ME, null)).toBe("Planned by your trainer");
  });
});

describe("planAuthorNote", () => {
  it("tells the client their changes show on the trainer's screen", () => {
    expect(planAuthorNote({ created_by: "trainer-1", updated_by: ME }, ME, RAVI)).toBe(
      "Ravi planned this. Your changes will show on Ravi's screen."
    );
    expect(planAuthorNote({ created_by: ME, updated_by: "trainer-1" }, ME, RAVI)).toBe(
      "Ravi changed this. Your changes will show on Ravi's screen."
    );
    expect(planAuthorNote({ created_by: "trainer-0", updated_by: "trainer-0" }, ME, RAVI)).toBe("Your trainer planned this.");
    expect(planAuthorNote({ created_by: ME, updated_by: ME }, ME, RAVI)).toBeNull();
    expect(planAuthorNote({ created_by: null, updated_by: null }, ME, null)).toBeNull();
  });
});

describe("editedByClient", () => {
  it("is true only when the client changed a plan someone else made", () => {
    expect(editedByClient({ created_by: "trainer-1", updated_by: "client-1" }, "client-1")).toBe(true);
    expect(editedByClient({ created_by: "trainer-1", updated_by: "trainer-1" }, "client-1")).toBe(false);
    expect(editedByClient({ created_by: "client-1", updated_by: "client-1" }, "client-1")).toBe(false);
    expect(editedByClient({ created_by: null, updated_by: "client-1" }, "client-1")).toBe(false);
  });
});
