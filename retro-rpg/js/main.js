// ============================================================
//  CHRONICLES OF THE SHATTERED REALM — Main Game Loop
//  State machine, boot, save/load, frame dispatch
// ============================================================

var GAME = (function() {

  var canvas, ctx;
  var W = 800, H = 560;
  var frame  = 0;
  var lastMs = 0;
  var dt     = 0;

  // ── Game States ────────────────────────────────────────────
  var STATE = {
    TITLE:     'title',
    HOW_TO:    'how_to',
    CHARGEN:   'chargen',
    PROLOGUE:  'prologue',
    SCREENPLAY:'screenplay',
    WORLD:     'world',
    COMBAT:    'combat',
    DIALOG:    'dialog',
    MENU:      'menu',
    SHOP:      'shop',
    POL_EVENT: 'pol_event',
    GAME_OVER: 'game_over'
  };

  var currentState  = STATE.TITLE;
  var previousState = null;

  // Prologue state
  var prologueText  = '';
  var prologueDone  = false;

  // Pending actions from dialog
  var pendingBossId = null;

  // Political event timer
  var polEventTimer = 0;
  var POL_INTERVAL  = 1200;  // frames

  // Level-up display timer
  var levelUpTimer  = 0;

  // ── Boot ────────────────────────────────────────────────────
  function boot() {
    canvas = document.getElementById('gameCanvas');
    canvas.width  = W;
    canvas.height = H;
    ctx    = ENGINE.init(canvas);

    // Procedural overworld seed + pixel-art tileset (procedural fallback
    // renders until the atlas finishes loading, so boot never blocks).
    TERRAIN.init(20260612);
    ENGINE.loadTileset('assets/tileset.png');
    ENGINE.loadDoodads('assets/doodads.png');

    // Keyboard for chargen name entry (printable chars only; ENGINE handles the rest)
    document.addEventListener('keydown', function(e) {
      if (currentState === STATE.CHARGEN && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.key.length === 1) CHARGEN.charInput(e.key);
      }
    });

    // Set up world callbacks
    WORLD.setCallbacks(onCombatTrigger, onDialogTrigger, onZoneChange);

    // Start at title
    transition(STATE.TITLE);
    requestAnimationFrame(mainLoop);
  }

  // ── State transitions ──────────────────────────────────────
  function transition(newState, data) {
    previousState = currentState;
    currentState  = newState;

    switch (newState) {
      case STATE.TITLE:
        break;

      case STATE.CHARGEN:
        CHARGEN.start(function(name, kingdom, origin) {
          // Build player
          PLAYER.create(name, kingdom, origin);
          PLAYER.recalcStats();
          // Start main quest for all
          PLAYER.startQuest('main_quest_1');
          // Cinematic branching screenplay (falls back to the flat
          // prologue if the module ever fails to load).
          if (typeof SCREENPLAY !== 'undefined') {
            SCREENPLAY.start(origin, onScreenplayDone);
            transition(STATE.SCREENPLAY);
          } else {
            buildPrologue(origin);
            transition(STATE.PROLOGUE);
          }
        });
        break;

      case STATE.PROLOGUE:
        prologueDone = false;
        break;

      case STATE.SCREENPLAY:
        break;

      case STATE.WORLD:
        var p = PLAYER.get();
        if (!p) break;
        if (data && data.zone) {
          WORLD.loadZone(data.zone, data.x, data.y);
        } else if (!WORLD.getCurrentZone()) {
          WORLD.loadZone(p.zone || 'world', p.worldX || p.x, p.worldY || p.y);
        }
        break;

      case STATE.COMBAT:
        if (data) {
          var playerCombatant = PLAYER.buildCombatant();
          COMBAT.start(playerCombatant, data.enemies, function(result) {
            onCombatEnd(result);
          }, { bgColor: data.bgColor || '#1B2A34', firstEncounter: data.firstEncounter });
        }
        break;

      case STATE.DIALOG:
        if (data && data.dialogId) {
          DIALOG.start(data.dialogId, function(flags, actions) {
            onDialogEnd(flags, actions, data);
          });
        }
        break;

      case STATE.GAME_OVER:
        break;
    }
  }

  // ── Prologue text builder ──────────────────────────────────
  function buildPrologue(origin) {
    var p = PLAYER.get();
    var texts = {
      sword_clan: "Dawn over the highland cliffs of Valdris. Two figures spar — fast, violent, real.\n\nA horn sounds in the distance. Wrong.\n\nYou reach for your blade. That sound is not a training signal.",
      mage_clan:  "The Arcane Tower at Moonsong. Spell matrices hum in the air around you.\n\nA crack in the ley lines. A disturbance from the east. Ancient power, long dormant, beginning to stir.",
      priest:     "The Cathedral of Aurum, before dawn. Your prayers are interrupted.\n\nA pilgrim arrives, burned. Stumbling. Eyes hollow.\n\n\"Something woke in the east,\" they say. \"Something old.\"",
      noble:      "The council chamber. Maps and accusations. Lord Caeran speaks quietly.\n\n\"Malachar's name has appeared in the eastern reports.\"\n\nYou keep your expression still. You already know.",
      prince:     "The throne room of Valdris. Your father rolls up the map.\n\n\"The five kingdoms are moving. Something is waking in the east.\"\n\nThat night, the King is found dead in his chambers.",
      commoner:   "A muddy road. Rain. You walk alongside a merchant's cart.\n\n\"You're not from around here.\"\n\n\"I'm not from anywhere in particular.\"\n\nSmoke rises in the north. The horizon is wrong."
    };
    prologueText = texts[origin] || texts.commoner;
    if (p) prologueText = prologueText.replace(/You/g, p.name || 'You');
  }

  // ── Main loop ──────────────────────────────────────────────
  function mainLoop(timestamp) {
    dt     = Math.min(timestamp - lastMs, 50); // cap at 50ms
    lastMs = timestamp;
    frame++;
    ENGINE.tick();

    update(dt);
    render(ctx);

    ENGINE.endFrame();  // clear per-frame pressed state after all handlers ran
    requestAnimationFrame(mainLoop);
  }

  // ── Update ─────────────────────────────────────────────────
  function update(dt) {
    switch (currentState) {
      case STATE.TITLE:      updateTitle();    break;
      case STATE.HOW_TO:     updateHowTo();    break;
      case STATE.CHARGEN:    CHARGEN.handleInput(); break;
      case STATE.PROLOGUE:   updatePrologue(); break;
      case STATE.SCREENPLAY:
        SCREENPLAY.update(dt);
        SCREENPLAY.updateResolve(dt);
        SCREENPLAY.handleInput();
        break;
      case STATE.WORLD:      updateWorld(dt);  break;
      case STATE.COMBAT:     updateCombat();   break;
      case STATE.DIALOG:     DIALOG.update(dt); DIALOG.handleInput(); break;
      case STATE.MENU:       UI.handleMenuInput(); break;
      case STATE.SHOP:       UI.handleShopInput(); break;
      case STATE.POL_EVENT:
        UI.handleEventInput();
        // Modal resolved or dismissed → hand control back to the world
        if (!UI.isPoliticalEventOpen()) transition(STATE.WORLD);
        break;
      case STATE.GAME_OVER:  updateGameOver(); break;
    }
  }

  // Title screen: keyboard cursor selection (↑↓ cycle items, Enter/confirm selects)
  var titleSel = 0;
  var TITLE_ITEMS = ['new', 'continue', 'howto'];

  function updateTitle() {
    var cW = W, cH = H;
    var itemY = [386, 424, 462];

    // Keyboard nav
    if (ENGINE.action('up'))   titleSel = (titleSel - 1 + TITLE_ITEMS.length) % TITLE_ITEMS.length;
    if (ENGINE.action('down')) titleSel = (titleSel + 1) % TITLE_ITEMS.length;

    // Mouse hover updates selection
    TITLE_ITEMS.forEach(function(id, i) {
      if (ENGINE.didMouseMove() && ENGINE.isButtonHovered(cW/2-110, itemY[i], 220, 32)) titleSel = i;
    });

    var confirmed = ENGINE.action('confirm') || ENGINE.isButtonClicked(cW/2-110, itemY[titleSel], 220, 36);

    if (confirmed) {
      if (titleSel === 0) { transition(STATE.CHARGEN); return; }
      if (titleSel === 1 && PLAYER.hasSave()) {
        if (PLAYER.load()) {
          var p = PLAYER.get();
          WORLD.loadZone(p.zone || 'world', p.x, p.y);
          transition(STATE.WORLD);
        }
        return;
      }
      if (titleSel === 2) { transition(STATE.HOW_TO); return; }
    }

    // Direct mouse clicks on buttons still work too
    if (ENGINE.isButtonClicked(cW/2-110, 386, 220, 32)) { transition(STATE.CHARGEN); return; }
    if (ENGINE.isButtonClicked(cW/2-110, 424, 220, 32) && PLAYER.hasSave()) {
      if (PLAYER.load()) {
        WORLD.loadZone(PLAYER.get().zone || 'world', PLAYER.get().x, PLAYER.get().y);
        transition(STATE.WORLD);
      }
      return;
    }
    if (ENGINE.isButtonClicked(cW/2-110, 462, 220, 24)) { transition(STATE.HOW_TO); return; }
  }

  function updateHowTo() {
    if (ENGINE.action('cancel') || ENGINE.action('confirm') ||
        ENGINE.isButtonClicked(W/2-80, H-90, 160, 28)) {
      transition(STATE.TITLE);
    }
  }

  // ── Screenplay resolution ──────────────────────────────────
  // The cinematic fork calls this once the player commits a choice
  // and dismisses the consequence card. Routes into the opening
  // battle (combat-path choices) or straight onto the overworld.
  function onScreenplayDone(out) {
    if (out && out.route === 'combat') {
      transition(STATE.COMBAT, out.combat);
    } else {
      transition(STATE.WORLD, { zone: out.zone, x: out.x, y: out.y });
    }
  }

  function updatePrologue() {
    if (ENGINE.action('confirm') || ENGINE.wasClicked()) {
      if (prologueDone) {
        var p = PLAYER.get();
        var king = DATA.KINGDOMS[p.kingdom];
        transition(STATE.WORLD, { zone: king.mapZone, x: king.startPos.x, y: king.startPos.y });
      } else {
        prologueDone = true;
      }
    }
  }

  function updateWorld(dt) {
    // Save shortcut
    if (ENGINE.action('save')) {
      if (PLAYER.save()) UI.showNotification('Game saved!', '#77C537');
    }

    // Toggle menu
    if (ENGINE.action('menu') || (ENGINE.action('cancel') && !UI.isMenuOpen())) {
      if (UI.isMenuOpen()) UI.closeMenu();
      else UI.openMenu();
      return;
    }

    // Pass input to open overlays first
    if (UI.isMenuOpen())          { UI.handleMenuInput(); return; }
    if (UI.isShopOpen())          { UI.handleShopInput(); return; }
    if (UI.isPoliticalEventOpen()){ UI.handleEventInput(); return; }

    // Interact
    if (ENGINE.action('interact') || ENGINE.action('confirm')) {
      WORLD.interactFacing();
    }

    // Movement (held — smooth scrolling)
    if (ENGINE.actionHeld('left'))  WORLD.movePlayer(-1,  0);
    if (ENGINE.actionHeld('right')) WORLD.movePlayer( 1,  0);
    if (ENGINE.actionHeld('up'))    WORLD.movePlayer( 0, -1);
    if (ENGINE.actionHeld('down'))  WORLD.movePlayer( 0,  1);

    // World click navigation
    if (ENGINE.wasClicked()) {
      var mp = ENGINE.getMousePos();
      var cam = ENGINE.getCamera();
      var tx = Math.floor((mp.x - 0) / ENGINE.TILE + cam.x);
      var ty = Math.floor((mp.y - 36) / ENGINE.TILE + cam.y);
      var p  = PLAYER.get();
      if (p && tx >= 0 && ty >= 0) {
        // Simple step toward clicked tile
        var dx = Math.sign(tx - p.x);
        var dy = Math.sign(ty - p.y);
        if (Math.abs(tx - p.x) > Math.abs(ty - p.y)) WORLD.movePlayer(dx, 0);
        else if (dy !== 0) WORLD.movePlayer(0, dy);
      }
    }

    WORLD.update();

    // Political event trigger (Noble/Prince)
    var p = PLAYER.get();
    if (p && (p.origin === 'noble' || p.origin === 'prince')) {
      polEventTimer++;
      if (polEventTimer >= POL_INTERVAL) {
        polEventTimer = 0;
        var event = SYSTEMS.POLITICS.triggerEvent();
        if (event) {
          UI.showPoliticalEvent(event, function(evId, choiceIdx) {
            SYSTEMS.POLITICS.resolveEventChoice(evId, choiceIdx);
            UI.showNotification('Political decision made!', '#81007B');
            // Siege event: spawn the visual army confrontation on the overworld
            if (evId === 'castle_siege' && WORLD.getCurrentZoneId() === 'world') {
              var p2 = PLAYER.get();
              WORLD.clearArmies();
              WORLD.triggerSiege(p2 ? (p2.kingdom || 'player') : 'player');
            }
          });
          transition(STATE.POL_EVENT);
        }
      }
    }

    // Commoner rank check
    if (p && p.origin === 'commoner') {
      if (SYSTEMS.MILITARY.checkPromotion()) {
        UI.showNotification('PROMOTED to ' + PLAYER.getRankName() + '!', '#C91A09');
      }
    }

    // Romance scene check
    var romanceScene = SYSTEMS.ROMANCE.checkRomanceScene();
    if (romanceScene) {
      transition(STATE.DIALOG, { dialogId: romanceScene });
    }

    // Pending boss from dialog
    if (PLAYER.getFlag('pending_boss')) {
      var bossId = PLAYER.getFlag('pending_boss');
      PLAYER.setFlag('pending_boss', false);
      transition(STATE.COMBAT, {
        enemies: [{ type: bossId, id: bossId, isBoss: true }],
        bgColor: '#1B2A34'
      });
    }

    if (levelUpTimer > 0) levelUpTimer--;
  }

  function updateCombat() {
    COMBAT.handleInput();

    var cs = COMBAT.getState();
    if (!cs) return;

    // Enemy turns
    if (cs.phase === 'enemy_turn') {
      var current = COMBAT.currentCombatant();
      if (current && !current.isPlayer && current.hp > 0) {
        COMBAT.enemyTurn(current);
      }
    }

    // After end, confirm/cancel to leave combat results screen
    if ((cs.victory || cs.defeat || cs.fleeSuccess) && cs.phase === 'end') {
      if (ENGINE.action('confirm') || ENGINE.action('cancel')) {
        ENGINE.clearKeys();
      }
    }
  }

  function updateGameOver() {
    if (ENGINE.action('confirm') || ENGINE.action('cancel')) {
      transition(STATE.TITLE);
    }
  }

  // ── Render ─────────────────────────────────────────────────
  function render(ctx) {
    ENGINE.clear();

    switch (currentState) {
      case STATE.TITLE:
        UI.renderTitleScreen(ctx, W, H, frame, titleSel);
        break;

      case STATE.HOW_TO:
        UI.renderHowToPlay(ctx, W, H);
        break;

      case STATE.CHARGEN:
        CHARGEN.render(ctx, W, H);
        break;

      case STATE.PROLOGUE:
        var po = PLAYER.get();
        UI.renderPrologue(ctx, W, H, po ? po.origin : 'commoner', frame, prologueText, null);
        break;

      case STATE.SCREENPLAY:
        SCREENPLAY.render(ctx, W, H, frame);
        break;

      case STATE.WORLD:
      case STATE.MENU:
      case STATE.SHOP:
      case STATE.POL_EVENT:
        renderWorldState(ctx);
        break;

      case STATE.DIALOG:
        // Render world behind dialog
        renderWorldState(ctx);
        DIALOG.render(ctx, W, H);
        break;

      case STATE.COMBAT:
        COMBAT.render(ctx, W, H);
        break;

      case STATE.GAME_OVER:
        renderGameOver(ctx);
        break;
    }

    // Overlays
    ENGINE.updateParticles();
    ENGINE.updateFlash();
    UI.renderNotification(ctx, W);
    if (levelUpTimer > 0) UI.renderLevelUp(ctx, W, PLAYER.get() ? PLAYER.get().level : 1);
  }

  function renderWorldState(ctx) {
    var zone = WORLD.getCurrentZone();
    var p    = PLAYER.get();

    // World map area (below HUD)
    var WORLD_OFFSET_Y = 36;
    WORLD.render(ctx, 0, WORLD_OFFSET_Y);

    // HUD
    UI.renderHUD(ctx, W, H, zone ? zone.name : 'Aethoria');

    // Minimap
    if (zone && p) UI.renderMinimap(ctx, zone, p.x, p.y, W);

    ENGINE.drawScanlines(0.05);

    // Overlay panels
    if (UI.isMenuOpen())          UI.renderMenu(ctx, W, H);
    if (UI.isShopOpen())          UI.renderShop(ctx, W, H);
    if (UI.isPoliticalEventOpen())UI.renderPoliticalEvent(ctx, W, H);
  }

  function renderGameOver(ctx) {
    ENGINE.clear('#0A0A14');
    ENGINE.drawStudPattern(0, 0, W, H, '#0A0A14', 32);
    ENGINE.drawText('GAME OVER', W/2, H/2-30, {size:24, color:'#C91A09', bold:true, align:'center'});
    var p = PLAYER.get();
    if (p) ENGINE.drawText(p.name + ' fell in battle.', W/2, H/2+10, {size:10, color:'#9BA19D', align:'center'});
    ENGINE.drawText('Press ENTER to return to title', W/2, H/2+40, {size:9, color:'#6C6E68', align:'center'});
    ENGINE.drawScanlines(0.1);
  }

  // ── Callbacks ──────────────────────────────────────────────
  function onCombatTrigger(enemies, isBoss) {
    var zone = WORLD.getCurrentZone();
    var bgColor = zone ? (zone.bgColor || '#1B2A34') : '#1B2A34';
    transition(STATE.COMBAT, { enemies: enemies, bgColor: bgColor, isBoss: isBoss });
  }

  function onDialogTrigger(dialogId, npc) {
    transition(STATE.DIALOG, { dialogId: dialogId, npc: npc });
  }

  function onZoneChange(newZoneId, tx, ty) {
    var p = PLAYER.get();
    if (p) {
      if (newZoneId === 'world') { p.worldX = tx; p.worldY = ty; }
      p.zone = newZoneId;
      p.x = tx; p.y = ty;
    }
    WORLD.loadZone(newZoneId, tx, ty);
    transition(STATE.WORLD);
    UI.showNotification('Entering: ' + (DATA.ZONES[newZoneId] ? DATA.ZONES[newZoneId].name : newZoneId), '#F2CD37');
  }

  function onCombatEnd(result) {
    PLAYER.syncFromCombatant(COMBAT.getState().player);
    var p = PLAYER.get();

    if (result === 'win') {
      // Check quest objectives
      var cs = COMBAT.getState();
      cs.enemies.forEach(function(e) {
        if (e.isBoss && e.id === 'iron_warlord') {
          PLAYER.completeObjective('main_quest_1', 'defeat_warlord');
        }
      });
      // Level up display
      if (cs.leveled) { levelUpTimer = 120; }
      if (p && p.hp > 0) {
        transition(STATE.WORLD);
      } else {
        transition(STATE.GAME_OVER);
      }
    } else if (result === 'lose') {
      // Restore some HP, return to world (no perma-death by default)
      if (p) {
        p.hp = Math.floor(p.maxHp * 0.3);
        p.mp = Math.floor(p.maxMp * 0.3);
      }
      transition(STATE.GAME_OVER);
    } else if (result === 'flee') {
      transition(STATE.WORLD);
    }
  }

  function onDialogEnd(flags, actions, data) {
    // Process any triggered actions
    if (actions && actions.length) {
      SYSTEMS.processActions(actions);
    }

    // Check if shop should open
    if (actions && actions.some(function(a){ return a.type === 'open_shop'; })) {
      UI.openShop(data.npc ? data.npc.name : 'Merchant', null);
      transition(STATE.SHOP);
      return;
    }

    // Check if boss battle starts from dialog
    if (PLAYER.getFlag('pending_boss')) {
      var bossId = PLAYER.getFlag('pending_boss');
      PLAYER.setFlag('pending_boss', false);
      transition(STATE.COMBAT, {
        enemies: [{ type: bossId, id: bossId, isBoss: true }],
        bgColor: '#0A0A14'
      });
      return;
    }

    transition(STATE.WORLD);
  }

  return { boot };
})();

// ── Boot on DOMContentLoaded ───────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  GAME.boot();
});
