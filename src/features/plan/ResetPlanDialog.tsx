import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "../../components/ui/Button.js";
import { Sheet } from "../../components/ui/Sheet.js";

interface ResetPlanDialogProps {
  runCount: number;
  blockCount: number;
  isOpen: boolean;
  onClose: () => void;
  onReset: () => void;
}

function countPhrase(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

/**
 * The one action that destroys everything, behind two deliberate steps.
 *
 * The second step is a separate button rather than a confirm dialog, so the
 * count of what is about to be erased stays on screen while the user decides.
 */
export function ResetPlanDialog({
  runCount,
  blockCount,
  isOpen,
  onClose,
  onReset,
}: ResetPlanDialogProps) {
  const [isArmed, setArmed] = useState(false);

  return (
    <Sheet
      title="Reset Plan"
      isOpen={isOpen}
      onClose={() => {
        setArmed(false);
        onClose();
      }}
    >
      <div className="reset-plan">
        <p className="reset-plan__lede">
          <TriangleAlert size={20} strokeWidth={2} aria-hidden="true" />
          <span>
            This restores the original eighteen-week plan and erases everything
            you have recorded.
          </span>
        </p>

        <ul className="reset-plan__list">
          <li>Every plan edit you have made</li>
          <li>{countPhrase(runCount, "recorded run")}</li>
          <li>{countPhrase(blockCount, "placed block")}</li>
        </ul>

        <p className="reset-plan__note">This cannot be undone.</p>

        <div className="reset-plan__actions">
          {isArmed ? (
            <Button variant="danger" onClick={onReset}>
              Yes, Erase Everything
            </Button>
          ) : (
            <Button variant="danger" onClick={() => setArmed(true)}>
              Reset Plan
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setArmed(false);
              onClose();
            }}
          >
            Keep My Data
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
