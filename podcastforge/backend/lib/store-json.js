/* ============================================================
   PodcastForge Backend — JSON file store (local/dev fallback)
   Used when DATABASE_URL is NOT set. Single-process, write-through
   cache with atomic writes and a rolling backup. Fine for local dev
   and tiny trials on a persistent disk; use Postgres for real traffic.
   Interface is async to match the Postgres backend.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BAK_FILE = path.join(DATA_DIR, 'db.bak.json');

let db = { users: {}, byEmail: {} };

const normEmail = (e) => String(e || '').trim().toLowerCase();

function load() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      db = { users: parsed.users || {}, byEmail: parsed.byEmail || {} };
    }
  } catch (e) {
    // If the primary is corrupt, try the backup before giving up.
    try {
      if (fs.existsSync(BAK_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(BAK_FILE, 'utf8'));
        db = { users: parsed.users || {}, byEmail: parsed.byEmail || {} };
        console.warn('[store] recovered from db.bak.json');
        return;
      }
    } catch (e2) { /* fall through */ }
    console.error('[store] failed to load db, starting fresh:', e.message);
    db = { users: {}, byEmail: {} };
  }
}

let writeTimer = null;
function persist() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      const tmp = DB_FILE + '.tmp';
      const json = JSON.stringify(db);
      fs.writeFileSync(tmp, json, { mode: 0o600 });
      // keep the previous good copy as a backup, then swap in the new one
      if (fs.existsSync(DB_FILE)) { try { fs.copyFileSync(DB_FILE, BAK_FILE); } catch (e) {} }
      fs.renameSync(tmp, DB_FILE);
    } catch (e) {
      console.error('[store] persist failed:', e.message);
    }
  }, 50);
}

async function init() { load(); }

async function getUserByEmail(email) {
  const id = db.byEmail[normEmail(email)];
  return id ? db.users[id] : null;
}

async function getUserById(id) {
  return db.users[id] || null;
}

async function createUser(user) {
  db.users[user.id] = user;
  db.byEmail[normEmail(user.email)] = user.id;
  persist();
  return user;
}

async function saveUser(user) {
  db.users[user.id] = user;
  persist();
  return user;
}

module.exports = { init, getUserByEmail, getUserById, createUser, saveUser, normEmail };
