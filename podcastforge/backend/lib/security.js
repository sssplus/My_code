/* ============================================================
   PodcastForge Backend — Security primitives
   Zero external dependencies; uses only Node's built-in crypto.
   - Password hashing:  scrypt + per-user random salt
   - Session tokens:    stateless HMAC-SHA256 (mini-JWT), expiring
   - API key storage:   AES-256-GCM, key derived from server secret
   ============================================================ */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SECRET_FILE = path.join(DATA_DIR, '.secret');

/* The server secret signs tokens and derives the encryption key.
   Prefer the PF_SECRET env var (set this in production!). If absent,
   generate one once and persist it so tokens/keys survive restarts. */
function loadSecret() {
  if (process.env.PF_SECRET && process.env.PF_SECRET.length >= 16) {
    return Buffer.from(process.env.PF_SECRET, 'utf8');
  }
  try {
    if (fs.existsSync(SECRET_FILE)) {
      return Buffer.from(fs.readFileSync(SECRET_FILE, 'utf8'), 'hex');
    }
  } catch (e) { /* fall through to generate */ }
  const generated = crypto.randomBytes(32);
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SECRET_FILE, generated.toString('hex'), { mode: 0o600 });
    console.warn('[security] PF_SECRET not set — generated a persistent dev secret at data/.secret. Set PF_SECRET in production.');
  } catch (e) {
    console.warn('[security] could not persist generated secret; tokens will reset on restart.');
  }
  return generated;
}

const SECRET = loadSecret();
const ENC_KEY = crypto.scryptSync(SECRET, 'pf-key-encryption-v1', 32);

/* ---- password hashing ---- */
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !stored.includes(':')) return false;
  const [saltHex, hashHex] = stored.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  let actual;
  try {
    actual = crypto.scryptSync(String(password), salt, expected.length);
  } catch (e) {
    return false;
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/* ---- stateless session tokens (HMAC-SHA256) ---- */
const b64url = (buf) => Buffer.from(buf).toString('base64url');

function signToken(userId, ttlSeconds = 60 * 60 * 24 * 7) {
  const payload = b64url(JSON.stringify({ uid: userId, exp: Date.now() + ttlSeconds * 1000 }));
  const sig = b64url(crypto.createHmac('sha256', SECRET).update(payload).digest());
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = b64url(crypto.createHmac('sha256', SECRET).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
  if (!data || typeof data.uid !== 'string' || typeof data.exp !== 'number') return null;
  if (Date.now() > data.exp) return null;
  return data.uid;
}

/* ---- API key encryption (AES-256-GCM) ---- */
function encryptKey(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decryptKey(blob) {
  if (typeof blob !== 'string' || blob.split(':').length !== 3) return null;
  const [ivHex, tagHex, dataHex] = blob.split(':');
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
  } catch (e) {
    return null;
  }
}

/* ---- generic signed, expiring payloads (used for OAuth CSRF state) ---- */
function signData(obj, ttlSeconds = 600) {
  const payload = b64url(JSON.stringify({ d: obj, exp: Date.now() + ttlSeconds * 1000 }));
  const sig = b64url(crypto.createHmac('sha256', SECRET).update(payload).digest());
  return `${payload}.${sig}`;
}

function verifyData(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = b64url(crypto.createHmac('sha256', SECRET).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let parsed;
  try { parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); }
  catch (e) { return null; }
  if (!parsed || typeof parsed.exp !== 'number' || Date.now() > parsed.exp) return null;
  return parsed.d;
}

module.exports = {
  hashPassword, verifyPassword,
  signToken, verifyToken,
  signData, verifyData,
  encryptKey, decryptKey,
  newId: () => crypto.randomUUID()
};
