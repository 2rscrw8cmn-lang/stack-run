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

## Production — metadata write intentionally gated

Project: `stack-run` (`fgnecruhlybarcmljggi`).

Production records only:

- `20260810212106_race_crew_foundation`
- `20260810212506_race_crew_function_grants`

The other 37 repository versions are absent from the ledger. A read-only production dry run therefore proposes replaying all 37.

Production matches the fresh reference for tables, columns, constraints, indexes, policies, triggers and all 308 application-role grants. Of 52 functions, exactly one has a material body difference:

```text
public.initialize_personal_stack(jsonb, jsonb, jsonb, jsonb)
```

Migration `20260818130000_manual_heart_rate.sql` adds `manual_heart_rate` to the initializer's insert column/value lists. The production column, check constraint and generation-aware save RPC are present, but the initializer body does not persist that field. Marking all 37 versions applied would therefore claim equivalence that has not been proved.

No production migration metadata was changed.

### Required approval before production metadata repair

An owner must choose one of these in a separate, reviewed step:

1. Authorize the narrowly scoped production function reconciliation to the checked-in `20260818130000` definition, run SQL check `0018`, re-run all fingerprints, then mark the 37 missing repository versions applied; or
2. Preserve current production initializer behavior and approve a forward-only repository reconciliation that makes a fresh build intentionally match it, with the corresponding contract/test change.

Until that decision, do not run `db push` or `migration repair` against production. In particular, do not mark 36 versions applied while leaving `20260818130000` absent: Supabase would still attempt that missing historical migration later.
