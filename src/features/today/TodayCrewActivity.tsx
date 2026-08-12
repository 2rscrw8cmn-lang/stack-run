import { UsersRound } from "lucide-react";
import { useEffect } from "react";
import { ActivityIcon } from "../../components/shared/ActivityIcon";
import { Button } from "../../components/ui/Button";
import { Section } from "../../components/ui/Section";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatMiles } from "../../domain/distance";
import { crewMemberAccent } from "../../crew/memberAccent";
import { selectRecentCrewActivity } from "../../crew/recentActivity";
import type { RaceCrewController } from "../../crew/useRaceCrew";
import { PropsButton } from "../crew/PropsButton";

export function TodayCrewActivity({
  crew,
  today,
  onViewCrew,
}: {
  crew: RaceCrewController | null;
  today: string;
  onViewCrew: () => void;
}) {
  const crewId = crew?.account?.crew?.id;
  const refresh = crew?.refreshCrewData;
  useEffect(() => {
    if (crew?.status === "signed-in" && crewId && refresh) void refresh(false);
  }, [crew?.status, crewId, refresh]);

  const viewerUserId = crew?.account?.profile.id;
  const dashboard = crew?.crewData;
  if (!viewerUserId || !dashboard?.sharedRunsAvailable) return null;
  const runs = selectRecentCrewActivity(dashboard.runs, viewerUserId, today);
  if (runs.length === 0) return null;

  return (
    <Section className="today-crew-activity" icon={<UsersRound size={15} strokeWidth={2} />} title="Crew Activity">
      <ul className="today-crew-activity__list">
        {runs.map((run) => (
          <li key={run.id} data-member-color={crewMemberAccent(run.userId)}>
            <span className="today-crew-activity__icon" data-type={run.activityType}>
              <ActivityIcon type={run.activityType} size={17} />
            </span>
            <span className="today-crew-activity__body">
              <span className="today-crew-activity__name">
                <span className="crew-member-marker" aria-hidden="true" />
                {run.displayName}
              </span>
              <span className="machine-label">
                {formatMiles(run.distanceMiles)} MI · {WORKOUT_TYPE_LABEL[run.activityType]} · {run.localDate === today ? "today" : "yesterday"}
              </span>
            </span>
            <PropsButton
              runOwnerName={run.displayName}
              count={run.propsCount}
              pressed={run.viewerHasPropped}
              pending={crew.propsPendingRunIds.includes(run.id)}
              isOwnRun={false}
              available={dashboard.propsAvailable}
              onToggle={() => void crew.toggleProps(run.id)}
            />
            {crew.propsErrors[run.id] && (
              <p className="crew-props__error" role="status">{crew.propsErrors[run.id]}</p>
            )}
          </li>
        ))}
      </ul>
      <Button variant="ghost" onClick={onViewCrew}>View Crew →</Button>
    </Section>
  );
}
