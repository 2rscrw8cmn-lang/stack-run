import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  KeyRound,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { FormField } from "../../components/ui/FormField";
import { Sheet } from "../../components/ui/Sheet";
import { formatDateLabel, todayLocalDate } from "../../domain/dates";
import type { Race } from "../../domain/types";
import { validateCrewDetails } from "../../crew/crewService";
import {
  DEFAULT_CREW_EMBLEM,
  type CrewEmblem as CrewEmblemModel,
} from "../../crew/emblem";
import {
  MEMBER_ACCENTS,
  MEMBER_ACCENT_LABEL,
  crewMemberAccent,
  type CrewMemberAccent,
} from "../../crew/memberAccent";
import {
  sameRunnerIcon,
  type RunnerIcon as RunnerIconModel,
} from "../../crew/runnerIcon";
import { compareCrewRace } from "../../crew/raceMatch";
import type { CrewType, RaceCrew } from "../../crew/types";
import type { RaceCrewController } from "../../crew/useRaceCrew";
import type { ExternalApiTokenScope } from "../../crew/externalApiTokenService";
import { CrewEmblem } from "./CrewEmblem";
import { CrewEmblemBuilder } from "./CrewEmblemBuilder";
import type { PersonalSyncController } from "../../personal-sync/types";
import { PropNotifications } from "./PropNotifications";
import { RunnerIcon } from "./RunnerIcon";
import { RunnerIconBuilder } from "./RunnerIconBuilder";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  crew: RaceCrewController;
  personalSync?: PersonalSyncController;
  localRace: Race | null;
}

/**
 * The hub and every place it can navigate to. A single Sheet swaps its title
 * and body across these rather than stacking dialogs, so the account,
 * profile and each crew's settings stay reachable with one Back tap and one
 * Close.
 */
type View =
  | "main"
  | "profile"
  | "icon"
  | "join"
  | "create"
  | "crew"
  | "edit"
  | "emblem"
  | "delete"
  | "external-tokens";

function BackButton({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <Button
      variant="ghost"
      className="crew-settings__back"
      icon={<ChevronLeft size={18} />}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

function AuthPanel({ crew }: { crew: RaceCrewController }) {
  const [mode, setMode] = useState<"sign-in" | "create">("sign-in");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");

  return (
    <section className="crew-settings__section">
      <div className="crew-settings__switch" aria-label="Account action">
        <button
          type="button"
          aria-pressed={mode === "sign-in"}
          onClick={() => setMode("sign-in")}
        >
          Sign In
        </button>
        <button
          type="button"
          aria-pressed={mode === "create"}
          onClick={() => setMode("create")}
        >
          Create Account
        </button>
      </div>
      <p className="crew-settings__copy">
        An account saves one canonical personal STACK across your devices.
        Signed-out personal STACK still works locally.
      </p>
      {mode === "create" && (
        <FormField label="Display name">
          <input
            className="run-input"
            value={displayName}
            autoComplete="name"
            maxLength={60}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </FormField>
      )}
      <FormField label="Email">
        <input
          className="run-input"
          type="email"
          value={email}
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
        />
      </FormField>
      <FormField label="8-digit STACK PIN">
        <input
          className="run-input"
          type="password"
          inputMode="numeric"
          pattern="[0-9]{8}"
          minLength={8}
          maxLength={8}
          autoComplete={mode === "create" ? "new-password" : "current-password"}
          value={pin}
          onChange={(event) => setPin(event.target.value)}
        />
      </FormField>
      <p className="crew-settings__note">
        Exactly 8 numbers. STACK never saves the raw PIN itself.
      </p>
      <Button
        isLoading={crew.busy}
        icon={mode === "create" ? <UserPlus size={18} /> : <LogIn size={18} />}
        onClick={() => {
          if (mode === "create") {
            void crew.createAccount({ displayName, email, pin });
          } else {
            void crew.signIn({ email, pin });
          }
        }}
      >
        {mode === "create" ? "Create STACK Account" : "Sign In"}
      </Button>
    </section>
  );
}

function PersonalDataPanel({ sync }: { sync: PersonalSyncController }) {
  const initialization = sync.initialization;
  if (initialization) {
    return (
      <section className="crew-settings__section" aria-labelledby="personal-data-title">
        <div className="crew-settings__section-heading">
          <Database size={20} aria-hidden="true" />
          <div>
            <p className="machine-label" id="personal-data-title">Save STACK to your account</p>
            <p className="crew-settings__copy">
              This device has {initialization.runCount} {initialization.runCount === 1 ? "run" : "runs"} and{" "}
              {initialization.blockCount} built {initialization.blockCount === 1 ? "block" : "blocks"}.
            </p>
            <p className="crew-settings__note">
              {initialization.raceName ?? "No active race plan"}
            </p>
          </div>
        </div>
        <p className="crew-settings__copy">
          Choose this only if this is the device whose current personal data
          should initialize the account. A recoverable local backup is created first.
        </p>
        <div className="crew-settings__account-actions">
          <Button
            isLoading={sync.status === "syncing"}
            onClick={() => void sync.initializeFromThisDevice()}
          >
            Use This Device&apos;s Data
          </Button>
          <Button variant="secondary" onClick={sync.deferInitialization}>
            Not Now
          </Button>
        </div>
        {sync.error && (
          <p role="alert" className="crew-settings__message crew-settings__message--error">
            {sync.error}
          </p>
        )}
      </section>
    );
  }

  const statusCopy =
    sync.status === "syncing"
      ? "Syncing…"
      : sync.status === "offline-pending"
        ? "Offline changes waiting"
        : sync.status === "error"
          ? "Sync needs attention"
          : sync.initialized
            ? "Saved to your STACK account"
            : "Account initialization not finished";
  return (
    <section className="crew-settings__section" aria-labelledby="personal-data-title">
      <p className="machine-label" id="personal-data-title">Personal Data</p>
      <p className="crew-settings__copy">{statusCopy}</p>
      {sync.error && (
        <p role="alert" className="crew-settings__message crew-settings__message--error">
          {sync.error}
        </p>
      )}
      {sync.message && <p role="status" className="crew-settings__message">{sync.message}</p>}
      {sync.initialized && (
        <Button
          variant="secondary"
          isLoading={sync.status === "syncing"}
          onClick={() => void sync.syncNow()}
        >
          Sync Now
        </Button>
      )}
    </section>
  );
}

/** Segmented Race Crew / Run Club choice, styled like the sign-in/create switch above it. */
function CrewTypeToggle({
  value,
  onChange,
  disabled,
}: {
  value: CrewType;
  onChange: (next: CrewType) => void;
  disabled?: boolean;
}) {
  return (
    <div className="crew-settings__switch" aria-label="Crew type">
      <button
        type="button"
        aria-pressed={value === "race"}
        disabled={disabled}
        onClick={() => onChange("race")}
      >
        Race Crew
      </button>
      <button
        type="button"
        aria-pressed={value === "club"}
        disabled={disabled}
        onClick={() => onChange("club")}
      >
        Run Club
      </button>
    </div>
  );
}

function PendingInvitePanel({ crew, localRace }: Pick<Props, "crew" | "localRace">) {
  const pending = crew.pendingInvite;
  if (!pending) return null;
  if (pending.error) {
    return <p role="alert" className="crew-settings__message crew-settings__message--error">{pending.error}</p>;
  }
  if (!pending.preview) {
    return <p className="crew-settings__copy">Checking private crew invite…</p>;
  }
  const isClub = pending.preview.crewType === "club";
  const mismatch = compareCrewRace(
    {
      raceName: pending.preview.raceName,
      raceDate: pending.preview.raceDate,
      raceDistanceMiles: pending.preview.raceDistanceMiles,
    },
    localRace,
  );
  return (
    <section className="crew-settings__section crew-settings__invite-preview">
      <p className="machine-label">Private invite</p>
      <div className="crew-settings__crew-identity">
        <CrewEmblem emblem={pending.preview.emblem} size={44} />
        <div>
          <h3>{pending.preview.crewName}</h3>
          <p>
            {isClub ? "Run Club" : (
              <>
                {pending.preview.raceName} · {formatDateLabel(pending.preview.raceDate!)} ·{" "}
                {pending.preview.raceDistanceMiles} mi
              </>
            )}
          </p>
        </div>
      </div>
      {mismatch.mismatched && localRace && (
        <div className="crew-settings__warning" role="status">
          <strong>Your current race does not match this crew.</strong>
          <p>
            Yours: {localRace.name} · {formatDateLabel(localRace.date)} ·{" "}
            {localRace.distanceMiles} mi
          </p>
          <p>Joining will not change your race or training plan.</p>
        </div>
      )}
      {crew.status !== "signed-in" ? (
        <p className="crew-settings__note">Create an account or sign in to join.</p>
      ) : pending.preview.alreadyMember ? (
        <p className="crew-settings__note">You are already in this crew.</p>
      ) : (
        <>
          <Button isLoading={crew.busy} onClick={() => void crew.joinPendingInvite()}>
            {mismatch.mismatched ? "Join Anyway" : "Join Crew"}
          </Button>
          {(crew.account?.memberships.length ?? 0) > 0 && (
            <p className="crew-settings__note">
              You can be in more than one crew. Joining this one keeps the crews
              you are already in.
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** Reached from the hub's `Join Crew` action, for a runner without a link in hand. */
function JoinCrewPanel({ crew, localRace, onBack }: Pick<Props, "crew" | "localRace"> & { onBack: () => void }) {
  return (
    <>
      <BackButton onClick={onBack} />
      {crew.pendingInvite ? (
        <PendingInvitePanel crew={crew} localRace={localRace} />
      ) : (
        <section className="crew-settings__section">
          <p className="crew-settings__copy">
            Ask a crew owner for their private invite link. Opening it on this
            device brings you right back here to join — your local race and
            plan are never changed.
          </p>
        </section>
      )}
    </>
  );
}

function CreateCrewPanel({
  crew,
  localRace,
  onCancel,
}: Pick<Props, "crew" | "localRace"> & { onCancel?: () => void }) {
  const [crewType, setCrewType] = useState<CrewType>("race");
  const [name, setName] = useState("");
  const [raceName, setRaceName] = useState(localRace?.name ?? "");
  const [raceDate, setRaceDate] = useState(localRace?.date ?? "");
  const [distance, setDistance] = useState(
    localRace ? String(localRace.distanceMiles) : "",
  );
  const [buildStartDate, setBuildStartDate] = useState(todayLocalDate());
  const [emblem, setEmblem] = useState<CrewEmblemModel>(DEFAULT_CREW_EMBLEM);
  const isClub = crewType === "club";
  return (
    <section className="crew-settings__section">
      <p className="machine-label">Create a private crew</p>
      <CrewTypeToggle value={crewType} onChange={setCrewType} disabled={crew.busy} />
      <FormField label="Crew name">
        <input className="run-input" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
      </FormField>
      {!isClub && (
        <>
          <FormField label="Race name">
            <input className="run-input" value={raceName} maxLength={120} onChange={(event) => setRaceName(event.target.value)} />
          </FormField>
          <div className="crew-settings__race-fields">
            <FormField label="Race date">
              <input className="run-input" type="date" value={raceDate} onChange={(event) => setRaceDate(event.target.value)} />
            </FormField>
            <FormField label="Distance (mi)">
              <input className="run-input" type="number" min="0.1" step="0.1" inputMode="decimal" value={distance} onChange={(event) => setDistance(event.target.value)} />
            </FormField>
          </div>
        </>
      )}
      <FormField label="Build starts">
        <input className="run-input" type="date" value={buildStartDate} onChange={(event) => setBuildStartDate(event.target.value)} />
      </FormField>
      <p className="crew-settings__note">Runs on or after this date can contribute to the Crew Build.</p>
      <div className="crew-settings__emblem-field">
        <p className="form-field__label">Crew emblem</p>
        <CrewEmblemBuilder emblem={emblem} onChange={setEmblem} />
      </div>
      <div className="crew-settings__form-actions">
        <Button icon={<Users size={18} />} isLoading={crew.busy} onClick={() => void crew.createCrew({
          name,
          crewType,
          raceName: isClub ? null : raceName,
          raceDate: isClub ? null : raceDate || null,
          raceDistanceMiles: isClub ? null : (distance ? Number(distance) : null),
          buildStartDate,
          emblem,
        })}>
          {isClub ? "Create Run Club" : "Create Race Crew"}
        </Button>
        {onCancel && (
          <Button variant="secondary" disabled={crew.busy} onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </section>
  );
}

function EditCrewPanel({
  crew,
  raceCrew,
  onCancel,
  onSaved,
  emblemEditorOpen,
  onEditEmblem,
  onCloseEmblemEditor,
}: {
  crew: RaceCrewController;
  raceCrew: RaceCrew;
  onCancel: () => void;
  onSaved: () => void;
  emblemEditorOpen: boolean;
  onEditEmblem: () => void;
  onCloseEmblemEditor: () => void;
}) {
  const isClub = raceCrew.crewType === "club";
  const [name, setName] = useState(raceCrew.name);
  const [raceName, setRaceName] = useState(raceCrew.raceName ?? "");
  const [raceDate, setRaceDate] = useState(raceCrew.raceDate ?? "");
  const [distance, setDistance] = useState(
    raceCrew.raceDistanceMiles !== null ? String(raceCrew.raceDistanceMiles) : "",
  );
  const [buildStartDate, setBuildStartDate] = useState(raceCrew.buildStartDate);
  const [emblem, setEmblem] = useState<CrewEmblemModel>(raceCrew.emblem);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<ReturnType<typeof validateCrewDetails> | null>(null);

  async function performSave(input: ReturnType<typeof validateCrewDetails>): Promise<void> {
    setPendingChange(null);
    if (await crew.updateCrew(input)) onSaved();
  }

  async function save(): Promise<void> {
    try {
      const input = validateCrewDetails({
        name,
        crewType: raceCrew.crewType,
        raceName: isClub ? null : raceName,
        raceDate: isClub ? null : raceDate || null,
        raceDistanceMiles: isClub ? null : (distance ? Number(distance) : null),
        buildStartDate,
        emblem,
      });
      setValidationError(null);
      const movesLater = input.buildStartDate > raceCrew.buildStartDate;
      const knownRemoved = crew.crewData?.runs.some(
        (run) => run.localDate < input.buildStartDate,
      );
      if (
        movesLater &&
        (knownRemoved || !crew.crewData || crew.crewData.sharedRunsTruncated)
      ) {
        setPendingChange(input);
        return;
      }
      await performSave(input);
    } catch (reason) {
      setValidationError(reason instanceof Error ? reason.message : "Check the Crew details.");
    }
  }

  if (pendingChange) {
    return (
      <section className="crew-settings__section crew-settings__delete-confirmation">
        <h3>Change Crew Build start?</h3>
        <p>
          Changing the Crew Build start to {formatDateLabel(pendingChange.buildStartDate, { month: "short", day: "numeric" })} will pull contributions before that date off the shared Crew Build. They stay visible in each runner's own Member Build, and Personal run history and Personal Builds are not affected.
        </p>
        <div className="crew-settings__form-actions">
          <Button isLoading={crew.busy} onClick={() => void performSave(pendingChange)}>Change Build Start</Button>
          <Button variant="secondary" disabled={crew.busy} onClick={() => setPendingChange(null)}>Keep Current Date</Button>
        </div>
      </section>
    );
  }

  if (emblemEditorOpen) {
    return (
      <section className="crew-settings__section crew-emblem-editor">
        <CrewEmblemBuilder emblem={emblem} onChange={setEmblem} />
        <Button variant="secondary" onClick={onCloseEmblemEditor}>
          Done
        </Button>
      </section>
    );
  }

  return (
    <section className="crew-settings__section">
      <FormField label="Crew name">
        <input className="run-input" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
      </FormField>
      {!isClub && (
        <>
          <FormField label="Race name">
            <input className="run-input" value={raceName} maxLength={120} onChange={(event) => setRaceName(event.target.value)} />
          </FormField>
          <div className="crew-settings__race-fields">
            <FormField label="Race date">
              <input className="run-input" type="date" value={raceDate} onChange={(event) => setRaceDate(event.target.value)} />
            </FormField>
            <FormField label="Distance (mi)">
              <input className="run-input" type="number" min="0.1" step="0.1" inputMode="decimal" value={distance} onChange={(event) => setDistance(event.target.value)} />
            </FormField>
          </div>
        </>
      )}
      <FormField label="Build starts">
        <input className="run-input" type="date" value={buildStartDate} onChange={(event) => setBuildStartDate(event.target.value)} />
      </FormField>
      <p className="crew-settings__note">Runs on or after this date can contribute to the Crew Build.</p>
      <EmblemField emblem={emblem} onEdit={onEditEmblem} />
      {validationError && <p role="alert" className="crew-settings__message crew-settings__message--error">{validationError}</p>}
      <div className="crew-settings__form-actions">
        <Button isLoading={crew.busy} onClick={() => void save()}>Save Changes</Button>
        <Button variant="secondary" disabled={crew.busy} onClick={onCancel}>Cancel</Button>
      </div>
    </section>
  );
}

/** The parent Sheet swaps to a compact emblem sub-view when this is opened. */
function EmblemField({ emblem, onEdit }: { emblem: CrewEmblemModel; onEdit: () => void }) {
  return (
    <div className="crew-settings__emblem-field">
      <p className="form-field__label">Crew emblem</p>
      <div className="crew-settings__emblem-summary">
        <CrewEmblem emblem={emblem} size={56} label="Current crew emblem" />
        <Button variant="secondary" icon={<Pencil size={18} />} onClick={onEdit}>
          Edit Emblem
        </Button>
      </div>
    </div>
  );
}

function DeleteCrewPanel({
  crew,
  raceCrew,
  onCancel,
  onDeleted,
}: {
  crew: RaceCrewController;
  raceCrew: RaceCrew;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  return (
    <section className="crew-settings__section crew-settings__delete-confirmation">
      <h3>Delete {raceCrew.name}?</h3>
      <p>This removes the Crew and its shared data for everyone. Each runner&apos;s personal STACK stays with their account or local-only browser.</p>
      <p>This can&apos;t be undone.</p>
      <div className="crew-settings__form-actions">
        <Button variant="secondary" disabled={crew.busy} onClick={onCancel}>Cancel</Button>
        <Button
          variant="danger"
          icon={<Trash2 size={18} />}
          isLoading={crew.busy}
          onClick={() => void crew.deleteCrew().then((deleted) => {
            if (deleted) onDeleted();
          })}
        >
          Delete Crew
        </Button>
      </div>
    </section>
  );
}

/**
 * The Crew Settings sub-sheet for whichever crew the hub sent the runner to:
 * identity + emblem, race/Build start, members, invites, and owner/member
 * actions. The hub's crew list is the only place that says which crew is
 * being viewed, so this panel never repeats that state.
 */
function CrewSettingsPanel({
  crew,
  onBack,
  onEdit,
  onDelete,
}: {
  crew: RaceCrewController;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const account = crew.account;
  const raceCrew = account?.crew;
  if (!account || !raceCrew || !account.role) {
    return (
      <>
        <BackButton onClick={onBack} />
        <p className="crew-settings__copy">Switching crews…</p>
      </>
    );
  }
  return (
    <>
      <BackButton onClick={onBack} />
      <section className="crew-settings__section">
        <div className="crew-settings__crew-identity">
          <CrewEmblem emblem={raceCrew.emblem} size={44} />
          <div>
            <h3>{raceCrew.name}</h3>
            <p>
              {raceCrew.crewType === "club" ? "Run Club" : (
                <>
                  {raceCrew.raceName} · {formatDateLabel(raceCrew.raceDate!)} ·{" "}
                  {raceCrew.raceDistanceMiles} mi
                </>
              )}
            </p>
          </div>
        </div>
        <p className="crew-settings__note">Build starts {formatDateLabel(raceCrew.buildStartDate)}.</p>

        {account.role === "owner" && (
          <Button variant="secondary" icon={<Pencil size={18} />} onClick={onEdit}>
            Edit Crew
          </Button>
        )}
      </section>

      <section className="crew-settings__section">
        <div className="crew-settings__members">
          <h4>Members</h4>
          <ul>
            {account.members.map((member) => (
              <li
                key={member.userId}
                data-member-color={crewMemberAccent(member.userId, member.accentColor)}
              >
                <RunnerIcon icon={member.runnerIcon} size={28} />
                <span>
                  <strong>{member.displayName}</strong>
                  <small>{member.role === "owner" ? "Owner" : "Member"}</small>
                </span>
                {account.role === "owner" && member.role !== "owner" && (
                  <button type="button" onClick={() => void crew.removeMember(member.userId)}>
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {account.role === "owner" && (
        <section className="crew-settings__section">
          <div className="crew-settings__owner-tools">
            <h4>Invite Link</h4>
            {crew.latestInviteUrl && (
              <div className="crew-settings__invite-link">
                <label htmlFor="crew-invite-url">Invite link</label>
                <input id="crew-invite-url" className="run-input" readOnly value={crew.latestInviteUrl} />
                <Button variant="secondary" icon={<Copy size={18} />} onClick={() => void navigator.clipboard.writeText(crew.latestInviteUrl ?? "")}>
                  Copy Link
                </Button>
                <Button variant="danger" onClick={() => void crew.resetInvite()}>
                  Reset Link
                </Button>
                <p>Anyone with this link can join. Resetting it immediately disables the old link.</p>
              </div>
            )}
            {!crew.latestInviteUrl && (
              <Button variant="secondary" icon={<UserPlus size={18} />} isLoading={crew.busy} onClick={() => void crew.createInvite()}>
                Get Invite Link
              </Button>
            )}
            <div className="crew-settings__danger">
              <p className="machine-label">Danger zone</p>
              <Button variant="danger" icon={<Trash2 size={18} />} onClick={onDelete}>
                Delete Crew
              </Button>
            </div>
          </div>
        </section>
      )}

      {account.role === "member" && (
        <section className="crew-settings__section">
          <Button variant="danger" onClick={() => void crew.leaveCrew()}>
            Leave Crew
          </Button>
        </section>
      )}
    </>
  );
}

/**
 * Every crew this account is in, and which one the app is showing. Crews are
 * peers, not a hierarchy: a runner can be training for a spring marathon
 * with one set of friends and a summer trail race with another. Tapping a
 * card opens that crew's settings, switching the app's active crew first if
 * it was not already the one being viewed — a view change on this device
 * only, never a membership or Build change.
 */
function CrewHubList({
  crew,
  onOpenCrew,
  onJoin,
  onCreate,
}: {
  crew: RaceCrewController;
  onOpenCrew: (crewId: string) => void;
  onJoin: () => void;
  onCreate: () => void;
}) {
  const account = crew.account;
  const memberships = account?.memberships ?? [];
  return (
    <section className="crew-settings__section">
      <p className="machine-label">Crews</p>
      {memberships.length === 0 ? (
        <p className="crew-settings__copy">
          You are not in a crew yet. Create one or join with a private invite link.
        </p>
      ) : (
        <ul className="crew-settings__crew-list" aria-label="Your crews">
          {memberships.map(({ crew: raceCrew, role }) => {
            const isActive = raceCrew.id === account?.crew?.id;
            return (
              <li key={raceCrew.id}>
                <button
                  type="button"
                  className="crew-settings__crew-option"
                  aria-pressed={isActive}
                  disabled={crew.busy}
                  onClick={() => onOpenCrew(raceCrew.id)}
                >
                  <CrewEmblem emblem={raceCrew.emblem} size={34} />
                  <span className="crew-settings__crew-option-body">
                    <strong>{raceCrew.name}</strong>
                    <small>
                      {raceCrew.crewType === "club"
                        ? "Run Club"
                        : `${raceCrew.raceName} · ${formatDateLabel(raceCrew.raceDate!)}`}
                      {" · "}
                      {role === "owner" ? "Owner" : "Member"}
                    </small>
                  </span>
                  <span className="machine-label">{isActive ? "Viewing" : "Switch"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="crew-settings__form-actions">
        <Button variant="secondary" icon={<LogIn size={18} />} onClick={onJoin}>
          Join Crew
        </Button>
        <Button variant="secondary" icon={<Plus size={18} />} onClick={onCreate}>
          Create Crew
        </Button>
      </div>
    </section>
  );
}

/**
 * Sixteen colors, none of them an activity color, so a runner's identity in
 * the Crew Build tower never reads as the type of run instead of who ran it.
 * A color already worn by a current crewmate is greyed out here — the
 * `profiles` trigger is the actual referee, this is just steering the runner
 * away from a pick that would be rejected anyway.
 */
function AccentColorPicker({
  current,
  taken,
  busy,
  onPick,
}: {
  current: CrewMemberAccent | null;
  taken: ReadonlySet<CrewMemberAccent>;
  busy: boolean;
  onPick: (accentColor: CrewMemberAccent) => void;
}) {
  return (
    <div className="crew-settings__accent-field">
      <p className="form-field__label">Your color</p>
      <ul className="crew-settings__accent-picker" aria-label="Your color">
        {MEMBER_ACCENTS.map((accentColor) => {
          const isCurrent = accentColor === current;
          const isTaken = taken.has(accentColor) && !isCurrent;
          const label = isTaken
            ? `${MEMBER_ACCENT_LABEL[accentColor]}, taken by another crew member`
            : isCurrent
              ? `${MEMBER_ACCENT_LABEL[accentColor]}, your current color`
              : MEMBER_ACCENT_LABEL[accentColor];
          return (
            <li key={accentColor}>
              <button
                type="button"
                className="crew-settings__accent-swatch"
                data-member-color={accentColor}
                aria-pressed={isCurrent}
                aria-label={label}
                disabled={isTaken || busy}
                onClick={() => onPick(accentColor)}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The Edit Profile sub-sheet: account-scoped controls only, never Crew-specific ones. */
function AccountProfilePanel({
  crew,
  onBack,
  onEditIcon,
  onOpenExternalTokens,
}: {
  crew: RaceCrewController;
  onBack: () => void;
  onEditIcon: () => void;
  onOpenExternalTokens: () => void;
}) {
  const [displayName, setDisplayName] = useState(
    crew.account?.profile.displayName ?? "",
  );
  // Explicit picks across every crew this account is in — the same union the
  // database enforces, so the picker cannot offer a color it would reject.
  const takenAccents = new Set(crew.account?.takenAccentColors ?? []);
  const profile = crew.account?.profile ?? null;
  return (
    <>
      <BackButton onClick={onBack} />
      <section className="crew-settings__section">
        <p className="machine-label">STACK account</p>
        <p className="crew-settings__email">{crew.email}</p>
        <FormField label="Profile display name">
          <input className="run-input" value={displayName} maxLength={60} onChange={(event) => setDisplayName(event.target.value)} />
        </FormField>
        <div className="crew-settings__account-actions">
          <Button variant="secondary" disabled={!displayName.trim()} onClick={() => void crew.saveDisplayName(displayName)}>
            Save Name
          </Button>
          <Button variant="secondary" icon={<LogOut size={18} />} onClick={() => void crew.signOut()}>
            Sign Out
          </Button>
        </div>
        {profile && (
          <button
            type="button"
            className="crew-settings__icon-row"
            data-member-color={crewMemberAccent(profile.id, profile.accentColor)}
            onClick={onEditIcon}
          >
            <RunnerIcon
              icon={profile.runnerIcon}
              accent={crewMemberAccent(profile.id, profile.accentColor)}
              size={38}
            />
            <span className="crew-settings__icon-row-body">
              <strong>Runner Icon</strong>
              <small>Your personal mark across Crew</small>
            </span>
            <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
        <AccentColorPicker
          current={profile?.accentColor ?? null}
          taken={takenAccents}
          busy={crew.busy}
          onPick={(accentColor) => void crew.saveAccentColor(accentColor)}
        />
        <button
          type="button"
          className="crew-settings__icon-row"
          onClick={onOpenExternalTokens}
        >
          <span className="crew-settings__icon-row-glyph" aria-hidden="true">
            <KeyRound size={20} strokeWidth={1.9} />
          </span>
          <span className="crew-settings__icon-row-body">
            <strong>External Assistant Access</strong>
            <small>Let an assistant you choose read your training data</small>
          </span>
          <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </section>
    </>
  );
}

/**
 * The Runner Icon editor, one level below Edit Profile.
 *
 * Parts are drafted and committed with Save Icon; the color is not. A color
 * change repaints Crew Build blocks, comparison bars and every other
 * member-colored surface, so it is the same immediate, single-source control
 * it is on the profile panel — the runner has one identity color, and this
 * screen shows it rather than owning a second one.
 */
function RunnerIconPanel({ crew, onBack }: { crew: RaceCrewController; onBack: () => void }) {
  const profile = crew.account?.profile ?? null;
  const saved = profile?.runnerIcon ?? null;
  const [draft, setDraft] = useState<RunnerIconModel | null>(saved);
  if (!profile || !saved) return <BackButton onClick={onBack} label="Back to Edit Profile" />;

  const icon = draft ?? saved;
  const accent = crewMemberAccent(profile.id, profile.accentColor);
  const unsaved = !sameRunnerIcon(icon, saved);

  return (
    <>
      <BackButton onClick={onBack} label="Back to Edit Profile" />
      <section className="crew-settings__section">
        <p className="crew-settings__note">Your mark across Crew. Uses your color.</p>
        <RunnerIconBuilder icon={icon} accent={accent} onChange={setDraft} />
        <AccentColorPicker
          current={profile.accentColor}
          taken={new Set(crew.account?.takenAccentColors ?? [])}
          busy={crew.busy}
          onPick={(accentColor) => void crew.saveAccentColor(accentColor)}
        />
        <div className="crew-settings__form-actions">
          <Button
            disabled={!unsaved}
            isLoading={crew.busy}
            onClick={() => void crew.saveRunnerIcon(icon)}
          >
            Save Icon
          </Button>
        </div>
      </section>
    </>
  );
}

function tokenDateLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.valueOf())
    ? iso
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * #178's token management: one revocable personal credential per external
 * assistant a runner chooses to connect. The raw value is shown exactly
 * once, right after creation — `external_api_tokens` never lets it, or even
 * its hash, be read back afterward, so this screen has no "reveal" affordance
 * for an existing row, only for the one just minted.
 */
const SCOPE_LABEL: Record<ExternalApiTokenScope, string> = {
  read: "Read only",
  read_write: "Read & write",
};

function ExternalApiTokensPanel({ crew, onBack }: { crew: RaceCrewController; onBack: () => void }) {
  const [label, setLabel] = useState("");
  // Least-privilege default: a runner opts into write access, rather than
  // opting out of it.
  const [scope, setScope] = useState<ExternalApiTokenScope>("read");
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const tokens = crew.externalApiTokens;

  useEffect(() => {
    void crew.refreshExternalApiTokens();
    // Runs once per visit to this panel — refreshExternalApiTokens is stable
    // across the controller's lifetime, and re-running on every render would
    // fight the optimistic list update after create/revoke below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createToken(): Promise<void> {
    const trimmed = label.trim();
    if (!trimmed) return;
    const token = await crew.createExternalApiToken(trimmed, scope);
    setRevealedToken(token);
    setCopied(false);
    setLabel("");
  }

  return (
    <>
      <BackButton onClick={onBack} label="Back to Edit Profile" />
      <section className="crew-settings__section">
        <p className="crew-settings__copy">
          Connect an external assistant — ChatGPT, for example — so it can read your plan, recent runs and Build progress and help you adjust what's ahead. STACK never sends your data anywhere on its own: a token only works once you hand it to something you chose.
        </p>

        {revealedToken && (
          <div className="crew-settings__invite-link">
            <label htmlFor="external-api-token-value">New token — copy it now</label>
            <input id="external-api-token-value" className="run-input" readOnly value={revealedToken} />
            <Button
              variant="secondary"
              icon={<Copy size={18} />}
              onClick={() => {
                void navigator.clipboard.writeText(revealedToken);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy Token"}
            </Button>
            <p>This is the only time STACK will show this token. Once you leave this screen, it cannot be read back.</p>
          </div>
        )}

        <FormField label="Name this connection">
          <input
            className="run-input"
            value={label}
            maxLength={80}
            placeholder="e.g. ChatGPT"
            onChange={(event) => setLabel(event.target.value)}
          />
        </FormField>

        <div className="crew-settings__switch" aria-label="Access level">
          <button
            type="button"
            aria-pressed={scope === "read"}
            onClick={() => setScope("read")}
          >
            Read only
          </button>
          <button
            type="button"
            aria-pressed={scope === "read_write"}
            onClick={() => setScope("read_write")}
          >
            Read &amp; write
          </button>
        </div>
        <p className="crew-settings__copy">
          {scope === "read"
            ? "Sees your plan, recent runs, Build progress and Crew summary. Cannot change anything."
            : "All of the above, plus your assistant can adjust future workouts — never Build, never past runs, never your race goal."}
        </p>

        <Button
          variant="secondary"
          icon={<KeyRound size={18} />}
          disabled={!label.trim()}
          isLoading={crew.busy}
          onClick={() => void createToken()}
        >
          Create Token
        </Button>

        {tokens && tokens.length > 0 && (
          <ul className="crew-settings__external-tokens">
            {tokens.map((token) => (
              <li key={token.id} className="crew-settings__external-token-row">
                <span className="crew-settings__external-token-body">
                  <strong>{token.label}</strong>
                  <small>
                    {SCOPE_LABEL[token.scope]}
                    {" · "}
                    {token.revokedAt
                      ? `Revoked ${tokenDateLabel(token.revokedAt)}`
                      : token.lastUsedAt
                        ? `Last used ${tokenDateLabel(token.lastUsedAt)}`
                        : `Created ${tokenDateLabel(token.createdAt)} · never used`}
                  </small>
                </span>
                {!token.revokedAt && (
                  <Button
                    variant="danger"
                    disabled={crew.busy}
                    onClick={() => void crew.revokeExternalApiToken(token.id)}
                  >
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {tokens && tokens.length === 0 && (
          <p className="crew-settings__copy">No external assistant is connected yet.</p>
        )}
      </section>
    </>
  );
}

function sheetTitle(view: View): string {
  switch (view) {
    case "profile":
      return "Edit Profile";
    case "icon":
      return "Runner Icon";
    case "join":
      return "Join Crew";
    case "create":
      return "Create Crew";
    case "crew":
      return "Crew Settings";
    case "edit":
      return "Edit Crew";
    case "emblem":
      return "Edit Emblem";
    case "delete":
      return "Delete Crew";
    case "external-tokens":
      return "External Assistant Access";
    default:
      return "Account & Crew";
  }
}

export function AccountCrewSheet({ isOpen, onClose, crew, personalSync, localRace }: Props) {
  const signedIn = crew.status === "signed-in";
  const [view, setView] = useState<View>("main");
  const [createStartCount, setCreateStartCount] = useState<number | null>(null);
  const raceCrew = crew.account?.crew ?? null;
  const isOwner = crew.account?.role === "owner";
  const crewCount = crew.account?.memberships.length ?? 0;
  const markPropsSeen = crew.markPropsSeen;

  // Opening the sheet is a read: whatever Props were unread when it opened
  // clear from here and the runner's header icon alike.
  useEffect(() => {
    if (isOpen && signedIn) void markPropsSeen();
  }, [isOpen, signedIn, markPropsSeen]);

  // A create that actually produced a crew is recognized as a changed
  // membership count, so the sheet returns to the hub as soon as that count
  // moves — derived at render rather than chased with an effect.
  const createFinished =
    view === "create" && createStartCount !== null && crewCount > createStartCount;

  // Owner-only edit/emblem/delete views fall back to the hub if the role or
  // crew they depend on is gone, e.g. a stale view surviving a crew switch.
  const ownerOnlyView = view === "edit" || view === "emblem" || view === "delete";
  const visibleView: View =
    !signedIn || createFinished || (ownerOnlyView && (!isOwner || !raceCrew)) ? "main" : view;

  function openCrew(crewId: string): void {
    if (crew.account?.crew?.id !== crewId) {
      void crew.switchCrew(crewId);
    }
    setView("crew");
  }

  function openCreate(): void {
    setCreateStartCount(crewCount);
    setView("create");
  }

  return (
    <Sheet
      title={sheetTitle(visibleView)}
      isOpen={isOpen}
      onClose={() => {
        setView("main");
        setCreateStartCount(null);
        onClose();
      }}
      className="crew-settings-sheet"
    >
      <div className="crew-settings">
        {visibleView === "profile" && (
          <AccountProfilePanel
            crew={crew}
            onBack={() => setView("main")}
            onEditIcon={() => setView("icon")}
            onOpenExternalTokens={() => setView("external-tokens")}
          />
        )}

        {visibleView === "icon" && (
          <RunnerIconPanel crew={crew} onBack={() => setView("profile")} />
        )}

        {visibleView === "external-tokens" && (
          <ExternalApiTokensPanel crew={crew} onBack={() => setView("profile")} />
        )}

        {visibleView === "join" && (
          <JoinCrewPanel crew={crew} localRace={localRace} onBack={() => setView("main")} />
        )}

        {visibleView === "create" && (
          <>
            <BackButton onClick={() => setView("main")} />
            <CreateCrewPanel crew={crew} localRace={localRace} onCancel={() => setView("main")} />
          </>
        )}

        {visibleView === "crew" && (
          <CrewSettingsPanel
            crew={crew}
            onBack={() => setView("main")}
            onEdit={() => setView("edit")}
            onDelete={() => setView("delete")}
          />
        )}

        {(visibleView === "edit" || visibleView === "emblem") && raceCrew && (
          <>
            <BackButton onClick={() => setView("crew")} label="Back to Crew Settings" />
            <EditCrewPanel
              crew={crew}
              raceCrew={raceCrew}
              onCancel={() => setView("crew")}
              onSaved={() => setView("crew")}
              emblemEditorOpen={visibleView === "emblem"}
              onEditEmblem={() => setView("emblem")}
              onCloseEmblemEditor={() => setView("edit")}
            />
          </>
        )}

        {visibleView === "delete" && raceCrew && (
          <>
            <BackButton onClick={() => setView("crew")} label="Back to Crew Settings" />
            <DeleteCrewPanel
              crew={crew}
              raceCrew={raceCrew}
              onCancel={() => setView("crew")}
              onDeleted={() => setView("main")}
            />
          </>
        )}

        {visibleView === "main" && (
          <>
            {!crew.configured && (
              <section className="crew-settings__empty">
                <ShieldCheck size={24} aria-hidden="true" />
                <h3>Race Crew unavailable</h3>
                <p>{crew.unavailableReason}</p>
              </section>
            )}

            {crew.configured && crew.status === "loading" && (
              <p className="crew-settings__copy">Loading account…</p>
            )}

            {crew.configured && crew.status === "signed-out" && (
              <>
                <PendingInvitePanel crew={crew} localRace={localRace} />
                <AuthPanel crew={crew} />
              </>
            )}

            {crew.configured && signedIn && (
              <>
                {personalSync && <PersonalDataPanel sync={personalSync} />}
                <ul className="settings__rows">
                  <li>
                    <button
                      type="button"
                      className="settings__row"
                      onClick={() => setView("profile")}
                    >
                      {/* The runner's own mark, not a generic person glyph:
                          this row is them, and they built this. */}
                      <span className="settings__row-icon" aria-hidden="true">
                        {crew.account ? (
                          <RunnerIcon
                            icon={crew.account.profile.runnerIcon}
                            accent={crewMemberAccent(
                              crew.account.profile.id,
                              crew.account.profile.accentColor,
                            )}
                            size={24}
                          />
                        ) : (
                          <UserRound size={18} strokeWidth={1.9} />
                        )}
                      </span>
                      <span className="settings__row-text">
                        <span className="settings__row-label">
                          {crew.account?.profile.displayName ?? "Account"}
                        </span>{" "}
                        <span className="settings__row-value">{crew.email}</span>
                      </span>
                      <ChevronRight
                        className="settings__row-chevron"
                        size={18}
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                </ul>

                {crew.account?.crew && (
                  <PropNotifications
                    notifications={crew.visiblePropNotifications}
                    propsSeenAt={crew.account.profile.propsSeenAt}
                    onDismiss={crew.dismissPropNotification}
                  />
                )}

                <PendingInvitePanel crew={crew} localRace={localRace} />

                <CrewHubList
                  crew={crew}
                  onOpenCrew={openCrew}
                  onJoin={() => setView("join")}
                  onCreate={openCreate}
                />
              </>
            )}

            {crew.error && <p role="alert" className="crew-settings__message crew-settings__message--error">{crew.error}</p>}
            {crew.message && <p role="status" className="crew-settings__message">{crew.message}</p>}
            {crew.projectionWaitingForPersonal ? (
              <p className="crew-settings__note" role="status">
                Crew sharing starts as soon as personal STACK finishes syncing on this device.
              </p>
            ) : crew.projectionError ? (
              <>
                <p className="crew-settings__note">Crew sharing will retry later. Personal STACK is unaffected.</p>
                {/*
                  * Issue #128 asked that a blocked projection not fail
                  * silently. Reassurance alone was still silent about the one
                  * thing anyone diagnosing this needs: the reason the upload
                  * was refused.
                  */}
                <p className="crew-settings__note crew-settings__note--detail">
                  {crew.projectionError}
                </p>
              </>
            ) : null}
          </>
        )}
        {visibleView !== "main" && crew.error && <p role="alert" className="crew-settings__message crew-settings__message--error">{crew.error}</p>}
      </div>
    </Sheet>
  );
}
