# Connect Your Runs to STACK

Status: **User-facing setup source of truth for Race Crew onboarding.**

STACK does not record workouts directly from a watch. It reads completed runs from Intervals.icu.

For Apple Watch, one extra bridge app is required because Apple Watch workouts live in Apple Health and Intervals.icu does not directly ingest Apple Health on its own.

## The simple version

### Apple Watch

```text
APPLE WATCH
    ↓
APPLE HEALTH
    ↓
HEALTHFIT
    ↓
INTERVALS.ICU
    ↓
STACK
```

### Garmin / COROS / another service already supported by Intervals.icu

```text
YOUR WATCH / TRAINING SERVICE
    ↓
INTERVALS.ICU
    ↓
STACK
```

If your device already sends workouts directly to Intervals.icu, you do **not** need HealthFit.

## Why are there several apps?

Each one has one small job:

### Your watch

Records the run.

### HealthFit — Apple Watch only

Moves workouts out of Apple Health and automatically sends them to Intervals.icu.

HealthFit is a paid iPhone app and currently requires no HealthFit account/login.

### Intervals.icu

Acts as the workout-data bridge STACK can read reliably.

Intervals.icu accounts and personal API access are available without requiring STACK to integrate separately with every watch company.

### STACK

Turns the run into your plan history, Training Signals, Build block and — when you join one — a privacy-safe Race Crew summary.

## Apple Watch setup — step by step

### Step 1 — Install HealthFit

Install **HealthFit** from the App Store.

Allow HealthFit to read the Apple Health workout/fitness data it needs.

You do not need to create a separate HealthFit account.

### Step 2 — Create an Intervals.icu account

Create an Intervals.icu account if you do not already have one.

Use the normal Intervals web app.

### Step 3 — Connect HealthFit to Intervals.icu

In HealthFit, open the area where external workout-sync services are configured.

Choose **Intervals.icu** and authorize the connection.

Enable automatic workout syncing.

HealthFit's exact menu labels may change between app versions, but Intervals.icu should appear as one of its supported workout-sync destinations.

### Step 4 — Verify the bridge before touching STACK

Finish setup only after you can see at least one Apple Watch run inside Intervals.icu.

The test is:

```text
Apple Watch run → visible in Intervals.icu
```

If that does not work, STACK cannot fix the upstream bridge yet.

### Step 5 — Generate your personal Intervals API key

In Intervals.icu:

1. Open **Settings**.
2. Scroll to **Developer Settings** near the bottom.
3. Generate/copy your personal API key.

Treat this key like a password to your Intervals data.

Do not send it to another runner, the Race Crew owner, GitHub, or a chat message.

### Step 6 — Connect Intervals to STACK

In STACK:

1. Open the Settings gear.
2. Open **Run Data**.
3. Choose `Connect Intervals.icu` / personal API-key setup.
4. Paste your API key.
5. Tap **Test Connection**.
6. Tap **Sync Now**.

STACK stores this key only on the current browser/device.

It is not uploaded to Race Crew or Supabase.

### Step 7 — Confirm the first run

When STACK finds a run:

- confirm the scheduled match or mark it as an extra run;
- choose Rough / Solid / Great;
- add optional notes;
- place the earned Build block.

After that, normal syncing works the same way as the existing Connected Training flow.

## Garmin / COROS / other supported device setup

HealthFit exists specifically to bridge Apple Health.

If Intervals.icu supports a direct connection from your normal watch/training service:

1. Create/sign in to Intervals.icu.
2. Connect your watch/training service to Intervals.icu using Intervals' integration settings.
3. Confirm a recent run appears in Intervals.icu.
4. In Intervals Settings → Developer Settings, generate your personal API key.
5. Paste the key into STACK → Settings → Run Data.
6. Test Connection.
7. Sync Now.

Then you are done.

Do not install HealthFit just because another STACK runner uses Apple Watch.

## What the API key does

The Intervals personal API key lets this copy of STACK read your Intervals activity data.

For personal-key authentication Intervals uses Basic auth with:

```text
username: API_KEY
password: <your personal API key>
```

STACK handles that automatically. The runner should never need to type the literal `API_KEY` username anywhere in STACK.

## Where the key is stored

Race Crew hobby mode stores the key locally under a dedicated credential slot separate from personal AppState.

Conceptual key:

```text
stack.intervals.api-key.v1
```

Consequences:

- the key is not part of Race Crew data;
- the key is not part of training-data backup/export;
- changing phones/browsers requires entering the key again;
- clearing browser/site data removes the local connection;
- losing the local key does not delete anything from Intervals.icu;
- the user can disconnect/forget the key without deleting STACK runs.

If a user thinks the key was exposed, regenerate it in Intervals.icu and reconnect STACK.

## What Race Crew can see

Joining Race Crew does **not** share everything STACK knows.

Default crew-visible information:

- display name;
- run date;
- STACK run type;
- distance;
- duration;
- derived pace;
- Weekly Miles;
- recent Longest Run;
- scheduled Consistency summary;
- Miles Built.

Private by default:

- route / GPS / location;
- exact start time;
- average/max heart rate;
- HR zones;
- Training Load;
- Apple Health metrics;
- effort choice;
- notes;
- Intervals activity id;
- Intervals API key;
- raw source data;
- availability-calendar information.

## First-run onboarding copy recommendation

STACK should explain setup inside the app rather than sending a friend to this document cold.

Recommended wizard:

```text
CONNECT YOUR RUNS

How do you record runs?

[ Apple Watch ]
[ Garmin / COROS / Other ]
```

Apple Watch flow:

```text
1 OF 4
HEALTHFIT
Moves Apple Health workouts to Intervals.icu.

2 OF 4
INTERVALS.ICU
The data bridge STACK reads.

3 OF 4
CHECK THE BRIDGE
Make sure one run is visible in Intervals.

4 OF 4
CONNECT STACK
Paste your personal Intervals API key.
```

Completion state:

```text
RUN DATA CONNECTED

WATCH → INTERVALS.ICU → STACK

New runs will be available when STACK syncs.
```

For Apple Watch, the completion graphic may include HealthFit in the chain.

## Troubleshooting

### STACK says the API key is invalid

- regenerate/copy the key again from Intervals Developer Settings;
- make sure no spaces were copied before/after it;
- do not enter `API_KEY` as the password/key value;
- test again.

### A watch run is not in Intervals.icu

This is upstream of STACK.

Apple Watch users should open HealthFit and verify the Intervals destination/sync status.

Other-watch users should verify the device/service connection inside Intervals.

### The run is in Intervals but STACK does not find it

- use Sync Now;
- check the run is actually a running activity;
- confirm the activity date is inside STACK's bounded sync/backfill range;
- if needed, use the existing older-history/backfill behavior rather than widening continuous polling.

### New phone / cleared Safari data

Personal STACK data is still local unless separately restored from a STACK backup.

The Intervals API key must be entered again on the new/cleared browser.

Race Crew account membership lives in Supabase and can be restored by signing back into the STACK account.

## Future upgrade note

Intervals.icu officially recommends OAuth for apps intended for multiple users.

STACK's personal-key flow is an intentional private-hobby compromise for a tiny group of known friends.

Before STACK becomes a public or commercial multi-user app, replace this setup step with normal Intervals OAuth authorization so users no longer copy API keys manually.
