import {
  BookOpen,
  CalendarCheck,
  CalendarClock,
  ChevronRight,
  Compass,
  Database,
  Dumbbell,
  Flag,
  RotateCcw,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Sheet } from "../../components/ui/Sheet";
import {
  blockedDates,
  type AvailabilityCalendar,
} from "../../domain/availability";
import {
  applyCrossTrainingDays,
  currentCrossTrainingDays,
  planCrossTrainingDayChange,
} from "../../domain/crossTrainingDays";
import { formatDateLabel, formatUpdatedAgo } from "../../domain/dates";
import type { RacePlanSetup } from "../../domain/racePlan";
import {
  applyRunDays,
  currentRunDays,
  planRunDayChange,
  WEEKDAY_NAMES,
  type Weekday,
} from "../../domain/runDays";
import type { BlockPlacement, RunLog, TrainingPlan } from "../../domain/types";
import { AvailabilitySheet } from "../availability/AvailabilitySheet";
import { CrossTrainingDaysSheet } from "../plan/CrossTrainingDaysSheet";
import { RaceSetupSheet } from "../plan/RaceSetupSheet";
import { ResetPlanDialog } from "../plan/ResetPlanDialog";
import { RunDaysSheet } from "../plan/RunDaysSheet";

interface SettingsSheetProps {
  isOpen: boolean;
  /**
   * Controlled rather than close-only, because dismissing one of the sheets
   * below reopens this one — going back is a state this component decides.
   */
  onOpenChange: (isOpen: boolean) => void;
  plan: TrainingPlan | null;
  runLogs: RunLog[];
  blockPlacements?: BlockPlacement[];
  today: string;
  raceSetup?: RacePlanSetup | null;
  onGeneratePlan?: (setup: RacePlanSetup, plan: TrainingPlan) => void;
  runDays?: Weekday[] | null;
  onSaveRunDays?: (runDays: Weekday[], plan: TrainingPlan) => void;
  crossTrainingDays?: Weekday[] | null;
  onSaveCrossTrainingDays?: (crossTrainingDays: Weekday[], plan: TrainingPlan) => void;
  availability?: AvailabilityCalendar | null;
  onSaveAvailability?: (calendar: AvailabilityCalendar | null) => void;
  /** Overridable so tests do not depend on the network. */
  fetchIcs?: (url: string) => Promise<string>;
  onResetPlan?: () => void;
  /** Run Data is also reached from Today, so the shell owns that sheet. */
  onOpenRunData?: () => void;
  /** Whether a sync token is stored, for the row's status line. */
  isConnected?: boolean;
  lastSyncedAt?: string | null;
  onOpenAccountCrew?: () => void;
  accountCrewValue?: string;
  /** The signed-in runner's icon, when there is one. */
  accountCrewMark?: ReactNode;
  onReplayTour?: () => void;
}

/** Which sheet this one handed off to, if any. */
type Child = "race" | "run-days" | "cross-training-days" | "availability" | "reset";

interface SettingsRowProps {
  Icon: LucideIcon;
  label: string;
  /** The current answer, so the list says what is set without being opened. */
  value: string;
  onClick: () => void;
  danger?: boolean;
  /**
   * Stands in for the row's glyph. Only the account row uses it, to show the
   * signed-in runner's own icon instead of a generic person symbol.
   */
  mark?: ReactNode;
}

function SettingsRow({ Icon, label, value, onClick, danger, mark }: SettingsRowProps) {
  return (
    <li>
      <button
        type="button"
        className={
          danger ? "settings__row settings__row--danger" : "settings__row"
        }
        onClick={onClick}
      >
        <span className="settings__row-icon" aria-hidden="true">
          {mark ?? <Icon size={18} strokeWidth={1.9} />}
        </span>
        <span className="settings__row-text">
          {/* The space is load bearing: without it the label and the value
              run together into one word in the accessible name. */}
          <span className="settings__row-label">{label}</span>{" "}
          <span className="settings__row-value">{value}</span>
        </span>
        <ChevronRight
          className="settings__row-chevron"
          size={18}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>
    </li>
  );
}

/** `Tue, Thu, Sat, Sun`, in the order a training week runs. */
function weekdayList(days: readonly Weekday[]): string {
  return days.map((day) => WEEKDAY_NAMES[day].slice(0, 3)).join(", ");
}

function availabilityValue(calendar: AvailabilityCalendar | null): string {
  if (!calendar) {
    return "No calendar imported";
  }
  if (!calendar.enabled) {
    return `${calendar.name} · off`;
  }
  const blocked = blockedDates(calendar).size;
  return `${calendar.name} · ${blocked} blocked ${blocked === 1 ? "day" : "days"}`;
}

function runDataValue(
  isConnected: boolean,
  lastSyncedAt: string | null,
): string {
  if (!isConnected) {
    return "Not connected";
  }
  if (!lastSyncedAt) return "Connected on this device · no sync yet";
  const age = Date.now() - new Date(lastSyncedAt).getTime();
  return age >= 2 * 60 * 60_000
    ? `Connected on this device · ${formatUpdatedAgo(lastSyncedAt) ?? "sync date unavailable"}`
    : "Connected on this device";
}

/**
 * Everything that configures the plan, in one place, reached from the bottom
 * bar rather than from the foot of Plan.
 *
 * These five things — the race, the days, the calendar, the connection, and
 * the one that erases it all — were a grid of look-alike buttons under
 * eighteen weeks of schedule, which is where a screen ends rather than where
 * settings live. This is not a fourth destination: it is a sheet, it never
 * becomes the current tab, and Today / Build / Plan are still the only places
 * the app can be.
 *
 * Each row says what it is currently set to, so the list answers most of the
 * questions it exists to answer without being opened at all.
 */
export function SettingsSheet({
  isOpen,
  onOpenChange,
  plan,
  runLogs,
  blockPlacements = [],
  today,
  raceSetup = null,
  onGeneratePlan = () => undefined,
  runDays = null,
  onSaveRunDays = () => undefined,
  crossTrainingDays = null,
  onSaveCrossTrainingDays = () => undefined,
  availability = null,
  onSaveAvailability = () => undefined,
  fetchIcs,
  onResetPlan = () => undefined,
  onOpenRunData = () => undefined,
  isConnected = false,
  lastSyncedAt = null,
  onOpenAccountCrew = () => undefined,
  accountCrewValue = "Not signed in",
  accountCrewMark = null,
  onReplayTour = () => undefined,
}: SettingsSheetProps) {
  const [child, setChild] = useState<Child | null>(null);
  const [isChildOpen, setChildOpen] = useState(false);
  // Bumped whenever a child opens, so a form starts from what is saved rather
  // than from whatever the previous visit left in it.
  const [visit, setVisit] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  /**
   * Dismissing a child comes back here, the way a settings screen does;
   * committing one takes you out to see what changed. Both paths end in the
   * dialog's own close event, so which of them happened has to be remembered.
   */
  const returnHere = useRef(true);

  function openChild(next: Child) {
    returnHere.current = true;
    setChild(next);
    setVisit((count) => count + 1);
    setChildOpen(true);
    onOpenChange(false);
  }

  /** The change was applied: leave settings behind and show the result. */
  function commit(announce: string) {
    returnHere.current = false;
    setAnnouncement(announce);
    setChildOpen(false);
  }

  function childClosed() {
    setChild(null);
    setChildOpen(false);
    if (returnHere.current) {
      onOpenChange(true);
    }
    returnHere.current = true;
  }

  const blocked = blockedDates(availability);
  const shape = runDays ?? (plan ? currentRunDays(plan) : []);
  const crossShape = crossTrainingDays ?? (plan ? currentCrossTrainingDays(plan) : []);

  return (
    <>
      <Sheet
        title="Settings"
        isOpen={isOpen}
        onClose={() => onOpenChange(false)}
      >
        <div className="settings">
          <section className="settings__group">
            <h3 className="settings__group-title">Training</h3>
            <ul className="settings__rows">
              <SettingsRow
                Icon={Flag}
                label="Race"
                value={plan
                  ? `${raceSetup?.name ?? plan.race.name} · ${formatDateLabel(plan.race.date)}`
                  : "No active race"}
                onClick={() => openChild("race")}
              />
              {plan && <SettingsRow
                Icon={CalendarCheck}
                label="Run Days"
                value={
                  runDays
                    ? weekdayList(shape)
                    : `${weekdayList(shape)} · from the plan`
                }
                onClick={() => openChild("run-days")}
              />}
              {plan && <SettingsRow
                Icon={Dumbbell}
                label="Cross Training Days"
                value={crossShape.length ? weekdayList(crossShape) : "None"}
                onClick={() => openChild("cross-training-days")}
              />}
              <SettingsRow
                Icon={CalendarClock}
                label="Availability"
                value={availabilityValue(availability)}
                onClick={() => openChild("availability")}
              />
            </ul>
          </section>

          <section className="settings__group">
            <h3 className="settings__group-title">Run Data</h3>
            <ul className="settings__rows">
              <SettingsRow
                Icon={Database}
                label="Intervals.icu"
                value={runDataValue(isConnected, lastSyncedAt)}
                onClick={() => {
                  onOpenChange(false);
                  onOpenRunData();
                }}
              />
            </ul>
          </section>

          <section className="settings__group">
            <h3 className="settings__group-title">Account & Crew</h3>
            <ul className="settings__rows">
              <SettingsRow
                Icon={Users}
                mark={accountCrewMark}
                label="Account & Crew"
                value={accountCrewValue}
                onClick={() => {
                  onOpenChange(false);
                  onOpenAccountCrew();
                }}
              />
            </ul>
          </section>

          <section className="settings__group">
            <h3 className="settings__group-title">App</h3>
            <ul className="settings__rows">
              <SettingsRow
                Icon={BookOpen}
                label="Getting Started"
                value="Setup · Run Data · Help"
                onClick={() => {
                  window.location.assign("/getting-started");
                }}
              />
              <SettingsRow
                Icon={Compass}
                label="App Tour"
                value="Runs · Build · Plan · Today"
                onClick={onReplayTour}
              />
              <SettingsRow
                Icon={RotateCcw}
                label="Reset STACK"
                value="Erases every recorded run and block"
                onClick={() => openChild("reset")}
                danger
              />
            </ul>
          </section>

          <p className="settings__footer">STACK · Build your race.</p>
        </div>
      </Sheet>

      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>

      {child === "race" && (
        <RaceSetupSheet
          key={visit}
          plan={plan}
          setup={raceSetup}
          runDays={runDays}
          crossTrainingDays={crossTrainingDays}
          runLogs={runLogs}
          today={today}
          isOpen={isChildOpen}
          onClose={childClosed}
          onGenerate={(next, generated) => {
            onGeneratePlan(next, generated);
            commit(`${generated.weeks.length}-week plan built for ${next.name}.`);
          }}
        />
      )}

      {child === "run-days" && plan && (
        <RunDaysSheet
          key={visit}
          plan={plan}
          runDays={runDays}
          runLogs={runLogs}
          today={today}
          blocked={new Set(blocked.keys())}
          isOpen={isChildOpen}
          onClose={childClosed}
          onApply={(days) => {
            const context = { today, blocked: new Set(blocked.keys()), runLogs };
            const reshaped = applyRunDays(plan, days, context);
            const moved = planRunDayChange(plan, days, context).moves.length;
            onSaveRunDays(days, reshaped);
            commit(
              `Run days saved. ${moved} ${moved === 1 ? "run" : "runs"} moved.`,
            );
          }}
        />
      )}

      {child === "cross-training-days" && plan && (
        <CrossTrainingDaysSheet
          key={visit}
          plan={plan}
          crossTrainingDays={crossTrainingDays}
          today={today}
          isOpen={isChildOpen}
          onClose={childClosed}
          onApply={(days) => {
            const context = { today };
            const filled = applyCrossTrainingDays(plan, days, context);
            const added = planCrossTrainingDayChange(plan, days, context).fills.length;
            onSaveCrossTrainingDays(days, filled);
            commit(
              `Cross Training days saved. ${added} ${added === 1 ? "day" : "days"} added.`,
            );
          }}
        />
      )}

      {child === "availability" && (
        <AvailabilitySheet
          key={visit}
          calendar={availability}
          fetchIcs={fetchIcs}
          isOpen={isChildOpen}
          onClose={childClosed}
          onSave={(calendar) => {
            onSaveAvailability(calendar);
            commit(
              calendar
                ? `Calendar saved. ${blockedDates(calendar).size} blocked days.`
                : "Calendar removed.",
            );
          }}
        />
      )}

      {child === "reset" && (
        <ResetPlanDialog
          key={visit}
          runCount={runLogs.length}
          blockCount={blockPlacements.length}
          isOpen={isChildOpen}
          onClose={childClosed}
          onReset={() => {
            onResetPlan();
            commit("Plan reset. Everything recorded has been erased.");
          }}
        />
      )}
    </>
  );
}
