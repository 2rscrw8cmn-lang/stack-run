# Personal Account Sync (DATA-1)

## Deploy

Apply the forward migration:

```bash
supabase db push
```

Existing projects that already applied
`20260813150000_personal_account_sync.sql` must also apply the follow-up
`20260813173000_personal_table_write_privileges.sql`, correctness migration
`20260813190000_personal_sync_correctness.sql` and Crew identity migration
`20260814120000_crew_contribution_identity.sql`. The first removes inherited
browser-role DML grants and replaces the initial self-write RLS policies with
self-read policies. The second adds the account reset generation and the
atomic run-delete/Personal-Build-repair RPC. The third repairs Crew
contributions a pre-DATA-1 device left under its own local run ids, which
otherwise double Crew mileage and duplicate Recent Crew Runs. Authenticated
writes continue exclusively through revision- and generation-enforcing RPCs.

Evolution 2.06 also applies
`20260822175155_optional_plan_lifecycle.sql`. It makes the active `plan`
nullable, adds the durable `plan_history` JSON array, advances the cloud
training schema to 2, and adds v2 initialize/save/reset RPCs that write both
fields atomically. The v1 RPCs remain during rolling deployment and do not
touch `plan_history`, so an older client cannot erase archives it does not
understand.

The schema-10 client is rolling-compatible in the other direction as well. It
retries the legacy select/RPC surface when `plan_history` or a v2 RPC is not yet
present. Only a non-null active plan with empty history is representable on
that surface. Optional-plan changes remain in the durable outbox, with a clear
upgrade-pending message, until schema 2 is available; they are never downgraded
or cleared.

Evolution 2.10B also applies
`20260824184205_structured_plan_truth.sql`. It advances the private training
row to cloud schema 3 with a frozen plan baseline, positive current revision,
baseline origin, and structured race goal. Existing active plans and archives
are adopted at revision 1 using their current visible schedule; no prior intent
is invented. Authenticated v3 initialize/save/reset RPCs write the full truth.
The schema-11 client falls back through v2 and v1 only when its state is exactly
representable there, otherwise the outbox keeps the mutation pending.

Rolling v1/v2 writers remain callable. A database trigger maintains schema 3,
anchors a newly seen legacy plan, advances revisions for legacy edits, and
enriches a v2 archive with its baseline/goal/revision before clearing active
truth. This compatibility does not widen RLS or grant browser table writes.

It adds:

- `personal_training_state`
- `personal_runs`
- `personal_build_state`
- `personal_intervals_state`
- initialization, revisioned-save, tombstone, reset and Crew-reconciliation RPCs

All four tables are self-only under RLS. Browser roles receive reads only;
writes go through authenticated revision-enforcing RPCs. No service-role key or
Intervals credential belongs in browser build variables or Supabase.

Run verification against a fresh/local migrated database:

```bash
supabase db reset
```

The files under `supabase/tests/` are transactional PostgreSQL assertion
scripts rather than pgTAP plans. Execute all of them with `ON_ERROR_STOP=1` in
filename order; every script rolls back its fake data.

Then run:

```bash
npm run check
```

## Owner real-device QA still required

Use one real account in a desktop browser and real iPhone Safari.

1. On the device with the intended existing STACK, sign in, inspect the run and
   built-block counts, choose **Use This Device's Data**, and confirm a local
   backup was created before initialization.
2. On the second device, sign into the same account and confirm the canonical
   plan, runs, metrics and Personal Build appear.
3. Log a run offline/online on one device, sync, and confirm exactly one run on
   the other device.
4. Edit that run, link it to a plan workout, sync, confirm on the other device,
   unlink it there, and confirm the first device refreshes to the unlink.
5. Place its Personal Build block, sync and confirm the position. Attempt a
   stale placement from the other device and confirm the newer tower wins and
   the rejected local state was backed up.
6. Delete the run, then open/sync the stale device and confirm the run does not
   return. Also delete a supporting placed block and confirm both devices show
   the same compact, valid survivor tower without a false Build-conflict notice.
7. Save the Intervals key on only one device. Sync there, then review the
   pending candidate on the device without the key. Confirm ignored ids also
   appear on both devices and Forget Connection leaves pending reviews intact.
8. Confirm the Crew contribution exists exactly once, including for runs that
   were shared by a device before this account existed: open Crew on a runner
   who had a duplicated card, and confirm one card remains, Weekly Miles and
   Miles Built count that run once, its Props survived, and its Member Build /
   Crew Build position is either preserved or READY. If a run edit changes a
   placed Crew block's footprint, confirm it becomes READY rather than resizing
   into the communal tower; Props and unrelated placements remain.
9. Sign into a second STACK account in the same browser and confirm no plan,
   runs, Build, pending candidates, ignored ids or Intervals credential from
   the first account appears.
10. Confirm a signed-out browser and a signed-in account with no Crew both keep
    full personal functionality.
11. While one device is offline, create a run there, Reset the account from the
    other device, then reconnect the stale device. Confirm its attempted state
    is backed up, the pre-reset run does not return, and a new run logged after
    the reset does sync.
12. Finish an active race plan on one device and confirm the second device
    enters the no-active-plan state with the prior plan readable in history.
    Start the next plan and confirm both devices show it while existing runs,
    Personal Build placements, and the archived plan remain unchanged.
13. On one device, edit an active plan and confirm the second device receives
    the new current schedule while its frozen baseline stays unchanged and the
    revision advances. Finish the plan and confirm its archive retains the
    baseline, final revision and structured race goal while actual runs remain
    unchanged.

Do not remove the legacy Intervals proxy until its separate production iPhone
Safari deprecation checklist is complete.
