import { describe, expect, it } from "vitest";
import { selectTodayModel } from "./todayModel";
import {
  isTodayDemoEnabled,
  isTodayFoundDemoEnabled,
  todayDemoData,
  todayFoundDemoCandidate,
  TODAY_DEMO_DATE,
} from "./todayDemo";

describe("Today preview demo", () => {
  it("is enabled only on localhost or a Vercel branch preview with demo=today", () => {
    expect(
      isTodayDemoEnabled({
        hostname: "stack-run-git-feature-today-next-verus-domus.vercel.app",
        search: "?demo=today",
      }),
    ).toBe(true);
    expect(
      isTodayDemoEnabled({ hostname: "localhost", search: "?demo=today" }),
    ).toBe(true);
    expect(
      isTodayDemoEnabled({
        hostname: "stack-run.vercel.app",
        search: "?demo=today",
      }),
    ).toBe(false);
    expect(
      isTodayDemoEnabled({ hostname: "stackrun.app", search: "?demo=today" }),
    ).toBe(false);
    expect(
      isTodayDemoEnabled({
        hostname: "stack-run-git-feature-today-next-verus-domus.vercel.app",
        search: "?demo=signals",
      }),
    ).toBe(false);
  });

  it("produces a reviewable Today state through the real model", () => {
    const demo = todayDemoData();
    const model = selectTodayModel({
      plan: demo.plan,
      runLogs: demo.runLogs,
      runs: demo.runnerRuns,
      today: demo.today,
    });

    expect(demo.today).toBe(TODAY_DEMO_DATE);
    expect(model.immediate.kind).toBe("run");
    expect(model.context.length).toBeGreaterThan(0);
    expect(model.week?.runCount ?? 0).toBeGreaterThan(0);
    expect(model.signal).not.toBeNull();
    expect(model.next).not.toBeNull();
    expect(demo.blockPlacements.length).toBeGreaterThan(0);
    expect(demo.blockPlacements.length).toBeLessThan(demo.runLogs.length);
  });

  it("offers an explicit connected-review preview state", () => {
    const location = {
      hostname: "localhost",
      search: "?demo=today&state=found",
    };
    const demo = todayDemoData();
    const candidate = todayFoundDemoCandidate(demo.plan);

    expect(isTodayFoundDemoEnabled(location)).toBe(true);
    expect(candidate.completedDate).toBe(TODAY_DEMO_DATE);
    expect(candidate.externalId).toBe("demo-today-found");
  });

  it("creates only in-memory values and no storage contract", () => {
    const demo = todayDemoData();
    expect(Object.keys(demo).sort()).toEqual(
      ["blockPlacements", "plan", "runLogs", "runnerRuns", "today"].sort(),
    );
  });
});
