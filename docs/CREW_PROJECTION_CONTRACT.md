# The Crew Projection Contract

Read this before adding or changing **any column on `shared_runs`**, any value
the client uploads to Crew, or any CHECK constraint in a Crew migration.

It exists because ignoring it took a live crew down for a day, and the failure
looked like something else entirely the whole time.

## The one rule

> **The device must never send Crew a value the database is constrained to
> refuse.**

Not "should validate". Must not send. The reason is the shape of the upload.

## Why this rule and not "let the server reject it"

`syncCrewProjection` uploads a runner's whole history in **one `upsert`**. That
is one SQL statement. Postgres evaluates every CHECK on every row in it, and a
single violation aborts the **entire statement**.

So one bad value does not cost the runner one run. It costs them:

- every run, in
- every crew they belong to, on
- every retry, forever, until the value is corrected.

And it is invisible from the runner's side. Personal STACK saves runs **one at
a time** through `save_personal_run`, so the same bad value fails only that one
run there. Their Build looks perfectly healthy while their crews receive
nothing at all. That is what issue #128 was, seen from the outside: "my runs
are in my Build but not in my Crew."

The actual production failure was `manual_heart_rate` outside its 30-250 CHECK.
Heart rate is optional and always was — the column is nullable. The value was
not missing, it was *unusable*, and nothing on the device was checking.

## What to do, by column kind

### Optional (nullable) columns

Mirror the constraint on the device and send `null` when the value fails it.
A value Crew cannot store is never worth failing a runner's whole contribution
over.

`src/crew/projection.ts` holds these guards next to each other on purpose:
`crewSafeHeartRate`, `crewSafePercent`, `crewSafeNonNegative`. Adding a nullable
constrained column means adding its guard beside them.

**Calculated values deserve the most suspicion.** A heart rate is reported by a
device and is wrong occasionally. The award scores are *derived here* — one
division by a near-zero baseline puts a percentage outside 0-100 — so they are
the likeliest to drift out of range, and they have no external source to blame.

### Required (NOT NULL) columns

There is nothing to omit, so the run cannot be shared at all. Add the rule to
`isShareableWithCrew`, which filters those runs out of the batch so that one
unstorable run costs only itself.

### Either way

Say so. `syncCrewProjection` returns a `CrewProjectionOutcome` carrying a count
and a runner-facing sentence, and `useRaceCrew` surfaces it. A run that is not
reaching the crew is something the runner is told, not something they discover
by comparing two screens. Silence is the specific failure this document exists
to prevent.

## The backstop, and why it is not the answer

If the batch fails anyway, `upsertSharedRuns` falls back to one upsert per run
so the damage is bounded to the rows actually at fault. That covers a
constraint this code has not been taught about.

Do not treat it as permission to skip the guard. It only runs after a failure,
it costs one request per run when it does, and it cannot tell the runner *which*
rule was broken — only that something was. The guard is what makes the failure
comprehensible.

## Checklist for a new constrained Crew column

1. Add the CHECK in the migration.
2. Add the matching guard in `src/crew/projection.ts` — nullable columns get a
   `crewSafe*` helper, NOT NULL columns get a clause in `isShareableWithCrew`.
3. Add a test asserting an out-of-range value is **not sent** (see
   `src/crew/projection.test.ts`), including the boundary values.
4. Check whether `personal_runs` needs the same constraint. Where both tables
   store a value, they must agree — otherwise a run lives in one and not the
   other, which is its own confusing bug.

## Related

- **D-081** — one canonical definition of Crew Build occupancy. Same root
  cause in a different place: the client and the server disagreeing about a
  fact only one of them should own.
- **D-082** — this contract.
- `docs/RACE_CREW_IMPLEMENTATION.md` for the projection's privacy boundary,
  which is a separate concern: *what* may be sent, not what the server can
  store.
