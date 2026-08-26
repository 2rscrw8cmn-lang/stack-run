import { Sparkles } from "lucide-react";
import { useState } from "react";
import {
  describeProvenanceChange,
  type WorkoutProvenance,
} from "../../domain/planProvenance";
import { formatUpdatedAgo } from "../../domain/dates";
import type { Workout } from "../../domain/types";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { Sheet } from "../ui/Sheet";

interface AssistantAdjustmentBadgeProps {
  /** The workout's current, live state — used to describe what it is now. */
  workout: Workout;
  provenance: WorkoutProvenance;
  /** Whether the mutation layer would still accept undoing this specific adjustment. */
  canUndo: boolean;
  onUndo: () => void;
  className?: string;
}

/**
 * The quiet provenance treatment (#182): a small sparkle, not a badge
 * system. Rendered as a sibling of whatever row/card button it sits beside
 * — never nested inside one, since a button cannot nest inside another
 * button — with its own 44px accessible target via `IconButton`'s existing
 * sizing, no larger visible mark. Tapping it opens a compact `Sheet`
 * describing what changed, when, why (if given), and offers Undo only when
 * `canUndoProvenance` (`src/domain/planProvenance.ts`) says it still holds.
 */
export function AssistantAdjustmentBadge({
  workout,
  provenance,
  canUndo,
  onUndo,
  className,
}: AssistantAdjustmentBadgeProps) {
  const [isOpen, setOpen] = useState(false);
  const lines = describeProvenanceChange(provenance, workout);

  return (
    <>
      <IconButton
        label="Assistant-adjusted — view change"
        icon={<Sparkles size={14} strokeWidth={1.8} />}
        className={className}
        onClick={() => setOpen(true)}
      />
      <Sheet title="Assistant Change" isOpen={isOpen} onClose={() => setOpen(false)}>
        <div className="assistant-adjustment-detail">
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <p className="assistant-adjustment-detail__meta">
            {formatUpdatedAgo(provenance.changedAt)}
          </p>
          {provenance.reason && (
            <p className="assistant-adjustment-detail__reason">
              &ldquo;{provenance.reason}&rdquo;
            </p>
          )}
          {canUndo && (
            <Button
              variant="secondary"
              onClick={() => {
                onUndo();
                setOpen(false);
              }}
            >
              Undo
            </Button>
          )}
        </div>
      </Sheet>
    </>
  );
}
