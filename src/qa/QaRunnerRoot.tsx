import { useEffect, useState } from "react";
import { App } from "../app/App.js";
import { getSupabaseAvailability } from "../crew/supabaseClient.js";
import { QaRunnerApp } from "./QaRunnerApp.js";
import { isQaPreviewHost, isQaRunnerEmail } from "./qaRunner.js";

/**
 * Chooses the full-app synthetic QA harness from the authenticated account.
 *
 * Production/custom hosts never enter QA mode, even if the same synthetic
 * account happens to be signed in there. On branch previews and localhost the
 * normal STACK account screen remains the sign-in surface; as soon as Supabase
 * reports the QA email, the entire application swaps to one deterministic
 * synthetic runner instead of relying on page-specific query-string demos.
 */
export function QaRunnerRoot() {
  const preview = isQaPreviewHost();
  /**
   * Availability is process-stable, and reading it once lets the initial state
   * describe every synchronous case. The effect below then owns only the
   * asynchronous auth subscription, so it never needs a synchronous setState.
   */
  const [availability] = useState(getSupabaseAvailability);
  const [email, setEmail] = useState<string | null | undefined>(() =>
    preview && availability.configured ? undefined : null,
  );

  useEffect(() => {
    if (!preview || !availability.configured) return;

    let alive = true;
    void availability.client.auth.getSession().then(({ data }) => {
      if (alive) setEmail(data.session?.user.email ?? null);
    });

    const {
      data: { subscription },
    } = availability.client.auth.onAuthStateChange((_event, session) => {
      if (alive) setEmail(session?.user.email ?? null);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [availability, preview]);

  if (preview && email === undefined) {
    return (
      <main className="app-loading" aria-live="polite">
        <p>Loading your STACK…</p>
      </main>
    );
  }

  return preview && isQaRunnerEmail(email) ? <QaRunnerApp /> : <App />;
}
