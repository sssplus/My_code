/* ============================================================
   PodcastForge Backend — SSRF-guarded fetch
   The podcast tools fetch user-supplied URLs (RSS feeds, transcript
   files). To stop those from hitting internal/metadata endpoints we
   resolve the host and reject private / loopback / link-local IPs
   before fetching, and cap size + time.
   ============================================================ */
'use strict';

const dns = require('dns').promises;
const net = require('net');

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    if (p[0] === 10) return true;
    if (p[0] === 127) return true;                          // loopback
    if (p[0] === 0) return true;
    if (p[0] === 169 && p[1] === 254) return true;          // link-local / cloud metadata
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT
    return false;
  }
  if (net.isIPv6(ip)) {
    const a = ip.toLowerCase();
    if (a === '::1' || a === '::') return true;
    if (a.startsWith('fe80')) return true;                  // link-local
    if (a.startsWith('fc') || a.startsWith('fd')) return true; // unique-local
    if (a.startsWith('::ffff:')) return isPrivateIp(a.slice(7)); // IPv4-mapped
    return false;
  }
  return true; // unknown format -> treat as unsafe
}

async function assertPublicUrl(target) {
  let u;
  try { u = new URL(target); } catch (e) { throw { status: 400, message: 'Invalid URL.' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw { status: 400, message: 'Only http(s) URLs are allowed.' };
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw { status: 400, message: 'That host is not allowed.' };
  }
  // If it's an IP literal, check directly; otherwise resolve and check every A/AAAA.
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw { status: 400, message: 'That address is not allowed.' };
  } else {
    let addrs;
    try { addrs = await dns.lookup(host, { all: true }); }
    catch (e) { throw { status: 400, message: 'Could not resolve that host.' }; }
    if (!addrs.length || addrs.some(a => isPrivateIp(a.address))) {
      throw { status: 400, message: 'That host resolves to a disallowed address.' };
    }
  }
  return u.toString();
}

// Fetch text with an SSRF check, a byte cap, and a timeout.
async function safeFetchText(target, { maxBytes = 5 * 1024 * 1024, timeoutMs = 15000 } = {}) {
  const safe = await assertPublicUrl(target);
  let res;
  try {
    res = await fetch(safe, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'PodcastForge/1.0', 'Accept': '*/*' }
    });
  } catch (e) {
    throw { status: 502, message: 'Could not fetch that URL.' };
  }
  if (!res.ok) throw { status: 502, message: `Source returned HTTP ${res.status}.` };
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) { try { reader.cancel(); } catch (e) {} throw { status: 413, message: 'That file is too large.' }; }
    chunks.push(value);
  }
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  return { text: Buffer.concat(chunks).toString('utf8'), contentType };
}

module.exports = { assertPublicUrl, safeFetchText, isPrivateIp };
