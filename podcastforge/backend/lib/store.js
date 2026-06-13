/* ============================================================
   PodcastForge Backend — Store dispatcher
   Selects the storage backend at boot:
     DATABASE_URL set  -> Postgres (production / customers)
     otherwise         -> JSON file (local dev / tiny trial)
   Both expose the same async interface; the server only ever
   imports this module, so swapping backends is config-only.
   ============================================================ */
'use strict';

const backend = process.env.DATABASE_URL
  ? require('./store-postgres')
  : require('./store-json');

const usingPostgres = !!process.env.DATABASE_URL;

module.exports = {
  usingPostgres,
  init: backend.init,
  getUserByEmail: backend.getUserByEmail,
  getUserById: backend.getUserById,
  createUser: backend.createUser,
  saveUser: backend.saveUser,
  normEmail: backend.normEmail
};
