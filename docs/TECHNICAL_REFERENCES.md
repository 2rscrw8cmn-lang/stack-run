# Technical References

These references support the technical choices. Product decisions remain controlled by the repository documents.

## React

React's official from-scratch guidance recommends selecting a build tool such as Vite.

- https://react.dev/learn/build-a-react-app-from-scratch
- https://react.dev/blog/2025/02/14/sunsetting-create-react-app

## Vite

Vite provides the React/TypeScript scaffold, development server, and static production build.

- https://vite.dev/guide/
- https://vite.dev/guide/build
- https://vite.dev/guide/static-deploy

## Lucide React

Lucide's React package provides standalone inline SVG icon components and supports direct imports.

- https://lucide.dev/guide/react/
- https://lucide.dev/guide/react/getting-started

## Apple Health / HealthKit

Apple documents HealthKit as an Apple-platform capability enabled in Xcode with the HealthKit entitlement. STACK is a web app and intentionally excludes native HealthKit work.

- https://developer.apple.com/documentation/healthkit
- https://developer.apple.com/documentation/healthkit/setting-up-healthkit

## Strava API

Strava requires application registration, OAuth authorization, token handling, usage limits, and compliance with its API policies. New applications begin with limited athlete access. STACK intentionally excludes this integration.

- https://developers.strava.com/docs/getting-started/
- https://developers.strava.com/docs/rate-limits/
- https://developers.strava.com/guidelines/

## ChatGPT and GitHub

- https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt
- https://developers.openai.com/codex/cloud

## Vercel

Vite static deployments use `npm run build` and the default `dist` output. A file in `api/` is picked up as a serverless function with no extra configuration; `api/calendar.ts` uses the web-standard `(Request) => Response` signature, which needs no Vercel types package.

- https://vercel.com/docs/frameworks/frontend/vite
- https://vite.dev/guide/static-deploy
- https://vercel.com/docs/functions
- https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
