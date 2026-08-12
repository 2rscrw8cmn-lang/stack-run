import {
  Copy,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
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

function CrewPanel({
  crew,
  onEdit,
  onDelete,
}: {
  crew: RaceCrewController;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const account = crew.account;
  const raceCrew = account?.crew;
  if (!account || !raceCrew || !account.role) return null;
  const activeInvites = account.invites.filter(
    (invite) => !invite.revokedAt && !invite.redeemedAt,
  );
  return (
    <section className="crew-settings__section">
      <p className="machine-label">
        {account.memberships.length > 1 ? "Crew you are viewing" : "Your Race Crew"}
      </p>
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

      {account.role === "owner" && (
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
      )}

      {account.role === "member" && (
        <Button variant="danger" onClick={() => void crew.leaveCrew()}>
          Leave Crew
        </Button>
      )}
    </section>
  );
}

/**
 * Every crew this account is in, and which one the app is showing.
 *
 * Crews are peers, not a hierarchy: a runner can be training for a spring
 * marathon with one set of friends and a summer trail race with another, and
 * switching between them is a view change on this device only. It never
 * touches membership, the shared Builds, or anything personal.
 */
function CrewListPanel({ crew }: { crew: RaceCrewController }) {
  const account = crew.account;
  const memberships = account?.memberships ?? [];
  if (!account || memberships.length < 2) return null;
  return (
    <section className="crew-settings__section">
      <p className="machine-label">Your crews</p>
      <ul className="crew-settings__crew-list" aria-label="Your crews">
        {memberships.map(({ crew: raceCrew, role }) => {
          const isActive = raceCrew.id === account.crew?.id;
          return (
            <li key={raceCrew.id}>
              <button
                type="button"
                className="crew-settings__crew-option"
                aria-pressed={isActive}
                disabled={crew.busy}
                onClick={() => void crew.switchCrew(raceCrew.id)}
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

function AccountProfilePanel({ crew }: { crew: RaceCrewController }) {
  const [displayName, setDisplayName] = useState(
    crew.account?.profile.displayName ?? "",
  );
  // Explicit picks across every crew this account is in — the same union the
  // database enforces, so the picker cannot offer a color it would reject.
  const takenAccents = new Set(crew.account?.takenAccentColors ?? []);
  return (
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
  );
}

export function AccountCrewSheet({ isOpen, onClose, crew, localRace }: Props) {
  const signedIn = crew.status === "signed-in";
  const [view, setView] = useState<"main" | "edit" | "emblem" | "delete">("main");
  const [creatingSince, setCreatingSince] = useState<number | null>(null);
  const raceCrew = crew.account?.crew ?? null;
  const visibleView = crew.account?.role === "owner" && raceCrew ? view : "main";
  const crewCount = crew.account?.memberships.length ?? 0;
  // The create form stays open until it has actually produced a crew, which
  // this sheet recognizes as a changed membership count. Derived rather than
  // remembered, so a successful create closes it without an effect.
  const creatingAnother = creatingSince !== null && creatingSince === crewCount;

  return (
    <Sheet
      title={visibleView === "emblem" ? "Edit Emblem" : visibleView === "edit" ? "Edit Crew" : visibleView === "delete" ? "Delete Crew" : "Account & Crew"}
      isOpen={isOpen}
      onClose={() => {
        setView("main");
        onClose();
      }}
      className="crew-settings-sheet"
    >
      <div className="crew-settings">
        {(visibleView === "edit" || visibleView === "emblem") && raceCrew && (
          <EditCrewPanel
            crew={crew}
            raceCrew={raceCrew}
            onCancel={() => setView("main")}
            onSaved={() => setView("main")}
            emblemEditorOpen={visibleView === "emblem"}
            onEditEmblem={() => setView("emblem")}
            onCloseEmblemEditor={() => setView("edit")}
          />
        )}

        {visibleView === "delete" && raceCrew && (
          <DeleteCrewPanel
            crew={crew}
            raceCrew={raceCrew}
            onCancel={() => setView("main")}
            onDeleted={() => setView("main")}
          />
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
            <AccountProfilePanel crew={crew} />
            <PendingInvitePanel crew={crew} localRace={localRace} />
            <CrewListPanel crew={crew} />
            {crew.account?.crew ? (
              <>
                <CrewPanel
                  crew={crew}
                  onEdit={() => setView("edit")}
                  onDelete={() => setView("delete")}
                />
                {/* Another crew is another race with another set of friends,
                    so it is an addition here, never a replacement. */}
                {creatingAnother ? (
                  <CreateCrewPanel
                    crew={crew}
                    localRace={localRace}
                    onCancel={() => setCreatingSince(null)}
                  />
                ) : (
                  <section className="crew-settings__section">
                    <Button
                      variant="secondary"
                      icon={<Plus size={18} />}
                      onClick={() => setCreatingSince(crewCount)}
                    >
                      Create Another Crew
                    </Button>
                    <p className="crew-settings__note">
                      You are in {crewCount} {crewCount === 1 ? "crew" : "crews"}. Join
                      another any time with a private invite link.
                    </p>
                  </section>
                )}
              </>
            ) : !crew.pendingInvite ? (
              <CreateCrewPanel crew={crew} localRace={localRace} />
            ) : null}
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
