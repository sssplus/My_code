/* ============================================================
   PodcastForge Backend — in-memory rate limiter
   Zero dependencies. Fixed-window counters keyed by (bucket, id),
   used to throttle abuse: password brute-force on /login, signup
   spam, and overall API flooding. Single-process only — for a
   multi-instance deploy put a shared limiter (Redis/CDN) in front;
   this is a sane local + single-node default, not a substitute for
   edge protection.
   ============================================================ */
'use strict';

// Map<string, { count, reset }> — one entry per (bucket:id) window.
const hits = new Map();

// Periodic sweep so the map can't grow without bound from one-off IPs.
const SWEEP_MS = 5 * 60 * 1000;
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
}, SWEEP_MS);
// Don't keep the event loop alive just for the sweeper.
if (sweeper.unref) sweeper.unref();

/**
 * Record a hit and report whether it is allowed.
 * @param {string} bucket  logical limit name (e.g. 'login')
 * @param {string} id      caller identity (e.g. client IP)
 * @param {number} max     max hits permitted per window
 * @param {number} windowMs window length in ms
 * @returns {{ ok: boolean, remaining: number, retryAfter: number }}
 *          retryAfter is whole seconds until the window resets.
 */
function check(bucket, id, max, windowMs) {
  const key = `${bucket}:${id}`;
  const now = Date.now();
  let e = hits.get(key);
  if (!e || e.reset <= now) {
    e = { count: 0, reset: now + windowMs };
    hits.set(key, e);
  }
  e.count++;
  const ok = e.count <= max;
  return {
    ok,
    remaining: Math.max(0, max - e.count),
    retryAfter: Math.max(1, Math.ceil((e.reset - now) / 1000))
  };
}

// Test/maintenance helper.
function _reset() { hits.clear(); }

module.exports = { check, _reset };
