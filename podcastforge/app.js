/* ============================================================
   PodcastForge v2 — Main App Logic
   Auth, API Routing, Generation, and Chat
   ============================================================ */

const STORAGE_KEYS = {
  TRIAL_START: 'pf_trial_start',
  PLAN: 'pf_plan', // 'trial', 'free', 'fixed', 'payg'
  FREE_USAGE: 'pf_free_usage', // { date: 'YYYY-MM-DD', count: 0 }
  API_KEY: 'pf_api_key',
  CURRENCY: 'pf_currency' // 'USD' or 'INR'
};

// State
let appState = {
  plan: 'trial',
  daysLeft: 15,
  apiKey: '',
  currency: 'USD',
  provider: 'none'
};

// DOM Elements
const els = {
  apiKey: document.getElementById('api-key-input'),
  badge: document.getElementById('provider-badge'),
  transcript: document.getElementById('transcript'),
  btnGen: document.getElementById('btn-generate'),
  btnCopy: document.getElementById('btn-copy'),
  charCount: document.getElementById('char-count'),

  // Tabs
  tabs: document.querySelectorAll('.tab-btn'),
  panes: document.querySelectorAll('.tab-pane'),
  outEmpty: document.getElementById('output-empty'),
  outLoading: document.getElementById('output-loading'),
  outActions: document.getElementById('output-actions'),

  // Tools
  toolGrammar: document.getElementById('btn-tool-grammar'),
  toolSpelling: document.getElementById('btn-tool-spelling'),
  toolImprove: document.getElementById('btn-tool-improve'),
  toolsLock: document.getElementById('tools-lock'),

  // Chat
  chatHistory: document.getElementById('chat-history'),
  chatInput: document.getElementById('chat-input'),
  chatSend: document.getElementById('btn-chat-send'),

  // Modals & UI
  paywall: document.getElementById('paywall-modal'),
  toast: document.getElementById('toast'),
  navTrial: document.getElementById('nav-trial-badge'),
  navPlan: document.getElementById('nav-plan-badge'),
  statusBar: document.getElementById('status-bar')
};

/* ── Security: HTML escaping for any dynamic content ── */
// All AI output and user input MUST pass through this before
// being placed in innerHTML, otherwise we are open to XSS.
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.escapeHTML = escapeHTML;

/* ── Auth & Plan Management ──────────────────────── */
function updateNavLinks(isWorkspace) {
  const landingOnly = document.querySelectorAll('.nav-landing-only');
  const workspaceOnly = document.querySelectorAll('.nav-workspace-only');
  const currencyToggle = document.getElementById('nav-currency-toggle');
  const planBadge = document.getElementById('nav-plan-badge');
  const trialBadge = document.getElementById('nav-trial-badge');
  const btnAuth = document.getElementById('btn-nav-auth');
  const btnSignout = document.getElementById('btn-nav-signout');
  const btnUpgrade = document.getElementById('btn-nav-upgrade');

  if (isWorkspace) {
    landingOnly.forEach(el => el.style.display = 'none');
    workspaceOnly.forEach(el => el.style.display = 'inline-block');
    if (currencyToggle) currencyToggle.style.display = 'flex';
    if (planBadge) planBadge.style.display = 'block';
    if (trialBadge && (appState.plan === 'trial' || appState.plan === 'expired')) {
      trialBadge.style.display = 'block';
    } else if (trialBadge) {
      trialBadge.style.display = 'none';
    }
    if (btnAuth) btnAuth.style.display = 'none';
    if (btnSignout) btnSignout.style.display = 'block';

    // Pro Upgrade button visibility
    const isFree = appState.plan === 'free' || appState.plan === 'expired';
    if (btnUpgrade) btnUpgrade.style.display = isFree ? 'block' : 'none';
  } else {
    landingOnly.forEach(el => el.style.display = 'inline-block');
    workspaceOnly.forEach(el => el.style.display = 'none');
    if (currencyToggle) currencyToggle.style.display = 'none';
    if (planBadge) planBadge.style.display = 'none';
    if (trialBadge) trialBadge.style.display = 'none';
    if (btnAuth) btnAuth.style.display = 'block';
    if (btnSignout) btnSignout.style.display = 'none';
    if (btnUpgrade) btnUpgrade.style.display = 'none';
  }
}

function initAuth() {
  // Currency
  appState.currency = localStorage.getItem(STORAGE_KEYS.CURRENCY) || 'USD';
  updateCurrencyUI();

  // API Key
  const savedKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
  if (savedKey) {
    els.apiKey.value = savedKey;
    appState.apiKey = savedKey;
    detectProvider();
  }

  // Trial / Plan
  let trialStart = localStorage.getItem(STORAGE_KEYS.TRIAL_START);
  if (!trialStart) {
    trialStart = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.TRIAL_START, trialStart);
  }

  let savedPlan = localStorage.getItem(STORAGE_KEYS.PLAN);

  const start = new Date(trialStart);
  const now = new Date();
  const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  appState.daysLeft = Math.max(0, 15 - diffDays);

  if (savedPlan) {
    appState.plan = savedPlan;
  } else {
    appState.plan = appState.daysLeft > 0 ? 'trial' : 'expired';
  }

  updateNavState();
  updateLocks();

  // View State Init
  const savedViewState = sessionStorage.getItem('pf_view_state') || (savedKey ? 'workspace' : 'landing');
  if (savedViewState === 'workspace') {
    document.body.classList.add('view-state-workspace', 'workspace-active');
    const landingEl = document.getElementById('landing-view');
    if (landingEl) landingEl.style.display = 'none';
    updateNavLinks(true);
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  } else {
    document.body.classList.remove('view-state-workspace', 'workspace-active');
    const landingEl = document.getElementById('landing-view');
    if (landingEl) landingEl.style.display = 'block';
    updateNavLinks(false);
    initLandingAnimations();
  }
}

function selectPlan(plan) {
  // Persist the plan server-side when logged in (server enforces it on every call).
  if (window.PF && PF.isAuthed()) {
    PF.upgrade(plan).then(() => syncBackendUser()).catch(e => showToast(e.message, 'error'));
  }
  localStorage.setItem(STORAGE_KEYS.PLAN, plan);
  appState.plan = plan;
  els.paywall.classList.remove('show');
  updateNavState();
  updateLocks();
  showToast(`Welcome to the ${plan.toUpperCase()} plan!`, 'success');

  const isLanding = sessionStorage.getItem('pf_view_state') === 'landing';
  if (isLanding) {
    setTimeout(() => {
      showAuthModal();
    }, 1000);
  }
}

function showPaywall() {
  els.paywall.classList.add('show');
}

function checkFreeUsage() {
  // When signed into the backend, the server is authoritative on per-feature caps.
  if (window.PF && PF.isAuthed()) return true;
  if (appState.plan !== 'free') return true;

  const today = new Date().toISOString().split('T')[0];
  let usage = JSON.parse(localStorage.getItem(STORAGE_KEYS.FREE_USAGE) || '{"date":"","count":0}');

  if (usage.date !== today) {
    usage = { date: today, count: 0 };
  }

  if (usage.count >= 5) {
    showToast("Daily free limit reached (5/5). Upgrade to continue.", "error");
    window.scrollTo({ top: document.getElementById('pricing').offsetTop, behavior: 'smooth' });
    return false;
  }
  return true;
}

function incrementFreeUsage() {
  if (appState.plan !== 'free') return;
  const today = new Date().toISOString().split('T')[0];
  let usage = JSON.parse(localStorage.getItem(STORAGE_KEYS.FREE_USAGE) || '{"date":"","count":0}');
  if (usage.date !== today) usage = { date: today, count: 0 };
  usage.count++;
  localStorage.setItem(STORAGE_KEYS.FREE_USAGE, JSON.stringify(usage));
  updateNavState();
}

/* ── UI Updates ──────────────────────────────────── */
function updateNavState() {
  // Badges
  if (appState.plan === 'trial' || appState.plan === 'expired') {
    els.navTrial.style.display = 'block';
    els.navTrial.textContent = `${appState.daysLeft}d trial`;
    if (appState.daysLeft <= 3) els.navTrial.classList.add('urgent');

    els.navPlan.className = 'plan-badge plan-trial';
    els.navPlan.textContent = 'TRIAL';

    if (appState.plan === 'trial') {
      els.statusBar.className = 'status-bar info';
      els.statusBar.innerHTML = `<span>⏱</span><div><strong>${appState.daysLeft} days left</strong> in your Free Pro trial. <a href="#pricing">View plans</a></div>`;
    } else {
      els.statusBar.className = 'status-bar dead';
      els.statusBar.innerHTML = `<span>⚠️</span><div><strong>Trial expired.</strong> Please choose a plan below to continue. <a href="#pricing">View plans</a></div>`;
    }
  } else {
    els.navTrial.style.display = 'none';
    els.navPlan.className = `plan-badge plan-${appState.plan === 'free' ? 'free' : 'pro'}`;
    els.navPlan.textContent = appState.plan.toUpperCase();

    if (appState.plan === 'free') {
      const today = new Date().toISOString().split('T')[0];
      let usage = JSON.parse(localStorage.getItem(STORAGE_KEYS.FREE_USAGE) || '{"date":"","count":0}');
      let count = usage.date === today ? usage.count : 0;
      els.statusBar.className = 'status-bar warn';
      els.statusBar.innerHTML = `<span>📊</span><div><strong>Free Plan:</strong> ${5 - count} of 5 generations remaining today. <a href="#pricing">Upgrade for unlimited</a></div>`;
    } else {
      els.statusBar.className = 'status-bar ok';
      els.statusBar.innerHTML = `<span>💎</span><div><strong>Pro Active:</strong> You have unlimited access.</div>`;
    }
  }
}

function updateLocks() {
  const isLanding = sessionStorage.getItem('pf_view_state') === 'landing';
  // Transcript AI tools are Pro-only (free has none). Miner + Tracker are
  // available on free with daily caps, so they're locked only when there's no
  // active session at all (expired trial, or viewing the landing page).
  const noAccess = appState.plan === 'expired' || isLanding;
  const transcriptLocked = noAccess || appState.plan === 'free';

  els.toolsLock.style.display = transcriptLocked ? 'flex' : 'none';
  const trackerLock = document.getElementById('tracker-lock');
  const minerLock = document.getElementById('miner-lock');
  const agentLock = document.getElementById('agent-lock');
  const musicLock = document.getElementById('music-lock');
  if (trackerLock) trackerLock.style.display = noAccess ? 'flex' : 'none';
  if (minerLock) minerLock.style.display = noAccess ? 'flex' : 'none';
  if (agentLock) agentLock.style.display = noAccess ? 'flex' : 'none';
  if (musicLock) musicLock.style.display = noAccess ? 'flex' : 'none';

  // Pro Upgrade button visibility in nav
  const isWorkspace = sessionStorage.getItem('pf_view_state') === 'workspace';
  const btnUpgrade = document.getElementById('btn-nav-upgrade');
  if (btnUpgrade) {
    btnUpgrade.style.display = (isWorkspace && (appState.plan === 'free' || appState.plan === 'expired')) ? 'block' : 'none';
  }
}

function updateCurrencyUI() {
  document.getElementById('btn-cur-usd').classList.toggle('active', appState.currency === 'USD');
  document.getElementById('btn-cur-inr').classList.toggle('active', appState.currency === 'INR');

  document.querySelectorAll('.price-cur').forEach(el => el.textContent = appState.currency === 'USD' ? '$' : '₹');
  document.querySelectorAll('.price-val').forEach(el => {
    el.textContent = el.getAttribute(appState.currency === 'USD' ? 'data-usd' : 'data-inr');
  });
  document.querySelectorAll('.btn-price-display').forEach(el => {
    el.textContent = appState.currency === 'USD' ? '$20' : '₹1990';
  });
}

function setCurrency(cur) {
  appState.currency = cur;
  localStorage.setItem(STORAGE_KEYS.CURRENCY, cur);
  updateCurrencyUI();
  // Dispatch event for tracker
  window.dispatchEvent(new Event('currency-changed'));
}

document.getElementById('btn-cur-usd').addEventListener('click', () => setCurrency('USD'));
document.getElementById('btn-cur-inr').addEventListener('click', () => setCurrency('INR'));

/* ── API Provider & Routing ──────────────────────── */
function detectProvider() {
  const key = appState.apiKey.trim();
  els.badge.className = 'provider-badge active';

  if (!key) {
    els.badge.className = 'provider-badge none';
    els.badge.textContent = 'No key detected';
    appState.provider = 'none';
  } else if (key.startsWith('sk-ant-')) {
    els.badge.textContent = '🟣 Anthropic Claude';
    els.badge.style.setProperty('--badge-color', '#a78bfa');
    appState.provider = 'anthropic';
  } else if (key.startsWith('AIza') || key.startsWith('AQ.')) {
    els.badge.textContent = '🔵 Google Gemini';
    els.badge.style.setProperty('--badge-color', '#38bdf8');
    appState.provider = 'gemini';
  } else if (key.startsWith('sk-or-')) {
    els.badge.textContent = '🟠 OpenRouter';
    els.badge.style.setProperty('--badge-color', '#fb923c');
    appState.provider = 'openrouter';
  } else if (key.startsWith('nvapi-')) {
    els.badge.textContent = '🟢 NVIDIA NIM';
    els.badge.style.setProperty('--badge-color', '#76b900');
    appState.provider = 'nvidia';
  } else if (key.startsWith('gsk_')) {
    els.badge.textContent = '🟠 Groq';
    els.badge.style.setProperty('--badge-color', '#f55036');
    appState.provider = 'groq';
  } else {
    els.badge.textContent = '⚪ OpenAI Compatible';
    els.badge.style.setProperty('--badge-color', '#10b981');
    appState.provider = 'openai';
  }
}

let keySaveTimer = null;
els.apiKey.addEventListener('input', (e) => {
  appState.apiKey = e.target.value;
  detectProvider();

  if (window.PF && PF.isAuthed()) {
    // Logged in: hand the key to the backend; don't persist plaintext in the browser.
    localStorage.removeItem(STORAGE_KEYS.API_KEY);
    clearTimeout(keySaveTimer);
    const val = appState.apiKey.trim();
    if (val.length >= 8) {
      keySaveTimer = setTimeout(() => {
        PF.saveKey(val)
          .then(p => showToast(`Key saved to your account (${p}).`, 'success'))
          .catch(err => showToast(err.message, 'error'));
      }, 800);
    }
  } else {
    localStorage.setItem(STORAGE_KEYS.API_KEY, appState.apiKey);
  }
});

// True if a generation can proceed: a typed key, or stored backend keys.
function hasUsableKey() {
  if (appState.apiKey && appState.apiKey.trim()) return true;
  if (window.PF && PF.isAuthed()) {
    const provs = PF.session.user.providers || [];
    return provs.length > 0;
  }
  return false;
}

// Mirror the backend user's plan/usage into appState + the existing UI.
function syncBackendUser() {
  if (!(window.PF && PF.isAuthed())) return;
  const u = PF.session.user;
  appState.plan = u.plan;
  appState.daysLeft = u.daysLeft;
  if (u.plan === 'free') {
    // bridge into the shape updateNavState already reads
    localStorage.setItem(STORAGE_KEYS.FREE_USAGE, JSON.stringify({
      date: new Date().toISOString().split('T')[0], count: u.usageToday || 0
    }));
  }
  // Reflect the account's stored keys in the provider badge — but never clobber
  // a key the user has just typed into the bar. Handles add / switch / remove.
  const provs = u.providers || [];
  if (!(appState.apiKey || '').trim()) {
    if (provs.length) {
      if (!provs.includes(appState.provider)) appState.provider = provs[0];
      els.badge.className = 'provider-badge active';
      els.badge.textContent = `🔒 Key stored (${appState.provider})`;
      els.badge.style.setProperty('--badge-color', '#10b981');
      els.apiKey.placeholder = 'Key stored securely on your account — paste a new one to replace it';
    } else {
      appState.provider = 'none';
      els.badge.className = 'provider-badge none';
      els.badge.textContent = 'No key detected';
      els.apiKey.placeholder = 'Paste your Anthropic, Gemini, OpenRouter, OpenAI, Groq, or NVIDIA API key here...';
    }
  }

  // Pull the signed-in identity into the nav (user ID surfaced in the title).
  const chip = document.getElementById('nav-account');
  if (chip) {
    chip.style.display = 'inline-flex';
    chip.textContent = u.email;
    chip.title = `User ID: ${u.id}`;
  }
  // Engine directive: show that the engine runs server-side under this account.
  const note = document.getElementById('api-key-note');
  if (note) {
    const provs = u.providers || [];
    note.innerHTML = `⚙️ <strong>Engine ready</strong> — signed in as ${escapeHTML(u.email)}. `
      + (provs.length
        ? `Requests run on our server under your account using your stored ${provs.map(escapeHTML).join(', ')} key${provs.length > 1 ? 's' : ''}.`
        : `Add an API key above and it’s stored on your account, not in this browser.`);
  }

  updateNavState();
  updateLocks();
}

/* ── The Unified AI Caller ─────────────────────────
   Per-provider model fallback chains. The first model is the
   preferred one; later entries are used when the provider
   returns 404 (model retired / not available for this key).
   Keeping these current is what prevents the 404 errors. */
const PROVIDER_MODELS = {
  anthropic: ['claude-sonnet-4-5', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'],
  gemini: ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite'],
  openrouter: ['google/gemini-2.5-flash', 'meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-chat-v3-0324:free'],
  nvidia: ['meta/llama-3.3-70b-instruct', 'meta/llama-3.1-70b-instruct', 'mistralai/mixtral-8x22b-instruct-v0.1'],
  openai: ['gpt-4o', 'gpt-4o-mini']
};

const PROVIDER_LABELS = {
  anthropic: 'Anthropic', gemini: 'Google Gemini', openrouter: 'OpenRouter',
  nvidia: 'NVIDIA NIM', openai: 'OpenAI'
};

function buildRequest(provider, model, key, systemPrompt, userPrompt) {
  if (provider === 'anthropic') {
    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        // Official header that enables CORS for direct browser calls
        'anthropic-dangerous-direct-browser-access': 'true',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    };
  }

  if (provider === 'gemini') {
    return {
      // Key goes in the x-goog-api-key header, never in the URL —
      // query-string keys leak into logs, history, and referrers.
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 4000 }
      })
    };
  }

  if (provider === 'openrouter') {
    return {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'PodcastForge'
      },
      body: JSON.stringify({
        model,
        // Server-side fallback routing if the primary model is unavailable
        models: PROVIDER_MODELS.openrouter.filter(m => m !== model),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.6,
        max_tokens: 4000
      })
    };
  }

  if (provider === 'nvidia') {
    return {
      url: 'https://integrate.api.nvidia.com/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.5,
        max_tokens: 4000
      })
    };
  }

  // Standard OpenAI compatible fallback
  return {
    url: 'https://api.openai.com/v1/chat/completions',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  };
}

function extractText(provider, data) {
  if (provider === 'anthropic') {
    const block = (data.content || []).find(c => c.type === 'text');
    if (!block) throw new Error('Anthropic returned no text content.');
    return block.text;
  }
  if (provider === 'gemini') {
    const cand = data.candidates && data.candidates[0];
    const text = cand && cand.content && cand.content.parts &&
      cand.content.parts.map(p => p.text || '').join('');
    if (!text) {
      const reason = (cand && cand.finishReason) || (data.promptFeedback && data.promptFeedback.blockReason);
      throw new Error(`Gemini returned no text${reason ? ` (${reason})` : ''}. Try a shorter transcript.`);
    }
    return text;
  }
  const msg = data.choices && data.choices[0] && data.choices[0].message;
  if (!msg || typeof msg.content !== 'string' || !msg.content.length) {
    throw new Error('The provider returned an empty response. Please retry.');
  }
  return msg.content;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function retryDelayMs(response, attempt) {
  // Honour Retry-After if the provider sends it, else exponential backoff + jitter
  const ra = response && response.headers && response.headers.get('retry-after');
  if (ra) {
    const secs = parseFloat(ra);
    if (!isNaN(secs)) return Math.min(secs * 1000, 30000);
  }
  return Math.min(2000 * Math.pow(2, attempt), 16000) + Math.random() * 500;
}

function friendlyNetworkError(provider) {
  const label = PROVIDER_LABELS[provider] || 'the provider';
  if (provider === 'nvidia') {
    return 'NVIDIA NIM blocks direct browser requests (no CORS headers). Use a Gemini, OpenRouter, or Anthropic key here, or route NVIDIA calls through your own small backend proxy. (Never send your key through public CORS proxies — they can steal it.)';
  }
  return `Could not reach ${label}. Check your internet connection, an ad-blocker/extension may be blocking the request, or the provider may not allow browser (CORS) calls from this origin.`;
}

async function callAI(systemPrompt, userPrompt, feature) {
  // Backend path: the server holds the key and performs the provider fetch
  // (server-to-server, so every provider works — including NVIDIA/OpenAI).
  // `feature` (generate|studio|miner|tracker) drives the free-plan daily caps.
  if (window.PF && PF.isAuthed()) {
    const prov = appState.provider !== 'none' ? appState.provider : undefined;
    return PF.callAI(systemPrompt, userPrompt, prov, feature || 'generate');
  }

  const key = appState.apiKey.trim();
  if (!key) throw new Error('API key required');

  const provider = appState.provider;
  const models = PROVIDER_MODELS[provider] || PROVIDER_MODELS.openai;
  const label = PROVIDER_LABELS[provider] || 'Provider';
  const MAX_RETRIES = 3; // per model, for 429/5xx
  let lastError = null;

  for (let m = 0; m < models.length; m++) {
    const model = models[m];
    const { url, headers, body } = buildRequest(provider, model, key, systemPrompt, userPrompt);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      let response;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 90000);
      try {
        response = await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
      } catch (networkErr) {
        clearTimeout(timer);
        if (networkErr.name === 'AbortError') {
          lastError = new Error(`${label} request timed out after 90s. Try a shorter transcript.`);
        } else {
          // CORS / offline — retrying the same way won't help, and we
          // intentionally do NOT fall back to third-party CORS proxies:
          // they would receive your API key.
          throw new Error(friendlyNetworkError(provider));
        }
        break;
      }
      clearTimeout(timer);

      if (response.ok) {
        const data = await response.json();
        return extractText(provider, data);
      }

      const errBody = await response.json().catch(() => ({}));
      const apiMsg = errBody.error?.message || errBody.detail || errBody.message || '';

      if (response.status === 401 || response.status === 403) {
        throw new Error(`${label} rejected your API key (HTTP ${response.status}). Check that the key is valid, not expired, and has credits/billing enabled.${apiMsg ? ` Details: ${apiMsg}` : ''}`);
      }

      if (response.status === 404) {
        // Model retired or not available on this key — try next model in the chain
        lastError = new Error(`${label}: model "${model}" not found (HTTP 404).${apiMsg ? ` ${apiMsg}` : ''}`);
        showToast(`Model "${model}" unavailable — trying fallback...`, 'warn');
        break;
      }

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(
          response.status === 429
            ? `${label} rate limit hit (HTTP 429).${apiMsg ? ` ${apiMsg}` : ''} Wait a minute or check your plan/quota.`
            : `${label} server error (HTTP ${response.status}).${apiMsg ? ` ${apiMsg}` : ''}`
        );
        if (attempt < MAX_RETRIES - 1) {
          const delay = retryDelayMs(response, attempt);
          showToast(`${label} ${response.status === 429 ? 'rate limited' : 'had a server error'} — retrying in ${Math.round(delay / 1000)}s...`, 'warn');
          await sleep(delay);
          continue;
        }
        break;
      }

      // Other 4xx — not retryable
      throw new Error(`${label} error (HTTP ${response.status}).${apiMsg ? ` ${apiMsg}` : ''}`);
    }
  }

  throw lastError || new Error(`All ${label} models failed. Please try again later.`);
}

/* ── Robust JSON extraction from model output ────── */
function safeParseJSON(text) {
  const cleaned = String(text).replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(cleaned); } catch (e) { /* fall through */ }
  // Models sometimes wrap JSON in prose — pull out the outermost object/array
  const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (match) {
    try { return JSON.parse(match[0]); } catch (e) { /* fall through */ }
  }
  throw new Error('The model did not return valid JSON. Please try generating again.');
}
window.safeParseJSON = safeParseJSON;

// Export for tracker, engine, studio
window.app = {
  callAI,
  hasKey: hasUsableKey,   // true if a typed key OR stored backend keys are usable
  showToast,
  showPaywall,
  selectPlan,
  initRazorpayCheckout,
  showAuthModal,
  hideAuthModal,
  openAccount,
  closeAccount,
  onPricingNav,
  acSetCurrency,
  removeProviderKey,
  simulateSSO,
  loginWithProvider,
  setAuthMode,
  submitAuth,
  handleAuthSubmit,
  startFreeTrialAuth,
  transitionToWorkspace,
  signOut,
  showLanding,
  viewTemplate,
  hideTemplate,
  downloadTemplate,
  updateTemplatePreview
};

/* ── Core Generation Logic ──────────────────────── */
let generatedData = {};

async function generateContent() {
  if (appState.plan === 'expired') {
    showPaywall();
    return;
  }
  if (!hasUsableKey()) {
    showToast("Please enter an API key first.", "warn");
    els.apiKey.focus();
    return;
  }
  if (!checkFreeUsage()) return;

  const txt = els.transcript.value.trim();
  if (txt.length < 50) {
    showToast("Transcript is too short.", "warn");
    return;
  }

  const selectedFormats = Array.from(document.querySelectorAll('.option-chip input:checked')).map(el => el.value);
  if (selectedFormats.length === 0) {
    showToast("Select at least one format.", "warn");
    return;
  }

  // UI State
  els.btnGen.classList.add('loading');
  els.btnGen.disabled = true;
  els.outEmpty.style.display = 'none';
  els.outActions.style.display = 'none';
  els.outLoading.style.display = 'flex';
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('done'));

  const sysPrompt = `You are an expert content repurposer. You extract the best insights from podcast transcripts and format them perfectly.
Return a single JSON object. DO NOT WRAP IN MARKDOWN FENCES.
Keys must be ONLY the formats requested, chosen from: "blog", "twitter", "linkedin", "shownotes".
"blog": A well-structured blog post with H2s and H3s.
"twitter": An array of strings, each string is a tweet in a thread.
"linkedin": A punchy LinkedIn post with emojis and spacing.
"shownotes": Bulleted show notes with timestamps if available.`;

  const userPrompt = `Formats requested: ${selectedFormats.join(', ')}.
Transcript:
${txt.substring(0, 15000)}`;

  try {
    const result = await callAI(sysPrompt, userPrompt, 'generate');
    generatedData = safeParseJSON(result);

    incrementFreeUsage();
    renderOutputs();
    addChatMessage("assistant", "I've generated the content based on your transcript. Need me to tweak anything? Just ask below!");
  } catch (err) {
    showToast(err.message, "error");
    els.outEmpty.style.display = 'flex';
  } finally {
    els.outLoading.style.display = 'none';
    els.btnGen.classList.remove('loading');
    els.btnGen.disabled = false;
  }
}

function renderOutputs() {
  els.outActions.style.display = 'flex';
  let firstActiveSet = false;

  els.tabs.forEach(tab => {
    const format = tab.dataset.target.replace('tab-', '');
    if (generatedData[format]) {
      tab.classList.add('done');
      if (!firstActiveSet) {
        switchTab(tab);
        firstActiveSet = true;
      }
    }
  });

  if (generatedData.blog) document.querySelector('#tab-blog .output-text').textContent = generatedData.blog;
  if (generatedData.linkedin) document.querySelector('#tab-linkedin .output-text').textContent = generatedData.linkedin;
  if (generatedData.shownotes) document.querySelector('#tab-shownotes .output-text').textContent = generatedData.shownotes;

  if (generatedData.twitter) {
    const tweets = Array.isArray(generatedData.twitter) ? generatedData.twitter : [String(generatedData.twitter)];
    const html = tweets.map((t, i) => `
      <div class="tweet-card">
        <div class="tweet-num">TWEET ${i + 1}/${tweets.length}</div>
        ${escapeHTML(t)}
      </div>
    `).join('');
    document.querySelector('#tab-twitter .tweet-list').innerHTML = html;
  }
}

/* ── Chat Assistant (conversational, can answer + apply edits) ── */
let chatLog = []; // [{ role:'user'|'assistant', text }]

function addChatMessage(role, text, opts) {
  const wrap = document.createElement('div');
  wrap.className = `pf-chat-msg ${role === 'user' ? 'pf-chat-user' : 'pf-chat-ai'}`;
  const who = document.createElement('div');
  who.className = 'pf-chat-who';
  who.textContent = role === 'user' ? 'You' : 'Assistant';
  const body = document.createElement('div');
  body.className = 'pf-chat-body';
  body.textContent = text;
  wrap.appendChild(who);
  wrap.appendChild(body);
  if (opts && opts.applied) {
    const tag = document.createElement('div');
    tag.className = 'pf-chat-applied';
    tag.textContent = `✓ Applied to ${opts.applied}`;
    wrap.appendChild(tag);
  }
  els.chatHistory.appendChild(wrap);
  els.chatHistory.scrollTop = els.chatHistory.scrollHeight;
}

function showChatTyping(on) {
  let el = document.getElementById('pf-chat-typing');
  if (on) {
    if (el) return;
    el = document.createElement('div');
    el.id = 'pf-chat-typing';
    el.className = 'pf-chat-msg pf-chat-ai';
    el.innerHTML = '<div class="pf-chat-who">Assistant</div><div class="pf-chat-dots"><span></span><span></span><span></span></div>';
    els.chatHistory.appendChild(el);
    els.chatHistory.scrollTop = els.chatHistory.scrollHeight;
  } else if (el) {
    el.remove();
  }
}

async function sendChatMessage() {
  const msg = els.chatInput.value.trim();
  if (!msg) return;

  const activeTab = document.querySelector('.tab-btn.active');
  const format = activeTab ? activeTab.dataset.target.replace('tab-', '') : null;

  if (!format || !generatedData[format]) {
    showToast("Generate content first before chatting.", "warn");
    return;
  }

  addChatMessage('user', msg);
  chatLog.push({ role: 'user', text: msg });
  els.chatInput.value = '';
  els.chatSend.disabled = true;
  els.chatSend.textContent = '...';
  showChatTyping(true);

  // The assistant both replies conversationally AND, when asked to change the
  // piece, returns the full updated content. JSON keeps the two cleanly separated.
  const sysPrompt =
    `You are a helpful content assistant in a podcast-repurposing app. The user is viewing their "${format}" piece. ` +
    `Answer questions conversationally and concisely. If (and only if) the user asks you to rewrite, tweak, expand, shorten, ` +
    `or otherwise change the piece, return the FULL updated content too. ` +
    `Return ONLY JSON, no fences: {"reply":"your short chat reply","updated":<new content, or null if no change>}. ` +
    `For the twitter format, "updated" must be a JSON array of tweet strings.`;
  const history = chatLog.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n');
  const userPrompt =
    `Current "${format}" content:\n${JSON.stringify(generatedData[format])}\n\n` +
    `Conversation so far:\n${history}\n\nRespond to the latest user message.`;

  try {
    const result = await callAI(sysPrompt, userPrompt, 'chat');
    let reply = '', updated = null;
    try {
      const parsed = safeParseJSON(result);
      reply = typeof parsed.reply === 'string' ? parsed.reply : '';
      updated = (parsed.updated === undefined ? null : parsed.updated);
    } catch (e) {
      reply = result; // model didn't return JSON — treat the whole thing as a reply
    }

    let applied = null;
    const hasUpdate = updated !== null && updated !== '' &&
      !(Array.isArray(updated) && updated.length === 0);
    if (hasUpdate) {
      generatedData[format] = updated;
      renderOutputs();
      applied = format;
    }

    showChatTyping(false);
    const finalReply = reply || (applied ? 'Updated the content for you!' : 'Done.');
    addChatMessage('assistant', finalReply, { applied });
    chatLog.push({ role: 'assistant', text: finalReply });
  } catch (err) {
    showChatTyping(false);
    addChatMessage('assistant', "Sorry, there was an error: " + err.message);
  } finally {
    els.chatSend.disabled = false;
    els.chatSend.textContent = 'Send';
  }
}

els.chatSend.addEventListener('click', sendChatMessage);
els.chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});

/* ── Transcript Tools (Inline) ───────────────────── */
async function runTranscriptTool(type) {
  if (appState.plan === 'expired') { showPaywall(); return; }
  if (!hasUsableKey()) { showToast("API key required.", "warn"); els.apiKey.focus(); return; }

  const txt = els.transcript.value.trim();
  if (txt.length < 20) return;

  let btn, prompt;
  if (type === 'grammar') { btn = els.toolGrammar; prompt = "Fix grammar and punctuation in this transcript. Keep speaker labels. Return ONLY the fixed text."; }
  if (type === 'spelling') { btn = els.toolSpelling; prompt = "Fix spelling errors and garbled words in this transcript. Return ONLY the fixed text."; }
  if (type === 'improve') { btn = els.toolImprove; prompt = "Improve readability, remove filler words (ums, ahs) and fix run-on sentences. Return ONLY the improved text."; }

  const originalText = btn.innerHTML;
  btn.innerHTML = `<div class="spinner" style="display:inline-block;width:12px;height:12px;border-width:1px;"></div>`;
  btn.disabled = true;

  try {
    const res = await callAI(prompt, txt, 'generate');
    els.transcript.value = res;
    showToast("Transcript updated!", "success");
  } catch (e) {
    showToast(e.message, "error");
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

els.toolGrammar.addEventListener('click', () => runTranscriptTool('grammar'));
els.toolSpelling.addEventListener('click', () => runTranscriptTool('spelling'));
els.toolImprove.addEventListener('click', () => runTranscriptTool('improve'));

/* ── Razorpay Payment ────────────────────────────── */
function initRazorpayCheckout() {
  const amt = appState.currency === 'USD' ? 2000 : 199000; // in cents/paise
  const cur = appState.currency;

  var options = {
    "key": "rzp_test_REPLACE_WITH_YOUR_KEY", // Enter the Key ID generated from the Dashboard
    "amount": amt,
    "currency": cur,
    "name": "PodcastForge",
    "description": "Fixed Pro Plan",
    "image": "https://example.com/your_logo", // Optional logo
    "handler": function (response){
      // On success
      selectPlan('fixed');
    },
    "prefill": {
      "name": "Creator",
      "email": "creator@example.com",
      "contact": ""
    },
    "theme": {
      "color": "#7c3aed"
    }
  };

  if (!window.Razorpay) {
    showToast("Payment gateway loading...", "warn");
    return;
  }

  if (options.key === "rzp_test_REPLACE_WITH_YOUR_KEY") {
    showToast("Mock Payment: Simulating success in 2s...", "info");
    setTimeout(() => {
      options.handler({ razorpay_payment_id: "pay_mock_123456" });
    }, 2000);
    return;
  }

  var rzp1 = new window.Razorpay(options);
  rzp1.on('payment.failed', function (response){
    showToast(response.error.description, "error");
  });
  rzp1.open();
}

/* ── Events & Init ───────────────────────────────── */
els.btnGen.addEventListener('click', generateContent);

els.tabs.forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab));
});

function switchTab(clickedTab) {
  els.tabs.forEach(t => t.classList.remove('active'));
  els.panes.forEach(p => p.classList.remove('active'));
  clickedTab.classList.add('active');
  document.getElementById(clickedTab.dataset.target).classList.add('active');
  updateCharCount();
}

function updateCharCount() {
  const activePane = document.querySelector('.tab-pane.active');
  if (activePane) {
    const text = activePane.innerText || '';
    els.charCount.textContent = `${text.length} characters`;
  }
}

els.btnCopy.addEventListener('click', async () => {
  const activePane = document.querySelector('.tab-pane.active');
  if (activePane) {
    await navigator.clipboard.writeText(activePane.innerText);
    els.btnCopy.textContent = '✅ Copied!';
    els.btnCopy.classList.add('copied');
    setTimeout(() => {
      els.btnCopy.textContent = '📋 Copy Content';
      els.btnCopy.classList.remove('copied');
    }, 2000);
  }
});

function showToast(msg, type = 'info') {
  els.toast.textContent = msg;
  els.toast.className = `toast show ${type}`;
  setTimeout(() => els.toast.classList.remove('show'), 4000);
}

// Option Chip toggles
document.querySelectorAll('.option-chip').forEach(chip => {
  chip.addEventListener('click', (e) => {
    if (e.target.tagName !== 'INPUT') {
      const input = chip.querySelector('input');
      input.checked = !input.checked;
      chip.classList.toggle('active', input.checked);
    }
  });
});

document.getElementById('btn-nav-upgrade').addEventListener('click', showPaywall);

// Auth Gateway & Transitions implementation
let authMode = 'signup'; // 'signup' | 'signin'

function setAuthMode(mode) {
  authMode = mode === 'signin' ? 'signin' : 'signup';
  const signup = authMode === 'signup';
  const t = (id) => document.getElementById(id);
  t('auth-tab-signup')?.classList.toggle('active', signup);
  t('auth-tab-signin')?.classList.toggle('active', !signup);
  if (t('auth-title')) t('auth-title').textContent = signup ? 'Create your account' : 'Welcome back';
  if (t('auth-subtitle')) t('auth-subtitle').textContent = signup
    ? 'Create an account to start your free 15-day trial — full access, no card required.'
    : 'Sign in to get back to your workspace.';
  if (t('auth-submit')) t('auth-submit').textContent = signup ? 'Create account & start trial' : 'Sign in';
  if (t('auth-hint')) t('auth-hint').style.display = signup ? 'block' : 'none';
  if (t('auth-password')) t('auth-password').setAttribute('autocomplete', signup ? 'new-password' : 'current-password');
  if (t('auth-switch')) {
    t('auth-switch').innerHTML = signup
      ? 'Already have an account? <a href="#" onclick="app.setAuthMode(\'signin\'); return false;">Sign in</a>'
      : 'New here? <a href="#" onclick="app.setAuthMode(\'signup\'); return false;">Create an account</a>';
  }
}

// Reflect which social logins the server actually has configured.
function updateSSOState() {
  const backend = window.PF && PF.hasBackend();
  const gOn = !backend || (PF.oauthEnabled && PF.oauthEnabled('google'));
  const ghOn = !backend || (PF.oauthEnabled && PF.oauthEnabled('github'));
  const g = document.getElementById('btn-sso-google');
  const gh = document.getElementById('btn-sso-github');
  if (g) { g.disabled = !gOn; g.classList.toggle('disabled', !gOn); }
  if (gh) { gh.disabled = !ghOn; gh.classList.toggle('disabled', !ghOn); }
  const hint = document.getElementById('sso-hint');
  if (hint) hint.style.display = (backend && (!gOn || !ghOn)) ? 'block' : 'none';
}

function showAuthModal() {
  setAuthMode('signup');
  updateSSOState();
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.add('show');
  setTimeout(() => document.getElementById('auth-email')?.focus(), 50);
}

function hideAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.remove('show');
}

/* ── Account panel ───────────────────────────────── */
let lastAccountData = null;
const ACCOUNT_FEATURES = {
  generate: 'Generations', studio: 'Script Studio', miner: 'Miner sections',
  tracker: 'AI Stack audits', agent: 'Agent runs', music: 'Music briefs', chat: 'Chat messages', transcribe: 'Audio transcripts'
};

function timeAgo(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

async function openAccount() {
  if (!(window.PF && PF.isAuthed())) { showAuthModal(); return; }
  const modal = document.getElementById('account-modal');
  const body = document.getElementById('account-body');
  if (!modal || !body) return;
  body.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-muted);">Loading…</div>';
  modal.classList.add('show');
  try {
    lastAccountData = await PF.account();
    body.innerHTML = renderAccount(lastAccountData);
  } catch (e) {
    body.innerHTML = `<div class="ac-muted" style="padding:20px;">${escapeHTML(e.message)}</div>`;
  }
}
function closeAccount() { document.getElementById('account-modal')?.classList.remove('show'); }

// In the workspace the marketing Pricing section is hidden, so the nav "Pricing"
// link opens the paywall modal instead of scrolling to a hidden anchor.
function onPricingNav(e) {
  if (document.body.classList.contains('workspace-active')) {
    if (e) e.preventDefault();
    showPaywall();
    return false;
  }
  return true;
}

function renderAccount(d) {
  const u = d.user, e = escapeHTML;
  let h = '';
  h += `<div class="ac-sec"><div class="ac-h">Profile</div>
    <div class="ac-row"><span>Email</span><b>${e(u.email)}</b></div>
    <div class="ac-row"><span>Plan</span><b>${e(String(u.plan || '').toUpperCase())}</b></div>
    ${u.plan === 'trial' ? `<div class="ac-row"><span>Trial</span><b>${u.daysLeft} days left</b></div>` : ''}
    <div class="ac-row"><span>User ID</span><span class="ac-mono">${e(u.id)}</span></div></div>`;

  h += `<div class="ac-sec"><div class="ac-h">Today's usage</div>`;
  Object.keys(ACCOUNT_FEATURES).forEach(f => {
    const used = (u.usage && u.usage[f]) || 0;
    const lim = u.freeLimits && u.freeLimits[f];
    const unlimited = u.plan !== 'free';
    const pct = unlimited || !lim ? 0 : Math.min(100, used / lim * 100);
    h += `<div class="ac-use"><div class="ac-use-top"><span>${ACCOUNT_FEATURES[f]}</span><span>${unlimited ? used + ' · unlimited' : used + ' / ' + lim}</span></div>
      ${unlimited ? '' : `<div class="ac-bar"><div class="ac-bar-fill" style="width:${pct}%"></div></div>`}</div>`;
  });
  h += `</div>`;

  h += `<div class="ac-sec"><div class="ac-h">Connected API keys</div>`;
  if ((u.providers || []).length) {
    u.providers.forEach(p => { h += `<div class="ac-row"><span>🔑 ${e(p)}</span><button class="ac-rm" onclick="app.removeProviderKey('${e(p)}')">Remove</button></div>`; });
  } else h += `<div class="ac-muted">No keys stored. Add one in the workspace key bar.</div>`;
  h += `</div>`;

  h += `<div class="ac-sec"><div class="ac-h">Settings</div>
    <div class="ac-row"><span>Currency</span><span>
      <button class="ac-cur ${appState.currency === 'USD' ? 'on' : ''}" onclick="app.acSetCurrency('USD')">$ USD</button>
      <button class="ac-cur ${appState.currency === 'INR' ? 'on' : ''}" onclick="app.acSetCurrency('INR')">₹ INR</button></span></div>
    <div class="ac-row"><span>Session</span><button class="ac-signout" onclick="app.closeAccount(); app.signOut()">Sign out</button></div></div>`;

  h += `<div class="ac-sec"><div class="ac-h">Recent activity</div>`;
  if ((d.history || []).length) {
    d.history.forEach(r => { h += `<div class="ac-hist"><span class="ac-hist-f">${e(r.feature)}</span><span class="ac-hist-p">${e(r.preview || '')}</span><span class="ac-hist-t">${e(timeAgo(r.at))}</span></div>`; });
  } else h += `<div class="ac-muted">No activity yet — generate something to see it here.</div>`;
  h += `</div>`;

  h += `<div class="ac-sec"><div class="ac-h">Plan changes</div>`;
  if ((d.transactions || []).length) {
    d.transactions.forEach(tx => { h += `<div class="ac-row"><span>${e(String(tx.plan || '').toUpperCase())} ${tx.mock ? '<span class="ac-mock">mock</span>' : ''}</span><span class="ac-muted">${e(timeAgo(tx.at))}</span></div>`; });
  } else h += `<div class="ac-muted">No plan changes yet.</div>`;
  h += `</div>`;
  return h;
}

function acSetCurrency(cur) {
  setCurrency(cur);
  if (lastAccountData) document.getElementById('account-body').innerHTML = renderAccount(lastAccountData);
}

async function removeProviderKey(p) {
  try {
    await PF.removeKey(p);
    await PF.refreshMe();
    syncBackendUser();
    showToast('Key removed.', 'success');
    openAccount();
  } catch (e) { showToast(e.message, 'error'); }
}

// Real OAuth when a backend has it configured; simulated SSO for the static demo.
function loginWithProvider(provider) {
  const p = String(provider).toLowerCase();
  if (window.PF && PF.hasBackend()) {
    if (PF.oauthEnabled(p)) { PF.startOAuth(p); return; }
    showToast(`${provider} login isn't set up on this server yet. Use email below.`, 'warn');
    return;
  }
  simulateSSO(provider);
}

function simulateSSO(provider) {
  showToast(`Connected with ${provider} (demo).`, 'success');
  setTimeout(transitionToWorkspace, 400);
}

// Single entry point for the email form; branches on the selected mode.
async function submitAuth() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;

  if (!(window.PF && PF.hasBackend())) {
    // Static demo with no backend: just enter the workspace.
    if (!email) { showToast('Please enter an email.', 'warn'); return; }
    transitionToWorkspace();
    return;
  }

  if (!email) { showToast('Please enter your email.', 'warn'); return; }
  const btn = document.getElementById('auth-submit');
  const restore = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  try {
    if (authMode === 'signup') {
      if (password.length < 8) { showToast('Password must be at least 8 characters.', 'warn'); return; }
      await PF.signup(email, password);
      syncBackendUser();
      showToast('Account created — your 15-day trial has started!', 'success');
      transitionToWorkspace();
    } else {
      if (!password) { showToast('Please enter your password.', 'warn'); return; }
      await PF.login(email, password);
      syncBackendUser();
      showToast('Signed in!', 'success');
      transitionToWorkspace();
    }
  } catch (e) {
    // Guide the user between modes when the failure suggests the other one.
    if (authMode === 'signin' && /invalid email or password/i.test(e.message)) {
      showToast("Invalid email or password. New here? Switch to “Create account”.", 'error');
    } else if (authMode === 'signup' && /already exists/i.test(e.message)) {
      showToast('That email already has an account — switching you to Sign in.', 'warn');
      setAuthMode('signin');
    } else {
      showToast(e.message, 'error');
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = restore; }
  }
}

// Back-compat aliases (older callers / window.app exports). Function
// declarations so they're hoisted for the early window.app export object.
function handleAuthSubmit() { return submitAuth(); }
function startFreeTrialAuth() { setAuthMode('signup'); return submitAuth(); }

function transitionToWorkspace() {
  hideAuthModal();
  document.body.classList.add('view-state-workspace');

  showToast("Entering Generator Dashboard...", "success");

  setTimeout(() => {
    destroyLandingAnimations();

    document.body.classList.add('workspace-active');

    // Completely hide landing view to eliminate blank height space above generator
    const landingEl = document.getElementById('landing-view');
    if (landingEl) landingEl.style.display = 'none';

    updateNavLinks(true);
    updateNavState();
    updateLocks();
    sessionStorage.setItem('pf_view_state', 'workspace');

    // Show a workspace page (honour a deep-linked route, else the default).
    if (window.pfRouter) {
      const r = (location.hash.match(/^#\/([a-z]+)/i) || [])[1] || '';
      pfRouter.go(r);
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
    window.dispatchEvent(new Event('resize'));
  }, 800);
}

function signOut() {
  if (window.PF && PF.isAuthed()) PF.logout();
  // Drop any workspace route so we return cleanly to the landing page.
  if (location.hash.startsWith('#/')) history.replaceState(null, '', location.pathname + location.search);
  localStorage.removeItem(STORAGE_KEYS.API_KEY);
  appState.apiKey = '';
  els.apiKey.value = '';
  els.apiKey.placeholder = 'Paste your Anthropic, Gemini, OpenRouter, OpenAI, Groq, or NVIDIA API key here...';
  const chip = document.getElementById('nav-account');
  if (chip) chip.style.display = 'none';
  detectProvider();

  // Re-display landing view before transitioning back
  const landingEl = document.getElementById('landing-view');
  if (landingEl) landingEl.style.display = 'block';

  document.body.classList.remove('workspace-active');

  setTimeout(() => {
    document.body.classList.remove('view-state-workspace');
    updateNavLinks(false);
    sessionStorage.setItem('pf_view_state', 'landing');
    showToast("Signed out. Returning to home page.", "info");
    initLandingAnimations();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 800);
}

function showLanding(e) {
  if (e) e.preventDefault();
  signOut();
}

// Cover Templates Preview callbacks
let currentSelectedTheme = '';
function viewTemplate(theme) {
  currentSelectedTheme = theme;
  const modal = document.getElementById('template-modal');
  const previewEl = document.getElementById('template-modal-preview');
  const titleEl = document.getElementById('template-modal-title');
  const inputTitle = document.getElementById('template-input-title');
  const inputSub = document.getElementById('template-input-sub');

  if (!modal || !previewEl) return;

  let defaultTitle = '';
  let defaultSub = '';
  let html = '';
  if (theme === 'synthwave') {
    titleEl.textContent = "Retro Synthwave Template";
    defaultTitle = "SYNTH TALK";
    defaultSub = "FUTURE WAVE";
    html = `
      <div class="template-preview synthwave" style="width: 250px; height: 250px; border-radius: 8px;">
        <div class="art-bg"></div>
        <div class="art-badge">EPISODE 01</div>
        <div class="art-mic">🎙️</div>
        <div class="art-title" id="preview-art-title">${defaultTitle}</div>
        <div class="art-sub" id="preview-art-sub">${defaultSub}</div>
      </div>
    `;
  } else if (theme === 'tech') {
    titleEl.textContent = "Tech Horizon Template";
    defaultTitle = "HORIZON";
    defaultSub = "THE SAAS STORY";
    html = `
      <div class="template-preview tech" style="width: 250px; height: 250px; border-radius: 8px;">
        <div class="art-bg"></div>
        <div class="art-badge">TECH</div>
        <div class="art-mic">⚡</div>
        <div class="art-title" id="preview-art-title">${defaultTitle}</div>
        <div class="art-sub" id="preview-art-sub">${defaultSub}</div>
      </div>
    `;
  } else if (theme === 'minimal') {
    titleEl.textContent = "Minimal Editorial Template";
    defaultTitle = "THE HOUR";
    defaultSub = "CREATOR NARRATIVE";
    html = `
      <div class="template-preview minimal" style="width: 250px; height: 250px; border-radius: 8px;">
        <div class="art-bg"></div>
        <div class="art-badge">WEEKLY</div>
        <div class="art-mic">🖋️</div>
        <div class="art-title" id="preview-art-title">${defaultTitle}</div>
        <div class="art-sub" id="preview-art-sub">${defaultSub}</div>
      </div>
    `;
  }

  previewEl.innerHTML = html;

  // Set initial customization inputs and dispatch input event to update floating labels
  if (inputTitle) {
    inputTitle.value = defaultTitle;
    inputTitle.dispatchEvent(new Event('input'));
  }
  if (inputSub) {
    inputSub.value = defaultSub;
    inputSub.dispatchEvent(new Event('input'));
  }

  modal.classList.add('show');
}

function updateTemplatePreview() {
  const inputTitle = document.getElementById('template-input-title');
  const inputSub = document.getElementById('template-input-sub');
  const previewTitle = document.getElementById('preview-art-title');
  const previewSub = document.getElementById('preview-art-sub');

  if (previewTitle && inputTitle) previewTitle.textContent = inputTitle.value.toUpperCase();
  if (previewSub && inputSub) previewSub.textContent = inputSub.value.toUpperCase();
}

function hideTemplate() {
  const modal = document.getElementById('template-modal');
  if (modal) modal.classList.remove('show');
}

// Build a self-contained SVG cover (1400x1400) for the chosen theme.
function buildCoverSVG(theme, title, sub) {
  const e = escapeHTML;
  const W = 1400;
  const THEMES = {
    synthwave: { defs: '<radialGradient id="g" cx="50%" cy="45%" r="72%"><stop offset="0%" stop-color="#9d5cf5"/><stop offset="82%" stop-color="#160c2d"/></radialGradient>', border: '#7c3aed', badge: 'EPISODE 01', mic: '🎙️', titleColor: '#ffffff', subColor: '#ffffff', titleFamily: "Outfit, Inter, sans-serif", italic: 'normal', badgeBg: 'rgba(255,255,255,0.16)', badgeColor: '#ffffff' },
    tech:      { defs: '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#0284c7"/></linearGradient>', border: '#06b6d4', badge: 'TECH', mic: '⚡', titleColor: '#ffffff', subColor: '#ffffff', titleFamily: "Outfit, Inter, sans-serif", italic: 'normal', badgeBg: 'rgba(255,255,255,0.16)', badgeColor: '#ffffff' },
    minimal:   { defs: '<radialGradient id="g" cx="50%" cy="45%" r="72%"><stop offset="0%" stop-color="#fed7aa"/><stop offset="100%" stop-color="#ea580c"/></radialGradient>', border: '#f97316', badge: 'WEEKLY', mic: '🖋️', titleColor: '#0f172a', subColor: '#0f172a', titleFamily: "Georgia, serif", italic: 'italic', badgeBg: 'rgba(15,23,42,0.12)', badgeColor: '#0f172a' }
  };
  const t = THEMES[theme] || THEMES.synthwave;
  const ttl = (title || 'YOUR TITLE');
  const fs = ttl.length > 12 ? 92 : ttl.length > 8 ? 112 : 134;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">
  <defs>${t.defs}</defs>
  <rect width="${W}" height="${W}" fill="url(#g)"/>
  <rect x="0" y="${W - 30}" width="${W}" height="30" fill="${t.border}"/>
  <rect x="70" y="70" rx="14" ry="14" width="300" height="68" fill="${t.badgeBg}"/>
  <text x="220" y="115" font-family="Outfit, Inter, sans-serif" font-weight="800" font-size="34" letter-spacing="6" fill="${t.badgeColor}" text-anchor="middle">${e(t.badge)}</text>
  <text x="${W / 2}" y="${W / 2 - 110}" font-size="220" text-anchor="middle">${t.mic}</text>
  <text x="${W / 2}" y="${W / 2 + 110}" font-family="${t.titleFamily}" font-style="${t.italic}" font-weight="900" font-size="${fs}" fill="${t.titleColor}" text-anchor="middle">${e(ttl)}</text>
  <text x="${W / 2}" y="${W / 2 + 210}" font-family="Inter, sans-serif" font-weight="600" font-size="48" letter-spacing="8" fill="${t.subColor}" opacity="0.85" text-anchor="middle">${e(sub || 'SUBTITLE')}</text>
</svg>`;
}

// "Use Template" now exports a real cover image (PNG, with SVG fallback).
function downloadTemplate() {
  const title = (document.getElementById('template-input-title')?.value || '').toUpperCase();
  const sub = (document.getElementById('template-input-sub')?.value || '').toUpperCase();
  const theme = currentSelectedTheme || 'synthwave';
  const svg = buildCoverSVG(theme, title, sub);
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));

  const triggerDownload = (href, ext) => {
    const a = document.createElement('a');
    a.href = href; a.download = `podcast-cover-${theme}.${ext}`;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const fallbackSVG = () => {
    triggerDownload(svgUrl, 'svg');
    setTimeout(() => URL.revokeObjectURL(svgUrl), 1000);
    showToast('Cover downloaded as SVG.', 'success');
    hideTemplate();
  };

  const img = new Image();
  img.onload = () => {
    let c;
    try {
      c = document.createElement('canvas');
      c.width = 1400; c.height = 1400;
      c.getContext('2d').drawImage(img, 0, 0, 1400, 1400);
    } catch (err) { fallbackSVG(); return; }
    // toBlob is async — handle null inside the callback (a throw here would be uncaught).
    c.toBlob((b) => {
      if (!b) { fallbackSVG(); return; }
      const pngUrl = URL.createObjectURL(b);
      triggerDownload(pngUrl, 'png');
      setTimeout(() => { URL.revokeObjectURL(pngUrl); URL.revokeObjectURL(svgUrl); }, 1000);
      showToast('Cover downloaded as PNG.', 'success');
      hideTemplate();
    }, 'image/png');
  };
  img.onerror = fallbackSVG;
  img.src = svgUrl;
}

/* ── Landing Animations ──────────────────────────── */
function destroyLandingAnimations() {
  if (lenisInstance) {
    lenisInstance.destroy();
    lenisInstance = null;
  }
  if (window.ScrollTrigger) {
    ScrollTrigger.getAll().forEach(t => t.kill());
  }
  if (revealObserver) {
    revealObserver.disconnect();
    revealObserver = null;
  }
}

let lenisInstance = null;
let revealObserver = null;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function spawnHeroParticles() {
  const container = document.getElementById('hero-particles');
  if (!container || prefersReducedMotion) return;
  if (container.childElementCount > 0) return; // already spawned

  const COUNT = 26;
  for (let i = 0; i < COUNT; i++) {
    const p = document.createElement('span');
    p.className = 'hero-particle';
    const size = 2 + Math.random() * 4;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.left = `${Math.random() * 100}%`;
    p.style.animationDuration = `${9 + Math.random() * 14}s`;
    p.style.animationDelay = `${-Math.random() * 20}s`;
    p.style.opacity = (0.15 + Math.random() * 0.5).toFixed(2);
    if (Math.random() > 0.6) p.classList.add('cyan');
    container.appendChild(p);
  }
}

function animateCounters() {
  document.querySelectorAll('.stat-num[data-count]').forEach(el => {
    if (el.dataset.done) return;
    el.dataset.done = '1';
    const target = parseInt(el.dataset.count, 10);
    if (prefersReducedMotion) { el.textContent = target.toLocaleString(); return; }
    const duration = 1600;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased).toLocaleString();
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function initRevealObserver() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        if (entry.target.querySelector('.stat-num')) animateCounters();
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  items.forEach(el => revealObserver.observe(el));
}

function initLandingAnimations() {
  destroyLandingAnimations();
  spawnHeroParticles();
  initRevealObserver();

  if (window.Lenis && !prefersReducedMotion) {
    lenisInstance = new window.Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true
    });

    // Link Lenis to GSAP ScrollTrigger
    if (window.ScrollTrigger) {
      lenisInstance.on('scroll', ScrollTrigger.update);
    }

    function raf(time) {
      if (lenisInstance) {
        lenisInstance.raf(time);
        requestAnimationFrame(raf);
      }
    }
    requestAnimationFrame(raf);
  }

  const scrollyItems = document.querySelectorAll('.scrolly-item');
  const scrollyCards = document.querySelectorAll('.scrolly-card');

  if (scrollyItems.length > 0) {
    const c1 = document.getElementById('scrolly-c1');
    if (c1) c1.classList.add('visible');

    if (window.gsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);

      scrollyItems.forEach((item, idx) => {
        const index = idx + 1;
        ScrollTrigger.create({
          trigger: item,
          start: "top 70%",
          end: "bottom 30%",
          onEnter: () => activateScrolly(index),
          onEnterBack: () => activateScrolly(index)
        });
      });

      // Subtle parallax on the hero orbs
      if (!prefersReducedMotion) {
        gsap.to('.orb-1', { yPercent: 28, ease: 'none', scrollTrigger: { trigger: '#landing-hero', start: 'top top', end: 'bottom top', scrub: 1 } });
        gsap.to('.orb-2', { yPercent: -22, ease: 'none', scrollTrigger: { trigger: '#landing-hero', start: 'top top', end: 'bottom top', scrub: 1 } });
      }
    } else {
      window.addEventListener('scroll', () => {
        let currentActive = 1;
        scrollyItems.forEach((item, idx) => {
          const rect = item.getBoundingClientRect();
          if (rect.top < window.innerHeight * 0.6 && rect.bottom > window.innerHeight * 0.4) {
            currentActive = idx + 1;
          }
        });
        activateScrolly(currentActive);
      });
    }
  }

  function activateScrolly(index) {
    scrollyItems.forEach(item => {
      item.classList.toggle('active', parseInt(item.dataset.index) === index);
    });
    scrollyCards.forEach((card, idx) => {
      card.classList.toggle('visible', (idx + 1) <= index);
    });
  }
}

// Global click delegate for smooth scrolling to anchor targets
document.addEventListener('click', (e) => {
  const anchor = e.target.closest('a[href^="#"]');
  if (!anchor) return;

  const href = anchor.getAttribute('href');
  if (href === '#' || href === '') return;
  if (href.startsWith('#/')) return; // workspace routes are handled by the router

  const target = document.querySelector(href);
  if (target) {
    e.preventDefault();
    if (lenisInstance) {
      lenisInstance.scrollTo(target, { offset: -80 });
    } else {
      window.scrollTo({
        top: target.offsetTop - 80,
        behavior: 'smooth'
      });
    }
  }
});

// If a backend is reachable and we have a valid saved session, adopt it:
// reflect the server's plan/usage/keys and drop the user straight into the workspace.
if (window.PF) {
  PF.ready.then((hasBackend) => {
    if (!hasBackend) return;
    if (PF.authError && PF.authError()) {
      showToast('Sign-in failed: ' + PF.authError(), 'error');
    }
    if (PF.isAuthed()) {
      syncBackendUser();
      if (PF.justAuthenticated && PF.justAuthenticated()) {
        showToast(`Signed in as ${PF.session.user.email}`, 'success');
      }
      if (sessionStorage.getItem('pf_view_state') !== 'workspace') {
        sessionStorage.setItem('pf_view_state', 'workspace');
        document.body.classList.add('view-state-workspace', 'workspace-active');
        const landingEl = document.getElementById('landing-view');
        if (landingEl) landingEl.style.display = 'none';
        updateNavLinks(true);
        updateNavState();
        updateLocks();
      }
      // Render the routed workspace page (deep link or default).
      if (window.pfRouter) {
        const r = (location.hash.match(/^#\/([a-z]+)/i) || [])[1] || '';
        pfRouter.go(r);
      }
    }
  });
}

// Auto-grow the main text boxes to fit content up to their CSS max-height, then
// scroll. Keeps boxes from looking stretched/empty and makes overflow obvious.
// Delegated so it also covers tool textareas rendered later (agent/miner/music).
const AUTOGROW_IDS = new Set(['transcript', 'ag-input', 'miner-input', 'mu-input']);
function autoGrow(t) {
  if (!t || t.tagName !== 'TEXTAREA') return;
  const max = parseInt(getComputedStyle(t).maxHeight, 10) || 380;
  t.style.height = 'auto';
  const h = Math.min(t.scrollHeight, max);
  t.style.height = h + 'px';
  t.style.overflowY = t.scrollHeight > max ? 'auto' : 'hidden';
}
document.addEventListener('input', (e) => {
  if (e.target && AUTOGROW_IDS.has(e.target.id)) autoGrow(e.target);
});

// Run Init
initAuth();
