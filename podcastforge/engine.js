/* ============================================================
   PodcastForge — Content Miner Engine
   ------------------------------------------------------------
   The piece that overcomes the 15k-char single-call ceiling.

   Instead of summarising a long episode into one output, it:
     1. CHUNK   — splits the full transcript into sections
     2. MAP     — mines EACH section for every postable moment
     3. REDUCE  — dedupes, merges and ranks across all sections
     4. DRAFT   — expands any single moment into a finished asset

   This is what lets a 2–6 hour episode yield "here are the 14
   things worth posting, ranked" rather than 3 generic outputs.

   Integration: depends only on the host app exposing
     window.app.callAI(systemPrompt, userPrompt)  -> Promise<string>
     window.safeParseJSON(text)                   -> object   (optional)
     window.escapeHTML(str)                        -> string   (optional)
   Mounts into  #miner-container  (mirrors tracker.js).
   ============================================================ */

(function () {
  "use strict";

  /* ---- shared helpers, with safe fallbacks ---- */
  const esc = window.escapeHTML || ((s) => String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;"));

  const parseJSON = window.safeParseJSON || ((text) => {
    const cleaned = String(text).replace(/```json/gi, "").replace(/```/g, "").trim();
    try { return JSON.parse(cleaned); } catch (e) { /* fall through */ }
    const m = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) return JSON.parse(m[0]);
    throw new Error("The model did not return valid JSON.");
  });

  const callAI = (sys, usr) => {
    if (!window.app || typeof window.app.callAI !== "function") {
      return Promise.reject(new Error("AI caller not available. Load app.js first."));
    }
    return window.app.callAI(sys, usr);
  };

  /* ---- tuning ---- */
  const WORDS_PER_CHUNK = 3000;   // ~4k tokens in; comfortably under any provider limit
  const CHUNK_OVERLAP   = 120;    // words of overlap so ideas on a boundary aren't lost
  const MAX_CHUNKS      = 40;     // safety ceiling (~2hrs at WORDS_PER_CHUNK... up to ~6hrs)
  const REDUCE_CAP      = 60;     // most moments fed to the ranking pass

  const FORMATS = {
    blog:     { label: "Blog",     colour: "#9d5cf5" },
    twitter:  { label: "Twitter",  colour: "#22d3ee" },
    linkedin: { label: "LinkedIn", colour: "#38bdf8" },
    reel:     { label: "Reel",     colour: "#f59e0b" },
    quote:    { label: "Quote",    colour: "#10b981" }
  };

  const TS_RE = /\b(?:\d{1,2}:)?[0-5]?\d:[0-5]\d\b/;

  /* ---- state ---- */
  let state = {
    chunks: [],        // [{ text, location }]
    moments: [],       // [{ id, title, angle, hook, bestFormat, score, quote, location, _chunk, theme, draft, drafting, draftFormat, expanded }]
    filter: "all",
    mining: false,
    progress: { done: 0, total: 0 },
    error: "",
    failedChunks: 0
  };
  let momentId = 0;

  /* ---- transcript chunking ---- */
  function chunkTranscript(text) {
    const words = text.trim().split(/\s+/);
    const chunks = [];
    let i = 0;
    while (i < words.length && chunks.length < MAX_CHUNKS) {
      const slice = words.slice(i, i + WORDS_PER_CHUNK);
      const chunkText = slice.join(" ");
      const tsMatch = chunkText.match(TS_RE);
      chunks.push({ text: chunkText, location: tsMatch ? tsMatch[0] : "" });
      i += (WORDS_PER_CHUNK - CHUNK_OVERLAP);
    }
    return chunks;
  }

  function estimate(text) {
    const w = text.trim() ? text.trim().split(/\s+/).length : 0;
    const c = w === 0 ? 0 : Math.min(MAX_CHUNKS, Math.max(1, Math.ceil(w / (WORDS_PER_CHUNK - CHUNK_OVERLAP))));
    return { words: w, chunks: c };
  }

  /* ---- prompts ---- */
  const MAP_SYS =
    "You are a podcast content miner. From ONE SECTION of a transcript, extract every distinct, " +
    "self-contained idea, story, hot take, framework, contrarian opinion, or quotable line that could " +
    "stand alone as its own social or blog post. Granularity is the entire point: do NOT compress the " +
    "section into a single summary — a rich ten-minute stretch may yield 3 to 6 separate moments. " +
    "Ignore intros, sponsor reads, ads, sign-offs and idle small talk. " +
    "Return ONLY a JSON array, no markdown fences. Each element: " +
    '{"title": short label, "angle": one sentence on what makes it postable, ' +
    '"hook": a scroll-stopping opening line a creator could actually post, ' +
    '"bestFormat": one of "blog"|"twitter"|"linkedin"|"reel"|"quote", ' +
    '"score": integer 1-100 for how standalone and postable it is, ' +
    '"quote": the single strongest verbatim line from the transcript for this moment (<=30 words) or "", ' +
    '"location": any timestamp visible near this moment in the text, else ""}. ' +
    "If the section is pure filler, return [].";

  const REDUCE_SYS =
    "You are an editor building a content calendar from moments mined across a long podcast. " +
    "You will receive a JSON array of moments, each with an integer id. " +
    "Merge near-duplicates (same underlying idea appearing in different sections), drop weak or redundant " +
    "items, and rank what remains by postability (strongest first). Group survivors into a few short themes. " +
    "Return ONLY this JSON, no fences: " +
    '{"ranked": [ids strongest-first], "drop": [ids to discard], ' +
    '"merges": [[keepId, dupId, ...]], "themes": {"id": "Theme Name"}}. ' +
    "Refer to moments only by their given id. Do not invent ids.";

  const DRAFT_SYS = {
    blog:     "You are an expert ghostwriter. Expand this podcast moment into a complete, well-structured blog post with a strong title and H2/H3 subheadings. Ground it strictly in the supplied transcript section; do not invent facts. Return only the post as markdown.",
    twitter:  "You are a viral thread writer. Turn this podcast moment into a tight Twitter/X thread. Open with the hook, one idea per tweet, no hashtags spam. Return ONLY a JSON array of strings, one per tweet, no fences.",
    linkedin: "You are a LinkedIn ghostwriter. Turn this podcast moment into one punchy LinkedIn post: short lines, generous spacing, a clear takeaway, a soft prompt to engage at the end. Return only the post text.",
    reel:     "You are a short-video scriptwriter. Turn this podcast moment into a 30–45 second reel/Short script: a 3-second hook, 3–5 spoken beats, and an on-screen-text suggestion per beat. Return only the script.",
    quote:    "You are a quote-card copywriter. From this podcast moment, produce 3 punchy standalone quote-card lines (each under 25 words) suitable for a graphic. Return only the three lines, one per line."
  };

  /* ---- the engine: chunk -> map -> reduce ---- */
  async function mine() {
    const ta = document.getElementById("miner-input");
    const text = (ta ? ta.value : "").trim();

    if (!localStorage.getItem("pf_api_key")) {
      state.error = "Enter your API key in the bar at the top of the workspace to start mining.";
      render();
      document.getElementById("api-key-input")?.focus();
      return;
    }
    if (localStorage.getItem("pf_plan") === "expired" && window.app?.showPaywall) {
      window.app.showPaywall();
      return;
    }
    if (text.length < 200) {
      state.error = "Paste a longer transcript — this engine is built for full episodes, not snippets.";
      render();
      return;
    }

    // reset
    state.chunks = chunkTranscript(text);
    state.moments = [];
    state.filter = "all";
    state.error = "";
    state.failedChunks = 0;
    state.mining = true;
    state.progress = { done: 0, total: state.chunks.length };
    momentId = 0;
    render();

    // MAP — sequential keeps us gentle on free-tier rate limits;
    // callAI already backs off on 429, so one slow key won't nuke the run.
    for (let i = 0; i < state.chunks.length; i++) {
      const chunk = state.chunks[i];
      const usr =
        `SECTION ${i + 1} of ${state.chunks.length}` +
        (chunk.location ? ` (around ${chunk.location})` : "") +
        `:\n\n${chunk.text}`;
      try {
        const raw = await callAI(MAP_SYS, usr);
        const arr = parseJSON(raw);
        if (Array.isArray(arr)) {
          arr.forEach((m) => {
            if (!m || !m.title) return;
            state.moments.push({
              id: momentId++,
              title: String(m.title).slice(0, 140),
              angle: String(m.angle || "").slice(0, 280),
              hook: String(m.hook || "").slice(0, 280),
              bestFormat: FORMATS[m.bestFormat] ? m.bestFormat : "blog",
              score: Math.max(1, Math.min(100, parseInt(m.score, 10) || 50)),
              quote: String(m.quote || "").slice(0, 240),
              location: String(m.location || chunk.location || ""),
              _chunk: i,
              theme: "",
              draft: null,
              drafting: false,
              draftFormat: null,
              expanded: false
            });
          });
        }
      } catch (e) {
        state.failedChunks++;
        console.warn(`Section ${i + 1} failed:`, e.message);
      }
      state.progress.done = i + 1;
      render(); // progressive — moments appear as each section lands
    }

    // REDUCE — only worth it when there's cross-section overlap to resolve
    if (state.moments.length > 1) {
      try {
        await consolidate();
      } catch (e) {
        // fall back to a simple client-side sort; never lose a successful map
        state.moments.sort((a, b) => b.score - a.score);
      }
    }

    state.mining = false;
    if (state.moments.length === 0 && !state.error) {
      state.error = "No standalone moments surfaced. The transcript may be very short or mostly filler.";
    }
    render();
  }

  async function consolidate() {
    // feed the ranking pass a compact view (no transcript text) of the top moments
    const pool = [...state.moments].sort((a, b) => b.score - a.score).slice(0, REDUCE_CAP);
    const compact = pool.map((m) => ({
      id: m.id, title: m.title, angle: m.angle, score: m.score, bestFormat: m.bestFormat
    }));
    const raw = await callAI(REDUCE_SYS, JSON.stringify(compact));
    const plan = parseJSON(raw);

    const byId = new Map(state.moments.map((m) => [m.id, m]));

    // apply merges: keep the first id, fold others in, mark dups for removal
    const removed = new Set();
    if (Array.isArray(plan.merges)) {
      plan.merges.forEach((group) => {
        if (!Array.isArray(group) || group.length < 2) return;
        const keep = byId.get(group[0]);
        if (!keep) return;
        for (let k = 1; k < group.length; k++) {
          const dup = byId.get(group[k]);
          if (dup) { keep.score = Math.max(keep.score, dup.score); removed.add(dup.id); }
        }
      });
    }
    if (Array.isArray(plan.drop)) plan.drop.forEach((id) => removed.add(id));

    // themes
    if (plan.themes && typeof plan.themes === "object") {
      Object.entries(plan.themes).forEach(([id, name]) => {
        const m = byId.get(parseInt(id, 10));
        if (m) m.theme = String(name).slice(0, 60);
      });
    }

    // build final ordered list from the model's ranking, then append any stragglers
    const ordered = [];
    const seen = new Set();
    if (Array.isArray(plan.ranked)) {
      plan.ranked.forEach((id) => {
        const m = byId.get(id);
        if (m && !removed.has(id) && !seen.has(id)) { ordered.push(m); seen.add(id); }
      });
    }
    state.moments
      .filter((m) => !removed.has(m.id) && !seen.has(m.id))
      .sort((a, b) => b.score - a.score)
      .forEach((m) => ordered.push(m));

    state.moments = ordered;
  }

  /* ---- draft a single moment (connects engine -> finished asset) ---- */
  async function draft(id, format) {
    const m = state.moments.find((x) => x.id === id);
    if (!m) return;
    if (!localStorage.getItem("pf_api_key")) {
      document.getElementById("api-key-input")?.focus();
      return;
    }
    m.drafting = true; m.draftFormat = format; m.expanded = true;
    render();

    const source = state.chunks[m._chunk] ? state.chunks[m._chunk].text : "";
    const usr =
      `MOMENT: ${m.title}\nANGLE: ${m.angle}\nHOOK: ${m.hook}\n` +
      (m.quote ? `KEY QUOTE: ${m.quote}\n` : "") +
      `\nTRANSCRIPT SECTION THIS CAME FROM (use only this, do not invent):\n${source}`;

    try {
      const raw = await callAI(DRAFT_SYS[format] || DRAFT_SYS.blog, usr);
      if (format === "twitter") {
        let tweets;
        try { tweets = parseJSON(raw); } catch (e) { tweets = null; }
        m.draft = Array.isArray(tweets) ? { type: "tweets", data: tweets } : { type: "text", data: raw };
      } else {
        m.draft = { type: "text", data: raw };
      }
    } catch (e) {
      m.draft = { type: "error", data: e.message };
    } finally {
      m.drafting = false;
      render();
    }
  }

  function copyDraft(id) {
    const m = state.moments.find((x) => x.id === id);
    if (!m || !m.draft) return;
    let text = "";
    if (m.draft.type === "tweets") text = m.draft.data.map((t, i) => `${i + 1}/ ${t}`).join("\n\n");
    else text = String(m.draft.data);
    navigator.clipboard?.writeText(text).then(
      () => window.app?.showToast ? window.app.showToast("Draft copied!", "success") : null
    );
  }

  function toggle(id) {
    const m = state.moments.find((x) => x.id === id);
    if (m) { m.expanded = !m.expanded; render(); }
  }

  function setFilter(f) { state.filter = f; render(); }

  /* ---- live input counter ---- */
  function updateCounter() {
    const ta = document.getElementById("miner-input");
    const out = document.getElementById("miner-estimate");
    if (!ta || !out) return;
    const { words, chunks } = estimate(ta.value);
    if (words === 0) { out.textContent = ""; return; }
    const hrs = (words / 9000).toFixed(1); // ~150 wpm -> 9k words/hr
    out.innerHTML =
      `${words.toLocaleString()} words · ~${hrs}h of audio · ` +
      `<strong>${chunks} section${chunks === 1 ? "" : "s"}</strong> → ${chunks} AI call${chunks === 1 ? "" : "s"} to mine` +
      (chunks >= MAX_CHUNKS ? ` <span class="mn-warn">(capped at ${MAX_CHUNKS})</span>` : "");
  }

  /* ---- render ---- */
  function render() {
    const root = document.getElementById("miner-container");
    if (!root) return;
    const { moments, mining, progress, error, filter, failedChunks } = state;

    let html = "";

    // input
    html += `
      <div class="mn-card">
        <div class="mn-label">FULL EPISODE TRANSCRIPT</div>
        <textarea id="miner-input" class="mn-input" placeholder="Paste a full 1–6 hour transcript. The engine splits it into sections and mines each one separately, so ideas from the back half surface too — not just the intro."></textarea>
        <div class="mn-row">
          <div id="miner-estimate" class="mn-estimate"></div>
          <button class="mn-mine-btn ${mining ? "loading" : ""}" id="miner-mine" ${mining ? "disabled" : ""}>
            ${mining ? `Mining ${progress.done}/${progress.total}…` : "⛏ Mine for content"}
          </button>
        </div>
        ${mining ? `<div class="mn-bar"><div class="mn-bar-fill" style="width:${progress.total ? (progress.done / progress.total) * 100 : 0}%"></div></div>` : ""}
      </div>`;

    if (error) html += `<div class="mn-error">${esc(error)}</div>`;

    if (moments.length > 0) {
      // filter chips
      const counts = { all: moments.length };
      Object.keys(FORMATS).forEach((f) => counts[f] = moments.filter((m) => m.bestFormat === f).length);
      html += `<div class="mn-filters">`;
      html += `<button class="mn-chip ${filter === "all" ? "on" : ""}" onclick="minerSetFilter('all')">All · ${counts.all}</button>`;
      Object.entries(FORMATS).forEach(([f, meta]) => {
        if (!counts[f]) return;
        html += `<button class="mn-chip ${filter === f ? "on" : ""}" onclick="minerSetFilter('${f}')" style="--chip:${meta.colour}">${meta.label} · ${counts[f]}</button>`;
      });
      html += `</div>`;

      const visible = moments.filter((m) => filter === "all" || m.bestFormat === filter);
      html += `<div class="mn-map">`;
      visible.forEach((m, idx) => {
        const meta = FORMATS[m.bestFormat];
        html += `
          <div class="mn-moment" style="--accent:${meta.colour}">
            <div class="mn-moment-head" onclick="minerToggle(${m.id})">
              <div class="mn-rank">${filter === "all" ? "#" + (idx + 1) : ""}</div>
              <div class="mn-moment-main">
                <div class="mn-moment-title">${esc(m.title)}</div>
                <div class="mn-moment-angle">${esc(m.angle)}</div>
                <div class="mn-moment-tags">
                  <span class="mn-tag mn-fmt">${meta.label}</span>
                  ${m.theme ? `<span class="mn-tag mn-theme">${esc(m.theme)}</span>` : ""}
                  ${m.location ? `<span class="mn-tag mn-loc">⏱ ${esc(m.location)}</span>` : ""}
                </div>
              </div>
              <div class="mn-score" title="Postability score">
                <div class="mn-score-num">${m.score}</div>
                <div class="mn-score-track"><div class="mn-score-fill" style="height:${m.score}%"></div></div>
              </div>
            </div>
            ${m.expanded ? renderMomentBody(m) : ""}
          </div>`;
      });
      html += `</div>`;
    }

    if (failedChunks > 0 && !mining) {
      html += `<div class="mn-note">${failedChunks} section${failedChunks === 1 ? "" : "s"} failed and ${failedChunks === 1 ? "was" : "were"} skipped — the rest mined fine.</div>`;
    }

    // preserve a lock overlay if the host page added one
    const lock = document.getElementById("miner-lock")?.outerHTML || "";
    root.innerHTML = html + lock;

    // rebind input listener + restore draft after innerHTML swap
    const ta = document.getElementById("miner-input");
    if (ta) {
      // keep the text across re-renders
      if (render._lastInput != null && ta.value === "") ta.value = render._lastInput;
      ta.addEventListener("input", () => { render._lastInput = ta.value; updateCounter(); });
      updateCounter();
    }
    const mineBtn = document.getElementById("miner-mine");
    if (mineBtn) mineBtn.addEventListener("click", mine);
  }

  function renderMomentBody(m) {
    let body = `<div class="mn-moment-body">`;
    if (m.hook) body += `<div class="mn-hook"><span class="mn-hook-label">HOOK</span>${esc(m.hook)}</div>`;
    if (m.quote) body += `<div class="mn-quote">“${esc(m.quote)}”</div>`;

    body += `<div class="mn-draft-bar"><span class="mn-draft-label">Draft as:</span>`;
    Object.entries(FORMATS).forEach(([f, meta]) => {
      const active = m.drafting && m.draftFormat === f;
      body += `<button class="mn-draft-btn ${active ? "loading" : ""}" ${m.drafting ? "disabled" : ""} onclick="minerDraft(${m.id}, '${f}')">${active ? "…" : meta.label}</button>`;
    });
    body += `</div>`;

    if (m.drafting) {
      body += `<div class="mn-skel"><div class="mn-skel-l" style="width:90%"></div><div class="mn-skel-l" style="width:80%"></div><div class="mn-skel-l" style="width:85%"></div></div>`;
    } else if (m.draft) {
      if (m.draft.type === "error") {
        body += `<div class="mn-error" style="margin-top:12px">${esc(m.draft.data)}</div>`;
      } else if (m.draft.type === "tweets") {
        body += `<div class="mn-draft-out">`;
        m.draft.data.forEach((t, i) => {
          body += `<div class="mn-tweet"><div class="mn-tweet-n">${i + 1}/${m.draft.data.length}</div>${esc(t)}</div>`;
        });
        body += `</div><button class="mn-copy" onclick="minerCopyDraft(${m.id})">📋 Copy thread</button>`;
      } else {
        body += `<div class="mn-draft-out mn-draft-text">${esc(m.draft.data)}</div>`;
        body += `<button class="mn-copy" onclick="minerCopyDraft(${m.id})">📋 Copy</button>`;
      }
    }
    body += `</div>`;
    return body;
  }
  render._lastInput = null;

  /* ---- styles (injected once; move to style.css if you prefer) ---- */
  function injectStyles() {
    if (document.getElementById("miner-styles")) return;
    const s = document.createElement("style");
    s.id = "miner-styles";
    s.textContent = `
      #miner-container { display:flex; flex-direction:column; gap:16px; position:relative; }
      .mn-card { background:var(--bg-card,#16181f); border:1px solid var(--border,rgba(255,255,255,.07)); border-radius:var(--radius-md,12px); padding:18px 20px; }
      .mn-label { font:600 11px/1 ui-monospace,monospace; letter-spacing:.14em; color:var(--text-muted,#545d72); margin-bottom:10px; }
      .mn-input { width:100%; min-height:150px; box-sizing:border-box; resize:vertical; background:var(--bg-input,#1c1f28); border:1px solid var(--border,rgba(255,255,255,.07)); border-radius:var(--radius-sm,6px); color:var(--text-primary,#f1f3f9); font:400 14px/1.6 inherit; padding:12px 14px; outline:none; }
      .mn-input:focus { border-color:var(--accent-violet,#7c3aed); }
      .mn-row { display:flex; justify-content:space-between; align-items:center; gap:14px; margin-top:12px; flex-wrap:wrap; }
      .mn-estimate { font:400 12.5px/1.4 ui-monospace,monospace; color:var(--text-secondary,#8b92a8); }
      .mn-estimate strong { color:var(--text-primary,#f1f3f9); }
      .mn-warn { color:var(--accent-amber,#f59e0b); }
      .mn-mine-btn { background:linear-gradient(135deg,var(--accent-violet,#7c3aed),var(--accent-violet2,#9d5cf5)); color:#fff; border:none; border-radius:var(--radius-sm,6px); padding:11px 20px; font:700 14px/1 inherit; cursor:pointer; transition:.2s; box-shadow:var(--shadow-glow-violet,0 0 40px rgba(124,58,237,.25)); }
      .mn-mine-btn:hover:not(:disabled) { transform:translateY(-1px); }
      .mn-mine-btn:disabled { opacity:.7; cursor:default; }
      .mn-bar { height:5px; background:var(--bg-input,#1c1f28); border-radius:999px; overflow:hidden; margin-top:12px; }
      .mn-bar-fill { height:100%; background:linear-gradient(90deg,var(--accent-violet,#7c3aed),var(--accent-cyan,#06b6d4)); transition:width .3s ease; }
      .mn-error { background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.3); color:#fca5a5; border-radius:var(--radius-sm,6px); padding:12px 14px; font-size:13.5px; }
      .mn-note { color:var(--text-muted,#545d72); font-size:12.5px; text-align:center; }
      .mn-filters { display:flex; flex-wrap:wrap; gap:8px; }
      .mn-chip { --chip:var(--text-secondary,#8b92a8); background:transparent; border:1px solid var(--border,rgba(255,255,255,.12)); color:var(--text-secondary,#8b92a8); border-radius:999px; padding:6px 13px; font:500 12.5px/1 inherit; cursor:pointer; transition:.15s; }
      .mn-chip:hover { border-color:var(--chip); color:var(--text-primary,#f1f3f9); }
      .mn-chip.on { background:var(--chip); border-color:var(--chip); color:#0a0b0f; font-weight:700; }
      .mn-map { display:flex; flex-direction:column; gap:10px; }
      .mn-moment { background:var(--bg-card,#16181f); border:1px solid var(--border,rgba(255,255,255,.07)); border-left:3px solid var(--accent); border-radius:var(--radius-sm,6px); overflow:hidden; transition:.15s; }
      .mn-moment:hover { border-color:var(--border-accent,rgba(124,58,237,.4)); border-left-color:var(--accent); }
      .mn-moment-head { display:flex; gap:14px; align-items:flex-start; padding:14px 16px; cursor:pointer; }
      .mn-rank { font:700 13px/1.3 ui-monospace,monospace; color:var(--text-muted,#545d72); min-width:26px; padding-top:1px; }
      .mn-moment-main { flex:1; min-width:0; }
      .mn-moment-title { font:600 15px/1.35 inherit; color:var(--text-primary,#f1f3f9); }
      .mn-moment-angle { font:400 13px/1.5 inherit; color:var(--text-secondary,#8b92a8); margin-top:3px; }
      .mn-moment-tags { display:flex; flex-wrap:wrap; gap:6px; margin-top:9px; }
      .mn-tag { font:600 10.5px/1 ui-monospace,monospace; letter-spacing:.04em; padding:4px 8px; border-radius:4px; }
      .mn-fmt { background:color-mix(in srgb, var(--accent) 18%, transparent); color:var(--accent); }
      .mn-theme { background:rgba(255,255,255,.06); color:var(--text-secondary,#8b92a8); }
      .mn-loc { background:rgba(255,255,255,.04); color:var(--text-muted,#545d72); }
      .mn-score { display:flex; flex-direction:column; align-items:center; gap:5px; }
      .mn-score-num { font:700 15px/1 ui-monospace,monospace; color:var(--accent); }
      .mn-score-track { width:5px; height:34px; background:var(--bg-input,#1c1f28); border-radius:999px; display:flex; align-items:flex-end; overflow:hidden; }
      .mn-score-fill { width:100%; background:var(--accent); border-radius:999px; }
      .mn-moment-body { padding:0 16px 16px; border-top:1px solid var(--border,rgba(255,255,255,.06)); margin-top:2px; }
      .mn-hook { background:var(--bg-input,#1c1f28); border-radius:var(--radius-sm,6px); padding:11px 13px; margin-top:14px; font:400 13.5px/1.5 inherit; color:var(--text-primary,#f1f3f9); }
      .mn-hook-label { display:inline-block; font:700 9.5px/1 ui-monospace,monospace; letter-spacing:.12em; color:var(--accent-cyan,#06b6d4); margin-right:8px; }
      .mn-quote { border-left:2px solid var(--accent); padding-left:12px; margin-top:12px; font:italic 400 14px/1.5 Georgia,serif; color:var(--text-secondary,#8b92a8); }
      .mn-draft-bar { display:flex; flex-wrap:wrap; align-items:center; gap:7px; margin-top:14px; }
      .mn-draft-label { font:600 11px/1 ui-monospace,monospace; letter-spacing:.08em; color:var(--text-muted,#545d72); margin-right:4px; }
      .mn-draft-btn { background:rgba(255,255,255,.05); border:1px solid var(--border,rgba(255,255,255,.1)); color:var(--text-primary,#f1f3f9); border-radius:5px; padding:6px 12px; font:500 12.5px/1 inherit; cursor:pointer; transition:.15s; }
      .mn-draft-btn:hover:not(:disabled) { background:var(--accent-violet,#7c3aed); border-color:var(--accent-violet,#7c3aed); }
      .mn-draft-btn:disabled { opacity:.5; cursor:default; }
      .mn-draft-out { margin-top:14px; background:var(--bg-base,#0a0b0f); border:1px solid var(--border,rgba(255,255,255,.07)); border-radius:var(--radius-sm,6px); padding:14px 16px; }
      .mn-draft-text { white-space:pre-wrap; font:400 13.5px/1.65 inherit; color:var(--text-primary,#f1f3f9); }
      .mn-tweet { padding:10px 0; border-bottom:1px solid var(--border,rgba(255,255,255,.06)); font:400 13.5px/1.55 inherit; color:var(--text-primary,#f1f3f9); white-space:pre-wrap; }
      .mn-tweet:last-child { border-bottom:none; }
      .mn-tweet-n { font:600 10px/1 ui-monospace,monospace; color:var(--accent-cyan,#06b6d4); margin-bottom:5px; }
      .mn-copy { margin-top:10px; background:transparent; border:1px solid var(--border,rgba(255,255,255,.12)); color:var(--text-secondary,#8b92a8); border-radius:5px; padding:6px 12px; font:500 12px/1 inherit; cursor:pointer; }
      .mn-copy:hover { color:var(--text-primary,#f1f3f9); border-color:var(--accent-violet,#7c3aed); }
      .mn-skel { margin-top:14px; display:flex; flex-direction:column; gap:8px; }
      .mn-skel-l { height:12px; border-radius:4px; background:linear-gradient(90deg,var(--bg-input,#1c1f28) 25%,rgba(255,255,255,.06) 50%,var(--bg-input,#1c1f28) 75%); background-size:200% 100%; animation:mn-shimmer 1.3s infinite; }
      @keyframes mn-shimmer { to { background-position:-200% 0; } }
      @media (prefers-reduced-motion: reduce) { .mn-skel-l, .mn-bar-fill, .mn-mine-btn { animation:none !important; transition:none !important; } }
    `;
    document.head.appendChild(s);
  }

  /* ---- expose for inline handlers (mirrors tracker.js) ---- */
  window.minerDraft = draft;
  window.minerCopyDraft = copyDraft;
  window.minerToggle = toggle;
  window.minerSetFilter = setFilter;

  /* ---- boot ---- */
  function boot() {
    if (!document.getElementById("miner-container")) return;
    injectStyles();
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
