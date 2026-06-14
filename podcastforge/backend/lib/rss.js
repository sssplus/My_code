/* ============================================================
   PodcastForge Backend — minimal RSS / transcript parsing
   Dependency-free. Extracts what the transcript puller needs:
   channel metadata (title, explicit, categories) and per-episode
   title/description/explicit/transcript-URL, plus a converter that
   turns SRT / VTT / JSON / HTML transcripts into plain text.
   ============================================================ */
'use strict';

function decode(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}
function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]) : '';
}
function attr(xml, name) {
  const m = xml.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i'))
    || xml.match(new RegExp(`${name}\\s*=\\s*'([^']*)'`, 'i'));
  return m ? m[1] : '';
}
const stripTags = (s) => decode(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function parseFeed(xml) {
  const channel = (xml.match(/<channel[^>]*>([\s\S]*?)(?:<item[\s>]|<\/channel>)/i) || [, ''])[1];
  const title = tag(channel, 'title') || tag(xml, 'title');
  const explicit = /<itunes:explicit[^>]*>\s*(true|yes)\s*<\/itunes:explicit>/i.test(channel);
  const categories = [];
  let cm; const catRe = /<itunes:category\s+text="([^"]*)"/gi;
  while ((cm = catRe.exec(channel))) categories.push(cm[1]);

  const items = [];
  const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let im;
  while ((im = itemRe.exec(xml)) && items.length < 60) {
    const it = im[1];
    // An item may list several transcripts (html, json, srt, vtt…). Prefer the
    // machine-readable formats over an HTML transcript web page.
    let transcriptUrl = '', transcriptType = '';
    const trTags = it.match(/<podcast:transcript\b[^>]*>/gi) || [];
    const rank = (ty) => {
      const t = (ty || '').toLowerCase();
      if (t.includes('json')) return 0;
      if (t.includes('vtt')) return 1;
      if (t.includes('srt') || t.includes('subrip')) return 2;
      if (t.includes('plain') || t.includes('text/plain')) return 3;
      if (t.includes('html')) return 5;
      return 4;
    };
    let best = null;
    for (const tag of trTags) {
      const url = attr(tag, 'url');
      if (!url) continue;
      const type = attr(tag, 'type') || attr(tag, 'mimetype');
      if (!best || rank(type) < rank(best.type)) best = { url, type };
    }
    if (best) { transcriptUrl = best.url; transcriptType = best.type; }
    const enc = it.match(/<enclosure\b[^>]*>/i);
    items.push({
      title: tag(it, 'title'),
      description: stripTags(tag(it, 'description') || tag(it, 'itunes:summary')).slice(0, 400),
      pubDate: tag(it, 'pubDate'),
      explicit: /<itunes:explicit[^>]*>\s*(true|yes)\s*<\/itunes:explicit>/i.test(it),
      transcriptUrl,
      transcriptType,
      audioUrl: enc ? attr(enc[0], 'url') : ''
    });
  }
  return { title, explicit, categories, items };
}

// Convert a transcript body of various formats into clean plain text.
function transcriptToText(body, contentType) {
  const ct = (contentType || '').toLowerCase();
  const trimmed = body.trim();

  // JSON (podcast transcript JSON spec or generic)
  if (ct.includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const j = JSON.parse(trimmed);
      const segs = Array.isArray(j) ? j : (j.segments || j.results || j.transcript || j.transcripts || []);
      if (Array.isArray(segs) && segs.length) {
        const out = segs.map(s => {
          if (typeof s === 'string') return s;
          const who = s.speaker || s.spk || '';
          const text = s.body || s.text || s.utterance || s.content || '';
          return who ? `${who}: ${text}` : text;
        }).filter(Boolean).join('\n').trim();
        if (out) return out;
      }
      // Parsed as JSON but no recognizable transcript shape — don't hand raw
      // JSON back as "plain text"; signal empty so the caller reports no transcript.
      return '';
    } catch (e) { /* not JSON after all — fall through to text formats */ }
  }

  // WebVTT
  if (ct.includes('vtt') || /^WEBVTT/m.test(trimmed)) {
    return trimmed.split(/\r?\n/)
      .filter(l => l && !/^WEBVTT/.test(l) && !/-->/.test(l) && !/^\d+$/.test(l) && !/^NOTE/.test(l) && !/^(STYLE|REGION)/.test(l))
      .join('\n').replace(/<[^>]+>/g, '').replace(/\n{2,}/g, '\n').trim();
  }

  // SRT
  if (ct.includes('srt') || (/-->/.test(trimmed) && /^\d+\s*$/m.test(trimmed))) {
    return trimmed.split(/\r?\n/)
      .filter(l => l && !/-->/.test(l) && !/^\d+$/.test(l))
      .join('\n').replace(/\n{2,}/g, '\n').trim();
  }

  // HTML
  if (ct.includes('html') || /<\/?(p|div|br|span|body|html)\b/i.test(trimmed)) {
    return stripTags(trimmed);
  }

  return trimmed;
}

module.exports = { parseFeed, transcriptToText };
