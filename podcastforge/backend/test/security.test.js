/* ============================================================
   PodcastForge Backend — security regression tests
   Run with:  node --test   (from backend/)
   Covers the hardening added for accounts/abuse:
     - rate limiter windowing
     - password hashing + constant-work dummy verify
     - session token integrity
     - API key encryption roundtrip
     - live server: security headers + auth rate limiting
   No external services are touched (JSON store, ephemeral port).
   ============================================================ */
'use strict';

// Deterministic, in-process secret so token/key crypto is stable for the run.
process.env.PF_SECRET = process.env.PF_SECRET || 'test-secret-please-ignore-0123456789';
delete process.env.DATABASE_URL;          // force the JSON store
delete process.env.NODE_ENV;              // avoid prod-only boot guard

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

const ratelimit = require('../lib/ratelimit');
const sec = require('../lib/security');

test('rate limiter allows up to max then blocks within the window', () => {
  ratelimit._reset();
  const max = 3, win = 60_000, id = '1.2.3.4';
  for (let i = 0; i < max; i++) assert.equal(ratelimit.check('t', id, max, win).ok, true, `hit ${i} ok`);
  const blocked = ratelimit.check('t', id, max, win);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfter >= 1);
  // A different identity has its own independent window.
  assert.equal(ratelimit.check('t', '9.9.9.9', max, win).ok, true);
});

test('password hashing verifies the right password and rejects others', () => {
  const stored = sec.hashPassword('correct horse battery staple');
  assert.ok(stored.includes(':'));
  assert.equal(sec.verifyPassword('correct horse battery staple', stored), true);
  assert.equal(sec.verifyPassword('wrong password', stored), false);
  assert.equal(sec.verifyPassword('', stored), false);
});

test('dummyVerify never throws and always returns false', () => {
  assert.equal(sec.dummyVerify('anything'), false);
  assert.equal(sec.dummyVerify(undefined), false);
});

test('session tokens are tamper-evident and expire', () => {
  const tok = sec.signToken('user-123');
  assert.equal(sec.verifyToken(tok), 'user-123');
  // Flip a character in the signature -> rejected.
  const bad = tok.slice(0, -1) + (tok.endsWith('a') ? 'b' : 'a');
  assert.equal(sec.verifyToken(bad), null);
  assert.equal(sec.verifyToken('garbage'), null);
  // Already-expired token.
  const expired = sec.signToken('u', -1);
  assert.equal(sec.verifyToken(expired), null);
});

test('API key encryption roundtrips and rejects tampering', () => {
  const blob = sec.encryptKey('sk-ant-secret-value');
  assert.equal(sec.decryptKey(blob), 'sk-ant-secret-value');
  const parts = blob.split(':');
  parts[2] = parts[2].slice(0, -2) + 'ff';        // corrupt ciphertext
  assert.equal(sec.decryptKey(parts.join(':')), null);   // GCM auth tag fails
  assert.equal(sec.decryptKey('not-a-blob'), null);
});

// ---- live server checks ----
function request(port, method, path, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path, headers }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('server sets security headers and throttles auth brute-force', async (t) => {
  ratelimit._reset();
  const store = require('../lib/store');
  const server = require('../server');
  await store.init();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  t.after(() => server.close());

  const health = await request(port, 'GET', '/api/health');
  assert.equal(health.status, 200);
  assert.match(health.headers['content-security-policy'] || '', /frame-ancestors 'none'/);
  assert.equal(health.headers['x-content-type-options'], 'nosniff');
  assert.equal(health.headers['x-frame-options'], 'DENY');

  // 10 logins/15min are allowed; the 11th from the same IP must be 429.
  let last;
  for (let i = 0; i < 12; i++) {
    last = await request(port, 'POST', '/api/auth/login', { 'content-type': 'application/json' });
  }
  assert.equal(last.status, 429);
  assert.ok(last.headers['retry-after']);
});
