import { beforeEach, describe, expect, it } from "vitest";
import {
  dismissPropNotification,
  loadDismissedPropNotificationIds,
} from "./dismissedPropNotificationRepository";
import { DISMISSED_PROP_NOTIFICATIONS_STORAGE_KEY } from "./storageKeys";

beforeEach(() => localStorage.clear());

describe("Dismissed Props notifications", () => {
  it("remembers a swiped-away Prop for its own account only", () => {
    dismissPropNotification("user-1", "run-1:teammate-1");
    expect(loadDismissedPropNotificationIds("user-1")).toEqual(new Set(["run-1:teammate-1"]));
    expect(loadDismissedPropNotificationIds("user-2")).toEqual(new Set());
  });

  it("deduplicates repeat dismissals of the same notification", () => {
    dismissPropNotification("user-1", "run-1:teammate-1");
    dismissPropNotification("user-1", "run-1:teammate-1");
    expect(localStorage.getItem(DISMISSED_PROP_NOTIFICATIONS_STORAGE_KEY)).toBe(
      JSON.stringify({ "user-1": ["run-1:teammate-1"] }),
    );
  });

  it("keeps each account's dismissals independent", () => {
    dismissPropNotification("user-1", "run-1:teammate-1");
    dismissPropNotification("user-2", "run-2:teammate-2");
    expect(loadDismissedPropNotificationIds("user-1")).toEqual(new Set(["run-1:teammate-1"]));
    expect(loadDismissedPropNotificationIds("user-2")).toEqual(new Set(["run-2:teammate-2"]));
  });

  it("bounds how many dismissals one account can accumulate", () => {
    for (let index = 0; index < 210; index += 1) {
      dismissPropNotification("user-1", `run-${index}:teammate-1`);
    }
    const remembered = loadDismissedPropNotificationIds("user-1");
    expect(remembered.size).toBe(200);
    // The oldest dismissals are the ones dropped, not the newest.
    expect(remembered.has("run-209:teammate-1")).toBe(true);
    expect(remembered.has("run-0:teammate-1")).toBe(false);
  });
});
