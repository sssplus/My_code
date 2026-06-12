// ============================================================
//  CHRONICLES OF THE SHATTERED REALM — Rendering Engine
//  Lego-style tile and minifigure renderer + input handler
// ============================================================

var ENGINE = (function() {
  var canvas, ctx;
  var TILE = 32;
  var camera = { x:0, y:0 };
  var keysHeld    = {};   // code → true while physically held
  var keysPressed = {};   // code → true only for the frame it was pressed
  var mousePos = { x:0, y:0 };
  var mouseClicked = false;
  var mouseMoved   = false;  // true only on frames where the mouse moved —
                             // hover may steal a keyboard selection only then
  var frameCount = 0;
  var captureCallback = null;  // set while waiting for a rebind keypress

  // ── Pixel-art tileset ──────────────────────────────────────
  var tilesetImg   = null;
  var tilesetReady = false;
  var TILE_COUNT   = 14;   // ids 0..13 present in assets/tileset.png

  // ── Doodad sprites (trees, bushes...) ──────────────────────
  // 32x48 cells anchored at the bottom; ids match TERRAIN.DOODAD.
  var doodadImg   = null;
  var doodadReady = false;
  var DOODAD_W = 32, DOODAD_H = 48;

  // Keys whose browser default (scrolling etc.) must be suppressed
  var PREVENT_DEFAULT = new Set([
    'ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab'
  ]);

  // ── Action → key bindings ──────────────────────────────────
  // Each action has up to 2 key slots. Rebindable, saved to localStorage.
  var DEFAULT_BINDINGS = {
    up:       ['ArrowUp',    'KeyW'],
    down:     ['ArrowDown',  'KeyS'],
    left:     ['ArrowLeft',  'KeyA'],
    right:    ['ArrowRight', 'KeyD'],
    confirm:  ['Enter',      'Space'],
    cancel:   ['Escape',     'KeyX'],
    interact: ['KeyE',       null],
    menu:     ['KeyM',       null],
    save:     ['KeyP',       null],
    attack:   ['KeyA',       null],
    skills:   ['KeyS',       null],
    item:     ['KeyI',       null],
    defend:   ['KeyD',       null],
    flee:     ['KeyF',       null]
  };

  var ACTION_LABELS = {
    up:'Move Up', down:'Move Down', left:'Move Left', right:'Move Right',
    confirm:'Confirm / Advance', cancel:'Cancel / Back', interact:'Interact / Talk',
    menu:'Open Menu', save:'Quick Save',
    attack:'Combat: Attack', skills:'Combat: Skills', item:'Combat: Items',
    defend:'Combat: Defend', flee:'Combat: Flee'
  };

  var bindings = loadBindings();

  function loadBindings() {
    try {
      var raw = localStorage.getItem('cosr_keybinds');
      if (raw) {
        var saved = JSON.parse(raw);
        // Merge with defaults so new actions get their default keys
        var merged = {};
        Object.keys(DEFAULT_BINDINGS).forEach(function(a) {
          merged[a] = (saved[a] && saved[a].length) ? saved[a].slice(0,2) : DEFAULT_BINDINGS[a].slice();
        });
        return merged;
      }
    } catch(e) {}
    return JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
  }

  function saveBindings() {
    try { localStorage.setItem('cosr_keybinds', JSON.stringify(bindings)); } catch(e) {}
  }

  function getBindings()     { return bindings; }
  function getActionLabels() { return ACTION_LABELS; }

  function resetBindings() {
    bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
    saveBindings();
  }

  // Begin listening for the next keypress; assigns it to action/slot
  function rebindKey(actionName, slot, cb) {
    captureCallback = function(code) {
      if (code === 'Escape') { if (cb) cb(null); return; }  // ESC aborts rebind
      // Remove this key from any other action slot to avoid double-binding
      Object.keys(bindings).forEach(function(a) {
        bindings[a] = bindings[a].map(function(k) { return k === code ? null : k; });
      });
      bindings[actionName][slot] = code;
      saveBindings();
      if (cb) cb(code);
    };
  }

  function isCapturing() { return !!captureCallback; }

  // Human-readable key name for UI display
  function keyLabel(code) {
    if (!code) return '—';
    var special = {
      'ArrowUp':'↑', 'ArrowDown':'↓', 'ArrowLeft':'←', 'ArrowRight':'→',
      'Space':'SPACE', 'Enter':'ENTER', 'Escape':'ESC', 'Backspace':'BKSP',
      'Tab':'TAB', 'ShiftLeft':'L-SHIFT', 'ShiftRight':'R-SHIFT',
      'ControlLeft':'L-CTRL', 'ControlRight':'R-CTRL', 'AltLeft':'L-ALT', 'AltRight':'R-ALT'
    };
    if (special[code]) return special[code];
    if (code.startsWith('Key'))   return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad'))return 'NUM-' + code.slice(6);
    return code.toUpperCase();
  }

  // ── Color helpers ──────────────────────────────────────────
  function hexToRgb(hex) {
    var r = parseInt(hex.slice(1,3),16);
    var g = parseInt(hex.slice(3,5),16);
    var b = parseInt(hex.slice(5,7),16);
    return {r,g,b};
  }
  function lighten(hex, amt) {
    var c = hexToRgb(hex);
    return 'rgb('+Math.min(255,c.r+amt)+','+Math.min(255,c.g+amt)+','+Math.min(255,c.b+amt)+')';
  }
  function darken(hex, amt) {
    amt = amt || 40;
    var c = hexToRgb(hex);
    return 'rgb('+Math.max(0,c.r-amt)+','+Math.max(0,c.g-amt)+','+Math.max(0,c.b-amt)+')';
  }

  // ── Canvas init ────────────────────────────────────────────
  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    setupInput();
    return ctx;
  }

  // Load the pixel-art tileset. cb fires once (loaded or failed) so boot
  // can proceed even if the asset is missing (falls back to procedural tiles).
  function loadTileset(src, cb) {
    var img = new Image();
    img.onload = function() {
      tilesetImg = img;
      tilesetReady = true;
      if (cb) cb(true);
    };
    img.onerror = function() {
      tilesetReady = false;
      if (cb) cb(false);
    };
    img.src = src;
  }

  function loadDoodads(src, cb) {
    var img = new Image();
    img.onload  = function() { doodadImg = img; doodadReady = true; if (cb) cb(true); };
    img.onerror = function() { doodadReady = false; if (cb) cb(false); };
    img.src = src;
  }

  // Draw doodad `idx` so its base sits on the tile whose top-left screen
  // position is (sx, sy). The sprite is taller than a tile, so it extends
  // upward — y-sort it with entities for correct overlap.
  function drawDoodad(idx, sx, sy) {
    if (!doodadReady) return;
    ctx.drawImage(doodadImg, idx * DOODAD_W, 0, DOODAD_W, DOODAD_H,
                  sx, sy + TILE - DOODAD_H, DOODAD_W, DOODAD_H);
  }

  function getCanvas() { return canvas; }
  function getCtx()    { return ctx; }
  function getFrame()  { return frameCount; }
  function tick()      { frameCount++; }

  // ── Input ──────────────────────────────────────────────────
  function setupInput() {
    document.addEventListener('keydown', function(e) {
      // Rebind capture mode swallows the next keypress
      if (captureCallback) {
        e.preventDefault();
        var cb = captureCallback;
        captureCallback = null;
        cb(e.code);
        return;
      }
      if (!e.repeat) keysPressed[e.code] = true;  // ignore OS auto-repeat
      keysHeld[e.code] = true;
      if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
    });
    document.addEventListener('keyup', function(e) {
      keysHeld[e.code] = false;
    });
    // Releasing focus shouldn't leave keys stuck down
    window.addEventListener('blur', function() {
      keysHeld = {};
      keysPressed = {};
    });
    canvas.addEventListener('mousemove', function(e) {
      var r = canvas.getBoundingClientRect();
      mousePos.x = (e.clientX - r.left) * (canvas.width  / r.width);
      mousePos.y = (e.clientY - r.top)  * (canvas.height / r.height);
      mouseMoved = true;
    });
    canvas.addEventListener('click', function(e) {
      var r = canvas.getBoundingClientRect();
      mousePos.x = (e.clientX - r.left) * (canvas.width  / r.width);
      mousePos.y = (e.clientY - r.top)  * (canvas.height / r.height);
      mouseClicked = true;
    });
  }

  function isKeyDown(k) { return !!keysHeld[k]; }
  // Consuming "pressed this frame" check — a press triggers exactly one handler
  function isKeyJust(k) {
    if (keysPressed[k]) { keysPressed[k] = false; return true; }
    return false;
  }
  function getMousePos()  { return {x:mousePos.x, y:mousePos.y}; }
  function wasClicked()   { var v=mouseClicked; mouseClicked=false; return v; }
  function clearKeys()    { keysHeld = {}; keysPressed = {}; }

  // Called at the end of every frame: pressed-state lasts one frame only
  function endFrame() {
    keysPressed  = {};
    mouseClicked = false;
    mouseMoved   = false;
  }

  function didMouseMove() { return mouseMoved; }

  // ── Action-based input (uses the binding map) ─────────────
  function action(name) {  // just pressed this frame
    var binds = bindings[name];
    if (!binds) return false;
    for (var i = 0; i < binds.length; i++) {
      if (binds[i] && isKeyJust(binds[i])) return true;
    }
    return false;
  }

  function actionHeld(name) {  // currently held
    var binds = bindings[name];
    if (!binds) return false;
    for (var i = 0; i < binds.length; i++) {
      if (binds[i] && isKeyDown(binds[i])) return true;
    }
    return false;
  }

  // ── Camera ─────────────────────────────────────────────────
  // All args are in TILES (world.js passes VIEW_W/TILE).
  // - Infinite procedural maps: center the player, no clamping.
  // - Finite maps larger than the view: follow the player, clamped to edges.
  // - Finite maps smaller than the view (towns): center the whole map.
  // (The old code divided viewW by TILE a second time, pinning the camera
  //  near the player's coord and rendering towns as a strip at far left.)
  function setCamera(x, y, mapW, mapH, viewW, viewH) {
    if (mapW === Infinity || mapH === Infinity) {
      camera.x = x - viewW/2;
      camera.y = y - viewH/2;
      return;
    }
    camera.x = (mapW <= viewW) ? (mapW - viewW)/2 : Math.max(0, Math.min(x - viewW/2, mapW - viewW));
    camera.y = (mapH <= viewH) ? (mapH - viewH)/2 : Math.max(0, Math.min(y - viewH/2, mapH - viewH));
  }
  function getCamera() { return camera; }

  // ── Clear ──────────────────────────────────────────────────
  function clear(color) {
    ctx.fillStyle = color || '#0A0A14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // ── Lego Brick drawing ─────────────────────────────────────
  // Draw a Lego brick tile with stud(s) on top
  function drawLegoBrick(x, y, w, h, colorTop, colorFront, options) {
    options = options || {};
    var studH = options.plate ? 4 : 8;   // plates are thinner
    var brickH = h - studH;

    // Front face (main visible color)
    ctx.fillStyle = colorFront || darken(colorTop, 30);
    ctx.fillRect(x, y + studH, w, brickH);

    // Top face
    ctx.fillStyle = colorTop;
    ctx.fillRect(x, y, w, studH + 2);

    // Inner shadow on top
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(x, y + studH - 2, w, 3);

    // Stud(s) on top
    var studCount = Math.floor(w / TILE);
    var studR = options.plate ? 3 : 5;
    for (var i = 0; i < studCount; i++) {
      var sx = x + TILE/2 + i*TILE;
      var sy = y + studH/2;
      // Stud cylinder top
      ctx.fillStyle = lighten(colorTop, 20);
      ctx.beginPath();
      ctx.ellipse(sx, sy - studR/2, studR, studR/2 + 1, 0, 0, Math.PI*2);
      ctx.fill();
      // Stud side
      ctx.fillStyle = colorTop;
      ctx.fillRect(sx - studR, sy - studR/2, studR*2, studR);
      // Stud outline
      ctx.strokeStyle = darken(colorTop, 50);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.ellipse(sx, sy - studR/2, studR, studR/2 + 1, 0, 0, Math.PI*2);
      ctx.stroke();
    }

    // Brick outline
    ctx.strokeStyle = darken(colorTop, 60);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    // Highlight edge
    ctx.strokeStyle = lighten(colorTop, 40);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x+1, y+h-2);
    ctx.lineTo(x+1, y+1);
    ctx.lineTo(x+w-2, y+1);
    ctx.stroke();
  }

  // ── Tile renderer ──────────────────────────────────────────
  function drawTile(tileId, sx, sy, tileSize) {
    tileSize = tileSize || TILE;

    // Pixel-art path: blit the tile from the atlas, nearest-neighbor.
    if (tilesetReady && tileId >= 0 && tileId < TILE_COUNT) {
      ctx.drawImage(tilesetImg, tileId * TILE, 0, TILE, TILE, sx, sy, tileSize, tileSize);
      // Animated shimmer band over water for a touch of life.
      if (tileId === DATA.TILE.WATER) {
        var band = Math.floor((frameCount * 0.4 + sx * 0.5) % tileSize);
        ctx.fillStyle = 'rgba(180,220,255,0.18)';
        ctx.fillRect(sx, sy + band, tileSize, 2);
      }
      return;
    }

    // Procedural fallback (used until the atlas loads, or if it's missing).
    var colors = DATA.TILE_COLORS[tileId] || ['#FF00FF','#CC00CC'];
    var c0 = colors[0], c1 = colors[1];
    var x = sx, y = sy, w = tileSize, h = tileSize;

    switch(tileId) {
      case DATA.TILE.VOID:
        ctx.fillStyle = c0;
        ctx.fillRect(x, y, w, h);
        // Subtle grid
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, w, h);
        break;
      case DATA.TILE.GRASS:
      case DATA.TILE.DESERT:
        drawLegoBrick(x, y, w, h, c0, c1, {plate:true});
        break;
      case DATA.TILE.PATH:
        drawLegoBrick(x, y, w, h, c0, c1, {plate:true});
        // Cobble pattern
        ctx.strokeStyle = darken(c0, 20);
        ctx.lineWidth = 0.5;
        if ((Math.floor(sx/w) + Math.floor(sy/h)) % 2 === 0) {
          ctx.strokeRect(x+4, y+4, w-8, h-8);
        }
        break;
      case DATA.TILE.FOREST:
        drawLegoBrick(x, y, w, h, c0, c1, {plate:true});
        // Tree dots
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.arc(x+w/2, y+h/2-2, 6, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = c0;
        ctx.beginPath();
        ctx.arc(x+w/2, y+h/2-4, 5, 0, Math.PI*2);
        ctx.fill();
        break;
      case DATA.TILE.MOUNTAIN:
        drawLegoBrick(x, y, w, h, c0, c1);
        // Mountain shape
        ctx.fillStyle = lighten(c0, 30);
        ctx.beginPath();
        ctx.moveTo(x+4, y+h-4);
        ctx.lineTo(x+w/2, y+4);
        ctx.lineTo(x+w-4, y+h-4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.moveTo(x+w/2-4, y+10);
        ctx.lineTo(x+w/2, y+4);
        ctx.lineTo(x+w/2+4, y+10);
        ctx.closePath();
        ctx.fill();
        break;
      case DATA.TILE.WATER:
        ctx.fillStyle = c0;
        ctx.fillRect(x, y, w, h);
        // Animated waves
        var wave = Math.sin(frameCount * 0.05 + x * 0.2) * 2;
        ctx.strokeStyle = lighten(c0, 30);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x+2, y+h/2+wave);
        ctx.bezierCurveTo(x+8,y+h/2+wave-3, x+12,y+h/2+wave+3, x+w-2,y+h/2+wave);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.moveTo(x+2, y+h/2+6+wave);
        ctx.bezierCurveTo(x+8,y+h/2+3+wave, x+12,y+h/2+9+wave, x+w-2,y+h/2+6+wave);
        ctx.stroke();
        break;
      case DATA.TILE.WALL:
        drawLegoBrick(x, y, w, h, c0, c1);
        break;
      case DATA.TILE.FLOOR:
        drawLegoBrick(x, y, w, h, c0, c1, {plate:true});
        break;
      case DATA.TILE.DOOR:
        ctx.fillStyle = c0;
        ctx.fillRect(x, y, w, h);
        // Door arch
        ctx.fillStyle = '#F2CD37';
        ctx.fillRect(x+6, y+8, w-12, h-8);
        ctx.beginPath();
        ctx.arc(x+w/2, y+8, (w-12)/2, Math.PI, 0, false);
        ctx.fill();
        // Door handle
        ctx.fillStyle = '#DBA000';
        ctx.beginPath();
        ctx.arc(x+w/2+4, y+h/2+4, 2, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = darken(c0, 40);
        ctx.lineWidth = 1;
        ctx.strokeRect(x+0.5, y+0.5, w-1, h-1);
        break;
      case DATA.TILE.DG_FLOOR:
        ctx.fillStyle = c0;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = c1;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x+0.5, y+0.5, w-1, h-1);
        // Flagstone cracks
        if ((Math.floor(x/w) + Math.floor(y/h)) % 3 === 0) {
          ctx.strokeStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath();
          ctx.moveTo(x+5, y+5);
          ctx.lineTo(x+w-10, y+h-8);
          ctx.stroke();
        }
        break;
      case DATA.TILE.DG_WALL:
        drawLegoBrick(x, y, w, h, c0, c1);
        // Stone texture overlay
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        if (frameCount % 3 === 0) ctx.fillRect(x+2, y+h/2, w-4, 3);
        break;
      case DATA.TILE.SWAMP:
        ctx.fillStyle = c0;
        ctx.fillRect(x, y, w, h);
        drawLegoBrick(x, y, w, h, c0, c1, {plate:true});
        // Swamp bubbles
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.arc(x+8, y+h-6, 3, 0, Math.PI*2);
        ctx.fill();
        break;
      default:
        ctx.fillStyle = '#FF00FF';
        ctx.fillRect(x, y, w, h);
    }
  }

  // ── Map renderer ───────────────────────────────────────────
  // Tile lookup that works for both finite arrays and procedural maps.
  // Out-of-bounds returns -1 (treated as "nothing" by the edge effects).
  function mapTileAt(mapData, proc, tx, ty) {
    if (proc) return mapData.getTile(tx, ty);
    if (tx < 0 || ty < 0 || tx >= mapData.width || ty >= mapData.height) return -1;
    var row = mapData.tiles[ty];
    return row ? row[tx] : -1;
  }

  function drawMap(mapData, offsetX, offsetY, viewW, viewH) {
    var tX = Math.floor(camera.x);
    var tY = Math.floor(camera.y);
    var tilesW = Math.ceil(viewW / TILE) + 1;
    var tilesH = Math.ceil(viewH / TILE) + 1;
    // Procedural maps supply tiles on demand and have no fixed bounds.
    var proc = !!(mapData.procedural && typeof mapData.getTile === 'function');
    var WATER = DATA.TILE.WATER, WALL = DATA.TILE.WALL, DGW = DATA.TILE.DG_WALL, MTN = DATA.TILE.MOUNTAIN;

    for (var ty = tY; ty < tY + tilesH; ty++) {
      if (!proc && (ty < 0 || ty >= mapData.height)) continue;
      var row = proc ? null : mapData.tiles[ty];
      if (!proc && !row) continue;
      for (var tx = tX; tx < tX + tilesW; tx++) {
        if (!proc && (tx < 0 || tx >= mapData.width)) continue;
        var tileId = proc ? mapData.getTile(tx, ty) : row[tx];
        var sx = Math.round(offsetX + (tx - tX) * TILE - (camera.x - tX) * TILE);
        var sy = Math.round(offsetY + (ty - tY) * TILE - (camera.y - tY) * TILE);
        drawTile(tileId, sx, sy);

        // ── 2.5D edge effects (need neighbors, so they live here) ──
        if (tileId === WATER) {
          // Foam line where water touches land above / beside it.
          var up = mapTileAt(mapData, proc, tx, ty - 1);
          if (up !== WATER && up !== -1 && up !== DATA.TILE.VOID) {
            ctx.fillStyle = 'rgba(225,240,255,0.75)';
            ctx.fillRect(sx, sy, TILE, 3);
            ctx.fillStyle = 'rgba(225,240,255,0.30)';
            ctx.fillRect(sx, sy + 3, TILE, 2);
          }
          var lf = mapTileAt(mapData, proc, tx - 1, ty);
          if (lf !== WATER && lf !== -1 && lf !== DATA.TILE.VOID) {
            ctx.fillStyle = 'rgba(225,240,255,0.45)';
            ctx.fillRect(sx, sy, 2, TILE);
          }
          var rt = mapTileAt(mapData, proc, tx + 1, ty);
          if (rt !== WATER && rt !== -1 && rt !== DATA.TILE.VOID) {
            ctx.fillStyle = 'rgba(225,240,255,0.45)';
            ctx.fillRect(sx + TILE - 2, sy, 2, TILE);
          }
        } else if (tileId === WALL || tileId === DGW || tileId === MTN) {
          // Fake block height: lit top edge when open above, shadowed
          // front face when open below — flat squares become blocks.
          var above = mapTileAt(mapData, proc, tx, ty - 1);
          var below = mapTileAt(mapData, proc, tx, ty + 1);
          var solidA = (above === tileId);
          var solidB = (below === tileId);
          if (!solidA) {
            ctx.fillStyle = 'rgba(255,255,255,0.30)';
            ctx.fillRect(sx, sy, TILE, 3);
          }
          if (!solidB && below !== -1) {
            ctx.fillStyle = 'rgba(0,0,0,0.38)';
            ctx.fillRect(sx, sy + TILE - 8, TILE, 8);
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            ctx.fillRect(sx, sy + TILE - 12, TILE, 4);
          }
        }
      }
    }

    // Soft drop shadow cast onto the tile below south-facing walls,
    // grounding them like raised geometry.
    for (var ty2 = tY; ty2 < tY + tilesH; ty2++) {
      for (var tx2 = tX; tx2 < tX + tilesW; tx2++) {
        var t = mapTileAt(mapData, proc, tx2, ty2);
        if (t !== WALL && t !== DGW && t !== MTN) continue;
        var b = mapTileAt(mapData, proc, tx2, ty2 + 1);
        if (b === t || b === -1 || b === WATER) continue;
        var ssx = Math.round(offsetX + (tx2 - tX) * TILE - (camera.x - tX) * TILE);
        var ssy = Math.round(offsetY + (ty2 + 1 - tY) * TILE - (camera.y - tY) * TILE);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(ssx, ssy, TILE, 6);
      }
    }
  }

  // ── Lego Minifigure ────────────────────────────────────────
  // options: torsoColor, legColor, headColor, scale, facingLeft, emotion, weapon, hat
  function drawMinifigure(cx, cy, options) {
    options = options || {};
    var sc     = options.scale || 1;
    var flip   = options.facingLeft ? -1 : 1;
    var hColor = options.headColor  || '#F2CD37';
    var tColor = options.torsoColor || '#C91A09';
    var lColor = options.legColor   || '#1B2A34';
    var aColor = options.armsColor  || tColor;
    var emotion= options.emotion    || 'neutral';

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(flip * sc, sc);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 8, 3, 0, 0, Math.PI*2);
    ctx.fill();

    // Legs
    ctx.fillStyle = lColor;
    // Left leg
    ctx.fillRect(-7, 2, 6, 10);
    ctx.fillRect(-7, 12, 6, 2);
    // Right leg
    ctx.fillRect(1, 2, 6, 10);
    ctx.fillRect(1, 12, 6, 2);
    // Leg divider
    ctx.fillStyle = darken(lColor, 20);
    ctx.fillRect(-1, 2, 2, 10);
    // Leg outline
    ctx.strokeStyle = darken(lColor, 50);
    ctx.lineWidth = 0.5;
    ctx.strokeRect(-7, 2, 14, 12);

    // Torso
    ctx.fillStyle = tColor;
    ctx.fillRect(-7, -12, 14, 14);
    // Torso details (collar)
    ctx.fillStyle = lighten(tColor, 30);
    ctx.fillRect(-5, -12, 10, 2);
    // Torso outline
    ctx.strokeStyle = darken(tColor, 50);
    ctx.lineWidth = 0.5;
    ctx.strokeRect(-7, -12, 14, 14);
    // Torso highlight
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(-6, -11, 4, 12);

    // Arms
    ctx.fillStyle = aColor;
    // Left arm
    ctx.fillRect(-11, -11, 4, 10);
    // Right arm
    ctx.fillRect(7, -11, 4, 10);
    // Arm outline
    ctx.strokeStyle = darken(aColor, 40);
    ctx.lineWidth = 0.5;
    ctx.strokeRect(-11, -11, 4, 10);
    ctx.strokeRect(7, -11, 4, 10);
    // Hands (round)
    ctx.fillStyle = hColor;
    ctx.beginPath();
    ctx.arc(-9, -1, 3, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(9, -1, 3, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = darken(hColor, 40);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(-9, -1, 3, 0, Math.PI*2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(9, -1, 3, 0, Math.PI*2);
    ctx.stroke();

    // Neck
    ctx.fillStyle = hColor;
    ctx.fillRect(-3, -15, 6, 3);

    // Head
    ctx.fillStyle = hColor;
    ctx.beginPath();
    ctx.roundRect(-7, -27, 14, 13, [3,3,2,2]);
    ctx.fill();
    // Head outline
    ctx.strokeStyle = darken(hColor, 60);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.roundRect(-7, -27, 14, 13, [3,3,2,2]);
    ctx.stroke();
    // Head highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(-5, -26, 5, 4);

    // Face — eyes
    ctx.fillStyle = '#1B2A34';
    ctx.fillRect(-4, -23, 3, 3);
    ctx.fillRect(1,  -23, 3, 3);
    // Eye shine
    ctx.fillStyle = '#FFF';
    ctx.fillRect(-4, -23, 1, 1);
    ctx.fillRect(1,  -23, 1, 1);

    // Face — mouth
    if (emotion === 'happy' || emotion === 'laughing') {
      ctx.strokeStyle = '#1B2A34';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, -18, 3, 0.3, Math.PI - 0.3, false);
      ctx.stroke();
    } else if (emotion === 'angry') {
      ctx.strokeStyle = '#1B2A34';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-3, -18);
      ctx.lineTo(3, -18);
      ctx.stroke();
      // Angry eyebrows
      ctx.beginPath();
      ctx.moveTo(-5, -25);
      ctx.lineTo(-1, -23);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(5, -25);
      ctx.lineTo(1, -23);
      ctx.stroke();
    } else if (emotion === 'sad' || emotion === 'raw') {
      ctx.strokeStyle = '#1B2A34';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, -16, 3, Math.PI + 0.3, Math.PI*2 - 0.3, false);
      ctx.stroke();
    } else if (emotion === 'stern' || emotion === 'grave') {
      ctx.strokeStyle = '#1B2A34';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-3, -18);
      ctx.lineTo(3, -18);
      ctx.stroke();
    } else {
      // Neutral: small smile
      ctx.strokeStyle = '#1B2A34';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, -19, 2, 0, Math.PI, false);
      ctx.stroke();
    }

    // Stud on top of head
    ctx.fillStyle = lighten(hColor, 20);
    ctx.beginPath();
    ctx.ellipse(0, -28, 3.5, 1.5, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = hColor;
    ctx.fillRect(-3.5, -31, 7, 3);
    ctx.strokeStyle = darken(hColor, 50);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.ellipse(0, -28, 3.5, 1.5, 0, 0, Math.PI*2);
    ctx.stroke();

    // Hat (if any)
    if (options.hat === 'crown') {
      ctx.fillStyle = '#F2CD37';
      ctx.fillRect(-8, -33, 16, 5);
      ctx.fillRect(-8, -33, 3, -4);
      ctx.fillRect(-2, -33, 3, -6);
      ctx.fillRect(4, -33, 3, -4);
      ctx.fillStyle = '#C91A09';
      ctx.beginPath();
      ctx.arc(0, -33, 2, 0, Math.PI*2);
      ctx.fill();
    } else if (options.hat === 'hood') {
      ctx.fillStyle = darken(tColor, 10);
      ctx.beginPath();
      ctx.moveTo(-8, -27);
      ctx.lineTo(-10, -35);
      ctx.lineTo(10, -35);
      ctx.lineTo(8, -27);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, -35, 5, 2, 0, Math.PI, 0, false);
      ctx.fill();
    }

    // Weapon (right hand area)
    if (options.weapon === 'sword') {
      ctx.strokeStyle = '#9BA19D';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, -12);
      ctx.lineTo(10, -32);
      ctx.stroke();
      ctx.strokeStyle = '#DBA000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(6, -15);
      ctx.lineTo(14, -15);
      ctx.stroke();
    } else if (options.weapon === 'staff') {
      ctx.strokeStyle = '#582A12';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, -12);
      ctx.lineTo(10, -36);
      ctx.stroke();
      ctx.fillStyle = '#68BCC5';
      ctx.beginPath();
      ctx.arc(10, -37, 3, 0, Math.PI*2);
      ctx.fill();
    } else if (options.weapon === 'bow') {
      ctx.strokeStyle = '#582A12';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(10, -22, 10, -Math.PI/3, Math.PI/3, false);
      ctx.stroke();
      ctx.strokeStyle = '#E4CD9E';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(10, -12);
      ctx.lineTo(10, -32);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ── Simple NPC/enemy figure (smaller) ─────────────────────
  function drawFigureAt(tx, ty, options, offsetX, offsetY) {
    var px = offsetX + (tx - camera.x) * TILE + TILE/2;
    var py = offsetY + (ty - camera.y) * TILE + TILE - 2;
    drawMinifigure(px, py, options);
  }

  // ── World marker (kingdom) ─────────────────────────────────
  function drawWorldMarker(tx, ty, name, color, offsetX, offsetY) {
    var px = Math.round(offsetX + (tx - camera.x) * TILE);
    var py = Math.round(offsetY + (ty - camera.y) * TILE);
    if (px < -TILE || px > canvas.width || py < -TILE || py > canvas.height) return;

    // Lego brick flag
    ctx.fillStyle = color;
    ctx.fillRect(px+4, py, 24, 16);
    ctx.fillStyle = lighten(color, 30);
    ctx.fillRect(px+4, py, 24, 4);
    ctx.fillStyle = '#FFF';
    ctx.fillRect(px+4, py+6, 24, 4);
    ctx.strokeStyle = darken(color, 40);
    ctx.lineWidth = 1;
    ctx.strokeRect(px+4, py, 24, 16);

    // Flag pole
    ctx.strokeStyle = '#9BA19D';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px+4, py);
    ctx.lineTo(px+4, py+28);
    ctx.stroke();

    // City name plate
    ctx.fillStyle = '#1B2A34';
    ctx.fillRect(px-2, py+28, TILE+4, 12);
    ctx.fillStyle = '#F2CD37';
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(name.substring(0,10), px+TILE/2, py+37);
    ctx.textAlign = 'left';
  }

  // ── UI Drawing helpers ─────────────────────────────────────
  function drawPanel(x, y, w, h, options) {
    options = options || {};
    var bg    = options.bg    || '#1B2A34';
    var border= options.border|| '#F2CD37';
    var title = options.title || '';

    // Panel shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x+3, y+3, w, h);

    // Panel background (Lego stud border)
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);

    // Lego stud border top
    var studW = 8;
    ctx.fillStyle = border;
    ctx.fillRect(x, y, w, 8);
    for (var bx = x+4; bx < x+w-4; bx += studW+2) {
      ctx.fillStyle = lighten(border, 30);
      ctx.beginPath();
      ctx.ellipse(bx+studW/2, y+4, studW/2, 2, 0, 0, Math.PI*2);
      ctx.fill();
    }
    // Bottom stud border
    ctx.fillStyle = border;
    ctx.fillRect(x, y+h-8, w, 8);

    // Side borders (simple lines)
    ctx.fillStyle = border;
    ctx.fillRect(x, y, 4, h);
    ctx.fillRect(x+w-4, y, 4, h);

    // Inner border glow
    ctx.strokeStyle = lighten(border, 20);
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x+4, y+8, w-8, h-16);

    // Title
    if (title) {
      ctx.fillStyle = '#1B2A34';
      ctx.fillRect(x+8, y+2, 16+title.length*8, 12);
      ctx.fillStyle = '#F2CD37';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(title, x+12, y+11);
    }
  }

  function drawBar(x, y, w, h, value, maxVal, color, label) {
    var fill = Math.max(0, Math.min(1, value/maxVal));
    // Track
    ctx.fillStyle = '#0A0A14';
    ctx.fillRect(x, y, w, h);
    // Fill
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.round(w*fill), h);
    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(x, y, Math.round(w*fill), Math.floor(h/3));
    // Border
    ctx.strokeStyle = darken(color, 30);
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    // Label
    if (label) {
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(label+':'+value+'/'+maxVal, x+2, y+h-1);
      ctx.textAlign = 'left';
    }
  }

  function drawButton(x, y, w, h, text, active, options) {
    options = options || {};
    var col = active ? '#F2CD37' : (options.color || '#0055BF');
    var textCol = active ? '#1B2A34' : '#FFFFFF';

    // Button as Lego brick
    drawLegoBrick(x, y, w, h, col, darken(col, 30), {plate:true});

    // Text
    ctx.fillStyle = textCol;
    ctx.font = 'bold ' + (options.fontSize || 9) + 'px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w/2, y + h/2 + 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function isButtonHovered(x, y, w, h) {
    return mousePos.x >= x && mousePos.x <= x+w && mousePos.y >= y && mousePos.y <= y+h;
  }
  function isButtonClicked(x, y, w, h) {
    var mp = getMousePos();
    return mouseClicked && mp.x >= x && mp.x <= x+w && mp.y >= y && mp.y <= y+h;
  }

  // ── Text renderer ──────────────────────────────────────────
  function drawText(text, x, y, options) {
    options = options || {};
    ctx.fillStyle = options.color || '#FFFFFF';
    ctx.font = (options.bold?'bold ':'') + (options.size||10) + 'px monospace';
    ctx.textAlign  = options.align  || 'left';
    ctx.textBaseline = options.baseline || 'alphabetic';
    ctx.fillText(text, x, y);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function drawTextWrapped(text, x, y, maxW, lineH, options) {
    options = options || {};
    ctx.font = (options.bold?'bold ':'') + (options.size||9) + 'px monospace';
    ctx.fillStyle = options.color || '#FFFFFF';
    var words = text.split(' ');
    var line = '';
    var cy = y;
    for (var i = 0; i < words.length; i++) {
      var testLine = line + words[i] + ' ';
      var m = ctx.measureText(testLine);
      if (m.width > maxW && i > 0) {
        ctx.fillText(line, x, cy);
        line = words[i] + ' ';
        cy += lineH;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, cy);
    return cy + lineH;
  }

  // ── Scanline CRT overlay ───────────────────────────────────
  function drawScanlines(alpha) {
    alpha = alpha || 0.08;
    ctx.fillStyle = 'rgba(0,0,0,' + alpha + ')';
    for (var sl = 0; sl < canvas.height; sl += 2) {
      ctx.fillRect(0, sl, canvas.width, 1);
    }
    // Vignette
    var vg = ctx.createRadialGradient(
      canvas.width/2, canvas.height/2, canvas.height*0.3,
      canvas.width/2, canvas.height/2, canvas.height*0.8
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // ── Stud pattern background ────────────────────────────────
  function drawStudPattern(x, y, w, h, color, spacing) {
    spacing = spacing || 16;
    ctx.fillStyle = darken(color, 10);
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = lighten(color, 10);
    for (var sy = y+8; sy < y+h; sy += spacing) {
      for (var sx = x+8; sx < x+w; sx += spacing) {
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = darken(color, 30);
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }

  // ── Particle / floating text ───────────────────────────────
  var particles = [];
  function addFloatText(x, y, text, color) {
    particles.push({ x, y, text, color: color||'#F2CD37', life:60, vy:-1 });
  }
  function updateParticles() {
    for (var i = particles.length-1; i >= 0; i--) {
      var p = particles[i];
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) { particles.splice(i,1); continue; }
      ctx.globalAlpha = p.life / 60;
      ctx.fillStyle = p.color;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;
  }

  // ── Screen flash ───────────────────────────────────────────
  var flashTimer = 0, flashColor = '#FFF';
  function screenFlash(color, duration) { flashColor = color||'#FFF'; flashTimer = duration||8; }
  function updateFlash() {
    if (flashTimer > 0) {
      ctx.fillStyle = flashColor;
      ctx.globalAlpha = flashTimer / 20;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
      flashTimer--;
    }
  }

  return {
    init, loadTileset, loadDoodads, drawDoodad, getCanvas, getCtx, getFrame, tick,
    clear, darken, lighten,
    drawTile, drawMap, drawLegoBrick, drawStudPattern,
    drawMinifigure, drawFigureAt, drawWorldMarker,
    drawPanel, drawBar, drawButton, drawText, drawTextWrapped,
    drawScanlines, updateParticles, updateFlash,
    addFloatText, screenFlash,
    isButtonHovered, isButtonClicked,
    setCamera, getCamera,
    isKeyDown, isKeyJust, getMousePos, wasClicked, didMouseMove, clearKeys, endFrame,
    action, actionHeld,
    getBindings, getActionLabels, rebindKey, resetBindings, isCapturing, keyLabel,
    TILE
  };
})();
