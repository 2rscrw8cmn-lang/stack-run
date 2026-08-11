import { ArrowLeft, ArrowRight, Database, Watch } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { FormField } from "../../components/ui/FormField";
import { fetchIntervals } from "../../connected/intervals";

interface Props {
  onConnected: (apiKey: string) => void;
  onCancel?: () => void;
}

interface SetupStep {
  label: string;
  title: string;
  copy: string;
}

const APPLE_STEPS: SetupStep[] = [
  { label: "1 of 4", title: "HealthFit", copy: "HealthFit moves Apple Health workouts from your iPhone to Intervals.icu." },
  { label: "2 of 4", title: "Intervals.icu", copy: "Intervals.icu is the activity-data bridge STACK reads." },
  { label: "3 of 4", title: "Check one run", copy: "Make sure one Apple Watch run is visible in Intervals.icu before connecting STACK." },
  { label: "4 of 4", title: "Connect STACK", copy: "In Intervals.icu Settings, generate a personal API key under Developer Settings and paste it below." },
];

const OTHER_STEPS: SetupStep[] = [
  { label: "1 of 3", title: "Connect Intervals.icu", copy: "Connect Garmin, COROS, or your usual service in Intervals.icu. You do not need HealthFit." },
  { label: "2 of 3", title: "Check one run", copy: "Make sure one recent run is visible in Intervals.icu before connecting STACK." },
  { label: "3 of 3", title: "Connect STACK", copy: "In Intervals.icu Settings, generate a personal API key under Developer Settings and paste it below." },
];

export function RunDataSetup({ onConnected, onCancel }: Props) {
  const [path, setPath] = useState<"apple" | "other" | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const steps = path === "apple" ? APPLE_STEPS : OTHER_STEPS;
  const step = path ? steps[stepIndex] : null;
  const isLast = Boolean(step && stepIndex === steps.length - 1);

  async function connect() {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    setBusy(true);
    setError("");
    try {
      await fetchIntervals("status", { mode: "local-api-key", credential: trimmed });
      onConnected(trimmed);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Connection failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="run-data-setup" aria-labelledby="run-data-setup-title">
      <p className="machine-label">Connect your runs</p>
      <h3 id="run-data-setup-title">{path ? step?.title : "How do you record runs?"}</h3>
      {!path ? (
        <div className="run-data-setup__paths">
          <button type="button" onClick={() => setPath("apple")}>
            <Watch size={21} aria-hidden="true" />
            <span><strong>Apple Watch</strong><small>Uses HealthFit + Intervals.icu</small></span>
          </button>
          <button type="button" onClick={() => setPath("other")}>
            <Watch size={21} aria-hidden="true" />
            <span><strong>Garmin / COROS / Other</strong><small>Connects through Intervals.icu</small></span>
          </button>
        </div>
      ) : (
        <>
          <p className="run-data-setup__step machine-label">{step?.label}</p>
          <p className="run-data-setup__copy">{step?.copy}</p>
          <div className="run-data-setup__chain" aria-label={path === "apple" ? "Apple Watch to Apple Health to HealthFit to Intervals.icu to STACK" : "Watch or training service to Intervals.icu to STACK"}>
            {path === "apple"
              ? "APPLE WATCH → APPLE HEALTH → HEALTHFIT → INTERVALS.ICU → STACK"
              : "WATCH / SERVICE → INTERVALS.ICU → STACK"}
          </div>
          {isLast && (
            <>
              <FormField label="Personal Intervals API key">
                <input className="run-input" type="password" value={apiKey} autoComplete="off" onChange={(event) => setApiKey(event.target.value)} />
              </FormField>
              <p className="run-data-setup__privacy">
                The key stays only on this browser/device, outside your STACK backup. It is never uploaded to Supabase or shown to Race Crew.
              </p>
              <Button disabled={!apiKey.trim()} isLoading={busy} icon={<Database size={18} />} onClick={connect}>Test Connection</Button>
              {error && <p role="alert" className="run-data__message run-data__message--failed">{error}</p>}
            </>
          )}
          <div className="run-data-setup__nav">
            <Button variant="secondary" icon={<ArrowLeft size={18} />} onClick={() => {
              if (stepIndex === 0) setPath(null);
              else setStepIndex((current) => current - 1);
            }}>Back</Button>
            {!isLast && <Button icon={<ArrowRight size={18} />} onClick={() => setStepIndex((current) => current + 1)}>Continue</Button>}
          </div>
        </>
      )}
      {onCancel && <button type="button" className="run-data-setup__cancel" onClick={onCancel}>Keep current connection</button>}
    </section>
  );
}
