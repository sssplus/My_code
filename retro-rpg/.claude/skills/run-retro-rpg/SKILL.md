---
name: run-retro-rpg
description: Run, drive, and screenshot the retro-rpg browser game (Chronicles of the Shattered Realm). Use when asked to start the game, test it in a browser, take screenshots of the title/town/overworld/dungeon, verify rendering or camera changes, or smoke-test gameplay flows.
---

Vanilla JS canvas game — no build step, no dependencies. An HTTP server
serves the folder; a committed Playwright driver boots headless Chromium,
plays through character creation, walks the world, and screenshots. The
driver is the primary handle: `.claude/skills/run-retro-rpg/driver.mjs`.

All paths below are relative to `retro-rpg/`.

## Prerequisites

Nothing to install in this container — it ships with global `playwright`
(1.56) and `http-server`, with browsers under `/opt/pw-browsers`. Verify:

```bash
NODE_PATH=/opt/node22/lib/node_modules node -e "const {chromium}=require('playwright'); console.log(chromium.executablePath())"
```

The driver resolves playwright itself (falls back to
`/opt/node22/lib/node_modules`), so it needs no `NODE_PATH`. On a machine
without these, install playwright globally and its chromium browser first.

## Run (agent path)

The driver auto-starts `http-server` on port 8123 if nothing is serving
(and kills it after, only if it spawned it). Screenshots land in
`/tmp/retro-rpg-shots/`. Exit code 0 = pass; page errors or failed
assertions exit 1 with a reason.

```bash
node .claude/skills/run-retro-rpg/driver.mjs smoke
node .claude/skills/run-retro-rpg/driver.mjs event
node .claude/skills/run-retro-rpg/driver.mjs goto ashwood_dungeon 2 8
```

| command | what it does | takes |
|---|---|---|
| `smoke` | title → chargen → Ironhold town → walks out the real door → overworld; 3 screenshots; fails on page errors or if the zone exit doesn't fire | ~30s |
| `event` | creates a prince, soaks ~20s for the political event, resolves it by keyboard, asserts the world takes input again (regression for the stuck-POL_EVENT bug) | ~60s |
| `goto <zone> [x y]` | boots a fresh game then `WORLD.loadZone()` straight to any zone (`world`, `ironhold`, `moonsong`, `aurum`, `ashenkeep`, `dune_throne`, `ashwood_dungeon`, `bogmire_dungeon`, `spice_dungeon`) and screenshots it | ~15s |

For ad-hoc poking, everything is reachable from `page.evaluate` — the game
exposes globals: `PLAYER.get()`, `WORLD.loadZone/getCurrentZoneId`,
`UI.isPoliticalEventOpen()`, `DIALOG.isActive()`, `ENGINE.getCamera/getFrame`,
`TERRAIN.tileAt(x,y)`. Copy the boot/`step`/`walkTo` helpers from the driver.

## Run (human path)

```bash
npx http-server -p 8123 -s    # then open http://localhost:8123/ — Ctrl-C to stop
```

Serve over HTTP, not `file://` — the game loads `assets/*.png` onto a
canvas and falls back to flat procedural tiles if the atlas can't load.

## Test

No test suite. Syntax-check all modules (catches load-order breakage —
these are plain scripts, not ES modules):

```bash
cd js && for f in *.js; do node -e "new Function(require('fs').readFileSync('$f','utf8'))" && echo "$f OK"; done
```

## Gotchas

- **`keyboard.press()` does not move the player.** Movement uses
  `actionHeld()`; a quick down+up falls between frames. Hold ≥90ms, then
  wait ~180ms for the move cooldown — that's the driver's `step()`.
- **Park the mouse (`page.mouse.move(5,5)`) after canvas clicks.** Hover
  participates in selection UI; a cursor parked over a card historically
  overrode keyboard navigation (chargen origin silently became "priest").
  Fixed in-game, but the driver still parks defensively.
- **NPCs wander and can block your path** — and bumping one opens a
  dialog, which swallows world input. The driver's `walkTo()` re-reads
  position each step, dodges on the other axis, and closes stray dialogs
  (`DIALOG.isActive()` → press Enter).
- **Zone exits fire on step-on.** `walkTo()` returns early when
  `WORLD.getCurrentZoneId()` changes — keep steering after a zone load and
  you'll walk toward the same coords in the *new* zone.
- **`WORLD.loadZone(zone, x, y)` from `page.evaluate` is the deterministic
  way to screenshot a zone** — blind walking is at the mercy of NPC RNG.
- **Political events need a `noble` (origin index 3) or `prince` (4)** and
  ~20s (1200 frames) of being in the WORLD state. Headless rAF runs at a
  full 60fps here, so wall-clock waits are reliable.
- **`pkill -f http-server` is a foot-gun**: it matches your own compound
  shell command (killed my shell, exit 144), and misses the actual server
  because npx exec's it as bare `http-server` (no args in its cmdline).
  Find it with `ps aux | grep '[h]ttp-server'` and `kill <pid>`.

## Troubleshooting

- **`Cannot find module 'playwright'`**: bare `require` doesn't see global
  modules. The driver already falls back to
  `/opt/node22/lib/node_modules/playwright`; for one-off scripts set
  `NODE_PATH=/opt/node22/lib/node_modules`.
- **World renders as flat colored squares (no pixel art)**: the tileset
  PNG didn't load — check `assets/tileset.png` and `assets/doodads.png`
  return 200 over the server (`curl -sf -o /dev/null -w "%{http_code}" http://localhost:8123/assets/tileset.png`).
  The procedural fallback is deliberate, not a crash.
- **Driver hangs then `walkTo stuck at x,y`**: an NPC is camped on the
  path (random). Re-run, or use `goto` for the screenshot instead.
