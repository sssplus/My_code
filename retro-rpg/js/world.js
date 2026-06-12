// ============================================================
//  CHRONICLES OF THE SHATTERED REALM — World / Zone System
// ============================================================

var WORLD = (function() {

  var currentZone  = null;  // zone object from DATA.ZONES
  var zoneId       = null;
  var zoneEnemies  = [];    // live enemy instances
  var npcStates    = {};    // npcId → { x, y, movTimer, direction, ... }
  var onCombat     = null;  // callback(enemyDef, isBoss)
  var onDialog     = null;  // callback(dialogId)
  var onZoneChange = null;  // callback(newZoneId, tx, ty)

  var TILE = 32;
  var VIEW_W = 800;
  var VIEW_H = 480;  // world view area

  var encounterTimer = 0;
  var zoneEnv        = null;  // merged env for current zone

  // ── Load zone ──────────────────────────────────────────────
  function loadZone(id, startX, startY) {
    zoneId = id;

    if (id === 'world') {
      currentZone = {
        name:       'World Map — Aethoria',
        width:      Infinity,
        height:     Infinity,
        procedural: true,
        getTile:    function(x, y) { return TERRAIN.tileAt(x, y); },
        npcs:       [],
        exits:      [],
        isWorldMap: true
      };
    } else {
      currentZone = DATA.ZONES[id];
    }

    if (!currentZone) {
      console.warn('Zone not found:', id);
      return;
    }

    // Init NPC states
    npcStates = {};
    if (currentZone.npcs) {
      currentZone.npcs.forEach(function(npc) {
        npcStates[npc.id] = {
          x: npc.x, y: npc.y,
          movTimer: 0,
          movInterval: 60 + Math.floor(Math.random()*120),
          direction: Math.floor(Math.random()*4),
          hasDialog: !!npc.dialog,
          talked: false
        };
      });
    }

    // Init zone enemies
    zoneEnemies = [];
    if (currentZone.enemies) {
      currentZone.enemies.forEach(function(e, i) {
        zoneEnemies.push({
          id:      e.type + '_' + i,
          type:    e.type,
          x:       e.x,
          y:       e.y,
          isBoss:  e.isBoss || false,
          patrol:  e.patrol || false,
          alive:   true,
          movTimer:0,
          direction: Math.floor(Math.random()*4)
        });
      });
    }

    // Merge global env defaults with zone overrides
    var globalEnv = DATA.ENVIRONMENT;
    var zoneOverride = currentZone.env || {};
    zoneEnv = {
      minFrames:       zoneOverride.encounterMinFrames !== undefined ? zoneOverride.encounterMinFrames : globalEnv.encounter.minFrames,
      chance:          zoneOverride.encounterChance   !== undefined ? zoneOverride.encounterChance    : globalEnv.encounter.chance,
      groupChance:     globalEnv.encounter.groupChance,
      wildTiles:       zoneOverride.wildTiles || globalEnv.wildTiles,
      encounterTable:  zoneOverride.encounterTable || null,
      ambient:         zoneOverride.ambient ? (globalEnv.ambients[zoneOverride.ambient] || null) : null
    };

    // Position player
    if (startX !== undefined && startY !== undefined) {
      var p = PLAYER.get();
      p.x = startX;
      p.y = startY;
    }

    // Update camera
    updateCamera();
  }

  function getCurrentZone()  { return currentZone; }
  function getCurrentZoneId(){ return zoneId; }

  // ── Camera ─────────────────────────────────────────────────
  function updateCamera() {
    var p = PLAYER.get();
    if (!p || !currentZone) return;
    ENGINE.setCamera(p.x, p.y, currentZone.width, currentZone.height, VIEW_W/TILE, VIEW_H/TILE);
  }

  // ── Tile access (handles finite arrays and procedural zones) ─
  function currentTileAt(tx, ty) {
    if (!currentZone) return DATA.TILE.VOID;
    if (currentZone.procedural) return currentZone.getTile(tx, ty);
    if (tx < 0 || ty < 0 || tx >= currentZone.width || ty >= currentZone.height) return DATA.TILE.VOID;
    var row = currentZone.tiles[ty];
    return row ? row[tx] : DATA.TILE.VOID;
  }

  // ── Collision ──────────────────────────────────────────────
  function isTileWalkable(tx, ty) {
    if (!currentZone) return false;
    return DATA.WALKABLE.has(currentTileAt(tx, ty));
  }

  function isOccupiedByNpc(tx, ty) {
    if (!currentZone || !currentZone.npcs) return false;
    return currentZone.npcs.some(function(npc) {
      var ns = npcStates[npc.id];
      if (!ns) return false;
      return ns.x === tx && ns.y === ty;
    });
  }

  // ── Player movement ────────────────────────────────────────
  function movePlayer(dx, dy) {
    var p = PLAYER.get();
    if (!p || !currentZone) return;

    if (p.moveTimer > 0) { p.moveTimer--; return; }

    var nx = p.x + dx;
    var ny = p.y + dy;

    if (dx !== 0) p.facingLeft = dx < 0;

    if (!isTileWalkable(nx, ny)) return;
    if (isOccupiedByNpc(nx, ny)) { tryInteract(nx, ny); return; }

    // Check enemy collision
    var hitEnemy = zoneEnemies.find(function(e) { return e.alive && e.x === nx && e.y === ny; });
    if (hitEnemy) {
      triggerCombat(hitEnemy);
      return;
    }

    p.x = nx;
    p.y = ny;
    p.moveTimer = p.moveCooldown || 12;
    p.zone = zoneId;

    updateCamera();
    checkTriggers();
    handleRandomEncounter();
  }

  function checkTriggers() {
    var p = PLAYER.get();
    if (!currentZone) return;

    // Zone exits
    if (currentZone.exits) {
      currentZone.exits.forEach(function(exit) {
        if (p.x === exit.x && p.y === exit.y) {
          if (onZoneChange) onZoneChange(exit.targetZone, exit.targetX, exit.targetY);
        }
      });
    }

    // World map zone entries
    if (currentZone.isWorldMap) {
      // Kingdom capitals
      DATA.WORLD_MAP.markers.forEach(function(marker) {
        if (p.x === marker.x && p.y === marker.y) {
          if (onZoneChange) onZoneChange(marker.zone, 6, 6);
        }
      });
      // Dungeon entrances
      DATA.WORLD_MAP.dungeons.forEach(function(dg) {
        if (p.x === dg.x && p.y === dg.y) {
          if (onZoneChange) onZoneChange(dg.zone, 2, 8);
        }
      });
    }
  }

  // ── Random encounters ──────────────────────────────────────
  function handleRandomEncounter() {
    var p = PLAYER.get();
    if (!p || !currentZone || !zoneEnv) return;
    if (zoneEnv.chance <= 0) return;

    var tileId = currentTileAt(p.x, p.y);
    if (!zoneEnv.wildTiles.includes(tileId)) { encounterTimer = 0; return; }

    encounterTimer++;
    if (encounterTimer < zoneEnv.minFrames) return;
    if (Math.random() > zoneEnv.chance) return;

    encounterTimer = 0;
    triggerRandomCombat(tileId);
  }

  function triggerRandomCombat(tileId) {
    var pool;
    if (zoneEnv && zoneEnv.encounterTable) {
      pool = zoneEnv.encounterTable;
    } else {
      pool = (DATA.ENVIRONMENT.encounterTables[tileId]) || ['bandit'];
    }
    var enemyType = pool[Math.floor(Math.random()*pool.length)];
    var groupChance = zoneEnv ? zoneEnv.groupChance : DATA.ENVIRONMENT.encounter.groupChance;
    var count = Math.random() < groupChance ? 2 : 1;
    var enemies = [];
    for (var i = 0; i < count; i++) enemies.push({ type: enemyType, id: enemyType+'_rand'+i });
    if (onCombat) onCombat(enemies, false);
  }

  function triggerCombat(enemyInstance) {
    if (onCombat) {
      var enemies = [{ type: enemyInstance.type, id: enemyInstance.id, isBoss: enemyInstance.isBoss }];
      onCombat(enemies, enemyInstance.isBoss);
      // Mark as dead to remove from map after battle
      enemyInstance.alive = false;
    }
  }

  // ── NPC interaction ────────────────────────────────────────
  function tryInteract(tx, ty) {
    if (!currentZone || !currentZone.npcs) return;
    var npc = currentZone.npcs.find(function(n) {
      var ns = npcStates[n.id];
      return ns && ns.x === tx && ns.y === ty;
    });
    if (!npc) return;
    if (onDialog && npc.dialog) {
      onDialog(npc.dialog, npc);
    }
  }

  function interactFacing() {
    var p = PLAYER.get();
    if (!p) return;
    var dx = p.facingLeft ? -1 : 1;
    tryInteract(p.x + dx, p.y);
    // Also try same tile (for zones)
    if (!p.facingLeft) tryInteract(p.x - 1, p.y);
    tryInteract(p.x, p.y - 1);
  }

  // ── NPC movement ───────────────────────────────────────────
  function updateNpcs() {
    if (!currentZone || !currentZone.npcs) return;
    currentZone.npcs.forEach(function(npc) {
      var ns = npcStates[npc.id];
      if (!ns) return;
      ns.movTimer++;
      if (ns.movTimer < ns.movInterval) return;
      ns.movTimer = 0;

      // Random wander
      var dirs = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
      var dir  = dirs[Math.floor(Math.random()*dirs.length)];
      var nx   = ns.x + dir.dx;
      var ny   = ns.y + dir.dy;
      if (isTileWalkable(nx, ny) && !isOccupiedByNpc(nx, ny)) {
        ns.x = nx;
        ns.y = ny;
      }
    });
  }

  // ── Enemy patrol movement ──────────────────────────────────
  function updateEnemies() {
    zoneEnemies.forEach(function(enemy) {
      if (!enemy.alive || !enemy.patrol) return;
      enemy.movTimer++;
      if (enemy.movTimer < 60) return;
      enemy.movTimer = 0;

      var dirs = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
      var dir  = dirs[Math.floor(Math.random()*dirs.length)];
      var nx   = enemy.x + dir.dx;
      var ny   = enemy.y + dir.dy;
      if (isTileWalkable(nx, ny)) {
        enemy.x = nx;
        enemy.y = ny;
      }
    });
  }

  // ── Update ─────────────────────────────────────────────────
  function update() {
    updateNpcs();
    updateEnemies();
  }

  // ── Render ─────────────────────────────────────────────────
  // Scene pass is y-sorted: doodads (trees etc.), NPCs, enemies and the
  // player all draw in row order, so taller sprites correctly overlap
  // whatever stands behind them — that's what sells the 2.5D depth.
  function render(ctx, offsetX, offsetY) {
    if (!currentZone) return;

    // Draw tilemap
    ENGINE.drawMap(currentZone, offsetX, offsetY, VIEW_W, VIEW_H);

    var cam = ENGINE.getCamera();

    // World map special elements (flat, under the scene pass)
    if (currentZone.isWorldMap) {
      // Kingdom markers
      DATA.WORLD_MAP.markers.forEach(function(m) {
        ENGINE.drawWorldMarker(m.x, m.y, m.name, DATA.KINGDOMS[m.kingdom].color, offsetX, offsetY);
      });
      // Dungeon markers
      DATA.WORLD_MAP.dungeons.forEach(function(dg) {
        var px = Math.round(offsetX + (dg.x - cam.x) * TILE);
        var py = Math.round(offsetY + (dg.y - cam.y) * TILE);
        ctx.fillStyle = '#1B2A34';
        ctx.fillRect(px+2, py+2, TILE-4, TILE-4);
        ctx.strokeStyle = '#81007B';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px+2, py+2, TILE-4, TILE-4);
        ENGINE.drawText('⚠', px+8, py+22, {size:12});
      });
    }

    // Drifting cloud shadows over open terrain — cheap dynamic lighting.
    // World-anchored so they slide across the ground, not the screen.
    if (currentZone.isWorldMap || currentZone.procedural) {
      var cf = ENGINE.getFrame();
      for (var ci = 0; ci < 3; ci++) {
        var span = 90 + ci * 25;                       // tiles between repeats
        var cwx = ci * 31.7 + cf * (0.010 + ci * 0.004); // world x, drifting east
        var cwy = ci * 23.3 + cf * 0.0035;
        var csx = offsetX + ((((cwx - cam.x) % span) + span) % span - 12) * TILE;
        var csy = offsetY + ((((cwy - cam.y) % 40) + 40) % 40 - 8) * TILE;
        var crad = 150 + ci * 55;
        var cg = ctx.createRadialGradient(csx, csy, crad * 0.3, csx, csy, crad);
        cg.addColorStop(0, 'rgba(10,15,40,0.10)');
        cg.addColorStop(1, 'rgba(10,15,40,0)');
        ctx.fillStyle = cg;
        ctx.fillRect(csx - crad, csy - crad, crad * 2, crad * 2);
      }
    }

    var drawables = [];
    var frame = ENGINE.getFrame();
    var DD = TERRAIN.DOODAD;

    // Environment doodads in the visible window (+1 ring so tall
    // sprites just below the viewport still poke into view).
    var tX0 = Math.floor(cam.x) - 1;
    var tY0 = Math.floor(cam.y) - 1;
    var tilesW = Math.ceil(VIEW_W / TILE) + 3;
    var tilesH = Math.ceil(VIEW_H / TILE) + 3;
    for (var wy = tY0; wy < tY0 + tilesH; wy++) {
      for (var wx = tX0; wx < tX0 + tilesW; wx++) {
        var tid = currentTileAt(wx, wy);
        var dd  = TERRAIN.decorAt(tid, wx, wy);
        if (dd >= 0) {
          drawables.push({ y: wy - 0.1, wx: wx, wy: wy, dd: dd, kind: 'doodad' });
        }
      }
    }

    // NPCs
    if (currentZone.npcs) {
      currentZone.npcs.forEach(function(npc) {
        var ns = npcStates[npc.id];
        if (ns) drawables.push({ y: ns.y, npc: npc, ns: ns, kind: 'npc' });
      });
    }

    // Enemies
    zoneEnemies.forEach(function(enemy) {
      if (enemy.alive && DATA.ENEMIES[enemy.type]) drawables.push({ y: enemy.y, enemy: enemy, kind: 'enemy' });
    });

    // Player
    var p = PLAYER.get();
    if (p) drawables.push({ y: p.y, kind: 'player' });

    drawables.sort(function(a, b) { return a.y - b.y; });

    drawables.forEach(function(d) {
      switch (d.kind) {
        case 'doodad': {
          var dsx = Math.round(offsetX + (d.wx - cam.x) * TILE);
          var dsy = Math.round(offsetY + (d.wy - cam.y) * TILE);
          var isTree = (d.dd === DD.OAK || d.dd === DD.PINE || d.dd === DD.SNOW_PINE || d.dd === DD.DEAD_TREE);
          if (d.dd !== DD.FLOWERS) {
            ENGINE.drawShadow(dsx + TILE/2, dsy + TILE - 5,
                              isTree ? 13 : 9, isTree ? 5 : 3.5,
                              isTree ? 0.30 : 0.22);
          }
          // Foliage sways; rocks don't. Phase from world coords so
          // neighbouring trees aren't in lockstep.
          var sway = (d.dd === DD.ROCK) ? 0
            : Math.sin(frame * 0.028 + d.wx * 1.7 + d.wy * 0.9) * 1.6;
          ENGINE.drawDoodad(d.dd, dsx, dsy, sway);
          break;
        }
        case 'npc': {
          var sx = Math.round(offsetX + (d.ns.x - cam.x) * TILE + TILE/2);
          var sy = Math.round(offsetY + (d.ns.y - cam.y) * TILE + TILE - 2);
          ENGINE.drawShadow(sx, sy - 1, 10, 4);
          ENGINE.drawMinifigure(sx, sy, {
            torsoColor: d.npc.color || '#9BA19D',
            legColor:   ENGINE.darken(d.npc.color || '#9BA19D', 30),
            headColor:  d.npc.headColor || '#F2CD37',
            scale:      0.85,
            emotion:    'neutral'
          });
          // Name tag only when the player is close — keeps the scene clean
          if (p && Math.abs(p.x - d.ns.x) + Math.abs(p.y - d.ns.y) <= 2) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(sx-24, sy-50, 48, 12);
            ENGINE.drawText(d.npc.name.substring(0,8), sx-22, sy-41, {size:6, color:'#F2CD37'});
            ENGINE.drawText('●', sx-2, sy-52, {size:8, color:'#F2CD37'});
          }
          break;
        }
        case 'enemy': {
          var def = DATA.ENEMIES[d.enemy.type];
          var ex = Math.round(offsetX + (d.enemy.x - cam.x) * TILE + TILE/2);
          var ey = Math.round(offsetY + (d.enemy.y - cam.y) * TILE + TILE - 2);
          ENGINE.drawShadow(ex, ey - 1, d.enemy.isBoss ? 13 : 10, 4);
          ENGINE.drawMinifigure(ex, ey, {
            torsoColor: def.torsoColor,
            legColor:   def.legColor,
            headColor:  def.headColor || '#E4CD9E',
            scale:      d.enemy.isBoss ? 1.1 : 0.85,
            facingLeft: true,
            emotion:    'stern'
          });
          // Enemy skull indicator
          ctx.fillStyle = '#C91A09';
          ctx.beginPath();
          ctx.arc(ex, ey-50, 6, 0, Math.PI*2);
          ctx.fill();
          ENGINE.drawText('!', ex-2, ey-44, {size:8, color:'#FFF', bold:true});
          break;
        }
        case 'player': {
          var px = Math.round(offsetX + (p.x - cam.x) * TILE + TILE/2);
          var py = Math.round(offsetY + (p.y - cam.y) * TILE + TILE - 2);
          ENGINE.drawShadow(px, py - 1, 11, 4.5);
          ENGINE.drawMinifigure(px, py, {
            torsoColor: p.torsoColor,
            legColor:   p.legColor,
            headColor:  p.headColor || '#F2CD37',
            weapon:     p.weapon,
            hat:        p.hat,
            scale:      1.0,
            facingLeft: p.facingLeft,
            emotion:    'neutral'
          });
          break;
        }
      }
    });

    // Ambient light motes (pollen / dust) drifting through the scene.
    // Stateless: one candidate mote per 5x5-tile lattice cell, position
    // derived from a hash of the cell + time, so they live in world space.
    var moteCol = (zoneId && zoneId.indexOf('dungeon') >= 0) ? '200,210,230' : '255,240,170';
    var mX0 = Math.floor(cam.x / 5) - 1, mY0 = Math.floor(cam.y / 5) - 1;
    for (var my = mY0; my < mY0 + 7; my++) {
      for (var mx = mX0; mx < mX0 + 8; mx++) {
        var mh = ((Math.imul(mx, 2654435761) ^ Math.imul(my, 40503)) >>> 0) % 1000 / 1000;
        if (mh > 0.55) continue;
        var ph = frame * 0.012 + mh * 31;
        var mwx = mx * 5 + 2.5 + Math.sin(ph) * 2.2 + mh * 3;
        var mwy = my * 5 + 2.5 + Math.cos(ph * 0.8) * 1.6 - (frame * 0.004 + mh * 5) % 5;
        var msx = offsetX + (mwx - cam.x) * TILE;
        var msy = offsetY + (mwy - cam.y) * TILE;
        if (msx < offsetX || msx > offsetX + VIEW_W || msy < offsetY || msy > offsetY + VIEW_H) continue;
        var tw = 0.35 + 0.3 * Math.sin(ph * 2.3);
        ctx.fillStyle = 'rgba(' + moteCol + ',' + tw.toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(msx, msy, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(' + moteCol + ',' + (tw * 0.25).toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(msx, msy, 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Ambient environment tint over the whole scene (incl. doodads)
    if (zoneEnv && zoneEnv.ambient) {
      ctx.fillStyle = zoneEnv.ambient;
      ctx.fillRect(offsetX, offsetY, VIEW_W, VIEW_H);
    }

    // HD-2D lighting + tilt-shift depth blur over the finished scene
    ENGINE.postProcess(offsetX, offsetY, VIEW_W, VIEW_H);
  }

  function setCallbacks(combatCb, dialogCb, zoneCb) {
    onCombat     = combatCb;
    onDialog     = dialogCb;
    onZoneChange = zoneCb;
  }

  function getZoneEnemies() { return zoneEnemies; }

  return {
    loadZone, getCurrentZone, getCurrentZoneId,
    movePlayer, interactFacing,
    update, render,
    setCallbacks, getZoneEnemies,
    VIEW_W, VIEW_H
  };
})();
