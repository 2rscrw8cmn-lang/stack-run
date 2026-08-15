import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { signInToStack } from "../../crew/auth";
import { crewMemberAccent } from "../../crew/memberAccent";
import { loadCrewAccount } from "../../crew/crewService";
import { getSupabaseAvailability } from "../../crew/supabaseClient";
import type { LoadedCrewAccount } from "../../crew/types";
import {
  artworkSlug,
  artworkZip,
  crewArtworkFiles,
  crewEmblemArtwork,
  readArtworkPalette,
  runnerIconArtwork,
  saveArtworkBlob,
  saveArtworkFile,
} from "../../artwork/artworkExport";
import { CrewEmblem } from "../crew/CrewEmblem";
import { RunnerIcon } from "../crew/RunnerIcon";

function backToStack(): void {
  window.location.assign(`${window.location.pathname}${window.location.search}`);
}

export function ArtworkExportPage() {
  const [availability] = useState(getSupabaseAvailability);
  const [status, setStatus] = useState<"loading" | "signed-out" | "ready">("loading");
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<LoadedCrewAccount | null>(null);
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!availability.configured) {
      queueMicrotask(() => setStatus("ready"));
      return;
    }

    let active = true;
    void availability.client.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setError(sessionError.message);
        setStatus("signed-out");
        return;
      }
      const nextUser = data.session?.user ?? null;
      if (!nextUser) {
        setStatus("signed-out");
        return;
      }
      try {
        const loaded = await loadCrewAccount(availability.client, nextUser);
        if (!active) return;
        setUser(nextUser);
        setAccount(loaded);
        setStatus("ready");
      } catch (reason) {
        if (!active) return;
        setUser(nextUser);
        setError(reason instanceof Error ? reason.message : "Crew artwork could not be loaded.");
        setStatus("ready");
      }
    });

    return () => {
      active = false;
    };
  }, [availability]);

  async function signIn(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!availability.configured) return;
    setBusy(true);
    setError(null);
    try {
      const nextUser = await signInToStack(availability.client, { email, pin });
      const loaded = await loadCrewAccount(availability.client, nextUser);
      setUser(nextUser);
      setAccount(loaded);
      setPin("");
      setStatus("ready");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "STACK could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function switchCrew(crewId: string): Promise<void> {
    if (!availability.configured || !user) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      setAccount(await loadCrewAccount(availability.client, user, crewId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That Crew could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  async function saveOne(label: string, action: () => Promise<"shared" | "downloaded" | "cancelled">): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await action();
      if (result !== "cancelled") {
        setMessage(result === "shared" ? `${label} sent to the iPhone share sheet.` : `${label} downloaded.`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `${label} could not be saved.`);
    } finally {
      setBusy(false);
    }
  }

  if (!availability.configured) {
    return (
      <main className="artwork-export">
        <header className="artwork-export__header">
          <div>
            <p className="artwork-export__eyebrow">STACK / PRIVATE UTILITY</p>
            <h1>Artwork Export</h1>
          </div>
          <button className="artwork-export__back" type="button" onClick={backToStack}>Back to STACK</button>
        </header>
        <section className="artwork-export__panel">
          <h2>Artwork export is unavailable</h2>
          <p>{availability.reason}</p>
        </section>
      </main>
    );
  }

  if (status === "loading") {
    return (
      <main className="artwork-export artwork-export--loading" aria-live="polite">
        <p>Loading artwork…</p>
      </main>
    );
  }

  if (status === "signed-out") {
    return (
      <main className="artwork-export">
        <header className="artwork-export__header">
          <div>
            <p className="artwork-export__eyebrow">STACK / PRIVATE UTILITY</p>
            <h1>Artwork Export</h1>
          </div>
          <button className="artwork-export__back" type="button" onClick={backToStack}>Back to STACK</button>
        </header>
        <section className="artwork-export__panel">
          <h2>Sign in</h2>
          <p>Use your normal STACK account. The session is the same one the app uses.</p>
          <form className="artwork-export__signin" onSubmit={(event) => void signIn(event)}>
            <label>
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              <span>8-digit STACK PIN</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                pattern="[0-9]{8}"
                maxLength={8}
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
                required
              />
            </label>
            {error && <p className="artwork-export__error" role="alert">{error}</p>}
            <button className="button button--primary" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  const crew = account?.crew ?? null;
  const members = account?.members ?? [];

  return (
    <main className="artwork-export">
      <header className="artwork-export__header">
        <div>
          <p className="artwork-export__eyebrow">STACK / PRIVATE UTILITY</p>
          <h1>Artwork Export</h1>
        </div>
        <button className="artwork-export__back" type="button" onClick={backToStack}>Back to STACK</button>
      </header>

      {error && <p className="artwork-export__error" role="alert">{error}</p>}
      {message && <p className="artwork-export__message" aria-live="polite">{message}</p>}

      {!crew ? (
        <section className="artwork-export__panel">
          <h2>No Crew artwork yet</h2>
          <p>This account does not currently belong to a Crew.</p>
        </section>
      ) : (
        <>
          <section className="artwork-export__panel artwork-export__intro">
            <div>
              <p className="artwork-export__label">Crew</p>
              {account && account.memberships.length > 1 ? (
                <select
                  className="artwork-export__crew-select"
                  value={crew.id}
                  disabled={busy}
                  aria-label="Crew to export"
                  onChange={(event) => void switchCrew(event.target.value)}
                >
                  {account.memberships.map((membership) => (
                    <option key={membership.crew.id} value={membership.crew.id}>
                      {membership.crew.name}
                    </option>
                  ))}
                </select>
              ) : (
                <h2>{crew.name}</h2>
              )}
            </div>
            <button
              className="button button--primary artwork-export__pack"
              type="button"
              disabled={busy}
              onClick={() => void saveOne("Crew pack", async () => {
                const files = crewArtworkFiles(crew, members, readArtworkPalette());
                const zip = artworkZip(files);
                return saveArtworkBlob(zip, `${artworkSlug(crew.name)}-artwork.zip`);
              })}
            >
              Export Crew Pack
            </button>
            <p className="artwork-export__hint">On iPhone, Save SVG and Export Crew Pack open the Share sheet. Choose <strong>Save to Files</strong>, AirDrop, Messages, Mail, or your vendor app.</p>
          </section>

          <section className="artwork-export__section" aria-labelledby="crew-emblem-heading">
            <div className="artwork-export__section-heading">
              <div>
                <p className="artwork-export__label">Crew mark</p>
                <h2 id="crew-emblem-heading">Emblem</h2>
              </div>
            </div>
            <article className="artwork-export__asset">
              <div className="artwork-export__preview artwork-export__preview--emblem">
                <CrewEmblem emblem={crew.emblem} size={108} label={`${crew.name} emblem`} />
              </div>
              <div className="artwork-export__asset-copy">
                <strong>{crew.name}</strong>
                <span>SVG master · transparent outside the mark</span>
              </div>
              <button
                className="button button--secondary artwork-export__save"
                type="button"
                disabled={busy}
                onClick={() => void saveOne("Crew emblem", () => saveArtworkFile(crewEmblemArtwork(crew)))}
              >
                Save SVG
              </button>
            </article>
          </section>

          <section className="artwork-export__section" aria-labelledby="runner-icons-heading">
            <div className="artwork-export__section-heading">
              <div>
                <p className="artwork-export__label">People</p>
                <h2 id="runner-icons-heading">Runner Icons</h2>
              </div>
              <span>{members.length}</span>
            </div>
            <div className="artwork-export__assets">
              {members.map((member) => {
                const accent = crewMemberAccent(member.userId, member.accentColor);
                return (
                  <article className="artwork-export__asset" key={member.userId}>
                    <div className="artwork-export__preview artwork-export__preview--runner">
                      <RunnerIcon
                        icon={member.runnerIcon}
                        accent={accent}
                        size={76}
                        label={`${member.displayName} runner icon`}
                      />
                    </div>
                    <div className="artwork-export__asset-copy">
                      <strong>{member.displayName}</strong>
                      <span>SVG master · current STACK color</span>
                    </div>
                    <button
                      className="button button--secondary artwork-export__save"
                      type="button"
                      disabled={busy}
                      onClick={() => void saveOne(`${member.displayName} icon`, () =>
                        saveArtworkFile(runnerIconArtwork(member, readArtworkPalette())),
                      )}
                    >
                      Save SVG
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
