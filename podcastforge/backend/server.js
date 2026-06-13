/* ============================================================
   PodcastForge Backend — HTTP server (zero dependencies)
   Run with:  node backend/server.js   (or: npm start)
   Serves the static frontend AND the API from one origin, so
   there is no frontend<->backend CORS to configure.

   Endpoints (all JSON unless noted):
     POST   /api/auth/signup     {email,password} -> {token,user}
     POST   /api/auth/login      {email,password} -> {token,user}
     GET    /api/auth/me                          -> {user}
     GET    /api/keys                             -> {providers:[...]}
     POST   /api/keys            {key}            -> {provider}
     DELETE /api/keys/:provider                   -> {ok}
     POST   /api/ai   {systemPrompt,userPrompt,provider?} -> {text}
     POST   /api/billing/checkout {plan}          -> {ok} | razorpay order
     GET    /api/health                           -> {ok,providers}
   ============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const sec = require('./lib/security');
const store = require('./lib/store');
const providers = require('./lib/providers');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..');           // serves podcastforge/
const MAX_BODY = 200 * 1024;                              // 200 KB JSON cap
const FREE_DAILY_LIMIT = 5;
const TRIAL_DAYS = 15;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.map': 'application/json'
};

/* ---- helpers ---- */
function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject({ status: 413, message: 'Request body too large.' }); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch (e) { reject({ status: 400, message: 'Invalid JSON body.' }); }
    });
    req.on('error', () => reject({ status: 400, message: 'Request error.' }));
  });
}

function authUser(req) {
  const h = req.headers['authorization'] || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const uid = sec.verifyToken(token);
  return uid ? store.getUserById(uid) : null;
}

const today = () => new Date().toISOString().split('T')[0];

function effectivePlan(user) {
  if (user.plan === 'fixed' || user.plan === 'payg') return user.plan;
  if (user.plan === 'free') return 'free';
  if (user.plan === 'expired') return 'expired';
  // trial / unset: derive from signup date
  const days = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86400000);
  return days < TRIAL_DAYS ? 'trial' : 'expired';
}

function daysLeft(user) {
  const days = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86400000);
  return Math.max(0, TRIAL_DAYS - days);
}

// Public view of a user — never leaks password hash or stored keys
function publicUser(user) {
  const plan = effectivePlan(user);
  const usage = user.usage && user.usage.date === today() ? user.usage.count : 0;
  return {
    id: user.id,
    email: user.email,
    plan,
    daysLeft: daysLeft(user),
    usageToday: usage,
    freeLimit: FREE_DAILY_LIMIT,
    providers: Object.keys(user.keys || {})
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---- route handlers ---- */
async function handleSignup(req, res) {
  const { email, password } = await readBody(req);
  if (!EMAIL_RE.test(String(email || ''))) throw { status: 400, message: 'Enter a valid email address.' };
  if (String(password || '').length < 8) throw { status: 400, message: 'Password must be at least 8 characters.' };
  if (store.getUserByEmail(email)) throw { status: 409, message: 'An account with that email already exists.' };

  const user = store.createUser({
    id: sec.newId(),
    email: store.normEmail(email),
    password: sec.hashPassword(password),
    plan: null,                       // null => trial, derived from createdAt
    createdAt: new Date().toISOString(),
    usage: { date: today(), count: 0 },
    keys: {}                          // { provider: encryptedBlob }
  });
  sendJSON(res, 201, { token: sec.signToken(user.id), user: publicUser(user) });
}

async function handleLogin(req, res) {
  const { email, password } = await readBody(req);
  const user = store.getUserByEmail(email);
  // Same generic message whether the email is unknown or the password is wrong
  if (!user || !sec.verifyPassword(password, user.password)) {
    throw { status: 401, message: 'Invalid email or password.' };
  }
  sendJSON(res, 200, { token: sec.signToken(user.id), user: publicUser(user) });
}

function handleMe(req, res, user) {
  sendJSON(res, 200, { user: publicUser(user) });
}

async function handleSaveKey(req, res, user) {
  const { key } = await readBody(req);
  const k = String(key || '').trim();
  if (k.length < 8 || k.length > 400) throw { status: 400, message: 'That does not look like a valid API key.' };
  const provider = providers.detectProvider(k);
  user.keys = user.keys || {};
  user.keys[provider] = sec.encryptKey(k);
  store.saveUser(user);
  sendJSON(res, 200, { provider, providers: Object.keys(user.keys) });
}

function handleListKeys(req, res, user) {
  sendJSON(res, 200, { providers: Object.keys(user.keys || {}) });
}

function handleDeleteKey(req, res, user, provider) {
  if (user.keys && user.keys[provider]) { delete user.keys[provider]; store.saveUser(user); }
  sendJSON(res, 200, { ok: true, providers: Object.keys(user.keys || {}) });
}

async function handleAI(req, res, user) {
  const plan = effectivePlan(user);
  if (plan === 'expired') throw { status: 402, message: 'Your trial has ended. Choose a plan to keep generating.' };

  if (plan === 'free') {
    const used = user.usage && user.usage.date === today() ? user.usage.count : 0;
    if (used >= FREE_DAILY_LIMIT) {
      throw { status: 429, message: `Daily free limit reached (${FREE_DAILY_LIMIT}/${FREE_DAILY_LIMIT}). Upgrade to continue.` };
    }
  }

  const { systemPrompt, userPrompt, provider: wanted } = await readBody(req);
  if (typeof userPrompt !== 'string' || !userPrompt.trim()) throw { status: 400, message: 'userPrompt is required.' };
  if (userPrompt.length > 60000) throw { status: 400, message: 'Prompt is too long.' };

  const available = Object.keys(user.keys || {});
  if (available.length === 0) throw { status: 400, message: 'No API key on file. Add one in the workspace first.' };
  const provider = (wanted && user.keys[wanted]) ? wanted : available[0];
  const key = sec.decryptKey(user.keys[provider]);
  if (!key) throw { status: 500, message: 'Stored key could not be read. Please re-enter it.' };

  // The actual provider fetch happens server-side (no CORS limits)
  const text = await providers.callAI(provider, key, String(systemPrompt || ''), String(userPrompt));

  // Count usage only on success, only for the free plan
  if (plan === 'free') {
    const t = today();
    user.usage = user.usage && user.usage.date === t ? user.usage : { date: t, count: 0 };
    user.usage.count++;
    store.saveUser(user);
  }
  sendJSON(res, 200, { text, provider, usageToday: user.usage ? user.usage.count : 0 });
}

async function handleCheckout(req, res, user) {
  const { plan } = await readBody(req);
  if (!['fixed', 'payg', 'free'].includes(plan)) throw { status: 400, message: 'Unknown plan.' };
  // Mock billing: in production verify a Razorpay signature here before upgrading.
  user.plan = plan;
  store.saveUser(user);
  sendJSON(res, 200, { ok: true, user: publicUser(user), mock: !process.env.RAZORPAY_KEY_SECRET });
}

/* ---- static file serving (path-traversal safe) ---- */
function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url.split('?')[0]) || '/');
  if (urlPath === '/') urlPath = '/index.html';
  // Resolve and confirm the result stays inside PUBLIC_DIR
  const resolved = path.resolve(PUBLIC_DIR, '.' + urlPath);
  if (resolved !== PUBLIC_DIR && !resolved.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  // Never serve the backend directory or dotfiles over static
  if (resolved.startsWith(path.join(PUBLIC_DIR, 'backend'))) { res.writeHead(404); res.end('Not found'); return; }
  fs.stat(resolved, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(resolved)] || 'application/octet-stream' });
    fs.createReadStream(resolved).pipe(res);
  });
}

/* ---- router ---- */
const server = http.createServer(async (req, res) => {
  const url = (req.url || '').split('?')[0];
  const method = req.method;

  if (!url.startsWith('/api/')) return serveStatic(req, res);

  try {
    if (url === '/api/health' && method === 'GET') {
      return sendJSON(res, 200, { ok: true, providers: Object.keys(providers.PROVIDER_MODELS) });
    }
    if (url === '/api/auth/signup' && method === 'POST') return await handleSignup(req, res);
    if (url === '/api/auth/login' && method === 'POST') return await handleLogin(req, res);

    // ----- everything below requires auth -----
    const user = authUser(req);
    if (!user) throw { status: 401, message: 'Please sign in.' };

    if (url === '/api/auth/me' && method === 'GET') return handleMe(req, res, user);
    if (url === '/api/keys' && method === 'GET') return handleListKeys(req, res, user);
    if (url === '/api/keys' && method === 'POST') return await handleSaveKey(req, res, user);
    if (url.startsWith('/api/keys/') && method === 'DELETE') {
      return handleDeleteKey(req, res, user, url.slice('/api/keys/'.length));
    }
    if (url === '/api/ai' && method === 'POST') return await handleAI(req, res, user);
    if (url === '/api/billing/checkout' && method === 'POST') return await handleCheckout(req, res, user);

    throw { status: 404, message: 'Unknown endpoint.' };
  } catch (e) {
    const status = e && e.status ? e.status : 500;
    const message = e && e.message ? e.message : 'Server error.';
    if (status >= 500) console.error('[server]', method, url, '->', e);
    sendJSON(res, status, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`PodcastForge backend on http://localhost:${PORT}`);
  console.log(`Serving frontend from ${PUBLIC_DIR}`);
});

module.exports = server;
