import {
  Dumbbell,
  Flag,
  Footprints,
  Moon,
  Mountain,
  Timer,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { WorkoutType } from "../../domain/types.js";

/**
 * One icon per kind of day, so a workout is recognisable before it is read.
 *
 * The colour already says which type a block is; the icon says what the day
 * asks of you, which is the part a colour cannot carry on its own.
 */
const ACTIVITY_ICON: Record<WorkoutType, LucideIcon> = {
  rest: Moon,
  easy: Footprints,
  intervals: Zap,
  simulation: Timer,
  long: Mountain,
  race: Flag,
  cross: Dumbbell,
};

interface ActivityIconProps {
  type: WorkoutType;
  size?: number;
  className?: string;
}

/** Decorative by default: every caller names the type in text as well. */
export function ActivityIcon({ type, size = 18, className }: ActivityIconProps) {
  const Icon = ACTIVITY_ICON[type];
  return (
    <Icon
      className={className}
      size={size}
      strokeWidth={1.9}
      aria-hidden="true"
    />
  );
}
