import { CalendarDays, RotateCcw, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "../../components/ui/Button";
import { FormField } from "../../components/ui/FormField";
import { Sheet } from "../../components/ui/Sheet";
import {
  shiftKinds,
  type AvailabilityCalendar,
} from "../../domain/availability";
import {
  CalendarFetchError,
  fetchCalendar,
  nameFromUrl,
  readCalendarSource,
} from "../../domain/calendarSource";
import { formatDateLabel } from "../../domain/dates";
import { CalendarParseError, parseCalendar } from "../../domain/ics";

interface AvailabilitySheetProps {
  calendar: AvailabilityCalendar | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (calendar: AvailabilityCalendar | null) => void;
  /** Overridable so tests do not depend on the network. */
  fetchIcs?: (url: string) => Promise<string>;
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
 * Paste a subscription link or the contents of an .ics file — whichever you
 * have. A link is what a rostering system hands out, and on a phone it is
 * usually the only form of it you can get at, so the app fetches it: from the
 * calendar host directly when that host allows it, and otherwise through the
 * deployment's own reader. The file picker remains the fallback that works
 * with no network path at all.
 *
 * Which shifts block a morning run is the user's call, not a guess from the
 * shift's name — a night shift may free the morning or ruin it.
 */
export function AvailabilitySheet({
  calendar,
  isOpen,
  onClose,
  onSave,
  fetchIcs,
}: AvailabilitySheetProps) {
  const fetchIcsFile = fetchIcs ?? fetchCalendar;
  const [draft, setDraft] = useState<AvailabilityCalendar | null>(calendar);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [isLoading, setLoading] = useState(false);
  const fileId = useId();

  const kinds = draft ? shiftKinds(draft) : [];

  function applyCalendar(source: string, name: string, sourceUrl: string | null) {
    const parsed = parseCalendar(source);
    setDraft((current) => ({
      name,
      importedAt: new Date().toISOString(),
      shifts: parsed.shifts,
      sourceUrl,
      // Nothing blocks anything until the user says so, and a refresh keeps
      // the choices already made.
      blockingLabels: current?.blockingLabels ?? [],
      enabled: current?.enabled ?? true,
    }));
    setSkipped(parsed.skipped.map((item) => `${item.label} — ${item.reason}`));
    setError(null);
    setText("");
  }

  function describe(caught: unknown): string {
    if (caught instanceof CalendarParseError || caught instanceof CalendarFetchError) {
      return caught.message;
    }
    return "That calendar could not be read.";
  }

  /** Handles both forms of paste: a link to fetch, or a calendar to read. */
  async function importPasted() {
    const source = readCalendarSource(text);
    if (source.kind === "text") {
      try {
        applyCalendar(source.text, draft?.name ?? "Imported calendar", null);
      } catch (caught) {
        setError(describe(caught));
      }
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const body = await fetchIcsFile(source.url);
      applyCalendar(body, draft?.name ?? nameFromUrl(source.url), source.url);
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setLoading(false);
    }
  }

  async function refresh(url: string) {
    setLoading(true);
    setError(null);
    try {
      applyCalendar(
        await fetchIcsFile(url),
        draft?.name ?? nameFromUrl(url),
        url,
      );
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setLoading(false);
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

            {draft.sourceUrl && (
              <>
                <p className="availability__source">{draft.sourceUrl}</p>
                <div className="availability__source-actions">
                  <Button
                    variant="secondary"
                    icon={<RotateCcw size={16} strokeWidth={2} />}
                    isLoading={isLoading}
                    onClick={() => refresh(draft.sourceUrl!)}
                  >
                    {isLoading ? "Reading…" : "Refresh"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setDraft({ ...draft, sourceUrl: null })}
                  >
                    Forget Link
                  </Button>
                </div>
                <p className="availability__warning">
                  Anyone with this link can read the schedule. It is kept on
                  this device only. It is sent to the calendar host — by way of
                  this app's own reader when that host refuses the browser,
                  which keeps no copy of it.
                </p>
              </>
            )}
          </div>
        ) : (
          <p className="availability__meta">No calendar imported yet.</p>
        )}

        <FormField
          label="Calendar link or .ics contents"
          hint="Paste the subscription link from the calendar app, or the contents of an exported .ics file."
          error={error ?? undefined}
        >
          <textarea
            className="run-input"
            rows={3}
            placeholder="https://… or BEGIN:VCALENDAR…"
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
            isLoading={isLoading}
            onClick={importPasted}
          >
            {isLoading ? "Reading…" : "Import"}
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
                try {
                  applyCalendar(
                    await file.text(),
                    file.name.replace(/\.ics$/i, ""),
                    null,
                  );
                } catch (caught) {
                  setError(describe(caught));
                }
                event.target.value = "";
              }}
            />
          </label>
        </div>

        {/*
          A dimmed button is not enough feedback on a phone: reading a link can
          take seconds, and with nothing on screen saying so the app looks like
          it ignored the tap.
        */}
        {isLoading && (
          <p className="availability__status" role="status">
            Reading the calendar. This can take a few seconds.
          </p>
        )}

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
