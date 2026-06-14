/* ============================================================
   PodcastForge — Script Studio
   Turns the prompt-template library (templates.js) into
   fill-in-the-blank script generation. Picks up the same
   window.app.callAI contract as every other tool, so it routes
   through the backend (or direct BYOK) automatically.
   Mounts into #studio-container.
   ============================================================ */
(function () {
  'use strict';

  const esc = window.escapeHTML || ((s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;'));

  const TEMPLATES = Array.isArray(window.PF_TEMPLATES) ? window.PF_TEMPLATES : [];
  const CATEGORIES = ['All', ...Array.from(new Set(TEMPLATES.map(t => t.category)))];

  const state = {
    category: 'All',
    activeId: null,           // expanded template
    values: {},               // { templateId: { fieldKey: value } }
    output: null,             // { type:'text'|'error', data }
    generating: false
  };

  function fill(tpl, vals) {
    return String(tpl).replace(/\{\{(\w+)\}\}/g, (_, k) => (vals && vals[k] != null ? vals[k] : ''));
  }

  async function generate(id) {
    const t = TEMPLATES.find(x => x.id === id);
    if (!t) return;
    if (!window.app || typeof window.app.callAI !== 'function') {
      state.output = { type: 'error', data: 'AI engine not ready. Load the workspace first.' };
      return render();
    }
    const vals = state.values[id] || {};
    const missing = (t.fields || []).filter(f => !String(vals[f.key] || '').trim());
    if (missing.length) {
      state.output = { type: 'error', data: `Fill in: ${missing.map(f => f.label).join(', ')}.` };
      return render();
    }

    state.generating = true; state.output = null; render();
    try {
      const userPrompt = fill(t.user, vals);
      const text = await window.app.callAI(t.system, userPrompt, 'studio');
      state.output = { type: 'text', data: text };
    } catch (e) {
      state.output = { type: 'error', data: e.message };
    } finally {
      state.generating = false;
      render();
    }
  }

  function copyOutput() {
    if (state.output && state.output.type === 'text') {
      navigator.clipboard?.writeText(state.output.data).then(() =>
        window.app?.showToast ? window.app.showToast('Script copied!', 'success') : null);
    }
  }

  function setCategory(c) { state.category = c; render(); }
  function toggle(id) {
    state.activeId = state.activeId === id ? null : id;
    state.output = null;
    render();
  }
  function setField(id, key, val) {
    state.values[id] = state.values[id] || {};
    state.values[id][key] = val;
  }

  function render() {
    const root = document.getElementById('studio-container');
    if (!root) return;

    if (!TEMPLATES.length) {
      root.innerHTML = `<div class="st-empty">No templates loaded. Ensure templates.js is included before studio.js.</div>` +
        (document.getElementById('studio-lock')?.outerHTML || '');
      return;
    }

    let html = `<div class="st-cats">`;
    CATEGORIES.forEach(c => {
      html += `<button class="st-cat ${state.category === c ? 'on' : ''}" onclick="studioSetCategory('${esc(c)}')">${esc(c)}</button>`;
    });
    html += `</div>`;

    const visible = TEMPLATES.filter(t => state.category === 'All' || t.category === state.category);
    html += `<div class="st-grid">`;
    visible.forEach(t => {
      const open = state.activeId === t.id;
      html += `
        <div class="st-card ${open ? 'open' : ''}">
          <div class="st-card-head" onclick="studioToggle('${esc(t.id)}')">
            <div class="st-icon">${esc(t.icon || '📝')}</div>
            <div class="st-card-main">
              <div class="st-name">${esc(t.name)}</div>
              <div class="st-desc">${esc(t.description || '')}</div>
            </div>
            <div class="st-chevron">${open ? '▲' : '▼'}</div>
          </div>
          ${open ? renderForm(t) : ''}
        </div>`;
    });
    html += `</div>`;

    root.innerHTML = html + (document.getElementById('studio-lock')?.outerHTML || '');

    // rebind field inputs (values persisted in state across re-renders)
    if (state.activeId) {
      const t = TEMPLATES.find(x => x.id === state.activeId);
      (t?.fields || []).forEach(f => {
        const el = document.getElementById(`st-f-${state.activeId}-${f.key}`);
        if (el) {
          el.value = (state.values[state.activeId] || {})[f.key] || '';
          el.addEventListener('input', (e) => setField(state.activeId, f.key, e.target.value));
        }
      });
      const btn = document.getElementById('st-generate');
      if (btn) btn.addEventListener('click', () => generate(state.activeId));
      const send = document.getElementById('st-send');
      if (send) send.addEventListener('click', () => sendToGenerator(state.activeId));
      const copy = document.getElementById('st-copy');
      if (copy) copy.addEventListener('click', copyOutput);
    }
  }

  function renderForm(t) {
    let body = `<div class="st-form">`;
    (t.fields || []).forEach(f => {
      body += `
        <label class="st-field">
          <span class="st-field-label">${esc(f.label)}</span>
          <input id="st-f-${esc(t.id)}-${esc(f.key)}" class="st-input" type="text" placeholder="${esc(f.placeholder || '')}">
        </label>`;
    });
    body += `<div class="st-actions">
        <button class="st-gen ${state.generating ? 'loading' : ''}" id="st-generate" ${state.generating ? 'disabled' : ''}>
          ${state.generating ? 'Writing…' : '✍️ Generate Script'}
        </button>
        <button class="st-send" id="st-send" title="Load this prompt into the Generator transcript box">Send to Generator</button>
      </div>`;

    if (state.generating) {
      body += `<div class="st-skel"><div class="st-skel-l" style="width:92%"></div><div class="st-skel-l" style="width:84%"></div><div class="st-skel-l" style="width:88%"></div></div>`;
    } else if (state.output) {
      if (state.output.type === 'error') {
        body += `<div class="st-error">${esc(state.output.data)}</div>`;
      } else {
        body += `<div class="st-out">${esc(state.output.data)}</div><button class="st-copy" id="st-copy">📋 Copy script</button>`;
      }
    }
    body += `</div>`;
    return body;
  }

  // "Both" wiring: drop the filled prompt into the Generator's transcript box.
  function sendToGenerator(id) {
    const t = TEMPLATES.find(x => x.id === id);
    if (!t) return;
    const ta = document.getElementById('transcript');
    if (!ta) return;
    ta.value = fill(t.user, state.values[id] || {});
    ta.dispatchEvent(new Event('input', { bubbles: true })); // trigger auto-grow
    if (window.app?.showToast) window.app.showToast('Loaded into the Generator.', 'info');
    if (window.pfRouter) pfRouter.go('generator');
    else document.getElementById('app')?.scrollIntoView({ behavior: 'smooth' });
  }

  function injectStyles() {
    if (document.getElementById('studio-styles')) return;
    const s = document.createElement('style');
    s.id = 'studio-styles';
    s.textContent = `
      #studio-container { position:relative; }
      .st-empty { padding:40px; text-align:center; color:var(--text-muted); font-family:monospace; }
      .st-cats { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:18px; }
      .st-cat { background:transparent; border:1px solid var(--border); color:var(--text-secondary); border-radius:999px; padding:7px 15px; font:500 12.5px/1 inherit; cursor:pointer; transition:.15s; }
      .st-cat:hover { color:var(--text-primary); border-color:var(--accent-violet); }
      .st-cat.on { background:var(--accent-violet); border-color:var(--accent-violet); color:#fff; font-weight:700; }
      .st-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px,1fr)); gap:12px; }
      .st-card { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); overflow:hidden; transition:.15s; }
      .st-card:hover { border-color:var(--border-accent); }
      .st-card.open { grid-column:1/-1; border-color:var(--accent-violet); }
      .st-card-head { display:flex; gap:13px; align-items:center; padding:16px; cursor:pointer; }
      .st-icon { font-size:24px; flex-shrink:0; }
      .st-card-main { flex:1; min-width:0; }
      .st-name { font:700 14.5px/1.3 inherit; color:var(--text-primary); }
      .st-desc { font:400 12.5px/1.5 inherit; color:var(--text-secondary); margin-top:3px; }
      .st-chevron { color:var(--text-muted); font-size:10px; }
      .st-form { padding:0 16px 16px; border-top:1px solid var(--border); }
      .st-field { display:block; margin-top:14px; }
      .st-field-label { display:block; font:600 11.5px/1 ui-monospace,monospace; letter-spacing:.04em; color:var(--text-muted); margin-bottom:6px; text-transform:uppercase; }
      .st-input { width:100%; box-sizing:border-box; background:var(--bg-input); border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--text-primary); font:400 13.5px/1.5 inherit; padding:10px 12px; outline:none; }
      .st-input:focus { border-color:var(--accent-violet); }
      .st-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:18px; }
      .st-gen { background:linear-gradient(135deg,var(--accent-violet),#5b21b6); color:#fff; border:none; border-radius:var(--radius-sm); padding:11px 20px; font:700 13.5px/1 inherit; cursor:pointer; transition:.2s; }
      .st-gen:hover:not(:disabled) { box-shadow:0 0 24px rgba(124,58,237,.35); }
      .st-gen:disabled { opacity:.6; cursor:default; }
      .st-send { background:rgba(255,255,255,.05); border:1px solid var(--border); color:var(--text-secondary); border-radius:var(--radius-sm); padding:11px 16px; font:600 12.5px/1 inherit; cursor:pointer; }
      .st-send:hover { color:var(--text-primary); border-color:var(--accent-cyan2); }
      .st-out { white-space:pre-wrap; margin-top:16px; background:var(--bg-base); border:1px solid var(--border); border-radius:var(--radius-sm); padding:16px; font:400 13.5px/1.7 inherit; color:var(--text-primary); max-height:520px; overflow:auto; }
      .st-error { margin-top:16px; background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.3); color:#fca5a5; border-radius:var(--radius-sm); padding:12px 14px; font-size:13px; }
      .st-copy { margin-top:10px; background:transparent; border:1px solid var(--border); color:var(--text-secondary); border-radius:var(--radius-sm); padding:7px 13px; font:600 12px/1 inherit; cursor:pointer; }
      .st-copy:hover { color:var(--text-primary); border-color:var(--accent-violet); }
      .st-skel { margin-top:16px; display:flex; flex-direction:column; gap:9px; }
      .st-skel-l { height:13px; border-radius:4px; background:linear-gradient(90deg,var(--bg-input) 25%,rgba(255,255,255,.06) 50%,var(--bg-input) 75%); background-size:200% 100%; animation:st-shim 1.3s infinite; }
      @keyframes st-shim { to { background-position:-200% 0; } }
      @media (prefers-reduced-motion: reduce) { .st-skel-l { animation:none; } }
    `;
    document.head.appendChild(s);
  }

  window.studioSetCategory = setCategory;
  window.studioToggle = toggle;

  // Generator-side picker: load a template scaffold into the transcript box.
  function wireGeneratorPicker() {
    const sel = document.getElementById('gen-template-select');
    if (!sel || !TEMPLATES.length || sel.dataset.wired) return;
    sel.dataset.wired = '1';
    CATEGORIES.filter(c => c !== 'All').forEach(cat => {
      const og = document.createElement('optgroup');
      og.label = cat;
      TEMPLATES.filter(t => t.category === cat).forEach(t => {
        const o = document.createElement('option');
        o.value = t.id;
        o.textContent = `${t.icon || '📝'} ${t.name}`;
        og.appendChild(o);
      });
      sel.appendChild(og);
    });
    sel.addEventListener('change', () => {
      const t = TEMPLATES.find(x => x.id === sel.value);
      const ta = document.getElementById('transcript');
      if (t && ta) {
        ta.value = fill(t.user, {});
        ta.dispatchEvent(new Event('input', { bubbles: true })); // trigger auto-grow
        if (window.app && window.app.showToast) window.app.showToast('Template scaffold loaded — fill in the blanks below.', 'info');
        ta.focus();
      }
    });
  }

  function boot() {
    wireGeneratorPicker();
    if (!document.getElementById('studio-container')) return;
    injectStyles();
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
