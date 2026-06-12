// ============================================================
//  CHRONICLES OF THE SHATTERED REALM — Game Data
// ============================================================

var DATA = {

  // ── Lego color palette ─────────────────────────────────────
  LEGO_COLORS: {
    red:       '#C91A09', blue:   '#0055BF', yellow: '#F2CD37',
    green:     '#237841', black:  '#1B2A34', white:  '#FFFFFF',
    orange:    '#FE8A18', lgray:  '#9BA19D', dgray:  '#6C6E68',
    tan:       '#E4CD9E', brown:  '#582A12', purple: '#81007B',
    lime:      '#77C537', sky:    '#68BCC5', magenta:'#923978',
    darkBlue:  '#003366', darkRed:'#720E0E', gold:   '#DBA000'
  },

  // ── Five Kingdoms ───────────────────────────────────────────
  KINGDOMS: {
    valdris: {
      id: 'valdris', name: 'Valdris', biome: 'Temperate highlands',
      culture: 'Honorable warriors', capital: 'Ironhold',
      color: '#C91A09', accentColor: '#F2CD37',
      description: 'Honorable Sword Clans rule the highland realm. Duty and blade are law.',
      startPos: { x: 5, y: 9 }, mapZone: 'ironhold'
    },
    sylvara: {
      id: 'sylvara', name: 'Sylvara', biome: 'Mystical ancient forests',
      culture: 'Elves & mage scholars', capital: 'Moonsong',
      color: '#237841', accentColor: '#77C537',
      description: 'Ancient elven towers reach into eternal mist. Magic flows through every root.',
      startPos: { x: 14, y: 5 }, mapZone: 'moonsong'
    },
    solheim: {
      id: 'solheim', name: 'Solheim', biome: 'Golden sun-drenched plains',
      culture: 'Devout theocracy', capital: 'Aurum Cathedral',
      color: '#DBA000', accentColor: '#FFFFFF',
      description: 'The faith guides all. Light and law are one in the sun-gilded plains.',
      startPos: { x: 8, y: 6 }, mapZone: 'aurum'
    },
    drakmoor: {
      id: 'drakmoor', name: 'Drakmoor', biome: 'Cold northern bogs',
      culture: 'Old nobility, scheming lords', capital: 'Ashenkeep',
      color: '#6C6E68', accentColor: '#81007B',
      description: 'Noble Houses wage shadow wars in the fog-drenched bogs. Trust no one.',
      startPos: { x: 5, y: 3 }, mapZone: 'ashenkeep'
    },
    veranthos: {
      id: 'veranthos', name: 'Veranthos', biome: 'Desert ruins & spice roads',
      culture: 'Merchant-kings, mercenaries', capital: 'Dune Throne',
      color: '#E4CD9E', accentColor: '#FE8A18',
      description: 'Gold buys armies here. The Dune Throne sits on ancient ruins worth dying for.',
      startPos: { x: 8, y: 6 }, mapZone: 'dune_throne'
    }
  },

  // ── Character Origins ───────────────────────────────────────
  ORIGINS: {
    sword_clan: {
      id: 'sword_clan', name: 'Sword Clan', class: 'Warrior',
      icon: '⚔️', color: '#C91A09',
      torsoColor: '#C91A09', legColor: '#720E0E',
      description: 'Master of blade and clan honor. Momentum fuels devastating strikes.',
      stats: { hp: 120, mp: 20, sp: 100, atk: 18, def: 14, mag: 4, agi: 12 },
      bloodPower: null,
      mechanic: 'Momentum Bar — builds with each hit. At 100: Clan Frenzy (+30% ATK, +1 action/turn)',
      startingSkills: ['cleave', 'iron_parry'],
      kingdom: 'valdris',
      openingLine: "I don't negotiate. I settle things with a blade."
    },
    mage_clan: {
      id: 'mage_clan', name: 'Mage Clan', class: 'Arcane Mage',
      icon: '🔮', color: '#0055BF',
      torsoColor: '#0055BF', legColor: '#003366',
      description: 'Weave devastating spell matrices. Slow to start, unstoppable when set up.',
      stats: { hp: 70, mp: 120, sp: 40, atk: 6, def: 8, mag: 22, agi: 10 },
      bloodPower: null,
      mechanic: 'Spell Matrix — chain 2 spells for Fusion Effects (e.g. Bolt→Ley Line = Mana Storm)',
      startingSkills: ['arcane_bolt', 'spell_weave'],
      kingdom: 'sylvara',
      openingLine: "The theoretical framework of your argument has three structural flaws. Shall I enumerate them?"
    },
    priest: {
      id: 'priest', name: 'Priest Order', class: 'Healer/Cleric',
      icon: '✨', color: '#DBA000',
      torsoColor: '#DBA000', legColor: '#9BA19D',
      description: 'Lifeline of the party. Divine strikes hit harder than any foe expects.',
      stats: { hp: 90, mp: 110, sp: 50, atk: 10, def: 12, mag: 18, agi: 9 },
      bloodPower: null,
      mechanic: 'Divine Meter — fills while healing. At full: Radiance Mode (double heal, pierce resists)',
      startingSkills: ['mend', 'divine_smite'],
      kingdom: 'solheim',
      openingLine: "There's a difference between justice and vengeance. I've spent years learning which is which."
    },
    noble: {
      id: 'noble', name: 'Noble House', class: 'Noble',
      icon: '👑', color: '#81007B',
      torsoColor: '#81007B', legColor: '#6C6E68',
      description: 'Command the battlefield. Weaker alone — makes the entire party lethal.',
      stats: { hp: 95, mp: 60, sp: 80, atk: 12, def: 16, mag: 8, agi: 10 },
      bloodPower: 'noble_blood',
      mechanic: 'Authority Bar — high authority causes weaker enemies to flee without fighting',
      startingSkills: ['rally', 'calculated_strike'],
      kingdom: 'drakmoor',
      openingLine: "An interesting proposition. I'll give it the consideration it deserves."
    },
    prince: {
      id: 'prince', name: 'Royal Prince', class: 'Prince/ss',
      icon: '🐉', color: '#FE8A18',
      torsoColor: '#FE8A18', legColor: '#582A12',
      description: 'Strongest origin. Full military command. A kingdom rises or falls with you.',
      stats: { hp: 110, mp: 80, sp: 90, atk: 16, def: 15, mag: 12, agi: 11 },
      bloodPower: 'royal_blood',
      mechanic: 'Dragon\'s Vow — near-death unlocks partial dragon transformation (Act III)',
      startingSkills: ['royal_decree', 'sovereign_strike'],
      kingdom: 'valdris',
      openingLine: "I was raised to lead. No one told me that meant deciding who dies and who doesn't."
    },
    commoner: {
      id: 'commoner', name: 'Commoner', class: 'Wanderer',
      icon: '🌾', color: '#9BA19D',
      torsoColor: '#9BA19D', legColor: '#6C6E68',
      description: 'No bloodline. No privileges. Pure freedom — and a secret that reshapes everything.',
      stats: { hp: 100, mp: 50, sp: 80, atk: 14, def: 11, mag: 8, agi: 14 },
      bloodPower: null,
      mechanic: 'Survivor\'s Grit — below 20% HP: +40% ATK and 5% HP regen per turn',
      startingSkills: ['gut_feeling', 'cheap_shot'],
      kingdom: 'valdris',
      openingLine: "You want me to bow? To that man? He burned three villages and called it taxation."
    }
  },

  // ── Skills / Abilities ──────────────────────────────────────
  SKILLS: {
    // Sword Clan
    cleave:          { name:'Cleave',          type:'physical', cost:15, costType:'sp', target:'all_enemies',    power:0.6, desc:'Hit all enemies for reduced damage.' },
    blade_dance:     { name:'Blade Dance',     type:'physical', cost:25, costType:'sp', target:'single',          power:1.2, hits:3, status:'bleed', desc:'3 rapid strikes, each applies Bleed.' },
    iron_parry:      { name:'Iron Parry',      type:'defend',   cost:20, costType:'sp', target:'self',            power:2.0, desc:'Counter next attack for double damage.' },
    killing_stance:  { name:'Killing Stance',  type:'physical', cost:35, costType:'sp', target:'single',          power:1.8, pierce:true, desc:'Next attack ignores all armor.' },
    clan_frenzy:     { name:'Clan Frenzy',     type:'buff',     cost:50, costType:'sp', target:'self',            power:1.3, turns:3, desc:'Enter Clan Frenzy: +30% ATK, extra action for 3 turns.' },
    // Mage Clan
    arcane_bolt:     { name:'Arcane Bolt',     type:'magic',    cost:10, costType:'mp', target:'single',          power:1.4, element:'arcane', desc:'Single target arcane damage.' },
    spell_weave:     { name:'Spell Weave',     type:'buff',     cost:5,  costType:'mp', target:'self',            power:2.0, turns:1, desc:'Charge: next spell is doubled in power.' },
    mana_shield:     { name:'Mana Shield',     type:'defend',   cost:20, costType:'mp', target:'self',            power:1.5, desc:'Convert MP into a damage-absorbing barrier.' },
    ley_line:        { name:'Ley Line',        type:'magic',    cost:30, costType:'mp', target:'all_enemies',    power:0.8, turns:3, desc:'Ground AoE: damages all enemies each turn.' },
    unravel:         { name:'Unravel',         type:'magic',    cost:25, costType:'mp', target:'single',          power:1.0, debuff:true, desc:'Remove enemy buffs and deal damage per buff.' },
    forbidden_spell: { name:'Forbidden Spell', type:'magic',    cost:60, costType:'mp', target:'all_enemies',    power:3.0, desc:'Story-unlocked. Rewrites the battlefield.' },
    // Priest
    mend:            { name:'Mend',            type:'heal',     cost:15, costType:'mp', target:'ally',            power:1.2, desc:'Restore moderate HP to one ally.' },
    sacred_ground:   { name:'Sacred Ground',   type:'heal',     cost:30, costType:'mp', target:'all_allies',     power:0.6, turns:3, desc:'Area heal: all allies recover HP for 3 turns.' },
    divine_smite:    { name:'Divine Smite',    type:'magic',    cost:20, costType:'mp', target:'single',          power:1.3, element:'holy', desc:'Light damage, removes enemy buffs.' },
    cleanse:         { name:'Cleanse',         type:'support',  cost:10, costType:'mp', target:'ally',            power:0,   desc:'Remove all status effects from one ally.' },
    martyrs_shield:  { name:"Martyr's Shield", type:'defend',   cost:25, costType:'mp', target:'ally',            power:0,   desc:'Take all damage for one ally this turn.' },
    wrath_solheim:   { name:'Wrath of Solheim',type:'magic',    cost:50, costType:'mp', target:'all_enemies',    power:2.5, element:'holy', desc:'Massive holy damage. Stuns undead/demons.' },
    // Noble
    rally:           { name:'Rally',           type:'buff',     cost:20, costType:'sp', target:'all_allies',     power:1.2, turns:2, desc:'All allies gain +20% ATK for 2 turns.' },
    calculated_strike:{ name:'Calculated Strike',type:'physical', cost:15, costType:'sp', target:'single',       power:0.8, status:'exposed', desc:'Low damage, applies Exposed (enemy takes +30% next hit).' },
    blood_iron_will: { name:'Iron Will',       type:'buff',     cost:35, costType:'sp', target:'self',            power:0.7, turns:3, desc:'Negate 30% damage for 3 turns (Blood Power).' },
    ancestral_call:  { name:'Ancestral Call',  type:'summon',   cost:50, costType:'sp', target:'single',          power:2.5, desc:'Summon ancestral warrior for one devastating strike.' },
    house_wrath:     { name:'House Wrath',     type:'buff',     cost:40, costType:'sp', target:'all_allies',     power:1.3, desc:'Party-wide ATK & DEF boost, scales with political rank.' },
    // Prince
    royal_decree:    { name:'Royal Decree',    type:'buff',     cost:30, costType:'sp', target:'all_allies',     power:0,   desc:'All allies act before any enemy this turn.' },
    sovereign_strike:{ name:'Sovereign Strike',type:'physical', cost:25, costType:'sp', target:'single',          power:2.0, status:'fear', desc:'2x damage, chance to instill Fear (enemy loses 1 turn).' },
    dragons_breath:  { name:"Dragon's Breath", type:'magic',    cost:45, costType:'mp', target:'all_enemies',    power:1.8, element:'fire', desc:'AoE fire damage. Unlocked in Act III.' },
    vow_realm:       { name:'Vow of the Realm',type:'buff',     cost:50, costType:'sp', target:'all_allies',     power:0,   desc:'All allies immune to one-shot kills this battle.' },
    dragons_vow:     { name:"Dragon's Vow",    type:'transform',cost:80, costType:'sp', target:'self',            power:4.0, desc:'Full partial transformation. Massive damage. (Story-unlocked)' },
    // Commoner
    gut_feeling:     { name:'Gut Feeling',     type:'defend',   cost:15, costType:'sp', target:'self',            power:0,   desc:'Predict enemy\'s next attack and perfectly block it.' },
    cheap_shot:      { name:'Cheap Shot',      type:'physical', cost:20, costType:'sp', target:'single',          power:1.5, pierce:true, desc:'Ignores enemy defense entirely.' },
    survivors_grit:  { name:"Survivor's Grit", type:'passive',  cost:0,  costType:null, target:'self',            power:0,   desc:'Below 20% HP: +40% ATK and regen 5% HP/turn (passive).' },
    soldiers_drill:  { name:"Soldier's Drill", type:'repeat',   cost:10, costType:'sp', target:'self',            power:0.75, desc:'Repeat last action at 75% effectiveness for free.' },
    hidden_talent:   { name:'Hidden Talent',   type:'random',   cost:30, costType:'sp', target:'single',          power:0,   desc:'Random powerful effect — high risk, high reward.' },
    rise:            { name:'Rise',            type:'revive',   cost:0,  costType:null, target:'self',            power:0.3, desc:'After being knocked to 1 HP: recover 30% HP. (Story-unlocked)' }
  },

  // ── Enemies ─────────────────────────────────────────────────
  ENEMIES: {
    bandit: {
      id:'bandit', name:'Bandit', tier:1, hp:30, atk:8, def:4, mag:0, agi:8,
      torsoColor:'#6C6E68', legColor:'#1B2A34', headColor:'#E4CD9E',
      xp:15, gold:[5,15], drops:['health_potion'],
      aiType:'basic', moves:['attack','attack','defend']
    },
    highland_wolf: {
      id:'highland_wolf', name:'Highland Wolf', tier:1, hp:25, atk:10, def:3, mag:0, agi:14,
      torsoColor:'#9BA19D', legColor:'#6C6E68', headColor:'#9BA19D',
      isAnimal:true, xp:12, gold:[0,5], drops:[],
      aiType:'basic', moves:['attack','attack','attack','flee']
    },
    moor_soldier: {
      id:'moor_soldier', name:'Moor Soldier', tier:2, hp:55, atk:13, def:10, mag:0, agi:9,
      torsoColor:'#6C6E68', legColor:'#1B2A34', headColor:'#E4CD9E',
      xp:35, gold:[10,25], drops:['health_potion','iron_sword'],
      aiType:'smart', weakest_target:true
    },
    forest_mage: {
      id:'forest_mage', name:'Forest Mage', tier:2, hp:40, atk:6, def:6, mag:16, agi:11,
      torsoColor:'#237841', legColor:'#003366', headColor:'#E4CD9E',
      xp:40, gold:[15,30], drops:['mana_potion','spell_scroll'],
      aiType:'smart', prefersMagic:true
    },
    void_knight: {
      id:'void_knight', name:"Malachar's Void Knight", tier:3, hp:90, atk:20, def:15, mag:10, agi:12,
      torsoColor:'#1B2A34', legColor:'#81007B', headColor:'#1B2A34',
      xp:80, gold:[30,60], drops:['dark_shard','health_potion'],
      aiType:'elite', signature:'void_strike'
    },
    iron_warlord: {
      id:'iron_warlord', name:'Iron Warlord', tier:4, hp:250, atk:28, def:20, mag:5, agi:10,
      torsoColor:'#9BA19D', legColor:'#6C6E68', headColor:'#9BA19D',
      xp:300, gold:[100,200], drops:['warlord_blade','iron_plate'],
      aiType:'boss', phases:[
        { threshold:1.0, name:'Testing You',    moves:['attack','shield_bash','attack','taunt'] },
        { threshold:0.74, name:'Serious Now',   moves:['dual_strike','iron_cyclone','dual_strike','attack'] },
        { threshold:0.39, name:'Last Stand',    moves:['berserk_charge','last_stand','attack','regen'] }
      ]
    },
    malachar: {
      id:'malachar', name:'Malachar the Awakened', tier:4, hp:500, atk:35, def:25, mag:40, agi:15,
      torsoColor:'#1B2A34', legColor:'#81007B', headColor:'#1B2A34',
      xp:9999, gold:[500,500], drops:['heartstone_fragment'],
      aiType:'boss', phases:[
        { threshold:1.0,  name:'The Ancient Returns', moves:['void_bolt','ancient_curse','summon_void'] },
        { threshold:0.65, name:'Claiming the Shards',  moves:['heartstone_blast','void_rend','mass_fear'] },
        { threshold:0.30, name:'The Final Shape',      moves:['world_reshape','void_annihilation','despair'] }
      ]
    },
    crypt_shade: {
      id:'crypt_shade', name:'Crypt Shade', tier:2, hp:35, atk:9, def:5, mag:14, agi:13,
      torsoColor:'#1B2A34', legColor:'#81007B', headColor:'#1B2A34',
      xp:38, gold:[8,20], drops:['dark_shard'],
      aiType:'smart', prefersMagic:true, moves:['void_strike','attack','ancient_curse']
    },
    bog_horror: {
      id:'bog_horror', name:'Bog Horror', tier:3, hp:180, atk:22, def:16, mag:8, agi:7,
      torsoColor:'#3D5C1A', legColor:'#304A14', headColor:'#3D5C1A',
      xp:220, gold:[60,120], drops:['heartstone_fragment','health_potion'],
      aiType:'boss', phases:[
        { threshold:1.0,  name:'Lurking',      moves:['attack','shield_bash','attack','regen'] },
        { threshold:0.55, name:'Rampaging',    moves:['dual_strike','berserk_charge','attack','regen'] },
        { threshold:0.25, name:'Death Throes', moves:['berserk_charge','berserk_charge','last_stand','regen'] }
      ]
    },
    tomb_sentinel: {
      id:'tomb_sentinel', name:'Tomb Sentinel', tier:3, hp:210, atk:25, def:22, mag:12, agi:8,
      torsoColor:'#E4CD9E', legColor:'#DBA000', headColor:'#D4B87A',
      xp:260, gold:[80,150], drops:['iron_plate','heartstone_fragment'],
      aiType:'boss', signature:'void_strike', phases:[
        { threshold:1.0,  name:'Awakening',       moves:['taunt','attack','shield_bash','defend'] },
        { threshold:0.60, name:'Wrath of the Sand',moves:['dual_strike','iron_cyclone','attack','shield_bash'] },
        { threshold:0.25, name:'Undying Vigil',   moves:['berserk_charge','last_stand','iron_cyclone','regen'] }
      ]
    }
  },

  // ── Items ────────────────────────────────────────────────────
  ITEMS: {
    health_potion:    { id:'health_potion',    name:'Health Potion',   type:'consumable', effect:'hp',  value:50,  cost:30,  color:'#C91A09', desc:'Restore 50 HP.' },
    mana_potion:      { id:'mana_potion',      name:'Mana Potion',     type:'consumable', effect:'mp',  value:40,  cost:25,  color:'#0055BF', desc:'Restore 40 MP.' },
    stamina_draft:    { id:'stamina_draft',    name:'Stamina Draft',   type:'consumable', effect:'sp',  value:40,  cost:20,  color:'#237841', desc:'Restore 40 SP.' },
    elixir:           { id:'elixir',           name:'Elixir',          type:'consumable', effect:'all', value:30,  cost:100, color:'#F2CD37', desc:'Restore 30 HP, MP, and SP.' },
    iron_sword:       { id:'iron_sword',       name:'Iron Sword',      type:'weapon',     atk:5,        cost:80,  color:'#9BA19D', desc:'+5 ATK' },
    steel_blade:      { id:'steel_blade',      name:'Steel Blade',     type:'weapon',     atk:10,       cost:200, color:'#9BA19D', desc:'+10 ATK' },
    warlord_blade:    { id:'warlord_blade',    name:"Warlord's Blade", type:'weapon',     atk:18,       cost:0,   color:'#DBA000', desc:'+18 ATK. Forged in the Iron Keep.' },
    iron_plate:       { id:'iron_plate',       name:'Iron Plate',      type:'armor',      def:6,        cost:150, color:'#6C6E68', desc:'+6 DEF' },
    spell_scroll:     { id:'spell_scroll',     name:'Spell Scroll',    type:'consumable', effect:'mp',  value:60,  cost:50,  color:'#0055BF', desc:'Restore 60 MP.' },
    dark_shard:       { id:'dark_shard',       name:'Dark Shard',      type:'key',        cost:0,       color:'#81007B', desc:'A fragment of Void energy. Needed for something...' },
    heartstone_fragment:{id:'heartstone_fragment',name:'Heartstone Fragment',type:'key', cost:0,        color:'#F2CD37', desc:'One of five. The world turns on these.' }
  },

  // ── Romance Leads ────────────────────────────────────────────
  ROMANCE_LEADS: {
    sera_ashblade:   { name:'Sera Ashblade',      origin:'sword_clan', torsoColor:'#C91A09', headColor:'#F2CD37', desc:'The Rival Clan Warrior. Proud. Her love language is sparring.' },
    aelindra:        { name:'Aelindra Moonveil',  origin:'mage_clan',  torsoColor:'#0055BF', headColor:'#68BCC5', desc:'The Elven Archivist. 340 years old. She chooses mortality for love.' },
    sable:           { name:'Sable Nighthollow',  origin:'noble',      torsoColor:'#1B2A34', headColor:'#E4CD9E', desc:'The Court Assassin. She was hired to kill you. She chose otherwise.' },
    shade:           { name:'Shade / Lysse Vorne',origin:'prince',     torsoColor:'#6C6E68', headColor:'#E4CD9E', desc:'The Double Agent. Two voices, two names, one impossible choice.' },
    avira:           { name:'Princess Avira',     origin:'prince',     torsoColor:'#237841', headColor:'#F2CD37', desc:'The Alliance Marriage. Razor sharp. Tests everyone. Worth it.' },
    calla_vane:      { name:'Calla Vane',         origin:'priest',     torsoColor:'#9BA19D', headColor:'#E4CD9E', desc:'The Mercenary Captain. Cynical, resilient, devastatingly honest.' },
    kessa_drumm:     { name:'Kessa Drumm',        origin:'commoner',   torsoColor:'#6C6E68', headColor:'#F2CD37', desc:'The Soldier Companion. She has been meaning to say this for two years.' },
    mira_commoner:   { name:'Mira of No Name',    origin:'commoner',   torsoColor:'#9BA19D', headColor:'#68BCC5', desc:'The Amnesiac Wanderer. A lost princess who changes everything.' }
  },

  // ── World Map Tile Data ──────────────────────────────────────
  // Tile IDs: 0=void, 1=grass, 2=path, 3=forest, 4=mountain, 5=desert, 6=water, 7=wall, 8=floor, 9=door, 10=dungeon_floor, 11=dungeon_wall
  TILE: {
    VOID:0, GRASS:1, PATH:2, FOREST:3, MOUNTAIN:4, DESERT:5,
    WATER:6, WALL:7, FLOOR:8, DOOR:9, DG_FLOOR:10, DG_WALL:11,
    SWAMP:12, SNOW:13, MARKET:14, CROP:15
  },

  TILE_COLORS: {
    0: ['#0A0A14','#050510'],   // void
    1: ['#237841','#2D9450'],   // grass
    2: ['#9BA19D','#7A807D'],   // path
    3: ['#1A5E30','#144D27'],   // forest
    4: ['#582A12','#6E3516'],   // mountain
    5: ['#E4CD9E','#D4B87A'],   // desert
    6: ['#0055BF','#0044A0'],   // water
    7: ['#C91A09','#A01208'],   // wall (Lego red brick)
    8: ['#F2CD37','#D4A800'],   // floor (Lego yellow)
    9: ['#582A12','#3D1C0A'],   // door
    10:['#3D3D3D','#2E2E2E'],   // dungeon floor
    11:['#1B2A34','#131E26'],   // dungeon wall
    12:['#3D5C1A','#304A14'],   // swamp
    13:['#DDEEFF','#C8DFFF'],   // snow
    14:['#C8A878','#A08858'],   // market cobblestone
    15:['#4A7A28','#386020']    // crop/farm field
  },

  WALKABLE: new Set([1,2,3,5,8,9,10,12,13,14,15]),

  // ── Environment Configuration ───────────────────────────────
  // Global defaults for the world; zones override via their `env` block:
  //   env: { ambient, wildTiles, encounterChance, encounterMinFrames, encounterTable }
  ENVIRONMENT: {
    encounter: {
      minFrames:   180,    // frames of wilderness walking between checks
      chance:      0.012,  // per-step chance once minFrames reached
      groupChance: 0.3     // chance the encounter spawns 2 enemies
    },
    // Tiles that can trigger random encounters (world-map default)
    wildTiles: [1, 3, 5, 12],
    // Per-tile enemy pools for random encounters
    encounterTables: {
      1:  ['bandit', 'highland_wolf'],     // grass
      3:  ['forest_mage', 'highland_wolf'],// forest
      5:  ['bandit', 'bandit'],            // desert
      12: ['moor_soldier', 'bandit']       // swamp
    },
    // Named ambient overlays zones can reference (drawn over the view)
    ambients: {
      forest:  'rgba(16,46,24,0.14)',
      dungeon: 'rgba(4,4,16,0.34)',
      desert:  'rgba(255,196,90,0.10)',
      holy:    'rgba(255,240,200,0.08)',
      swamp:   'rgba(38,58,20,0.20)'
    },
    // Where the player lands when entering a zone, unless the
    // marker/dungeon entry defines its own entryX/entryY
    entryDefaults: {
      city:    { x:6, y:6 },
      dungeon: { x:2, y:8 }
    }
  },

  // ── World Map (26 wide × 18 tall) ───────────────────────────
  WORLD_MAP: {
    width: 26, height: 18,
    tiles: [
      // Row 0
      [0,0,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,0,0,0],
      // Row 1
      [0,4,4,12,12,4,4,4,3,3,3,3,3,4,4,4,4,4,4,4,4,0,0,0,0,0],
      // Row 2
      [0,4,12,12,12,12,4,3,3,3,3,3,3,3,4,5,5,5,5,4,0,0,0,0,0,0],
      // Row 3
      [0,4,12,9,4,12,4,3,3,9,3,3,3,3,4,5,5,5,5,4,0,0,0,0,0,0],
      // Row 4 (Ashenkeep region)
      [4,12,12,2,4,4,3,3,3,3,3,3,3,4,4,5,5,5,5,5,4,0,0,0,0,0],
      // Row 5
      [4,4,2,2,2,2,2,3,3,3,9,3,3,3,4,4,5,5,9,5,4,0,0,0,0,0],
      // Row 6 — Ironhold area
      [4,2,2,9,2,2,1,1,9,1,1,1,1,3,3,4,4,4,2,5,4,0,0,0,0,0],
      // Row 7
      [4,4,2,1,1,1,1,1,1,1,1,1,1,1,3,3,4,2,2,5,5,4,0,0,0,0],
      // Row 8 — central crossing
      [4,4,1,1,1,1,1,1,1,1,1,1,1,1,1,3,4,2,5,5,5,4,0,0,0,0],
      // Row 9
      [0,4,1,1,6,6,6,1,1,1,1,1,1,1,1,1,4,2,5,5,5,4,4,4,0,0],
      // Row 10
      [0,4,1,1,6,6,6,6,1,1,1,1,1,1,1,2,2,2,5,5,5,5,4,4,0,0],
      // Row 11 — Aurum / Solheim
      [0,4,1,1,1,6,6,6,1,1,9,1,1,1,2,2,5,5,5,9,5,5,5,4,0,0],
      // Row 12
      [0,0,4,1,1,1,6,1,1,1,1,1,1,2,2,1,1,5,5,5,5,5,5,4,0,0],
      // Row 13
      [0,0,4,4,1,1,1,1,1,1,2,2,2,2,1,1,1,1,5,5,5,9,5,4,0,0],
      // Row 14 — Veranthos/desert
      [0,0,0,4,4,1,1,1,1,2,2,5,5,5,5,5,5,5,5,5,5,5,4,4,0,0],
      // Row 15
      [0,0,0,0,4,4,1,1,2,2,5,5,5,5,5,5,5,5,5,5,5,4,4,0,0,0],
      // Row 16
      [0,0,0,0,0,4,4,2,2,5,5,5,5,5,5,5,5,5,5,4,4,0,0,0,0,0],
      // Row 17
      [0,0,0,0,0,0,4,4,4,4,4,4,4,4,4,4,4,4,4,4,0,0,0,0,0,0]
    ],
    // Procedural-overworld is infinite; entrances live at fixed world
    // coords and TERRAIN guarantees a walkable clearing around each.
    // Kingdoms are spread around the origin (valdris at 0,0 = world start).
    markers: [
      { x:0,   y:0,   kingdom:'valdris',  name:'Ironhold',       zone:'ironhold' },
      { x:38,  y:-18, kingdom:'sylvara',  name:'Moonsong',       zone:'moonsong' },
      { x:18,  y:34,  kingdom:'solheim',  name:'Aurum Cathedral',zone:'aurum' },
      { x:-34, y:-8,  kingdom:'drakmoor', name:'Ashenkeep',      zone:'ashenkeep' },
      { x:46,  y:26,  kingdom:'veranthos',name:'Dune Throne',    zone:'dune_throne' }
    ],
    // Dungeon entrances (also clearings in the procedural world).
    dungeons: [
      { x:14,  y:-14, name:'Ashwood Ruins',    zone:'ashwood_dungeon' },
      { x:-22, y:18,  name:'Bogmire Crypts',   zone:'bogmire_dungeon' },
      { x:54,  y:8,   name:'Spice Road Tombs', zone:'spice_dungeon'   }
    ]
  },

  // ── Zone Maps ────────────────────────────────────────────────
  ZONES: {
    ironhold: {
      name:'Ironhold', kingdom:'valdris', width:28, height:22,
      music:'highland', bgColor:'#C91A09',
      env: { encounterChance:0 },
      startPos: { x:5, y:9 },
      tiles: [
        // Row 0: outer north wall
        [7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7],
        // Row 1: castle interior (0-11) + road/grass (12-20) + inn (21-27)
        [7,8,8,8,8,8,8,8,8,8,8,7,1,1,2,2,2,2,2,1,1,7,8,8,8,8,7,7],
        // Row 2: throne room
        [7,8,8,8,8,8,8,8,8,8,8,7,1,1,2,2,2,2,2,1,1,7,8,8,8,8,7,7],
        // Row 3: castle columns
        [7,8,8,7,7,8,8,8,7,7,8,7,1,1,2,2,2,2,2,1,1,7,8,8,8,8,7,7],
        // Row 4: great hall + columns
        [7,8,7,7,8,8,8,8,8,7,7,7,1,1,2,2,2,2,2,1,1,7,8,8,8,8,7,7],
        // Row 5: castle interior + inn door col 25
        [7,8,8,8,8,8,8,8,8,8,8,7,1,1,2,2,2,2,2,1,1,7,8,8,8,9,7,7],
        // Row 6: lower castle + inn south wall
        [7,8,8,8,8,8,8,8,8,8,8,7,1,1,2,2,2,2,2,1,1,7,7,7,7,7,7,7],
        // Row 7: castle lower floor + east road (12-26)
        [7,8,8,8,8,8,8,8,8,8,8,7,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,7],
        // Row 8: castle south gate (door col 5) + east road
        [7,7,7,7,7,9,7,7,7,7,7,7,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,7],
        // Row 9: main E-W road
        [7,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,7],
        // Row 10: market square top + east road
        [7,2,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,2,2,2,2,2,2,2,2,2,2,7],
        // Row 11: market + east guild hall (18-26)
        [7,2,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,2,7,8,8,8,8,8,8,7,7,7],
        // Row 12: market center
        [7,2,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,2,7,8,8,8,8,8,8,7,7,7],
        // Row 13: market + guild hall door col 18
        [7,2,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,2,9,8,8,8,8,8,8,7,7,7],
        // Row 14: market bottom + guild hall south wall
        [7,2,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,2,7,7,7,7,7,7,7,7,7,7],
        // Row 15: south E-W road
        [7,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,7],
        // Row 16: farm (cols 2-7) + grass + path col 10
        [7,1,15,15,15,15,15,15,1,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,7],
        // Row 17: farm
        [7,1,15,15,15,15,15,15,1,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,7],
        // Row 18: farm wider (cols 2-8)
        [7,1,15,15,15,15,15,15,15,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,7],
        // Row 19: farm
        [7,1,15,15,15,15,15,15,15,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,7],
        // Row 20: open area
        [7,1,1,1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,7],
        // Row 21: south outer wall, exit door col 10
        [7,7,7,7,7,7,7,7,7,7,9,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7]
      ],
      npcs: [
        { id:'guard_gate',    name:'Castle Guard',        x:5,  y:9,  color:'#C91A09', dialog:'guard_dialog' },
        { id:'guard_west',    name:'Gate Warden',         x:2,  y:9,  color:'#C91A09', dialog:'guard_dialog' },
        { id:'guard_throne',  name:'Palace Guard',        x:2,  y:2,  color:'#C91A09', dialog:'guard_dialog' },
        { id:'elder_varos',   name:'Elder Varos',         x:5,  y:3,  color:'#DBA000', dialog:'elder_varos_dialog' },
        { id:'blacksmith',    name:'Harwick the Smith',   x:2,  y:13, color:'#4A3728', headColor:'#D09060', dialog:'blacksmith_dialog', isShop:true },
        { id:'merchant',      name:'Bram the Merchant',   x:8,  y:12, color:'#9BA19D', dialog:'merchant_dialog', isShop:true },
        { id:'cloth_merch',   name:'Tessa Threadbare',    x:13, y:11, color:'#A855A0', headColor:'#F2CD37', dialog:'cloth_merchant_dialog', isShop:true },
        { id:'innkeeper',     name:'Rodric Inn-Keep',     x:23, y:3,  color:'#8B4513', headColor:'#E4CD9E', dialog:'innkeeper_dialog' },
        { id:'guild_captain', name:'Captain Brennan',     x:20, y:12, color:'#4A7A28', dialog:'guard_dialog' },
        { id:'farmer1',       name:'Aldra the Farmer',    x:3,  y:17, color:'#8B6914', headColor:'#E4CD9E', dialog:'farmer_dialog' },
        { id:'farmer2',       name:'Pete the Farmer',     x:5,  y:19, color:'#6B5A14', headColor:'#E4CD9E', dialog:'farmer_dialog' },
        { id:'farmer3',       name:'Mira the Farmer',     x:4,  y:18, color:'#7A6020', headColor:'#F2CD37', dialog:'farmer_dialog' }
      ],
      exits: [{ x:10, y:20, targetZone:'world', targetX:0, targetY:2 }]
    },
    moonsong: {
      name:'Moonsong', kingdom:'sylvara', width:16, height:12,
      music:'forest', bgColor:'#237841',
      env: { ambient:'forest', encounterChance:0 },
      tiles: [
        [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
        [3,8,8,8,8,8,8,8,8,8,8,8,8,8,8,3],
        [3,8,3,3,8,8,8,8,8,3,3,8,8,8,8,3],
        [3,8,3,8,8,8,2,2,8,3,8,8,8,8,8,3],
        [3,8,3,8,8,2,2,2,2,8,8,8,8,3,8,3],
        [3,8,8,8,2,2,8,8,2,2,8,8,8,8,8,3],
        [3,8,8,2,2,8,8,8,8,2,2,8,8,8,8,3],
        [3,8,8,8,8,8,8,8,8,8,8,8,8,8,8,3],
        [3,8,3,3,8,8,8,8,8,3,3,8,8,8,8,3],
        [3,8,8,8,8,8,8,8,8,8,8,8,8,8,8,3],
        [3,8,8,8,8,8,9,8,8,8,8,8,8,8,8,3],
        [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3]
      ],
      npcs: [
        { id:'aelindra',  name:'Aelindra Moonveil', x:8, y:4, color:'#68BCC5', headColor:'#68BCC5', dialog:'aelindra_intro', isRomance:true },
        { id:'mage_tutor',name:'Master Silveth',     x:4, y:6, color:'#0055BF', dialog:'mage_tutor_dialog' }
      ],
      exits: [{ x:6, y:10, targetZone:'world', targetX:38, targetY:-16 }]
    },
    ashwood_dungeon: {
      name:'Ashwood Ruins — B1', kingdom:null, width:16, height:12,
      music:'dungeon', bgColor:'#1B2A34',
      env: { ambient:'dungeon', wildTiles:[10], encounterChance:0.02, encounterTable:['bandit','crypt_shade'] },
      tiles: [
        [11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11],
        [11,10,10,10,10,10,10,10,10,10,10,10,10,10,10,11],
        [11,10,11,11,10,10,10,10,10,11,11,10,10,11,10,11],
        [11,10,11,10,10,10,10,10,10,11,10,10,10,11,10,11],
        [11,10,10,10,10,11,10,10,10,10,10,10,10,10,10,11],
        [11,10,10,10,10,11,10,10,11,10,10,10,10,10,10,11],
        [11,10,10,11,10,10,10,10,11,10,10,11,10,10,10,11],
        [11,10,10,11,10,10,10,10,10,10,10,11,10,10,10,11],
        [11,10,10,10,10,10,10,10,10,10,10,10,10,10,10,11],
        [11,10,11,10,10,10,10,10,10,10,11,10,10,10,10,11],
        [11,10,9,10,10,10,10,10,10,10,10,10,10,10,10,11],
        [11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11]
      ],
      npcs: [],
      enemies: [
        { type:'bandit',     x:5,  y:3,  patrol:true },
        { type:'void_knight',x:10, y:7,  patrol:false },
        { type:'iron_warlord',x:12,y:5,  isBoss:true }
      ],
      exits: [{ x:2, y:10, targetZone:'world', targetX:14, targetY:-12 }]
    },
    aurum: {
      name:'Aurum Cathedral', kingdom:'solheim', width:16, height:12,
      music:'holy', bgColor:'#F2CD37',
      env: { ambient:'holy', encounterChance:0 },
      tiles: [
        [7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7],
        [7,8,8,8,8,8,8,8,8,8,8,8,8,8,8,7],
        [7,8,7,8,8,8,2,2,8,8,8,7,8,8,8,7],
        [7,8,8,8,6,8,2,2,8,6,8,8,8,8,8,7],
        [7,8,8,8,8,8,2,2,8,8,8,8,8,7,8,7],
        [7,8,7,8,8,2,2,2,2,8,8,7,8,8,8,7],
        [7,8,8,8,8,2,2,2,2,8,8,8,8,8,8,7],
        [7,8,8,8,6,8,2,2,8,6,8,8,8,8,8,7],
        [7,8,7,8,8,8,2,2,8,8,8,7,8,8,8,7],
        [7,8,8,8,8,8,2,2,8,8,8,8,8,8,8,7],
        [7,8,8,8,8,8,9,2,8,8,8,8,8,8,8,7],
        [7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7]
      ],
      npcs: [
        { id:'high_cleric', name:'High Cleric Oren', x:7, y:2, color:'#F2CD37', headColor:'#E4CD9E', dialog:'priest_dialog' },
        { id:'calla',       name:'Calla Vane',       x:11, y:6, color:'#9BA19D', headColor:'#E4CD9E', dialog:'calla_intro', isRomance:true }
      ],
      exits: [{ x:6, y:10, targetZone:'world', targetX:18, targetY:36 }]
    },
    ashenkeep: {
      name:'Ashenkeep', kingdom:'drakmoor', width:16, height:12,
      music:'moor', bgColor:'#3D5C1A',
      env: { ambient:'swamp', encounterChance:0 },
      tiles: [
        [11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11],
        [11,8,8,8,8,8,8,8,8,8,8,8,8,8,8,11],
        [11,8,11,11,8,8,8,8,8,11,11,8,8,8,8,11],
        [11,8,11,8,8,8,2,2,8,11,8,8,12,12,8,11],
        [11,8,11,8,8,2,2,2,2,8,8,8,12,12,8,11],
        [11,8,8,8,2,2,8,8,2,2,8,8,8,8,8,11],
        [11,8,8,2,2,8,8,8,8,2,2,8,8,8,8,11],
        [11,8,12,8,8,8,8,8,8,8,8,8,8,8,8,11],
        [11,8,12,12,8,8,8,8,8,11,11,8,8,8,8,11],
        [11,8,8,8,8,8,8,8,8,8,8,8,8,8,8,11],
        [11,8,8,8,8,8,9,8,8,8,8,8,8,8,8,11],
        [11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11]
      ],
      npcs: [
        { id:'warden',      name:'Warden Maeve',  x:7, y:2, color:'#3D5C1A', dialog:'ashen_warden_dialog' },
        { id:'moor_guard',  name:'Moor Guard',    x:3, y:7, color:'#6C6E68', dialog:'ashen_guard_dialog' }
      ],
      exits: [{ x:6, y:10, targetZone:'world', targetX:-34, targetY:-6 }]
    },
    dune_throne: {
      name:'Dune Throne', kingdom:'veranthos', width:16, height:12,
      music:'desert', bgColor:'#E4CD9E',
      env: { ambient:'desert', encounterChance:0 },
      tiles: [
        [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
        [4,5,5,5,5,5,8,8,8,5,5,5,5,5,5,4],
        [4,5,4,5,5,5,8,8,8,5,5,4,5,5,5,4],
        [4,5,5,5,5,8,8,8,8,8,5,5,5,5,5,4],
        [4,5,5,5,5,8,8,8,8,8,5,5,5,4,5,4],
        [4,5,4,5,2,2,8,8,8,2,2,5,5,5,5,4],
        [4,5,5,2,2,5,2,2,2,5,2,2,5,5,5,4],
        [4,5,5,5,5,5,2,2,2,5,5,5,5,5,5,4],
        [4,5,4,5,5,5,2,2,2,5,4,5,5,5,5,4],
        [4,5,5,5,5,5,2,2,2,5,5,5,5,5,5,4],
        [4,5,5,5,5,5,9,2,5,5,5,5,5,5,5,4],
        [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4]
      ],
      npcs: [
        { id:'vizier',  name:'Vizier Rashan',  x:7, y:2,  color:'#DBA000', headColor:'#E4CD9E', dialog:'dune_vizier_dialog' },
        { id:'avira',   name:'Princess Avira', x:8, y:4,  color:'#237841', dialog:'avira_intro', isRomance:true },
        { id:'zaff',    name:'Zaff the Trader',x:12, y:7, color:'#FE8A18', headColor:'#E4CD9E', dialog:'desert_merchant_dialog', isShop:true }
      ],
      exits: [{ x:6, y:10, targetZone:'world', targetX:46, targetY:28 }]
    },
    bogmire_dungeon: {
      name:'Bogmire Crypts — B1', kingdom:null, width:16, height:12,
      music:'dungeon', bgColor:'#1B2A34',
      env: { ambient:'dungeon', wildTiles:[10], encounterChance:0.02, encounterTable:['moor_soldier','crypt_shade'] },
      tiles: [
        [11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11],
        [11,10,10,10,10,6,6,10,10,10,10,10,10,10,10,11],
        [11,10,11,11,10,6,6,10,10,11,11,10,10,11,10,11],
        [11,10,11,10,10,10,10,10,10,11,10,10,10,11,10,11],
        [11,10,10,10,10,11,10,10,10,10,10,10,10,10,10,11],
        [11,10,10,10,10,11,10,10,11,10,6,6,10,10,10,11],
        [11,10,10,11,10,10,10,10,11,10,6,6,10,10,10,11],
        [11,10,10,11,10,10,10,10,10,10,10,11,10,10,10,11],
        [11,10,10,10,10,10,10,10,10,10,10,10,10,10,10,11],
        [11,10,11,10,10,6,6,10,10,10,11,10,10,10,10,11],
        [11,10,9,10,10,10,10,10,10,10,10,10,10,10,10,11],
        [11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11]
      ],
      npcs: [],
      enemies: [
        { type:'moor_soldier', x:6,  y:3, patrol:true },
        { type:'crypt_shade',  x:10, y:7, patrol:true },
        { type:'bog_horror',   x:13, y:4, isBoss:true }
      ],
      exits: [{ x:2, y:10, targetZone:'world', targetX:-22, targetY:20 }]
    },
    spice_dungeon: {
      name:'Spice Road Tombs — B1', kingdom:null, width:16, height:12,
      music:'dungeon', bgColor:'#1B2A34',
      env: { ambient:'dungeon', wildTiles:[10,5], encounterChance:0.02, encounterTable:['bandit','crypt_shade'] },
      tiles: [
        [11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11],
        [11,10,10,10,5,5,10,10,10,10,10,10,10,10,10,11],
        [11,10,11,11,10,10,10,10,10,11,11,10,10,11,10,11],
        [11,10,11,10,10,10,10,5,10,11,10,10,10,11,10,11],
        [11,10,10,10,10,11,10,5,10,10,10,10,10,10,10,11],
        [11,10,10,10,10,11,10,10,11,10,10,10,10,10,10,11],
        [11,10,10,11,5,10,10,10,11,10,10,11,10,10,10,11],
        [11,10,10,11,5,10,10,10,10,10,10,11,10,10,10,11],
        [11,10,10,10,10,10,10,10,10,10,10,10,10,10,10,11],
        [11,10,11,10,10,10,10,10,10,10,11,10,5,5,10,11],
        [11,10,9,10,10,10,10,10,10,10,10,10,10,10,10,11],
        [11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11]
      ],
      npcs: [],
      enemies: [
        { type:'bandit',        x:5,  y:3, patrol:true },
        { type:'crypt_shade',   x:9,  y:8, patrol:true },
        { type:'tomb_sentinel', x:12, y:4, isBoss:true }
      ],
      exits: [{ x:2, y:10, targetZone:'world', targetX:54, targetY:10 }]
    }
  },

  // ── Dialog Trees ─────────────────────────────────────────────
  DIALOGS: {
    guard_dialog: {
      start: 'g1',
      nodes: {
        g1: { speaker:'Palace Guard', text:"Halt. State your business in Ironhold.", emotion:'stern',
              choices:[
                { text:"I'm here to see the Clan Elder.", next:'g2' },
                { text:"Just passing through.", next:'g3' }
              ]},
        g2: { speaker:'Palace Guard', text:"The Elder is in the training hall. Don't waste his time.", emotion:'neutral', choices:null },
        g3: { speaker:'Palace Guard', text:"Keep to the main road. And don't cause trouble.", emotion:'neutral', choices:null }
      }
    },
    merchant_dialog: {
      start: 'm1',
      nodes: {
        m1: { speaker:'Bram', text:"You've got the look of someone heading north. Don't. Border's been closed three days.", emotion:'concerned',
              choices:[
                { text:"Why?", next:'m2' },
                { text:"I'll take my chances. Show me your wares.", next:'m_shop', action:'open_shop' }
              ]},
        m2: { speaker:'Bram', text:"Kingdom soldiers never tell anyone why. But I hear things... Lights in the Ashwood ruins. Old lights. Wrong color.", emotion:'worried',
              choices:[
                { text:"What kind of lights?", next:'m3' },
                { text:"Let me see your wares.", next:'m_shop', action:'open_shop' }
              ]},
        m3: { speaker:'Bram', text:"Something's waking up out there. Started before your lot showed up, so don't go thinking this is about you.\n\n...It might be about you. I don't actually know.", emotion:'uncertain', choices:null },
        m_shop: { speaker:'Bram', text:"Take a look. Fair prices, for Ironhold.", emotion:'neutral', choices:null, action:'open_shop' }
      }
    },
    elder_varos_dialog: {
      start: 'ev1',
      nodes: {
        ev1: { speaker:'Elder Varos', text:"Again.\n\n[He watches you with arms crossed. The training horn echoes wrong in the distance.]", emotion:'stern',
               choices:[
                { text:"That's not a training signal.", next:'ev2' },
                { text:"What's happening out there?", next:'ev2' }
               ]},
        ev2: { speaker:'Elder Varos', text:"(all warmth gone)\nNo. It isn't.\n\nThe eastern ruins... something old is moving. The Heartstone shards react to it. You need to be ready.", emotion:'grave',
               choices:[
                { text:"I'm ready.", next:'ev3' },
                { text:"What am I up against?", next:'ev4' }
               ]},
        ev3: { speaker:'Elder Varos', text:"The boy doesn't know when to stay down.\n\n(almost a smile)\nNot for us.", emotion:'proud', choices:null },
        ev4: { speaker:'Elder Varos', text:"A sorcerer. A thousand years sleeping. Five shards of the Heartstone. And whatever he's already woken in the ruins.\n\nStart with the Ashwood. Find what stirred there first.", emotion:'grave', choices:null,
               action:'quest_start', questId:'main_quest_1' }
      }
    },
    aelindra_intro: {
      start: 'ae1',
      nodes: {
        ae1: { speaker:'Aelindra Moonveil', text:"I have watched empires dissolve into the earth like morning frost.\n\nI did not expect to find something worth staying for.", emotion:'wonder',
               choices:[
                { text:"How long have you been here?", next:'ae2' },
                { text:"What do you know about the Heartstone?", next:'ae3' }
               ]},
        ae2: { speaker:'Aelindra Moonveil', text:"Three hundred and forty years in this archive. I was young when I arrived.\n\nBy human measure. I am still young by elven measure.\n\n(she pauses)\nIt stopped feeling long ago.", emotion:'nostalgic', choices:null },
        ae3: { speaker:'Aelindra Moonveil', text:"I wrote the first academic treatise on it. In the year your kingdom was still a meadow.\n\nMalachar's return is not a surprise to me. The shards were never truly dormant. Something was always going to wake him.", emotion:'knowing', choices:null,
               action:'romance_meet', lead:'aelindra' }
      }
    },
    sable_reveal: {
      start: 'sr1',
      nodes: {
        sr1: { speaker:'Sable Nighthollow', text:"It was Caeran. The contract came from Caeran.", emotion:'grave',
               choices:[
                { text:"That's not possible. He served my father for—", next:'sr2' }
               ]},
        sr2: { speaker:'Sable Nighthollow', text:"Twenty years. I know. That's why he was trusted. That's why he was useful to them.", emotion:'steady',
               choices:[
                { text:"How long have you known?", next:'sr3' }
               ]},
        sr3: { speaker:'Sable Nighthollow', text:"Since the beginning.", emotion:'vulnerable',
               choices:[
                { text:"Get out.", next:'sr4_reject', flag:'rejected_sable' },
                { text:"Tell me everything.", next:'sr4_hear', flag:'heard_sable_out' },
                { text:"...I need time.", next:'sr4_delay', flag:'delayed_sable' }
               ]},
        sr4_reject:{ speaker:'Kael', text:"Get out.", emotion:'cold', choices:null },
        sr4_hear:  { speaker:'Sable Nighthollow', text:"The contract was real. And then I made a mistake. I decided you mattered more than it. I know that might not mean anything to you. But it's the truest thing I've said to anyone in ten years.", emotion:'raw', choices:null, action:'romance_progress', lead:'sable' },
        sr4_delay: { speaker:'Sable Nighthollow', text:"(she goes. He stares at the map. He doesn't move for a long time.)", emotion:'sad', choices:null }
      }
    },
    kessa_confession: {
      start:'kc1',
      nodes: {
        kc1: { speaker:'Kessa Drumm', text:"Can I say something without you making it weird?", emotion:'nervous',
               choices:[{ text:"When have I ever made anything weird?", next:'kc2' }]},
        kc2: { speaker:'Kessa Drumm', text:"Last month you named the ox Gerald and cried when we sold him.", emotion:'amused',
               choices:[{ text:"Gerald was a good ox.", next:'kc3' }]},
        kc3: { speaker:'Kessa Drumm', text:"I've been meaning to say this for about two years. So I'm just going to say it and you can do whatever you want with it.\n\nI look for you first. In a fight. In a crowd. When something good happens. When something bad happens. I always look for you first. And I don't think that's just because we've been traveling together.", emotion:'honest',
               choices:[{ text:"I know.", next:'kc4' }]},
        kc4: { speaker:'Kessa Drumm', text:"You — what?", emotion:'shocked',
               choices:[{ text:"I know. I just didn't want to say it first in case you didn't feel the same way and then we'd have to fight side by side forever and it would be horrible.", next:'kc5' }]},
        kc5: { speaker:'Kessa Drumm', text:"You absolute coward.", emotion:'laughing',
               choices:[{ text:"We're the same kind of coward.", next:'kc6' }]},
        kc6: { speaker:'Kessa Drumm', text:"...Yeah. We are.", emotion:'tender', choices:null,
               action:'romance_complete', lead:'kessa_drumm' }
      }
    },
    malachar_final: {
      start:'mf1',
      nodes: {
        mf1: { speaker:'Malachar', text:"You came all this way. For what? Five fragments of a broken stone?", emotion:'amused',
               choices:[{ text:"For the people who died because of you.", next:'mf2' }]},
        mf2: { speaker:'Malachar', text:"They were always going to die. I simply gave their deaths a purpose.", emotion:'cold',
               choices:[{ text:"That's what monsters tell themselves.", next:'mf3' }]},
        mf3: { speaker:'Malachar', text:"I was a king once. A good one, they said. I watched my kingdom starve while four others prospered. The Heartstone was meant to unite all five. They used it to divide them.\n\nI am not the villain of this story. I am what happens when good men are broken by systems that reward cruelty.", emotion:'weary',
               choices:[
                { text:"Maybe. But the people you killed weren't the ones who refused you.", next:'mf4' }
               ]},
        mf4: { speaker:'Malachar', text:"(quietly)\nYes. They were.\n\n(He raises his hand. The shards rise.)\n\nShow me what you've become. Then we'll see if one of us deserves to finish this.", emotion:'resolute', choices:null,
               action:'start_boss', enemyId:'malachar' }
      }
    },
    priest_dialog: {
      start:'pd1',
      nodes: {
        pd1: { speaker:'High Cleric Oren', text:"The Cathedral stands because the faithful held the line when kingdoms forgot how.\n\nWhat brings you to Aurum?", emotion:'serene',
               choices:[
                { text:"I'm looking for the Heartstone shard.", next:'pd2' },
                { text:"Tell me about Solheim.", next:'pd3' }
               ]},
        pd2: { speaker:'High Cleric Oren', text:"Then you carry a heavier burden than you look. The shard rests in the Reliquary below... guarded by what the old orders left behind.\n\nI will not stop you. But I will pray for you.", emotion:'grave', choices:null,
               action:'quest_start', questId:'main_quest_2' },
        pd3: { speaker:'High Cleric Oren', text:"Solheim endures. We have outlasted three wars, two famines, and one very determined necromancer.\n\n(beat)\nFour, actually. The fourth retired to a fishing village. We don't discuss that.", emotion:'wry', choices:null }
      }
    },
    calla_intro: {
      start:'ci1',
      nodes: {
        ci1: { speaker:'Calla Vane', text:"Before you say anything — I'm not lost, I'm not in trouble, and I don't need saving.\n\nI'm between contracts. That's different.", emotion:'sharp',
               choices:[
                { text:"What kind of contracts?", next:'ci2' },
                { text:"I wasn't going to offer.", next:'ci3' }
               ]},
        ci2: { speaker:'Calla Vane', text:"The kind that require someone who can fight, negotiate, and disappear.\n\nThe kind you're probably about to offer me.\n\n...What's the job?", emotion:'considering', choices:null,
               action:'romance_meet', lead:'calla_vane' },
        ci3: { speaker:'Calla Vane', text:"(a beat)\nHm.\n\nI might have just insulted someone I don't know anything about. That's not like me.\n\nCalla Vane. What are you after?", emotion:'recalibrating', choices:null,
               action:'romance_meet', lead:'calla_vane' }
      }
    },
    ashen_warden_dialog: {
      start:'aw1',
      nodes: {
        aw1: { speaker:'Warden Maeve', text:"You're not from the Moor. I can tell. Drakmoor mud has a particular weight to it — you're carrying lighter ground.\n\nState your purpose.", emotion:'measured',
               choices:[
                { text:"I'm tracking something that woke in the ruins.", next:'aw2' },
                { text:"Just passing through.", next:'aw3' }
               ]},
        aw2: { speaker:'Warden Maeve', text:"The Bogmire crypts. Something's been disturbing the dead down there.\n\nMy wardens won't go below the first landing. I won't send them — the dead down there died angry. But if you're the type who walks into those places willingly...\n\nWe'd owe you. Drakmoor pays its debts.", emotion:'weighing', choices:null },
        aw3: { speaker:'Warden Maeve', text:"There is no 'through' in the Moor. There is 'in' and 'out'. We keep the out-roads open.\n\nDon't step off the paths. The ground here swallows people who stop paying attention.", emotion:'warning', choices:null }
      }
    },
    ashen_guard_dialog: {
      start:'ag1',
      nodes: {
        ag1: { speaker:'Moor Guard', text:"Southern paths are closed. Something's moving in the bogs.\n\nWarden's orders.", emotion:'stern', choices:null }
      }
    },
    dune_vizier_dialog: {
      start:'dv1',
      nodes: {
        dv1: { speaker:'Vizier Rashan', text:"Veranthos does not receive travelers. It tolerates them.\n\nYou have arrived, which means the Princess permitted it. Whatever she told you — she was testing you. She tests everyone.\n\nYou should assume you are still being tested.", emotion:'smooth',
               choices:[
                { text:"What does she want?", next:'dv2' },
                { text:"And am I passing?", next:'dv3' }
               ]},
        dv2: { speaker:'Vizier Rashan', text:"An alliance that doesn't require Veranthos to sacrifice anything.\n\nShe is the Dune Throne's daughter. She negotiates from the position that the desert can outlast anything.\n\n...She is not wrong.", emotion:'dry', choices:null },
        dv3: { speaker:'Vizier Rashan', text:"(long pause)\n\nI've seen sixty-three alliance seekers in this hall. Forty-one left with nothing. Nineteen left with a contract they later regretted.\n\nThe three who succeeded asked better questions than that.", emotion:'neutral', choices:null }
      }
    },
    avira_intro: {
      start:'av1',
      nodes: {
        av1: { speaker:'Princess Avira', text:"I've read every report on the Heartstone situation. I've spoken to three archivists, two surviving veterans of the last Malachar incident, and one very unhelpful spirit in a jar.\n\nYou're the variable no one accounted for. Interesting.", emotion:'assessing',
               choices:[
                { text:"What do you need from me?", next:'av2' },
                { text:"What did the spirit in the jar say?", next:'av3' }
               ]},
        av2: { speaker:'Princess Avira', text:"Nothing yet. I need to understand what you actually are first.\n\nNot your origin. Not your title. What you do when things go wrong and there's no good option left.\n\nSo. Walk me through the last time that happened.", emotion:'direct', choices:null,
               action:'romance_meet', lead:'avira' },
        av3: { speaker:'Princess Avira', text:"That you were coming. And that you'd ask about the jar.\n\n(she watches you carefully)\n\nIt bothers me more than I expected that it was right.", emotion:'unsettled', choices:null,
               action:'romance_meet', lead:'avira' }
      }
    },
    blacksmith_dialog: {
      start:'bs1',
      nodes: {
        bs1: { speaker:'Harwick', text:"Three sword orders this week. Double the usual. Something's stirring beyond the border.\n\nNeed a blade? I've got steel and time.", emotion:'gruff',
               choices:[
                { text:'Show me your wares.', next:'bs_shop', action:'open_shop' },
                { text:'What kind of stirring?', next:'bs2' }
               ]},
        bs2: { speaker:'Harwick', text:"Scouts came back short two men. The ones who made it back wouldn't say what they saw out east.\n\nThe Elder knows. He's just not telling the rest of us yet.", emotion:'worried',
               choices:[{ text:"Show me your wares.", next:'bs_shop', action:'open_shop' }]},
        bs_shop: { speaker:'Harwick', text:"Fair coin, clean steel. That's all I ask.", emotion:'neutral', choices:null, action:'open_shop' }
      }
    },
    cloth_merchant_dialog: {
      start:'cm1',
      nodes: {
        cm1: { speaker:'Tessa', text:"Silk from the south, wool from the highlands, linen from the river towns — and none of it cheap, because nothing is cheap anymore.\n\nBrowse?", emotion:'bright',
               choices:[
                { text:'Yes, let me see.', next:'cm_shop', action:'open_shop' },
                { text:"Why isn't anything cheap anymore?", next:'cm2' }
               ]},
        cm2: { speaker:'Tessa', text:"Tariffs, mostly. Lord Veth closed two trade roads last month. Everything that used to come overland now pays triple to come around the coast.\n\nAnd the wool farmers are hoarding. Bad winter coming, they say.\n\nI say they say that every year.", emotion:'dry', choices:null },
        cm_shop: { speaker:'Tessa', text:"Take your time. The good fabric is in the back.", emotion:'neutral', choices:null, action:'open_shop' }
      }
    },
    innkeeper_dialog: {
      start:'ri1',
      nodes: {
        ri1: { speaker:'Rodric', text:"Rooms are nine copper a night, meals included. We've got lamb stew tonight — real lamb, not 'lamb'.\n\nYou look like someone who's been on the road too long.", emotion:'warm',
               choices:[
                { text:"I'll take a room.", next:'ri2' },
                { text:'What news have travelers brought?', next:'ri3' }
               ]},
        ri2: { speaker:'Rodric', text:"Good. Room three, end of the hall. Key's on the hook. Dinner's at the sixth bell.\n\nDon't mind the soldier downstairs — he's waiting for orders. Been waiting three days. Buy him a drink, he gets very talkative.", emotion:'conspiratorial', choices:null },
        ri3: { speaker:'Rodric', text:"Merchant from the east said there were lights in the Ashwood again. Hunter from the north said the wolves are moving south earlier than usual.\n\nTraveling priest said the Heartstone relics are waking up.\n\nI said that's three omens for the price of a stew, and offered him a discount.", emotion:'wry', choices:null }
      }
    },
    farmer_dialog: {
      start:'fa1',
      nodes: {
        fa1: { speaker:'Farmer', text:"Grain's late this season. Too much rain in spring, not enough in summer.\n\nStill — not complaining. Could be worse. Could be east of here.", emotion:'tired',
               choices:[
                { text:'What happened east of here?', next:'fa2' },
                { text:'Can I help?', next:'fa3' }
               ]},
        fa2: { speaker:'Farmer', text:"Don't rightly know. But the merchant caravans stopped coming through that way three weeks back. Road's still open, far as anyone can tell.\n\nSomething's just... wrong out there.", emotion:'uneasy', choices:null },
        fa3: { speaker:'Farmer', text:"(a pause)\nYou're not the type who shovels grain.\n\nBut if you ever clear out whatever's making the wolves bold out east, that'd help more than you know.", emotion:'grateful', choices:null }
      }
    },
    desert_merchant_dialog: {
      start:'dm1',
      nodes: {
        dm1: { speaker:'Zaff the Trader', text:"Zaff's wares! Sand-tested, sun-blessed, and only slightly cursed!\n\nThe 'slightly' is very important. What can I get you?", emotion:'cheerful',
               choices:[
                { text:"Show me what you have.", next:'dm_shop', action:'open_shop' },
                { text:"What do you mean 'slightly cursed'?", next:'dm2' }
               ]},
        dm2: { speaker:'Zaff the Trader', text:"The elixirs are fine. The scrolls are fine. The amulet in the blue box — that one I recommend not wearing near water.\n\nBuy the elixirs. Skip the amulet. You'll be great.", emotion:'reassuring', choices:null },
        dm_shop: { speaker:'Zaff the Trader', text:"Excellent taste. Mostly.", emotion:'neutral', choices:null, action:'open_shop' }
      }
    }
  },

  // ── Quests ───────────────────────────────────────────────────
  QUESTS: {
    main_quest_1: {
      id:'main_quest_1', title:'Shadow in the Ashwood',
      description:'Something old has stirred in the Ashwood ruins. Find out what Malachar has awakened there.',
      objectives: [
        { id:'reach_dungeon', text:'Enter the Ashwood Ruins', done:false },
        { id:'defeat_warlord', text:'Defeat the Iron Warlord (Boss)', done:false },
        { id:'claim_shard',   text:'Claim the first Heartstone Fragment', done:false }
      ],
      reward: { xp:500, gold:200, item:'heartstone_fragment' },
      next: 'main_quest_2'
    },
    main_quest_2: {
      id:'main_quest_2', title:'The Five Shards',
      description:'Four more Heartstone fragments remain. The kingdoms grow restless. Find them before Malachar does.',
      objectives:[
        { id:'shards_2_3', text:'Recover shards 2 and 3', done:false },
        { id:'alliance',   text:'Form at least one kingdom alliance', done:false },
        { id:'face_mal',   text:'Confront Malachar in the Obsidian Citadel', done:false }
      ],
      reward: { xp:5000, gold:1000 },
      next: null
    }
  },

  // ── Political Events ─────────────────────────────────────────
  // ── Army Factions ────────────────────────────────────────────
  // Visual data for army formations rendered on the overworld.
  ARMIES: {
    factions: {
      player:   { torsoColor:'#C91A09', legColor:'#1B2A34', headColor:'#F2CD37', banner:'#FFD700', name:'Your Army' },
      valdris:  { torsoColor:'#C91A09', legColor:'#1B2A34', headColor:'#F2CD37', banner:'#C91A09', name:'Valdris Guard' },
      sylvara:  { torsoColor:'#237841', legColor:'#1B3020', headColor:'#90E0A0', banner:'#237841', name:'Sylvara Wardens' },
      solheim:  { torsoColor:'#F2CD37', legColor:'#8B4513', headColor:'#F2CD37', banner:'#DBA000', name:'Solheim Faithful' },
      drakmoor: { torsoColor:'#3D5C1A', legColor:'#1A2A0A', headColor:'#9BA19D', banner:'#3D5C1A', name:'Moor Legion' },
      veranthos:{ torsoColor:'#DBA000', legColor:'#582A12', headColor:'#E4CD9E', banner:'#DBA000', name:'Dune Riders' },
      enemy:    { torsoColor:'#2C2C2C', legColor:'#1A0A0A', headColor:'#C8A87E', banner:'#8B0000', name:'Enemy Forces' }
    },
    MARCH_SPEED: 0.012,  // tiles/frame toward target
    // Grid shape of the rendered formation (cols × rows of minifigures)
    formations: {
      small:  { cols:3, rows:2 },  // < 500
      medium: { cols:5, rows:3 },  // 500-2000
      large:  { cols:7, rows:4 }   // > 2000
    }
  },

  POLITICAL_EVENTS: [
    {
      id:'harvest_failed', title:'The Harvest Failed',
      desc:'Three southern provinces report grain shortages. Winter is coming.',
      availableFor:['noble','prince'],
      options:[
        { text:'Redistribute from royal stores',  effects:{ gold:-800, popularFavor:+15, councilTrust:+10 }, desc:'Cost gold, gain people.' },
        { text:'Open trade with Veranthos',        effects:{ foreignRel:{veranthos:+10, drakmoor:-5}, popularFavor:+20, goldDelayed:+500 }, desc:'Diplomatic solution.' },
        { text:'Do nothing',                       effects:{ popularFavor:-20, armyMorale:-15, revoltChance:0.1 }, desc:'Cheapest. Most dangerous.' },
        { text:'Tax the northern lords',           effects:{ gold:+600, councilTrust:-20, lordHostile:'lord_veth' }, desc:'Gold now, enemies later.' }
      ]
    },
    {
      id:'castle_siege', title:'Enemy Forces at the Gates',
      desc:"A rival lord's army has crossed the border. They march on the capital. Your garrison must hold.",
      availableFor:['noble','prince'],
      options:[
        { text:'Defend the walls — hold position',     effects:{ armyMorale:+10, gold:-300, siegeResult:'defend' },  desc:'Disciplined. Costly supplies.' },
        { text:'Sally forth — charge the enemy line',  effects:{ armyMorale:+20, armySize:-200, siegeResult:'charge' }, desc:'High risk, crushes morale if it works.' },
        { text:'Send for allied reinforcements',       effects:{ foreignRel:{sylvara:+15}, delayTurns:2, siegeResult:'ally' }, desc:'Costs time, but allies share the burden.' },
        { text:'Offer terms — negotiate peace',        effects:{ popularFavor:-10, gold:-500, siegeResult:'peace' }, desc:'Ends it cheapest. Lords will call you weak.' }
      ]
    },
    {
      id:'assassination_attempt', title:'Assassination Attempt',
      desc:"An assassin infiltrates the palace. Someone on the council hired them.",
      availableFor:['noble','prince'],
      options:[
        { text:'Investigate quietly (use spy)',    effects:{ spyAgents:-1, identifyChance:0.7 } },
        { text:'Public accusation',               effects:{ councilTrustRisk:-30, popularFavor:'+20 if right' } },
        { text:'Increase palace guard',           effects:{ gold:-200, preventNext:true } },
        { text:'Fake your own death',             effects:{ intelGain:true, risk:'high', specialEvent:true } }
      ]
    }
  ]

};
