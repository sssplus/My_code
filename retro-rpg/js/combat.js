// ============================================================
//  CHRONICLES OF THE SHATTERED REALM — Combat Engine
//  Turn-based battle with class mechanics, boss phases, AI
// ============================================================

var COMBAT = (function() {

  var state = null;
  var onEnd  = null;  // callback(result) — result: 'win'|'lose'|'flee'

  // ── Init ───────────────────────────────────────────────────
  function start(playerCombatant, enemies, callback, options) {
    onEnd = callback;
    options = options || {};

    // Build enemy combatants
    var enemyCombatants = enemies.map(function(e) {
      var def = DATA.ENEMIES[e.type || e.id] || DATA.ENEMIES['bandit'];
      return {
        id:        e.id || e.type,
        name:      def.name,
        hp:        def.hp, maxHp: def.hp,
        mp:        20,     maxMp: 20,
        sp:        50,     maxSp: 50,
        atk:       def.atk, def: def.def, mag: def.mag||0, agi: def.agi,
        torsoColor:def.torsoColor, legColor:def.legColor, headColor:def.headColor||'#E4CD9E',
        isAnimal:  def.isAnimal||false,
        xp:        def.xp,  gold: def.gold,
        drops:     def.drops || [],
        aiType:    def.aiType,
        moves:     def.moves || ['attack'],
        phases:    def.phases || null,
        phaseIdx:  0,
        isBoss:    e.isBoss || false,
        statuses:  [],
        moveIdx:   0,
        isEnemy:   true
      };
    });

    // Turn order by AGI
    var all = [playerCombatant].concat(enemyCombatants);
    all.sort(function(a,b) { return b.agi - a.agi; });

    state = {
      player:    playerCombatant,
      enemies:   enemyCombatants,
      turnOrder: all,
      turnIdx:   0,
      phase:     'player_menu',   // player_menu | enemy_turn | anim | end
      selectedAction: null,       // 'attack'|'skills'|'magic'|'item'|'defend'|'flee'
      selectedSkill:  null,
      selectedItem:   null,
      selectedTarget: 0,
      menuFocus:      0,          // which top-level menu item
      skillPage:      0,
      itemPage:       0,
      log:            [],
      turn:           1,
      animTimer:      0,
      flashEnemy:     -1,
      flashPlayer:    false,
      victory:        false,
      defeat:         false,
      fleeSuccess:    false,
      showingSkills:  false,
      showingItems:   false,
      isBoss:         enemies.some(function(e){ return e.isBoss; }),
      firstEncounter: options.firstEncounter || false,
      bgColor:        options.bgColor || '#1B2A34'
    };

    addLog('Battle begins!');
    if (state.isBoss) addLog('⚠ A powerful enemy appears!');

    return state;
  }

  function getState() { return state; }

  // ── Logging ────────────────────────────────────────────────
  function addLog(msg) {
    state.log.unshift(msg);
    if (state.log.length > 8) state.log.pop();
  }

  // ── Turn management ────────────────────────────────────────
  function currentCombatant() {
    if (!state) return null;
    return state.turnOrder[state.turnIdx % state.turnOrder.length];
  }

  function nextTurn() {
    // Process end-of-turn statuses on current combatant
    var current = currentCombatant();
    if (current) processStatuses(current);

    state.turnIdx = (state.turnIdx + 1) % state.turnOrder.length;
    if (state.turnIdx === 0) state.turn++;

    // Skip dead
    var tries = 0;
    while (!isAlive(currentCombatant()) && tries < 10) {
      state.turnIdx = (state.turnIdx + 1) % state.turnOrder.length;
      tries++;
    }

    // Check win/loss
    if (checkBattleEnd()) return;

    var c = currentCombatant();
    if (c.isPlayer) {
      state.phase = 'player_menu';
      state.showingSkills = false;
      state.showingItems  = false;
      // Regen SP on player turn start
      state.player.sp = Math.min(state.player.maxSp, state.player.sp + 5);
    } else {
      state.phase = 'enemy_turn';
    }
  }

  function isAlive(c) { return c && c.hp > 0; }

  function checkBattleEnd() {
    var allEnemiesDead = state.enemies.every(function(e) { return e.hp <= 0; });
    if (allEnemiesDead) {
      state.phase = 'end';
      state.victory = true;
      addLog('Victory!');
      collectRewards();
      if (onEnd) setTimeout(function(){ onEnd('win'); }, 1500);
      return true;
    }
    if (state.player.hp <= 0) {
      state.phase = 'end';
      state.defeat = true;
      addLog('Defeated...');
      if (onEnd) setTimeout(function(){ onEnd('lose'); }, 1500);
      return true;
    }
    return false;
  }

  function collectRewards() {
    var totalXp = 0, totalGold = 0;
    state.enemies.forEach(function(e) {
      totalXp  += e.xp || 0;
      if (e.gold && e.gold.length === 2) {
        totalGold += Math.floor(Math.random() * (e.gold[1] - e.gold[0] + 1)) + e.gold[0];
      }
      // Item drops
      if (e.drops && e.drops.length > 0) {
        e.drops.forEach(function(drop) {
          if (Math.random() < 0.4) PLAYER.addItem(drop, 1);
        });
      }
    });
    var leveled = PLAYER.gainXp(totalXp);
    PLAYER.gainGold(totalGold);
    state.rewardXp   = totalXp;
    state.rewardGold = totalGold;
    state.leveled    = leveled;
    addLog('Gained '+totalXp+' XP and '+totalGold+' gold!');
    if (leveled) addLog('Level Up! Now level ' + PLAYER.get().level + '!');
    // Sync player state
    PLAYER.syncFromCombatant(state.player);
  }

  // ── Player Actions ─────────────────────────────────────────
  function playerAttack() {
    var player = state.player;
    var target = getAliveEnemy(state.selectedTarget);
    if (!target) return;

    var dmg = calcPhysicalDamage(player, target);
    applyDamage(target, dmg);
    addLog(player.name + ' attacks ' + target.name + ' for ' + dmg + ' damage!');
    ENGINE.addFloatText(300 + state.enemies.indexOf(target)*80, 200, '-'+dmg, '#F2CD37');
    ENGINE.screenFlash('#FFF', 4);

    // Class mechanics
    if (player.origin === 'sword_clan') {
      player.momentum = Math.min(100, (player.momentum||0) + 15);
    }
    if (player.origin === 'noble') {
      player.authorityB = Math.min(100, (player.authorityB||0) + 5);
    }

    checkBossPhase(target);
    player.sp = Math.max(0, (player.sp||0) - 2);
    state.flashEnemy = state.enemies.indexOf(target);
    state.animTimer  = 30;
    nextTurn();
  }

  function playerSkill(skillId) {
    var skill  = DATA.SKILLS[skillId];
    var player = state.player;
    if (!skill) return;

    // Cost check
    if (skill.costType === 'sp' && player.sp < skill.cost) { addLog('Not enough SP!'); return; }
    if (skill.costType === 'mp' && player.mp < skill.cost) { addLog('Not enough MP!'); return; }

    if (skill.costType === 'sp') player.sp -= skill.cost;
    if (skill.costType === 'mp') player.mp -= skill.cost;

    var target = getAliveEnemy(state.selectedTarget);

    // Execute skill
    if (skill.type === 'physical') {
      var dmg = calcPhysicalDamage(player, target, skill.power, skill.pierce);
      if (skill.hits) {
        for (var h = 0; h < skill.hits; h++) {
          var hd = Math.floor(calcPhysicalDamage(player, target, skill.power/skill.hits, skill.pierce));
          applyDamage(target, hd);
        }
        dmg = 0; // already applied
      } else {
        applyDamage(target, dmg);
      }
      if (skill.target === 'all_enemies') {
        state.enemies.forEach(function(e) { if (e.hp > 0) applyDamage(e, Math.floor(dmg*0.7)); });
      }
      if (skill.status) applyStatus(target, skill.status);
      addLog(player.name + ' uses ' + skill.name + '!');
      ENGINE.screenFlash('#FFF', 5);

    } else if (skill.type === 'magic') {
      var magDmg = calcMagicDamage(player, target, skill.power);
      // Spell weave double
      if (player.spellWeaved) { magDmg *= 2; player.spellWeaved = false; }
      if (skill.target === 'all_enemies') {
        state.enemies.forEach(function(e) { if (e.hp > 0) applyDamage(e, Math.floor(magDmg*0.8)); });
        addLog(player.name + ' casts ' + skill.name + ' on all enemies!');
      } else {
        applyDamage(target, magDmg);
        addLog(player.name + ' casts ' + skill.name + ' for ' + magDmg + ' damage!');
      }
      if (skill.debuff) removeEnemyBuffs(target);
      ENGINE.screenFlash('#0055BF', 4);

    } else if (skill.type === 'heal') {
      var healAmt = calcHeal(player, skill.power);
      if (skill.target === 'all_allies') {
        heal(player, healAmt);
        addLog(player.name + ' casts ' + skill.name + ', restoring '+healAmt+' HP to all!');
      } else {
        heal(player, healAmt);
        addLog(player.name + ' uses ' + skill.name + ', restoring '+healAmt+' HP!');
      }
      ENGINE.addFloatText(200, 300, '+'+healAmt+' HP', '#77C537');
      // Priest divine meter
      if (player.origin === 'priest') {
        player.divineM = Math.min(100, (player.divineM||0) + 20);
      }

    } else if (skill.type === 'buff') {
      applyStatus(player, 'buffed');
      if (skillId === 'spell_weave')   player.spellWeaved = true;
      if (skillId === 'iron_will')     player.ironWillActive = true;
      if (skillId === 'royal_decree')  addLog('All allies act first this turn!');
      addLog(player.name + ' uses ' + skill.name + '!');

    } else if (skill.type === 'defend') {
      player.defending = true;
      addLog(player.name + ' takes a defensive stance!');
      if (skillId === 'gut_feeling') player.counterNext = true;

    } else if (skill.type === 'random') {
      executeHiddenTalent(player, target);
    }

    // Sword clan momentum
    if (player.origin === 'sword_clan') {
      player.momentum = Math.min(100, (player.momentum||0) + 10);
      if (player.momentum >= 100) {
        player.momentum = 0;
        applyStatus(player, 'clan_frenzy');
        addLog('CLAN FRENZY! +30% ATK!');
      }
    }

    checkBossPhase(target);
    state.flashEnemy = state.enemies.indexOf(target);
    state.animTimer  = 35;
    nextTurn();
  }

  function playerItem(itemId) {
    var success = PLAYER.useItem(itemId);
    if (success) {
      addLog(state.player.name + ' uses ' + DATA.ITEMS[itemId].name + '!');
      // Sync player stats from PLAYER state
      var p = PLAYER.get();
      state.player.hp = p.hp;
      state.player.mp = p.mp;
      state.player.sp = p.sp;
      nextTurn();
    } else {
      addLog('Cannot use that item here.');
    }
  }

  function playerDefend() {
    state.player.defending = true;
    state.player.sp = Math.min(state.player.maxSp, (state.player.sp||0) + 15);
    addLog(state.player.name + ' defends and regains SP!');
    nextTurn();
  }

  function playerFlee() {
    var p = state.player;
    var fleeChance = 0.4 + (p.agi / 100) * 0.4;
    if (Math.random() < fleeChance) {
      state.fleeSuccess = true;
      state.phase = 'end';
      addLog('Escaped!');
      if (onEnd) setTimeout(function(){ onEnd('flee'); }, 800);
    } else {
      addLog('Couldn\'t escape!');
      nextTurn();
    }
  }

  // ── Enemy AI ───────────────────────────────────────────────
  function enemyTurn(enemy) {
    if (enemy.hp <= 0) { nextTurn(); return; }

    // Morale check for weak enemies
    if (enemy.aiType === 'smart' && enemy.hp < enemy.maxHp * 0.15 && Math.random() < 0.3) {
      addLog(enemy.name + ' flees from battle!');
      enemy.hp = 0;
      nextTurn();
      return;
    }

    // Status skip
    if (hasStatus(enemy, 'stun') || hasStatus(enemy, 'freeze')) {
      addLog(enemy.name + ' is immobilized!');
      removeStatus(enemy, 'stun');
      removeStatus(enemy, 'freeze');
      nextTurn();
      return;
    }

    var action = chooseEnemyAction(enemy);
    executeEnemyAction(enemy, action);
    enemy.moveIdx = (enemy.moveIdx + 1) % (enemy.moves||['attack']).length;
  }

  function chooseEnemyAction(enemy) {
    // Boss phase moves
    if (enemy.phases) {
      var phase = getBossPhase(enemy);
      if (phase) {
        var moves = phase.moves;
        return moves[enemy.moveIdx % moves.length];
      }
    }
    // Basic AI
    if (enemy.aiType === 'basic') {
      var moves = enemy.moves || ['attack'];
      return moves[enemy.moveIdx % moves.length];
    }
    if (enemy.aiType === 'smart') {
      if (enemy.hp < enemy.maxHp * 0.4) return 'heal';
      if (Math.random() < 0.7) return 'attack';
      return 'special';
    }
    if (enemy.aiType === 'elite') {
      if (Math.random() < 0.5) return enemy.signature || 'attack';
      return 'attack';
    }
    return 'attack';
  }

  function executeEnemyAction(enemy, action) {
    var p = state.player;
    switch(action) {
      case 'attack': {
        var dmg = calcPhysicalDamage(enemy, p);
        if (p.defending) dmg = Math.ceil(dmg * 0.5);
        if (p.counterNext) { dmg = 0; addLog(p.name + ' perfectly counters!'); playerCounterAttack(enemy); p.counterNext = false; break; }
        applyDamage(p, dmg);
        addLog(enemy.name + ' attacks ' + p.name + ' for ' + dmg + '!');
        ENGINE.screenFlash('#C91A09', 3);
        ENGINE.addFloatText(200, 350, '-'+dmg, '#C91A09');
        state.flashPlayer = true;
        break;
      }
      case 'defend':
        addLog(enemy.name + ' braces for impact.');
        enemy.defending = true;
        break;
      case 'heal': {
        var hAmt = Math.floor(enemy.maxHp * 0.15);
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + hAmt);
        addLog(enemy.name + ' regenerates ' + hAmt + ' HP!');
        break;
      }
      case 'special':
      case 'void_strike': {
        var sdmg = Math.floor(calcPhysicalDamage(enemy, p) * 1.5);
        if (p.defending) sdmg = Math.ceil(sdmg * 0.5);
        applyDamage(p, sdmg);
        addLog(enemy.name + ' unleashes a devastating strike for ' + sdmg + '!');
        ENGINE.screenFlash('#81007B', 5);
        break;
      }
      case 'shield_bash': {
        var sbDmg = Math.floor(calcPhysicalDamage(enemy, p) * 0.8);
        applyDamage(p, sbDmg);
        applyStatus(p, 'stun');
        addLog(enemy.name + ' bashes with shield! ' + p.name + ' stunned!');
        break;
      }
      case 'dual_strike': {
        var d1 = calcPhysicalDamage(enemy, p);
        var d2 = calcPhysicalDamage(enemy, p);
        if (p.defending) { d1=Math.ceil(d1*0.5); d2=Math.ceil(d2*0.5); }
        applyDamage(p, d1 + d2);
        addLog(enemy.name + ' strikes twice for ' + d1 + ' + ' + d2 + '!');
        ENGINE.screenFlash('#C91A09', 6);
        break;
      }
      case 'iron_cyclone': {
        var icDmg = Math.floor(calcPhysicalDamage(enemy, p) * 1.2);
        applyDamage(p, icDmg);
        addLog('IRON CYCLONE! ' + icDmg + ' unavoidable damage!');
        ENGINE.screenFlash('#DBA000', 8);
        break;
      }
      case 'berserk_charge': {
        var bcDmg = Math.floor(calcPhysicalDamage(enemy, p) * 2.0);
        if (p.defending) bcDmg = Math.ceil(bcDmg * 0.6);
        applyDamage(p, bcDmg);
        addLog(enemy.name + ' charges in a BERSERK rage for ' + bcDmg + '!');
        ENGINE.screenFlash('#C91A09', 10);
        break;
      }
      case 'last_stand':
        enemy.invincible = true;
        enemy.invincibleTimer = 1;
        addLog(enemy.name + ' enters LAST STAND — immune to damage for 1 turn!');
        break;
      case 'regen':
        var rAmt = Math.floor(enemy.maxHp * 0.02);
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + rAmt);
        addLog(enemy.name + ' regenerates ' + rAmt + ' HP!');
        break;
      case 'taunt':
        addLog(enemy.name + ': "You dare challenge the Iron Keep? You are nothing!"');
        break;
      case 'void_bolt': {
        var vbDmg = Math.floor(enemy.mag * 2.5);
        applyDamage(p, vbDmg);
        applyStatus(p, 'corruption');
        addLog('VOID BOLT! ' + vbDmg + ' dark damage! ' + p.name + ' is corrupted!');
        ENGINE.screenFlash('#1B2A34', 8);
        break;
      }
      case 'ancient_curse':
        applyStatus(p, 'curse');
        addLog(enemy.name + ' places an ancient curse! Stats halved for 3 turns!');
        break;
      case 'summon_void':
        addLog(enemy.name + ' tears a void rift — darkness fills the battlefield!');
        ENGINE.screenFlash('#0A0A14', 12);
        break;
      case 'heartstone_blast': {
        var hbDmg = Math.floor(enemy.mag * 3.5);
        applyDamage(p, hbDmg);
        addLog('HEARTSTONE BLAST! ' + hbDmg + ' unstoppable damage!');
        ENGINE.screenFlash('#F2CD37', 10);
        break;
      }
      case 'void_rend': {
        var vrDmg = Math.floor(p.maxHp * 0.25);
        applyDamage(p, vrDmg);
        addLog('VOID REND! Deals 25% of max HP (' + vrDmg + ')!');
        break;
      }
      case 'mass_fear':
        applyStatus(p, 'fear');
        addLog(enemy.name + ' spreads primal FEAR!');
        break;
      case 'world_reshape':
        addLog('"I am what happens when good men are broken by systems that reward cruelty."');
        ENGINE.screenFlash('#81007B', 15);
        break;
      case 'void_annihilation': {
        var vaDmg = Math.floor(calcPhysicalDamage(enemy, p) * 3.0 + enemy.mag * 2);
        applyDamage(p, Math.max(1, vaDmg));
        addLog('VOID ANNIHILATION! ' + vaDmg + ' total damage!');
        ENGINE.screenFlash('#81007B', 15);
        break;
      }
      case 'despair':
        p.sp = Math.max(0, p.sp - 30);
        p.mp = Math.max(0, p.mp - 30);
        addLog(enemy.name + ' drains your will. -30 SP and MP!');
        break;
      default:
        var defDmg = calcPhysicalDamage(enemy, p);
        applyDamage(p, defDmg);
        addLog(enemy.name + ' attacks for ' + defDmg + '!');
    }
    p.defending = false;
  }

  function playerCounterAttack(enemy) {
    var dmg = calcPhysicalDamage(state.player, enemy, 2.0);
    applyDamage(enemy, dmg);
    addLog('Counter Attack for ' + dmg + ' damage!');
    ENGINE.screenFlash('#F2CD37', 5);
  }

  // ── Damage calculation ─────────────────────────────────────
  function calcPhysicalDamage(attacker, defender, multiplier, ignoreDefense) {
    multiplier = multiplier || 1.0;
    var base = attacker.atk * multiplier;
    var def  = ignoreDefense ? 0 : (defender.def * 0.5);
    // Variance ±15%
    var variance = 0.85 + Math.random() * 0.3;
    var dmg = Math.max(1, Math.floor((base - def) * variance));

    // Status modifiers on attacker
    if (hasStatus(attacker, 'clan_frenzy')) dmg = Math.floor(dmg * 1.3);
    if (hasStatus(defender, 'exposed'))     dmg = Math.floor(dmg * 1.3);
    if (hasStatus(attacker, 'curse'))       dmg = Math.floor(dmg * 0.5);

    return dmg;
  }

  function calcMagicDamage(attacker, defender, multiplier) {
    multiplier = multiplier || 1.0;
    var base    = attacker.mag * multiplier * 1.5;
    var variance= 0.85 + Math.random() * 0.3;
    var dmg     = Math.max(1, Math.floor(base * variance));
    if (hasStatus(attacker, 'curse')) dmg = Math.floor(dmg * 0.5);
    return dmg;
  }

  function calcHeal(healer, multiplier) {
    multiplier = multiplier || 1.0;
    var base = (healer.mag + healer.maxMp * 0.15) * multiplier;
    if (healer.origin === 'priest' && healer.divineM >= 100) base *= 2;
    return Math.max(5, Math.floor(base));
  }

  function applyDamage(target, amount) {
    if (target.invincible) { addLog('No effect — invincible!'); return; }
    // Vow of the Realm: can't die in one hit
    if (target.isPlayer && target.vowActive && target.hp - amount <= 0) {
      target.hp = 1;
      target.vowActive = false;
      addLog('Vow of the Realm activates! Survives at 1 HP!');
      return;
    }
    target.hp = Math.max(0, target.hp - amount);
    // Commoner Survivor's Grit
    if (target.isPlayer && target.origin === 'commoner' && target.hp < target.maxHp * 0.2) {
      if (!target.gritActive) {
        target.gritActive = true;
        addLog("Survivor's Grit activates! ATK +40%!");
      }
    }
  }

  function heal(target, amount) {
    target.hp = Math.min(target.maxHp, target.hp + amount);
  }

  // ── Status effects ─────────────────────────────────────────
  function applyStatus(target, status, turns) {
    turns = turns || 3;
    // Don't stack same status
    if (hasStatus(target, status)) return;
    target.statuses = target.statuses || [];
    target.statuses.push({ id:status, turns:turns });
  }

  function hasStatus(target, status) {
    if (!target || !target.statuses) return false;
    return target.statuses.some(function(s){ return s.id === status; });
  }

  function removeStatus(target, status) {
    if (!target || !target.statuses) return;
    target.statuses = target.statuses.filter(function(s){ return s.id !== status; });
  }

  function processStatuses(target) {
    if (!target || !target.statuses) return;
    for (var i = target.statuses.length-1; i >= 0; i--) {
      var s = target.statuses[i];
      switch(s.id) {
        case 'burn':
          var burnDmg = Math.floor(target.maxHp * 0.05);
          target.hp = Math.max(0, target.hp - burnDmg);
          addLog(target.name + ' burns for ' + burnDmg + '!');
          break;
        case 'bleed':
          var bleedDmg = 4 * Math.min(3, (target.statuses.filter(function(x){ return x.id==='bleed'; }).length));
          target.hp = Math.max(0, target.hp - bleedDmg);
          addLog(target.name + ' bleeds for ' + bleedDmg + '!');
          break;
        case 'corruption':
          var corrDmg = Math.floor(target.maxHp * 0.03);
          target.hp = Math.max(0, target.hp - corrDmg);
          if (target.atk) target.atk = Math.max(1, target.atk - 1);
          addLog(target.name + ' is being corrupted! (-' + corrDmg + ' HP)');
          break;
        case 'ley_line':
          var llDmg = Math.floor(target.maxHp * 0.05);
          target.hp = Math.max(0, target.hp - llDmg);
          addLog('Ley Line damages ' + target.name + ' for ' + llDmg + '!');
          break;
      }
      s.turns--;
      if (s.turns <= 0) {
        if (s.id === 'invincible') target.invincible = false;
        target.statuses.splice(i, 1);
      }
    }
  }

  function removeEnemyBuffs(target) {
    target.statuses = (target.statuses||[]).filter(function(s){
      return !['blessed','buffed','haste'].includes(s.id);
    });
  }

  // ── Boss phase management ──────────────────────────────────
  function getBossPhase(enemy) {
    if (!enemy.phases) return null;
    var hpPct = enemy.hp / enemy.maxHp;
    for (var i = enemy.phases.length - 1; i >= 0; i--) {
      if (hpPct <= enemy.phases[i].threshold) {
        return enemy.phases[i];
      }
    }
    return enemy.phases[0];
  }

  function checkBossPhase(enemy) {
    if (!enemy || !enemy.phases) return;
    var newPhase = getBossPhase(enemy);
    if (!newPhase) return;
    var newIdx = enemy.phases.indexOf(newPhase);
    if (newIdx > (enemy.phaseIdx||0)) {
      enemy.phaseIdx = newIdx;
      addLog('⚠ ' + enemy.name + ': "' + newPhase.name + '"!');
      ENGINE.screenFlash('#81007B', 12);
      enemy.invincible = false;
    }
  }

  // ── Hidden Talent (Commoner) ───────────────────────────────
  function executeHiddenTalent(player, target) {
    var roll = Math.random();
    var effects = [
      function() { // Fire surge
        var dmg = calcMagicDamage(player, target, 2.0);
        applyDamage(target, dmg);
        addLog('Hidden Talent: FIRE SURGE! ' + dmg + ' fire damage!');
        ENGINE.screenFlash('#FE8A18', 8);
      },
      function() { // Full heal
        var amt = Math.floor(player.maxHp * 0.4);
        heal(player, amt);
        addLog('Hidden Talent: SECOND WIND! Restored ' + amt + ' HP!');
        ENGINE.addFloatText(200, 300, '+'+amt+' HP!', '#77C537');
      },
      function() { // Stun all
        state.enemies.forEach(function(e) { if (e.hp > 0) applyStatus(e, 'stun'); });
        addLog('Hidden Talent: THUNDER CLAP! All enemies stunned!');
        ENGINE.screenFlash('#F2CD37', 10);
      },
      function() { // Backfire
        var bfDmg = Math.floor(player.maxHp * 0.1);
        applyDamage(player, bfDmg);
        addLog('Hidden Talent BACKFIRES! You take ' + bfDmg + ' damage...');
      }
    ];
    var chosen = effects[Math.floor(roll * effects.length)];
    chosen();
  }

  // ── Helpers ────────────────────────────────────────────────
  function getAliveEnemy(idx) {
    var alive = state.enemies.filter(function(e){ return e.hp > 0; });
    return alive[idx % alive.length] || alive[0];
  }

  function getAliveEnemies() {
    return state.enemies.filter(function(e){ return e.hp > 0; });
  }

  function getStatusIcon(status) {
    var icons = {
      burn:'🔥', freeze:'❄', bleed:'💉', stun:'⚡', curse:'💀',
      fear:'😱', exposed:'👁', blessed:'✨', corruption:'🌑',
      haste:'⚡', clan_frenzy:'⚔', buffed:'↑', defending:'🛡',
      ley_line:'🔮'
    };
    return icons[status] || '?';
  }

  // ── Rendering ──────────────────────────────────────────────
  function render(ctx, canvasW, canvasH) {
    if (!state) return;

    var bgColor = state.bgColor || '#1B2A34';

    // Battle background - Lego stud pattern
    ENGINE.drawStudPattern(0, 0, canvasW, canvasH, bgColor, 24);

    // Battle arena floor
    ENGINE.drawLegoBrick(20, canvasH-100, canvasW-40, 30, '#237841', '#1A5E30', {plate:true});

    // ── Enemy side (top half) ─────────────────────────────────
    var enemies = state.enemies;
    var aliveEnemies = enemies.filter(function(e){ return e.hp > 0; });
    aliveEnemies.forEach(function(enemy, i) {
      var ex = canvasW/2 - (aliveEnemies.length-1)*70 + i*140;
      var ey = 170;

      // Enemy flash
      if (state.flashEnemy === enemies.indexOf(enemy) && state.animTimer > 0) {
        ctx.globalAlpha = 0.5 + Math.sin(state.animTimer)*0.5;
      }

      // Draw enemy minifigure (larger scale for bosses)
      var sc = enemy.isBoss ? 2.0 : 1.5;
      ENGINE.drawMinifigure(ex, ey, {
        torsoColor: enemy.torsoColor,
        legColor:   enemy.legColor,
        headColor:  enemy.headColor || '#E4CD9E',
        scale:      sc,
        facingLeft: true,
        emotion:    enemy.hp < enemy.maxHp * 0.3 ? 'angry' : 'stern'
      });
      ctx.globalAlpha = 1;

      // Enemy HP bar
      var barW = enemy.isBoss ? 200 : 100;
      var bx = ex - barW/2;
      ENGINE.drawBar(bx, ey - (sc*35) - 24, barW, 10,
        enemy.hp, enemy.maxHp,
        enemy.hp < enemy.maxHp*0.3 ? '#C91A09' : '#F2CD37',
        null
      );
      // HP text
      ENGINE.drawText(enemy.name, bx, ey - (sc*35) - 28, {size:8, color:'#FFF', bold:true});
      ENGINE.drawText(enemy.hp+'/'+enemy.maxHp, bx+barW-40, ey-(sc*35)-28, {size:7, color:'#9BA19D'});

      // Status icons
      if (enemy.statuses && enemy.statuses.length > 0) {
        enemy.statuses.forEach(function(s, si) {
          ENGINE.drawText(getStatusIcon(s.id), bx + si*12, ey-(sc*35)-14, {size:9});
        });
      }

      // Boss phase indicator
      if (enemy.phases && enemy.phaseIdx !== undefined) {
        var phase = getBossPhase(enemy);
        if (phase) {
          ENGINE.drawText('Phase: ' + phase.name, bx, ey-(sc*35)-42, {size:7, color:'#FE8A18', bold:true});
        }
      }
    });

    // ── Player side (lower) ───────────────────────────────────
    var p = state.player;
    var px = 180, py = canvasH - 100;
    ENGINE.drawMinifigure(px, py, {
      torsoColor: p.torsoColor,
      legColor:   p.legColor,
      headColor:  p.headColor,
      scale:      1.8,
      weapon:     p.weapon,
      hat:        p.hat,
      emotion:    p.hp < p.maxHp*0.2 ? 'angry' : 'neutral'
    });

    // Player stat bars
    var sbx = 20, sby = canvasH - 68, sbW = 140;
    ENGINE.drawText(p.name + '  Lv.' + PLAYER.get().level, sbx, sby-4, {size:8, color:'#F2CD37', bold:true});
    ENGINE.drawBar(sbx, sby,    sbW, 10, p.hp, p.maxHp, '#C91A09', 'HP');
    ENGINE.drawBar(sbx, sby+12, sbW, 10, p.mp, p.maxMp, '#0055BF', 'MP');
    ENGINE.drawBar(sbx, sby+24, sbW, 10, p.sp, p.maxSp, '#F2CD37', 'SP');

    // Class mechanic bar
    if (p.origin === 'sword_clan') {
      ENGINE.drawBar(sbx, sby+36, sbW, 8, p.momentum||0, 100, '#FE8A18', 'MOM');
    } else if (p.origin === 'priest') {
      ENGINE.drawBar(sbx, sby+36, sbW, 8, p.divineM||0, 100, '#F2CD37', 'DIV');
    } else if (p.origin === 'noble' || p.origin === 'prince') {
      ENGINE.drawBar(sbx, sby+36, sbW, 8, p.authorityB||0, 100, '#81007B', 'AUT');
    }

    // Player statuses
    if (p.statuses && p.statuses.length > 0) {
      p.statuses.forEach(function(s, i) {
        ENGINE.drawText(getStatusIcon(s.id), sbx + i*14, sby+50, {size:10});
      });
    }

    // ── Action Menu (right side) ──────────────────────────────
    if (state.phase === 'player_menu') {
      renderActionMenu(ctx, canvasW, canvasH);
    }

    // ── Skill sub-menu ────────────────────────────────────────
    if (state.showingSkills) {
      renderSkillMenu(ctx, canvasW, canvasH);
    }

    // ── Item sub-menu ─────────────────────────────────────────
    if (state.showingItems) {
      renderItemMenu(ctx, canvasW, canvasH);
    }

    // ── Battle log ────────────────────────────────────────────
    renderBattleLog(ctx, canvasW, canvasH);

    // ── Turn order indicator ──────────────────────────────────
    renderTurnOrder(ctx, canvasW, canvasH);

    // ── Victory / Defeat overlay ──────────────────────────────
    if (state.phase === 'end') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, canvasW, canvasH);
      if (state.victory) {
        ENGINE.drawPanel(canvasW/2-150, canvasH/2-80, 300, 160, {title:'VICTORY!'});
        ENGINE.drawText('VICTORY!', canvasW/2, canvasH/2-40, {size:20, color:'#F2CD37', bold:true, align:'center'});
        ENGINE.drawText('XP: +' + (state.rewardXp||0), canvasW/2, canvasH/2-10, {size:10, color:'#77C537', align:'center'});
        ENGINE.drawText('Gold: +' + (state.rewardGold||0), canvasW/2, canvasH/2+8, {size:10, color:'#DBA000', align:'center'});
        if (state.leveled) ENGINE.drawText('LEVEL UP! → Level ' + PLAYER.get().level, canvasW/2, canvasH/2+26, {size:9, color:'#F2CD37', bold:true, align:'center'});
        ENGINE.drawText('Press any key to continue', canvasW/2, canvasH/2+55, {size:8, color:'#9BA19D', align:'center'});
      } else if (state.defeat) {
        ENGINE.drawPanel(canvasW/2-150, canvasH/2-80, 300, 120, {border:'#C91A09'});
        ENGINE.drawText('DEFEATED', canvasW/2, canvasH/2-20, {size:18, color:'#C91A09', bold:true, align:'center'});
        ENGINE.drawText('Press any key to continue', canvasW/2, canvasH/2+20, {size:8, color:'#9BA19D', align:'center'});
      } else if (state.fleeSuccess) {
        ENGINE.drawText('Escaped!', canvasW/2, canvasH/2, {size:16, color:'#9BA19D', bold:true, align:'center'});
      }
    }

    if (state.animTimer > 0) state.animTimer--;
  }

  // action IDs must match the binding map in engine.js
  var ACTIONS = [
    { id:'attack',  label:'ATTACK',  bindId:'attack',  color:'#C91A09' },
    { id:'skills',  label:'SKILLS',  bindId:'skills',  color:'#0055BF' },
    { id:'magic',   label:'MAGIC',   bindId:'skills',  color:'#81007B' },
    { id:'item',    label:'ITEM',    bindId:'item',    color:'#237841' },
    { id:'defend',  label:'DEFEND',  bindId:'defend',  color:'#9BA19D' },
    { id:'flee',    label:'FLEE',    bindId:'flee',    color:'#6C6E68' }
  ];

  function renderActionMenu(ctx, canvasW, canvasH) {
    var mx = canvasW - 220, my = canvasH - 130, mw = 200, mh = 120;
    ENGINE.drawPanel(mx-4, my-8, mw+8, mh+16, { title:'ACTION' });

    ACTIONS.forEach(function(a, i) {
      var col = Math.floor(i/3), row = i%3;
      var bx = mx + col*104, by = my + row*34;
      var hovered = ENGINE.isButtonHovered(bx, by, 100, 28);
      // Show the actual bound key from the binding map
      var binds = ENGINE.getBindings();
      var keyCode = (binds[a.bindId] || [])[0] || null;
      var keyLabel = keyCode ? ENGINE.keyLabel(keyCode) : '?';
      ENGINE.drawButton(bx, by, 100, 28, '['+keyLabel+'] '+a.label, hovered, { color:a.color, fontSize:8 });
    });
  }

  function renderSkillMenu(ctx, canvasW, canvasH) {
    var skills = state.player.skills || [];
    var mx = canvasW - 320, my = canvasH - 240, mw = 300, mh = 220;
    ENGINE.drawPanel(mx-4, my-8, mw+8, mh+16, { title:'SKILLS  [↑↓] nav  [CONFIRM] use' });

    skills.forEach(function(skillId, i) {
      var sk = DATA.SKILLS[skillId];
      if (!sk) return;
      var by = my + i * 28;
      if (by > my + mh - 30) return;
      var kbSel   = (i === (state.skillSel||0));
      var hovered = kbSel || ENGINE.isButtonHovered(mx, by, mw, 24);
      var affordable = (sk.costType==='sp' && state.player.sp>=sk.cost) ||
                       (sk.costType==='mp' && state.player.mp>=sk.cost) ||
                       !sk.costType;
      ENGINE.drawButton(mx, by, mw, 24,
        sk.name + ' [' + (sk.cost||0) + ' ' + (sk.costType||'-').toUpperCase() + ']',
        hovered, { color: affordable ? '#0055BF' : '#3D3D3D', fontSize:8 }
      );
    });

    ENGINE.drawButton(mx, my + mh - 24, 80, 20, '[ESC] Back', false, {color:'#6C6E68', fontSize:7});
  }

  function renderItemMenu(ctx, canvasW, canvasH) {
    var inventory = PLAYER.get().inventory.filter(function(i){ return i.qty > 0 && DATA.ITEMS[i.id] && DATA.ITEMS[i.id].type==='consumable'; });
    var mx = canvasW - 280, my = canvasH - 200, mw = 260, mh = 180;
    ENGINE.drawPanel(mx-4, my-8, mw+8, mh+16, { title:'ITEMS' });

    if (inventory.length === 0) {
      ENGINE.drawText('No items!', mx+10, my+20, {size:9, color:'#9BA19D'});
    }
    inventory.forEach(function(slot, i) {
      var item = DATA.ITEMS[slot.id];
      if (!item) return;
      var by = my + i * 28;
      if (by > my + mh - 30) return;
      var hovered = ENGINE.isButtonHovered(mx, by, mw, 24);
      ENGINE.drawButton(mx, by, mw, 24,
        item.name + ' x' + slot.qty,
        hovered, { color: item.color || '#237841', fontSize:8 }
      );
    });
    ENGINE.drawButton(mx, my + mh - 24, 80, 20, '[ESC] Back', false, {color:'#6C6E68', fontSize:7});
  }

  function renderBattleLog(ctx, canvasW, canvasH) {
    var lx = 280, ly = canvasH - 130, lw = canvasW - 500, lh = 120;
    ENGINE.drawPanel(lx-4, ly-8, lw+8, lh+16, { bg:'rgba(10,10,20,0.85)' });
    state.log.slice(0,5).forEach(function(line, i) {
      var alpha = 1 - i*0.18;
      ctx.globalAlpha = alpha;
      ENGINE.drawText(line, lx+4, ly + i*18 + 14, {size:8, color:i===0?'#F2CD37':'#9BA19D'});
    });
    ctx.globalAlpha = 1;
  }

  function renderTurnOrder(ctx, canvasW, canvasH) {
    var order = state.turnOrder.filter(function(c){ return c.hp > 0; });
    var tx = canvasW/2 - order.length*18;
    var ty = canvasH - 18;
    ENGINE.drawText('Turn:', tx-40, ty+8, {size:7, color:'#9BA19D'});
    order.forEach(function(c, i) {
      var isActive = (state.turnOrder[state.turnIdx] === c);
      var col = c.isPlayer ? '#237841' : '#C91A09';
      ctx.fillStyle = isActive ? '#F2CD37' : col;
      ctx.fillRect(tx + i*20, ty, 16, 12);
      ctx.strokeStyle = isActive ? '#FFF' : 'rgba(0,0,0,0.5)';
      ctx.lineWidth = isActive ? 2 : 0.5;
      ctx.strokeRect(tx + i*20, ty, 16, 12);
      ENGINE.drawText(c.name[0], tx+i*20+5, ty+10, {size:8, color:'#FFF', bold:true});
    });
  }

  // ── Handle player input ────────────────────────────────────
  function handleInput() {
    if (!state || state.phase !== 'player_menu') return;

    // Back from submenus — cancel or any unbound "back" key
    if (ENGINE.action('cancel')) {
      state.showingSkills = false;
      state.showingItems  = false;
      return;
    }

    if (state.showingSkills) {
      handleSkillSelect();
      return;
    }
    if (state.showingItems) {
      handleItemSelect();
      return;
    }

    // Action hotkeys — use ENGINE.action() so rebinding works
    if (ENGINE.action('attack'))  { playerAttack(); return; }
    if (ENGINE.action('skills'))  { state.showingSkills = true; return; }
    if (ENGINE.action('item'))    { state.showingItems  = true; return; }
    if (ENGINE.action('defend'))  { playerDefend(); return; }
    if (ENGINE.action('flee'))    { playerFlee(); return; }

    // Mouse clicks on action buttons
    ACTIONS.forEach(function(a, i) {
      var col = Math.floor(i/3), row = i%3;
      var bx = ENGINE.getCanvas().width - 220 + col*104;
      var by = ENGINE.getCanvas().height - 130 + row*34;
      if (ENGINE.isButtonClicked(bx, by, 100, 28)) {
        if (a.id === 'attack') playerAttack();
        else if (a.id === 'skills' || a.id === 'magic') state.showingSkills = true;
        else if (a.id === 'item')   state.showingItems  = true;
        else if (a.id === 'defend') playerDefend();
        else if (a.id === 'flee')   playerFlee();
      }
    });
  }

  function handleSkillSelect() {
    var skills = state.player.skills || [];
    var canvasW = ENGINE.getCanvas().width;
    var canvasH = ENGINE.getCanvas().height;
    var mx = canvasW - 320, my = canvasH - 240, mw = 300;

    // Keyboard nav: ↑/↓ through skills, confirm to use
    if (ENGINE.action('up'))   state.skillSel = ((state.skillSel||0) - 1 + skills.length) % skills.length;
    if (ENGINE.action('down')) state.skillSel = ((state.skillSel||0) + 1) % skills.length;
    if (ENGINE.action('confirm') && skills.length > 0) {
      state.showingSkills = false;
      playerSkill(skills[state.skillSel||0]);
      return;
    }

    skills.forEach(function(skillId, i) {
      var by = my + i * 28;
      if (ENGINE.isButtonHovered(mx, by, mw, 24)) state.skillSel = i;
      if (ENGINE.isButtonClicked(mx, by, mw, 24)) {
        state.showingSkills = false;
        playerSkill(skillId);
      }
    });
    if (ENGINE.isButtonClicked(mx, my + 160, 80, 20)) {
      state.showingSkills = false;
    }
  }

  function handleItemSelect() {
    var inventory = PLAYER.get().inventory.filter(function(i){ return i.qty > 0 && DATA.ITEMS[i.id] && DATA.ITEMS[i.id].type==='consumable'; });
    var canvasW = ENGINE.getCanvas().width;
    var canvasH = ENGINE.getCanvas().height;
    var mx = canvasW - 280, my = canvasH - 200, mw = 260;

    if (ENGINE.action('up'))   state.itemSel = ((state.itemSel||0) - 1 + Math.max(1,inventory.length)) % Math.max(1,inventory.length);
    if (ENGINE.action('down')) state.itemSel = ((state.itemSel||0) + 1) % Math.max(1,inventory.length);
    if (ENGINE.action('confirm') && inventory.length > 0) {
      state.showingItems = false;
      playerItem(inventory[state.itemSel||0].id);
      return;
    }

    inventory.forEach(function(slot, i) {
      var by = my + i * 28;
      if (ENGINE.isButtonHovered(mx, by, mw, 24)) state.itemSel = i;
      if (ENGINE.isButtonClicked(mx, by, mw, 24)) {
        state.showingItems = false;
        playerItem(slot.id);
      }
    });
    if (ENGINE.isButtonClicked(mx, my + 150, 80, 20)) {
      state.showingItems = false;
    }
  }

  return {
    start, getState, getAliveEnemies,
    playerAttack, playerSkill, playerItem, playerDefend, playerFlee,
    enemyTurn, currentCombatant, nextTurn,
    handleInput, render, addLog,
    isAlive
  };
})();
