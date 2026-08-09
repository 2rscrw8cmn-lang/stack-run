# Technical References

These references support technical choices. Product decisions remain controlled by repository documents.

Last connected-data review: **August 9, 2026**. API/service behavior can change; UI-8 must verify real responses rather than treating this list as a permanent schema.

## React

- https://react.dev/learn/build-a-react-app-from-scratch
- https://react.dev/blog/2025/02/14/sunsetting-create-react-app

## Vite

- https://vite.dev/guide/
- https://vite.dev/guide/build
- https://vite.dev/guide/static-deploy

## Lucide React

- https://lucide.dev/guide/react/
- https://lucide.dev/guide/react/getting-started

## Vercel

STACK deploys a Vite front end and narrowly scoped functions under `api/`.

- https://vercel.com/docs/frameworks/frontend/vite
- https://vercel.com/docs/functions
- https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS

## HealthFit — Apple Watch / Apple Health bridge

HealthFit is the selected bridge between Apple Health/Apple Watch and Intervals.icu. STACK does not call HealthFit itself.

Current App Store information states that HealthFit:

- reads Apple Health/Apple Watch workouts;
- automatically syncs workouts to supported services including Intervals.icu;
- supports health metrics including HRV, resting HR, VO2 Max, sleep and body metrics;
- exports FIT/GPX/CSV/Google Sheets;
- can expose detailed workout series such as heart rate, running power and running dynamics in its export workflows;
- has current Intervals.icu planning integration.

Reference:

- https://apps.apple.com/us/app/healthfit/id1202650514

Do not assume every HealthFit metric reaches the ordinary Intervals activity API. `docs/CONNECTED_DATA_FIELDS.md` verifies the real pipeline separately.

## Intervals.icu Open API

Intervals.icu documents a full REST API with API-key and OAuth 2.0 authentication. The platform supports activity upload/download, wellness data, planned workouts/calendar management, webhooks and external-id mapping.

Official feature page:

- https://www.intervals.icu/features/open-api/

Official forum API guide:

- https://forum.intervals.icu/t/api-access-to-intervals-icu/609

Integration cookbook:

- https://forum.intervals.icu/t/intervals-icu-api-integration-cookbook/80090

### Personal API-key authentication

For personal use, Intervals.icu documents HTTP Basic authentication:

```text
username: API_KEY
password: <personal API key>
```

`API_KEY` is the literal username; it is not a placeholder for the key.

For endpoints accepting an athlete id, `0` may be used for the athlete associated with the credential.

STACK therefore uses server-side Basic auth from `api/intervals.ts` and never exposes the personal key to the browser.

### Multi-user applications

Intervals.icu states that applications intended for multiple people should use OAuth rather than a shared personal API key.

STACK's personal single-user proxy must be replaced with OAuth architecture before any multi-user release.

### Rate limiting

Intervals.icu returns rate-limit headers for rolling/day windows and `429` plus `Retry-After` when over limit. The current official forum guide lists personal API-key limits of 5000 requests/day and 2500 per rolling 15-minute window, plus an IP requests/second limit.

These numbers are operational context, not product constants. STACK must honor returned headers/429 behavior and avoid continuous polling rather than depending on hardcoded limits.

### Candidate endpoints used by Connected Training

The integration contract uses current API patterns such as:

```text
GET /api/v1/athlete/0/activities?oldest=YYYY-MM-DD&newest=YYYY-MM-DD
GET /api/v1/activity/{activityId}?intervals=true
GET /api/v1/athlete/0/wellness?oldest=YYYY-MM-DD&newest=YYYY-MM-DD
GET /api/v1/activity/{activityId}/file
```

The source of truth for implementation is the current Intervals API documentation/real response at coding time. UI-8 must verify the June 10 HealthFit-originated activity before locking field names.

## Apple Health / HealthKit

Apple HealthKit remains intentionally outside STACK's web architecture. HealthFit handles the Apple Health bridge.

- https://developer.apple.com/documentation/healthkit
- https://developer.apple.com/documentation/healthkit/setting-up-healthkit

A future direct HealthKit integration would require native Apple-platform work and a separate architecture decision.

## Strava

Strava is not the selected connected-data path. Keep these links only as historical technical reference:

- https://developers.strava.com/docs/getting-started/
- https://developers.strava.com/docs/rate-limits/
- https://developers.strava.com/guidelines/

Do not add Strava code during the Intervals connected program.

## Connected Training internal references

Read together:

- `docs/CONNECTED_TRAINING.md`
- `docs/INTERVALS_INTEGRATION.md`
- `docs/CONNECTED_DATA_FIELDS.md`
- `docs/DATA_AND_STORAGE.md`

## ChatGPT / GitHub agent workflow

- https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt
- https://developers.openai.com/codex/cloud
