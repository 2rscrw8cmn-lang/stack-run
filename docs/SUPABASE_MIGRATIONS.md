# Supabase migration runbook

The checked-in files under `supabase/migrations/` are the only schema-change authority for STACK. A cloud dashboard edit, ad hoc SQL query or connector call is not a deployment path.

## Invariants

- Production is `stack-run` (`fgnecruhlybarcmljggi`).
- Preview is `stack-run-preview` (`plpooikvofzytbpsbzki`).
- Never copy production rows or auth users to Preview.
- Never reset a cloud database to repair migration history.
- Never edit, rename, reorder or delete an applied migration. Add a forward-only corrective migration.
- Never mark a migration applied merely because most of its objects exist. Functions, policies, constraints, indexes, triggers and grants are part of equivalence.
- Never write directly to `supabase_migrations.schema_migrations`. Use `supabase migration repair` only after the proof described below.
- Do not use an API or connector `apply_migration` call for a checked-in migration: it can create a new apply-time version instead of preserving the filename timestamp.

`supabase/migrations.baseline.json` freezes the historical chain through `20260820170000`. `npm run db:verify:migrations` rejects edits to those files and rejects invalid or duplicate timestamps.

## Create a migration

Use the repository-pinned CLI; do not invent the filename.

```sh
npx supabase migration new descriptive_snake_case_name
```

Rules:

- The CLI-generated 14-digit UTC timestamp is the version and must be unique.
- The suffix is lowercase snake case.
- Prefer transactional, idempotent DDL where PostgreSQL supports it.
- Include explicit RLS and application-role grants. Defaults are not a stable security contract.
- Add or update a transaction-style check in `supabase/tests/` for the changed behavior.
- A correction to live behavior is a new migration, even when the old migration was wrong.

## Prove the branch locally

Docker must be running. The following reset is destructive only to the local `stack-run` Supabase container; it must never be used with `--linked`, `--project-ref` or a cloud database URL.

```sh
npm run db:start
npm run db:verify
```

`db:verify` validates the immutable migration chain, rebuilds the local database from zero with seeding disabled, then runs every `supabase/tests/*.sql` file with `ON_ERROR_STOP=1`. Each SQL check opens a transaction and rolls it back.

Useful read-only inventories:

```sh
npx supabase migration list --local
```

- `supabase/checks/catalog_fingerprint.sql` covers public tables, columns, constraints, indexes, functions, policies, triggers and grants.
- `supabase/checks/function_fingerprint.sql` gives exact and review-normalized function hashes.
- `supabase/checks/grant_inventory.sql` lists only `PUBLIC`, `anon`, `authenticated` and `service_role` privileges.

The migration PR must pass `.github/workflows/supabase-migration-gate.yml` before merge.

## Promote repository migration → Preview → Production

### 1. Preview

Link deliberately and verify the printed ref before any write:

```sh
npx supabase link --project-ref plpooikvofzytbpsbzki
npx supabase migration list --linked
npx supabase db push --linked --dry-run --skip-vault
```

The dry run must list only the new migration(s) in the PR. If it lists history, stop and follow the drift procedure below. After review approval:

```sh
npx supabase db push --linked --skip-vault
npx supabase migration list --linked
npx supabase db push --linked --dry-run --skip-vault
```

The final dry run must report `upToDate: true`. Run the relevant SQL checks against Preview and exercise the Vercel Preview using Preview-only accounts. Capture the migration list, dry-run result, SQL-check result and application QA in the PR.

### 2. Production

Production promotion is a separate, explicitly approved operation after merge and successful Preview verification. Prefer `--project-ref` so a stale local link cannot select the target:

```sh
npx supabase migration list --project-ref fgnecruhlybarcmljggi
npx supabase db push --project-ref fgnecruhlybarcmljggi --dry-run --skip-vault
```

The dry run must list exactly the reviewed migration(s), with no historical replay. A maintainer must approve the production write before:

```sh
npx supabase db push --project-ref fgnecruhlybarcmljggi --skip-vault
```

Then repeat the migration list and dry run, run the relevant transaction-style SQL checks, inspect Supabase security/performance advisors when DDL changed, and perform the application smoke test. Record the exact version, commit, operator and verification result.

## Drift and history repair

Stop when local and remote versions differ. Do not use `db push --include-all` as a shortcut.

1. Save `supabase migration list` for the target.
2. Compare the target to a fresh local build using all three read-only checks above.
3. Review every difference. Formatting-only function-source changes require human review; missing SQL behavior is not equivalent.
4. Run the transaction-style checks that cover the affected migrations.
5. Write the exact repair plan: target ref, versions to mark `reverted`, versions to mark `applied`, and evidence for each.
6. On Preview, obtain normal migration approval. On Production, obtain explicit production-metadata approval.
7. Use only the supported command:

```sh
npx supabase migration repair --project-ref <target-ref> --status reverted <wrong-version...>
npx supabase migration repair --project-ref <target-ref> --status applied <proved-version...>
```

`migration repair` changes tracking rows only; it does not execute or undo migration SQL. Immediately repeat `migration list` and `db push --dry-run`. If either is unexpected, stop.

If a schema effect is missing, first add/apply a forward-only migration or obtain approval for a narrowly scoped reconciliation. Never falsify the ledger to suppress a replay.

## Recovery

- **Migration failed before it was recorded:** inspect the transaction result; correct with a new forward migration. Do not edit a version that reached any shared environment.
- **Migration recorded but schema missing:** prove the mismatch, mark that version reverted with `migration repair`, then use an approved forward correction. Do not blindly replay a historical file against production data.
- **Schema exists but history is missing:** prove full equivalence, then mark only that exact version applied.
- **Wrong remote-only versions:** prove which repository migrations produced the schema, mark the wrong versions reverted, then mark the repository versions applied.
- **Rollback needed:** write a reviewed forward migration that restores the desired state. Files under `supabase/rollback/` are emergency references, not an automatic deployment chain.

## Data API compatibility deadline

The live projects currently use Supabase's legacy automatic Data API grants. `supabase/config.toml` pins `api.auto_expose_new_tables = true` so fresh local builds reproduce that contract. Supabase has announced that this compatibility switch will be removed on October 30, 2026.

Before that date, add a reviewed forward migration that makes every intended `anon`, `authenticated` and `service_role` grant explicit, verify the grant inventory in Preview, and remove the compatibility setting. Do not allow the platform default to silently change application access.
