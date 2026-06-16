---
name: run-podcastforge
description: Build, run, and drive PodcastForge. Use when asked to start PodcastForge, run its backend tests, take a screenshot of its UI (landing, Guide, FAQ, workspace, account panel), or interact with the running web app.
---

PodcastForge is a single-page web app: a static frontend (`podcastforge/*.js`,
`index.html`, `style.css`) served by a dependency-light Node backend
(`podcastforge/backend/server.js`). An agent drives it with the headless-Chromium
**driver at `.claude/skills/run-podcastforge/driver.mjs`** — it launches the
server, drives the page, and writes one screenshot per target.

All paths below are relative to `podcastforge/`.

## Prerequisites

Node ≥ 18 (this container has Node 22). The backend's JSON-store path (used for
local runs and tests) needs **no npm install** — it only uses Node built-ins;
`pg` is required lazily and only when `DATABASE_URL` is set.

Driving the UI needs Playwright + a Chromium build. In this container both are
**already present**: a global `playwright@1.56.1` and its matching Chromium under
`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`. The driver auto-discovers them (see
Gotchas), so there is nothing to install here. On a normal machine instead run:

```bash
cd backend && npm install && npx playwright install chromium
```

## Run (agent path) — the driver

From `podcastforge/`. The driver spawns its own server (port 5599), captures, and
tears everything down. Targets are hash anchors (`#guide`, `#faq`), SPA routes
(`#/generator`, needs `--signup`), or CSS selectors. Screenshots land in
`./pf-shots/`.

```bash
# Public marketing sections (no auth)
node .claude/skills/run-podcastforge/driver.mjs '#guide' '#faq'
```

```bash
# Sign up through the real UI, then capture a workspace route
node .claude/skills/run-podcastforge/driver.mjs --signup '#/generator'
```

`--signup` flips the app into the workspace (`body.workspace-active`), which
hides the marketing landing — so a `landing` target *after* `--signup` shows the
workspace, which is what proves the signup→workspace transition rendered.

## Run (server / API path) — for backend changes

Many backend changes don't need a browser. Launch the server and hit the JSON API
with `curl`:

```bash
cd backend && PF_SECRET=dev PORT=3010 node server.js &
sleep 1
curl -s http://127.0.0.1:3010/api/health
curl -s -X POST http://127.0.0.1:3010/api/auth/signup \
  -H 'content-type: application/json' \
  -d '{"email":"smoke@example.com","password":"smoke-pass-123"}'
# stop it:  kill %1
```

`/api/health` returns the provider list; signup returns `{token,user}`. Auth'd
calls take `Authorization: Bearer <token>`.

## Test

```bash
cd backend && npm test
```

Runs `node --test` (security + rate-limit + live-server suite). Uses the JSON
store; writes a throwaway `backend/data/db.json` (gitignored).

## Gotchas (the battle scars)

- **Playwright version vs. browser build.** The repo pins `playwright@1.61`
  (wants Chromium build 1228), but this container only has build **1194** +
  global **`playwright@1.56.1`**. `npm run screenshots` (which imports the local
  1.61) therefore fails here with "browser not found". `driver.mjs` avoids this:
  it tries `playwright` locally, then falls back to the global install next to
  the node binary (`/opt/nodeXX/lib/node_modules`), launching with the first
  module whose browser actually exists. The launch log prints which one it used.
- **`npx playwright install chromium` is blocked in this sandbox** — the download
  host `cdn.playwright.dev` isn't in the egress allowlist (403). Don't try to
  install a browser here; rely on the preinstalled one (the driver does).
- **Run Chromium with `--no-sandbox`.** The container runs as root; the default
  sandbox aborts launch. The driver already passes it.
- **SPA routes aren't CSS selectors.** `#/generator` is a hash route, not an id —
  navigate to it and full-page screenshot; only simple `#section` anchors
  (`#faq`) can be element-cropped. The driver distinguishes them.
- **External CDNs are non-fatal.** The page pulls GSAP/Lenis/Razorpay/Google
  Fonts from CDNs; `app.js` guards every global, so the SPA boots and is drivable
  even when those are slow or blocked. The driver waits for `window.app &&
  window.PF` (real readiness) instead of a fixed sleep.
- **Fake keys are fine for UI.** The backend stores any 8–400 char key (it
  detects the provider from the prefix and encrypts it) without calling the
  provider — so `gsk_...` demos the Groq "transcribes" tag without a real key.

## Troubleshooting

- `LAUNCH FAIL: ... Executable doesn't exist` / "browser not found" → you're on
  the local `playwright@1.61` with no matching browser. Use the driver (it falls
  back to global), or set `PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright`.
- `server did not become ready` → another process holds the port. Change `PORT`
  or kill the stale `node server.js`.
- Blank/error screenshot → check the `[page error]` lines the driver prints, and
  confirm the server logged no boot error (it refuses to start if
  `NODE_ENV=production` and `PF_SECRET` is unset — the driver sets `PF_SECRET`).

## Secondary: full visual capture (CI)

`cd backend && npm run screenshots` runs `scripts/screenshots.mjs`, the
multi-screen capture wired into GitHub Actions (it uploads `podcastforge/screenshots/`
as a build artifact). It imports the **local** Playwright, so it needs
`npx playwright install chromium` to have succeeded — it runs in CI, not in this
browser-download-blocked sandbox. For ad-hoc local driving, use `driver.mjs` above.
