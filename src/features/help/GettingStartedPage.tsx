import {
  Activity,
  ArrowRight,
  Blocks,
  CalendarDays,
  Check,
  CircleHelp,
  Footprints,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UsersRound,
  Watch,
} from "lucide-react";
import type { ReactNode } from "react";
import { StackMark } from "../../components/shared/StackMark";
import "./getting-started.css";
import settingsRunData from "./screens/settings-run-data.webp";
import pathChooser from "./screens/path-chooser.webp";
import appleStep1Healthfit from "./screens/apple-step1-healthfit.webp";
import appleStep2Intervals from "./screens/apple-step2-intervals.webp";
import appleStep3CheckRun from "./screens/apple-step3-check-run.webp";
import appleStep4Connect from "./screens/apple-step4-connect.webp";
import otherStep1Connect from "./screens/other-step1-connect.webp";
import otherStep2CheckRun from "./screens/other-step2-check-run.webp";
import otherStep3Connect from "./screens/other-step3-connect.webp";
import settingsConnected from "./screens/settings-connected.webp";
import invalidKey from "./screens/invalid-key.webp";

function Screenshot({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="getting-started__shot">
      <img src={src} alt={alt} loading="lazy" width={559} height={1213} />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function DataChain({ apple }: { apple: boolean }) {
  const labels = apple
    ? ["Apple Watch", "Apple Health", "HealthFit", "Intervals.icu", "STACK"]
    : ["Watch / service", "Intervals.icu", "STACK"];

  return (
    <div className="getting-started__chain" aria-label={labels.join(" to ")}>
      {labels.map((label, index) => (
        <span key={label} className="getting-started__chain-step">
          <span>{label}</span>
          {index < labels.length - 1 && <ArrowRight size={14} aria-hidden="true" />}
        </span>
      ))}
    </div>
  );
}

function ChecklistItem({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <li className="getting-started__check-item">
      <span className="getting-started__check-number" aria-hidden="true">{number}</span>
      <span>
        <strong>{title}</strong>
        <span>{children}</span>
      </span>
    </li>
  );
}

function AppDestination({ icon, name, question, children }: { icon: ReactNode; name: string; question: string; children: ReactNode }) {
  return (
    <li className="getting-started__destination">
      <span className="getting-started__destination-icon" aria-hidden="true">{icon}</span>
      <span>
        <strong>{name}</strong>
        <span className="getting-started__destination-question">{question}</span>
        <span>{children}</span>
      </span>
    </li>
  );
}

export function GettingStartedPage() {
  return (
    <div className="getting-started">
      <header className="getting-started__topbar">
        <a className="getting-started__brand" href="/" aria-label="Open STACK">
          <StackMark size={23} />
          <span>STACK</span>
        </a>
        <a className="getting-started__open-app" href="/">Open app</a>
      </header>

      <main>
        <section className="getting-started__hero">
          <p className="machine-label">Getting started</p>
          <h1>Connect your runs.<br />Build your race.</h1>
          <p className="getting-started__lede">
            This guide gets STACK ready on your phone, connects your fitness data,
            and shows you what to do after your first run arrives.
          </p>
          <div className="getting-started__hero-flow" aria-label="STACK workflow">
            <span>RUN</span><ArrowRight size={16} aria-hidden="true" />
            <span>SYNC</span><ArrowRight size={16} aria-hidden="true" />
            <span>REVIEW</span><ArrowRight size={16} aria-hidden="true" />
            <span>BUILD</span>
          </div>
          <a className="getting-started__primary-link" href="#fitness-data">
            Set up fitness data <ArrowRight size={17} aria-hidden="true" />
          </a>
        </section>

        <section className="getting-started__quick" aria-labelledby="quick-title">
          <div className="getting-started__section-heading">
            <p className="machine-label">Start here</p>
            <h2 id="quick-title">Your setup checklist</h2>
          </div>
          <ol className="getting-started__checklist">
            <ChecklistItem number="01" title="Open your Crew invite">
              Create a STACK account or sign in, then join the Crew.
            </ChecklistItem>
            <ChecklistItem number="02" title="Connect your watch data">
              Apple Watch uses HealthFit + Intervals.icu. Garmin, COROS and other supported services connect through Intervals.icu.
            </ChecklistItem>
            <ChecklistItem number="03" title="Test the connection">
              Make sure a real run reaches Intervals.icu, then connect your personal API key in STACK.
            </ChecklistItem>
            <ChecklistItem number="04" title="Sync and review a run">
              Confirm the plan match or add it as an extra run.
            </ChecklistItem>
            <ChecklistItem number="05" title="Place your block">
              Every completed run earns a block for your Personal Build.
            </ChecklistItem>
          </ol>
        </section>

        <section id="account" className="getting-started__section" aria-labelledby="account-title">
          <div className="getting-started__section-heading">
            <p className="machine-label">Step 1</p>
            <h2 id="account-title">Join STACK and your Crew</h2>
          </div>
          <div className="getting-started__panel getting-started__panel--split">
            <div>
              <span className="getting-started__panel-icon"><UsersRound size={22} /></span>
              <h3>Open the invitation link</h3>
              <p>
                The Crew invite is the easiest place to start. If you do not have a STACK account yet,
                choose <strong>Create Account</strong>. If you already have one, choose <strong>Sign In</strong>.
              </p>
            </div>
            <div>
              <span className="getting-started__panel-icon"><KeyRound size={22} /></span>
              <h3>Your STACK sign-in</h3>
              <p>
                Use your display name, email address and an <strong>8-digit STACK PIN</strong>.
                After signing in, finish the invitation by joining the Crew.
              </p>
            </div>
          </div>
          <p className="getting-started__note">
            Joining a Crew does not replace your personal training plan. Your Plan, Runs and Personal Build remain yours.
          </p>
        </section>

        <section id="fitness-data" className="getting-started__section getting-started__section--focus" aria-labelledby="fitness-title">
          <div className="getting-started__section-heading">
            <p className="machine-label">Step 2 · Most important</p>
            <h2 id="fitness-title">Connect your fitness data</h2>
            <p>
              STACK reads completed runs from Intervals.icu. The only question is how your watch gets the run there.
            </p>
          </div>

          <div className="getting-started__path-grid">
            <a href="#apple-watch" className="getting-started__path-card">
              <Watch size={28} aria-hidden="true" />
              <span>
                <strong>Apple Watch</strong>
                <small>Apple Health → HealthFit → Intervals.icu</small>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a href="#other-watch" className="getting-started__path-card">
              <Activity size={28} aria-hidden="true" />
              <span>
                <strong>Garmin / COROS / Other</strong>
                <small>Your service → Intervals.icu</small>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </a>
          </div>

          <div className="getting-started__shot-row">
            <Screenshot
              src={settingsRunData}
              alt="STACK Settings screen with Intervals.icu listed under Run Data, showing Not connected"
              caption="Settings gear → Intervals.icu"
            />
            <Screenshot
              src={pathChooser}
              alt="STACK screen asking How do you record runs, with Apple Watch and Garmin / COROS / Other buttons"
              caption="This is the exact question STACK asks"
            />
          </div>
        </section>

        <section id="apple-watch" className="getting-started__section" aria-labelledby="apple-title">
          <div className="getting-started__section-heading">
            <p className="machine-label">Apple Watch</p>
            <h2 id="apple-title">Apple Watch setup</h2>
            <p>HealthFit is the bridge that moves Apple Health workouts to Intervals.icu.</p>
          </div>
          <DataChain apple />

          <ol className="getting-started__steps">
            <li>
              <span className="getting-started__step-number">1</span>
              <div>
                <h3>Install HealthFit</h3>
                <p>On your iPhone, install <strong>HealthFit</strong> and allow it to read the Apple Health workout and fitness data it requests. You do not need a separate HealthFit account.</p>
                <Screenshot
                  src={appleStep1Healthfit}
                  alt="STACK wizard step 1 of 4, titled HealthFit, explaining that HealthFit moves Apple Health workouts to Intervals.icu"
                  caption="STACK · 1 of 4"
                />
              </div>
            </li>
            <li>
              <span className="getting-started__step-number">2</span>
              <div>
                <h3>Create or sign in to Intervals.icu</h3>
                <p>Intervals.icu is the data bridge STACK reads. You do not need to make it your training app; it simply needs to receive your runs.</p>
                <a className="getting-started__text-link" href="https://intervals.icu" target="_blank" rel="noreferrer">Open Intervals.icu</a>
                <Screenshot
                  src={appleStep2Intervals}
                  alt="STACK wizard step 2 of 4, titled Intervals.icu, explaining that Intervals.icu is the activity-data bridge STACK reads"
                  caption="STACK · 2 of 4"
                />
              </div>
            </li>
            <li>
              <span className="getting-started__step-number">3</span>
              <div>
                <h3>Connect HealthFit to Intervals.icu</h3>
                <p>In HealthFit, open its workout-sharing or external-services area, choose <strong>Intervals.icu</strong>, authorize the connection and enable automatic workout syncing.</p>
              </div>
            </li>
            <li className="getting-started__step-check">
              <span className="getting-started__step-number"><Check size={18} /></span>
              <div>
                <h3>Checkpoint: see one run in Intervals.icu</h3>
                <p><strong>Do not continue until at least one Apple Watch run is visible in Intervals.icu.</strong> If the run is not there, STACK cannot see it yet.</p>
                <Screenshot
                  src={appleStep3CheckRun}
                  alt="STACK wizard step 3 of 4, titled Check one run, asking you to make sure one Apple Watch run is visible in Intervals.icu"
                  caption="STACK · 3 of 4"
                />
              </div>
            </li>
            <li>
              <span className="getting-started__step-number">4</span>
              <div>
                <h3>Copy your personal Intervals API key</h3>
                <p>In Intervals.icu, open <strong>Settings</strong>, scroll to <strong>Developer Settings</strong>, then generate or copy your personal API key.</p>
                <div className="getting-started__security-callout">
                  <LockKeyhole size={20} aria-hidden="true" />
                  <p><strong>Keep the API key private.</strong> Treat it like a password. Do not text it to another runner or send it to the Crew owner.</p>
                </div>
              </div>
            </li>
            <li>
              <span className="getting-started__step-number">5</span>
              <div>
                <h3>Connect STACK</h3>
                <p>In STACK, open <strong>Settings gear → Run Data → Apple Watch</strong>. Continue through the setup, paste your API key and tap <strong>Test Connection</strong>.</p>
                <p>Once connected, tap <strong>Sync Now</strong>.</p>
                <Screenshot
                  src={appleStep4Connect}
                  alt="STACK wizard step 4 of 4, titled Connect STACK, with a field for a personal Intervals API key and a Test Connection button"
                  caption="STACK · 4 of 4"
                />
              </div>
            </li>
          </ol>
        </section>

        <section id="other-watch" className="getting-started__section" aria-labelledby="other-title">
          <div className="getting-started__section-heading">
            <p className="machine-label">Garmin · COROS · Other</p>
            <h2 id="other-title">Other watch setup</h2>
            <p>If your watch or training service already connects to Intervals.icu, you do not need HealthFit.</p>
          </div>
          <DataChain apple={false} />
          <ol className="getting-started__steps getting-started__steps--compact">
            <li>
              <span className="getting-started__step-number">1</span>
              <div>
                <h3>Connect your service to Intervals.icu</h3>
                <p>Create or sign in to Intervals.icu, then connect Garmin, COROS or your usual training service using Intervals.icu's integration settings.</p>
                <Screenshot
                  src={otherStep1Connect}
                  alt="STACK wizard step 1 of 3, titled Connect Intervals.icu, explaining you should connect Garmin, COROS, or your usual service without needing HealthFit"
                  caption="STACK · 1 of 3"
                />
              </div>
            </li>
            <li>
              <span className="getting-started__step-number">2</span>
              <div>
                <h3>Check one real run</h3>
                <p>Make sure at least one recent running activity is visible in Intervals.icu.</p>
                <Screenshot
                  src={otherStep2CheckRun}
                  alt="STACK wizard step 2 of 3, titled Check one run, asking you to make sure one recent run is visible in Intervals.icu"
                  caption="STACK · 2 of 3"
                />
              </div>
            </li>
            <li><span className="getting-started__step-number">3</span><div><h3>Copy your API key</h3><p>Go to <strong>Intervals.icu → Settings → Developer Settings</strong> and copy your personal API key.</p></div></li>
            <li>
              <span className="getting-started__step-number">4</span>
              <div>
                <h3>Connect STACK</h3>
                <p>Open <strong>STACK → Settings gear → Run Data → Garmin / COROS / Other</strong>, paste the key, tap <strong>Test Connection</strong>, then <strong>Sync Now</strong>.</p>
                <Screenshot
                  src={otherStep3Connect}
                  alt="STACK wizard step 3 of 3, titled Connect STACK, with a field for a personal Intervals API key and a Test Connection button"
                  caption="STACK · 3 of 3"
                />
              </div>
            </li>
          </ol>
        </section>

        <section id="first-run" className="getting-started__section getting-started__section--focus" aria-labelledby="first-run-title">
          <div className="getting-started__section-heading">
            <p className="machine-label">Step 3</p>
            <h2 id="first-run-title">When STACK finds your first run</h2>
          </div>
          <div className="getting-started__workflow">
            <div><RefreshCw size={22} /><strong>Sync</strong><span>STACK finds a new running activity from Intervals.icu.</span></div>
            <ArrowRight className="getting-started__workflow-arrow" size={18} aria-hidden="true" />
            <div><Footprints size={22} /><strong>Review</strong><span>Confirm the suggested plan workout or choose Add as Extra Run.</span></div>
            <ArrowRight className="getting-started__workflow-arrow" size={18} aria-hidden="true" />
            <div><Blocks size={22} /><strong>Build</strong><span>The confirmed run earns a block. Go to Build and place it.</span></div>
          </div>
          <div className="getting-started__tip">
            <strong>STACK guessed the wrong workout?</strong>
            <span>Use the Match picker during review. A run can also be added as an Extra Run if it was not on the plan.</span>
          </div>
        </section>

        <section id="using-stack" className="getting-started__section" aria-labelledby="using-title">
          <div className="getting-started__section-heading">
            <p className="machine-label">Step 4</p>
            <h2 id="using-title">Know the five parts of STACK</h2>
          </div>
          <ul className="getting-started__destinations">
            <AppDestination icon={<CalendarDays size={21} />} name="TODAY" question="What am I doing today?">Your current workout and the things that matter right now.</AppDestination>
            <AppDestination icon={<Blocks size={21} />} name="BUILD" question="What have I completed?">Every completed run earns a block for your eight-column training tower.</AppDestination>
            <AppDestination icon={<Activity size={21} />} name="RUNS" question="How is my training going?">Your run history, synced activity details and Training Signals.</AppDestination>
            <AppDestination icon={<UsersRound size={21} />} name="CREW" question="How is everyone doing?">The shared Crew Build, comparisons, recent Crew runs, member Builds and Props.</AppDestination>
            <AppDestination icon={<Footprints size={21} />} name="PLAN" question="What is coming up?">Your upcoming training weeks and scheduled workouts.</AppDestination>
          </ul>
        </section>

        <section id="privacy" className="getting-started__section" aria-labelledby="privacy-title">
          <div className="getting-started__section-heading">
            <p className="machine-label">Privacy</p>
            <h2 id="privacy-title">What your Crew can see</h2>
            <p>STACK shares enough to train together without publishing your private health data.</p>
          </div>
          <div className="getting-started__privacy-grid">
            <div className="getting-started__privacy-card getting-started__privacy-card--shared">
              <ShieldCheck size={22} aria-hidden="true" />
              <h3>Crew-visible</h3>
              <ul>
                <li>Display name and Runner Icon</li>
                <li>Run date and STACK run type</li>
                <li>Distance, duration and derived pace</li>
                <li>Weekly miles and Crew comparisons</li>
                <li>Shared Member Build / Crew Build data</li>
              </ul>
            </div>
            <div className="getting-started__privacy-card">
              <LockKeyhole size={22} aria-hidden="true" />
              <h3>Private</h3>
              <ul>
                <li>GPS route or location</li>
                <li>Exact start time</li>
                <li>Heart rate, HR zones and Training Load</li>
                <li>Effort choice and personal notes</li>
                <li>Apple Health data and raw source data</li>
                <li>Your Intervals API key</li>
              </ul>
            </div>
          </div>
          <div className="getting-started__device-key">
            <Smartphone size={22} aria-hidden="true" />
            <p><strong>Your Intervals API key stays on this browser/device.</strong> It is not uploaded with your STACK account. On a new phone or cleared browser, sign back into STACK and enter the API key again.</p>
          </div>
        </section>

        <section id="troubleshooting" className="getting-started__section" aria-labelledby="trouble-title">
          <div className="getting-started__section-heading">
            <p className="machine-label">Troubleshooting</p>
            <h2 id="trouble-title">Run missing? Start here.</h2>
          </div>
          <div className="getting-started__troubleshooting">
            <details open>
              <summary>My run is not showing in STACK</summary>
              <div>
                <p><strong>First: is the run visible in Intervals.icu?</strong></p>
                <p><strong>No:</strong> the problem is upstream of STACK. Apple Watch users should check HealthFit's Intervals.icu sync. Other-watch users should check their service connection inside Intervals.icu.</p>
                <p><strong>Yes:</strong> open STACK → Settings gear → Run Data → <strong>Sync Now</strong>. If it is an older activity, try <strong>Find Older Runs</strong>.</p>
              </div>
            </details>
            <details>
              <summary>STACK says my API key is invalid</summary>
              <div>
                <p>Copy or regenerate the key from Intervals.icu Developer Settings, make sure no spaces were copied before or after it, then try Test Connection again. This is exactly what that looks like:</p>
                <Screenshot
                  src={invalidKey}
                  alt="STACK Run Data screen showing the error message: Intervals.icu did not accept that personal API key. Copy a new key from Developer Settings and try again."
                  caption="STACK · rejected key"
                />
              </div>
            </details>
            <details>
              <summary>I got a new phone or cleared Safari data</summary>
              <div><p>Sign into the same STACK account. Your account data can sync back, but your Intervals API key is device-local, so open Run Data and enter it again.</p></div>
            </details>
            <details>
              <summary>I do not use a supported fitness connection</summary>
              <div><p>You can still record a run manually in STACK. Connected Run Data is the easiest workflow, but it is not required to use the core Plan → Run → Build loop.</p></div>
            </details>
          </div>
        </section>

        <section className="getting-started__done" aria-labelledby="done-title">
          <StackMark size={34} />
          <p className="machine-label">Setup complete</p>
          <h2 id="done-title">Run. Sync. Review. Build.</h2>
          <p>Once your watch data is connected, that is the normal STACK loop.</p>
          <Screenshot
            src={settingsConnected}
            alt="STACK Settings screen showing the Intervals.icu row as Connected on this device"
            caption="What it looks like when it's done"
          />
          <a className="getting-started__primary-link" href="/">Open STACK <ArrowRight size={17} aria-hidden="true" /></a>
        </section>

        <section className="getting-started__help" aria-label="Getting help">
          <CircleHelp size={21} aria-hidden="true" />
          <div>
            <strong>Still stuck?</strong>
            <p>When you ask for help, tell us which step failed: <strong>HealthFit</strong>, <strong>Intervals.icu</strong>, <strong>API key</strong>, <strong>STACK connection</strong>, or <strong>run missing</strong>.</p>
          </div>
        </section>
      </main>

      <footer className="getting-started__footer">
        <span>STACK</span>
        <span>Build your race.</span>
      </footer>
    </div>
  );
}
