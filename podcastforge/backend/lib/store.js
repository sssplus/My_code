/* ============================================================
   PodcastForge Backend — JSON file store
   Single-process, write-through cache with atomic writes.
   Swap this module for SQLite/Postgres at production scale;
   the rest of the server only depends on these functions.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let db = { users: {}, byEmail: {} };

function load() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      db = { users: parsed.users || {}, byEmail: parsed.byEmail || {} };
    }
  } catch (e) {
    console.error('[store] failed to load db, starting fresh:', e.message);
    db = { users: {}, byEmail: {} };
  }
}

let writeTimer = null;
function persist() {
  // debounce rapid writes; atomic via temp file + rename
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      const tmp = DB_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(db), { mode: 0o600 });
      fs.renameSync(tmp, DB_FILE);
    } catch (e) {
      console.error('[store] persist failed:', e.message);
    }
  }, 50);
}

const normEmail = (e) => String(e || '').trim().toLowerCase();

function getUserByEmail(email) {
  const id = db.byEmail[normEmail(email)];
  return id ? db.users[id] : null;
}

function getUserById(id) {
  return db.users[id] || null;
}

function createUser(user) {
  db.users[user.id] = user;
  db.byEmail[normEmail(user.email)] = user.id;
  persist();
  return user;
}

function saveUser(user) {
  db.users[user.id] = user;
  persist();
  return user;
}

load();

module.exports = { getUserByEmail, getUserById, createUser, saveUser, normEmail };
