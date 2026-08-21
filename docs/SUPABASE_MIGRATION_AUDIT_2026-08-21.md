# Supabase migration audit — 2026-08-21

Issue: #146, Stabilization 1.04

Canonical repository base: `main` at `2d6f6c1` (PR #164 merged; Stabilization 1.03 complete).

## Repository chain

- 39 ordered migration files.
- First version: `20260810212106_race_crew_foundation.sql`.
- Last version: `20260820170000_shared_run_source.sql`.
- A fresh PostgreSQL 17 / Supabase local database applied all 39 versions from zero.
- All 24 transaction-style SQL checks passed against the fresh database.
- Historical file hashes are frozen in `supabase/migrations.baseline.json`.

## Preview — repaired

Project: `stack-run-preview` (`plpooikvofzytbpsbzki`).

Before repair, Preview had 39 apply-time ledger versions (`20260821130435` through `20260821132701`). The original repository timestamps appeared only inside the migration names. Its schema matched the final repository shape except that the two placement RPCs omitted the final supporting-block guard; one SQL function also used equivalent shortened aliases.

Repair performed:

1. Replaced only those three function definitions with the immutable definitions already checked into `20260813150000` and `20260820150000`.
2. Re-ran the affected SQL checks (`0006`, `0018`, `0023`) successfully in rollback-only transactions.
3. Proved equality with the fresh local reference:
   - 124 columns;
   - 100 constraints;
   - 31 indexes;
   - 24 policies;
   - 13 triggers;
   - 52 review-normalized function definitions with zero differences;
   - 308 application-role grants with zero differences.
4. Used supported `supabase migration repair` commands to mark the 39 apply-time versions reverted and the 39 repository versions applied.
5. Verified `supabase migration list --linked` is one-to-one and `supabase db push --linked --dry-run --skip-vault` reports `upToDate: true` with no migrations.

No reset, production data copy or production write was used.

## Production — reconciled

Project: `stack-run` (`fgnecruhlybarcmljggi`).

Before repair, Production recorded only:

- `20260810212106_race_crew_foundation`
- `20260810212506_race_crew_function_grants`

The other 37 repository versions were absent from the ledger. A read-only production dry run therefore proposed replaying all 37.

Before the approved repair, Production matched the fresh reference for tables, columns, constraints, indexes, policies, triggers and all 308 application-role grants. Of 52 functions, exactly one had a material body difference:

```text
public.initialize_personal_stack(jsonb, jsonb, jsonb, jsonb)
```

Migration `20260818130000_manual_heart_rate.sql` adds `manual_heart_rate` to the initializer's insert column/value lists. The production column, check constraint and generation-aware save RPC were present, but the initializer body did not persist that field. Marking all 37 versions applied at that point would have claimed equivalence that had not been proved.

### Approved repair

On 2026-08-21 the owner approved option 1: reconcile the production initializer to the checked-in definition, verify equivalence, then repair the missing migration history.

The repair was performed as follows:

1. Replaced only `public.initialize_personal_stack(jsonb, jsonb, jsonb, jsonb)` with the immutable definition from `20260818130000_manual_heart_rate.sql`. This makes initial account import persist `manual_heart_rate`, matching the repository contract and the existing save RPC.
2. Ran SQL check `0018_manual_heart_rate.sql` successfully in a rollback-only transaction against Production.
3. Re-ran the catalog fingerprints against Preview:
   - 124 columns, 100 constraints, 31 indexes, 24 policies, 13 triggers, 92 routine grants and 216 table grants matched exactly;
   - all 52 review-normalized function definitions matched, with no missing functions.
4. Inspected the Supabase security and performance advisors. Their findings were not changed or suppressed as part of this ledger repair.
5. Used the supported `supabase migration repair` command to mark exactly the 37 missing repository versions applied. No migration SQL was replayed.
6. Verified the Production migration list is one-to-one for all 39 repository versions and `supabase db push --project-ref fgnecruhlybarcmljggi --dry-run --skip-vault` reports `upToDate: true` with no migrations.

No reset, production data copy, destructive operation or historical migration replay was used. Production migration tracking now represents the proved deployed schema.
