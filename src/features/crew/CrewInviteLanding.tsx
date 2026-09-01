import { useState } from "react";
import { LogIn, UserPlus } from "lucide-react";
import type { Race } from "../../domain/types.js";
import { formatDateLabel } from "../../domain/dates.js";
import { compareCrewRace } from "../../crew/raceMatch.js";
import type { RaceCrewController } from "../../crew/useRaceCrew.js";
import { Button } from "../../components/ui/Button.js";
import { FormField } from "../../components/ui/FormField.js";
import { StackMark } from "../../components/shared/StackMark.js";
import { CrewEmblem } from "./CrewEmblem.js";

interface Props {
  crew: RaceCrewController;
  localRace: Race | null;
  onOpenCrew: () => void;
}

/** The first screen a private link opens — no Settings discovery required. */
export function CrewInviteLanding({ crew, localRace, onOpenCrew }: Props) {
  const [mode, setMode] = useState<"sign-in" | "create">("create");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const pending = crew.pendingInvite;
  if (!pending) return null;
  if (pending.error) {
    return <main className="crew-invite-landing"><p role="alert">This invite is invalid, expired, or has been reset.</p></main>;
  }
  if (!pending.preview) {
    return <main className="crew-invite-landing" aria-live="polite"><p>Checking your private Crew invite…</p></main>;
  }
  const preview = pending.preview;
  const isClub = preview.crewType === "club";
  const mismatch = compareCrewRace({
    raceName: preview.raceName,
    raceDate: preview.raceDate,
    raceDistanceMiles: preview.raceDistanceMiles,
  }, localRace);
  const signedIn = crew.status === "signed-in";
  return (
    <main className="crew-invite-landing">
      <section className="crew-invite-landing__card">
        <div className="crew-invite-landing__brand"><StackMark size={30} /><span>STACK</span></div>
        <p className="machine-label">Private {isClub ? "Run Club" : "Race Crew"} invite</p>
        <div className="crew-invite-landing__identity">
          <CrewEmblem emblem={preview.emblem} size={116} label={`${preview.crewName} emblem`} />
          <div>
            <h1>{preview.crewName}</h1>
            <p>{isClub ? "Run Club" : `${preview.raceName} · ${formatDateLabel(preview.raceDate!)} · ${preview.raceDistanceMiles} mi`}</p>
          </div>
        </div>
        {mismatch.mismatched && localRace && (
          <div className="crew-invite-landing__warning" role="status">
            <strong>Your current race is different.</strong>
            <p>Joining will not change your plan: {localRace.name} · {formatDateLabel(localRace.date)} · {localRace.distanceMiles} mi.</p>
          </div>
        )}
        {signedIn && preview.alreadyMember ? (
          <>
            <p className="crew-invite-landing__status">You’re already in this Crew.</p>
            <Button onClick={onOpenCrew}>Open Crew</Button>
          </>
        ) : signedIn ? (
          <Button isLoading={crew.busy} onClick={() => void crew.joinPendingInvite()}>
            {mismatch.mismatched ? "Join Anyway" : "Join Crew"}
          </Button>
        ) : (
          <div className="crew-invite-landing__auth">
            <div className="crew-settings__switch" aria-label="Account action">
              <button type="button" aria-pressed={mode === "create"} onClick={() => setMode("create")}>Create Account</button>
              <button type="button" aria-pressed={mode === "sign-in"} onClick={() => setMode("sign-in")}>Sign In</button>
            </div>
            {mode === "create" && <FormField label="Display name"><input className="run-input" value={displayName} autoComplete="name" maxLength={60} onChange={(event) => setDisplayName(event.target.value)} /></FormField>}
            <FormField label="Email"><input className="run-input" type="email" value={email} autoComplete="email" onChange={(event) => setEmail(event.target.value)} /></FormField>
            <FormField label="8-digit STACK PIN"><input className="run-input" type="password" inputMode="numeric" pattern="[0-9]{8}" minLength={8} maxLength={8} autoComplete={mode === "create" ? "new-password" : "current-password"} value={pin} onChange={(event) => setPin(event.target.value)} /></FormField>
            <Button isLoading={crew.busy} icon={mode === "create" ? <UserPlus size={18} /> : <LogIn size={18} />} onClick={() => void (mode === "create" ? crew.createAccount({ displayName, email, pin }) : crew.signIn({ email, pin }))}>
              {mode === "create" ? "Create Account to Join" : "Sign In to Join"}
            </Button>
          </div>
        )}
        {crew.error && <p className="crew-settings__message crew-settings__message--error" role="alert">{crew.error}</p>}
      </section>
    </main>
  );
}
