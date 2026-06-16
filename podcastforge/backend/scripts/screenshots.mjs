/* ============================================================
   PodcastForge — visual capture (Playwright)
   Boots the backend (which serves the frontend), drives a headless
   Chromium through the key screens, and writes PNGs to
   ../screenshots/. Resilient: each shot is independent, so one
   failure never aborts the rest.

   Usage (from backend/):
     npm install                      # installs playwright (devDep)
     npx playwright install chromium  # one-time browser download
     npm run screenshots              # -> podcastforge/screenshots/*.png

   Env overrides: PORT, PF_SECRET, PW_BASE_URL (skip spawning a server
   and shoot an already-running instance instead).
   ============================================================ */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');
const outDir = path.resolve(backendDir, '..', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

const PORT = process.env.PORT || 4123;
const BASE = process.env.PW_BASE_URL || `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { if ((await fetch(url + '/api/health')).ok) return true; } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('server did not become ready');
}

async function main() {
  // Spawn our own server unless pointed at an external URL.
  let server = null;
  if (!process.env.PW_BASE_URL) {
    server = spawn('node', ['server.js'], {
      cwd: backendDir,
      env: { ...process.env, PORT: String(PORT), PF_SECRET: process.env.PF_SECRET || 'screenshot-secret-please-ignore' },
      stdio: 'inherit'
    });
    await waitForServer(BASE);
  }
  const killServer = () => { if (server) { try { server.kill('SIGTERM'); } catch {} } };

  let browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    console.error('\n[screenshots] Could not launch Chromium. Run `npx playwright install chromium` first.');
    console.error('              (In sandboxes, cdn.playwright.dev must be allow-listed for that download.)\n');
    killServer();
    throw e;
  }

  // reducedMotion makes scroll-reveal content render immediately and stops
  // captures landing mid-animation; deviceScaleFactor:2 yields crisp PNGs.
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce'
  });
  const page = await context.newPage();
  const results = [];

  // `required` shots gate CI — the public pages that must always render. Auth-
  // dependent shots are best-effort and never fail the build (they can flake on
  // a fresh DB / slow CDN), but a broken landing/Guide/FAQ is a real regression.
  async function shot(name, required, fn) {
    try {
      await fn();
      results.push({ name, ok: true, required });
    } catch (e) {
      results.push({ name, ok: false, required, err: e.message });
      console.error(`[screenshots] ${name} failed: ${e.message}`);
    }
  }

  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    // Wait for the SPA to finish booting rather than guessing with a sleep, so
    // shots don't race app init (which lazily pulls the animation CDNs).
    await page.waitForFunction(() => window.app && window.PF, { timeout: 15000 }).catch(() => {});

    // 1) Full landing page
    await shot('01-landing.png', true, async () => {
      await page.screenshot({ path: path.join(outDir, '01-landing.png'), fullPage: true });
    });

    // 2) User manual / Guide section
    await shot('02-guide.png', true, async () => {
      const el = page.locator('#guide');
      await el.scrollIntoViewIfNeeded();
      await el.screenshot({ path: path.join(outDir, '02-guide.png') });
    });

    // 3) FAQ — expand every accordion item first
    await shot('03-faq.png', true, async () => {
      await page.evaluate(() => document.querySelectorAll('#faq details').forEach((d) => (d.open = true)));
      const el = page.locator('#faq');
      await el.scrollIntoViewIfNeeded();
      await el.screenshot({ path: path.join(outDir, '03-faq.png') });
    });

    // 4) Workspace — sign up through the real UI so the transition is genuine
    await shot('04-workspace.png', false, async () => {
      const email = `shot_${Date.now()}@example.com`;
      await page.evaluate(() => window.app && window.app.showAuthModal());
      await page.fill('#auth-email', email);
      await page.fill('#auth-password', 'screenshot-pass-123');
      await page.click('#auth-submit');
      await page.waitForSelector('body.workspace-active', { timeout: 15000 });
      await sleep(1000);
      await page.screenshot({ path: path.join(outDir, '04-workspace.png') });
    });

    // 5) Account panel showing the "which keys can transcribe" hint. Save a
    //    (fake) Groq key so the 🎙 transcribes tag + green hint render. If the
    //    save fails (e.g. shot 04 didn't authenticate) this shot fails loudly
    //    rather than capturing the wrong "no keys" panel.
    await shot('05-account-transcribe.png', false, async () => {
      await page.evaluate(() => window.PF.saveKey('gsk_screenshotdemoKEY000000000000'));
      await page.evaluate(() => window.app && window.app.openAccount());
      await page.waitForSelector('#account-modal.show .ac-hint', { timeout: 10000 });
      await sleep(400);
      await page.screenshot({ path: path.join(outDir, '05-account-transcribe.png') });
    });

    // 6) FAQ on a mobile viewport (responsive check)
    await shot('06-faq-mobile.png', false, async () => {
      const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce', isMobile: true });
      try {
        const mp = await mobile.newPage();
        await mp.goto(BASE, { waitUntil: 'domcontentloaded' });
        await mp.evaluate(() => document.querySelectorAll('#faq details').forEach((d) => (d.open = true)));
        const el = mp.locator('#faq');
        await el.scrollIntoViewIfNeeded();
        await el.screenshot({ path: path.join(outDir, '06-faq-mobile.png') });
      } finally {
        await mobile.close();
      }
    });
  } finally {
    // Always tear down, even if a shot throws unexpectedly, so the job never
    // hangs on the still-listening server child.
    await browser.close().catch(() => {});
    killServer();
  }

  const ok = results.filter((r) => r.ok).length;
  const failedRequired = results.filter((r) => r.required && !r.ok);
  console.log(`\n[screenshots] ${ok}/${results.length} captured -> ${outDir}`);
  results.forEach((r) => console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.required ? '' : ' (optional)'}${r.err ? '  (' + r.err + ')' : ''}`));
  // Fail CI only if a REQUIRED (public) shot failed; auth-dependent shots warn.
  if (failedRequired.length) {
    console.error(`[screenshots] ${failedRequired.length} required shot(s) failed.`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
