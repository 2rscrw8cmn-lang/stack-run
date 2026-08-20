import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CrewPropNotification } from "../../crew/types";
import { PropNotifications } from "./PropNotifications";

function notification(
  id: string,
  createdAt: string,
  values: Partial<CrewPropNotification> = {},
): CrewPropNotification {
  return {
    id,
    runId: "run-1",
    runLocalDate: "2026-08-14",
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

const NOW = new Date("2026-08-14T15:00:00Z").getTime();

describe("PropNotifications", () => {
  it("renders nothing when there is nothing to show", () => {
    const { container } = render(
      <PropNotifications notifications={[]} propsSeenAt="2026-08-14T00:00:00Z" onDismiss={vi.fn()} now={NOW} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("marks only Props newer than the last-seen time as unread", () => {
    render(
      <PropNotifications
        notifications={[
          notification("a", "2026-08-14T14:00:00Z"), // after propsSeenAt
          notification("b", "2026-08-13T00:00:00Z", { actorDisplayName: "Priya" }), // before
        ]}
        propsSeenAt="2026-08-14T00:00:00Z"
        onDismiss={vi.fn()}
        now={NOW}
      />,
    );
    expect(screen.getByText("Jamie").closest("li")).toHaveAttribute("data-unread", "true");
    expect(screen.getByText("Priya").closest("li")).not.toHaveAttribute("data-unread");
  });

  it("clears a row when its Clear control is used", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <PropNotifications
        notifications={[notification("a", "2026-08-14T14:00:00Z")]}
        propsSeenAt="2026-08-14T00:00:00Z"
        onDismiss={onDismiss}
        now={NOW}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Clear:/ }));
    expect(onDismiss).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(onDismiss).toHaveBeenCalledWith("a");
    vi.useRealTimers();
  });

  it("clears a row on a completed leftward swipe", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <PropNotifications
        notifications={[notification("a", "2026-08-14T14:00:00Z")]}
        propsSeenAt="2026-08-14T00:00:00Z"
        onDismiss={onDismiss}
        now={NOW}
      />,
    );

    const row = screen.getByText("Jamie").closest("li")!;
    fireEvent.pointerDown(row, { pointerId: 1, clientX: 200, clientY: 40 });
    fireEvent.pointerMove(row, { pointerId: 1, clientX: 190, clientY: 40 });
    fireEvent.pointerMove(row, { pointerId: 1, clientX: 100, clientY: 40 });
    fireEvent.pointerUp(row, { pointerId: 1, clientX: 100, clientY: 40 });
    vi.runAllTimers();

    expect(onDismiss).toHaveBeenCalledWith("a");
    vi.useRealTimers();
  });

  it("springs a short swipe back without clearing the row", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <PropNotifications
        notifications={[notification("a", "2026-08-14T14:00:00Z")]}
        propsSeenAt="2026-08-14T00:00:00Z"
        onDismiss={onDismiss}
        now={NOW}
      />,
    );

    const row = screen.getByText("Jamie").closest("li")!;
    fireEvent.pointerDown(row, { pointerId: 1, clientX: 200, clientY: 40 });
    fireEvent.pointerMove(row, { pointerId: 1, clientX: 180, clientY: 40 });
    fireEvent.pointerUp(row, { pointerId: 1, clientX: 180, clientY: 40 });
    vi.runAllTimers();

    expect(onDismiss).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
