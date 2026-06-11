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

    // Keyboard for chargen name entry
    document.addEventListener('keydown', function(e) {
      if (currentState === STATE.CHARGEN) {
        if (e.key.length === 1) CHARGEN.charInput(e.key);
      }
      // Save shortcut
      if (e.code === 'KeyP' && currentState === STATE.WORLD) {
        if (PLAYER.save()) UI.showNotification('Game saved!', '#77C537');
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
          // Show prologue
          buildPrologue(origin);
          transition(STATE.PROLOGUE);
        });
        break;

      case STATE.PROLOGUE:
        prologueDone = false;
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

    requestAnimationFrame(mainLoop);
  }

  // ── Update ─────────────────────────────────────────────────
  function update(dt) {
    switch (currentState) {
      case STATE.TITLE:      updateTitle();    break;
      case STATE.HOW_TO:     updateHowTo();    break;
      case STATE.CHARGEN:    CHARGEN.handleInput(); break;
      case STATE.PROLOGUE:   updatePrologue(); break;
      case STATE.WORLD:      updateWorld(dt);  break;
      case STATE.COMBAT:     updateCombat();   break;
      case STATE.DIALOG:     DIALOG.update(dt); DIALOG.handleInput(); break;
      case STATE.MENU:       UI.handleMenuInput(); break;
      case STATE.SHOP:       UI.handleShopInput(); break;
      case STATE.POL_EVENT:  UI.handleEventInput(); break;
      case STATE.GAME_OVER:  updateGameOver(); break;
    }
  }

  function updateTitle() {
    var cW = W, cH = H;
    // New game
    if (ENGINE.isKeyJust('KeyN') || ENGINE.isButtonClicked(cW/2-110, 386, 220, 32)) {
      transition(STATE.CHARGEN);
      return;
    }
    // Continue
    if ((ENGINE.isKeyJust('KeyC') || ENGINE.isButtonClicked(cW/2-110, 424, 220, 32)) && PLAYER.hasSave()) {
      if (PLAYER.load()) {
        var p = PLAYER.get();
        WORLD.loadZone(p.zone || 'world', p.x, p.y);
        transition(STATE.WORLD);
      }
      return;
    }
    // How to play
    if (ENGINE.isButtonClicked(cW/2-110, 462, 220, 24)) {
      transition(STATE.HOW_TO);
      return;
    }
    // Keyboard shortcuts
    if (ENGINE.isKeyJust('Enter') || ENGINE.isKeyJust('Space')) {
      transition(STATE.CHARGEN);
    }
  }

  function updateHowTo() {
    if (ENGINE.isKeyJust('Escape') || ENGINE.isKeyJust('Space') || ENGINE.isKeyJust('Enter') ||
        ENGINE.isButtonClicked(W/2-80, H-90, 160, 28)) {
      transition(STATE.TITLE);
    }
  }

  function updatePrologue() {
    if (ENGINE.isKeyJust('Space') || ENGINE.isKeyJust('Enter') || ENGINE.wasClicked()) {
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
    // Menu
    if (ENGINE.isKeyJust('KeyM') || ENGINE.isKeyJust('Escape')) {
      if (UI.isMenuOpen()) UI.closeMenu();
      else { UI.openMenu(); }
      return;
    }

    // Menu / shop / event intercept
    if (UI.isMenuOpen())          { UI.handleMenuInput(); return; }
    if (UI.isShopOpen())          { UI.handleShopInput(); return; }
    if (UI.isPoliticalEventOpen()){ UI.handleEventInput(); return; }

    // Interact
    if (ENGINE.isKeyJust('Enter') || ENGINE.isKeyJust('KeyE') || ENGINE.isKeyJust('Space')) {
      WORLD.interactFacing();
    }

    // Movement
    var moved = false;
    if (ENGINE.isKeyDown('ArrowLeft')  || ENGINE.isKeyDown('KeyA')) { WORLD.movePlayer(-1, 0); moved=true; }
    if (ENGINE.isKeyDown('ArrowRight') || ENGINE.isKeyDown('KeyD')) { WORLD.movePlayer( 1, 0); moved=true; }
    if (ENGINE.isKeyDown('ArrowUp')    || ENGINE.isKeyDown('KeyW')) { WORLD.movePlayer( 0,-1); moved=true; }
    if (ENGINE.isKeyDown('ArrowDown')  || ENGINE.isKeyDown('KeyS')) { WORLD.movePlayer( 0, 1); moved=true; }

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

    // After end, any key to leave
    if ((cs.victory || cs.defeat || cs.fleeSuccess) && cs.phase === 'end') {
      if (ENGINE.isKeyJust('Space') || ENGINE.isKeyJust('Enter') || ENGINE.isKeyJust('Escape')) {
        ENGINE.clearKeys();
      }
    }
  }

  function updateGameOver() {
    if (ENGINE.isKeyJust('Enter') || ENGINE.isKeyJust('Space') || ENGINE.isKeyJust('Escape')) {
      transition(STATE.TITLE);
    }
  }

  // ── Render ─────────────────────────────────────────────────
  function render(ctx) {
    ENGINE.clear();

    switch (currentState) {
      case STATE.TITLE:
        UI.renderTitleScreen(ctx, W, H, frame);
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
