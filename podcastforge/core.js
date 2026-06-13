/* ============================================================
   PodcastForge — Core / Backend Client
   The single seam that stitches frontend ↔ backend together.

   Loads BEFORE app.js. It probes for a backend; if one is running
   it owns auth, key storage, plan/usage and AI calls (the server
   does the provider fetch — so NVIDIA/OpenAI work and keys never
   sit in the page after login). If no backend is present, the app
   falls back to its original in-browser BYOK demo behaviour.

   Exposes window.PF:
     PF.ready            Promise<boolean>  (true if backend reachable)
     PF.hasBackend()     bool
     PF.isAuthed()       bool
     PF.session          { token, user } | null
     PF.signup/login/logout/refreshMe
     PF.saveKey/listKeys
     PF.callAI(system,user,provider) -> Promise<string>   (backend path)
   ============================================================ */
(function () {
  'use strict';

  const TOKEN_KEY = 'pf_token';
  const state = { backend: false, token: localStorage.getItem(TOKEN_KEY) || null, user: null, oauth: { google: false, github: false } };

  // Capture an OAuth result handed back in the URL (?auth=token or ?auth_error=msg),
  // store the session, then scrub it from the address bar.
  let pendingAuthError = null;
  let justAuthed = false;
  (function captureOAuthReturn() {
    try {
      const u = new URL(window.location.href);
      // Token/error arrive in the URL fragment (never sent to servers/Referer).
      const hash = u.hash && u.hash.length > 1 ? new URLSearchParams(u.hash.slice(1)) : new URLSearchParams('');
      const tok = hash.get('auth');
      const err = hash.get('auth_error');
      if (tok || err) {
        if (tok) { state.token = tok; localStorage.setItem(TOKEN_KEY, tok); justAuthed = true; }
        if (err) pendingAuthError = err;
        history.replaceState({}, '', u.pathname + (u.search ? u.search : ''));
      }
    } catch (e) { /* non-browser / malformed */ }
  })();

  async function api(pathname, { method = 'GET', body, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && state.token) headers['Authorization'] = `Bearer ${state.token}`;
    const res = await fetch(pathname, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let data = {};
    try { data = await res.json(); } catch (e) { /* non-JSON */ }
    if (!res.ok) throw new Error(data.error || `Request failed (HTTP ${res.status})`);
    return data;
  }

  const PF = {
    session: null,
    hasBackend: () => state.backend,
    isAuthed: () => !!(state.backend && state.token && state.user),
    oauthEnabled: (p) => !!state.oauth[p],
    authError: () => pendingAuthError,
    justAuthenticated: () => justAuthed,
    startOAuth: (provider) => { window.location.href = `/api/auth/${String(provider).toLowerCase()}`; },

    async signup(email, password) {
      const d = await api('/api/auth/signup', { method: 'POST', auth: false, body: { email, password } });
      _setSession(d.token, d.user);
      return d.user;
    },
    async login(email, password) {
      const d = await api('/api/auth/login', { method: 'POST', auth: false, body: { email, password } });
      _setSession(d.token, d.user);
      return d.user;
    },
    logout() {
      state.token = null; state.user = null; PF.session = null;
      localStorage.removeItem(TOKEN_KEY);
    },
    async refreshMe() {
      if (!state.token) return null;
      try {
        const d = await api('/api/auth/me');
        state.user = d.user; PF.session = { token: state.token, user: d.user };
        return d.user;
      } catch (e) {
        PF.logout();
        return null;
      }
    },
    async saveKey(key) {
      const d = await api('/api/keys', { method: 'POST', body: { key } });
      if (state.user) state.user.providers = d.providers;
      return d.provider;
    },
    async listKeys() {
      const d = await api('/api/keys');
      return d.providers;
    },
    async upgrade(plan) {
      const d = await api('/api/billing/checkout', { method: 'POST', body: { plan } });
      if (d.user) { state.user = d.user; PF.session = { token: state.token, user: d.user }; }
      return d.user;
    },
    async callAI(systemPrompt, userPrompt, provider, feature) {
      const d = await api('/api/ai', { method: 'POST', body: { systemPrompt, userPrompt, provider, feature } });
      if (state.user && d.usage) state.user.usage = d.usage;
      return d.text;
    }
  };

  function _setSession(token, user) {
    state.token = token; state.user = user;
    PF.session = { token, user };
    localStorage.setItem(TOKEN_KEY, token);
  }

  // Probe for a backend, then validate any saved token.
  PF.ready = (async () => {
    try {
      const res = await fetch('/api/health', { method: 'GET' });
      state.backend = res.ok;
      if (res.ok) {
        const h = await res.json().catch(() => ({}));
        if (h.oauth) state.oauth = h.oauth;
      }
    } catch (e) {
      state.backend = false;
    }
    if (state.backend && state.token) await PF.refreshMe();
    return state.backend;
  })();

  window.PF = PF;
})();
