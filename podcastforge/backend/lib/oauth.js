/* ============================================================
   PodcastForge Backend — OAuth (Google + GitHub)
   Authorization-code flow, zero dependencies (built-in fetch).
   Credentials come from env; if a provider isn't configured its
   buttons are disabled in the UI and its endpoints return 400.
   ============================================================ */
'use strict';

const PROVIDERS = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    extraAuth: { access_type: 'online', prompt: 'select_account' }
  },
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
    extraAuth: {}
  }
};

function clientId(p) { return process.env[`${p.toUpperCase()}_CLIENT_ID`]; }
function clientSecret(p) { return process.env[`${p.toUpperCase()}_CLIENT_SECRET`]; }
function isConfigured(p) { return !!(PROVIDERS[p] && clientId(p) && clientSecret(p)); }

function authorizeUrl(provider, redirectUri, state) {
  const cfg = PROVIDERS[provider];
  const params = new URLSearchParams({
    client_id: clientId(provider),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: cfg.scope,
    state,
    ...cfg.extraAuth
  });
  return `${cfg.authUrl}?${params.toString()}`;
}

async function exchangeCode(provider, code, redirectUri) {
  const cfg = PROVIDERS[provider];
  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: new URLSearchParams({
      client_id: clientId(provider),
      client_secret: clientSecret(provider),
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    }).toString(),
    signal: AbortSignal.timeout(15000)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`Token exchange failed${data.error_description ? ': ' + data.error_description : ''}`);
  }
  return data.access_token;
}

// Returns { email, providerId, name } or throws.
async function fetchProfile(provider, accessToken) {
  if (provider === 'google') {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000)
    });
    const u = await r.json().catch(() => ({}));
    if (!r.ok || !u.email) throw new Error('Could not read Google profile.');
    if (u.email_verified === false) throw new Error('Your Google email is not verified.');
    return { email: u.email, providerId: String(u.sub), name: u.name || '' };
  }

  // github
  const r = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'PodcastForge', Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(15000)
  });
  const u = await r.json().catch(() => ({}));
  if (!r.ok || !u.id) throw new Error('Could not read GitHub profile.');
  let email = u.email;
  if (!email) {
    const er = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'PodcastForge', Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(15000)
    });
    const list = await er.json().catch(() => []);
    const primary = Array.isArray(list) ? list.find(e => e.primary && e.verified) || list.find(e => e.verified) : null;
    email = primary && primary.email;
  }
  if (!email) throw new Error('No verified email on your GitHub account.');
  return { email, providerId: String(u.id), name: u.name || u.login || '' };
}

module.exports = { PROVIDERS, isConfigured, authorizeUrl, exchangeCode, fetchProfile };
