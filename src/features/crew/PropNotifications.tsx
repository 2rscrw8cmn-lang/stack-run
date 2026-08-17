import { ThumbsUp } from "lucide-react";
import { Section } from "../../components/ui/Section";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatMiles } from "../../domain/distance";
import { crewMemberAccent } from "../../crew/memberAccent";
import { formatPropAge } from "../../crew/notifications";
import type { CrewPropNotification } from "../../crew/types";
import { RunnerIcon } from "./RunnerIcon";

const MAX_VISIBLE = 8;

/**
 * Recent Props on the viewer's own runs. Shared by the Crew screen and the
 * Account & Crew sheet — the two surfaces that mark them seen — so the
 * list, the read state and the age formatting can't drift between them.
 */
export function PropNotifications({
  notifications,
  propsSeenAt,
  now,
}: {
  notifications: readonly CrewPropNotification[];
  propsSeenAt: string;
  now?: number;
}) {
  if (notifications.length === 0) return null;
  const visible = notifications.slice(0, MAX_VISIBLE);

  return (
    <Section
      className="prop-notifications"
      icon={<ThumbsUp size={15} strokeWidth={2} />}
      title="Props"
    >
      <ul className="prop-notifications__list">
        {visible.map((notification) => {
          const unread = notification.createdAt > propsSeenAt;
          return (
            <li key={notification.id} data-unread={unread || undefined}>
              <RunnerIcon
                icon={notification.actorRunnerIcon}
                accent={crewMemberAccent(
                  notification.actorUserId,
                  notification.actorAccentColor,
                )}
                size={24}
              />
              <span className="prop-notifications__body">
                <span>
                  <strong>{notification.actorDisplayName}</strong> propped
                  your {formatMiles(notification.runDistanceMiles)} MI{" "}
                  {WORKOUT_TYPE_LABEL[notification.runActivityType]}
                  {unread && <span className="visually-hidden"> New.</span>}
                </span>
                <span className="machine-label">
                  {formatPropAge(notification.createdAt, now)}
                </span>
              </span>
              <span className="prop-notifications__unread" aria-hidden="true" />
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
