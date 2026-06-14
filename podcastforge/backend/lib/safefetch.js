/* ============================================================
   PodcastForge Backend — SSRF-guarded fetch
   The podcast tools fetch user-supplied URLs (RSS feeds, transcript
   files). Defense in depth against SSRF:
     1. assertPublicUrl() validates protocol + host (and resolved IPs)
        for the initial URL AND every redirect hop.
     2. The low-level request pins the connection to a validated IP via
        a custom `lookup` (closes DNS-rebinding TOCTOU) while keeping the
        original hostname for TLS SNI/cert checks.
     3. Redirects are followed MANUALLY (never auto) so each Location is
        re-validated before we connect to it.
   Plus a byte cap + timeout.
   ============================================================ */
'use strict';

const dns = require('dns');
const dnsp = dns.promises;
const net = require('net');
const http = require('http');
const https = require('https');

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
    if (a.startsWith('::ffff:')) {                          // IPv4-mapped
      const tail = a.slice(7);
      return net.isIPv4(tail) ? isPrivateIp(tail) : true;
    }
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
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw { status: 400, message: 'That address is not allowed.' };
  } else {
    let addrs;
    try { addrs = await dnsp.lookup(host, { all: true }); }
    catch (e) { throw { status: 400, message: 'Could not resolve that host.' }; }
    if (!addrs.length || addrs.some(a => isPrivateIp(a.address))) {
      throw { status: 400, message: 'That host resolves to a disallowed address.' };
    }
  }
  return u.toString();
}

// Custom DNS lookup for the request agent: validates every resolved address at
// connect time and connects to a validated IP (defeats DNS rebinding). The
// request still uses the original hostname for SNI/cert, so HTTPS keeps working.
function guardedLookup(hostname, options, callback) {
  const cb = typeof options === 'function' ? options : callback;
  const opts = typeof options === 'function' ? {} : (options || {});
  dnsp.lookup(hostname, { all: true, family: opts.family || 0, hints: opts.hints })
    .then(list => {
      const safe = list.filter(a => !isPrivateIp(a.address));
      if (!safe.length) { cb(Object.assign(new Error('blocked private address'), { code: 'EBLOCKED' })); return; }
      if (opts.all) cb(null, safe);
      else cb(null, safe[0].address, safe[0].family);
    })
    .catch(err => cb(err));
}

function defaultRawGet(urlStr, { timeoutMs = 15000, maxBytes = 5 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(urlStr); } catch (e) { return reject({ status: 400, message: 'Invalid URL.' }); }
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request(u, {
      method: 'GET',
      lookup: guardedLookup,
      headers: { 'User-Agent': 'PodcastForge/1.0', 'Accept': '*/*' }
    }, (res) => {
      const chunks = []; let size = 0;
      res.on('data', (d) => {
        size += d.length;
        if (size > maxBytes) { req.destroy(); reject({ status: 413, message: 'That file is too large.' }); return; }
        chunks.push(d);
      });
      res.on('end', () => resolve({
        status: res.statusCode, headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8'),
        contentType: (res.headers['content-type'] || '').toLowerCase()
      }));
      res.on('error', () => reject({ status: 502, message: 'Could not read response.' }));
    });
    req.on('error', (e) => reject(e && e.code === 'EBLOCKED'
      ? { status: 400, message: 'That host is not allowed.' }
      : { status: 502, message: 'Could not fetch that URL.' }));
    req.setTimeout(timeoutMs, () => { req.destroy(); reject({ status: 504, message: 'Request timed out.' }); });
    req.end();
  });
}

// Injectable for tests (so we don't make real network calls).
let _rawGet = defaultRawGet;
function _setRawGet(fn) { _rawGet = fn || defaultRawGet; }

async function safeFetchText(target, { maxBytes = 5 * 1024 * 1024, timeoutMs = 15000 } = {}) {
  let current = await assertPublicUrl(target);
  for (let hop = 0; hop < 6; hop++) {
    const r = await _rawGet(current, { maxBytes, timeoutMs });
    if (r.status >= 300 && r.status < 400 && r.headers && r.headers.location) {
      // Re-validate the redirect target BEFORE following it.
      current = await assertPublicUrl(new URL(r.headers.location, current).toString());
      continue;
    }
    if (r.status < 200 || r.status >= 300) throw { status: 502, message: `Source returned HTTP ${r.status}.` };
    return { text: r.body, contentType: r.contentType || '' };
  }
  throw { status: 508, message: 'Too many redirects.' };
}

module.exports = { assertPublicUrl, safeFetchText, isPrivateIp, guardedLookup, _setRawGet };
