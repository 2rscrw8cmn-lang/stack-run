import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import type { RunnerRun } from "../../history/runnerRun";
import { RunnerRunRow } from "./RunnerRunRow";

export const FULL_HISTORY_PAGE_SIZE = 25;

interface FullHistorySheetProps {
  runs: readonly RunnerRun[];
  isOpen: boolean;
  onClose: () => void;
  onOpenRun: (run: RunnerRun) => void;
}

/**
 * R1's deliberately plain archive boundary.
 *
 * It preserves the current newest-first rows and progressive reveal while
 * moving them one level below the Overview. Month grouping, dense archive-row
 * polish, browsing and search decisions remain R2.
 */
export function FullHistorySheet({ runs, isOpen, onClose, onOpenRun }: FullHistorySheetProps) {
  const [visibleRuns, setVisibleRuns] = useState(FULL_HISTORY_PAGE_SIZE);
  const shown = runs.slice(0, visibleRuns);
  const remaining = runs.length - shown.length;

  return (
    <Sheet className="sheet--full-history" title="Full History" isOpen={isOpen} onClose={onClose}>
      <div className="full-history">
        <p className="full-history__context machine-label">
          {runs.length} {runs.length === 1 ? "RUN" : "RUNS"} · NEWEST FIRST
        </p>
        <ul className="runs-screen__list full-history__list">
          {shown.map((run) => (
            <RunnerRunRow key={run.id} run={run} onOpen={() => onOpenRun(run)} />
          ))}
        </ul>
        {remaining > 0 && (
          <div className="runs-screen__more">
            <Button
              variant="ghost"
              onClick={() => setVisibleRuns((count) => count + FULL_HISTORY_PAGE_SIZE)}
            >
              {`Show ${Math.min(remaining, FULL_HISTORY_PAGE_SIZE)} more`}
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
