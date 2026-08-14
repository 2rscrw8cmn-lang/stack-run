import type { CrewPropNotification } from "./types";

/** Props on the viewer's own runs since they last opened a surface that shows them. */
export function unreadPropNotifications(
  notifications: readonly CrewPropNotification[],
  propsSeenAt: string,
): CrewPropNotification[] {
  return notifications.filter((notification) => notification.createdAt > propsSeenAt);
}

/** Compact relative age for a Props notification, matching formatUpdatedAgo's grain. */
export function formatPropAge(timestamp: string, now = Date.now()): string {
  const created = new Date(timestamp).getTime();
  if (!Number.isFinite(created)) return "";
  const minutes = Math.max(0, Math.floor(Math.max(0, now - created) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / (24 * 60))}d ago`;
}
