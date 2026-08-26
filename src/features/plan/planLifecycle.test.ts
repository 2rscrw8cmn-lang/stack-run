import { describe, expect, it } from "vitest";
import { loadSeedPlan } from "../../seed/loadSeedPlan.js";
import {
  ANCHOR_WEEK_LABEL,
  planLifecycle,
  planLifecycleNote,
} from "./planLifecycle.js";

// The seed plan starts Aug 3 2026 and races on Dec 5 2026.
const plan = loadSeedPlan();

describe("planLifecycle", () => {
  it("treats the start date and race day as inside the training window", () => {
    expect(planLifecycle(plan, "2026-08-02")).toBe("before-plan");
    expect(planLifecycle(plan, "2026-08-03")).toBe("active");
    expect(planLifecycle(plan, "2026-10-01")).toBe("active");
    expect(planLifecycle(plan, "2026-12-05")).toBe("active");
    expect(planLifecycle(plan, "2026-12-06")).toBe("after-race");
  });
});

describe("planLifecycleNote", () => {
  it("says nothing at all while training is underway", () => {
    expect(planLifecycleNote(plan, "2026-10-01")).toBeNull();
  });

  it("states when training starts without judging the weeks before it", () => {
    const note = planLifecycleNote(plan, "2026-07-20")!;

    expect(note.lifecycle).toBe("before-plan");
    expect(note.headline).toBe("Plan starts Aug 3");
    expect(`${note.headline} ${note.detail}`).not.toMatch(
      /missed|behind|late|incomplete|complete|failed/i,
    );
  });

  it("states that the plan is finished without grading it", () => {
    const note = planLifecycleNote(plan, "2026-12-31")!;

    expect(note.lifecycle).toBe("after-race");
    expect(note.headline).toBe("Plan complete");
    expect(note.detail).toContain("OUC Half Marathon");
    expect(note.detail).toContain("Dec 5");
    expect(note.detail).not.toMatch(/missed|behind|adherence|score|%/i);
  });

  it("names the week the shortcut returns to in every lifecycle", () => {
    expect(ANCHOR_WEEK_LABEL).toEqual({
      "before-plan": "First Week",
      active: "Current Week",
      "after-race": "Final Week",
    });
  });
});
