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
const oauth = require('./lib/oauth');
const { safeFetchText } = require('./lib/safefetch');
const rss = require('./lib/rss');

// Conservative NSFW guard for pulled podcasts (in addition to the iTunes/RSS
// explicit flags). Kept tight to avoid flagging legitimate shows.
const NSFW_TERMS = ['xxx', 'hardcore porn', 'pornhub', 'onlyfans', 'nsfw', 'explicit sex', 'erotica', 'camgirl', 'fetish'];
const NSFW_CATEGORIES = ['sexually explicit', 'adult'];
function looksNSFW(text) {
  const t = String(text || '').toLowerCase();
  return NSFW_TERMS.some(w => t.includes(w));
}

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..');           // serves podcastforge/
const MAX_BODY = 200 * 1024;                              // 200 KB JSON cap
const FREE_DAILY_LIMIT = 5;
const TRIAL_DAYS = 15;

// Per-feature daily caps for the FREE plan. trial/fixed/payg are unlimited.
// Each unit is one AI call: the Miner makes one call per transcript section,
// so its cap is measured in sections; Generator/Studio/Tracker are 1 call each.
const FREE_LIMITS = { generate: 5, studio: 5, miner: 10, tracker: 2, agent: 8, music: 5, chat: 15 };
const FEATURES = Object.keys(FREE_LIMITS);
const FEATURE_LABEL = { generate: 'content generation', studio: 'Script Studio', miner: 'the Content Miner', tracker: 'the AI Stack audit', agent: 'the Auto-Repurpose agent', music: 'the Music Brief', chat: 'the chat assistant' };

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

async function authUser(req) {
  const h = req.headers['authorization'] || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const uid = sec.verifyToken(token);
  return uid ? await store.getUserById(uid) : null;
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

// Per-feature daily usage helpers (reset each day)
function featureUsageToday(user) {
  const t = today();
  const fu = user.featureUsage && user.featureUsage.date === t ? user.featureUsage : { date: t };
  const out = {};
  FEATURES.forEach(f => { out[f] = fu[f] || 0; });
  return out;
}
function featureCount(user, feature) {
  const t = today();
  if (!user.featureUsage || user.featureUsage.date !== t) return 0;
  return user.featureUsage[feature] || 0;
}
function bumpFeature(user, feature) {
  const t = today();
  if (!user.featureUsage || user.featureUsage.date !== t) user.featureUsage = { date: t };
  user.featureUsage[feature] = (user.featureUsage[feature] || 0) + 1;
}
// Activity + billing history (newest first, capped). The preview is the user's
// own prompt snippet, shown only back to them.
function pushHistory(user, rec) {
  user.history = Array.isArray(user.history) ? user.history : [];
  user.history.unshift(rec);
  if (user.history.length > 50) user.history.length = 50;
}
function pushTransaction(user, rec) {
  user.transactions = Array.isArray(user.transactions) ? user.transactions : [];
  user.transactions.unshift(rec);
  if (user.transactions.length > 50) user.transactions.length = 50;
}

// Public view of a user — never leaks password hash or stored keys
function publicUser(user) {
  const plan = effectivePlan(user);
  const usage = featureUsageToday(user);
  return {
    id: user.id,
    email: user.email,
    plan,
    daysLeft: daysLeft(user),
    usage,                       // { generate, studio, miner, tracker } counts today
    freeLimits: FREE_LIMITS,     // caps that apply on the free plan
    usageToday: usage.generate,  // back-compat for existing UI
    freeLimit: FREE_LIMITS.generate,
    providers: Object.keys(user.keys || {})
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---- route handlers ---- */
async function handleSignup(req, res) {
  const { email, password } = await readBody(req);
  if (!EMAIL_RE.test(String(email || ''))) throw { status: 400, message: 'Enter a valid email address.' };
  if (String(password || '').length < 8) throw { status: 400, message: 'Password must be at least 8 characters.' };
  if (await store.getUserByEmail(email)) throw { status: 409, message: 'An account with that email already exists.' };

  const user = await store.createUser({
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
  const user = await store.getUserByEmail(email);
  // Same generic message whether the email is unknown or the password is wrong
  if (!user || !sec.verifyPassword(password, user.password)) {
    throw { status: 401, message: 'Invalid email or password.' };
  }
  sendJSON(res, 200, { token: sec.signToken(user.id), user: publicUser(user) });
}

function handleMe(req, res, user) {
  sendJSON(res, 200, { user: publicUser(user) });
}

function handleAccount(req, res, user) {
  sendJSON(res, 200, {
    user: publicUser(user),
    history: (user.history || []).slice(0, 30),
    transactions: (user.transactions || []).slice(0, 30)
  });
}

async function handleSaveKey(req, res, user) {
  const { key } = await readBody(req);
  const k = String(key || '').trim();
  if (k.length < 8 || k.length > 400) throw { status: 400, message: 'That does not look like a valid API key.' };
  const provider = providers.detectProvider(k);
  user.keys = user.keys || {};
  user.keys[provider] = sec.encryptKey(k);
  await store.saveUser(user);
  sendJSON(res, 200, { provider, providers: Object.keys(user.keys) });
}

function handleListKeys(req, res, user) {
  sendJSON(res, 200, { providers: Object.keys(user.keys || {}) });
}

// Podcast discovery via Apple's free iTunes Search API (no key). Done
// server-side to avoid CORS and to enforce a content filter centrally:
// explicit-flagged shows are dropped so users can't pull NSFW podcasts.
// List episodes from a podcast RSS feed that have transcripts available.
async function handlePodcastEpisodes(req, res, user, query) {
  const feedUrl = String(query.feedUrl || '').trim();
  if (!feedUrl) throw { status: 400, message: 'Provide a podcast RSS feed URL.' };
  const { text } = await safeFetchText(feedUrl, { maxBytes: 5 * 1024 * 1024, timeoutMs: 15000 });
  const feed = rss.parseFeed(text);

  // Whole-feed NSFW gate
  if (feed.explicit || feed.categories.some(c => NSFW_CATEGORIES.includes(c.toLowerCase())) || looksNSFW(feed.title)) {
    throw { status: 451, message: 'This podcast is marked explicit/adult and can’t be pulled here.' };
  }

  const episodes = feed.items
    .filter(it => !it.explicit && !looksNSFW(it.title) && !looksNSFW(it.description))
    .slice(0, 25)
    .map(it => ({
      title: it.title,
      description: it.description,
      pubDate: it.pubDate,
      hasTranscript: !!it.transcriptUrl,
      transcriptUrl: it.transcriptUrl,
      transcriptType: it.transcriptType
    }));

  sendJSON(res, 200, { podcast: { title: feed.title }, episodes, withTranscript: episodes.filter(e => e.hasTranscript).length });
}

// Fetch one transcript file and return clean plain text.
async function handlePodcastTranscript(req, res, user, query) {
  const url = String(query.url || '').trim();
  if (!url) throw { status: 400, message: 'No transcript URL provided.' };
  const { text, contentType } = await safeFetchText(url, { maxBytes: 8 * 1024 * 1024, timeoutMs: 20000 });
  const plain = rss.transcriptToText(text, contentType);
  if (!plain || plain.length < 20) throw { status: 422, message: 'No readable transcript found at that URL.' };
  if (looksNSFW(plain.slice(0, 4000))) throw { status: 451, message: 'This transcript was flagged as explicit and was blocked.' };
  sendJSON(res, 200, { text: plain.slice(0, 200000) });
}

async function handleDiscover(req, res, user, query) {
  const term = String(query.term || '').trim().slice(0, 120);
  const genre = String(query.genre || '').trim().slice(0, 40);
  const q = [genre, term].filter(Boolean).join(' ').trim();
  if (!q) throw { status: 400, message: 'Enter a search term.' };

  const url = `https://itunes.apple.com/search?media=podcast&entity=podcast&limit=24&term=${encodeURIComponent(q)}`;
  let data;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
    data = await r.json();
  } catch (e) {
    throw { status: 502, message: 'Podcast search is unavailable right now. Try again shortly.' };
  }

  const results = (Array.isArray(data.results) ? data.results : [])
    .filter(p => p.collectionExplicitness !== 'explicit' && p.trackExplicitness !== 'explicit')
    .map(p => ({
      name: p.collectionName || p.trackName || '',
      artist: p.artistName || '',
      genre: p.primaryGenreName || '',
      artwork: p.artworkUrl600 || p.artworkUrl100 || '',
      feedUrl: p.feedUrl || '',
      link: p.collectionViewUrl || p.trackViewUrl || '',
      episodes: p.trackCount || 0
    }));
  sendJSON(res, 200, { results, filtered: (data.resultCount || 0) - results.length });
}

async function handleDeleteKey(req, res, user, provider) {
  if (user.keys && user.keys[provider]) { delete user.keys[provider]; await store.saveUser(user); }
  sendJSON(res, 200, { ok: true, providers: Object.keys(user.keys || {}) });
}

async function handleAI(req, res, user) {
  const plan = effectivePlan(user);
  if (plan === 'expired') throw { status: 402, message: 'Your trial has ended. Choose a plan to keep generating.' };

  const { systemPrompt, userPrompt, provider: wanted, feature: rawFeature } = await readBody(req);
  const feature = FEATURES.includes(rawFeature) ? rawFeature : 'generate';

  // Per-feature daily cap on the free plan (trial/paid are unlimited).
  if (plan === 'free' && featureCount(user, feature) >= FREE_LIMITS[feature]) {
    throw { status: 429, message: `Daily free limit reached for ${FEATURE_LABEL[feature]} (${FREE_LIMITS[feature]}/day). Upgrade for unlimited.` };
  }

  if (typeof userPrompt !== 'string' || !userPrompt.trim()) throw { status: 400, message: 'userPrompt is required.' };
  if (userPrompt.length > 60000) throw { status: 400, message: 'Prompt is too long.' };

  const available = Object.keys(user.keys || {});
  if (available.length === 0) throw { status: 400, message: 'No API key on file. Add one in the workspace first.' };
  const provider = (wanted && user.keys[wanted]) ? wanted : available[0];
  const key = sec.decryptKey(user.keys[provider]);
  if (!key) throw { status: 500, message: 'Stored key could not be read. Please re-enter it.' };

  // The actual provider fetch happens server-side (no CORS limits)
  const text = await providers.callAI(provider, key, String(systemPrompt || ''), String(userPrompt));

  // Count usage on success (free plan) and record a history entry (all plans).
  if (plan === 'free') bumpFeature(user, feature);
  pushHistory(user, { feature, at: new Date().toISOString(), preview: String(userPrompt).replace(/\s+/g, ' ').slice(0, 80) });
  await store.saveUser(user);
  sendJSON(res, 200, { text, provider, feature, usage: featureUsageToday(user) });
}

async function handleCheckout(req, res, user) {
  const body = await readBody(req);
  const { plan } = body;
  if (!['fixed', 'payg', 'free'].includes(plan)) throw { status: 400, message: 'Unknown plan.' };

  // Downgrading to free needs no payment. Paid plans require verification
  // whenever billing is configured, so a user cannot self-grant a paid plan.
  const billingConfigured = !!process.env.RAZORPAY_KEY_SECRET;
  const isPaid = plan === 'fixed' || plan === 'payg';

  if (isPaid && billingConfigured) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw { status: 400, message: 'Payment verification details are required.' };
    }
    const expected = require('crypto')
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    const a = Buffer.from(razorpay_signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !require('crypto').timingSafeEqual(a, b)) {
      throw { status: 402, message: 'Payment could not be verified.' };
    }
  }

  user.plan = plan;
  pushTransaction(user, { plan, at: new Date().toISOString(), mock: !billingConfigured });
  await store.saveUser(user);
  sendJSON(res, 200, { ok: true, user: publicUser(user), mock: !billingConfigured });
}

/* ---- static file serving (path-traversal safe) ---- */
function serveStatic(req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent((req.url.split('?')[0]) || '/');
  } catch (e) {
    // malformed percent-encoding
    res.writeHead(400); res.end('Bad request'); return;
  }
  if (urlPath === '/') urlPath = '/index.html';
  // reject null bytes outright
  if (urlPath.includes('\0')) { res.writeHead(400); res.end('Bad request'); return; }
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

/* ---- OAuth (Google / GitHub) ----
   The OAuth origin is taken ONLY from the trusted APP_URL env var, never from
   request headers (Host / X-Forwarded-*). Deriving it from headers would let an
   attacker spoof Host and redirect the freshly minted session token to their
   own origin. OAuth is therefore unavailable unless APP_URL is set. */
function oauthOrigin() {
  return process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, '') : null;
}
function oauthReady(provider) {
  return oauth.isConfigured(provider) && !!oauthOrigin();
}

function handleOAuthStart(req, res, provider) {
  if (!oauthReady(provider)) {
    return sendJSON(res, 400, { error: `${provider} login is not enabled on this server (set ${provider.toUpperCase()}_CLIENT_ID/SECRET and APP_URL).` });
  }
  const redirectUri = `${oauthOrigin()}/api/auth/${provider}/callback`;
  const state = sec.signData({ p: provider }, 600); // signed + 10-min expiry (CSRF)
  res.writeHead(302, { Location: oauth.authorizeUrl(provider, redirectUri, state), 'Cache-Control': 'no-store' });
  res.end();
}

// On any failure, bounce back to the app with an error flag in the fragment
// (fragments are never sent to servers, so nothing leaks in logs/Referer).
function oauthFail(res, msg) {
  res.writeHead(302, {
    Location: `${oauthOrigin() || ''}/#auth_error=${encodeURIComponent(msg)}`,
    'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer'
  });
  res.end();
}

async function findOrCreateOAuthUser(provider, email, providerId) {
  let user = await store.getUserByEmail(email);
  if (!user) {
    user = await store.createUser({
      id: sec.newId(),
      email: store.normEmail(email),
      oauth: { [provider]: providerId },
      plan: null,
      createdAt: new Date().toISOString(),
      usage: { date: today(), count: 0 },
      keys: {}
    });
  } else if (!user.oauth || user.oauth[provider] !== providerId) {
    // link this provider to the existing account (same verified email)
    user.oauth = Object.assign({}, user.oauth, { [provider]: providerId });
    await store.saveUser(user);
  }
  return user;
}

async function handleOAuthCallback(req, res, provider, query) {
  if (!oauthReady(provider)) return oauthFail(res, 'Login not configured.');
  if (query.error) return oauthFail(res, query.error_description || query.error);
  const st = sec.verifyData(query.state);
  if (!st || st.p !== provider || !query.code) return oauthFail(res, 'Login session expired, please try again.');

  try {
    const redirectUri = `${oauthOrigin()}/api/auth/${provider}/callback`;
    const accessToken = await oauth.exchangeCode(provider, query.code, redirectUri);
    const { email, providerId } = await oauth.fetchProfile(provider, accessToken);
    const user = await findOrCreateOAuthUser(provider, email, providerId);
    const token = sec.signToken(user.id);
    // Hand the session token back via the URL fragment (never sent to servers/
    // Referer); the SPA reads it from the hash, stores it, and scrubs the URL.
    res.writeHead(302, {
      Location: `${oauthOrigin()}/#auth=${token}`,
      'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer'
    });
    res.end();
  } catch (e) {
    oauthFail(res, e.message || 'Login failed.');
  }
}

/* ---- router ---- */
const server = http.createServer(async (req, res) => {
  const url = (req.url || '').split('?')[0];
  const method = req.method;

  if (!url.startsWith('/api/')) return serveStatic(req, res);

  const query = Object.fromEntries(new URLSearchParams((req.url.split('?')[1] || '')));

  try {
    if (url === '/api/health' && method === 'GET') {
      return sendJSON(res, 200, {
        ok: true,
        providers: Object.keys(providers.PROVIDER_MODELS),
        oauth: { google: oauthReady('google'), github: oauthReady('github') }
      });
    }
    if (url === '/api/auth/signup' && method === 'POST') return await handleSignup(req, res);
    if (url === '/api/auth/login' && method === 'POST') return await handleLogin(req, res);

    // ----- OAuth (unauthenticated) -----
    let m = url.match(/^\/api\/auth\/(google|github)$/);
    if (m && method === 'GET') return handleOAuthStart(req, res, m[1]);
    m = url.match(/^\/api\/auth\/(google|github)\/callback$/);
    if (m && method === 'GET') return await handleOAuthCallback(req, res, m[1], query);

    // ----- everything below requires auth -----
    const user = await authUser(req);
    if (!user) throw { status: 401, message: 'Please sign in.' };

    if (url === '/api/keys/' && method === 'DELETE') throw { status: 400, message: 'Provider required.' };

    if (url === '/api/auth/me' && method === 'GET') return handleMe(req, res, user);
    if (url === '/api/account' && method === 'GET') return handleAccount(req, res, user);
    if (url === '/api/keys' && method === 'GET') return handleListKeys(req, res, user);
    if (url === '/api/keys' && method === 'POST') return await handleSaveKey(req, res, user);
    if (url.startsWith('/api/keys/') && method === 'DELETE') {
      return await handleDeleteKey(req, res, user, decodeURIComponent(url.slice('/api/keys/'.length)));
    }
    if (url === '/api/discover' && method === 'GET') return await handleDiscover(req, res, user, query);
    if (url === '/api/podcast/episodes' && method === 'GET') return await handlePodcastEpisodes(req, res, user, query);
    if (url === '/api/podcast/transcript' && method === 'GET') return await handlePodcastTranscript(req, res, user, query);
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

// Production safety: refuse to boot without an explicit secret, so a redeploy
// can never silently rotate it and invalidate every stored key + session.
if (process.env.NODE_ENV === 'production' && !process.env.PF_SECRET) {
  console.error('[fatal] NODE_ENV=production but PF_SECRET is not set. Refusing to start.');
  console.error('        Set PF_SECRET to a long random string (e.g. `openssl rand -hex 32`).');
  process.exit(1);
}

async function start() {
  try {
    await store.init();
    console.log(`[store] backend: ${store.usingPostgres ? 'Postgres (DATABASE_URL)' : 'JSON file (data/db.json)'}`);
  } catch (e) {
    console.error('[fatal] store init failed:', e.message);
    process.exit(1);
  }
  server.listen(PORT, () => {
    console.log(`PodcastForge backend on http://localhost:${PORT}`);
    console.log(`Serving frontend from ${PUBLIC_DIR}`);
  });
}

// Start unless being required by a test harness that drives init itself.
if (require.main === module) start();

module.exports = server;
module.exports.start = start;
