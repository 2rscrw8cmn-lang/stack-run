import { type ReactNode } from "react";
import { Sheet } from "../../components/ui/Sheet.js";
import { RUN_METHODOLOGY_NOTES, type RunOptionFact } from "./runOptions.js";

interface RunOptionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Provenance and secondary detail, already built by the run's own sheet. */
  facts: readonly RunOptionFact[];
  /**
   * The run's own actions — Edit Run, plan linking — passed as elements so this
   * sheet never owns a mutation. Every flow stays where it already lived.
   */
  actions?: ReactNode;
}

/**
 * Everything about a run that is not the run.
 *
 * Issue #214's explicit product decision: editing, plan linking, where the data
 * came from, when it was imported and how STACK calculates what it shows all
 * live behind the `…` control, so the sheet underneath can be about the
 * activity. None of it is hidden — it is one tap away, in one place, instead of
 * competing with the result and the analysis for the top of the screen.
 *
 * This sheet holds no state and performs no mutation of its own. The actions it
 * shows are the same buttons the run's sheet has always rendered, handed in as
 * children, so delete/edit/link ownership is exactly where it was.
 */
export function RunOptionsSheet({ isOpen, onClose, facts, actions }: RunOptionsSheetProps) {
  return (
    <Sheet className="sheet--run-options" title="Run Options" isOpen={isOpen} onClose={onClose}>
      <div className="run-options">
        {actions && <div className="run-options__actions">{actions}</div>}

        {facts.length > 0 && (
          <section className="run-options__section">
            <h3 className="run-detail__section-heading machine-label">Source &amp; detail</h3>
            <dl className="run-options__facts">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="machine-label">{fact.label}</dt>
                  <dd className="data-value">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section className="run-options__section">
          <h3 className="run-detail__section-heading machine-label">How STACK calculates this</h3>
          <ul className="run-options__notes">
            {RUN_METHODOLOGY_NOTES.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      </div>
    </Sheet>
  );
}
