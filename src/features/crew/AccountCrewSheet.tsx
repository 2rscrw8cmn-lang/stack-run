import {
  ChevronLeft,
  ChevronRight,
  Copy,
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
import { useState } from "react";
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
  type CrewMemberAccent,
} from "../../crew/memberAccent";
import { compareCrewRace } from "../../crew/raceMatch";
import type { RaceCrew } from "../../crew/types";
import type { RaceCrewController } from "../../crew/useRaceCrew";
import { CrewEmblem } from "./CrewEmblem";
import { CrewEmblemBuilder } from "./CrewEmblemBuilder";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  crew: RaceCrewController;
  localRace: Race | null;
}

/**
 * The hub and every place it can navigate to. A single Sheet swaps its title
 * and body across these rather than stacking dialogs, so the account,
 * profile and each crew's settings stay reachable with one Back tap and one
 * Close.
 */
type View = "main" | "profile" | "join" | "create" | "crew" | "edit" | "emblem" | "delete";

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
        An account adds Race Crew identity only. Your plan, runs and Build stay
        on this device and personal STACK still works signed out.
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

function PendingInvitePanel({ crew, localRace }: Pick<Props, "crew" | "localRace">) {
  const pending = crew.pendingInvite;
  if (!pending) return null;
  if (pending.error) {
    return <p role="alert" className="crew-settings__message crew-settings__message--error">{pending.error}</p>;
  }
  if (!pending.preview) {
    return <p className="crew-settings__copy">Checking private crew invite…</p>;
  }
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
            {pending.preview.raceName} · {formatDateLabel(pending.preview.raceDate)} ·{" "}
            {pending.preview.raceDistanceMiles} mi
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
  const [name, setName] = useState("");
  const [raceName, setRaceName] = useState(localRace?.name ?? "");
  const [raceDate, setRaceDate] = useState(localRace?.date ?? "");
  const [distance, setDistance] = useState(
    localRace ? String(localRace.distanceMiles) : "",
  );
  const [buildStartDate, setBuildStartDate] = useState(todayLocalDate());
  const [emblem, setEmblem] = useState<CrewEmblemModel>(DEFAULT_CREW_EMBLEM);
  return (
    <section className="crew-settings__section">
      <p className="machine-label">Create a private crew</p>
      <FormField label="Crew name">
        <input className="run-input" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
      </FormField>
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
          raceName,
          raceDate,
          raceDistanceMiles: Number(distance),
          buildStartDate,
          emblem,
        })}>
          Create Race Crew
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
  const [name, setName] = useState(raceCrew.name);
  const [raceName, setRaceName] = useState(raceCrew.raceName);
  const [raceDate, setRaceDate] = useState(raceCrew.raceDate);
  const [distance, setDistance] = useState(String(raceCrew.raceDistanceMiles));
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
        raceName,
        raceDate,
        raceDistanceMiles: Number(distance),
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
      <p>This removes the Crew and its shared data for everyone. Personal STACK data stays on each runner&apos;s device.</p>
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
  const activeInvites = account.invites.filter(
    (invite) => !invite.revokedAt && !invite.redeemedAt,
  );
  return (
    <>
      <BackButton onClick={onBack} />
      <section className="crew-settings__section">
        <div className="crew-settings__crew-identity">
          <CrewEmblem emblem={raceCrew.emblem} size={44} />
          <div>
            <h3>{raceCrew.name}</h3>
            <p>
              {raceCrew.raceName} · {formatDateLabel(raceCrew.raceDate)} ·{" "}
              {raceCrew.raceDistanceMiles} mi
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
              <li key={member.userId}>
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
            <h4>Invites</h4>
            <Button variant="secondary" icon={<UserPlus size={18} />} isLoading={crew.busy} onClick={() => void crew.createInvite()}>
              Create Private Invite
            </Button>
            {crew.latestInviteUrl && (
              <div className="crew-settings__invite-link">
                <label htmlFor="crew-invite-url">Invite link</label>
                <input id="crew-invite-url" className="run-input" readOnly value={crew.latestInviteUrl} />
                <Button variant="secondary" icon={<Copy size={18} />} onClick={() => void navigator.clipboard.writeText(crew.latestInviteUrl ?? "")}>
                  Copy Link
                </Button>
                <p>Raw invite tokens are shown only here and are not stored in the database.</p>
              </div>
            )}
            {activeInvites.length > 0 && (
              <ul className="crew-settings__invites" aria-label="Active invites">
                {activeInvites.map((invite) => (
                  <li key={invite.id}>
                    <span>Expires {new Date(invite.expiresAt).toLocaleDateString()}</span>
                    <button type="button" onClick={() => void crew.revokeInvite(invite.id)}>Revoke</button>
                  </li>
                ))}
              </ul>
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
                      {raceCrew.raceName} · {formatDateLabel(raceCrew.raceDate)} ·{" "}
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
function AccountProfilePanel({ crew, onBack }: { crew: RaceCrewController; onBack: () => void }) {
  const [displayName, setDisplayName] = useState(
    crew.account?.profile.displayName ?? "",
  );
  // Explicit picks across every crew this account is in — the same union the
  // database enforces, so the picker cannot offer a color it would reject.
  const takenAccents = new Set(crew.account?.takenAccentColors ?? []);
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
        <AccentColorPicker
          current={crew.account?.profile.accentColor ?? null}
          taken={takenAccents}
          busy={crew.busy}
          onPick={(accentColor) => void crew.saveAccentColor(accentColor)}
        />
      </section>
    </>
  );
}

function sheetTitle(view: View): string {
  switch (view) {
    case "profile":
      return "Edit Profile";
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
    default:
      return "Account & Crew";
  }
}

export function AccountCrewSheet({ isOpen, onClose, crew, localRace }: Props) {
  const signedIn = crew.status === "signed-in";
  const [view, setView] = useState<View>("main");
  const [createStartCount, setCreateStartCount] = useState<number | null>(null);
  const raceCrew = crew.account?.crew ?? null;
  const isOwner = crew.account?.role === "owner";
  const crewCount = crew.account?.memberships.length ?? 0;

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
          <AccountProfilePanel crew={crew} onBack={() => setView("main")} />
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
                <ul className="settings__rows">
                  <li>
                    <button
                      type="button"
                      className="settings__row"
                      onClick={() => setView("profile")}
                    >
                      <span className="settings__row-icon" aria-hidden="true">
                        <UserRound size={18} strokeWidth={1.9} />
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
            {crew.projectionError && (
              <p className="crew-settings__note">Crew sharing will retry later. Personal STACK is unaffected.</p>
            )}
          </>
        )}
        {visibleView !== "main" && crew.error && <p role="alert" className="crew-settings__message crew-settings__message--error">{crew.error}</p>}
      </div>
    </Sheet>
  );
}
