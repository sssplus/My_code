/* ============================================================
   PodcastForge — run-skill driver
   Launches the backend (which serves the SPA), drives a headless
   Chromium, optionally signs up to enter the workspace, and writes a
   screenshot per target. This is the agent's handle on the running app.

   Usage (from podcastforge/):
     node .claude/skills/run-podcastforge/driver.mjs                 # landing -> pf-shots/landing.png
     node .claude/skills/run-podcastforge/driver.mjs '#guide' '#faq' # element/route shots
     node .claude/skills/run-podcastforge/driver.mjs --signup '#/generator'  # workspace route

   A target is either a hash route ('#faq', '#/generator') or a CSS
   selector ('.faq-item'). Workspace routes ('#/...') need --signup.

   Env: PORT (default 5599), PF_SECRET, PW_OUT (output dir, default
   ./pf-shots), PLAYWRIGHT_MODULE (force a specific playwright module).
   ============================================================ */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..', '..', '..', 'backend');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const signup = args.includes('--signup');
const targets = args.filter((a) => a !== '--signup');
const outDir = path.resolve(process.env.PW_OUT || path.join(process.cwd(), 'pf-shots'));
fs.mkdirSync(outDir, { recursive: true });

const PORT = process.env.PORT || 5599;
const BASE = `http://127.0.0.1:${PORT}`;

// Resolve a working Chromium. Tries the local devDep first, then a global
// install next to the node binary (e.g. /opt/nodeXX/lib/node_modules) — whose
// pre-installed browser may be the only one present in a sandbox. Returns the
// first module whose chromium actually launches.
async function launchChromium(opts) {
  const specs = [];
  if (process.env.PLAYWRIGHT_MODULE) specs.push(process.env.PLAYWRIGHT_MODULE);
  specs.push('playwright', 'playwright-core');
  const globalDir = path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules');
  specs.push(path.join(globalDir, 'playwright'), path.join(globalDir, 'playwright-core'));
  let lastErr;
  for (const spec of specs) {
    let mod;
    try { mod = require(spec); } catch { continue; }
    if (!mod || !mod.chromium) continue;
    try {
      const b = await mod.chromium.launch(opts);
      console.log(`[driver] launched Chromium via "${spec}" (${b.version()})`);
      return b;
    } catch (e) { lastErr = e; }   // e.g. a playwright whose browser isn't installed
  }
  throw lastErr || new Error('No usable Playwright/Chromium found. Run: npx playwright install chromium');
}

async function waitForServer(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { if ((await fetch(url + '/api/health')).ok) return; } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('server did not become ready');
}

const slug = (t) => t.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'shot';

async function main() {
  const server = spawn('node', ['server.js'], {
    cwd: backendDir,
    env: { ...process.env, PORT: String(PORT), PF_SECRET: process.env.PF_SECRET || 'run-driver-secret' },
    stdio: 'inherit'
  });
  const killServer = () => { try { server.kill('SIGTERM'); } catch {} };
  await waitForServer(BASE);

  const browser = await launchChromium({ args: ['--no-sandbox'] });
  const captured = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.error('[page error]', e.message));
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.app && window.PF, { timeout: 15000 }).catch(() => {});

    if (signup) {
      await page.evaluate(() => window.app && window.app.showAuthModal());
      await page.fill('#auth-email', `run_${Date.now()}@example.com`);
      await page.fill('#auth-password', 'run-driver-pass-123');
      await page.click('#auth-submit');
      await page.waitForSelector('body.workspace-active', { timeout: 15000 });
      await sleep(800);
      console.log('[driver] signed up -> workspace');
    }

    const list = targets.length ? targets : ['landing'];
    for (const t of list) {
      const file = path.join(outDir, `${slug(t)}.png`);
      if (t === 'landing') {
        await page.screenshot({ path: file, fullPage: true });
      } else if (t.startsWith('#')) {
        await page.goto(`${BASE}/${t}`, { waitUntil: 'domcontentloaded' });
        await sleep(700);
        await page.evaluate(() => document.querySelectorAll('#faq details').forEach((d) => (d.open = true)));
        // A simple "#section" anchor maps to an element id we can crop to; a
        // SPA route like "#/generator" does not — capture the full page.
        const isAnchor = /^#[A-Za-z][\w-]*$/.test(t);
        const el = isAnchor ? page.locator(t).first() : null;
        if (el && (await el.count())) { await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: file }); }
        else { await page.screenshot({ path: file, fullPage: true }); }
      } else {
        const el = page.locator(t).first();
        await el.scrollIntoViewIfNeeded();
        await el.screenshot({ path: file });
      }
      captured.push(file);
      console.log(`[driver] captured ${t} -> ${file}`);
    }
  } finally {
    await browser.close().catch(() => {});
    killServer();
  }
  console.log(`\n[driver] ${captured.length} screenshot(s) in ${outDir}`);
}

main().catch((e) => { console.error('[driver]', e.message); process.exit(1); });
