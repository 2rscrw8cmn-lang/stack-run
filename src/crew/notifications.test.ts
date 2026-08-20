import { describe, expect, it } from "vitest";
import { formatPropAge, unreadPropNotifications } from "./notifications";
import type { CrewPropNotification } from "./types";

function notification(
  id: string,
  createdAt: string,
  values: Partial<CrewPropNotification> = {},
): CrewPropNotification {
  return {
    id,
    runId: "run-1",
    runLocalDate: "2026-08-09",
    runActivityType: "long",
    runDistanceMiles: 6.1,
    actorUserId: "teammate-1",
    actorDisplayName: "Jamie",
    actorAccentColor: null,
    actorRunnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 },
    createdAt,
    ...values,
  };
}

describe("unreadPropNotifications", () => {
  it("keeps only Props created after the last-seen timestamp", () => {
    const notifications = [
      notification("a", "2026-08-11T12:00:00Z"),
      notification("b", "2026-08-09T12:00:00Z"),
      notification("c", "2026-08-10T00:00:00Z"),
    ];
    expect(unreadPropNotifications(notifications, "2026-08-10T00:00:00Z")).toEqual([
      notifications[0],
    ]);
  });

  it("treats every Prop as unread when nothing has ever been seen", () => {
    const notifications = [notification("a", "2020-01-01T00:00:00Z")];
    expect(unreadPropNotifications(notifications, new Date(0).toISOString())).toEqual(
      notifications,
    );
  });
});

describe("formatPropAge", () => {
  const now = new Date("2026-08-11T15:00:00Z").getTime();

  it("uses one compact relative grain across minutes, hours and days", () => {
    expect(formatPropAge("2026-08-11T14:59:30Z", now)).toBe("Just now");
    expect(formatPropAge("2026-08-11T14:30:00Z", now)).toBe("30m ago");
    expect(formatPropAge("2026-08-11T12:00:00Z", now)).toBe("3h ago");
    expect(formatPropAge("2026-08-09T15:00:00Z", now)).toBe("2d ago");
  });
});
