#!/usr/bin/env node
// Driver for the retro-rpg browser game. Serves the game, drives it with
// headless Chromium (Playwright), screenshots to /tmp/retro-rpg-shots/.
//
// Usage (from retro-rpg/):
//   node .claude/skills/run-retro-rpg/driver.mjs smoke
//   node .claude/skills/run-retro-rpg/driver.mjs event
//   node .claude/skills/run-retro-rpg/driver.mjs goto <zone> [x y]
//
// Subcommands:
//   smoke           title → chargen → town → walk out the door → overworld.
//                   Screenshots each stage; fails on page errors.
//   event           prince origin; soaks ~20s for the political event,
//                   resolves it by keyboard, asserts the world is
//                   interactive afterward (regression: stuck POL_EVENT).
//   goto <zone>     boot a fresh game, then WORLD.loadZone() straight to a
//                   zone ('world', 'ironhold', 'ashwood_dungeon', ...) and
//                   screenshot it. Optional x y are tile coords.
//
// Playwright comes from the global install (see SKILL.md prerequisites).

import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const PORT  = process.env.PORT || 8123;
const BASE  = `http://localhost:${PORT}/`;
const SHOTS = '/tmp/retro-rpg-shots';
mkdirSync(SHOTS, { recursive: true });

// ── server: reuse if already up, else spawn http-server ──────────────
async function ensureServer() {
  const up = async () => {
    try { return (await fetch(BASE + 'index.html')).ok; } catch { return false; }
  };
  if (await up()) return null;
  const srv = spawn('npx', ['http-server', '-p', String(PORT), '-s'], {
    cwd: process.cwd(), stdio: 'ignore', detached: true,
  });
  srv.unref();
  for (let i = 0; i < 30; i++) {
    if (await up()) return srv;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`server did not come up on :${PORT}`);
}

// ── shared page helpers ───────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function boot() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await sleep(1500); // loading screen fade + first frames
  return { browser, page, errors };
}

// Movement uses actionHeld(): a bare keyboard.press() can fall between
// frames. Hold the key across a frame, release, wait out the move cooldown.
async function step(page, key) {
  await page.keyboard.down(key);
  await sleep(90);
  await page.keyboard.up(key);
  await sleep(180);
}

const pos = page => page.evaluate(() => {
  const p = PLAYER.get();
  return p ? { x: p.x, y: p.y, zone: WORLD.getCurrentZoneId() } : null;
});

// Click "New Game", then keyboard through chargen. Parks the mouse at
// (5,5) first — hover used to override keyboard selection (fixed in-game,
// but parking keeps the driver insensitive to that class of bug).
async function newGame(page, { originIdx = 0 } = {}) {
  const box = await page.locator('#gameCanvas').boundingBox();
  await page.mouse.click(box.x + box.width * 400 / 800, box.y + box.height * 402 / 560);
  await page.mouse.move(5, 5);
  await sleep(400);
  await page.keyboard.press('Enter'); await sleep(300);          // kingdom
  for (let i = 0; i < originIdx; i++) { await page.keyboard.press('ArrowRight'); await sleep(150); }
  await page.keyboard.press('Enter'); await sleep(300);          // origin
  await page.keyboard.press('Enter'); await sleep(300);          // name (default)
  await page.keyboard.press('Enter'); await sleep(500);          // confirm
  await page.keyboard.press('Enter'); await sleep(300);          // prologue (skip type)
  await page.keyboard.press('Enter'); await sleep(800);          // prologue (advance)
}

// Steered walk: re-reads position each step, dodges on the other axis when
// blocked, closes accidental NPC dialogs (bumping an NPC opens one), and
// returns as soon as the zone changes (stepping on an exit).
async function walkTo(page, tx, ty, maxSteps = 50) {
  const startZone = (await pos(page)).zone;
  let stuck = 0, last = null;
  for (let i = 0; i < maxSteps; i++) {
    if (await page.evaluate(() => DIALOG.isActive())) {
      await page.keyboard.press('Enter'); await sleep(300); continue;
    }
    const p = await pos(page);
    if (!p || p.zone !== startZone) return p;             // zone exit fired
    if (p.x === tx && p.y === ty) return p;
    if (last && last.x === p.x && last.y === p.y) stuck++; else stuck = 0;
    if (stuck > 8) throw new Error(`walkTo stuck at ${p.x},${p.y} heading ${tx},${ty}`);
    last = p;
    const dodge = stuck % 2 === 1; // blocked → try the other axis
    const wantX = p.x !== tx, key =
      (wantX !== dodge)
        ? (p.x < tx ? 'ArrowRight' : 'ArrowLeft')
        : (p.y === ty ? (p.x < tx ? 'ArrowRight' : 'ArrowLeft')
                      : (p.y < ty ? 'ArrowDown' : 'ArrowUp'));
    await step(page, key);
  }
  return pos(page);
}

const shot = async (page, name) => {
  const path = `${SHOTS}/${name}.png`;
  await page.screenshot({ path });
  console.log('shot:', path);
};

function finish(errors, failMsg) {
  if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
  if (failMsg) { console.error('FAIL: ' + failMsg); process.exit(1); }
  console.log('OK');
}

// ── subcommands ───────────────────────────────────────────────────────
async function smoke() {
  const { browser, page, errors } = await boot();
  await shot(page, 'smoke-1-title');
  await newGame(page);
  console.log('in town:', JSON.stringify(await pos(page)));
  await shot(page, 'smoke-2-town');
  // walk out the Ironhold door at (6,10) — exercises the real zone exit
  const p = await walkTo(page, 6, 10);
  await sleep(700);
  const out = await pos(page);
  console.log('after door:', JSON.stringify(out));
  await shot(page, 'smoke-3-overworld');
  await browser.close();
  finish(errors, out.zone !== 'world' ? `expected zone 'world', got '${out.zone}'` : null);
}

async function event() {
  const { browser, page, errors } = await boot();
  await newGame(page, { originIdx: 4 });                 // prince
  const origin = await page.evaluate(() => PLAYER.get().origin);
  if (origin !== 'prince') { await browser.close(); finish(errors, `origin is '${origin}', not prince`); }
  console.log('waiting ~20s for political event...');
  const fired = await page.waitForFunction(() => UI.isPoliticalEventOpen(), null, { timeout: 45000 })
    .then(() => true).catch(() => false);
  if (!fired) { await browser.close(); finish(errors, 'political event never fired'); }
  await sleep(300);
  await shot(page, 'event-1-modal');
  await page.keyboard.press('ArrowDown'); await sleep(200);
  await page.keyboard.press('Enter');     await sleep(500);
  const open = await page.evaluate(() => UI.isPoliticalEventOpen());
  // Interactive check: try all four directions; any successful move proves
  // the world state took input back (terrain may block some directions).
  let interactive = false;
  for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
    const before = await pos(page);
    await step(page, key);
    const after = await pos(page);
    if (before.x !== after.x || before.y !== after.y) { interactive = true; break; }
  }
  await shot(page, 'event-2-after');
  await browser.close();
  finish(errors, open ? 'modal still open after choice'
    : !interactive ? 'world not interactive after event (stuck state?)' : null);
}

async function goto(zone, x, y) {
  const { browser, page, errors } = await boot();
  await newGame(page);
  const args = [zone, x, y].filter(v => v !== undefined);
  await page.evaluate(a => WORLD.loadZone(...a), args.map(v => isNaN(+v) ? v : +v));
  await sleep(700);
  console.log('zone:', JSON.stringify(await pos(page)));
  await shot(page, `goto-${zone}`);
  await browser.close();
  finish(errors, null);
}

// ── main ──────────────────────────────────────────────────────────────
const [cmd, ...args] = process.argv.slice(2);
const srv = await ensureServer();
try {
  if (cmd === 'smoke') await smoke();
  else if (cmd === 'event') await event();
  else if (cmd === 'goto' && args[0]) await goto(...args);
  else { console.error('usage: driver.mjs smoke | event | goto <zone> [x y]'); process.exit(2); }
} finally {
  if (srv) try { process.kill(-srv.pid); } catch { /* already gone */ }
}
