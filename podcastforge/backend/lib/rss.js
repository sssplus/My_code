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
    let transcriptUrl = '', transcriptType = '';
    const tr = it.match(/<podcast:transcript\b[^>]*>/i);
    if (tr) { transcriptUrl = attr(tr[0], 'url'); transcriptType = attr(tr[0], 'type') || attr(tr[0], 'mimetype'); }
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
      const segs = Array.isArray(j) ? j : (j.segments || j.results || []);
      if (Array.isArray(segs) && segs.length) {
        return segs.map(s => {
          const who = s.speaker || s.spk || '';
          const text = s.body || s.text || s.utterance || '';
          return who ? `${who}: ${text}` : text;
        }).filter(Boolean).join('\n').trim();
      }
    } catch (e) { /* fall through */ }
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
