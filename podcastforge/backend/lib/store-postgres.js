/* ============================================================
   PodcastForge Backend — Postgres store
   Used when DATABASE_URL is set (Neon, Supabase, RDS, etc.).
   The full user object is kept as JSONB so the shape matches the
   JSON store exactly and migrations stay trivial. Email is a
   separate indexed/unique column for lookup + dedupe.

   Pass a pool override to init() for testing (e.g. pg-mem); in
   production it builds a pg Pool from DATABASE_URL with TLS.
   ============================================================ */
'use strict';

const normEmail = (e) => String(e || '').trim().toLowerCase();

let pool = null;

async function init(poolOverride) {
  if (poolOverride) {
    pool = poolOverride;
  } else {
    const { Pool } = require('pg');
    // Managed Postgres (Neon/Supabase) requires TLS. Allow opting out for
    // self-hosted local instances via PGSSL=disable.
    const ssl = process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false };
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl, max: 5 });
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id    TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      data  JSONB NOT NULL
    )
  `);
  return pool;
}

async function getUserById(id) {
  const r = await pool.query('SELECT data FROM users WHERE id = $1', [id]);
  return r.rows[0] ? r.rows[0].data : null;
}

async function getUserByEmail(email) {
  const r = await pool.query('SELECT data FROM users WHERE email = $1', [normEmail(email)]);
  return r.rows[0] ? r.rows[0].data : null;
}

async function createUser(user) {
  await pool.query(
    'INSERT INTO users (id, email, data) VALUES ($1, $2, $3)',
    [user.id, normEmail(user.email), JSON.stringify(user)]
  );
  return user;
}

async function saveUser(user) {
  await pool.query(
    `INSERT INTO users (id, email, data) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, email = EXCLUDED.email`,
    [user.id, normEmail(user.email), JSON.stringify(user)]
  );
  return user;
}

module.exports = { init, getUserByEmail, getUserById, createUser, saveUser, normEmail };
