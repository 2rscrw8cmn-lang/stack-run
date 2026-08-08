import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";

interface WeekNavigatorProps {
  weekNumber: number;
  totalWeeks: number;
  hasPreviousWeek: boolean;
  hasNextWeek: boolean;
  isCurrentWeek: boolean;
  onStep: (direction: -1 | 1) => void;
  onCurrentWeek: () => void;
}

/**
 * Previous/next stepping plus the shortcut back to the current week. The
 * shortcut only exists while it would do something, so the control bar stays
 * quiet on the week you are actually training.
 */
export function WeekNavigator({
  weekNumber,
  totalWeeks,
  hasPreviousWeek,
  hasNextWeek,
  isCurrentWeek,
  onStep,
  onCurrentWeek,
}: WeekNavigatorProps) {
  return (
    <div className="week-navigator">
      <IconButton
        label="Previous week"
        icon={<ChevronLeft size={20} strokeWidth={1.8} />}
        disabled={!hasPreviousWeek}
        onClick={() => onStep(-1)}
      />
      <p className="week-navigator__position">
        Week {weekNumber} of {totalWeeks}
      </p>
      <IconButton
        label="Next week"
        icon={<ChevronRight size={20} strokeWidth={1.8} />}
        disabled={!hasNextWeek}
        onClick={() => onStep(1)}
      />
      {!isCurrentWeek && (
        <Button
          variant="ghost"
          className="week-navigator__shortcut"
          onClick={onCurrentWeek}
        >
          Current Week
        </Button>
      )}
    </div>
  );
}
