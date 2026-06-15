// ============================================================
//  CHRONICLES OF THE SHATTERED REALM — UI System
//  HUD, Menus, Shop, Political Event UI
// ============================================================

var UI = (function() {

  var menuState   = null;
  var shopState   = null;
  var eventState  = null;
  var notification= null;
  var notifTimer  = 0;

  // ── HUD (in-world overlay) ─────────────────────────────────
  function renderHUD(ctx, canvasW, canvasH, zoneName) {
    var p = PLAYER.get();
    if (!p) return;

    // Top HUD bar
    ctx.fillStyle = 'rgba(10, 10, 30, 0.85)';
    ctx.fillRect(0, 0, canvasW, 36);
    ctx.strokeStyle = '#F2CD37';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, canvasW, 36);

    // Lego stud accents
    for (var sx = 6; sx < canvasW - 6; sx += 14) {
      ctx.fillStyle = '#F2CD37';
      ctx.beginPath();
      ctx.ellipse(sx, 4, 4, 1.5, 0, 0, Math.PI*2);
      ctx.fill();
    }

    // Player stats
    var px = 8, py = 14;
    ENGINE.drawText(p.name, px, py, {size:9, color:'#F2CD37', bold:true});
    ENGINE.drawText('Lv.'+p.level, px+90, py, {size:8, color:'#DBA000'});
    ENGINE.drawText('XP:'+p.xp+'/'+p.xpNext, px+130, py, {size:7, color:'#9BA19D'});

    // HP/MP/SP bars
    ENGINE.drawBar(px,     py+8, 100, 7, p.hp, p.maxHp, '#C91A09', null);
    ENGINE.drawBar(px+108, py+8, 80,  7, p.mp, p.maxMp, '#0055BF', null);
    ENGINE.drawBar(px+196, py+8, 80,  7, p.sp, p.maxSp, '#F2CD37', null);
    ENGINE.drawText('HP', px+2,  py+13, {size:5, color:'rgba(255,255,255,0.7)'});
    ENGINE.drawText('MP', px+110,py+13, {size:5, color:'rgba(255,255,255,0.7)'});
    ENGINE.drawText('SP', px+198,py+13, {size:5, color:'rgba(255,255,255,0.7)'});

    // Gold
    ctx.fillStyle = '#DBA000';
    ctx.beginPath();
    ctx.arc(canvasW-220, 18, 6, 0, Math.PI*2);
    ctx.fill();
    ENGINE.drawText(p.gold + 'g', canvasW-212, 22, {size:9, color:'#DBA000', bold:true});

    // Zone name
    ENGINE.drawText(zoneName || 'World Map', canvasW-160, 18, {size:8, color:'#9BA19D'});

    // Controls hint — shows actual bound keys
    var b = ENGINE.getBindings();
    function k(a){ return ENGINE.keyLabel((b[a]||[])[0]); }
    ENGINE.drawText(
      '['+k('menu')+'] Menu  ['+k('interact')+'] Talk  ['+k('confirm')+'] Action  ['+k('save')+'] Save',
      canvasW/2, 28, {size:7, color:'#6C6E68', align:'center'});

    // Origin badge
    var orig = DATA.ORIGINS[p.origin];
    if (orig) {
      ctx.fillStyle = orig.color || '#9BA19D';
      ctx.fillRect(canvasW-52, 4, 44, 14);
      ENGINE.drawText(orig.class.substring(0,7), canvasW-50, 14, {size:6, color:'#FFF', bold:true});
    }
  }

  // ── Minimap ────────────────────────────────────────────────
  function renderMinimap(ctx, zone, playerX, playerY, canvasW) {
    if (!zone) return;
    var mmX = canvasW - 90, mmY = 44, mmW = 80, mmH = 60;

    ctx.fillStyle = 'rgba(10,10,30,0.85)';
    ctx.fillRect(mmX, mmY, mmW, mmH);
    ctx.strokeStyle = '#F2CD37';
    ctx.lineWidth = 1;
    ctx.strokeRect(mmX, mmY, mmW, mmH);

    // Procedural (infinite) world: sample a window centered on the player.
    if (zone.procedural) {
      var cols = 40, rows = 30;
      var cw = mmW / cols, ch = mmH / rows;
      var sx0 = Math.floor(playerX - cols/2), sy0 = Math.floor(playerY - rows/2);
      for (var ry = 0; ry < rows; ry++) {
        for (var rx = 0; rx < cols; rx++) {
          var tid = zone.getTile(sx0 + rx, sy0 + ry);
          ctx.fillStyle = (DATA.TILE_COLORS[tid] || ['#333'])[0];
          ctx.fillRect(mmX + rx*cw, mmY + ry*ch, Math.max(1, cw), Math.max(1, ch));
        }
      }
      // Entrance pips
      var pips = [];
      DATA.WORLD_MAP.markers.forEach(function(m){ pips.push({x:m.x, y:m.y, c:(DATA.KINGDOMS[m.kingdom]||{}).color || '#FFF'}); });
      DATA.WORLD_MAP.dungeons.forEach(function(d){ pips.push({x:d.x, y:d.y, c:'#81007B'}); });
      pips.forEach(function(e){
        var rx = e.x - sx0, ry = e.y - sy0;
        if (rx >= 0 && rx < cols && ry >= 0 && ry < rows) {
          ctx.fillStyle = e.c;
          ctx.fillRect(mmX + rx*cw - 1, mmY + ry*ch - 1, 3, 3);
        }
      });
      ctx.fillStyle = '#F2CD37';
      ctx.beginPath();
      ctx.arc(mmX + (cols/2)*cw, mmY + (rows/2)*ch, 2, 0, Math.PI*2);
      ctx.fill();
      ENGINE.drawText('MAP', mmX+2, mmY+8, {size:6, color:'#F2CD37'});
      return;
    }

    var scX = mmW / zone.width, scY = mmH / zone.height;

    // Tiles
    for (var ty = 0; ty < zone.height; ty++) {
      for (var tx = 0; tx < zone.width; tx++) {
        var row = zone.tiles[ty];
        if (!row) continue;
        var tileId = row[tx];
        var colors = DATA.TILE_COLORS[tileId] || ['#333','#222'];
        ctx.fillStyle = colors[0];
        ctx.fillRect(
          Math.round(mmX + tx*scX), Math.round(mmY + ty*scY),
          Math.max(1, Math.floor(scX)), Math.max(1, Math.floor(scY))
        );
      }
    }

    // Player dot
    ctx.fillStyle = '#F2CD37';
    ctx.beginPath();
    ctx.arc(mmX + playerX*scX, mmY + playerY*scY, 2, 0, Math.PI*2);
    ctx.fill();

    ENGINE.drawText('MAP', mmX+2, mmY+8, {size:6, color:'#F2CD37'});
  }

  // ── Pause/Game Menu ────────────────────────────────────────
  var MENU_TABS = ['Status','Quests','Inventory','Politics','Bonds','Controls'];
  var TAB_W = 126;

  function openMenu() {
    menuState = {
      open:    true,
      tab:     0,
      subSel:  0,
      scroll:  0
    };
  }

  function closeMenu() { menuState = null; }
  function isMenuOpen() { return !!menuState; }

  function handleMenuInput() {
    if (!menuState) return;

    // While waiting for a rebind keypress, don't process menu keys
    if (ENGINE.isCapturing()) return;

    if (ENGINE.action('cancel') || ENGINE.action('menu')) { closeMenu(); return; }

    // Tab switching
    if (ENGINE.action('left'))  menuState.tab = (menuState.tab - 1 + MENU_TABS.length) % MENU_TABS.length;
    if (ENGINE.action('right')) menuState.tab = (menuState.tab + 1) % MENU_TABS.length;

    // Mouse tab clicks
    MENU_TABS.forEach(function(tab, i) {
      if (ENGINE.isButtonClicked(20 + i*(TAB_W+8), 50, TAB_W, 28)) menuState.tab = i;
    });

    // Politics tab: convene the War Council on demand (Prince/Noble)
    if (menuState.tab === 3) {
      var pp = PLAYER.get();
      if (pp && (pp.origin === 'prince' || pp.origin === 'noble') && ENGINE.action('confirm')) {
        pendingCouncil = true;
        closeMenu();
        return;
      }
    }

    // Controls tab: rebind clicks
    if (menuState.tab === 5) {
      handleControlsClicks(20, 90, ENGINE.getCanvas().width - 40);
    }
  }

  var pendingCouncil = false;
  function consumePendingCouncil() { var v = pendingCouncil; pendingCouncil = false; return v; }

  function renderMenu(ctx, canvasW, canvasH) {
    if (!menuState) return;

    // Dim background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Main panel
    ENGINE.drawPanel(10, 40, canvasW-20, canvasH-60, { title:'CHRONICLES MENU', border:'#F2CD37' });

    // Tabs — evenly spaced using TAB_W
    MENU_TABS.forEach(function(tab, i) {
      var active = (i === menuState.tab);
      ENGINE.drawButton(20 + i*(TAB_W+4), 50, TAB_W, 28, tab, active,
        { color: active ? '#F2CD37' : '#0055BF', fontSize:7 });
    });

    // Tab content
    var contentX = 20, contentY = 90, contentW = canvasW-40, contentH = canvasH-120;
    switch(menuState.tab) {
      case 0: renderStatusTab(ctx, contentX, contentY, contentW, contentH); break;
      case 1: SYSTEMS.renderQuestPanel(ctx, contentX, contentY, contentW, contentH); break;
      case 2: SYSTEMS.renderInventoryPanel(ctx, contentX, contentY, contentW, contentH); break;
      case 3: SYSTEMS.renderPoliticalPanel(ctx, contentX, contentY, contentW, contentH); break;
      case 4: SYSTEMS.renderRomancePanel(ctx, contentX, contentY, contentW, contentH); break;
      case 5: renderControlsTab(ctx, contentX, contentY, contentW, contentH); break;
    }

    ENGINE.drawText('[Q / ←]  prev tab    [E / →]  next tab    [M / ESC]  close',
      canvasW/2, canvasH-22, {size:7, color:'#6C6E68', align:'center'});
  }

  // ── Controls tab ───────────────────────────────────────────
  // State for which slot is currently being captured
  var rebindTarget = null;  // { action, slot } | null

  function handleControlsClicks(x, y, w) {
    var binds  = ENGINE.getBindings();
    var labels = ENGINE.getActionLabels();
    var actions = Object.keys(labels);
    var rowH = 36;

    actions.forEach(function(actionName, i) {
      var ry = y + i * rowH;
      // Slot 0 button
      if (ENGINE.isButtonClicked(x + w - 240, ry + 4, 110, 24)) {
        rebindTarget = { action: actionName, slot: 0 };
        ENGINE.rebindKey(actionName, 0, function(code) {
          rebindTarget = null;
          if (code) UI.showNotification('Rebound: ' + ENGINE.keyLabel(code), '#77C537');
        });
      }
      // Slot 1 button
      if (ENGINE.isButtonClicked(x + w - 124, ry + 4, 110, 24)) {
        rebindTarget = { action: actionName, slot: 1 };
        ENGINE.rebindKey(actionName, 1, function(code) {
          rebindTarget = null;
          if (code) UI.showNotification('Rebound: ' + ENGINE.keyLabel(code), '#77C537');
        });
      }
    });

    // Reset all button
    var resetY = y + actions.length * rowH + 8;
    if (ENGINE.isButtonClicked(x, resetY, 180, 26)) {
      ENGINE.resetBindings();
      UI.showNotification('Controls reset to defaults!', '#F2CD37');
    }
  }

  function renderControlsTab(ctx, x, y, w, h) {
    var binds   = ENGINE.getBindings();
    var labels  = ENGINE.getActionLabels();
    var actions = Object.keys(labels);
    var rowH    = 36;

    // Section dividers
    var sections = { up:'MOVEMENT', attack:'COMBAT', confirm:'GENERAL' };

    // Header row
    ENGINE.drawLegoBrick(x, y - 8, w, 18, '#0055BF', ENGINE.darken('#0055BF', 30), {plate:true});
    ENGINE.drawText('ACTION', x+4, y+4, {size:7, color:'#FFF', bold:true});
    ENGINE.drawText('PRIMARY KEY', x+w-238, y+4, {size:7, color:'#FFF', bold:true});
    ENGINE.drawText('SECONDARY KEY', x+w-122, y+4, {size:7, color:'#FFF', bold:true});

    actions.forEach(function(actionName, i) {
      var ry  = y + i * rowH;
      var keys = binds[actionName] || [null, null];

      // Section heading
      if (sections[actionName]) {
        ENGINE.drawText('── ' + sections[actionName] + ' ──', x, ry + 2, {size:6, color:'#F2CD37'});
        ry += 12;
      }

      var isCapturing0 = rebindTarget && rebindTarget.action === actionName && rebindTarget.slot === 0;
      var isCapturing1 = rebindTarget && rebindTarget.action === actionName && rebindTarget.slot === 1;
      var hov0 = ENGINE.isButtonHovered(x+w-240, ry+4, 110, 24);
      var hov1 = ENGINE.isButtonHovered(x+w-124, ry+4, 110, 24);

      // Row background (alternate)
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.1)';
      ctx.fillRect(x, ry, w, rowH - 2);

      // Action label
      ENGINE.drawText(labels[actionName], x+4, ry + 16, {size:7, color:'#9BA19D'});

      // Primary key button
      var k0label = isCapturing0 ? '< PRESS KEY >' : ENGINE.keyLabel(keys[0]);
      ENGINE.drawButton(x+w-240, ry+4, 110, 24, k0label,
        isCapturing0 || hov0,
        { color: isCapturing0 ? '#DBA000' : (hov0 ? '#237841' : '#1B2A34'), fontSize: 8 });

      // Secondary key button
      var k1label = isCapturing1 ? '< PRESS KEY >' : ENGINE.keyLabel(keys[1]);
      ENGINE.drawButton(x+w-124, ry+4, 110, 24, k1label,
        isCapturing1 || hov1,
        { color: isCapturing1 ? '#DBA000' : (hov1 ? '#237841' : '#1B2A34'), fontSize: 8 });
    });

    // Reset button
    var resetY = y + actions.length * rowH + 8;
    ENGINE.drawButton(x, resetY, 180, 26, 'RESET TO DEFAULTS',
      ENGINE.isButtonHovered(x, resetY, 180, 26),
      { color: '#C91A09', fontSize: 7 });

    // Capture hint
    if (rebindTarget) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, ENGINE.getCanvas().width, ENGINE.getCanvas().height);
      ENGINE.drawPanel(ENGINE.getCanvas().width/2-180, ENGINE.getCanvas().height/2-40, 360, 80,
        {bg:'rgba(10,10,30,0.97)', border:'#DBA000', title:'REBIND KEY'});
      ENGINE.drawText('Press any key to bind...', ENGINE.getCanvas().width/2,
        ENGINE.getCanvas().height/2+4, {size:9, color:'#F2CD37', align:'center'});
      ENGINE.drawText('(ESC to cancel)', ENGINE.getCanvas().width/2,
        ENGINE.getCanvas().height/2+22, {size:7, color:'#9BA19D', align:'center'});
    }

    ENGINE.drawText('Click a key button to rebind it  •  ESC cancels capture',
      x+w/2, resetY+36, {size:7, color:'#6C6E68', align:'center'});
  }

  function renderStatusTab(ctx, x, y, w, h) {
    var p = PLAYER.get();
    if (!p) return;

    var orig = DATA.ORIGINS[p.origin];
    var king = DATA.KINGDOMS[p.kingdom];

    // Large figure
    ENGINE.drawMinifigure(x + 70, y + 120, {
      torsoColor: p.torsoColor,
      legColor:   p.legColor,
      headColor:  p.headColor || '#F2CD37',
      weapon:     p.weapon,
      hat:        p.hat,
      scale:      2.0,
      emotion:    p.hp < p.maxHp * 0.3 ? 'sad' : 'happy'
    });

    // Status info
    var tx = x + 160;
    ENGINE.drawText(p.name, tx, y+16, {size:16, color:'#F2CD37', bold:true});
    ENGINE.drawText((orig ? orig.class : 'Unknown') + ' — Lv.' + p.level, tx, y+36, {size:9, color:king ? king.color : '#9BA19D'});
    ENGINE.drawText('XP: ' + p.xp + ' / ' + p.xpNext, tx, y+52, {size:8, color:'#9BA19D'});
    if (p.militaryRank >= 0) {
      ENGINE.drawText('Military Rank: ' + PLAYER.getRankName(), tx, y+64, {size:8, color:'#C91A09'});
    }

    var sy = y + 80;
    ENGINE.drawText('STATS', tx, sy, {size:9, color:'#F2CD37', bold:true});
    ENGINE.drawBar(tx, sy+10, 200, 10, p.hp, p.maxHp, '#C91A09', 'HP');
    ENGINE.drawBar(tx, sy+24, 200, 10, p.mp, p.maxMp, '#0055BF', 'MP');
    ENGINE.drawBar(tx, sy+38, 200, 10, p.sp, p.maxSp, '#F2CD37', 'SP');
    ENGINE.drawBar(tx, sy+52, 160, 8,  p.atk, 40, '#FE8A18', 'ATK');
    ENGINE.drawBar(tx, sy+64, 160, 8,  p.def, 40, '#9BA19D', 'DEF');
    ENGINE.drawBar(tx, sy+76, 160, 8,  p.mag, 40, '#81007B', 'MAG');
    ENGINE.drawBar(tx, sy+88, 160, 8,  p.agi, 30, '#77C537', 'AGI');

    // Skills
    ENGINE.drawText('SKILLS', tx, sy+110, {size:9, color:'#F2CD37', bold:true});
    p.skills.forEach(function(sk, i) {
      var skill = DATA.SKILLS[sk];
      if (!skill) return;
      ENGINE.drawText('• ' + skill.name + '  [' + (skill.cost||0) + (skill.costType||'').toUpperCase() + ']',
        tx, sy+124+i*14, {size:8, color:'#9BA19D'});
    });

    // Blood power
    if (p.bloodPower) {
      ENGINE.drawText('BLOOD POWER: ' + p.bloodPower.toUpperCase().replace('_',' '), tx, sy+200, {size:8, color:'#F2CD37', bold:true});
    }
  }

  // ── Shop ──────────────────────────────────────────────────
  function openShop(npcName, items) {
    shopState = {
      open:   true,
      npcName:npcName || 'Merchant',
      items:  items || ['health_potion','mana_potion','stamina_draft','iron_sword','iron_plate'],
      selIdx: 0
    };
  }

  function closeShop() { shopState = null; }
  function isShopOpen() { return !!shopState; }

  function handleShopInput() {
    if (!shopState) return;
    if (ENGINE.action('cancel')) { closeShop(); return; }

    var canvasW = ENGINE.getCanvas().width;
    var canvasH = ENGINE.getCanvas().height;

    // Buy on click
    shopState.items.forEach(function(itemId, i) {
      var by = 130 + i * 36;
      if (ENGINE.isButtonClicked(canvasW/2-150, by, 300, 32)) {
        var item = DATA.ITEMS[itemId];
        if (item && PLAYER.spendGold(item.cost)) {
          PLAYER.addItem(itemId, 1);
          showNotification('Bought ' + item.name + '!', '#77C537');
        } else {
          showNotification('Not enough gold!', '#C91A09');
        }
      }
      if (ENGINE.didMouseMove() && ENGINE.isButtonHovered(canvasW/2-150, by, 300, 32)) shopState.selIdx = i;
    });

    if (ENGINE.isButtonClicked(canvasW/2-80, 130 + shopState.items.length*36 + 10, 160, 28)) {
      closeShop();
    }
  }

  function renderShop(ctx, canvasW, canvasH) {
    if (!shopState) return;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ENGINE.drawPanel(canvasW/2-200, 60, 400, shopState.items.length*36+140, {title:"SHOP: "+shopState.npcName.substring(0,12), border:'#DBA000'});

    var p = PLAYER.get();
    ENGINE.drawText('Gold: ' + p.gold + 'g', canvasW/2-180, 100, {size:9, color:'#DBA000', bold:true});

    shopState.items.forEach(function(itemId, i) {
      var item = DATA.ITEMS[itemId];
      if (!item) return;
      var by = 116 + i*36;
      var canAfford = p.gold >= item.cost;
      var hov = ENGINE.isButtonHovered(canvasW/2-180, by, 340, 32);
      ENGINE.drawButton(canvasW/2-180, by, 340, 32,
        item.name + '  |  ' + item.cost + 'g  |  ' + (item.desc||''),
        hov && canAfford,
        { color: canAfford ? '#1B2A34' : '#2A0A0A', fontSize:8 }
      );
      // Item color dot
      ctx.fillStyle = item.color || '#9BA19D';
      ctx.beginPath();
      ctx.arc(canvasW/2-168, by+16, 6, 0, Math.PI*2);
      ctx.fill();
    });

    ENGINE.drawButton(canvasW/2-80, 116+shopState.items.length*36, 160, 28, '[ESC] Close', false, {color:'#6C6E68', fontSize:8});
  }

  // ── War Council / Kingdom Management UI ────────────────────
  //  A command-tent decision screen: persistent GOLD / MORALE /
  //  LOYALTY HUD, a speaking advisor, and a 2×2 grid of command
  //  cards whose consequences preview before you commit.
  function showPoliticalEvent(event, onChoice) {
    eventState = {
      event:    event,
      onChoice: onChoice,
      selIdx:   0,
      open:     true
    };
  }

  function isPoliticalEventOpen() { return !!eventState; }

  function chooseEventOption(i) {
    if (!eventState) return;
    var ev = eventState.event;
    eventState.open = false;
    if (eventState.onChoice) eventState.onChoice(ev.id, i);
    eventState = null;
  }

  // 2×2 grid geometry for the command cards (matches the renderer)
  function eventCardRect(i, canvasW, canvasH) {
    var gx = 40, gy = canvasH - 132, gw = canvasW - 80;
    var cw = (gw - 16) / 2, chh = 44;
    var col = i % 2, row = Math.floor(i / 2);
    return { x: gx + col * (cw + 16), y: gy + row * (chh + 8), w: cw, h: chh };
  }

  function handleEventInput() {
    if (!eventState) return;
    var ev = eventState.event;
    var canvasW = ENGINE.getCanvas().width, canvasH = ENGINE.getCanvas().height;
    var n = ev.options.length;

    // Keyboard: 2×2 grid navigation
    if (ENGINE.action('left'))  eventState.selIdx = (eventState.selIdx % 2 === 0) ? eventState.selIdx + 1 : eventState.selIdx - 1;
    if (ENGINE.action('right')) eventState.selIdx = (eventState.selIdx % 2 === 0) ? eventState.selIdx + 1 : eventState.selIdx - 1;
    if (ENGINE.action('up'))    eventState.selIdx = (eventState.selIdx - 2 + n) % n;
    if (ENGINE.action('down'))  eventState.selIdx = (eventState.selIdx + 2) % n;
    eventState.selIdx = Math.max(0, Math.min(n - 1, eventState.selIdx));

    if (ENGINE.action('confirm')) { chooseEventOption(eventState.selIdx); return; }
    for (var k = 0; k < n; k++) {
      if (ENGINE.isKeyJust('Digit' + (k+1))) { chooseEventOption(k); return; }
    }

    for (var i = 0; i < n; i++) {
      var r = eventCardRect(i, canvasW, canvasH);
      if (eventState && ENGINE.isButtonClicked(r.x, r.y, r.w, r.h)) { chooseEventOption(i); return; }
      if (eventState && ENGINE.didMouseMove() && ENGINE.isButtonHovered(r.x, r.y, r.w, r.h)) eventState.selIdx = i;
    }

    if (eventState && ENGINE.action('cancel')) eventState = null;
  }

  // Persistent three-resource HUD: GOLD / MORALE / LOYALTY.
  function renderKingdomHUD(ctx, canvasW) {
    var p = PLAYER.get();
    if (!p) return;
    var gold    = p.treasury || 0;
    var goldPct = Math.min(100, Math.round(gold / 20000 * 100));
    var morale  = Math.round(p.armyMorale != null ? p.armyMorale : 70);
    var loyalty = Math.round(p.councilTrust != null ? p.councilTrust : 50);

    ENGINE.drawPanel(8, 6, canvasW - 16, 40, { bg: 'rgba(8,8,16,0.95)', border: '#DBA000' });
    var segW = (canvasW - 16) / 3;
    drawHudStat(ctx, 16,            'GOLD',    '◉', gold.toLocaleString(), goldPct, '#DBA000', segW - 16);
    drawHudStat(ctx, 16 + segW,     'MORALE',  '⚑', morale + '',          Math.min(100, morale), '#77C537', segW - 16);
    drawHudStat(ctx, 16 + segW * 2, 'LOYALTY', '⚒', loyalty + '',         Math.min(100, loyalty), '#68BCC5', segW - 16);
  }

  function drawHudStat(ctx, x, label, icon, value, pct, color, w) {
    ENGINE.drawText(icon, x, 24, { size: 12, color: color });
    ENGINE.drawText(label, x + 18, 22, { size: 9, color: '#FFFFFF', bold: true });
    ENGINE.drawText(value, x + 18 + label.length * 7 + 12, 22, { size: 10, color: color, bold: true });
    ENGINE.drawText(pct + '%', x + w - 28, 22, { size: 8, color: '#9BA19D' });
    // bar
    var bx = x + 18, bw = w - 50;
    ctx.fillStyle = '#1B2A34'; ctx.fillRect(bx, 28, bw, 8);
    ctx.fillStyle = color;     ctx.fillRect(bx, 28, Math.round(bw * pct / 100), 8);
    ctx.strokeStyle = ENGINE.darken(color, 30); ctx.lineWidth = 1; ctx.strokeRect(bx, 28, bw, 8);
  }

  function renderPoliticalEvent(ctx, canvasW, canvasH) {
    if (!eventState) return;
    var ev = eventState.event;

    // Rainy command-tent backdrop
    ctx.fillStyle = 'rgba(6,8,16,0.92)';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ENGINE.drawStudPattern(0, 52, canvasW, canvasH - 52, '#0C0E18', 44);
    var vg = ctx.createRadialGradient(canvasW/2, canvasH/2, 80, canvasW/2, canvasH/2, 460);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, canvasW, canvasH);

    // Persistent resource HUD
    renderKingdomHUD(ctx, canvasW);

    // Advisor minifigure (left) addressing the war table
    var p = PLAYER.get();
    ENGINE.drawMinifigure(110, 250, { torsoColor:'#6C6E68', legColor:'#1B2A34', headColor:'#E4CD9E', weapon:'sword', scale:3.0, emotion:'stern' });
    // You (right), crowned if a prince
    if (p) ENGINE.drawMinifigure(canvasW - 110, 250, { torsoColor:p.torsoColor, legColor:p.legColor, headColor:p.headColor, hat:p.hat, scale:3.0, facingLeft:true });

    // Title banner
    ENGINE.drawPanel(canvasW/2-180, 58, 360, 26, { bg:'rgba(20,10,30,0.95)', border:'#81007B' });
    ENGINE.drawText('⚔ WAR COUNCIL — ' + ev.title, canvasW/2, 76, { size:10, color:'#F2CD37', bold:true, align:'center' });

    // Speaker dialogue (green name + white line), like the reference
    var dlgY = 150;
    ENGINE.drawPanel(40, dlgY, canvasW-80, 70, { bg:'rgba(8,10,22,0.96)', border:'#DBA000' });
    var speaker = ev.speaker || 'Captain Aris';
    ENGINE.drawText(speaker + ':', 56, dlgY + 22, { size:10, color:'#77C537', bold:true });
    ENGINE.drawTextWrapped('"' + ev.desc + '"', 56, dlgY + 40, canvasW - 112, 14, { size:9, color:'#FFFFFF' });

    // 2×2 command cards
    ev.options.forEach(function(opt, i) {
      var r = eventCardRect(i, canvasW, canvasH);
      var on = (i === eventState.selIdx);
      ENGINE.drawPanel(r.x, r.y, r.w, r.h, {
        bg: on ? 'rgba(0,40,90,0.96)' : 'rgba(10,12,24,0.92)',
        border: on ? '#F2CD37' : '#3A3F48'
      });
      ENGINE.drawText('[' + (i+1) + '] "' + opt.text + '"', r.x + 10, r.y + 18, { size:8, color: on ? '#FFFFFF' : '#B8C0CC', bold:on });
      // consequence preview for the highlighted card
      if (on) {
        var eff = formatEventEffects(opt.effects);
        var ex = r.x + 10, ey = r.y + 34;
        eff.forEach(function(s) {
          ENGINE.drawText(s.label, ex, ey, { size:7, color: s.good ? '#77C537' : '#E0564B' });
          ex += s.label.length * 4.6 + 14;
          if (ex > r.x + r.w - 40) { ex = r.x + 10; ey += 10; }
        });
      }
    });

    // Selected card's flavor description, under the dialogue
    var selOpt = ev.options[eventState.selIdx];
    if (selOpt && selOpt.desc) {
      ENGINE.drawText('▸ ' + selOpt.desc, canvasW/2, dlgY + 86, { size:8, color:'#DBA000', align:'center' });
    }
    ENGINE.drawText('↑↓←→ choose   ENTER / click to command   ESC dismiss (risky)', canvasW/2, canvasH-8, { size:7, color:'#6C6E68', align:'center' });
    ENGINE.drawScanlines(0.06);
  }

  // Map raw effect deltas to readable, color-coded labels.
  function formatEventEffects(effects) {
    if (!effects) return [];
    var out = [];
    function push(label, val, goodWhenPos) {
      if (val === undefined || val === 0) return;
      var good = goodWhenPos ? val > 0 : val < 0;
      out.push({ label: label + ' ' + (val > 0 ? '+' : '') + val, good: good });
    }
    push('Gold', effects.treasury, true);
    if (effects.gold) push('Gold', effects.gold, true);
    push('Morale', effects.armyMorale, true);
    push('Loyalty', effects.councilTrust, true);
    push('People', effects.popularFavor, true);
    push('Army', effects.armySize, true);
    push('Spies', effects.spyAgents, true);
    if (effects.foreignRel) {
      Object.keys(effects.foreignRel).forEach(function(kd) {
        push(kd.charAt(0).toUpperCase() + kd.slice(1), effects.foreignRel[kd], true);
      });
    }
    return out;
  }

  // ── Notifications ──────────────────────────────────────────
  function showNotification(text, color) {
    notification = { text: text, color: color || '#F2CD37', timer: 0 };
    notifTimer   = 120;
  }

  function renderNotification(ctx, canvasW) {
    if (!notification || notifTimer <= 0) return;
    notifTimer--;
    var alpha = Math.min(1, notifTimer / 20);
    ctx.globalAlpha = alpha;
    ENGINE.drawPanel(canvasW/2-120, 50, 240, 32, {bg:'rgba(10,10,30,0.9)', border:notification.color});
    ENGINE.drawText(notification.text, canvasW/2, 72, {size:9, color:notification.color, bold:true, align:'center'});
    ctx.globalAlpha = 1;
    if (notifTimer <= 0) notification = null;
  }

  // ── Title Screen ───────────────────────────────────────────
  function renderTitleScreen(ctx, canvasW, canvasH, frame, titleSel) {
    titleSel = titleSel || 0;
    // Animated Lego background
    ENGINE.drawStudPattern(0, 0, canvasW, canvasH, '#0A0A14', 32);

    // Falling Lego bricks animation
    var brickDefs = [
      { x:100, color:'#C91A09' }, { x:220, color:'#0055BF' }, { x:340, color:'#237841' },
      { x:460, color:'#DBA000' }, { x:580, color:'#81007B' }, { x:700, color:'#FE8A18' }
    ];
    brickDefs.forEach(function(b, i) {
      var yPos = ((frame * 0.5 + i * 80) % (canvasH + 50)) - 30;
      ENGINE.drawLegoBrick(b.x, yPos, 60, 24, b.color, ENGINE.darken(b.color, 30));
    });

    // Title bricks
    var titleBricks = [
      {x:160,y:100,w:90, h:32,color:'#C91A09',text:'CHRONICLES'},
      {x:310,y:100,w:40, h:32,color:'#6C6E68',text:'OF'},
      {x:160,y:140,w:56, h:32,color:'#0055BF',text:'THE'},
      {x:226,y:140,w:90, h:32,color:'#237841',text:'SHATTERED'},
      {x:326,y:140,w:72, h:32,color:'#DBA000',text:'REALM'},
    ];
    titleBricks.forEach(function(b) {
      var bounce = Math.sin(frame*0.02 + b.x*0.01)*3;
      ENGINE.drawLegoBrick(b.x, b.y + bounce, b.w, b.h, b.color, ENGINE.darken(b.color, 30));
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold ' + Math.floor(b.h*0.55) + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(b.text, b.x + b.w/2, b.y + b.h*0.72 + bounce);
    });

    // Subtitle
    ctx.font = '9px monospace';
    ctx.fillStyle = '#9BA19D';
    ctx.textAlign = 'center';
    ctx.fillText('— A Lego Brick Epic —', canvasW/2, 190);

    // Hero minifigures
    var figures = [
      {x:80,  torso:'#C91A09', weapon:'sword',  hat:null},
      {x:160, torso:'#0055BF', weapon:'staff',  hat:'hood'},
      {x:240, torso:'#DBA000', weapon:'staff',  hat:null},
      {x:320, torso:'#81007B', weapon:'sword',  hat:null},
      {x:400, torso:'#FE8A18', weapon:'sword',  hat:'crown'},
      {x:480, torso:'#9BA19D', weapon:null,     hat:null},
    ];
    figures.forEach(function(f, i) {
      var bob = Math.sin(frame*0.04 + i*0.8) * 4;
      ENGINE.drawMinifigure(f.x + 32, 340 + bob, {
        torsoColor: f.torso,
        legColor:   ENGINE.darken(f.torso, 40),
        headColor:  '#F2CD37',
        weapon:     f.weapon,
        hat:        f.hat,
        scale:      1.2,
        emotion:    'neutral'
      });
    });

    // Menu options
    var blink = Math.floor(frame/20) % 2;
    ENGINE.drawPanel(canvasW/2-130, 370, 260, 140, {border:'#F2CD37'});
    // Each button is "active" if keyboard cursor points to it OR mouse hovers it
    var sel0 = titleSel===0 || ENGINE.isButtonHovered(canvasW/2-110,386,220,32);
    var sel1 = titleSel===1 || ENGINE.isButtonHovered(canvasW/2-110,424,220,32);
    var sel2 = titleSel===2 || ENGINE.isButtonHovered(canvasW/2-110,462,220,24);
    // Keyboard cursor arrow indicator
    var arrowY = [402, 440, 474];
    ctx.fillStyle = '#F2CD37';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('▶', canvasW/2-116, arrowY[titleSel]);
    ctx.textAlign = 'left';
    ENGINE.drawButton(canvasW/2-110, 386, 220, 32, '[ NEW GAME ]',    sel0, {color:'#237841', fontSize:10});
    ENGINE.drawButton(canvasW/2-110, 424, 220, 32, '[ CONTINUE ]',    sel1, {color: PLAYER.hasSave() ? '#0055BF' : '#3D3D3D', fontSize:10});
    ENGINE.drawButton(canvasW/2-110, 462, 220, 24, '[ HOW TO PLAY ]', sel2, {color:'#6C6E68', fontSize:9});

    ctx.font = '7px monospace';
    ctx.fillStyle = '#6C6E68';
    ctx.textAlign = 'center';
    ctx.fillText('© Chronicles of the Shattered Realm  —  Built in Lego Bricks', canvasW/2, 512);
    ctx.textAlign = 'left';

    ENGINE.drawScanlines(0.06);
  }

  // ── How to play screen ─────────────────────────────────────
  function renderHowToPlay(ctx, canvasW, canvasH) {
    ctx.fillStyle = '#0A0A14';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ENGINE.drawStudPattern(0, 0, canvasW, canvasH, '#0A0A14', 32);

    ENGINE.drawPanel(40, 40, canvasW-80, canvasH-80, {title:'HOW TO PLAY', border:'#F2CD37'});

    var tx = 60, ty = 80;
    var sections = [
      { head:'WORLD MOVEMENT', color:'#237841',
        lines:['Arrow Keys / WASD — Move your character',
               'ENTER / E — Interact with NPCs',
               'M — Open the menu',
               'Touch walls and doors to enter zones'] },
      { head:'COMBAT', color:'#C91A09',
        lines:['Turn-based — Speed (AGI) determines turn order',
               'A — Attack    S — Skills    I — Items',
               'D — Defend    F — Flee      M — Magic',
               'Watch the Boss Phase indicator!'] },
      { head:'DIALOG', color:'#0055BF',
        lines:['SPACE or ENTER to advance text',
               'Number keys [1-4] to select choices',
               'Your decisions are remembered!'] },
      { head:'PROGRESSION', color:'#DBA000',
        lines:['Defeat enemies for XP and gold',
               'Level up to improve stats',
               'Noble/Prince: manage kingdom politics',
               'Commoner: earn military ranks'] }
    ];

    sections.forEach(function(sec, si) {
      var sx = tx + (si % 2) * (canvasW/2 - 60);
      var sy = ty + Math.floor(si/2) * 200;
      ENGINE.drawLegoBrick(sx-4, sy, 200, 16, sec.color, ENGINE.darken(sec.color, 30), {plate:true});
      ENGINE.drawText(sec.head, sx, sy+12, {size:8, color:'#FFF', bold:true});
      sec.lines.forEach(function(line, li) {
        ENGINE.drawText('• '+line, sx, sy+28+li*16, {size:7, color:'#9BA19D'});
      });
    });

    ENGINE.drawButton(canvasW/2-80, canvasH-90, 160, 28, '[ BACK ]', ENGINE.isButtonHovered(canvasW/2-80,canvasH-90,160,28), {color:'#6C6E68', fontSize:9});
    ENGINE.drawScanlines(0.06);
  }

  // ── Opening / Prologue scene ───────────────────────────────
  function renderPrologue(ctx, canvasW, canvasH, origin, frame, text, onDone) {
    ctx.fillStyle = '#0A0A14';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ENGINE.drawStudPattern(0, 0, canvasW, canvasH, '#0A0A14', 48);

    // Vignette
    var vg = ctx.createRadialGradient(canvasW/2, canvasH/2, 100, canvasW/2, canvasH/2, 400);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Kingdom banner
    var king = DATA.KINGDOMS[DATA.ORIGINS[origin].kingdom];
    if (king) {
      ENGINE.drawLegoBrick(0, 0, canvasW, 8, king.color, ENGINE.darken(king.color, 30), {plate:true});
      ENGINE.drawLegoBrick(0, canvasH-8, canvasW, 8, king.color, ENGINE.darken(king.color, 30), {plate:true});
    }

    // Prologue text
    ENGINE.drawPanel(60, canvasH-180, canvasW-120, 160, {bg:'rgba(0,0,20,0.92)', border:'#F2CD37'});
    ENGINE.drawTextWrapped(text, 80, canvasH-160, canvasW-160, 16, {size:9, color:'#FFFFFF'});
    ENGINE.drawText('Press SPACE to continue...', canvasW-200, canvasH-36, {size:7, color:'#6C6E68'});

    ENGINE.drawScanlines(0.08);
  }

  // ── Leveled-up banner ──────────────────────────────────────
  function renderLevelUp(ctx, canvasW, level) {
    ENGINE.drawPanel(canvasW/2-140, 10, 280, 36, {bg:'rgba(0,0,20,0.9)', border:'#F2CD37'});
    ENGINE.drawText('★ LEVEL UP! Now Level ' + level + ' ★', canvasW/2, 34, {size:9, color:'#F2CD37', bold:true, align:'center'});
  }

  return {
    renderHUD, renderMinimap, renderTitleScreen,
    renderHowToPlay, renderPrologue, renderLevelUp,
    renderMenu, handleMenuInput, openMenu, closeMenu, isMenuOpen,
    renderShop, handleShopInput, openShop, closeShop, isShopOpen,
    renderPoliticalEvent, handleEventInput, showPoliticalEvent, isPoliticalEventOpen,
    renderKingdomHUD, consumePendingCouncil,
    renderNotification, showNotification,
    renderControlsTab, handleControlsClicks
  };
})();
