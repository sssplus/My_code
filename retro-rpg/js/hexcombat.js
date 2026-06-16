// ============================================================
//  CHRONICLES OF THE SHATTERED REALM — Hex Tactical Combat
//  Party-based, AP-driven, turn-queued battles on a hex grid.
//  Matches the reference: party roster (HP/AP), boss HP banner,
//  a vertical Corruption Meter, and an ATTACK/MOVE/SKILL/ITEM/WAIT
//  command bar. Used for elite & boss encounters (e.g. the
//  Crystal Behemoth). Coexists with the 1v1 turn-based COMBAT.
// ============================================================

var HEX = (function() {

  var SIZE   = 24;                 // hex radius in px (flat-top)
  var ORIGIN = { x: 400, y: 262 }; // board centre
  var DIRS   = [ {q:1,r:0},{q:1,r:-1},{q:0,r:-1},{q:-1,r:0},{q:-1,r:1},{q:0,r:1} ];

  var state = null;
  var onEnd = null;

  // ── Hex math (axial coords) ────────────────────────────────
  function axialToPixel(q, r) {
    return { x: ORIGIN.x + SIZE * 1.5 * q, y: ORIGIN.y + SIZE * Math.sqrt(3) * (r + q / 2) };
  }
  function hexDist(a, b) {
    var dq = a.q - b.q, dr = a.r - b.r;
    return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
  }
  function genBoard(radius) {
    var t = [];
    for (var q = -radius; q <= radius; q++) {
      for (var r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
        t.push({ q: q, r: r });
      }
    }
    return t;
  }
  function key(q, r) { return q + ',' + r; }
  function onBoard(q, r) { return state.board.some(function(h){ return h.q===q && h.r===r; }); }

  // ── Unit factory ───────────────────────────────────────────
  function makeUnit(o) {
    return {
      id: o.id, name: o.name, side: o.side,
      hp: o.hp, maxHp: o.hp, ap: o.ap || 6, maxAp: o.ap || 6,
      atk: o.atk, def: o.def, mag: o.mag || 0, agi: o.agi,
      range: o.range || 1, moveRange: o.moveRange || 3,
      skills: o.skills || [], q: o.q, r: o.r,
      cls: o.cls, color: o.color, leg: o.leg, head: o.head || '#E4CD9E',
      weapon: o.weapon, hat: o.hat, boss: o.boss || false, alive: true,
      acted: false
    };
  }

  // Map the player's origin onto a tactical archetype, using real stats.
  function playerUnit() {
    var p = PLAYER.get();
    var cls = ({ sword_clan:'Knight', prince:'Knight', noble:'Knight',
                 mage_clan:'Mage', priest:'Cleric', commoner:'Archer' })[p.origin] || 'Knight';
    var arch = ARCHETYPES[cls];
    return makeUnit({
      id:'player', name: p.name, side:'ally', cls: cls,
      hp: Math.max(p.maxHp, 120), ap:6,
      atk: p.atk + 4, def: p.def + 2, mag: p.mag, agi: p.agi,
      range: arch.range, moveRange: arch.moveRange, skills: arch.skills,
      color: p.torsoColor, leg: p.legColor, head: p.headColor, weapon: p.weapon, hat: p.hat,
      q:2, r:1
    });
  }

  var ARCHETYPES = {
    Knight: { range:1, moveRange:3, hp:150, atk:26, def:18, agi:11, color:'#9BA19D', leg:'#6C6E68', weapon:'sword', skills:['shield_bash'] },
    Archer: { range:3, moveRange:4, hp:120, atk:22, def:10, agi:15, color:'#237841', leg:'#1B2A34', weapon:'bow',   skills:['power_shot'] },
    Mage:   { range:2, moveRange:3, hp:100, atk:8,  def:8,  mag:24, agi:12, color:'#0055BF', leg:'#003366', weapon:'staff', skills:['fireball','void_bolt'] },
    Cleric: { range:2, moveRange:3, hp:110, atk:12, def:12, mag:18, agi:10, color:'#77C537', leg:'#237841', weapon:'staff', skills:['heal'] }
  };

  var SKILLS = {
    shield_bash:{ name:'Shield Bash', ap:4, range:1, type:'phys', power:1.4, status:'stun', desc:'Heavy hit; stuns 1 turn.' },
    power_shot: { name:'Power Shot',  ap:4, range:4, type:'phys', power:1.8, desc:'Long-range piercing shot.' },
    fireball:   { name:'Fireball',    ap:4, range:2, type:'mag',  power:1.6, aoe:1, desc:'AoE fire burst.' },
    void_bolt:  { name:'Void Bolt',   ap:3, range:3, type:'mag',  power:2.0, dark:true, desc:'Dark damage. +Corruption.' },
    heal:       { name:'Heal',        ap:4, range:2, type:'heal', power:1.5, desc:'Restore an ally.' }
  };

  // ── Default companion party (storyboard tie-in optional) ───
  function defaultParty() {
    var party = [ playerUnit() ];
    var others = ['Archer','Mage','Cleric'];
    var coords = [ {q:3,r:0}, {q:2,r:2}, {q:3,r:1} ];
    others.forEach(function(cls, i) {
      var a = ARCHETYPES[cls];
      party.push(makeUnit({
        id:'ally_'+cls, name: cls, side:'ally', cls: cls,
        hp:a.hp, atk:a.atk, def:a.def, mag:a.mag, agi:a.agi,
        range:a.range, moveRange:a.moveRange, skills:a.skills,
        color:a.color, leg:a.leg, weapon:a.weapon, q:coords[i].q, r:coords[i].r
      }));
    });
    return party;
  }

  // ── Start a battle ─────────────────────────────────────────
  function start(party, enemies, callback, opts) {
    opts = opts || {};
    onEnd = callback;
    var board = genBoard(3);
    var units = party.concat(enemies);
    var queue = units.slice().sort(function(a,b){ return b.agi - a.agi; });

    state = {
      board: board, units: units, queue: queue, turnIdx: 0,
      mode: 'menu',                // menu | move | attack | skill | end
      cmd: 0, skillSel: 0,
      reachable: [], targets: [],
      hover: null, log: [],
      banner: 90, turn: 1,
      bg: opts.bg || '#1a1230', title: opts.title || 'TACTICAL BATTLE',
      victory: false, defeat: false, endTimer: 0
    };
    addLog('Battle begins — ' + state.title);
    beginTurn();
    return state;
  }

  function getState() { return state; }
  function isActive() { return state !== null && !(state.mode === 'end'); }

  function addLog(m) { state.log.unshift(m); if (state.log.length > 6) state.log.pop(); }

  function active() { return state.queue[state.turnIdx % state.queue.length]; }
  function allies()  { return state.units.filter(function(u){ return u.side==='ally' && u.alive; }); }
  function foes()    { return state.units.filter(function(u){ return u.side==='enemy' && u.alive; }); }
  function unitAt(q, r) { return state.units.find(function(u){ return u.alive && u.q===q && u.r===r; }); }

  // ── Turn flow ──────────────────────────────────────────────
  function beginTurn() {
    var guard = 0;
    while (guard++ < 100) {
      var u = active();
      if (u && u.alive) break;
      state.turnIdx++;
    }
    var u = active();
    if (!u) return;
    u.ap = u.maxAp; u.acted = false;
    if (u.stun) { u.stun = false; addLog(u.name + ' is stunned!'); return endTurn(); }
    if (u.side === 'enemy') { state.mode = 'enemyThinking'; state.aiTimer = 24; }
    else { state.mode = 'menu'; state.cmd = 0; computeReachable(u); }
  }

  function endTurn() {
    if (checkEnd()) return;
    state.turnIdx++;
    if (state.turnIdx % state.queue.length === 0) state.turn++;
    state.mode = 'menu'; state.reachable = []; state.targets = [];
    beginTurn();
  }

  function checkEnd() {
    if (foes().length === 0)   { state.victory = true; finish('win');  return true; }
    if (allies().length === 0) { state.defeat  = true; finish('lose'); return true; }
    return false;
  }

  function finish(result) {
    state.mode = 'end'; state.endTimer = 0; state.result = result;
    if (result === 'win') {
      var xp = 0;
      foes().forEach(function(){});
      state.units.filter(function(u){ return u.side==='enemy'; }).forEach(function(e){
        xp += e.boss ? 120 : 30;
        if (e.codexType) PLAYER.recordKill(e.codexType);
      });
      PLAYER.gainXp(xp);
      addLog('Victory! +' + xp + ' XP');
    } else {
      addLog('The party has fallen...');
    }
  }

  // ── Reachability (BFS over AP / moveRange) ─────────────────
  function computeReachable(u) {
    var maxSteps = Math.min(u.moveRange, u.ap);
    var seen = {}; seen[key(u.q,u.r)] = 0;
    var frontier = [{ q:u.q, r:u.r, d:0 }];
    var out = [];
    while (frontier.length) {
      var c = frontier.shift();
      if (c.d >= maxSteps) continue;
      DIRS.forEach(function(d) {
        var nq = c.q + d.q, nr = c.r + d.r, k = key(nq, nr);
        if (!onBoard(nq, nr) || seen[k] !== undefined) return;
        if (unitAt(nq, nr)) return;          // blocked by occupant
        seen[k] = c.d + 1;
        out.push({ q:nq, r:nr, d:c.d + 1 });
        frontier.push({ q:nq, r:nr, d:c.d + 1 });
      });
    }
    state.reachable = out;
  }

  function computeTargets(u, range) {
    state.targets = foes().filter(function(e){ return hexDist(u, e) <= range; });
  }
  function computeHealTargets(u, range) {
    state.targets = allies().filter(function(a){ return hexDist(u, a) <= range; });
  }

  // ── Actions ────────────────────────────────────────────────
  function moveTo(u, q, r) {
    var cell = state.reachable.find(function(c){ return c.q===q && c.r===r; });
    if (!cell) return false;
    u.q = q; u.r = r; u.ap -= cell.d;
    addLog(u.name + ' moves.');
    afterAction(u);
    return true;
  }

  function basicAttack(u, target) {
    if (hexDist(u, target) > u.range) return false;
    if (u.ap < 3) return false;
    u.ap -= 3;
    var dmg = damage(u.atk, target.def, 1.0);
    applyDamage(target, dmg);
    addLog(u.name + ' hits ' + target.name + ' for ' + dmg + '.');
    ENGINE.screenFlash('#FFF', 3);
    afterAction(u);
    return true;
  }

  function useSkill(u, skillId, target) {
    var sk = SKILLS[skillId];
    if (!sk || u.ap < sk.ap || hexDist(u, target) > sk.range) return false;
    u.ap -= sk.ap;
    if (sk.type === 'heal') {
      var h = Math.floor(u.mag * sk.power);
      target.hp = Math.min(target.maxHp, target.hp + h);
      addLog(u.name + ' heals ' + target.name + ' (+' + h + ').');
    } else {
      var atkStat = sk.type === 'mag' ? u.mag : u.atk;
      var victims = sk.aoe ? foes().filter(function(e){ return hexDist(target, e) <= sk.aoe; }) : [target];
      victims.forEach(function(v) {
        var dmg = damage(atkStat, sk.type === 'mag' ? 0 : v.def, sk.power);
        applyDamage(v, dmg);
        if (sk.status === 'stun') v.stun = true;
        addLog(u.name + ' — ' + sk.name + ' hits ' + v.name + ' for ' + dmg + '.');
      });
      if (sk.dark) { var p = PLAYER.get(); p.corruption = Math.min(100, (p.corruption||0) + 4); addLog('The Void answers. Corruption rises.'); }
      ENGINE.screenFlash(sk.dark ? '#81007B' : (sk.type==='mag'?'#FE8A18':'#FFF'), 5);
    }
    afterAction(u);
    return true;
  }

  function afterAction(u) {
    state.mode = 'menu'; state.cmd = 0; state.targets = [];
    if (checkEnd()) return;
    if (u.side === 'ally') {
      computeReachable(u);
      if (u.ap < 3 && state.reachable.length === 0) endTurn();   // nothing left to do
    }
  }

  function damage(atk, def, mult) {
    var base = atk * (mult || 1);
    var d = Math.max(1, Math.round(base - def * 0.5));
    return d + Math.floor(Math.random() * 3) - 1;
  }
  function applyDamage(t, dmg) {
    t.hp = Math.max(0, t.hp - Math.max(0, dmg));
    if (t.hp <= 0) { t.alive = false; addLog(t.name + ' is destroyed!'); }
  }

  // ── Enemy AI ───────────────────────────────────────────────
  function enemyAct(u) {
    var guard = 0;
    while (u.ap >= 1 && guard++ < 12) {
      var foesA = allies();
      if (!foesA.length) break;
      // nearest ally
      foesA.sort(function(a,b){ return hexDist(u,a) - hexDist(u,b); });
      var tgt = foesA[0];
      if (hexDist(u, tgt) <= u.range && u.ap >= 3) {
        // boss AoE flourish occasionally
        if (u.boss && Math.random() < 0.22 && u.ap >= 4) {
          u.ap -= 4;
          allies().filter(function(a){ return hexDist(u,a) <= 1; }).forEach(function(a){
            var dmg = damage(u.atk, a.def, 0.8); applyDamage(a, dmg);
            addLog(u.name + ' erupts — ' + a.name + ' takes ' + dmg + '!');
          });
          ENGINE.screenFlash('#81007B', 8);
        } else {
          basicAttackRaw(u, tgt);
        }
        if (checkEnd()) return;
      } else if (u.ap >= 1) {
        // step toward target
        var step = bestStep(u, tgt);
        if (!step) break;
        u.q = step.q; u.r = step.r; u.ap -= 1;
      } else break;
    }
    if (!checkEnd()) endTurn();
  }
  function basicAttackRaw(u, target) {
    u.ap -= 3;
    var dmg = damage(u.atk, target.def, 1.0);
    applyDamage(target, dmg);
    addLog(u.name + ' strikes ' + target.name + ' for ' + dmg + '.');
    ENGINE.screenFlash('#C91A09', 4);
  }
  function bestStep(u, tgt) {
    var best = null, bestD = hexDist(u, tgt);
    DIRS.forEach(function(d) {
      var nq = u.q + d.q, nr = u.r + d.r;
      if (!onBoard(nq, nr) || unitAt(nq, nr)) return;
      var nd = hexDist({q:nq,r:nr}, tgt);
      if (nd < bestD) { bestD = nd; best = { q:nq, r:nr }; }
    });
    return best;
  }

  // ── Pixel → nearest hex (mouse) ────────────────────────────
  function pixelToHex(mx, my) {
    var best = null, bd = 1e9;
    state.board.forEach(function(h) {
      var p = axialToPixel(h.q, h.r);
      var d = (p.x-mx)*(p.x-mx) + (p.y-my)*(p.y-my);
      if (d < bd) { bd = d; best = h; }
    });
    return (bd < SIZE*SIZE*1.4) ? best : null;
  }

  // ── Input ──────────────────────────────────────────────────
  var CMDS = ['attack','move','skill','item','wait'];

  function update(dt) {
    if (!state) return;
    if (state.banner > 0) state.banner--;
    if (state.mode === 'enemyThinking') {
      state.aiTimer--;
      if (state.aiTimer <= 0) { state.mode='enemyActing'; enemyAct(active()); }
      return;
    }
    if (state.mode === 'end') { state.endTimer++; return; }
  }

  function handleInput() {
    if (!state) return;
    if (state.mode === 'end') {
      if (state.endTimer > 20 && (ENGINE.action('confirm') || ENGINE.wasClicked())) {
        var cb = onEnd, res = state.result; state = null; onEnd = null;
        if (cb) cb(res);
      }
      return;
    }
    var u = active();
    if (!u || u.side !== 'ally') return;

    var mp = ENGINE.getMousePos();
    state.hover = pixelToHex(mp.x, mp.y);

    if (state.mode === 'menu') {
      // command bar buttons
      CMDS.forEach(function(c, i) {
        var bx = 250 + i*62;
        if (ENGINE.isButtonClicked(bx, 520, 58, 32)) chooseCmd(i);
      });
      if (ENGINE.action('left'))  state.cmd = (state.cmd + CMDS.length - 1) % CMDS.length;
      if (ENGINE.action('right')) state.cmd = (state.cmd + 1) % CMDS.length;
      if (ENGINE.action('confirm')) chooseCmd(state.cmd);
      if (ENGINE.isKeyJust('KeyA')) chooseCmd(0);
      if (ENGINE.isKeyJust('KeyV')) chooseCmd(1);  // moVe
      if (ENGINE.isKeyJust('KeyS')) chooseCmd(2);
      if (ENGINE.isKeyJust('KeyW')) chooseCmd(4);
      return;
    }

    if (state.mode === 'move') {
      if (ENGINE.action('cancel')) { state.mode='menu'; return; }
      if (ENGINE.wasClicked() && state.hover) moveTo(u, state.hover.q, state.hover.r);
      return;
    }

    if (state.mode === 'attack') {
      if (ENGINE.action('cancel')) { state.mode='menu'; return; }
      if (ENGINE.wasClicked() && state.hover) {
        var t = unitAt(state.hover.q, state.hover.r);
        if (t && t.side==='enemy') basicAttack(u, t);
      }
      return;
    }

    if (state.mode === 'skill') {
      if (ENGINE.action('cancel')) { state.mode='menu'; return; }
      if (ENGINE.action('up'))   state.skillSel = (state.skillSel+u.skills.length-1)%u.skills.length;
      if (ENGINE.action('down')) state.skillSel = (state.skillSel+1)%u.skills.length;
      // pick target by click
      if (ENGINE.wasClicked() && state.hover) {
        var sk = SKILLS[u.skills[state.skillSel]];
        var t2 = unitAt(state.hover.q, state.hover.r);
        if (sk && t2) {
          if (sk.type==='heal' && t2.side==='ally') useSkill(u, u.skills[state.skillSel], t2);
          else if (sk.type!=='heal' && t2.side==='enemy') useSkill(u, u.skills[state.skillSel], t2);
        }
      }
      if (ENGINE.action('confirm')) {
        // confirm switches to targeting highlight (already click-based); nothing else
      }
      return;
    }
  }

  function chooseCmd(i) {
    var u = active();
    state.cmd = i;
    var c = CMDS[i];
    if (c === 'attack') { computeTargets(u, u.range); state.mode = 'attack'; }
    else if (c === 'move')  { computeReachable(u); state.mode = 'move'; }
    else if (c === 'skill') {
      if (!u.skills.length) return;
      state.skillSel = 0; var sk = SKILLS[u.skills[0]];
      if (sk.type==='heal') computeHealTargets(u, sk.range); else computeTargets(u, sk.range);
      state.mode = 'skill';
    }
    else if (c === 'item')  { addLog('No items in tactical mode.'); }
    else if (c === 'wait')  { u.ap = 0; addLog(u.name + ' waits.'); endTurn(); }
  }

  // Programmatic helpers (a competent auto-resolver; also used by tests).
  function stepToward(u, tgt, withinRange) {
    computeReachable(u);
    if (!state.reachable.length) return false;
    var best=null, bd=1e9;
    state.reachable.forEach(function(c){ var d=hexDist(c,tgt); if(d<bd){bd=d;best=c;} });
    if (best && hexDist(u,tgt) > withinRange) { moveTo(u, best.q, best.r); return true; }
    return false;
  }
  function autoAllyTurn() {
    var u = active();
    if (!u || u.side!=='ally') return false;

    // Cleric: triage — heal the most-hurt ally, else fall in behind the line.
    if (u.cls === 'Cleric') {
      var hurt = allies().filter(function(a){ return a.hp < a.maxHp*0.6; })
                         .sort(function(a,b){ return (a.hp/a.maxHp)-(b.hp/b.maxHp); });
      var heal = SKILLS['heal'];
      if (hurt.length && u.ap >= heal.ap) {
        var t = hurt.find(function(a){ return hexDist(u,a) <= heal.range; });
        if (t) { useSkill(u, 'heal', t); return true; }
        if (stepToward(u, hurt[0], heal.range)) return true;
      }
    }

    // Try a damage skill first (Mage's Fireball/Void Bolt make the difference).
    for (var k = 0; k < u.skills.length; k++) {
      var sk = SKILLS[u.skills[k]];
      if (!sk || sk.type === 'heal' || u.ap < sk.ap) continue;
      var st = foes().filter(function(e){ return hexDist(u,e) <= sk.range; }).sort(function(a,b){ return a.hp-b.hp; })[0];
      if (st) { useSkill(u, u.skills[k], st); return true; }
    }

    // Basic attack anything in range (focus the weakest to clear adds).
    var inRange = foes().filter(function(e){ return hexDist(u,e) <= u.range; }).sort(function(a,b){ return a.hp-b.hp; });
    if (inRange.length && u.ap >= 3) { basicAttack(u, inRange[0]); return true; }

    // Otherwise close on the nearest foe.
    var tgt = foes().sort(function(a,b){ return hexDist(u,a)-hexDist(u,b); })[0];
    if (tgt) {
      if (stepToward(u, tgt, u.range)) return true;
      var ir = foes().filter(function(e){ return hexDist(u,e) <= u.range; });
      if (ir.length && u.ap >= 3) { basicAttack(u, ir[0]); return true; }
    }
    chooseCmd(4); // wait
    return true;
  }

  // ── Render ─────────────────────────────────────────────────
  function render(ctx, W, H) {
    if (!state) return;
    ctx.fillStyle = state.bg; ctx.fillRect(0,0,W,H);
    ENGINE.drawStudPattern(0,0,W,H,state.bg,40);
    // cave vignette
    var vg=ctx.createRadialGradient(W/2,H/2,80,W/2,H/2,420);
    vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.65)');
    ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);

    var u = active();

    // Board hexes
    state.board.forEach(function(h) {
      var p = axialToPixel(h.q, h.r);
      var reach = state.mode==='move' && state.reachable.some(function(c){ return c.q===h.q&&c.r===h.r; });
      var hov   = state.hover && state.hover.q===h.q && state.hover.r===h.r;
      var fill = reach ? 'rgba(60,150,200,0.35)' : 'rgba(40,30,60,0.55)';
      drawHex(ctx, p.x, p.y, SIZE, fill, hov ? '#F2CD37' : 'rgba(150,120,200,0.35)');
    });

    // Target highlights (attack/skill)
    if (state.mode==='attack' || state.mode==='skill') {
      state.targets.forEach(function(t){
        var p = axialToPixel(t.q,t.r);
        drawHex(ctx, p.x, p.y, SIZE, 'rgba(200,40,40,0.30)', '#C91A09');
      });
    }

    // Units (draw enemies first so party reads on top)
    state.units.filter(function(x){return x.alive;})
      .sort(function(a,b){ return axialToPixel(a.q,a.r).y - axialToPixel(b.q,b.r).y; })
      .forEach(function(un){ drawUnit(ctx, un, un===u); });

    drawHUD(ctx, W, H, u);
    ENGINE.drawScanlines(0.06);

    if (state.banner > 0) {
      ctx.globalAlpha = Math.min(1, state.banner/30);
      ENGINE.drawText('BATTLE START!', W/2, 86, {size:22,color:'#FFFFFF',bold:true,align:'center'});
      ctx.globalAlpha = 1;
    }
    if (state.mode==='end') {
      ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,W,H);
      ENGINE.drawText(state.victory?'VICTORY':'DEFEAT', W/2,H/2-10,{size:28,color:state.victory?'#F2CD37':'#C91A09',bold:true,align:'center'});
      ENGINE.drawText('Press SPACE', W/2,H/2+24,{size:10,color:'#9BA19D',align:'center'});
    }
  }

  function drawHex(ctx, cx, cy, s, fill, stroke) {
    ctx.beginPath();
    for (var i=0;i<6;i++){ var a=Math.PI/180*(60*i); var x=cx+s*Math.cos(a), y=cy+s*Math.sin(a); i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
    ctx.closePath();
    ctx.fillStyle=fill; ctx.fill();
    ctx.strokeStyle=stroke; ctx.lineWidth=1; ctx.stroke();
  }

  function drawUnit(ctx, un, isActive) {
    var p = axialToPixel(un.q, un.r);
    if (isActive) drawHex(ctx, p.x, p.y, SIZE, 'rgba(120,200,120,0.25)', '#77C537');
    var sc = un.boss ? 2.2 : 1.4;
    ENGINE.drawMinifigure(p.x, p.y + (un.boss?2:6), {
      torsoColor: un.color || (un.side==='enemy'?'#81007B':'#9BA19D'),
      legColor:   un.leg || (un.side==='enemy'?'#1B2A34':'#6C6E68'),
      headColor:  un.head || (un.side==='enemy'?'#1B2A34':'#E4CD9E'),
      weapon: un.weapon, hat: un.hat, scale: sc,
      facingLeft: un.side==='enemy'
    });
    // mini HP bar
    var bw = un.boss?40:26;
    ctx.fillStyle='#1B2A34'; ctx.fillRect(p.x-bw/2, p.y-(un.boss?34:22), bw, 4);
    ctx.fillStyle = un.side==='enemy'?'#C91A09':'#77C537';
    ctx.fillRect(p.x-bw/2, p.y-(un.boss?34:22), bw*(un.hp/un.maxHp), 4);
    if (un.stun) ENGINE.drawText('✶', p.x+bw/2+2, p.y-(un.boss?30:18), {size:9,color:'#F2CD37'});
  }

  function drawHUD(ctx, W, H, u) {
    // Party roster (top-left)
    var party = state.units.filter(function(x){ return x.side==='ally'; });
    party.forEach(function(a, i){
      var y = 8 + i*36;
      ENGINE.drawPanel(8, y, 150, 32, { bg: a===u?'rgba(40,70,30,0.95)':'rgba(8,10,22,0.9)', border:a===u?'#77C537':'#3A3F48' });
      ENGINE.drawText(a.cls, 14, y+13, {size:8,color:a.alive?'#FFF':'#6C6E68',bold:true});
      ENGINE.drawBar(60, y+6, 90, 7, a.hp, a.maxHp, '#77C537', '');
      ENGINE.drawText('AP '+a.ap+'/'+a.maxAp, 60, y+26, {size:7,color:'#68BCC5'});
    });

    // Boss banner (top-right)
    var boss = state.units.find(function(x){ return x.side==='enemy' && x.boss; }) || foes()[0];
    if (boss) {
      ENGINE.drawText(boss.name.toUpperCase(), W-16, 18, {size:11,color:'#FFFFFF',bold:true,align:'right'});
      ENGINE.drawPanel(W-230, 24, 214, 16, {bg:'rgba(8,10,22,0.9)',border:'#C91A09'});
      ctx.fillStyle='#C91A09'; ctx.fillRect(W-228, 26, 210*(boss.hp/boss.maxHp), 12);
      ENGINE.drawText('HP '+boss.hp+'/'+boss.maxHp, W-120, 36, {size:8,color:'#FFF',align:'center'});
    }

    // Corruption meter (right edge, vertical)
    var corr = (PLAYER.get().corruption)||0;
    var mx=W-26, my=120, mh=200;
    ENGINE.drawText('CORRUPTION', mx-2, my-22, {size:7,color:'#81007B',bold:true,align:'center'});
    ctx.fillStyle='#1B2A34'; ctx.fillRect(mx-8, my, 16, mh);
    ctx.fillStyle='#81007B'; ctx.fillRect(mx-8, my+mh*(1-corr/100), 16, mh*(corr/100));
    ctx.strokeStyle='#923978'; ctx.strokeRect(mx-8, my, 16, mh);
    ENGINE.drawText(corr+'%', mx-2, my+mh+14, {size:9,color:'#923978',bold:true,align:'center'});

    // Command bar (bottom-centre)
    ENGINE.drawText('COMMAND', W/2, 512, {size:8,color:'#9BA19D',align:'center'});
    CMDS.forEach(function(c, i){
      var bx=250+i*62, on = state.cmd===i && state.mode==='menu';
      var col = {attack:'#C91A09',move:'#237841',skill:'#81007B',item:'#DBA000',wait:'#0055BF'}[c];
      ENGINE.drawButton(bx, 520, 58, 32, c.toUpperCase(), on, {color:col, fontSize:7});
    });

    // Active unit box (bottom-right)
    if (u) {
      ENGINE.drawPanel(W-150, 506, 140, 48, {bg:'rgba(8,10,22,0.92)',border:'#F2CD37'});
      ENGINE.drawText(u.name+' ('+u.cls+')', W-142, 520, {size:8,color:'#F2CD37',bold:true});
      ENGINE.drawText('HP '+u.hp+'  DEF '+u.def, W-142, 534, {size:7,color:'#9BA19D'});
      ENGINE.drawText('AP '+u.ap+'/'+u.maxAp, W-142, 546, {size:7,color:'#68BCC5'});
    }

    // Legend (bottom-left) + skill list when choosing
    if (state.mode==='skill' && u) {
      ENGINE.drawPanel(8, 470, 180, 84, {bg:'rgba(8,10,22,0.95)',border:'#81007B'});
      ENGINE.drawText('SKILLS (↑↓, click target)', 14, 484, {size:7,color:'#81007B',bold:true});
      u.skills.forEach(function(sid, i){
        var sk=SKILLS[sid];
        ENGINE.drawText((i===state.skillSel?'▸ ':'  ')+sk.name+' ('+sk.ap+'AP)', 14, 500+i*14, {size:8,color:i===state.skillSel?'#F2CD37':'#9BA19D'});
      });
    }
    // turn indicator
    ENGINE.drawText('Turn '+state.turn+(u&&u.side==='enemy'?' — ENEMY':''), W/2, H-4, {size:7,color:'#6C6E68',align:'center'});
  }

  // ── Public: build a demo Crystal Behemoth encounter ────────
  function startCrystalBehemoth(callback) {
    var party = defaultParty();
    var behemoth = makeUnit({
      id:'behemoth', name:'Crystal Behemoth', side:'enemy', cls:'Boss', boss:true,
      hp:440, atk:23, def:14, agi:8, range:1, moveRange:2, q:-2, r:0,
      color:'#923978', leg:'#81007B', head:'#923978'
    });
    behemoth.codexType = 'void_knight';
    var shard1 = makeUnit({ id:'shard1', name:'Crystal Shard', side:'enemy', cls:'Shard', hp:48, atk:12, def:6, agi:13, range:1, q:-2, r:2, color:'#81007B', leg:'#1B2A34' });
    var shard2 = makeUnit({ id:'shard2', name:'Crystal Shard', side:'enemy', cls:'Shard', hp:48, atk:12, def:6, agi:13, range:1, q:-3, r:1, color:'#81007B', leg:'#1B2A34' });
    return start(party, [behemoth, shard1, shard2], callback, { bg:'#1a1230', title:'THE CRYSTAL BEHEMOTH' });
  }

  return {
    start, startCrystalBehemoth, defaultParty, getState, isActive,
    update, handleInput, render, autoAllyTurn,
    // exposed for wiring/tests
    active, allies, foes
  };
})();
