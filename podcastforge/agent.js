/* ============================================================
   PodcastForge — Auto-Repurpose Agent
   A transparent, multi-step agent (no external framework) that
   turns one transcript into a full content pack:
     1. PLAN   — the model picks the strongest standalone pieces
                 and assigns each a format (the agent "deciding")
     2. DRAFT  — it writes each planned piece, grounded in the
                 transcript, streaming results as they land
     3. PACK   — assembles a copy/downloadable content pack
   Routes every call through window.app.callAI(..., 'agent'), so it
   inherits provider routing, model fallback, 429 backoff and the
   free-plan daily cap. Mounts into #agent-container.
   ============================================================ */
(function () {
  'use strict';

  const esc = window.escapeHTML || ((s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;'));

  const parseJSON = window.safeParseJSON || ((t) => JSON.parse(String(t).replace(/```json|```/g, '').trim()));
  const callAI = (sys, usr) => {
    if (!window.app || typeof window.app.callAI !== 'function') {
      return Promise.reject(new Error('AI engine not ready. Load the workspace first.'));
    }
    return window.app.callAI(sys, usr, 'agent');
  };
  const hasKey = () => (window.app && typeof window.app.hasKey === 'function')
    ? window.app.hasKey() : !!localStorage.getItem('pf_api_key');

  const FORMATS = {
    blog:      { label: 'Blog post', icon: '📝' },
    twitter:   { label: 'Twitter thread', icon: '🐦' },
    linkedin:  { label: 'LinkedIn post', icon: '💼' },
    shownotes: { label: 'Show notes', icon: '🗒️' },
    reel:      { label: 'Reel script', icon: '🎬' },
    quote:     { label: 'Quote cards', icon: '❝' }
  };

  const PLAN_SYS =
    'You are a content strategist agent for a creator. Given a podcast/video transcript and a set of ALLOWED formats, ' +
    'choose the strongest, most distinct standalone pieces to produce — high-impact angles, good variety, no duplicates. ' +
    'Return ONLY JSON, no markdown fences: {"plan":[{"title":"short label","format":"<one of the allowed formats>","angle":"one sentence on why it works"}]}. ' +
    'Use only the allowed formats. Produce exactly the requested number of items if the material supports it.';

  const DRAFT_SYS = {
    blog: 'You are an expert ghostwriter. Write a complete, well-structured blog post (strong title, H2/H3 subheadings) grounded strictly in the transcript provided — do not invent facts. Return only the post as markdown.',
    twitter: 'You are a viral thread writer. Write a tight Twitter/X thread: strong hook first, one idea per tweet, no hashtag spam. Return ONLY a JSON array of strings (one per tweet), no fences.',
    linkedin: 'You are a LinkedIn ghostwriter. Write one punchy LinkedIn post: short lines, generous spacing, a clear takeaway, a soft engagement prompt at the end. Return only the post text.',
    shownotes: 'You are a podcast producer. Write clean, bulleted show notes with timestamps if present in the transcript. Return only the notes.',
    reel: 'You are a short-video scriptwriter. Write a 30–45s reel/Short script: a 3-second hook, 3–5 spoken beats, and an on-screen-text suggestion per beat. Return only the script.',
    quote: 'You are a quote-card copywriter. Produce 3 punchy standalone quote-card lines (each under 25 words) drawn from the transcript. Return only the three lines, one per line.'
  };

  let state = {
    transcript: '',
    formats: { blog: true, twitter: true, linkedin: true, shownotes: false, reel: false, quote: false },
    count: 4,
    running: false,
    steps: [],     // [{ label, status:'running'|'done'|'error', note }]
    pack: [],      // [{ title, format, type:'text'|'tweets', data }]
    error: ''
  };

  function setStep(i, patch) { state.steps[i] = Object.assign({}, state.steps[i], patch); render(); }

  async function run() {
    if (!hasKey()) {
      state.error = 'Add your API key in the bar at the top of the workspace first.';
      render(); document.getElementById('api-key-input')?.focus(); return;
    }
    const text = state.transcript.trim();
    if (text.length < 200) {
      state.error = 'Paste a longer transcript (at least a few paragraphs) for the agent to work with.';
      render(); return;
    }
    const allowed = Object.keys(state.formats).filter(f => state.formats[f]);
    if (!allowed.length) { state.error = 'Pick at least one output format.'; render(); return; }

    const n = Math.max(1, Math.min(8, parseInt(state.count, 10) || 4));
    state.running = true; state.error = ''; state.pack = []; state.steps = [];
    state.steps.push({ label: 'Planning the content pack', status: 'running' });
    render();

    const source = text.slice(0, 15000);
    let plan;
    try {
      const planUser = `ALLOWED FORMATS: ${allowed.join(', ')}\nNUMBER OF PIECES: ${n}\n\nTRANSCRIPT:\n${source}`;
      const raw = await callAI(PLAN_SYS, planUser);
      const parsed = parseJSON(raw);
      plan = (Array.isArray(parsed.plan) ? parsed.plan : [])
        .filter(p => p && p.title && FORMATS[p.format] && allowed.includes(p.format))
        .slice(0, n);
      if (!plan.length) throw new Error('The planner returned no usable pieces.');
      setStep(0, { status: 'done', note: `${plan.length} piece${plan.length > 1 ? 's' : ''} planned` });
    } catch (e) {
      const capped = /limit reached/i.test(e.message);
      setStep(0, { status: 'error', note: e.message });
      state.error = capped ? e.message : ('Planning failed: ' + e.message);
      state.running = false; render(); return;
    }

    // DRAFT each planned piece
    for (let i = 0; i < plan.length; i++) {
      const piece = plan[i];
      const meta = FORMATS[piece.format];
      const stepIdx = state.steps.push({ label: `Drafting ${meta.label}: “${piece.title}”`, status: 'running' }) - 1;
      render();
      try {
        const usr = `PIECE: ${piece.title}\nANGLE: ${piece.angle || ''}\n\nTRANSCRIPT (use only this, do not invent):\n${source}`;
        const raw = await callAI(DRAFT_SYS[piece.format], usr);
        let entry;
        if (piece.format === 'twitter') {
          let tweets = null;
          try { tweets = parseJSON(raw); } catch (e) { tweets = null; }
          entry = Array.isArray(tweets)
            ? { title: piece.title, format: piece.format, type: 'tweets', data: tweets }
            : { title: piece.title, format: piece.format, type: 'text', data: raw };
        } else {
          entry = { title: piece.title, format: piece.format, type: 'text', data: raw };
        }
        state.pack.push(entry);
        setStep(stepIdx, { status: 'done' });
      } catch (e) {
        if (/limit reached/i.test(e.message)) {
          setStep(stepIdx, { status: 'error', note: 'daily limit reached' });
          state.error = e.message + (state.pack.length ? ' Your finished pieces are below.' : '');
          break;
        }
        setStep(stepIdx, { status: 'error', note: e.message });
      }
    }

    state.running = false;
    render();
  }

  /* ---- pack export ---- */
  function packToMarkdown() {
    return state.pack.map(p => {
      const head = `## ${FORMATS[p.format].label}: ${p.title}\n\n`;
      const body = p.type === 'tweets'
        ? p.data.map((t, i) => `${i + 1}/ ${t}`).join('\n\n')
        : String(p.data);
      return head + body;
    }).join('\n\n---\n\n');
  }
  function copyAll() {
    navigator.clipboard?.writeText(packToMarkdown()).then(() =>
      window.app?.showToast ? window.app.showToast('Content pack copied!', 'success') : null);
  }
  function downloadPack() {
    const blob = new Blob([packToMarkdown()], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'content-pack.md';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function copyOne(i) {
    const p = state.pack[i]; if (!p) return;
    const text = p.type === 'tweets' ? p.data.map((t, n) => `${n + 1}/ ${t}`).join('\n\n') : String(p.data);
    navigator.clipboard?.writeText(text).then(() =>
      window.app?.showToast ? window.app.showToast('Copied!', 'success') : null);
  }
  function useGeneratorTranscript() {
    const ta = document.getElementById('transcript');
    if (ta && ta.value.trim()) {
      state.transcript = ta.value;
      render();
      if (window.app?.showToast) window.app.showToast('Loaded the Generator transcript.', 'info');
    } else if (window.app?.showToast) {
      window.app.showToast('The Generator transcript is empty.', 'warn');
    }
  }

  function toggleFormat(f) { state.formats[f] = !state.formats[f]; render(); }

  /* ---- render ---- */
  function render() {
    const root = document.getElementById('agent-container');
    if (!root) return;
    const { running, steps, pack, error } = state;

    let html = `
      <div class="ag-card">
        <div class="ag-label">EPISODE TRANSCRIPT</div>
        <textarea id="ag-input" class="ag-input" placeholder="Paste a transcript, or load it from the Generator. The agent plans a content pack, then writes every piece.">${esc(state.transcript)}</textarea>
        <div class="ag-controls">
          <div class="ag-formats">`;
    Object.entries(FORMATS).forEach(([f, meta]) => {
      html += `<button class="ag-chip ${state.formats[f] ? 'on' : ''}" onclick="agentToggleFormat('${f}')">${meta.icon} ${esc(meta.label)}</button>`;
    });
    html += `
          </div>
          <div class="ag-run-row">
            <label class="ag-count">Pieces
              <input id="ag-count" type="number" min="1" max="8" value="${state.count}">
            </label>
            <button class="ag-link" onclick="agentUseGenerator()">⇪ Use Generator transcript</button>
            <button class="ag-run ${running ? 'loading' : ''}" id="ag-run" ${running ? 'disabled' : ''}>
              ${running ? 'Agent working…' : '🤖 Run agent'}
            </button>
          </div>
        </div>
      </div>`;

    if (steps.length) {
      html += `<div class="ag-steps">`;
      steps.forEach(s => {
        const ic = s.status === 'done' ? '✅' : s.status === 'error' ? '⚠️' : '<span class="ag-spin"></span>';
        html += `<div class="ag-step ag-${s.status}"><span class="ag-step-ic">${ic}</span><span class="ag-step-tx">${esc(s.label)}${s.note ? ` — ${esc(s.note)}` : ''}</span></div>`;
      });
      html += `</div>`;
    }

    if (error) html += `<div class="ag-error">${esc(error)}</div>`;

    if (pack.length) {
      html += `<div class="ag-pack-bar"><div class="ag-pack-title">Content pack · ${pack.length} piece${pack.length > 1 ? 's' : ''}</div>
        <div><button class="ag-copyall" onclick="agentCopyAll()">📋 Copy all</button>
        <button class="ag-dl" onclick="agentDownload()">⬇ Download .md</button></div></div>`;
      html += `<div class="ag-pack">`;
      pack.forEach((p, i) => {
        html += `<div class="ag-piece">
          <div class="ag-piece-head"><span class="ag-piece-fmt">${FORMATS[p.format].icon} ${esc(FORMATS[p.format].label)}</span>
            <span class="ag-piece-title">${esc(p.title)}</span>
            <button class="ag-piece-copy" onclick="agentCopyOne(${i})">Copy</button></div>`;
        if (p.type === 'tweets') {
          html += `<div class="ag-piece-body">`;
          p.data.forEach((t, n) => { html += `<div class="ag-tweet"><span class="ag-tweet-n">${n + 1}/${p.data.length}</span>${esc(t)}</div>`; });
          html += `</div>`;
        } else {
          html += `<div class="ag-piece-body ag-text">${esc(p.data)}</div>`;
        }
        html += `</div>`;
      });
      html += `</div>`;
    }

    root.innerHTML = html + (document.getElementById('agent-lock')?.outerHTML || '');

    const ta = document.getElementById('ag-input');
    if (ta) ta.addEventListener('input', (e) => { state.transcript = e.target.value; });
    const cnt = document.getElementById('ag-count');
    if (cnt) cnt.addEventListener('input', (e) => { state.count = e.target.value; });
    const btn = document.getElementById('ag-run');
    if (btn) btn.addEventListener('click', run);
  }

  function injectStyles() {
    if (document.getElementById('agent-styles')) return;
    const s = document.createElement('style');
    s.id = 'agent-styles';
    s.textContent = `
      #agent-container { position:relative; display:flex; flex-direction:column; gap:16px; }
      .ag-card { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); padding:18px 20px; }
      .ag-label { font:600 11px/1 ui-monospace,monospace; letter-spacing:.14em; color:var(--text-muted); margin-bottom:10px; }
      .ag-input { width:100%; min-height:120px; box-sizing:border-box; resize:vertical; background:var(--bg-input); border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--text-primary); font:400 14px/1.6 inherit; padding:12px 14px; outline:none; }
      .ag-input:focus { border-color:var(--accent-violet); }
      .ag-controls { margin-top:12px; display:flex; flex-direction:column; gap:12px; }
      .ag-formats { display:flex; flex-wrap:wrap; gap:8px; }
      .ag-chip { background:transparent; border:1px solid var(--border); color:var(--text-secondary); border-radius:999px; padding:6px 13px; font:500 12.5px/1 inherit; cursor:pointer; transition:.15s; }
      .ag-chip:hover { color:var(--text-primary); border-color:var(--accent-violet); }
      .ag-chip.on { background:rgba(124,58,237,.15); border-color:rgba(124,58,237,.45); color:var(--accent-violet2); }
      .ag-run-row { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
      .ag-count { font:600 12px/1 ui-monospace,monospace; color:var(--text-muted); display:flex; align-items:center; gap:8px; }
      .ag-count input { width:56px; background:var(--bg-input); border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--text-primary); font:inherit; padding:7px 8px; outline:none; }
      .ag-link { background:none; border:none; color:var(--text-secondary); font:600 12.5px/1 inherit; cursor:pointer; text-decoration:underline; text-underline-offset:2px; }
      .ag-link:hover { color:var(--text-primary); }
      .ag-run { margin-left:auto; background:linear-gradient(135deg,var(--accent-violet),#5b21b6); color:#fff; border:none; border-radius:var(--radius-sm); padding:11px 22px; font:700 14px/1 inherit; cursor:pointer; transition:.2s; box-shadow:var(--shadow-glow-violet); }
      .ag-run:hover:not(:disabled) { transform:translateY(-1px); }
      .ag-run:disabled { opacity:.7; cursor:default; }
      .ag-steps { display:flex; flex-direction:column; gap:8px; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); padding:14px 18px; }
      .ag-step { display:flex; align-items:center; gap:10px; font:400 13px/1.4 inherit; color:var(--text-secondary); }
      .ag-step.ag-done { color:var(--text-primary); }
      .ag-step.ag-error { color:#fca5a5; }
      .ag-step-ic { width:16px; display:inline-flex; justify-content:center; flex-shrink:0; }
      .ag-spin { width:12px; height:12px; border:2px solid rgba(255,255,255,.25); border-top-color:var(--accent-violet2); border-radius:50%; display:inline-block; animation:ag-spin .7s linear infinite; }
      @keyframes ag-spin { to { transform:rotate(360deg); } }
      .ag-error { background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.3); color:#fca5a5; border-radius:var(--radius-sm); padding:12px 14px; font-size:13px; }
      .ag-pack-bar { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; }
      .ag-pack-title { font:700 14px/1 inherit; color:var(--text-primary); }
      .ag-copyall, .ag-dl { background:rgba(255,255,255,.05); border:1px solid var(--border); color:var(--text-secondary); border-radius:var(--radius-sm); padding:7px 12px; font:600 12px/1 inherit; cursor:pointer; margin-left:6px; }
      .ag-copyall:hover, .ag-dl:hover { color:var(--text-primary); border-color:var(--accent-violet); }
      .ag-pack { display:flex; flex-direction:column; gap:12px; }
      .ag-piece { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); overflow:hidden; }
      .ag-piece-head { display:flex; align-items:center; gap:10px; padding:12px 16px; border-bottom:1px solid var(--border); background:rgba(255,255,255,.02); }
      .ag-piece-fmt { font:700 10.5px/1 ui-monospace,monospace; letter-spacing:.04em; color:var(--accent-violet2); white-space:nowrap; }
      .ag-piece-title { flex:1; min-width:0; font:600 13.5px/1.3 inherit; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .ag-piece-copy { background:transparent; border:1px solid var(--border); color:var(--text-secondary); border-radius:5px; padding:5px 11px; font:600 11.5px/1 inherit; cursor:pointer; }
      .ag-piece-copy:hover { color:var(--text-primary); border-color:var(--accent-violet); }
      .ag-piece-body { padding:14px 16px; }
      .ag-text { white-space:pre-wrap; font:400 13.5px/1.7 inherit; color:var(--text-primary); }
      .ag-tweet { padding:9px 0; border-bottom:1px solid var(--border); font:400 13.5px/1.55 inherit; color:var(--text-primary); white-space:pre-wrap; }
      .ag-tweet:last-child { border-bottom:none; }
      .ag-tweet-n { display:block; font:600 10px/1 ui-monospace,monospace; color:var(--accent-cyan,#06b6d4); margin-bottom:4px; }
      @media (prefers-reduced-motion: reduce) { .ag-spin { animation:none; } }
    `;
    document.head.appendChild(s);
  }

  window.agentToggleFormat = toggleFormat;
  window.agentUseGenerator = useGeneratorTranscript;
  window.agentCopyAll = copyAll;
  window.agentDownload = downloadPack;
  window.agentCopyOne = copyOne;

  function boot() {
    if (!document.getElementById('agent-container')) return;
    injectStyles();
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
