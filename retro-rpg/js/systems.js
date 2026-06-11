// ============================================================
//  CHRONICLES OF THE SHATTERED REALM — Game Systems
//  Politics, Military, Romance, Quests, Crafting
// ============================================================

var SYSTEMS = (function() {

  // ── Political System ───────────────────────────────────────
  var POLITICS = {
    eventCooldown: 0,
    EVENT_INTERVAL: 300,  // frames between political event checks

    // Process political event
    triggerEvent: function() {
      var p = PLAYER.get();
      if (!p || (p.origin !== 'noble' && p.origin !== 'prince')) return null;

      var availableEvents = DATA.POLITICAL_EVENTS.filter(function(e) {
        return e.availableFor.includes(p.origin);
      });
      if (!availableEvents.length) return null;

      return availableEvents[Math.floor(Math.random() * availableEvents.length)];
    },

    // Apply event choice effects
    resolveEventChoice: function(eventId, choiceIdx) {
      var event  = DATA.POLITICAL_EVENTS.find(function(e){ return e.id === eventId; });
      var p      = PLAYER.get();
      if (!event || !p) return;

      var choice = event.options[choiceIdx];
      if (!choice) return;

      var effects = choice.effects || {};

      if (effects.gold)         { if (effects.gold > 0) PLAYER.gainGold(effects.gold); else p.treasury += effects.gold; }
      if (effects.popularFavor) p.popularFavor = Math.max(0, Math.min(100, (p.popularFavor||50) + effects.popularFavor));
      if (effects.councilTrust) p.councilTrust = Math.max(0, Math.min(100, (p.councilTrust||50) + effects.councilTrust));
      if (effects.armyMorale)   p.armyMorale   = Math.max(0, Math.min(100, (p.armyMorale||70) + effects.armyMorale));
      if (effects.spyAgents)    p.spyAgents    = Math.max(0, (p.spyAgents||0) + effects.spyAgents);
      if (effects.foreignRel) {
        Object.keys(effects.foreignRel).forEach(function(k) {
          p.foreignRel = p.foreignRel || {};
          p.foreignRel[k] = Math.max(0, Math.min(100, (p.foreignRel[k]||50) + effects.foreignRel[k]));
        });
      }

      // Check council trust consequences
      POLITICS.checkCouncilStatus(p);
    },

    checkCouncilStatus: function(p) {
      if (!p.councilTrust) return;
      if (p.councilTrust < 20) {
        // Coup risk
        if (Math.random() < 0.05) {
          PLAYER.setFlag('coup_in_progress', true);
        }
      }
      if (p.councilTrust < 40) {
        p.armyMorale = Math.max(0, (p.armyMorale||70) - 2);
      }
    },

    update: function() {
      this.eventCooldown++;
    }
  };

  // ── Military System ────────────────────────────────────────
  var MILITARY = {
    UNIT_TYPES: ['infantry','knights','archers','cavalry','siege'],
    UNIT_COUNTER: { infantry:'cavalry', knights:'archers', archers:'infantry', cavalry:'knights', siege:'none' },
    UNIT_WEAK_TO: { infantry:'knights', knights:'infantry', archers:'cavalry', cavalry:'archers', siege:'all' },

    // Simple battle resolution (strategic layer)
    resolveBattle: function(attackerArmy, defenderArmy, terrain) {
      var atkTotal = this.calcArmyStrength(attackerArmy, terrain, true);
      var defTotal = this.calcArmyStrength(defenderArmy, terrain, false);

      // Morale factor
      var moraleFactor = (attackerArmy.morale || 70) / 100;
      atkTotal *= moraleFactor;

      var result = {
        winner:       atkTotal > defTotal ? 'attacker' : 'defender',
        atkLosses:    Math.floor(defTotal * 0.3),
        defLosses:    Math.floor(atkTotal * 0.3),
        moraleDelta:  atkTotal > defTotal ? 10 : -15,
        captured:     atkTotal > defTotal * 1.5
      };

      // Update player army
      var p = PLAYER.get();
      if (p && (p.origin === 'noble' || p.origin === 'prince')) {
        if (result.winner === 'attacker') {
          p.armySize = Math.max(0, p.armySize - result.atkLosses);
          p.popularFavor = Math.min(100, (p.popularFavor||50) + 5);
        } else {
          p.armySize = Math.max(0, p.armySize - result.atkLosses);
          p.popularFavor = Math.max(0, (p.popularFavor||50) - 10);
        }
      }

      return result;
    },

    calcArmyStrength: function(army, terrain, isAttacker) {
      var base = army.size || 0;
      // Terrain bonuses
      if (terrain === 'forest' && !isAttacker) base *= 1.2;
      if (terrain === 'mountain') base *= isAttacker ? 0.7 : 1.3;
      return base;
    },

    // Commoner rank promotion check
    checkPromotion: function() {
      var p = PLAYER.get();
      if (!p || p.origin !== 'commoner') return false;
      // Simple promotion: every 3 levels
      if (p.level > 0 && p.level % 3 === 0 && p.militaryRank < 7) {
        if (!PLAYER.getFlag('ranked_' + p.level)) {
          PLAYER.setFlag('ranked_' + p.level, true);
          PLAYER.promoteRank();
          return true;
        }
      }
      return false;
    }
  };

  // ── Romance System ─────────────────────────────────────────
  var ROMANCE = {
    // Get available romance leads for this origin
    getAvailableLeads: function(origin) {
      return Object.entries(DATA.ROMANCE_LEADS)
        .filter(function(entry) { return entry[1].origin === origin; })
        .map(function(entry) { return { id: entry[0], data: entry[1] }; });
    },

    // Process dialog action
    processAction: function(action) {
      if (!action) return;
      if (action.type === 'romance_meet') {
        PLAYER.meetRomanceLead(action.lead);
        PLAYER.adjustApproval(action.lead, 15);
      }
      if (action.type === 'romance_progress') {
        PLAYER.adjustApproval(action.lead, 25);
        PLAYER.progressRomanceArc(action.lead);
      }
      if (action.type === 'romance_complete') {
        PLAYER.adjustApproval(action.lead, 50);
        PLAYER.progressRomanceArc(action.lead);
        PLAYER.setFlag('romance_complete_' + action.lead, true);
      }
    },

    // Check if romance scene should trigger
    checkRomanceScene: function() {
      var p   = PLAYER.get();
      if (!p) return null;
      var locked = p.romanceLocked;
      if (!locked) return null;

      var approval = p.romanceApproval[locked] || 0;
      var arc      = p.romanceArcs[locked];

      // Kessa confession at approval 60+, stage 'pursuing'
      if (locked === 'kessa_drumm' && approval >= 60 && arc === 'pursuing') {
        if (!PLAYER.getFlag('kessa_confession_seen')) {
          PLAYER.setFlag('kessa_confession_seen', true);
          return 'kessa_confession';
        }
      }
      // Sable reveal
      if (locked === 'sable' && approval >= 50 && arc === 'pursuing') {
        if (!PLAYER.getFlag('sable_reveal_seen')) {
          PLAYER.setFlag('sable_reveal_seen', true);
          return 'sable_reveal';
        }
      }
      return null;
    }
  };

  // ── Crafting system (basic) ────────────────────────────────
  var CRAFTING = {
    RECIPES: [
      {
        id: 'elixir',
        name: 'Craft Elixir',
        ingredients: [{ id:'health_potion', qty:1 }, { id:'mana_potion', qty:1 }],
        result: { id:'elixir', qty:1 }
      },
      {
        id: 'steel_blade',
        name: 'Forge Steel Blade',
        ingredients: [{ id:'iron_sword', qty:2 }],
        result: { id:'steel_blade', qty:1 }
      }
    ],

    canCraft: function(recipeId) {
      var recipe = this.RECIPES.find(function(r){ return r.id === recipeId; });
      if (!recipe) return false;
      return recipe.ingredients.every(function(ing) {
        return PLAYER.hasItem(ing.id) >= ing.qty;
      });
    },

    craft: function(recipeId) {
      if (!this.canCraft(recipeId)) return false;
      var recipe = this.RECIPES.find(function(r){ return r.id === recipeId; });
      recipe.ingredients.forEach(function(ing) {
        PLAYER.removeItem(ing.id, ing.qty);
      });
      PLAYER.addItem(recipe.result.id, recipe.result.qty);
      return true;
    }
  };

  // ── Rendering helpers for systems ─────────────────────────
  function renderPoliticalPanel(ctx, x, y, w, h) {
    var p = PLAYER.get();
    if (!p) return;

    ENGINE.drawPanel(x, y, w, h, { title:'POLITICS' });
    var iy = y + 18;

    ENGINE.drawBar(x+8, iy,    w-16, 10, p.councilTrust||50,  100, '#F2CD37', 'Council');
    ENGINE.drawBar(x+8, iy+14, w-16, 10, p.popularFavor||50,  100, '#77C537', 'People');
    ENGINE.drawBar(x+8, iy+28, w-16, 10, p.spyAgents||0, 10,    '#81007B', 'Spies');
    ENGINE.drawBar(x+8, iy+42, w-16, 10, Math.min(100, (p.armySize||0)/50), 100, '#C91A09', 'Army');

    ENGINE.drawText('Treasury: ' + (p.treasury||0) + 'g', x+8, iy+62, {size:8, color:'#DBA000'});

    // Foreign relations
    ENGINE.drawText('Foreign Relations:', x+8, iy+76, {size:7, color:'#9BA19D'});
    var ri = 0;
    Object.entries(DATA.KINGDOMS).forEach(function(entry) {
      var rel = p.foreignRel ? (p.foreignRel[entry[0]]||50) : 50;
      var col = rel >= 60 ? '#77C537' : (rel >= 40 ? '#F2CD37' : '#C91A09');
      ENGINE.drawText(entry[1].name + ': ' + rel, x+8, iy+88 + ri*12, {size:7, color:col});
      ri++;
    });
  }

  function renderQuestPanel(ctx, x, y, w, h) {
    var p = PLAYER.get();
    if (!p) return;

    ENGINE.drawPanel(x, y, w, h, { title:'QUESTS' });
    var iy = y + 18;
    var active = Object.values(p.activeQuests || {});

    if (active.length === 0) {
      ENGINE.drawText('No active quests.', x+8, iy+10, {size:8, color:'#9BA19D'});
      return;
    }

    active.forEach(function(q, qi) {
      ENGINE.drawText(q.title, x+8, iy + qi*60, {size:8, color:'#F2CD37', bold:true});
      (q.objectives||[]).forEach(function(obj, oi) {
        var col = obj.done ? '#77C537' : '#9BA19D';
        var mark = obj.done ? '✓' : '○';
        ENGINE.drawText(mark + ' ' + obj.text.substring(0,28), x+12, iy + qi*60 + 14 + oi*12, {size:7, color:col});
      });
    });
  }

  function renderInventoryPanel(ctx, x, y, w, h) {
    var p = PLAYER.get();
    if (!p) return;

    ENGINE.drawPanel(x, y, w, h, { title:'INVENTORY' });
    var iy = y + 18;

    ENGINE.drawText('Gold: ' + p.gold + 'g', x+8, iy, {size:9, color:'#DBA000', bold:true});

    var inventory = p.inventory.filter(function(i){ return i.qty > 0; });
    inventory.forEach(function(slot, i) {
      var item = DATA.ITEMS[slot.id];
      if (!item) return;
      var ry = iy + 16 + i*20;
      if (ry > y + h - 20) return;

      // Item color dot
      ctx.fillStyle = item.color || '#9BA19D';
      ctx.fillRect(x+8, ry-8, 10, 10);
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x+8, ry-8, 10, 10);

      ENGINE.drawText(item.name + ' x' + slot.qty, x+22, ry, {size:8, color:'#FFF'});
      ENGINE.drawText(item.desc || '', x+22, ry+10, {size:6, color:'#9BA19D'});
    });

    // Equipment
    var eqY = iy + 16 + inventory.length*20 + 8;
    ENGINE.drawText('Equipment:', x+8, eqY, {size:7, color:'#F2CD37'});
    var eq = p.equipment;
    ENGINE.drawText('Weapon: ' + (eq.weapon ? (DATA.ITEMS[eq.weapon]||{}).name : 'None'), x+8, eqY+12, {size:7, color:'#9BA19D'});
    ENGINE.drawText('Armor: '  + (eq.armor  ? (DATA.ITEMS[eq.armor] ||{}).name : 'None'), x+8, eqY+24, {size:7, color:'#9BA19D'});
  }

  function renderRomancePanel(ctx, x, y, w, h) {
    var p = PLAYER.get();
    if (!p) return;

    ENGINE.drawPanel(x, y, w, h, { title:'BONDS', border:'#923978' });
    var iy = y + 18;

    if (p.romanceLocked) {
      var lead = DATA.ROMANCE_LEADS[p.romanceLocked];
      ENGINE.drawText('Pursuing: ' + (lead ? lead.name : p.romanceLocked), x+8, iy, {size:8, color:'#923978', bold:true});
      var arc = p.romanceArcs[p.romanceLocked] || 'met';
      ENGINE.drawText('Status: ' + arc.toUpperCase(), x+8, iy+14, {size:7, color:'#F2CD37'});
      ENGINE.drawBar(x+8, iy+26, w-16, 10, p.romanceApproval[p.romanceLocked]||0, 100, '#923978', 'Bond');
    } else {
      ENGINE.drawText('No bond formed yet.', x+8, iy+10, {size:8, color:'#9BA19D'});
      ENGINE.drawText('Speak to characters', x+8, iy+22, {size:7, color:'#6C6E68'});
      ENGINE.drawText('to build connections.', x+8, iy+34, {size:7, color:'#6C6E68'});
    }

    // All known leads
    var known = Object.entries(p.romanceArcs || {});
    if (known.length > 0) {
      ENGINE.drawText('Known:', x+8, iy+54, {size:7, color:'#9BA19D'});
      known.forEach(function(entry, i) {
        var lead = DATA.ROMANCE_LEADS[entry[0]];
        var name = lead ? lead.name : entry[0];
        ENGINE.drawText(name.substring(0,16), x+8, iy+66+i*12, {size:6, color:'#9BA19D'});
      });
    }
  }

  // ── Process dialog actions ─────────────────────────────────
  function processActions(actions) {
    if (!actions || !actions.length) return;
    actions.forEach(function(action) {
      switch(action.type) {
        case 'quest_start':
          PLAYER.startQuest(action.questId);
          break;
        case 'open_shop':
          // Handled by main state machine
          break;
        case 'romance_meet':
        case 'romance_progress':
        case 'romance_complete':
          ROMANCE.processAction(action);
          break;
        case 'start_boss':
          // Handled by main via flag
          PLAYER.setFlag('pending_boss', action.enemyId);
          break;
      }
    });
  }

  return {
    POLITICS, MILITARY, ROMANCE, CRAFTING,
    renderPoliticalPanel, renderQuestPanel,
    renderInventoryPanel, renderRomancePanel,
    processActions
  };
})();
