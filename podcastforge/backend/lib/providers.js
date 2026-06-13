/* ============================================================
   PodcastForge Backend — Provider Engine
   Server-side AI fetch. Because this runs server-to-server there
   is no browser CORS restriction, so EVERY provider works here —
   including NVIDIA NIM and OpenAI, which cannot be called directly
   from a browser. This is the single place the app "fetches the API".

   Mirrors the client fallback strategy: per-provider model chains,
   exponential backoff on 429/5xx, Retry-After support, and a request
   timeout. Throws { status, message } so the HTTP layer can map it.
   ============================================================ */
'use strict';

const PROVIDER_MODELS = {
  anthropic: ['claude-sonnet-4-5', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'],
  gemini: ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite'],
  openrouter: ['google/gemini-2.5-flash', 'meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-chat-v3-0324:free'],
  nvidia: ['meta/llama-3.3-70b-instruct', 'meta/llama-3.1-70b-instruct', 'mistralai/mixtral-8x22b-instruct-v0.1'],
  openai: ['gpt-4o', 'gpt-4o-mini']
};

const LABELS = {
  anthropic: 'Anthropic', gemini: 'Google Gemini', openrouter: 'OpenRouter',
  nvidia: 'NVIDIA NIM', openai: 'OpenAI'
};

function detectProvider(key) {
  const k = String(key || '').trim();
  if (k.startsWith('sk-ant-')) return 'anthropic';
  if (k.startsWith('AIza') || k.startsWith('AQ.')) return 'gemini';
  if (k.startsWith('sk-or-')) return 'openrouter';
  if (k.startsWith('nvapi-')) return 'nvidia';
  return 'openai';
}

function buildRequest(provider, model, key, system, user) {
  if (provider === 'anthropic') {
    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 4000, system, messages: [{ role: 'user', content: user }] })
    };
  }
  if (provider === 'gemini') {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 4000 }
      })
    };
  }
  if (provider === 'openrouter') {
    return {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'PodcastForge' },
      body: JSON.stringify({
        model, models: PROVIDER_MODELS.openrouter.filter(m => m !== model),
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature: 0.6, max_tokens: 4000
      })
    };
  }
  if (provider === 'nvidia') {
    return {
      url: 'https://integrate.api.nvidia.com/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature: 0.5, max_tokens: 4000
      })
    };
  }
  return {
    url: 'https://api.openai.com/v1/chat/completions',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
  };
}

function extractText(provider, data) {
  if (provider === 'anthropic') {
    const block = (data.content || []).find(c => c.type === 'text');
    if (!block) throw { status: 502, message: 'Anthropic returned no text content.' };
    return block.text;
  }
  if (provider === 'gemini') {
    const cand = data.candidates && data.candidates[0];
    const text = cand && cand.content && cand.content.parts && cand.content.parts.map(p => p.text || '').join('');
    if (!text) {
      const reason = (cand && cand.finishReason) || (data.promptFeedback && data.promptFeedback.blockReason);
      throw { status: 502, message: `Gemini returned no text${reason ? ` (${reason})` : ''}.` };
    }
    return text;
  }
  const msg = data.choices && data.choices[0] && data.choices[0].message;
  if (!msg || typeof msg.content !== 'string' || !msg.content.length) {
    throw { status: 502, message: 'Provider returned an empty response.' };
  }
  return msg.content;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function callAI(provider, key, system, user) {
  const models = PROVIDER_MODELS[provider] || PROVIDER_MODELS.openai;
  const label = LABELS[provider] || 'Provider';
  const MAX_RETRIES = 3;
  let lastError = { status: 502, message: `All ${label} models failed.` };

  for (const model of models) {
    const { url, headers, body } = buildRequest(provider, model, key, system, user);
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      let response;
      try {
        response = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(90000) });
      } catch (err) {
        lastError = { status: 504, message: `${label} request failed: ${err.name === 'TimeoutError' ? 'timed out' : err.message}` };
        break;
      }
      if (response.ok) {
        return extractText(provider, await response.json());
      }
      const errBody = await response.json().catch(() => ({}));
      const apiMsg = (errBody.error && errBody.error.message) || errBody.detail || errBody.message || '';
      const status = response.status;

      if (status === 401 || status === 403) {
        throw { status: 401, message: `${label} rejected the API key (HTTP ${status}).${apiMsg ? ' ' + apiMsg : ''}` };
      }
      if (status === 404) {
        lastError = { status: 404, message: `${label}: model "${model}" not found.` };
        break; // try next model
      }
      if (status === 429 || status >= 500) {
        lastError = { status, message: `${label} ${status === 429 ? 'rate limited' : 'server error'} (HTTP ${status}).${apiMsg ? ' ' + apiMsg : ''}` };
        if (attempt < MAX_RETRIES - 1) {
          const ra = parseFloat(response.headers.get('retry-after'));
          const delay = !isNaN(ra) ? Math.min(ra * 1000, 30000) : Math.min(2000 * Math.pow(2, attempt), 16000) + Math.random() * 500;
          await sleep(delay);
          continue;
        }
        break;
      }
      throw { status, message: `${label} error (HTTP ${status}).${apiMsg ? ' ' + apiMsg : ''}` };
    }
  }
  throw lastError;
}

module.exports = { callAI, detectProvider, LABELS, PROVIDER_MODELS };
