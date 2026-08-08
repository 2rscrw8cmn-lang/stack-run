import { CalendarDays, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "../../components/ui/Button";
import { FormField } from "../../components/ui/FormField";
import { Sheet } from "../../components/ui/Sheet";
import {
  shiftKinds,
  type AvailabilityCalendar,
} from "../../domain/availability";
import { formatDateLabel } from "../../domain/dates";
import { CalendarParseError, parseCalendar } from "../../domain/ics";

interface AvailabilitySheetProps {
  calendar: AvailabilityCalendar | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (calendar: AvailabilityCalendar | null) => void;
}

function shiftTime(startTime: string | null, endTime: string | null): string {
  if (!startTime) {
    return "All day";
  }
  return endTime ? `${startTime} – ${endTime}` : startTime;
}

/**
 * Importing somebody else's schedule, and deciding which of it matters.
 *
 * The file is pasted or picked, never fetched. A calendar subscription URL is
 * a standing credential to another person's whereabouts, and this app has
 * nowhere safe to keep one; re-pasting an export takes a few seconds and a
 * roster changes about monthly.
 *
 * Which shifts block a morning run is the user's call, not a guess from the
 * shift's name — a night shift may free the morning or ruin it.
 */
export function AvailabilitySheet({
  calendar,
  isOpen,
  onClose,
  onSave,
}: AvailabilitySheetProps) {
  const [draft, setDraft] = useState<AvailabilityCalendar | null>(calendar);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const fileId = useId();

  const kinds = draft ? shiftKinds(draft) : [];

  function importText(source: string, name: string) {
    try {
      const parsed = parseCalendar(source);
      setDraft({
        name,
        importedAt: new Date().toISOString(),
        shifts: parsed.shifts,
        // Nothing blocks anything until the user says so.
        blockingLabels: draft?.blockingLabels ?? [],
        enabled: true,
      });
      setSkipped(
        parsed.skipped.map((item) => `${item.label} — ${item.reason}`),
      );
      setError(null);
      setText("");
    } catch (caught) {
      setError(
        caught instanceof CalendarParseError
          ? caught.message
          : "That calendar could not be read.",
      );
    }
  }

  function toggleLabel(label: string) {
    setDraft((current) => {
      if (!current) return current;
      const blocking = current.blockingLabels.includes(label)
        ? current.blockingLabels.filter((item) => item !== label)
        : [...current.blockingLabels, label];
      return { ...current, blockingLabels: blocking };
    });
  }

  return (
    <Sheet title="Availability" isOpen={isOpen} onClose={onClose}>
      <div className="availability">
        <p className="availability__lede">
          Import a calendar of the days you cannot run early. STACK marks those
          days and offers to move runs off them. It never changes the plan on
          its own.
        </p>

        {draft ? (
          <div className="availability__summary">
            <p className="availability__name">
              <CalendarDays size={18} strokeWidth={1.8} aria-hidden="true" />
              {draft.name}
            </p>
            <p className="availability__meta">
              {draft.shifts.length}{" "}
              {draft.shifts.length === 1 ? "day" : "days"} imported{" "}
              {formatDateLabel(draft.importedAt.slice(0, 10))}
            </p>
          </div>
        ) : (
          <p className="availability__meta">No calendar imported yet.</p>
        )}

        <FormField
          label="Paste calendar (.ics)"
          hint="Export the schedule from its calendar app, then paste the file's contents here."
          error={error ?? undefined}
        >
          <textarea
            className="run-input"
            rows={3}
            placeholder="BEGIN:VCALENDAR…"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setError(null);
            }}
          />
        </FormField>

        <div className="availability__import">
          <Button
            variant="secondary"
            disabled={text.trim().length === 0}
            onClick={() => importText(text, draft?.name ?? "Imported calendar")}
          >
            Import Pasted Calendar
          </Button>

          <label className="availability__file" htmlFor={fileId}>
            or choose an .ics file
            <input
              id={fileId}
              type="file"
              accept=".ics,text/calendar"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                importText(await file.text(), file.name.replace(/\.ics$/i, ""));
                event.target.value = "";
              }}
            />
          </label>
        </div>

        {skipped.length > 0 && (
          <p className="availability__skipped">
            <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" />
            <span>
              {`${skipped.length} ${skipped.length === 1 ? "event was" : "events were"} not imported: ${skipped.join("; ")}.`}
            </span>
          </p>
        )}

        {kinds.length > 0 && (
          <fieldset className="availability__shifts">
            <legend className="availability__shifts-legend">
              Which shifts stop you running?
            </legend>
            <ul className="availability__shift-list">
              {kinds.map((kind) => (
                <li key={kind.label} className="availability__shift">
                  <button
                    type="button"
                    className="availability__shift-button"
                    aria-pressed={kind.blocks}
                    onClick={() => toggleLabel(kind.label)}
                  >
                    <span className="availability__shift-name">
                      {kind.label}
                    </span>
                    <span className="availability__shift-meta">
                      {kind.days} {kind.days === 1 ? "day" : "days"} ·{" "}
                      {shiftTime(kind.startTime, kind.endTime)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </fieldset>
        )}

        {draft && (
          <label className="availability__toggle">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) =>
                setDraft({ ...draft, enabled: event.target.checked })
              }
            />
            <span>Use this calendar</span>
          </label>
        )}

        <div className="availability__actions">
          <Button onClick={() => onSave(draft)}>Save</Button>
          {calendar && (
            <Button
              variant="danger"
              onClick={() => {
                if (
                  window.confirm(
                    "Remove this calendar? Blocked days go back to being ordinary days.",
                  )
                ) {
                  onSave(null);
                }
              }}
            >
              Remove Calendar
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
