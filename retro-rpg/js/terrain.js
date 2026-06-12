// ============================================================
//  CHRONICLES OF THE SHATTERED REALM — Procedural Terrain
//  Seeded value-noise biome generator for the infinite overworld.
//  tileAt(x, y) returns a DATA.TILE id for any integer world coord
//  (including negatives). Deterministic for a given seed, so the same
//  world regenerates identically and never needs storing.
// ============================================================

var TERRAIN = (function() {

  var seed = 1337;
  var T = DATA.TILE;

  // Radius (in tiles) of the guaranteed-walkable clearing around each
  // kingdom / dungeon entrance, so they're always reachable & visible.
  var CLEAR_RADIUS = 3;

  function init(s) {
    seed = (s == null) ? 1337 : (s | 0);
  }

  // ── Integer lattice hash → [0,1) ───────────────────────────
  // Math.imul keeps the mix in true 32-bit space; a plain * would
  // overflow into float and lose precision, biasing the output to 0.
  function hash2(ix, iy) {
    var n = (Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263) + Math.imul(seed, 362437)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n = (n ^ (n >>> 16)) >>> 0;
    return (n % 100000) / 100000;
  }

  // ── Smooth value noise at a given frequency ────────────────
  function valueNoise(x, y, freq) {
    var gx = x * freq, gy = y * freq;
    var x0 = Math.floor(gx), y0 = Math.floor(gy);
    var fx = gx - x0, fy = gy - y0;
    var v00 = hash2(x0,     y0);
    var v10 = hash2(x0 + 1, y0);
    var v01 = hash2(x0,     y0 + 1);
    var v11 = hash2(x0 + 1, y0 + 1);
    var sx = fx * fx * (3 - 2 * fx);   // smoothstep
    var sy = fy * fy * (3 - 2 * fy);
    var a = v00 + (v10 - v00) * sx;
    var b = v01 + (v11 - v01) * sx;
    return a + (b - a) * sy;
  }

  // ── Fractal Brownian motion (layered octaves) ──────────────
  function fbm(x, y, ox, oy) {
    return valueNoise(x + ox, y + oy, 0.045) * 0.60 +
           valueNoise(x + ox + 1700, y + oy + 1700, 0.11) * 0.30 +
           valueNoise(x + ox + 9100, y + oy + 9100, 0.23) * 0.10;
  }

  // ── Entrance clearings ─────────────────────────────────────
  // Returns true if (x,y) is within a clearing; reachable & flat.
  function nearEntrance(x, y) {
    var wm = DATA.WORLD_MAP;
    var lists = [wm.markers, wm.dungeons];
    for (var l = 0; l < lists.length; l++) {
      var arr = lists[l];
      if (!arr) continue;
      for (var i = 0; i < arr.length; i++) {
        var dx = Math.abs(x - arr[i].x);
        var dy = Math.abs(y - arr[i].y);
        if (dx <= CLEAR_RADIUS && dy <= CLEAR_RADIUS) return true;
      }
    }
    return false;
  }

  // ── Biome resolution ───────────────────────────────────────
  function tileAt(x, y) {
    // Keep entrances flat and walkable.
    if (nearEntrance(x, y)) {
      // A path ring one tile out, grass in the middle.
      return T.GRASS;
    }

    var e = fbm(x, y, 0, 0);            // elevation
    var m = fbm(x, y, 4200, 8300);     // moisture

    if (e < 0.30) return T.WATER;          // seas & lakes
    if (e < 0.355) return m < 0.42 ? T.DESERT : T.GRASS;  // shoreline
    if (e > 0.80) return m > 0.5 ? T.SNOW : T.MOUNTAIN;    // peaks
    if (e > 0.685) return T.MOUNTAIN;                       // highlands

    // Lowlands & midlands by moisture
    if (m < 0.30) return T.DESERT;
    if (e < 0.46 && m > 0.72) return T.SWAMP;
    if (m > 0.64) return T.FOREST;
    return T.GRASS;
  }

  return { init, tileAt, CLEAR_RADIUS };
})();
