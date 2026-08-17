import { ThumbsUp, X } from "lucide-react";
import { Section } from "../../components/ui/Section";
import { useSwipeToDismiss } from "../../components/ui/useSwipeToDismiss";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatMiles } from "../../domain/distance";
import { crewMemberAccent } from "../../crew/memberAccent";
import { formatPropAge } from "../../crew/notifications";
import type { CrewPropNotification } from "../../crew/types";
import { RunnerIcon } from "./RunnerIcon";

const MAX_VISIBLE = 8;

function PropNotificationRow({
  notification,
  unread,
  now,
  onDismiss,
}: {
  notification: CrewPropNotification;
  unread: boolean;
  now?: number;
  onDismiss: (notificationId: string) => void;
}) {
  const { offsetX, isDragging, isExiting, trigger, handlers } = useSwipeToDismiss(
    () => onDismiss(notification.id),
  );

  return (
    <li
      data-unread={unread || undefined}
      data-exiting={isExiting || undefined}
      style={
        offsetX
          ? { transform: `translateX(${offsetX}px)`, transition: isDragging ? "none" : undefined }
          : undefined
      }
      {...handlers}
    >
      <RunnerIcon
        icon={notification.actorRunnerIcon}
        accent={crewMemberAccent(notification.actorUserId, notification.actorAccentColor)}
        size={24}
      />
      <span className="prop-notifications__body">
        <span>
          <strong>{notification.actorDisplayName}</strong> propped your{" "}
          {formatMiles(notification.runDistanceMiles)} MI{" "}
          {WORKOUT_TYPE_LABEL[notification.runActivityType]}
          {unread && <span className="visually-hidden"> New.</span>}
        </span>
        <span className="machine-label">{formatPropAge(notification.createdAt, now)}</span>
      </span>
      <button
        type="button"
        className="prop-notifications__dismiss"
        aria-label={`Clear: ${notification.actorDisplayName} propped your ${formatMiles(notification.runDistanceMiles)} MI ${WORKOUT_TYPE_LABEL[notification.runActivityType]}`}
        onClick={trigger}
      >
        <X size={14} strokeWidth={2} aria-hidden="true" />
      </button>
    </li>
  );
}

/**
 * Recent Props on the viewer's own runs. Shared by the Crew screen and the
 * Account & Crew sheet — the two surfaces that mark them seen — so the
 * list, the read state and the age formatting can't drift between them.
 *
 * Seen and cleared are different things: opening either surface clears the
 * unread ring, but a row only leaves this list once its runner swipes (or
 * taps Clear on) it, which is what actually removes it for good.
 */
export function PropNotifications({
  notifications,
  propsSeenAt,
  onDismiss,
  now,
}: {
  notifications: readonly CrewPropNotification[];
  propsSeenAt: string;
  onDismiss: (notificationId: string) => void;
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
        {visible.map((notification) => (
          <PropNotificationRow
            key={notification.id}
            notification={notification}
            unread={notification.createdAt > propsSeenAt}
            now={now}
            onDismiss={onDismiss}
          />
        ))}
      </ul>
    </Section>
  );
}
