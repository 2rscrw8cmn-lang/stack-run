# Personal Account Sync (DATA-1)

## Deploy

Apply the forward migration:

```bash
supabase db push
```

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
   return.
7. Save the Intervals key on only one device. Sync there, then review the
   pending candidate on the device without the key. Confirm ignored ids also
   appear on both devices and Forget Connection leaves pending reviews intact.
8. Confirm the Crew contribution exists exactly once. If a run edit changes a
   placed Crew block's footprint, confirm it becomes READY rather than resizing
   into the communal tower; Props and unrelated placements remain.
9. Sign into a second STACK account in the same browser and confirm no plan,
   runs, Build, pending candidates, ignored ids or Intervals credential from
   the first account appears.
10. Confirm a signed-out browser and a signed-in account with no Crew both keep
    full personal functionality.

Do not remove the legacy Intervals proxy until its separate production iPhone
Safari deprecation checklist is complete.
