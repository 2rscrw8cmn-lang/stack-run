import {
  Copy,
  LogIn,
  LogOut,
  Pencil,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { FormField } from "../../components/ui/FormField";
import { Sheet } from "../../components/ui/Sheet";
import { formatDateLabel } from "../../domain/dates";
import type { Race } from "../../domain/types";
import { validateCrewDetails } from "../../crew/crewService";
import { compareCrewRace } from "../../crew/raceMatch";
import type { RaceCrew } from "../../crew/types";
import type { RaceCrewController } from "../../crew/useRaceCrew";

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
      <h3>{pending.preview.crewName}</h3>
      <p>
        {pending.preview.raceName} · {formatDateLabel(pending.preview.raceDate)} ·{" "}
        {pending.preview.raceDistanceMiles} mi
      </p>
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
      {crew.status === "signed-in" ? (
        <Button isLoading={crew.busy} onClick={() => void crew.joinPendingInvite()}>
          {mismatch.mismatched ? "Join Anyway" : "Join Crew"}
        </Button>
      ) : (
        <p className="crew-settings__note">Create an account or sign in to join.</p>
      )}
    </section>
  );
}

function CreateCrewPanel({ crew, localRace }: Pick<Props, "crew" | "localRace">) {
  const [name, setName] = useState("");
  const [raceName, setRaceName] = useState(localRace?.name ?? "");
  const [raceDate, setRaceDate] = useState(localRace?.date ?? "");
  const [distance, setDistance] = useState(
    localRace ? String(localRace.distanceMiles) : "",
  );
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
      <Button icon={<Users size={18} />} isLoading={crew.busy} onClick={() => void crew.createCrew({
        name,
        raceName,
        raceDate,
        raceDistanceMiles: Number(distance),
      })}>
        Create Race Crew
      </Button>
    </section>
  );
}

function EditCrewPanel({
  crew,
  raceCrew,
  onCancel,
  onSaved,
}: {
  crew: RaceCrewController;
  raceCrew: RaceCrew;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(raceCrew.name);
  const [raceName, setRaceName] = useState(raceCrew.raceName);
  const [raceDate, setRaceDate] = useState(raceCrew.raceDate);
  const [distance, setDistance] = useState(String(raceCrew.raceDistanceMiles));
  const [validationError, setValidationError] = useState<string | null>(null);

  async function save(): Promise<void> {
    try {
      const input = validateCrewDetails({
        name,
        raceName,
        raceDate,
        raceDistanceMiles: Number(distance),
      });
      setValidationError(null);
      if (await crew.updateCrew(input)) onSaved();
    } catch (reason) {
      setValidationError(reason instanceof Error ? reason.message : "Check the Crew details.");
    }
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
      {validationError && <p role="alert" className="crew-settings__message crew-settings__message--error">{validationError}</p>}
      <div className="crew-settings__form-actions">
        <Button isLoading={crew.busy} onClick={() => void save()}>Save Changes</Button>
        <Button variant="secondary" disabled={crew.busy} onClick={onCancel}>Cancel</Button>
      </div>
    </section>
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
      <p className="machine-label">Your Race Crew</p>
      <h3>{raceCrew.name}</h3>
      <p>
        {raceCrew.raceName} · {formatDateLabel(raceCrew.raceDate)} ·{" "}
        {raceCrew.raceDistanceMiles} mi
      </p>

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

function AccountProfilePanel({ crew }: { crew: RaceCrewController }) {
  const [displayName, setDisplayName] = useState(
    crew.account?.profile.displayName ?? "",
  );
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
    </section>
  );
}

export function AccountCrewSheet({ isOpen, onClose, crew, localRace }: Props) {
  const signedIn = crew.status === "signed-in";
  const [view, setView] = useState<"main" | "edit" | "delete">("main");
  const raceCrew = crew.account?.crew ?? null;
  const visibleView = crew.account?.role === "owner" && raceCrew ? view : "main";

  return (
    <Sheet
      title={visibleView === "edit" ? "Edit Crew" : visibleView === "delete" ? "Delete Crew" : "Account & Crew"}
      isOpen={isOpen}
      onClose={() => {
        setView("main");
        onClose();
      }}
      className="crew-settings-sheet"
    >
      <div className="crew-settings">
        {visibleView === "edit" && raceCrew && (
          <EditCrewPanel
            crew={crew}
            raceCrew={raceCrew}
            onCancel={() => setView("main")}
            onSaved={() => setView("main")}
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
            {crew.account?.crew ? (
              <CrewPanel
                crew={crew}
                onEdit={() => setView("edit")}
                onDelete={() => setView("delete")}
              />
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
