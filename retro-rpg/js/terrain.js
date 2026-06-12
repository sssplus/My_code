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
  // Halo radius: terrain is pulled toward solid midlands inside this,
  // so no entrance ever spawns ringed by ocean or mountains.
  var HALO_RADIUS = 10;

  // Chebyshev distance to the nearest entrance (marker or dungeon).
  function entranceDist(x, y) {
    var wm = DATA.WORLD_MAP;
    var lists = [wm.markers, wm.dungeons];
    var best = Infinity;
    for (var l = 0; l < lists.length; l++) {
      var arr = lists[l];
      if (!arr) continue;
      for (var i = 0; i < arr.length; i++) {
        var d = Math.max(Math.abs(x - arr[i].x), Math.abs(y - arr[i].y));
        if (d < best) best = d;
      }
    }
    return best;
  }

  // Returns true if (x,y) is within a clearing; reachable & flat.
  function nearEntrance(x, y) {
    return entranceDist(x, y) <= CLEAR_RADIUS;
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

    // Land halo: inside HALO_RADIUS of an entrance, blend elevation
    // toward 0.5 (solid walkable midlands). Guarantees every clearing
    // ramps out into open land instead of butting against sea or peaks.
    var ed = entranceDist(x, y);
    if (ed < HALO_RADIUS) {
      var t = 1 - ed / HALO_RADIUS;   // 1 at entrance → 0 at halo edge
      e = e * (1 - t) + 0.5 * t;
    }

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

  // ── Doodads (environment decorations) ──────────────────────
  // Indices into assets/doodads.png; must match the generator order.
  var DOODAD = { OAK:0, PINE:1, BUSH:2, FLOWERS:3, ROCK:4, DEAD_TREE:5, SNOW_PINE:6 };

  // Deterministic decoration for a tile, or -1 for none. Works for any
  // map (overworld or town): same coords + tile type → same doodad.
  // Entrances stay clear so markers and spawn clearings remain readable.
  function decorAt(tileId, x, y) {
    var h = hash2(x * 3 + 17, y * 3 - 29);
    switch (tileId) {
      case T.FOREST:
        if (h < 0.50) return (h < 0.30) ? DOODAD.OAK : DOODAD.PINE;
        if (h < 0.58) return DOODAD.BUSH;
        return -1;
      case T.GRASS:
        if (nearEntrance(x, y)) return (h < 0.06) ? DOODAD.FLOWERS : -1;
        if (h < 0.030) return DOODAD.OAK;
        if (h < 0.055) return DOODAD.BUSH;
        if (h < 0.085) return DOODAD.FLOWERS;
        if (h < 0.100) return DOODAD.ROCK;
        return -1;
      case T.SWAMP:
        if (h < 0.10) return DOODAD.DEAD_TREE;
        if (h < 0.14) return DOODAD.BUSH;
        return -1;
      case T.DESERT:
        if (h < 0.030) return DOODAD.ROCK;
        if (h < 0.042) return DOODAD.DEAD_TREE;
        return -1;
      case T.SNOW:
        if (h < 0.10) return DOODAD.SNOW_PINE;
        if (h < 0.13) return DOODAD.ROCK;
        return -1;
    }
    return -1;
  }

  return { init, tileAt, decorAt, DOODAD, CLEAR_RADIUS };
})();
