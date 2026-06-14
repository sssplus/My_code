/* ============================================================
   PodcastForge — Discover Podcasts
   Search Apple's podcast catalog by field/category. Runs through
   the backend (/api/discover), which filters out explicit-flagged
   shows. Mounts into #discover-container.
   ============================================================ */
(function () {
  'use strict';

  const esc = window.escapeHTML || ((s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;'));

  const CATEGORIES = ['Technology', 'Business', 'Comedy', 'News', 'Health & Fitness',
    'Education', 'Arts', 'Science', 'Sports', 'Society & Culture', 'True Crime', 'Music'];

  let state = { term: '', genre: '', loading: false, results: [], error: '', filtered: 0, searched: false };

  async function search() {
    const term = (document.getElementById('dc-input')?.value || '').trim();
    state.term = term;
    if (!term && !state.genre) { state.error = 'Type a search term or pick a category.'; render(); return; }
    if (!(window.PF && window.PF.isAuthed && window.PF.isAuthed())) {
      state.error = 'Sign in to search podcasts.'; render(); return;
    }
    state.loading = true; state.error = ''; render();
    try {
      const d = await window.PF.discover(term, state.genre);
      state.results = d.results;
      state.filtered = d.filtered;
      state.searched = true;
    } catch (e) {
      state.error = e.message || 'Search failed.';
    } finally {
      state.loading = false; render();
    }
  }

  function pickCategory(cat) {
    state.genre = state.genre === cat ? '' : cat;
    render();
    search();
  }

  function copyFeed(i) {
    const r = state.results[i]; if (!r || !r.feedUrl) return;
    navigator.clipboard?.writeText(r.feedUrl).then(() =>
      window.app?.showToast ? window.app.showToast('RSS feed URL copied.', 'success') : null);
  }

  function render() {
    const root = document.getElementById('discover-container');
    if (!root) return;
    const { loading, results, error, searched } = state;

    let html = `
      <div class="dc-card">
        <div class="dc-searchrow">
          <input id="dc-input" class="dc-input" type="text" placeholder="Search podcasts (e.g. indie hacking, mindfulness, AI)…" value="${esc(state.term)}">
          <button class="dc-btn ${loading ? 'loading' : ''}" id="dc-go" ${loading ? 'disabled' : ''}>${loading ? 'Searching…' : '🔍 Search'}</button>
        </div>
        <div class="dc-cats">`;
    CATEGORIES.forEach(c => {
      html += `<button class="dc-cat ${state.genre === c ? 'on' : ''}" onclick="discoverPick('${esc(c)}')">${esc(c)}</button>`;
    });
    html += `</div></div>`;

    if (error) html += `<div class="dc-error">${esc(error)}</div>`;

    if (searched && !results.length && !loading && !error) {
      html += `<div class="dc-empty">No family-friendly podcasts matched. Try different terms.</div>`;
    }

    if (results.length) {
      if (state.filtered > 0) html += `<div class="dc-note">${state.filtered} explicit-flagged result${state.filtered > 1 ? 's' : ''} hidden.</div>`;
      html += `<div class="dc-grid">`;
      results.forEach((r, i) => {
        html += `<div class="dc-pod">
          <div class="dc-art" style="background-image:url('${esc(r.artwork)}')"></div>
          <div class="dc-info">
            <div class="dc-name" title="${esc(r.name)}">${esc(r.name)}</div>
            <div class="dc-artist">${esc(r.artist)}</div>
            <div class="dc-meta">${r.genre ? `<span class="dc-genre">${esc(r.genre)}</span>` : ''}${r.episodes ? `<span class="dc-eps">${r.episodes} eps</span>` : ''}</div>
            <div class="dc-actions">
              ${r.link ? `<a class="dc-open" href="${esc(r.link)}" target="_blank" rel="noopener noreferrer">Open ↗</a>` : ''}
              ${r.feedUrl ? `<button class="dc-feed" onclick="discoverTranscripts(${i})">Transcripts</button>` : ''}
              ${r.feedUrl ? `<button class="dc-feed" onclick="discoverCopyFeed(${i})">Copy RSS</button>` : ''}
            </div>
          </div>
        </div>`;
      });
      html += `</div>`;
    }

    html += `<div class="dc-foot">Results from Apple Podcasts · explicit-flagged shows are filtered out.</div>`;
    root.innerHTML = html + (document.getElementById('discover-lock')?.outerHTML || '');

    const input = document.getElementById('dc-input');
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
    const go = document.getElementById('dc-go');
    if (go) go.addEventListener('click', search);
  }

  function injectStyles() {
    if (document.getElementById('discover-styles')) return;
    const s = document.createElement('style');
    s.id = 'discover-styles';
    s.textContent = `
      #discover-container { position:relative; display:flex; flex-direction:column; gap:14px; }
      .dc-card { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); padding:18px 20px; }
      .dc-searchrow { display:flex; gap:10px; flex-wrap:wrap; }
      .dc-input { flex:1; min-width:200px; background:var(--bg-input); border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--text-primary); font:400 14px/1.4 inherit; padding:11px 14px; outline:none; }
      .dc-input:focus { border-color:var(--accent-violet); }
      .dc-btn { background:linear-gradient(135deg,var(--accent-violet),#5b21b6); color:#fff; border:none; border-radius:var(--radius-sm); padding:11px 20px; font:700 13.5px/1 inherit; cursor:pointer; }
      .dc-btn:disabled { opacity:.7; cursor:default; }
      .dc-cats { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
      .dc-cat { background:transparent; border:1px solid var(--border); color:var(--text-secondary); border-radius:999px; padding:6px 13px; font:500 12px/1 inherit; cursor:pointer; transition:.15s; }
      .dc-cat:hover { color:var(--text-primary); border-color:var(--accent-cyan2); }
      .dc-cat.on { background:rgba(6,182,212,.15); border-color:rgba(6,182,212,.45); color:var(--accent-cyan2); }
      .dc-error { background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.3); color:#fca5a5; border-radius:var(--radius-sm); padding:12px 14px; font-size:13px; }
      .dc-empty, .dc-note, .dc-foot { color:var(--text-muted); font-size:12.5px; }
      .dc-empty { text-align:center; padding:24px; }
      .dc-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px; }
      .dc-pod { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); overflow:hidden; transition:.15s; }
      .dc-pod:hover { border-color:var(--accent-cyan2); transform:translateY(-2px); }
      .dc-art { width:100%; aspect-ratio:1/1; background:var(--bg-input) center/cover no-repeat; }
      .dc-info { padding:12px 14px; }
      .dc-name { font:600 13.5px/1.3 inherit; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .dc-artist { font:400 12px/1.4 inherit; color:var(--text-secondary); margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .dc-meta { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
      .dc-genre { font:600 10px/1 ui-monospace,monospace; background:rgba(124,58,237,.14); color:var(--accent-violet2); border-radius:4px; padding:3px 7px; }
      .dc-eps { font:600 10px/1 ui-monospace,monospace; background:var(--bg-input); color:var(--text-muted); border-radius:4px; padding:3px 7px; }
      .dc-actions { display:flex; gap:8px; margin-top:10px; }
      .dc-open { color:var(--accent-cyan2); text-decoration:none; font:600 12px/1 inherit; padding:6px 0; }
      .dc-open:hover { text-decoration:underline; }
      .dc-feed { background:transparent; border:1px solid var(--border); color:var(--text-secondary); border-radius:5px; padding:5px 10px; font:600 11.5px/1 inherit; cursor:pointer; }
      .dc-feed:hover { color:var(--text-primary); border-color:var(--accent-violet); }
    `;
    document.head.appendChild(s);
  }

  function openTranscripts(i) {
    const r = state.results[i];
    if (r && r.feedUrl && window.transcriptLoadFeed) window.transcriptLoadFeed(r.feedUrl);
  }

  window.discoverPick = pickCategory;
  window.discoverCopyFeed = copyFeed;
  window.discoverTranscripts = openTranscripts;

  function boot() {
    if (!document.getElementById('discover-container')) return;
    injectStyles();
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
