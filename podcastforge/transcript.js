/* ============================================================
   PodcastForge — Transcript Puller
   Given a podcast RSS feed (from Discover or pasted), lists episodes
   and pulls EXISTING transcripts (podcast:transcript) as clean text,
   then hands them to the Generator / Miner / Agent. The backend
   filters explicit/NSFW feeds and episodes. Mounts into
   #transcript-container.
   ============================================================ */
(function () {
  'use strict';

  const esc = window.escapeHTML || ((s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;'));

  let state = { feedUrl: '', loading: false, podcast: null, episodes: [], error: '',
    pulling: -1, transcript: '', transcriptTitle: '' };

  async function loadEpisodes() {
    const feedUrl = (document.getElementById('tr-feed')?.value || state.feedUrl).trim();
    state.feedUrl = feedUrl;
    if (!feedUrl) { state.error = 'Paste a podcast RSS feed URL (or use “Transcripts” from Discover).'; render(); return; }
    if (!(window.PF && window.PF.isAuthed && window.PF.isAuthed())) { state.error = 'Sign in to pull transcripts.'; render(); return; }
    state.loading = true; state.error = ''; state.episodes = []; state.transcript = ''; render();
    try {
      const d = await window.PF.podcastEpisodes(feedUrl);
      state.podcast = d.podcast; state.episodes = d.episodes || [];
      if (!state.episodes.some(e => e.hasTranscript)) {
        state.error = 'No episodes in this feed publish transcripts. Try another podcast.';
      }
    } catch (e) {
      state.error = e.message || 'Could not load this feed.';
    } finally {
      state.loading = false; render();
    }
  }

  async function pull(i) {
    const ep = state.episodes[i];
    if (!ep || !ep.transcriptUrl) return;
    state.pulling = i; state.transcript = ''; state.error = ''; render();
    try {
      const text = await window.PF.podcastTranscript(ep.transcriptUrl);
      state.transcript = text; state.transcriptTitle = ep.title;
    } catch (e) {
      state.error = e.message || 'Could not pull that transcript.';
    } finally {
      state.pulling = -1; render();
    }
  }

  function sendTo(where) {
    if (!state.transcript) return;
    const map = { generator: 'transcript', miner: 'miner-input', agent: 'ag-input' };
    const id = map[where];
    const el = document.getElementById(id);
    if (el) {
      el.value = state.transcript;
      el.dispatchEvent(new Event('input'));
      if (window.pfRouter) pfRouter.go(where);            // navigate to that tool's page
      else document.getElementById(where === 'generator' ? 'app' : where)?.scrollIntoView({ behavior: 'smooth' });
      if (window.app && window.app.showToast) window.app.showToast(`Transcript loaded into the ${where}.`, 'success');
    }
  }
  function copyTranscript() {
    navigator.clipboard?.writeText(state.transcript).then(() =>
      window.app?.showToast ? window.app.showToast('Transcript copied.', 'success') : null);
  }

  function render() {
    const root = document.getElementById('transcript-container');
    if (!root) return;
    const { loading, episodes, error, podcast, transcript } = state;

    let html = `
      <div class="tr-card">
        <div class="tr-label">PODCAST RSS FEED URL</div>
        <div class="tr-row">
          <input id="tr-feed" class="tr-input" type="text" placeholder="https://…/feed.xml  (or click “Transcripts” on a Discover result)" value="${esc(state.feedUrl)}">
          <button class="tr-btn ${loading ? 'loading' : ''}" id="tr-load" ${loading ? 'disabled' : ''}>${loading ? 'Loading…' : 'Load episodes'}</button>
        </div>
        <div class="tr-hint">Pulls transcripts publishers already provide (podcast:transcript). Explicit/NSFW shows are blocked.</div>
      </div>`;

    if (error) html += `<div class="tr-error">${esc(error)}</div>`;

    if (podcast && episodes.length) {
      html += `<div class="tr-pod">${esc(podcast.title || 'Podcast')}</div><div class="tr-eps">`;
      episodes.forEach((ep, i) => {
        const can = ep.hasTranscript;
        html += `<div class="tr-ep ${can ? '' : 'tr-ep-no'}">
          <div class="tr-ep-main">
            <div class="tr-ep-title">${esc(ep.title)}</div>
            <div class="tr-ep-desc">${esc(ep.description || '')}</div>
          </div>
          ${can
            ? `<button class="tr-pull" ${state.pulling === i ? 'disabled' : ''} onclick="transcriptPull(${i})">${state.pulling === i ? 'Pulling…' : 'Get transcript'}</button>`
            : `<span class="tr-none">no transcript</span>`}
        </div>`;
      });
      html += `</div>`;
    }

    if (transcript) {
      html += `<div class="tr-out-card">
        <div class="tr-out-head"><span>📄 ${esc(state.transcriptTitle)}</span>
          <span class="tr-out-actions">
            <button class="tr-send" onclick="transcriptSend('generator')">→ Generator</button>
            <button class="tr-send" onclick="transcriptSend('agent')">→ Agent</button>
            <button class="tr-send" onclick="transcriptSend('miner')">→ Miner</button>
            <button class="tr-copy" onclick="transcriptCopy()">Copy</button>
          </span></div>
        <div class="tr-out">${esc(transcript.slice(0, 20000))}${transcript.length > 20000 ? '…' : ''}</div>
      </div>`;
    }

    root.innerHTML = html + (document.getElementById('transcript-lock')?.outerHTML || '');
    const input = document.getElementById('tr-feed');
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); loadEpisodes(); } });
    const btn = document.getElementById('tr-load');
    if (btn) btn.addEventListener('click', loadEpisodes);
  }

  function injectStyles() {
    if (document.getElementById('transcript-styles')) return;
    const s = document.createElement('style');
    s.id = 'transcript-styles';
    s.textContent = `
      #transcript-container { position:relative; display:flex; flex-direction:column; gap:14px; }
      .tr-card { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); padding:18px 20px; }
      .tr-label { font:600 11px/1 ui-monospace,monospace; letter-spacing:.14em; color:var(--text-muted); margin-bottom:10px; }
      .tr-row { display:flex; gap:10px; flex-wrap:wrap; }
      .tr-input { flex:1; min-width:220px; background:var(--bg-input); border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--text-primary); font:400 13.5px/1.4 inherit; padding:11px 14px; outline:none; }
      .tr-input:focus { border-color:var(--accent-violet); }
      .tr-btn { background:linear-gradient(135deg,var(--accent-violet),#5b21b6); color:#fff; border:none; border-radius:var(--radius-sm); padding:11px 18px; font:700 13.5px/1 inherit; cursor:pointer; }
      .tr-btn:disabled { opacity:.7; cursor:default; }
      .tr-hint { font:400 12px/1.4 inherit; color:var(--text-muted); margin-top:10px; }
      .tr-error { background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.3); color:#fca5a5; border-radius:var(--radius-sm); padding:12px 14px; font-size:13px; }
      .tr-pod { font:700 16px/1.2 inherit; color:var(--text-primary); }
      .tr-eps { display:flex; flex-direction:column; gap:8px; }
      .tr-ep { display:flex; align-items:center; gap:14px; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); padding:13px 16px; }
      .tr-ep-no { opacity:.6; }
      .tr-ep-main { flex:1; min-width:0; }
      .tr-ep-title { font:600 13.5px/1.3 inherit; color:var(--text-primary); }
      .tr-ep-desc { font:400 12px/1.5 inherit; color:var(--text-muted); margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .tr-pull { background:rgba(124,58,237,.15); border:1px solid rgba(124,58,237,.4); color:var(--accent-violet2); border-radius:var(--radius-sm); padding:8px 13px; font:700 12px/1 inherit; cursor:pointer; flex-shrink:0; }
      .tr-pull:hover:not(:disabled) { background:rgba(124,58,237,.25); }
      .tr-pull:disabled { opacity:.6; cursor:default; }
      .tr-none { font:500 11.5px/1 inherit; color:var(--text-muted); flex-shrink:0; }
      .tr-out-card { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); overflow:hidden; }
      .tr-out-head { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:12px 16px; border-bottom:1px solid var(--border); background:rgba(255,255,255,.02); flex-wrap:wrap; }
      .tr-out-head > span:first-child { font:600 13px/1.3 inherit; color:var(--text-primary); }
      .tr-out-actions { display:flex; gap:6px; flex-wrap:wrap; }
      .tr-send, .tr-copy { background:rgba(255,255,255,.05); border:1px solid var(--border); color:var(--text-secondary); border-radius:5px; padding:6px 10px; font:600 11.5px/1 inherit; cursor:pointer; }
      .tr-send:hover, .tr-copy:hover { color:var(--text-primary); border-color:var(--accent-violet); }
      .tr-out { padding:14px 16px; max-height:320px; overflow:auto; white-space:pre-wrap; font:400 13px/1.7 inherit; color:var(--text-primary); }
    `;
    document.head.appendChild(s);
  }

  // Called from Discover's "Transcripts" button.
  window.transcriptLoadFeed = function (feedUrl) {
    state.feedUrl = feedUrl;
    const input = document.getElementById('tr-feed');
    if (input) input.value = feedUrl;
    if (window.pfRouter) pfRouter.go('transcripts');
    else document.getElementById('transcripts')?.scrollIntoView({ behavior: 'smooth' });
    loadEpisodes();
  };
  window.transcriptPull = pull;
  window.transcriptSend = sendTo;
  window.transcriptCopy = copyTranscript;

  function boot() {
    if (!document.getElementById('transcript-container')) return;
    injectStyles();
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
