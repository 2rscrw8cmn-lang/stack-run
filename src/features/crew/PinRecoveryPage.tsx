import { useEffect, useState } from "react";
import { KeyRound, Mail } from "lucide-react";
import { Button } from "../../components/ui/Button.js";
import { FormField } from "../../components/ui/FormField.js";
import { StackMark } from "../../components/shared/StackMark.js";
import { getSupabaseAvailability } from "../../crew/supabaseClient.js";
import { requestStackPinReset, updateStackPin } from "../../crew/pinRecovery.js";
import { STACK_PIN_FORGOT_PATH, STACK_PIN_RESET_PATH } from "../../crew/authRoutes.js";

type RecoveryMode = "request" | "reset";

function modeFromPath(): RecoveryMode {
  return window.location.pathname.replace(/\/+$/, "") === STACK_PIN_RESET_PATH
    ? "reset"
    : "request";
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "STACK could not complete that request.";
}

export function PinRecoveryPage() {
  const [availability] = useState(getSupabaseAvailability);
  const [mode] = useState<RecoveryMode>(modeFromPath);
  const [email, setEmail] = useState(() =>
    new URLSearchParams(window.location.search).get("email") ?? "",
  );
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [recoveryReady, setRecoveryReady] = useState(mode === "request");
  const [recoveryChecked, setRecoveryChecked] = useState(mode === "request");

  useEffect(() => {
    if (mode !== "reset" || !availability.configured) return;
    let alive = true;
    const client = availability.client;

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (event === "PASSWORD_RECOVERY" && session) {
        setRecoveryReady(true);
        setRecoveryChecked(true);
      }
    });

    void client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!alive) return;
      if (sessionError) {
        setError(sessionError.message);
        setRecoveryChecked(true);
        return;
      }
      setRecoveryReady(Boolean(data.session));
      setRecoveryChecked(true);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [availability, mode]);

  if (!availability.configured) {
    return (
      <main className="crew-invite-landing">
        <section className="crew-invite-landing__card">
          <div className="crew-invite-landing__brand"><StackMark size={30} /><span>STACK</span></div>
          <h1>PIN recovery unavailable</h1>
          <p>{availability.reason}</p>
          <Button onClick={() => { window.location.href = "/"; }}>Back to STACK</Button>
        </section>
      </main>
    );
  }

  if (mode === "reset" && !recoveryChecked) {
    return (
      <main className="crew-invite-landing" aria-live="polite">
        <section className="crew-invite-landing__card">
          <div className="crew-invite-landing__brand"><StackMark size={30} /><span>STACK</span></div>
          <p>Opening your secure PIN reset…</p>
        </section>
      </main>
    );
  }

  return (
    <main className="crew-invite-landing">
      <section className="crew-invite-landing__card">
        <div className="crew-invite-landing__brand"><StackMark size={30} /><span>STACK</span></div>
        <p className="machine-label">STACK account</p>
        <h1>{mode === "request" ? "Forgot your PIN?" : "Choose a new PIN"}</h1>

        {mode === "request" ? (
          <>
            <p>Enter the email on your STACK account. We’ll send you a secure reset link.</p>
            <FormField label="Email">
              <input
                className="run-input"
                type="email"
                value={email}
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
              />
            </FormField>
            <Button
              isLoading={busy}
              icon={<Mail size={18} />}
              onClick={() => {
                setBusy(true);
                setError(null);
                setMessage(null);
                void requestStackPinReset(availability.client, email)
                  .then(() => setMessage("Reset link sent. Check your email, then open the link to choose a new PIN."))
                  .catch((reason) => setError(messageOf(reason)))
                  .finally(() => setBusy(false));
              }}
            >
              Send Reset Link
            </Button>
          </>
        ) : recoveryReady ? (
          <>
            <p>Your new STACK PIN must be exactly 8 numbers.</p>
            <FormField label="New 8-digit STACK PIN">
              <input
                className="run-input"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{8}"
                minLength={8}
                maxLength={8}
                autoComplete="new-password"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
              />
            </FormField>
            <FormField label="Confirm new PIN">
              <input
                className="run-input"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{8}"
                minLength={8}
                maxLength={8}
                autoComplete="new-password"
                value={confirmPin}
                onChange={(event) => setConfirmPin(event.target.value)}
              />
            </FormField>
            <Button
              isLoading={busy}
              icon={<KeyRound size={18} />}
              onClick={() => {
                setError(null);
                setMessage(null);
                if (pin !== confirmPin) {
                  setError("PINs do not match.");
                  return;
                }
                setBusy(true);
                void updateStackPin(availability.client, pin)
                  .then(() => {
                    window.history.replaceState(null, "", STACK_PIN_RESET_PATH);
                    setMessage("PIN updated. You can return to STACK now.");
                    setPin("");
                    setConfirmPin("");
                  })
                  .catch((reason) => setError(messageOf(reason)))
                  .finally(() => setBusy(false));
              }}
            >
              Save New PIN
            </Button>
          </>
        ) : (
          <>
            <p role="alert">This reset link is invalid or expired.</p>
            <Button onClick={() => { window.location.href = STACK_PIN_FORGOT_PATH; }}>
              Send a New Reset Link
            </Button>
          </>
        )}

        {error && (
          <p className="crew-settings__message crew-settings__message--error" role="alert">{error}</p>
        )}
        {message && (
          <p className="crew-settings__message" role="status">{message}</p>
        )}
        <Button variant="secondary" onClick={() => { window.location.href = "/"; }}>
          Back to STACK
        </Button>
      </section>
    </main>
  );
}
