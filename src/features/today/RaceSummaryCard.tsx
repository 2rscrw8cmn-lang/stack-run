import { Card } from "../../components/ui/Card";
import { formatDateLabel } from "../../domain/dates";
import type { Race } from "../../domain/types";

interface RaceSummaryCardProps {
  race: Race;
  daysRemaining: number;
}

export function RaceSummaryCard({ race, daysRemaining }: RaceSummaryCardProps) {
  const displayDays = Math.max(daysRemaining, 0);

  return (
    <Card className="race-summary-card">
      <div className="race-summary-card__row">
        <div>
          <p className="race-summary-card__label">Race target</p>
          <p className="race-summary-card__race-name">{race.name}</p>
          <p className="race-summary-card__label">Race day</p>
          <p className="race-summary-card__race-date">
            {formatDateLabel(race.date, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="race-summary-card__countdown">
          <p className="race-summary-card__days">{displayDays}</p>
          <p className="race-summary-card__days-label">Days</p>
        </div>
      </div>
    </Card>
  );
}
