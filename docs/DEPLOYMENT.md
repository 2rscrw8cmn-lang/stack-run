# Deployment

STACK is a static site plus one serverless function, deployed to Vercel. There
is no database, no account system, and nothing stored off the device: the whole
application state lives in the browser's local storage.

## What Vercel needs

The repository is a stock Vite project, so the Vercel defaults are correct and
nothing has to be configured by hand:

| Setting | Value | Where it comes from |
|---|---|---|
| Framework preset | Vite | detected from `package.json` |
| Build command | `npm run build` | `package.json` |
| Output directory | `dist` | Vite's default |
| Install command | `npm ci` | detected from `package-lock.json` |
| Node version | 22.x or later | Vercel default |

`vercel.json` carries only what the defaults get wrong:

- **`functions."api/calendar.ts".maxDuration: 30`** — a Hobby deployment stops a
  function at ten seconds, which is *less* than the fifteen the calendar reader
  allows its upstream. Without this, a rostering host having a slow morning is
  cut off mid-fetch and the page is told something vague instead of the truth.
  Naming the file here also states plainly that it is meant to be a function.
- **`Content-Type` on `/manifest.webmanifest`** — so the manifest is served as
  `application/manifest+json` rather than something a browser may decline to
  read as one.
- **`Cache-Control: immutable` on `/assets/*`** — those filenames carry a
  content hash, so they can be cached for a year. Everything else, `index.html`
  included, keeps Vercel's default revalidating cache, which is what lets a
  deploy actually reach a phone that already has the app open.

There are no rewrites and no redirects. STACK is one page with no client-side
router, so nothing needs to be rewritten to `index.html`.

## Environment variables

None. The application reads no configuration, and `api/calendar.ts` takes
everything it needs from the request body.

## What a build must contain

`npm run build` writes `dist/`. A release is only correct if it holds:

```text
dist/index.html
dist/manifest.webmanifest
dist/favicon.svg
dist/apple-touch-icon.png
dist/icon-192.png
dist/icon-512.png
dist/icon-maskable-512.png
dist/assets/index-<hash>.css
dist/assets/index-<hash>.js
```

Everything in `public/` is copied verbatim, so the icons and the manifest are
part of the build rather than something uploaded separately.

`src/app/installability.test.ts` asserts the metadata, the manifest and the
icons agree with each other, and that no product-review tooling is left in the
source tree, so `npm run check` fails before a broken release can be deployed.

## Regenerating the icons

The icons are committed. They are drawn by a script rather than an image
editor, from the same geometry the in-app mark uses:

```bash
node scripts/generate-icons.mjs
```

It needs nothing but Node. Run it after changing the mark, and commit what it
writes.

## The serverless function

`api/calendar.ts` reads a calendar subscription link for the page when the
calendar host refuses the browser. It is deployed automatically because it
lives in `api/`; Vercel needs no configuration for that beyond the duration
already in `vercel.json`.

To check it is deployed, open `https://<your-deployment>/api/calendar` in a
browser. A `GET` answers in plain English that the reader is there. If it
answers with the app's own HTML instead, the function is not deployed and the
calendar import will fall back to the file picker and say so.

## How stored data survives a deployment

Local storage is scoped to an **origin**, not to a build. Deploying a new
version to the same domain leaves every run, block and plan edit exactly where
it was; `loadAppState` migrates an older schema forward on the next open and
writes the upgraded shape straight back.

Two consequences worth knowing before a release:

- **A preview deployment is a different origin.** `stack-abc123.vercel.app`
  cannot see data stored under the production domain, and neither can a custom
  domain see data stored under `*.vercel.app`. Test on the origin you intend to
  keep, and pick the domain before entering real training.
- **Changing the domain strands the data.** There is no export yet, so moving
  domains means starting from the seed plan.

The storage key is `stack.app-state.v1` and has not changed since the first
release. Schema versions move inside that key; the key itself is the contract.

## Installing it on a phone

iOS Safari does not offer an install prompt: open the production URL, then
**Share → Add to Home Screen**. The icon comes from `apple-touch-icon.png`, the
name from `apple-mobile-web-app-title`, and the app opens without browser
chrome because of `apple-mobile-web-app-capable`. Android offers a normal
install prompt, driven by `manifest.webmanifest`.

A home-screen install and the browser tab share the same local storage on both
platforms, so the data is the same app either way.

## Before calling a deployment good

Work through `docs/RELEASE_CHECKLIST.md` on the production URL, on the phone
the app is actually for.
