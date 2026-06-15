// ============================================================
//  CHRONICLES OF THE SHATTERED REALM — Player State
// ============================================================

var PLAYER = (function() {

  var state = null;

  function create(name, kingdom, origin) {
    var orig  = DATA.ORIGINS[origin];
    var king  = DATA.KINGDOMS[kingdom];
    var stats = Object.assign({}, orig.stats);

    state = {
      name:     name || 'Kael',
      kingdom:  kingdom,
      origin:   origin,
      className:orig.class,
      level:    1,
      xp:       0,
      xpNext:   100,

      // Core stats (base + equipment)
      baseStats: Object.assign({}, stats),
      hp:    stats.hp,   maxHp: stats.hp,
      mp:    stats.mp,   maxMp: stats.mp,
      sp:    stats.sp,   maxSp: stats.sp,
      atk:   stats.atk,
      def:   stats.def,
      mag:   stats.mag,
      agi:   stats.agi,

      // Cosmetics
      torsoColor: orig.torsoColor,
      legColor:   orig.legColor,
      headColor:  '#F2CD37',
      weapon:     getStartingWeapon(origin),
      hat:        getStartingHat(origin),

      // Resources
      gold:     50 + (origin === 'noble' ? 100 : 0) + (origin === 'prince' ? 200 : 0),
      inventory: getStartingInventory(origin),
      equipment: { weapon: null, armor: null },

      // Skills
      skills:   orig.startingSkills.slice(),
      lastAction: null,

      // Class mechanics
      momentum:   0,    // Sword Clan
      divineM:    0,    // Priest
      authorityB: 0,    // Noble
      spellWeaved:false, // Mage
      leyActive:  false, // Mage

      // Blood Powers
      bloodPower:     orig.bloodPower,
      ironWillActive: false,
      dragonVowLocked:true,

      // Political (Noble/Prince)
      councilTrust:  origin === 'prince' ? 70 : (origin === 'noble' ? 50 : 0),
      popularFavor:  origin === 'prince' ? 60 : (origin === 'noble' ? 40 : 0),
      treasury:      origin === 'prince' ? 3000 : (origin === 'noble' ? 800 : 0),
      spyAgents:     origin === 'prince' ? 3 : (origin === 'noble' ? 1 : 0),
      armySize:      origin === 'prince' ? 2000 : (origin === 'noble' ? 500 : 0),
      councilEvents: [],
      foreignRel:    { valdris:50, sylvara:50, solheim:50, drakmoor:30, veranthos:50 },

      // Military rank (Commoner)
      militaryRank:  origin === 'commoner' ? 0 : -1, // -1=N/A
      rankName:      origin === 'commoner' ? 'Recruit' : null,

      // Romance system
      romanceLocked:  null,     // id of locked romance lead
      romanceApproval:{},       // leadId → 0-100
      romanceArcs:    {},       // leadId → arc stage

      // Quest log
      activeQuests:    {},
      completedQuests: [],
      flags:           {},      // story flags

      // Progression depth (Layers 2/4/7)
      masteryPoints:   1,       // earned on level-up, spent in skill trees
      masteryNodes:    [],      // unlocked skill-tree node ids
      monsterCodex:    {},      // enemyType → kill count
      codexTraits:     [],      // absorbed essence trait ids
      passives:        [],      // passive ability ids (e.g. 'dodge')
      corruption:      0,       // Void corruption meter (0-100)

      // Position
      zone: king.mapZone,
      x: king.startPos.x,
      y: king.startPos.y,
      facingLeft: false,

      // Movement
      moveTimer: 0,
      moveCooldown: 12,

      // Map state
      worldX: king.startPos.x,
      worldY: king.startPos.y,
    };

    // Init romance approval for all leads
    Object.keys(DATA.ROMANCE_LEADS).forEach(function(id) {
      state.romanceApproval[id] = 0;
    });

    return state;
  }

  function getStartingWeapon(origin) {
    switch(origin) {
      case 'sword_clan': return 'sword';
      case 'mage_clan':  return 'staff';
      case 'priest':     return 'staff';
      case 'noble':      return 'sword';
      case 'prince':     return 'sword';
      case 'commoner':   return null;
    }
    return null;
  }

  function getStartingHat(origin) {
    switch(origin) {
      case 'prince': return 'crown';
      case 'noble':  return null;
      default:       return null;
    }
  }

  function getStartingInventory(origin) {
    var base = [{ id:'health_potion', qty:2 }, { id:'stamina_draft', qty:1 }];
    if (origin === 'mage_clan') base.push({ id:'mana_potion', qty:2 });
    if (origin === 'priest')    base.push({ id:'mana_potion', qty:2 });
    if (origin === 'noble')     base.push({ id:'health_potion', qty:1 });
    if (origin === 'prince')    base.push({ id:'health_potion', qty:2 }, { id:'mana_potion', qty:1 });
    return base;
  }

  function get() { return state; }
  function set(s) { state = s; }

  // ── Stats ──────────────────────────────────────────────────
  function recalcStats() {
    var b = state.baseStats;
    state.atk = b.atk;
    state.def = b.def;
    state.mag = b.mag;
    state.agi = b.agi;
    state.maxHp = b.hp;
    state.maxMp = b.mp;
    state.maxSp = b.sp;

    // Equipment bonuses
    var eq = state.equipment;
    if (eq.weapon && DATA.ITEMS[eq.weapon]) {
      var w = DATA.ITEMS[eq.weapon];
      if (w.atk) state.atk += w.atk;
    }
    if (eq.armor && DATA.ITEMS[eq.armor]) {
      var a = DATA.ITEMS[eq.armor];
      if (a.def) state.def += a.def;
    }

    // Noble class passive
    if (state.origin === 'noble' || state.origin === 'prince') {
      state.def += Math.floor(state.level * 0.5);
    }

    // Progression bonuses: mastery-tree stat nodes + absorbed codex traits
    var bonus = getProgressionBonus();
    state.maxHp += bonus.hp; state.maxMp += bonus.mp; state.maxSp += bonus.sp;
    state.atk   += bonus.atk; state.def += bonus.def; state.mag += bonus.mag; state.agi += bonus.agi;
    // Don't let current pools exceed the new maxima boundlessly; clamp.
    if (state.hp > state.maxHp) state.hp = state.maxHp;
    if (state.mp > state.maxMp) state.mp = state.maxMp;
    if (state.sp > state.maxSp) state.sp = state.maxSp;
  }

  // ── Progression: mastery trees, codex, passives (Layers 2/4/7) ──
  function getProgressionBonus() {
    var b = { hp:0, mp:0, sp:0, atk:0, def:0, mag:0, agi:0 };
    function add(stat) {
      if (!stat) return;
      Object.keys(stat).forEach(function(k) { if (b[k] !== undefined) b[k] += stat[k]; });
    }
    // Mastery nodes
    var tree = DATA.SKILL_TREES[state.origin];
    if (tree && state.masteryNodes) {
      tree.branches.forEach(function(br) {
        br.nodes.forEach(function(node) {
          if (state.masteryNodes.indexOf(node.id) !== -1 && node.grants && node.grants.stat) add(node.grants.stat);
        });
      });
    }
    // Codex traits
    (state.codexTraits || []).forEach(function(tid) {
      var tr = DATA.CODEX_TRAITS[tid];
      if (tr && tr.stat) add(tr.stat);
    });
    return b;
  }

  // Find a mastery node by id across the origin's tree.
  function findMasteryNode(nodeId) {
    var tree = DATA.SKILL_TREES[state.origin];
    if (!tree) return null;
    for (var i = 0; i < tree.branches.length; i++) {
      var found = tree.branches[i].nodes.find(function(n) { return n.id === nodeId; });
      if (found) return found;
    }
    return null;
  }

  function canUnlockNode(nodeId) {
    var node = findMasteryNode(nodeId);
    if (!node) return false;
    if (state.masteryNodes.indexOf(nodeId) !== -1) return false;     // already owned
    if (state.masteryPoints < node.cost) return false;               // can't afford
    if (node.req && state.masteryNodes.indexOf(node.req) === -1) return false; // prereq
    return true;
  }

  // Spend points to unlock a node. Returns the node on success, else null.
  function unlockMasteryNode(nodeId) {
    if (!canUnlockNode(nodeId)) return null;
    var node = findMasteryNode(nodeId);
    state.masteryPoints -= node.cost;
    state.masteryNodes.push(nodeId);
    if (node.grants) {
      if (node.grants.skill && state.skills.indexOf(node.grants.skill) === -1) state.skills.push(node.grants.skill);
      if (node.grants.passive && state.passives.indexOf(node.grants.passive) === -1) state.passives.push(node.grants.passive);
    }
    recalcStats();
    return node;
  }

  // Record a kill toward the Monster Codex; returns the absorbed trait
  // (with name) the moment a threshold is crossed, else null.
  function recordKill(enemyType) {
    if (!enemyType) return null;
    state.monsterCodex[enemyType] = (state.monsterCodex[enemyType] || 0) + 1;
    var entry = DATA.MONSTER_CODEX[enemyType];
    if (!entry) return null;
    if (state.monsterCodex[enemyType] === entry.threshold && state.codexTraits.indexOf(entry.trait) === -1) {
      return addCodexTrait(entry.trait);
    }
    return null;
  }

  function addCodexTrait(traitId) {
    var tr = DATA.CODEX_TRAITS[traitId];
    if (!tr || state.codexTraits.indexOf(traitId) !== -1) return null;
    state.codexTraits.push(traitId);
    if (tr.passive && state.passives.indexOf(tr.passive) === -1) state.passives.push(tr.passive);
    recalcStats();
    return Object.assign({ id: traitId }, tr);
  }

  function hasPassive(name) { return (state.passives || []).indexOf(name) !== -1; }
  function getDodgeChance() { return hasPassive('dodge') ? 0.15 : 0; }

  // Bloodline / crisis awakening (Layer 7): granted by story flags, not grind.
  function awaken(traitId) { return addCodexTrait(traitId); }

  function heal(amount) {
    state.hp = Math.min(state.maxHp, state.hp + amount);
  }
  function restoreMp(amount) {
    state.mp = Math.min(state.maxMp, state.mp + amount);
  }
  function restoreSp(amount) {
    state.sp = Math.min(state.maxSp, state.sp + amount);
  }
  function damage(amount) {
    // Iron Will reduction
    if (state.ironWillActive) amount = Math.ceil(amount * 0.7);
    state.hp = Math.max(0, state.hp - amount);
    return amount;
  }

  // ── XP & Leveling ─────────────────────────────────────────
  function gainXp(amount) {
    state.xp += amount;
    var leveled = false;
    while (state.xp >= state.xpNext) {
      state.xp    -= state.xpNext;
      state.level += 1;
      state.xpNext = Math.floor(state.xpNext * 1.5);
      onLevelUp();
      leveled = true;
    }
    return leveled;
  }

  function onLevelUp() {
    var b = state.baseStats;
    // Stat growth per origin
    switch(state.origin) {
      case 'sword_clan':
        b.hp  += 12; b.atk += 3; b.def += 2; b.sp += 8; break;
      case 'mage_clan':
        b.hp  += 6;  b.mag += 4; b.mp  += 15; b.agi += 1; break;
      case 'priest':
        b.hp  += 8;  b.mag += 3; b.mp  += 12; b.def += 1; break;
      case 'noble':
        b.hp  += 9;  b.atk += 2; b.def += 3; b.sp += 6; break;
      case 'prince':
        b.hp  += 11; b.atk += 2; b.def += 2; b.mp += 5; b.sp += 6; break;
      case 'commoner':
        b.hp  += 10; b.atk += 3; b.agi += 2; b.sp += 7; break;
    }
    // Mastery Point per level (Layer 2). Anti-grind: cap still applies.
    state.masteryPoints = (state.masteryPoints || 0) + 1;

    // Restore full
    recalcStats();
    state.hp = state.maxHp;
    state.mp = state.maxMp;
    state.sp = state.maxSp;

    // Check blood power unlock
    checkBloodPowerUnlocks();
  }

  function checkBloodPowerUnlocks() {
    if (state.origin === 'prince' && state.level >= 8 && state.hp < state.maxHp * 0.15) {
      state.dragonVowLocked = false;
      if (!state.skills.includes('dragons_vow')) {
        state.skills.push('dragons_vow');
      }
    }
  }

  // ── Gold / Inventory ───────────────────────────────────────
  function gainGold(amount) { state.gold += amount; }
  function spendGold(amount) {
    if (state.gold < amount) return false;
    state.gold -= amount;
    return true;
  }

  function addItem(itemId, qty) {
    qty = qty || 1;
    var existing = state.inventory.find(function(i) { return i.id === itemId; });
    if (existing) { existing.qty += qty; }
    else { state.inventory.push({ id: itemId, qty: qty }); }
  }

  function removeItem(itemId, qty) {
    qty = qty || 1;
    var existing = state.inventory.find(function(i) { return i.id === itemId; });
    if (!existing || existing.qty < qty) return false;
    existing.qty -= qty;
    if (existing.qty <= 0) {
      state.inventory = state.inventory.filter(function(i) { return i.qty > 0; });
    }
    return true;
  }

  function hasItem(itemId) {
    var it = state.inventory.find(function(i) { return i.id === itemId; });
    return it ? it.qty : 0;
  }

  function useItem(itemId) {
    if (!hasItem(itemId)) return false;
    var item = DATA.ITEMS[itemId];
    if (!item) return false;
    if (item.type === 'consumable') {
      if (item.effect === 'hp')  heal(item.value);
      if (item.effect === 'mp')  restoreMp(item.value);
      if (item.effect === 'sp')  restoreSp(item.value);
      if (item.effect === 'all') { heal(item.value); restoreMp(item.value); restoreSp(item.value); }
      removeItem(itemId, 1);
      return true;
    }
    return false;
  }

  // ── Quests ─────────────────────────────────────────────────
  function startQuest(questId) {
    if (state.activeQuests[questId]) return;
    var q = DATA.QUESTS[questId];
    if (!q) return;
    state.activeQuests[questId] = {
      id: questId,
      title: q.title,
      objectives: q.objectives.map(function(o) { return Object.assign({}, o); })
    };
  }

  function completeObjective(questId, objId) {
    var q = state.activeQuests[questId];
    if (!q) return;
    var obj = q.objectives.find(function(o) { return o.id === objId; });
    if (obj) obj.done = true;
    // Check if all done
    if (q.objectives.every(function(o) { return o.done; })) {
      completeQuest(questId);
    }
  }

  function completeQuest(questId) {
    var q = DATA.QUESTS[questId];
    if (!q) return;
    // Give rewards
    if (q.reward.xp)   gainXp(q.reward.xp);
    if (q.reward.gold) gainGold(q.reward.gold);
    if (q.reward.item) addItem(q.reward.item);
    state.completedQuests.push(questId);
    delete state.activeQuests[questId];
    // Start next quest
    if (q.next) startQuest(q.next);
  }

  // ── Flags ──────────────────────────────────────────────────
  function setFlag(key, value) { state.flags[key] = value === undefined ? true : value; }
  function getFlag(key)        { return state.flags[key]; }

  // ── Romance ────────────────────────────────────────────────
  function meetRomanceLead(leadId) {
    if (!state.romanceArcs[leadId]) {
      state.romanceArcs[leadId] = 'met';
    }
  }

  function adjustApproval(leadId, delta) {
    if (state.romanceLocked && state.romanceLocked !== leadId) return;
    state.romanceApproval[leadId] = Math.max(0, Math.min(100, (state.romanceApproval[leadId]||0) + delta));
    if (state.romanceApproval[leadId] >= 40 && !state.romanceLocked) {
      state.romanceLocked = leadId;
      state.romanceArcs[leadId] = 'pursuing';
    }
  }

  function progressRomanceArc(leadId) {
    var arc = state.romanceArcs[leadId] || 'met';
    var stages = ['met','pursuing','committed','resolved'];
    var idx = stages.indexOf(arc);
    if (idx < stages.length - 1) {
      state.romanceArcs[leadId] = stages[idx+1];
    }
  }

  // ── Rank names (Commoner) ──────────────────────────────────
  var RANKS = ['Recruit','Soldier','Corporal','Sergeant','Captain','Commander','General','Marshal'];
  function getRankName() {
    if (state.militaryRank < 0) return null;
    return RANKS[Math.min(state.militaryRank, RANKS.length-1)];
  }
  function promoteRank() {
    if (state.militaryRank < 0 || state.militaryRank >= RANKS.length-1) return;
    state.militaryRank++;
    state.rankName = getRankName();
    if (state.militaryRank >= 2) {  // Commander: open political access
      state.councilTrust = 20;
    }
  }

  // ── Combat helpers ─────────────────────────────────────────
  function buildCombatant() {
    var p = state;
    return {
      id:        'player',
      name:      p.name,
      hp:        p.hp,   maxHp: p.maxHp,
      mp:        p.mp,   maxMp: p.maxMp,
      sp:        p.sp,   maxSp: p.maxSp,
      atk:       p.atk,  def: p.def, mag: p.mag, agi: p.agi,
      skills:    p.skills,
      origin:    p.origin,
      torsoColor:p.torsoColor, legColor:p.legColor, headColor:p.headColor,
      weapon:    p.weapon, hat:p.hat,
      isPlayer:  true,
      statuses:  [],
      momentum:  p.momentum || 0,
      divineM:   p.divineM || 0,
      authorityB:p.authorityB || 0,
    };
  }

  function syncFromCombatant(combatant) {
    state.hp = combatant.hp;
    state.mp = combatant.mp;
    state.sp = combatant.sp;
    if (combatant.momentum !== undefined) state.momentum = combatant.momentum;
    if (combatant.divineM  !== undefined) state.divineM  = combatant.divineM;
    if (combatant.authorityB !== undefined) state.authorityB = combatant.authorityB;
  }

  // ── Save/Load ──────────────────────────────────────────────
  function save() {
    try {
      localStorage.setItem('cosr_save', JSON.stringify(state));
      return true;
    } catch(e) { return false; }
  }

  function load() {
    try {
      var raw = localStorage.getItem('cosr_save');
      if (!raw) return false;
      state = JSON.parse(raw);
      recalcStats();
      return true;
    } catch(e) { return false; }
  }

  function hasSave() {
    return !!localStorage.getItem('cosr_save');
  }

  return {
    create, get, set,
    recalcStats, heal, restoreMp, restoreSp, damage,
    gainXp, gainGold, spendGold,
    addItem, removeItem, hasItem, useItem,
    startQuest, completeObjective, completeQuest,
    setFlag, getFlag,
    getProgressionBonus, findMasteryNode, canUnlockNode, unlockMasteryNode,
    recordKill, addCodexTrait, hasPassive, getDodgeChance, awaken,
    meetRomanceLead, adjustApproval, progressRomanceArc,
    getRankName, promoteRank,
    buildCombatant, syncFromCombatant,
    save, load, hasSave
  };
})();
