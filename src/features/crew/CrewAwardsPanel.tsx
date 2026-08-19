import {
  CREW_AWARD_LABEL,
  formatCrewAwardResult,
  isFeatureCrewAward,
} from "../../crew/awards";
import type { CrewBuildReadyAward } from "../../crew/crewBuild";
import { Button } from "../../components/ui/Button";
import "./crewAwardsPanel.css";

interface CrewAwardsPanelProps {
  /** Already filtered upstream to awards owned by the current viewer. */
  readyAwards: readonly CrewBuildReadyAward[];
  onPlaceAward: (awardId: string) => void;
}

/**
 * Crew's only award surface: the winner's own prompt to place a block they have
 * earned. Weekly standings are deliberately not a v1 surface — the finalizer is
 * the single authority on who won a week, and a Special Block enters the tower
 * by being placed, not by being announced (D-080).
 */
export function CrewAwardsPanel({ readyAwards, onPlaceAward }: CrewAwardsPanelProps) {
  const firstReady = readyAwards[0] ?? null;
  if (!firstReady) return null;
  const remaining = Math.max(0, readyAwards.length - 1);

  return (
    <section
      className="crew-award-ready"
      data-award={firstReady.awardType}
      data-feature={isFeatureCrewAward(firstReady.awardType) || undefined}
      aria-labelledby="crew-award-ready-title"
    >
      <span className="crew-award-ready__mark" aria-hidden="true" />
      <div className="crew-award-ready__copy">
        <p className="machine-label">
          {readyAwards.length === 1
            ? "Special Block Ready"
            : `${readyAwards.length} Special Blocks Ready`}
        </p>
        <h2 id="crew-award-ready-title">{CREW_AWARD_LABEL[firstReady.awardType]}</h2>
        <p className="crew-award-ready__result data-value">
          {formatCrewAwardResult(firstReady.awardType, firstReady.resultValue)}
          {remaining > 0 ? ` · +${remaining} more waiting` : ""}
        </p>
      </div>
      <Button variant="primary" onClick={() => onPlaceAward(firstReady.id)}>
        Place Block
      </Button>
    </section>
  );
}
