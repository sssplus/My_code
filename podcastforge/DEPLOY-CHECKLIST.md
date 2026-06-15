# PodcastForge — Redeploy Checklist (trial handoff)

Use this before sharing the URL with testers. The app is one Node process that
serves the frontend and the API from a single origin.

## 1. Database (Postgres)
- [ ] Create a free Postgres (Neon or Supabase). Copy the connection string
      (it includes `sslmode=require`).
- [ ] The `users` table is created automatically on first boot — no migration step.

## 2. Environment variables
Set these on your host (see `backend/.env.example`):
- [ ] `PF_SECRET` — `openssl rand -hex 32`. **Set once, never change.** It signs
      sessions and derives the key-encryption key; rotating it logs everyone out
      and makes stored API keys unreadable. The server refuses to start in
      production without it.
- [ ] `DATABASE_URL` — from step 1. (Omit it and the app silently falls back to a
      local JSON file — fine for laptop dev, **not** for the hosted trial.)
- [ ] `NODE_ENV=production`
- [ ] `APP_URL=https://your-app-url` — required only if you enable OAuth.
- [ ] Google/GitHub OAuth (optional): `GOOGLE_CLIENT_ID/SECRET`,
      `GITHUB_CLIENT_ID/SECRET`, with callback URLs `${APP_URL}/api/auth/<provider>/callback`.
      Without these, the SSO buttons are disabled and email sign-up/in works.
- [ ] `RAZORPAY_KEY_SECRET` (optional): only if you want live billing. Without it,
      checkout stays in mock mode — fine for a free trial.

## 3. Build & start
- [ ] `cd backend && npm install` (installs `pg`).
- [ ] Start command: `node backend/server.js` (or `npm --prefix backend start`).
- [ ] Point the host's health check at `GET /api/health` (returns
      `{ ok, providers, oauth }`).

## 4. HTTPS (required)
- [ ] Serve over HTTPS — testers paste real provider API keys. Managed hosts
      (Render/Railway/Fly) give TLS automatically; on a raw VPS put Caddy/nginx in front.

## 5. Post-deploy smoke test (2 minutes)
- [ ] Open the URL → "Create account" → sign up with email + 8-char password.
- [ ] You land in the workspace with a 15-day trial and your email shown in the nav.
- [ ] Paste a real Gemini/OpenRouter/Anthropic key → badge shows "Key stored".
- [ ] Generator: paste a transcript → all 4 tabs fill.
- [ ] Agent: "Run agent" → produces a content pack.
- [ ] Miner / Script Studio / Music Brief / AI Stack Tracker each return output.
- [ ] Reload → still signed in (session is server-side).

## What testers get
- 15 days of **full, unlimited** access on signup, then the plan flips to
  `expired` and prompts for a plan.
- After expiry, the **Free** plan still works with per-day caps (server-enforced):
  generations 5, Script Studio 5, Miner 10 sections, AI Stack audits 2,
  Auto-Repurpose agent 8 calls (~1 run), Music briefs 5, chat 15, audio
  transcripts 2. Transcription (speech-to-text) works with the user's OpenAI,
  Groq, or Gemini key (whichever they connect, with fallback).
- Tools (each its own routed page, e.g. `/#/agent`): Generator, Auto-Repurpose
  Agent, Discover (podcast search), Transcripts (RSS transcript puller),
  Script Studio, Content Miner, AI Stack Tracker, Background Music Brief,
  Cover templates (PNG export), and an Account panel (usage/history/keys).

## Network egress
The server makes outbound calls to: the AI providers, Apple iTunes
(`itunes.apple.com`) for Discover, and arbitrary podcast RSS/transcript URLs for
the transcript puller. If your host restricts egress, allow general HTTPS out.
Podcast fetches are SSRF-guarded (private/loopback/link-local/metadata IPs are
blocked, redirects re-validated, connection pinned to a validated public IP).

## Security posture (already in place)
- Passwords: scrypt + per-user salt. Sessions: signed, expiring HMAC tokens.
- Stored API keys: AES-256-GCM encrypted at rest; never returned to the client,
  never logged, sent only to the provider you chose.
- All plan/usage limits enforced server-side (not bypassable from the browser).
- Static serving is path-traversal safe; OAuth origin is taken only from
  `APP_URL` (no Host-header spoofing); OAuth token returned via URL fragment.
- New tools (Agent, Music, Chat) and the auth/OAuth flow have passed focused
  security reviews; all AI/user output is HTML-escaped before rendering.

## Known limitations (by design for the trial)
- Billing is mock unless `RAZORPAY_KEY_SECRET` is set (no order-creation flow yet).
- Session tokens live in `localStorage` (standard for this SPA); a future
  hardening step is HttpOnly cookies if you want XSS-token-theft defense.
- The Music Brief links out to royalty-free libraries; it does not generate audio.
