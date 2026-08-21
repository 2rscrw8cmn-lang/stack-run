# Deployment

STACK is a Vite web app deployed on Vercel with Supabase-backed account, personal-sync and Crew features. Browser-local state remains an offline/cache boundary; signed-in canonical personal state and Crew state use Supabase. Personal Intervals credentials remain device-local and are not stored in Supabase.

## Deployment environments

STACK has two persistent Supabase projects with deliberately separate data and auth namespaces:

| Deployment | Supabase project | Project ref | Data |
|---|---|---|---|
| Vercel Production | `stack-run` | `fgnecruhlybarcmljggi` | Real accounts and production data |
| Vercel Preview | `stack-run-preview` | `plpooikvofzytbpsbzki` | Disposable QA accounts and data only |
| Local cloud QA | `stack-run-preview` | `plpooikvofzytbpsbzki` | Disposable QA accounts and data only |

A Vercel Preview must never use `stack-run`. A Production deployment must never use `stack-run-preview`.

## Required public environment variables

Supabase project URLs and publishable keys are browser-visible configuration by design. RLS, grants and RPC permissions are the security boundary. Never use a Supabase service-role key in a `VITE_` variable.

### Vercel Production scope

```text
VITE_STACK_BACKEND_ENV=production
VITE_SUPABASE_URL=https://fgnecruhlybarcmljggi.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<production publishable key>
```

### Vercel Preview scope

```text
VITE_STACK_BACKEND_ENV=preview
VITE_SUPABASE_URL=https://plpooikvofzytbpsbzki.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<preview publishable key>
```

Do not configure one unscoped set of Supabase variables for both Vercel environments.

## Hard backend guard

`vite.config.ts` compiles Vercel's `VERCEL_ENV` into `__STACK_DEPLOYMENT_ENV__` as `production`, `preview` or `development`.

`src/crew/supabaseClient.ts` then validates all three facts before creating a Supabase client:

1. deployment environment,
2. `VITE_STACK_BACKEND_ENV`, and
3. the Supabase project ref parsed from `VITE_SUPABASE_URL`.

Approved combinations are:

- Production deployment + `production` marker + `fgnecruhlybarcmljggi`.
- Preview deployment + `preview` marker + `plpooikvofzytbpsbzki`.
- Local development + `preview` marker + `plpooikvofzytbpsbzki`.

A mismatch fails closed: cloud/account/Crew infrastructure is unavailable for that build, while personal local STACK can still boot. Local development deliberately refuses the production backend.

This guard is defense in depth. Correct Vercel environment scoping is still required; the app guard is not a substitute for infrastructure isolation.

## Non-secret backend check

To prove which backend a deployment is using without exposing a secret, open:

```text
/api/backend-environment
```

The endpoint returns only deployment type, backend marker status and project ref. It never returns the Supabase URL or publishable key. Both `client` and `serverInvite` must report `ready`.

Expected project refs:

- Production: `fgnecruhlybarcmljggi`
- Preview: `plpooikvofzytbpsbzki`

For an end-to-end confirmation, browser Network requests from a cloud-backed action should use the corresponding `*.supabase.co` hostname.

A Preview request to the production hostname is a release blocker. With the application guard in place, that configuration should be blocked before a Supabase client is created.

## Preview database lifecycle

`stack-run-preview` is a permanent, zero-production-data QA project. It was initialized by replaying the repository's Supabase migrations in order rather than copying the production database.

Rules:

- Never copy production users or rows into Preview.
- Create dedicated QA accounts in Preview.
- Seed Crew/runs/Build/award test data only with those QA accounts.
- Schema changes are proven against Preview before production application.
- Do not hand-apply feature-branch migrations to Production for preview QA.
- Follow `docs/SUPABASE_MIGRATIONS.md` for the required repository → local fresh build → Preview → Production path.
- Preview migration history was reconciled to the 39 repository timestamps during Stabilization 1.04; a dry run must remain empty before a new migration is introduced.
- Production history still has an explicit approval gate documented in `docs/SUPABASE_MIGRATION_AUDIT_2026-08-21.md`. Until that gate is resolved, do not run a production `db push` or history repair.

## Repeatable preview QA

For a database-backed PR:

1. Bring `stack-run-preview` to the PR's intended migration state.
2. Confirm the Vercel Preview is scoped to the Preview variables above.
3. Use Preview-only QA accounts.
4. Exercise sign-in/personal sync, Crew join/invite, shared projection, Crew Build placement, Props and awards as relevant to the change.
5. Confirm Network requests resolve only to `plpooikvofzytbpsbzki.supabase.co`.
6. Confirm no production migration or production data write was required for the QA pass.
7. Only after review/merge should an approved migration path promote schema changes to Production.

## Local development

Use an ignored `.env.local` when cloud-backed behavior is needed locally:

```text
VITE_STACK_BACKEND_ENV=preview
VITE_SUPABASE_URL=https://plpooikvofzytbpsbzki.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<preview publishable key>
```

Local development is intentionally unable to connect to the known production Supabase project through the standard STACK client.

Without these variables, cloud-backed features are unavailable and the local/personal app can still boot.

## Vercel project settings

STACK remains a standard Vite deployment:

| Setting | Value |
|---|---|
| Framework | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm ci` |

The repository also contains narrowly scoped Vercel functions under `api/`. The Crew invite preview reader applies the same deployment/marker/project-ref boundary as the browser client. If server-only `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` or `STACK_BACKEND_ENV` overrides are configured, they must use the same Production/Preview scoping shown above. Server-only secrets, where still required, must never be prefixed with `VITE_`.

## Privacy and persistence boundary

- Signed-in personal training state is private to the owning Supabase account under self-only RLS.
- Crew receives only the explicit shared projection contract; never upload a whole private run object by spread/default.
- Production and Preview auth users are different users even when the same email is used for QA.
- Preview browser storage is origin-scoped and separate from the production origin.
- Personal Intervals API credentials remain device-local and are not synced to either Supabase project.
- Production data must never be used as Preview seed data.

## Before calling a deployment good

At minimum:

- `npm run check` passes in the validated code environment or CI.
- Production deployment identifies the production Supabase ref.
- Preview deployment identifies the preview Supabase ref.
- Preview can exercise required cloud flows without production writes.
- RLS remains enabled on all public STACK tables.
- General phone/release smoke coverage in `docs/RELEASE_CHECKLIST.md` still passes.
