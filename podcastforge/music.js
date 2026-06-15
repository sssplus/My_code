/* ============================================================
   PodcastForge — Music Brief
   The AI listens to your episode's vibe and produces a background-
   music BRIEF: per-segment mood, genre, tempo, instruments and
   search keywords. It does NOT generate audio (no GPU, no license
   risk) — instead it seeds keyword searches into reputable royalty-
   free libraries so you pick a track with verified licensing.
   Routes through window.app.callAI(..., 'music'). Mounts into
   #music-container.
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
    return window.app.callAI(sys, usr, 'music');
  };
  const hasKey = () => (window.app && typeof window.app.hasKey === 'function')
    ? window.app.hasKey() : !!localStorage.getItem('pf_api_key');
  const SOURCES = Array.isArray(window.PF_MUSIC_SOURCES) ? window.PF_MUSIC_SOURCES : [];

  const SYS =
    'You are a music supervisor for podcasts and videos. From a transcript or episode description, design a background-music brief. ' +
    'Do not name real copyrighted songs or artists. Return ONLY JSON, no fences: ' +
    '{"overall":{"genre":"","mood":"","bpm":"","energy":"low|medium|high","notes":""},' +
    '"segments":[{"name":"e.g. Intro","mood":"","genre":"","bpm":"","instruments":"","keywords":["term","term"],"note":"one tip"}]}. ' +
    'Use 3–6 segments (intro, body sections, transitions, outro as appropriate). Keywords must be generic search terms suitable for a royalty-free library.';

  let state = { input: '', loading: false, brief: null, error: '' };

  async function run() {
    if (!hasKey()) { state.error = 'Add your API key at the top of the workspace first.'; render(); document.getElementById('api-key-input')?.focus(); return; }
    const text = state.input.trim();
    if (text.length < 40) { state.error = 'Describe the episode or paste a transcript (a sentence or two minimum).'; render(); return; }
    state.loading = true; state.error = ''; state.brief = null; render();
    try {
      const raw = await callAI(SYS, text.slice(0, 12000));
      const parsed = parseJSON(raw);
      state.brief = {
        overall: parsed.overall || {},
        segments: Array.isArray(parsed.segments) ? parsed.segments.slice(0, 8) : []
      };
      if (!state.brief.segments.length) throw new Error('No segments returned — try again.');
    } catch (e) {
      state.error = /limit reached/i.test(e.message) ? e.message : ('Brief failed: ' + e.message);
    } finally {
      state.loading = false; render();
    }
  }

  function keywordsFor(seg) {
    const kw = Array.isArray(seg.keywords) ? seg.keywords : [];
    return kw.length ? kw : [seg.mood, seg.genre].filter(Boolean);
  }
  function searchLinks(seg) {
    const q = keywordsFor(seg).join(' ');
    return SOURCES.map(s =>
      `<a class="mu-src" href="${esc(s.search(q))}" target="_blank" rel="noopener noreferrer" title="${esc(s.license)} — ${esc(s.note)}">${esc(s.name)} ↗</a>`
    ).join('');
  }

  function render() {
    const root = document.getElementById('music-container');
    if (!root) return;
    const { loading, brief, error } = state;

    let html = `
      <div class="mu-card">
        <div class="mu-label">EPISODE TRANSCRIPT OR DESCRIPTION</div>
        <textarea id="mu-input" class="mu-input" placeholder="Paste a transcript, or describe the episode and the vibe you want (e.g. 'a calm solo episode about morning routines, warm and reflective').">${esc(state.input)}</textarea>
        <div class="mu-row">
          <span class="mu-hint">🎵 Generates a music brief + royalty-free search links. No audio is generated.</span>
          <button class="mu-run ${loading ? 'loading' : ''}" id="mu-run" ${loading ? 'disabled' : ''}>${loading ? 'Composing brief…' : '🎚️ Build music brief'}</button>
        </div>
      </div>`;

    if (error) html += `<div class="mu-error">${esc(error)}</div>`;

    if (brief) {
      const o = brief.overall || {};
      html += `<div class="mu-card mu-overall">
        <div class="mu-label">OVERALL DIRECTION</div>
        <div class="mu-tags">
          ${o.genre ? `<span class="mu-tag">🎼 ${esc(o.genre)}</span>` : ''}
          ${o.mood ? `<span class="mu-tag">🎭 ${esc(o.mood)}</span>` : ''}
          ${o.bpm ? `<span class="mu-tag">⏱ ${esc(o.bpm)} BPM</span>` : ''}
          ${o.energy ? `<span class="mu-tag">⚡ ${esc(o.energy)} energy</span>` : ''}
        </div>
        ${o.notes ? `<div class="mu-notes">${esc(o.notes)}</div>` : ''}
      </div>`;

      html += `<div class="mu-segs">`;
      brief.segments.forEach(seg => {
        html += `<div class="mu-seg">
          <div class="mu-seg-head"><span class="mu-seg-name">${esc(seg.name || 'Segment')}</span>
            ${seg.bpm ? `<span class="mu-seg-bpm">${esc(seg.bpm)} BPM</span>` : ''}</div>
          <div class="mu-seg-meta">
            ${seg.mood ? `<span>${esc(seg.mood)}</span>` : ''}
            ${seg.genre ? `<span>· ${esc(seg.genre)}</span>` : ''}
            ${seg.instruments ? `<span>· ${esc(seg.instruments)}</span>` : ''}
          </div>
          ${seg.note ? `<div class="mu-seg-note">${esc(seg.note)}</div>` : ''}
          <div class="mu-kw">${keywordsFor(seg).map(k => `<span class="mu-kwt">${esc(k)}</span>`).join('')}</div>
          <div class="mu-srcs"><span class="mu-srcs-label">Find royalty-free tracks:</span> ${searchLinks(seg)}</div>
        </div>`;
      });
      html += `</div>`;

      html += `<div class="mu-foot">Always confirm each track’s license at the source. CC-BY tracks require crediting the artist.</div>`;
    }

    root.innerHTML = html + (document.getElementById('music-lock')?.outerHTML || '');
    const ta = document.getElementById('mu-input');
    if (ta) ta.addEventListener('input', (e) => { state.input = e.target.value; });
    const btn = document.getElementById('mu-run');
    if (btn) btn.addEventListener('click', run);
  }

  function injectStyles() {
    if (document.getElementById('music-styles')) return;
    const s = document.createElement('style');
    s.id = 'music-styles';
    s.textContent = `
      #music-container { position:relative; display:flex; flex-direction:column; gap:14px; }
      .mu-card { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); padding:18px 20px; }
      .mu-label { font:600 11px/1 ui-monospace,monospace; letter-spacing:.14em; color:var(--text-muted); margin-bottom:10px; }
      .mu-input { width:100%; min-height:96px; box-sizing:border-box; resize:vertical; background:var(--bg-input); border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--text-primary); font:400 14px/1.6 inherit; padding:12px 14px; outline:none; }
      .mu-input:focus { border-color:var(--accent-violet); }
      .mu-row { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:12px; flex-wrap:wrap; }
      .mu-hint { font:400 12px/1.4 inherit; color:var(--text-muted); }
      .mu-run { background:linear-gradient(135deg,var(--accent-violet),#5b21b6); color:#fff; border:none; border-radius:var(--radius-sm); padding:11px 20px; font:700 13.5px/1 inherit; cursor:pointer; transition:.2s; }
      .mu-run:hover:not(:disabled) { transform:translateY(-1px); }
      .mu-run:disabled { opacity:.7; cursor:default; }
      .mu-error { background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.3); color:#fca5a5; border-radius:var(--radius-sm); padding:12px 14px; font-size:13px; }
      .mu-overall .mu-tags { display:flex; flex-wrap:wrap; gap:8px; }
      .mu-tag { background:rgba(124,58,237,.14); border:1px solid rgba(124,58,237,.3); color:var(--accent-violet2); border-radius:999px; padding:6px 12px; font:600 12px/1 inherit; }
      .mu-notes { margin-top:10px; font:400 13px/1.6 inherit; color:var(--text-secondary); }
      .mu-segs { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:12px; }
      .mu-seg { background:var(--bg-card); border:1px solid var(--border); border-left:3px solid var(--accent-cyan,#06b6d4); border-radius:var(--radius-md); padding:14px 16px; }
      .mu-seg-head { display:flex; justify-content:space-between; align-items:center; gap:8px; }
      .mu-seg-name { font:700 14px/1.2 inherit; color:var(--text-primary); }
      .mu-seg-bpm { font:600 11px/1 ui-monospace,monospace; color:var(--text-muted); }
      .mu-seg-meta { font:400 12.5px/1.5 inherit; color:var(--text-secondary); margin-top:4px; display:flex; flex-wrap:wrap; gap:4px; }
      .mu-seg-note { font:italic 400 12.5px/1.5 inherit; color:var(--text-muted); margin-top:8px; }
      .mu-kw { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
      .mu-kwt { background:var(--bg-input); border:1px solid var(--border); color:var(--text-secondary); border-radius:5px; padding:3px 8px; font:500 11px/1 ui-monospace,monospace; }
      .mu-srcs { margin-top:12px; font-size:12px; }
      .mu-srcs-label { color:var(--text-muted); display:block; margin-bottom:6px; font-weight:600; }
      .mu-src { display:inline-block; margin:0 8px 6px 0; color:var(--accent-cyan2,#22d3ee); text-decoration:none; font-weight:600; }
      .mu-src:hover { text-decoration:underline; }
      .mu-foot { font:400 11.5px/1.5 inherit; color:var(--text-muted); padding-top:6px; }
    `;
    document.head.appendChild(s);
  }

  function boot() {
    if (!document.getElementById('music-container')) return;
    injectStyles();
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
