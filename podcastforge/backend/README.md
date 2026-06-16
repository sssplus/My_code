# PodcastForge Backend

Accounts, encrypted bring-your-own-key storage, a server-side AI provider proxy
(so NVIDIA/OpenAI work despite browser CORS), server-enforced plans/usage, and
billing. It also serves the static frontend, so the whole app runs from one
origin with no CORS to configure.

## Storage

The store is chosen at boot from one environment variable:

| `DATABASE_URL` | Backend used | Good for |
|---|---|---|
| **set** | **Postgres** (Neon, Supabase, RDS…) | Production, real/paying customers, anything hosted on ephemeral disk |
| unset | JSON file (`data/db.json`) | Local development, quick demos |

Both implement the same interface (`lib/store-postgres.js`, `lib/store-json.js`)
behind `lib/store.js`, so switching is config-only — no code change.

## Run locally (JSON, zero setup)

```bash
cd backend
node server.js            # no DATABASE_URL → JSON file store
# open http://localhost:3000
```

`pg` is only loaded when `DATABASE_URL` is set, so you don't need to install
anything to run the JSON path.

## Run with Postgres

```bash
cd backend
npm install                       # installs pg
export PF_SECRET="$(openssl rand -hex 32)"
export DATABASE_URL="postgres://user:pass@host/db?sslmode=require"
node server.js
```

The `users` table is created automatically on first boot. Each user is one row
(`id`, `email`, `data JSONB`); the full user object — including the AES-256-GCM
encrypted provider keys — lives in `data`.

## Deploy (recommended for the trial)

Any host that runs Node works. A typical managed setup:

1. **Database** — create a free Postgres on [Neon](https://neon.tech) or
   [Supabase](https://supabase.com). Copy the connection string (it includes
   `sslmode=require`).
2. **App host** — deploy this repo to Render / Railway / Fly / a VPS. Start
   command: `node backend/server.js` (or `npm --prefix backend start`).
3. **Environment variables** (see `.env.example`):
   - `PF_SECRET` — `openssl rand -hex 32`. **Set once and never change it**, or
     every stored key becomes unreadable and all sessions drop. The server
     refuses to start in production without it.
   - `DATABASE_URL` — from step 1.
   - `NODE_ENV=production`
   - `RAZORPAY_KEY_SECRET` — only if you want real billing (otherwise checkout
     stays in mock mode).
4. **HTTPS** — required: users paste real API keys. Managed hosts give you TLS
   automatically; on a raw VPS put Caddy or nginx in front.

## Social login (Google / GitHub)

Email + password works out of the box. To enable OAuth:

1. Set **`APP_URL`** to your canonical https origin (e.g. `https://app.you.com`).
   OAuth stays disabled until this is set — the redirect origin is taken only
   from `APP_URL`, never from request headers, so a spoofed `Host` can't redirect
   the freshly issued session token to an attacker.
2. **Google** — create an OAuth client at
   <https://console.cloud.google.com/apis/credentials>, add redirect URI
   `${APP_URL}/api/auth/google/callback`, set `GOOGLE_CLIENT_ID` /
   `GOOGLE_CLIENT_SECRET`.
3. **GitHub** — create an OAuth app at
   <https://github.com/settings/developers>, set callback URL
   `${APP_URL}/api/auth/github/callback`, set `GITHUB_CLIENT_ID` /
   `GITHUB_CLIENT_SECRET`.

`GET /api/health` reports which providers are live (`{ oauth: { google, github } }`),
and the frontend enables the matching buttons automatically. After consent, the
session token comes back in the URL **fragment** (never sent to servers/logs),
is stored by the SPA, and the URL is scrubbed. Accounts are keyed by verified
email, so signing in with Google/GitHub/email for the same address lands on one
account.

## Trial behaviour

A new signup gets **15 days of full (unlimited) access**, then flips to
`expired` and is prompted to pick a plan. Free plan = 5 generations/day. All of
this is enforced **server-side** in `/api/ai`, so it can't be bypassed from the
browser.

## Health check

`GET /api/health` → `{ ok: true, providers: [...] }`. Point your host's health
check here.

## Visual capture (screenshots)

A Playwright script boots the server, drives a headless Chromium through the
key screens (landing, the Guide and FAQ, the workspace, and the account panel's
"which keys can transcribe" hint, plus a mobile FAQ shot) and writes PNGs to
`../screenshots/`:

```bash
npm install                       # installs playwright (devDependency)
npx playwright install chromium   # one-time browser download
npm run screenshots               # -> podcastforge/screenshots/*.png
```

Each shot is independent, so one failure won't abort the rest. Point it at an
already-running instance with `PW_BASE_URL=https://your-host` (it then skips
spawning a local server). Note: the browser download needs egress to
`cdn.playwright.dev`, which is blocked in some sandboxes.

## Security posture

Built-in, zero-dependency hardening:

- **Passwords** are scrypt-hashed with a per-user salt; login does equal work
  for unknown emails (no timing-based user enumeration) and returns a generic
  error.
- **Stored API keys** are encrypted at rest (AES-256-GCM, key derived from
  `PF_SECRET`) and never leave the server in responses.
- **Sessions** are stateless HMAC-SHA256 tokens carried in the `Authorization`
  header (not cookies), so the API isn't exposed to CSRF.
- **Rate limiting** (in-memory, per IP): a coarse cap across the whole API plus
  tight buckets on `/api/auth/login` and `/api/auth/signup` to blunt
  brute-force and signup spam. Set `TRUST_PROXY=1` behind a trusted proxy so the
  real client IP is used. For multi-instance deploys, add edge/CDN throttling
  too — this limiter is per-process.
- **SSRF guard** on every user-supplied URL fetch (RSS/transcripts/audio):
  blocks private/link-local/metadata IPs, pins the validated IP at connect time
  (DNS-rebinding safe), and re-validates each redirect hop.
- **Security headers** on all responses: a CDN-scoped `Content-Security-Policy`,
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` /
  `frame-ancestors 'none'` (clickjacking), `Referrer-Policy`,
  `Permissions-Policy`, and HSTS in production.
- **OAuth** redirect origin comes only from `APP_URL`, and a verified email is
  required (GitHub emails are confirmed against the verified-emails endpoint).

Run the regression tests with `npm test` (`node --test`).
