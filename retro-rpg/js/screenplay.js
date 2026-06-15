// ============================================================
//  CHRONICLES OF THE SHATTERED REALM — Cinematic Screenplay
//  A film-script opening: staged cast, spotlighted speakers,
//  branching first choices that ripple into real game state.
//
//  Replaces the old flat one-screen prologue. Each origin gets
//  a bespoke scene (slug line, action beats, character cues,
//  parentheticals) and ends on a fork whose "Ripple Engine"
//  consequences are applied to the player before the world loads.
// ============================================================

var SCREENPLAY = (function() {

  var CHAR_DELAY = 16;           // ms per character (typewriter)

  var state = null;
  var onDone = null;             // callback({ route, combat, zone, x, y })

  // ── Atmosphere particles (rain / embers / motes / void) ────
  var motes = [];
  function seedMotes(kind, w, h) {
    motes = [];
    var n = (kind === 'rain') ? 90 : (kind === 'void' ? 50 : 40);
    for (var i = 0; i < n; i++) {
      motes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        v: kind === 'rain' ? (5 + Math.random() * 4)
          : kind === 'embers' ? -(0.4 + Math.random() * 0.9)
          : (Math.random() - 0.5) * 0.5,
        drift: (Math.random() - 0.5) * 1.5,
        size: kind === 'rain' ? (6 + Math.random() * 6) : (1 + Math.random() * 2),
        kind: kind
      });
    }
  }
  function drawMotes(ctx, w, h) {
    for (var i = 0; i < motes.length; i++) {
      var m = motes[i];
      if (m.kind === 'rain') {
        m.y += m.v; m.x += m.drift * 0.3;
        if (m.y > h) { m.y = -10; m.x = Math.random() * w; }
        ctx.strokeStyle = 'rgba(150,180,210,0.30)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + m.drift, m.y + m.size); ctx.stroke();
      } else if (m.kind === 'embers') {
        m.y += m.v; m.x += Math.sin(m.y * 0.05) * 0.4;
        if (m.y < 0) { m.y = h + 10; m.x = Math.random() * w; }
        ctx.fillStyle = 'rgba(254,138,24,' + (0.4 + Math.random() * 0.3) + ')';
        ctx.fillRect(m.x, m.y, m.size, m.size);
      } else { // motes / void
        m.y += m.v; m.x += m.drift * 0.2;
        if (m.y < 0) m.y = h; if (m.y > h) m.y = 0;
        ctx.fillStyle = m.kind === 'void'
          ? 'rgba(129,0,123,' + (0.3 + Math.random() * 0.4) + ')'
          : 'rgba(255,240,180,0.25)';
        ctx.fillRect(m.x, m.y, m.size, m.size);
      }
    }
  }

  // ── Player figure options for the stage ────────────────────
  function playerFig() {
    var p = PLAYER.get();
    return {
      torsoColor: p.torsoColor, legColor: p.legColor, headColor: p.headColor,
      weapon: p.weapon, hat: p.hat
    };
  }

  // ── Scene library ──────────────────────────────────────────
  // beat kinds:
  //   { action: '...' }                 stage direction (italic, centred)
  //   { sfx: '...' }                    sound caption
  //   { who:'Kaelen', paren:'(...)', line:'...', emo:'angry' }
  // The `who` value must match a cast member's `name` (or 'You').
  function buildScenes() {
    var p = PLAYER.get();
    var YOU = p.name;

    return {

      // ════════════════════════════════════════════════════════
      //  PRINCE — "The Muddy Crown"  (war camp, grand strategy)
      // ════════════════════════════════════════════════════════
      prince: {
        slug: 'INT. COMMAND TENT — NIGHT',
        sub: 'A border siege. The capital has fallen silent.',
        bg: '#0B0E18', tint: 'rgba(40,30,60,0.35)', weather: 'rain',
        cast: [
          { name: 'Kaelen', x: 0.20, t: '#6C6E68', l: '#1B2A34', h: '#E4CD9E', w: 'sword', emo: 'stern' },
          { name: 'Messenger', x: 0.50, t: '#582A12', l: '#1B2A34', h: '#E4CD9E', emo: 'sad' },
          { name: 'Varis', x: 0.80, t: '#81007B', l: '#6C6E68', h: '#E4CD9E', emo: 'neutral' },
          { name: YOU, x: 0.50, y: 0.92, self: true, hidden: true }
        ],
        beats: [
          { action: 'Rain hammers the canvas. A single oil lantern gutters over a war-map soaked black at the edges. Your armour is caked in mud.' },
          { who: 'Messenger', paren: '(trembling, black with soot)', line: 'It\'s true, Highness. The King walked into the undercroft — and the sky tore open above the capital. A storm of black swallowed it whole. Nothing goes in. Nothing comes out.', emo: 'sad' },
          { who: 'Varis', paren: '(pacing, silk ruined by mud)', line: 'The capital — the treasury — my estates, all of it? We are sitting in a swamp with two weeks of grain and an army of frightened peasants. I am taking my guard and riding for Khar-Zad before dawn.', emo: 'neutral' },
          { who: 'Kaelen', paren: '(fist on the table)', line: 'You\'ll do no such thing, Varis. Disband now and the men turn bandit by morning. Highness — Oakhaven\'s border fort is five miles out and lightly held. Give the order. We march tonight and take their walls and their grain.', emo: 'angry' },
          { who: 'Varis', line: 'That is open war on Oakhaven! You would have us bleed on two fronts while a Void storm eats our home!', emo: 'angry' },
          { sfx: 'Kaelen drives his dagger through the map — straight into the Oakhaven fort.' },
          { who: 'Kaelen', line: 'Better to hang as conquerors next month than starve in the mud tonight. The men are terrified, Highness. They need a King. Tell us what to do.', emo: 'stern' }
        ],
        prompt: 'You are crowned Regent in a muddy war camp. Speak.',
        choices: [
          {
            tag: 'TYRANT',
            line: 'Lord Varis, desertion is treason. Kaelen — execute him. His guard is yours now. We take the fort tonight.',
            ripple: 'Varis is dragged screaming from the tent. You rule by fear now. The army loves you for it.',
            synth: [
              { l: 'Noble Loyalty', v: '−45', good: false },
              { l: 'Army Morale', v: '+50', good: true },
              { l: 'Treasury (Varis\' gold)', v: '+2000', good: true }
            ],
            apply: function(p) {
              p.councilTrust = Math.max(0, (p.councilTrust || 70) - 45);
              p.armyMorale = Math.min(120, (p.armyMorale || 70) + 50);
              p.treasury = (p.treasury || 0) + 2000;
              PLAYER.setFlag('path_tyrant', true);
              PLAYER.setFlag('varis_executed', true);
            },
            route: { type: 'combat', who: 'Oakhaven Garrison', enemies: ['moor_soldier'] }
          },
          {
            tag: 'DIPLOMAT',
            line: 'Stand down, both of you. Varis — run, and the Khar-Zad merchants bleed you dry. Stay, fund this siege, and I name you Chancellor of the new capital.',
            ripple: 'Varis smirks and agrees. Kaelen looks at you with open disgust. The nobles are yours; the soldiers, less so.',
            synth: [
              { l: 'Noble Loyalty', v: '+30', good: true },
              { l: 'Army Morale', v: '−10', good: false },
              { l: 'Council Trust', v: '+15', good: true }
            ],
            apply: function(p) {
              p.councilTrust = Math.min(100, (p.councilTrust || 70) + 15);
              p.popularFavor = Math.min(100, (p.popularFavor || 60) + 10);
              p.armyMorale = Math.max(40, (p.armyMorale || 70) - 10);
              PLAYER.setFlag('path_diplomat', true);
              PLAYER.setFlag('varis_chancellor', true);
            },
            route: { type: 'combat', who: 'Oakhaven Garrison', enemies: ['moor_soldier', 'bandit'] }
          },
          {
            tag: 'VANGUARD',
            line: 'We don\'t need the whole army for one fort. Kaelen — five of your best. I\'ll go over the wall myself and open the gates from the inside.',
            ripple: 'Both advisors are stunned. A Regent does not lead the infiltration. You do.',
            synth: [
              { l: 'Rations conserved', v: '+500', good: true },
              { l: 'Army Morale', v: '+5', good: true },
              { l: 'Risk', v: 'HIGH', good: false }
            ],
            apply: function(p) {
              p.armyMorale = Math.min(120, (p.armyMorale || 70) + 5);
              PLAYER.addItem('stamina_draft', 2);
              PLAYER.addItem('health_potion', 1);
              PLAYER.setFlag('path_vanguard', true);
            },
            route: { type: 'combat', who: 'Fort Commander', enemies: ['moor_soldier'] }
          },
          {
            tag: 'BLOOD',
            requires: function(p) { return !!p.bloodPower; },
            line: 'The capital fell because my father was weak. I am not. [Release your aura]',
            ripple: 'The lantern shatters. The air turns to lead. Varis drops to his knees gasping; Kaelen bows his head in awe. Oakhaven will see this from its walls — and open its gates.',
            synth: [
              { l: 'All Loyalties (fear)', v: 'LOCKED 100', good: true },
              { l: 'Bloodline Skill', v: 'UNLOCKED', good: true },
              { l: 'Oakhaven Fort', v: 'TAKEN INTACT', good: true }
            ],
            apply: function(p) {
              p.councilTrust = 100; p.popularFavor = 100; p.armyMorale = 100;
              p.ironWillActive = true;
              if (p.skills.indexOf('sovereign_strike') === -1) p.skills.push('sovereign_strike');
              PLAYER.setFlag('path_blood', true);
              PLAYER.setFlag('blood_awakened', true);
              PLAYER.setFlag('oakhaven_taken', true);
            },
            route: { type: 'world' }
          }
        ]
      },

      // ════════════════════════════════════════════════════════
      //  COMMONER — "The Penal Legion"  (grid combat, survival)
      // ════════════════════════════════════════════════════════
      commoner: {
        slug: 'INT. THE ANCIENT MINE (MALACHAR RUIN) — PITCH BLACK',
        sub: 'Conscripted. Sent in as bait. Buried alive.',
        bg: '#080610', tint: 'rgba(70,0,80,0.30)', weather: 'void',
        cast: [
          { name: 'Brant', x: 0.22, t: '#3A3A3A', l: '#1B2A34', h: '#9BA19D', w: 'sword', emo: 'angry' },
          { name: 'Elara', x: 0.55, t: '#582A12', l: '#1B2A34', h: '#E4CD9E', emo: 'sad' },
          { name: YOU, x: 0.78, y: 0.92, self: true, hidden: true }
        ],
        beats: [
          { action: 'The roar of falling rock finally stops. Choking dust. The only light is an eerie purple glow bleeding from cracked stone. You are buried to the waist in rubble. Three conscripts lie dead beneath the cave-in.' },
          { who: 'Brant', paren: '(spitting dust, kicking free)', line: 'On your feet, scum! The ceiling gave out — we\'re cut off from the vanguard. Strip the dead of their rations and form a line!', emo: 'angry' },
          { who: 'Elara', paren: '(pointing at the glowing walls)', line: 'Sergeant — this was never an iron mine. Look at the masonry. The purple light. Those are the Old Runes. They sent us into a Malachar tomb.', emo: 'sad' },
          { sfx: 'From the dark tunnel: the scrape of stone on bone. A VOID-CRAWLER drags itself into the light — fused rock and corrupted flesh, too many limbs. It screeches.' },
          { who: 'Brant', paren: '(drawing his broadsword)', line: 'Shields front! You — take the girl and draw it left. I\'ll flank right. If it eats you, choke it on the way down.', emo: 'stern' }
        ],
        prompt: 'The thing is between you and the only way out. Move.',
        choices: [
          {
            tag: 'SOLDIER',
            line: 'Yes, Sergeant! [Draw your rusted blade and charge left to pull its eyes off Brant]',
            ripple: 'You obey the chain of command. Brant respects discipline. You take the front tile — and the first hit.',
            synth: [
              { l: 'Trait', v: '"DISCIPLINED" +2 DEF near ally', good: true },
              { l: 'Brant', v: 'survives — your CO', good: true }
            ],
            apply: function(p) {
              p.baseStats.def += 2;
              PLAYER.recalcStats();
              PLAYER.setFlag('trait_disciplined', true);
              PLAYER.setFlag('brant_alive', true);
              PLAYER.setFlag('path_soldier', true);
            },
            route: { type: 'combat', who: 'Void-Crawler', enemies: ['crypt_shade'] }
          },
          {
            tag: 'PROTECTOR',
            line: 'Elara\'s hurt — I\'m holding the chokepoint right here! [Topple a stone pillar into a barricade]',
            ripple: 'You defy the order to save a life. Brant is forced front-and-centre and takes a wound for it — but the conscripts will remember who covered them.',
            synth: [
              { l: 'Elara', v: 'JOINS — first companion', good: true },
              { l: 'Mercenary recruiting', v: 'easier', good: true },
              { l: 'Brant', v: 'wounded, resentful', good: false }
            ],
            apply: function(p) {
              PLAYER.setFlag('companion_elara', true);
              PLAYER.setFlag('brant_wounded', true);
              PLAYER.setFlag('path_protector', true);
              PLAYER.addItem('health_potion', 1);
            },
            route: { type: 'combat', who: 'Void-Crawler', enemies: ['crypt_shade'] }
          },
          {
            tag: 'SCAVENGER',
            line: '[Ignore Brant. Tear a volatile Void-crystal from the rubble and hurl it at the ceiling above the beast]',
            ripple: 'The roof comes down and crushes the Crawler instantly — but the crystal\'s fallout washes over you. Something cold takes root in your chest.',
            synth: [
              { l: 'Combat', v: 'SKIPPED — beast crushed', good: true },
              { l: 'Corruption Meter', v: 'ACTIVE at 5%', good: false },
              { l: 'Dark Skill', v: 'UNLOCKED (Void Strike)', good: true },
              { l: 'You & the squad', v: 'hunted as deserters', good: false }
            ],
            apply: function(p) {
              p.corruption = 5;
              if (p.skills.indexOf('arcane_bolt') === -1) p.skills.push('arcane_bolt');
              PLAYER.addItem('dark_shard', 1);
              PLAYER.setFlag('corruption_active', true);
              PLAYER.setFlag('path_scavenger', true);
            },
            route: { type: 'world' }
          },
          {
            tag: 'RUTHLESS',
            requires: function(p) { return p.baseStats.agi >= 13; },
            line: '[Wait for the beast to lunge at Brant — then bury your dagger in his back and take his plate]',
            ripple: 'Pure survival. Brant\'s armour is your only ticket out. Elara watches in horror and flees into the dark. You emerge alone, armoured, and branded a murderer.',
            synth: [
              { l: 'Sergeant\'s Plate', v: 'EQUIPPED (+6 DEF)', good: true },
              { l: 'Elara', v: 'flees — future rival', good: false },
              { l: 'Reputation', v: 'MURDERER', good: false }
            ],
            apply: function(p) {
              PLAYER.addItem('iron_plate', 1);
              p.equipment.armor = 'iron_plate';
              PLAYER.recalcStats();
              PLAYER.setFlag('brant_murdered', true);
              PLAYER.setFlag('elara_rival', true);
              PLAYER.setFlag('path_ruthless', true);
            },
            route: { type: 'combat', who: 'Void-Crawler', enemies: ['crypt_shade'] }
          }
        ]
      },

      // ════════════════════════════════════════════════════════
      //  MAGE — "The Shattered Ritual"  (lore, magic, secrets)
      // ════════════════════════════════════════════════════════
      mage_clan: {
        slug: 'INT. THE CITADEL — SANCTUM OF SEALS — PRE-DAWN',
        sub: 'A secret ritual to close a Void Crack. It was sabotaged.',
        bg: '#070A16', tint: 'rgba(0,40,90,0.30)', weather: 'motes',
        cast: [
          { name: 'Archmage Veyl', x: 0.28, t: '#0055BF', l: '#003366', h: '#E4CD9E', w: 'staff', emo: 'grave' },
          { name: 'Inquisitor', x: 0.78, t: '#DBA000', l: '#9BA19D', h: '#E4CD9E', emo: 'stern' },
          { name: YOU, x: 0.52, y: 0.92, self: true, hidden: true }
        ],
        beats: [
          { action: 'Concentric seal-rings of light turn slowly above the floor. Your master, Archmage Veyl, weaves the binding while you hold the anchor-rune steady. A hairline crack of pure black hangs in the air between you.' },
          { who: 'Archmage Veyl', paren: '(without looking up)', line: 'Hold the third matrix, acolyte. Entropy does not negotiate — it only waits. One slip and it takes everything we are.', emo: 'grave' },
          { sfx: 'A second sigil — one you did not draw — flares red beneath the floor. The anchor-rune cracks. The seal-rings shriek and reverse.' },
          { who: 'Archmage Veyl', paren: '(as the light turns on him)', line: 'Sabotage — get BACK—', emo: 'angry' },
          { action: 'The blast takes the Archmage apart. A shard of the Void buries itself in your chest, cold as a second heartbeat. Bootsteps in the corridor — the Inquisition, already coming.' },
          { who: 'Inquisitor', paren: '(from the doorway)', line: 'The acolyte stands over the master\'s body. Seize them. By dawn the Citadel will have its arsonist.', emo: 'stern' }
        ],
        prompt: 'A shard of the Void is lodged in your chest. The Inquisition is at the door.',
        choices: [
          {
            tag: 'FLEE',
            line: '[Snatch the master\'s grimoire and go out the high window — vanish before they cross the room]',
            ripple: 'You take the stairs three at a time with a ticking bomb in your chest and a stolen book under your arm. Off the grid, hunted, alive.',
            synth: [
              { l: 'Corruption Meter', v: 'ACTIVE at 8%', good: false },
              { l: 'Veyl\'s Grimoire', v: 'STOLEN', good: true },
              { l: 'Citadel', v: 'HUNTING YOU', good: false }
            ],
            apply: function(p) {
              p.corruption = 8;
              PLAYER.addItem('spell_scroll', 1);
              PLAYER.addItem('dark_shard', 1);
              PLAYER.setFlag('corruption_active', true);
              PLAYER.setFlag('grimoire_stolen', true);
              PLAYER.setFlag('path_fugitive', true);
            },
            route: { type: 'world' }
          },
          {
            tag: 'CHANNEL',
            line: 'You did this. [Reach into the dying seal and turn the shard\'s hunger outward — at the Inquisitor]',
            ripple: 'For one heartbeat you let the Void speak through you. It is intoxicating, and it costs you. The Inquisitor draws steel.',
            synth: [
              { l: 'Corruption Meter', v: 'ACTIVE at 15%', good: false },
              { l: 'Dark Skill', v: 'UNLOCKED (Void Bolt)', good: true },
              { l: 'A witness', v: 'must be silenced', good: false }
            ],
            apply: function(p) {
              p.corruption = 15;
              if (p.skills.indexOf('arcane_bolt') === -1) p.skills.push('arcane_bolt');
              PLAYER.setFlag('corruption_active', true);
              PLAYER.setFlag('path_embrace', true);
            },
            route: { type: 'combat', who: 'Citadel Inquisitor', enemies: ['forest_mage'] }
          },
          {
            tag: 'SURRENDER',
            line: 'I didn\'t do this — and I can prove who did. [Lower your hands and let them take you]',
            ripple: 'A dangerous gamble. You keep the moral high ground and one ally inside the Citadel — but the shard goes untreated, and a cell is a cell.',
            synth: [
              { l: 'Corruption Meter', v: 'ACTIVE at 5%', good: false },
              { l: 'Inside ally', v: 'GAINED', good: true },
              { l: 'Freedom', v: 'LOST (for now)', good: false }
            ],
            apply: function(p) {
              p.corruption = 5;
              PLAYER.setFlag('corruption_active', true);
              PLAYER.setFlag('citadel_ally', true);
              PLAYER.setFlag('path_innocent', true);
            },
            route: { type: 'world' }
          }
        ]
      },

      // ── PRIEST — Shattered Ritual (devotional variant) ───────
      priest: {
        slug: 'INT. THE CITADEL — CHAPEL OF THE LAST LIGHT — PRE-DAWN',
        sub: 'You held the censer while the High Priest sealed the Crack.',
        bg: '#0A0A12', tint: 'rgba(120,90,0,0.22)', weather: 'motes',
        cast: [
          { name: 'High Priest', x: 0.28, t: '#DBA000', l: '#9BA19D', h: '#E4CD9E', w: 'staff', emo: 'grave' },
          { name: 'Inquisitor', x: 0.78, t: '#DBA000', l: '#9BA19D', h: '#E4CD9E', emo: 'stern' },
          { name: YOU, x: 0.52, y: 0.92, self: true, hidden: true }
        ],
        beats: [
          { action: 'Candlelight and incense. The High Priest sings the Rite of Closing over a Void Crack no wider than a wound. You hold the censer and the prayer steady, voice trembling.' },
          { who: 'High Priest', paren: '(between verses)', line: 'Faith is the only wall that holds against the dark, child. Keep the flame between us and it. Do not look into the Crack.', emo: 'grave' },
          { sfx: 'A profane sigil ignites under the altar cloth. The Rite curdles. Holy light turns black and folds inward.' },
          { action: 'The blast unmakes the High Priest where he stands. A splinter of Void lodges in your chest — a cold star burning beneath your faith. The chapel doors boom open.' },
          { who: 'Inquisitor', line: 'Heresy at the altar, and the acolyte left breathing. Take them. The Light will have its confession.', emo: 'stern' }
        ],
        prompt: 'A shard of the Void burns where your faith used to sit. The Inquisition has come.',
        choices: [
          {
            tag: 'FLEE',
            line: '[Take the High Priest\'s reliquary and slip out through the crypt before the doors finish opening]',
            ripple: 'You run with a holy relic and an unholy splinter, both buried in your chest. The order that raised you now wants you dead.',
            synth: [
              { l: 'Corruption Meter', v: 'ACTIVE at 6%', good: false },
              { l: 'Sacred Reliquary', v: 'TAKEN', good: true },
              { l: 'The Order', v: 'HUNTING YOU', good: false }
            ],
            apply: function(p) {
              p.corruption = 6;
              PLAYER.addItem('mana_potion', 1);
              PLAYER.addItem('dark_shard', 1);
              PLAYER.setFlag('corruption_active', true);
              PLAYER.setFlag('reliquary_taken', true);
              PLAYER.setFlag('path_fugitive', true);
            },
            route: { type: 'world' }
          },
          {
            tag: 'SMITE',
            line: 'The Light is not yours to wield against me. [Pour the shard\'s cold through a final, furious prayer]',
            ripple: 'Divine fire and Void frost braid together in your hands. It works. It should not work. The Inquisitor recoils — and attacks.',
            synth: [
              { l: 'Corruption Meter', v: 'ACTIVE at 12%', good: false },
              { l: 'Skill', v: 'UNLOCKED (Divine Smite)', good: true },
              { l: 'A witness', v: 'must be silenced', good: false }
            ],
            apply: function(p) {
              p.corruption = 12;
              if (p.skills.indexOf('divine_smite') === -1) p.skills.push('divine_smite');
              PLAYER.setFlag('corruption_active', true);
              PLAYER.setFlag('path_zealot', true);
            },
            route: { type: 'combat', who: 'Citadel Inquisitor', enemies: ['forest_mage'] }
          },
          {
            tag: 'CONFESS',
            line: 'I am no heretic — and I will name the one who is. [Kneel, hands open, and submit to judgement]',
            ripple: 'You wager your innocence against their certainty. It buys you a friend inside the walls — and a cold cell to think in.',
            synth: [
              { l: 'Corruption Meter', v: 'ACTIVE at 4%', good: false },
              { l: 'Inside ally', v: 'GAINED', good: true },
              { l: 'Freedom', v: 'LOST (for now)', good: false }
            ],
            apply: function(p) {
              p.corruption = 4;
              PLAYER.setFlag('corruption_active', true);
              PLAYER.setFlag('citadel_ally', true);
              PLAYER.setFlag('path_innocent', true);
            },
            route: { type: 'world' }
          }
        ]
      },

      // ── SWORD CLAN — "The Wrong Horn" (Valdris muster) ───────
      sword_clan: {
        slug: 'EXT. THE HIGHLAND CLIFFS OF VALDRIS — DAWN',
        sub: 'A sparring morning that becomes the first day of the war.',
        bg: '#0C1018', tint: 'rgba(60,30,20,0.22)', weather: 'motes',
        cast: [
          { name: 'Elder Varos', x: 0.26, t: '#6C6E68', l: '#1B2A34', h: '#E4CD9E', emo: 'grave' },
          { name: 'Runner', x: 0.74, t: '#C91A09', l: '#720E0E', h: '#E4CD9E', emo: 'sad' },
          { name: YOU, x: 0.50, y: 0.92, self: true, hidden: true }
        ],
        beats: [
          { action: 'Two blades ring on the cliff-edge at first light — fast, honest, real. You break your guard only because a horn sounds below. The wrong horn. Not the muster call. The alarm.' },
          { who: 'Elder Varos', paren: '(lowering his practice blade)', line: 'That is no drill, blood of the Sword Clan. That note is only ever sounded for one of two reasons — and the King is not dead. Which means the east has finally come for us.', emo: 'grave' },
          { sfx: 'A clan runner scrambles up the goat-path, bleeding from a torn shoulder.' },
          { who: 'Runner', paren: '(gasping)', line: 'The watchtower at Greyfang — gone. Not burned. GONE. The stone is just... unmade. And the things that did it are coming up the pass behind me.', emo: 'sad' }
        ],
        prompt: 'The clan looks to your blade. Answer the horn.',
        choices: [
          {
            tag: 'CHARGE',
            line: 'Then we meet them in the pass where the walls are narrow. Varos — sound the muster. I take the first line.',
            ripple: 'No clan-leader leads from the rear. You build momentum the only honest way — at the front of the charge.',
            synth: [
              { l: 'Momentum', v: 'starts +25', good: true },
              { l: 'Clan respect', v: 'EARNED', good: true }
            ],
            apply: function(p) {
              p.momentum = 25;
              PLAYER.setFlag('clan_vanguard', true);
              PLAYER.setFlag('path_warrior', true);
            },
            route: { type: 'combat', who: 'Void-Touched Beast', enemies: ['highland_wolf', 'bandit'] }
          },
          {
            tag: 'HOLD',
            line: 'No. We hold the high ground and let the pass funnel them. Varos — archers to the ridge, shields below.',
            ripple: 'Patience over pride. The Elder nods, surprised. You spend the first blood carefully — and keep more of the clan alive.',
            synth: [
              { l: 'Defensive footing', v: '+2 DEF', good: true },
              { l: 'Clan losses', v: 'minimised', good: true }
            ],
            apply: function(p) {
              p.baseStats.def += 2; PLAYER.recalcStats();
              PLAYER.setFlag('clan_tactician', true);
              PLAYER.setFlag('path_warrior', true);
            },
            route: { type: 'combat', who: 'Void-Touched Beast', enemies: ['highland_wolf'] }
          }
        ]
      },

      // ── NOBLE — "The Poisoned Chalice" (Drakmoor shadow-war) ─
      noble: {
        slug: 'INT. ASHENKEEP — THE LOW HALL — MIDNIGHT',
        sub: 'A House dinner. Half the guests want you dead.',
        bg: '#0A0B10', tint: 'rgba(60,20,70,0.26)', weather: 'motes',
        cast: [
          { name: 'Steward Coll', x: 0.26, t: '#6C6E68', l: '#1B2A34', h: '#E4CD9E', emo: 'stern' },
          { name: 'Lady Sereth', x: 0.78, t: '#81007B', l: '#6C6E68', h: '#E4CD9E', emo: 'neutral' },
          { name: YOU, x: 0.52, y: 0.92, self: true, hidden: true }
        ],
        beats: [
          { action: 'Fog presses at the leaded windows of Ashenkeep. Your House sits to dinner with three rival Houses smiling across the salt. Under the table, every hand is near a knife.' },
          { who: 'Lady Sereth', paren: '(raising her cup to you)', line: 'To the young heir. Your father\'s seat is barely cold, and already you wear his ring so... boldly. Drink with us. Show the table there\'s no bad blood.', emo: 'neutral' },
          { sfx: 'Steward Coll leans to your ear, voice no louder than a candle-hiss.' },
          { who: 'Steward Coll', paren: '(whispering)', line: 'My lord — the cup is wrong. The wax seal on Sereth\'s flask was broken and re-set. If you drink, you may not see the dawn. If you refuse, you call a great House a poisoner before witnesses.', emo: 'stern' }
        ],
        prompt: 'The cup is at your lips and the whole hall is watching.',
        choices: [
          {
            tag: 'EXPOSE',
            line: 'A curious vintage, Lady Sereth — let your own taster drink first. Coll, fetch him. Now.',
            ripple: 'You turn the poison back on the table without spilling a drop of blood. Sereth\'s smile dies. The other Houses see who holds the room.',
            synth: [
              { l: 'Council Trust', v: '+20', good: true },
              { l: 'House Sereth', v: 'humiliated, hostile', good: false },
              { l: 'Authority', v: 'starts +30', good: true }
            ],
            apply: function(p) {
              p.councilTrust = Math.min(100, (p.councilTrust || 50) + 20);
              p.authorityB = 30;
              if (p.foreignRel) p.foreignRel.drakmoor = Math.max(0, (p.foreignRel.drakmoor || 30) - 15);
              PLAYER.setFlag('sereth_enemy', true);
              PLAYER.setFlag('path_intriguer', true);
            },
            route: { type: 'world' }
          },
          {
            tag: 'STRIKE',
            line: '[Set the cup down, draw, and put your blade through the flask — and the hand that poured it]',
            ripple: 'You answer poison with steel in front of every House in the bog. It is a declaration of war — and no one at this table will ever underestimate you again.',
            synth: [
              { l: 'Army Morale', v: '+15', good: true },
              { l: 'Three Houses', v: 'now at war', good: false },
              { l: 'Reputation', v: 'FEARED', good: true }
            ],
            apply: function(p) {
              p.armyMorale = Math.min(120, (p.armyMorale || 70) + 15);
              if (p.foreignRel) p.foreignRel.drakmoor = Math.max(0, (p.foreignRel.drakmoor || 30) - 25);
              PLAYER.setFlag('houses_war', true);
              PLAYER.setFlag('path_tyrant', true);
            },
            route: { type: 'combat', who: 'Sereth\'s Guard', enemies: ['moor_soldier'] }
          },
          {
            tag: 'DRINK',
            line: 'You honour my House, Lady Sereth. [Drink — but palm Coll\'s antidote as you raise the cup]',
            ripple: 'You gamble your life on a steward\'s sleight of hand and win the whole table\'s respect. Sereth cannot understand why you still breathe — and that doubt is worth more than any guard.',
            synth: [
              { l: 'Council Trust', v: '+30', good: true },
              { l: 'Popular Favor', v: '+15', good: true },
              { l: 'Health', v: 'shaken (−15% HP)', good: false }
            ],
            apply: function(p) {
              p.councilTrust = Math.min(100, (p.councilTrust || 50) + 30);
              p.popularFavor = Math.min(100, (p.popularFavor || 40) + 15);
              p.hp = Math.max(1, Math.floor(p.maxHp * 0.85));
              PLAYER.setFlag('sereth_baffled', true);
              PLAYER.setFlag('path_diplomat', true);
            },
            route: { type: 'world' }
          }
        ]
      }

    };
  }

  // ── Start ──────────────────────────────────────────────────
  function start(origin, callback) {
    var scenes = buildScenes();
    var scene = scenes[origin] || scenes.commoner;
    onDone = callback;

    seedMotes(scene.weather, 800, 560);

    // Stage cast: resolve player self-figure colours, x→px
    var W = 800;
    var cast = scene.cast.map(function(c) {
      var fig = c.self ? playerFig() : { torsoColor: c.t, legColor: c.l, headColor: c.h, weapon: c.w, hat: c.hat };
      return {
        name: c.name, fig: fig, baseEmo: c.emo || 'neutral',
        px: c.x * W, py: (c.y || 0.55) * 560, hidden: !!c.hidden, self: !!c.self
      };
    });

    // Filter choices by requirement
    var p = PLAYER.get();
    var choices = scene.choices.filter(function(ch) {
      return !ch.requires || ch.requires(p);
    });

    state = {
      scene: scene,
      cast: cast,
      choices: choices,
      beatIdx: 0,
      phase: 'beat',                       // beat | choices | resolve
      full: '', shown: '', charIdx: 0, timer: 0, textDone: false,
      sel: 0,
      chosen: null
    };
    loadBeat();
    return state;
  }

  function curBeat() { return state.scene.beats[state.beatIdx]; }

  function loadBeat() {
    var b = curBeat();
    var txt = b.action || b.sfx || b.line || '';
    state.full = txt;
    state.shown = '';
    state.charIdx = 0;
    state.timer = 0;
    state.textDone = false;
  }

  // ── Update (typewriter) ────────────────────────────────────
  function update(dt) {
    if (!state) return;
    if (state.phase === 'beat' && !state.textDone) {
      state.timer += dt;
      while (state.timer >= CHAR_DELAY && state.charIdx < state.full.length) {
        state.shown += state.full[state.charIdx++];
        state.timer -= CHAR_DELAY;
      }
      if (state.charIdx >= state.full.length) state.textDone = true;
    }
  }

  // ── Input ──────────────────────────────────────────────────
  function handleInput() {
    if (!state) return;

    if (state.phase === 'beat') {
      if (ENGINE.action('confirm') || ENGINE.wasClicked()) {
        if (!state.textDone) {           // first press: finish the line
          state.shown = state.full;
          state.charIdx = state.full.length;
          state.textDone = true;
          return;
        }
        // advance to next beat or open the fork
        if (state.beatIdx < state.scene.beats.length - 1) {
          state.beatIdx++;
          loadBeat();
        } else {
          state.phase = 'choices';
          state.sel = 0;
        }
      }
      return;
    }

    if (state.phase === 'choices') {
      var n = state.choices.length;
      if (ENGINE.action('up'))   state.sel = (state.sel - 1 + n) % n;
      if (ENGINE.action('down')) state.sel = (state.sel + 1) % n;

      // hover selects
      var cardY = cardTop(n);
      for (var i = 0; i < n; i++) {
        var cy = cardY + i * cardH(n);
        if (ENGINE.didMouseMove() && ENGINE.isButtonHovered(60, cy, 680, cardH(n) - 8)) state.sel = i;
        if (ENGINE.isButtonClicked(60, cy, 680, cardH(n) - 8)) { pick(i); return; }
        if (ENGINE.isKeyJust('Digit' + (i + 1))) { pick(i); return; }
      }
      if (ENGINE.action('confirm')) pick(state.sel);
      return;
    }

    if (state.phase === 'resolve') {
      if (ENGINE.action('confirm') || ENGINE.wasClicked()) finish();
    }
  }

  function pick(i) {
    var ch = state.choices[i];
    if (!ch) return;
    var p = PLAYER.get();
    if (ch.apply) ch.apply(p);
    state.chosen = ch;
    state.phase = 'resolve';
    // typewriter the ripple text
    state.full = ch.ripple; state.shown = ''; state.charIdx = 0; state.timer = 0; state.textDone = false;
  }

  function finish() {
    var ch = state.chosen;
    var p = PLAYER.get();
    var king = DATA.KINGDOMS[p.kingdom];
    var out;
    if (ch.route && ch.route.type === 'combat') {
      var enemies = ch.route.enemies.map(function(id, k) {
        return { type: id, id: id + '_intro_' + k };
      });
      out = { route: 'combat', combat: { enemies: enemies, bgColor: state.scene.bg, firstEncounter: true } };
    } else {
      out = { route: 'world', zone: king.mapZone, x: king.startPos.x, y: king.startPos.y };
    }
    var cb = onDone;
    state = null; onDone = null;
    if (cb) cb(out);
  }

  // resolve still needs the typewriter to run
  function updateResolve(dt) {
    if (state && state.phase === 'resolve' && !state.textDone) {
      state.timer += dt;
      while (state.timer >= CHAR_DELAY && state.charIdx < state.full.length) {
        state.shown += state.full[state.charIdx++];
        state.timer -= CHAR_DELAY;
      }
      if (state.charIdx >= state.full.length) state.textDone = true;
    }
  }

  // ── Layout helpers for choice cards ────────────────────────
  function cardH(n) { return n >= 4 ? 78 : (n === 3 ? 92 : 110); }
  function cardTop(n) { return 560 - 24 - n * cardH(n); }

  // ── Render ─────────────────────────────────────────────────
  function render(ctx, W, H, frame) {
    if (!state) return;
    var sc = state.scene;

    // Backdrop
    ctx.fillStyle = sc.bg;
    ctx.fillRect(0, 0, W, H);
    ENGINE.drawStudPattern(0, 0, W, H, sc.bg, 46);
    ctx.fillStyle = sc.tint;
    ctx.fillRect(0, 0, W, H);

    // A faint ground line for the "set"
    var groundY = 0.55 * H + 30;
    var gg = ctx.createLinearGradient(0, groundY - 60, 0, groundY + 60);
    gg.addColorStop(0, 'rgba(0,0,0,0)');
    gg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = gg;
    ctx.fillRect(0, groundY - 60, W, 120);

    drawMotes(ctx, W, H);

    // Letterbox bars
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, 44);
    ctx.fillRect(0, H - 4, W, 4);

    // Slug line
    ENGINE.drawText(sc.slug, 16, 22, { size: 10, color: '#F2CD37', bold: true });
    ENGINE.drawText(sc.sub, 16, 36, { size: 8, color: '#9BA19D' });

    // Who is speaking right now?
    var speaker = null;
    if (state.phase === 'beat') {
      var b = curBeat();
      if (b.who) speaker = b.who;
    } else if (state.phase === 'resolve') {
      speaker = PLAYER.get().name;          // the player just spoke
    }

    // Stage the cast
    state.cast.forEach(function(c) {
      var active = (c.name === speaker);
      if (c.hidden && !active && !c.self) {
        // hidden non-self figures (e.g. messenger off-beat) still drawn dim
      }
      var alpha = active ? 1 : 0.5;
      // spotlight under active speaker
      if (active) {
        var sp = ctx.createRadialGradient(c.px, c.py + 6, 4, c.px, c.py + 6, 64);
        sp.addColorStop(0, 'rgba(255,235,160,0.22)');
        sp.addColorStop(1, 'rgba(255,235,160,0)');
        ctx.fillStyle = sp;
        ctx.fillRect(c.px - 70, c.py - 70, 140, 150);
      }
      ctx.globalAlpha = alpha;
      var fopts = Object.assign({}, c.fig);
      fopts.scale = active ? 2.6 : 2.1;
      fopts.emotion = active ? curEmotion() : c.baseEmo;
      fopts.facingLeft = c.px > W / 2 && !c.self;
      ENGINE.drawMinifigure(c.px, c.py, fopts);
      ctx.globalAlpha = 1;

      // name plate for the active speaker
      if (active) {
        var nm = c.self ? PLAYER.get().name : c.name;
        var pw = Math.max(48, nm.length * 7 + 14);
        ENGINE.drawLegoBrick(c.px - pw / 2, c.py - 78, pw, 16, '#F2CD37', '#DBA000', { plate: true });
        ENGINE.drawText(nm, c.px, c.py - 66, { size: 8, color: '#1B2A34', bold: true, align: 'center' });
      }
    });

    // Script panel
    if (state.phase === 'beat')        renderBeatPanel(ctx, W, H);
    else if (state.phase === 'choices') renderChoices(ctx, W, H, frame);
    else if (state.phase === 'resolve') renderResolve(ctx, W, H, frame);

    ENGINE.drawScanlines(0.08);
  }

  function curEmotion() {
    if (state.phase === 'resolve') return 'stern';
    var b = curBeat();
    return b.emo || 'neutral';
  }

  function renderBeatPanel(ctx, W, H) {
    var b = curBeat();
    var boxY = H - 150, boxH = 138;
    ENGINE.drawPanel(40, boxY, W - 80, boxH, { bg: 'rgba(6,8,18,0.94)', border: '#F2CD37' });

    if (b.action || b.sfx) {
      // Stage direction — centred, dim, "italic" feel
      var label = b.sfx ? 'SFX' : 'ACTION';
      ENGINE.drawText(label, 56, boxY + 22, { size: 8, color: b.sfx ? '#68BCC5' : '#6C6E68', bold: true });
      ENGINE.drawTextWrapped(state.shown, 56, boxY + 44, W - 112, 16, { size: 10, color: b.sfx ? '#9BD3DA' : '#C9C9C9' });
    } else {
      // Dialogue — character cue + parenthetical + line
      ENGINE.drawText(b.who.toUpperCase(), W / 2, boxY + 24, { size: 11, color: '#F2CD37', bold: true, align: 'center' });
      var ty = boxY + 40;
      if (b.paren) {
        ENGINE.drawText(b.paren, W / 2, ty, { size: 8, color: '#9BA19D', align: 'center' });
        ty += 14;
      }
      ENGINE.drawTextWrapped(state.shown, 70, ty + 8, W - 140, 16, { size: 11, color: '#FFFFFF' });
    }

    if (state.textDone) {
      var blink = 0.5 + 0.5 * Math.sin(performance.now() * 0.006);
      ctx.globalAlpha = blink;
      ENGINE.drawText('SPACE ▸', W - 96, H - 22, { size: 9, color: '#F2CD37' });
      ctx.globalAlpha = 1;
    }
  }

  function renderChoices(ctx, W, H, frame) {
    var n = state.choices.length;
    // Prompt banner
    ENGINE.drawPanel(40, 52, W - 80, 30, { bg: 'rgba(6,8,18,0.92)', border: '#C91A09' });
    ENGINE.drawText('▶ ' + state.scene.prompt, W / 2, 72, { size: 10, color: '#F2CD37', bold: true, align: 'center' });

    var top = cardTop(n), ch = cardH(n);
    for (var i = 0; i < n; i++) {
      var c = state.choices[i];
      var y = top + i * ch;
      var on = (i === state.sel);
      ENGINE.drawPanel(60, y, 680, ch - 8, {
        bg: on ? 'rgba(0,40,90,0.95)' : 'rgba(8,10,22,0.92)',
        border: on ? '#F2CD37' : '#3A3F48'
      });
      // tag chip
      ENGINE.drawLegoBrick(70, y + 8, 96, 16, on ? '#F2CD37' : '#6C6E68', on ? '#DBA000' : '#4A4A4A', { plate: true });
      ENGINE.drawText('[' + (i + 1) + '] ' + c.tag, 76, y + 20, { size: 8, color: '#1B2A34', bold: true });

      // spoken line
      ENGINE.drawTextWrapped('"' + c.line + '"', 176, y + 18, 552, 13, { size: 9, color: on ? '#FFFFFF' : '#B8C0CC' });

      // synthesis (mechanical deltas), only for selected card to avoid clutter
      if (on) {
        var sx = 76, sy = y + ch - 22;
        c.synth.forEach(function(s, k) {
          var col = s.good ? '#77C537' : '#E0564B';
          var label = s.l + ' ' + s.v;
          ENGINE.drawText('• ' + label, sx, sy, { size: 7, color: col });
          sx += Math.min(230, label.length * 4.4 + 28);
          if (sx > W - 180) { sx = 76; sy += 11; }
        });
      }
    }
    ENGINE.drawText('↑↓ choose   ENTER / click to commit   (this shapes your whole game)', W / 2, H - 8, { size: 7, color: '#6C6E68', align: 'center' });
  }

  function renderResolve(ctx, W, H, frame) {
    var c = state.chosen;
    var boxY = H - 168, boxH = 156;
    ENGINE.drawPanel(40, boxY, W - 80, boxH, { bg: 'rgba(6,8,18,0.96)', border: '#F2CD37' });

    // player's chosen line
    ENGINE.drawText(PLAYER.get().name.toUpperCase() + ' — ' + c.tag, 56, boxY + 22, { size: 10, color: '#F2CD37', bold: true });
    ENGINE.drawTextWrapped('"' + c.line + '"', 56, boxY + 40, W - 112, 14, { size: 9, color: '#E4CD9E' });

    // ripple consequence (typewriter)
    var ry = boxY + 84;
    ENGINE.drawText('RIPPLE', 56, ry, { size: 8, color: '#81007B', bold: true });
    ENGINE.drawTextWrapped(state.shown, 56, ry + 16, W - 112, 14, { size: 9, color: '#C9C9C9' });

    if (state.textDone) {
      // applied effects, color coded
      var ex = 56, ey = H - 26;
      c.synth.forEach(function(s) {
        var col = s.good ? '#77C537' : '#E0564B';
        var label = (s.good ? '✓ ' : '✗ ') + s.l + ' ' + s.v;
        ENGINE.drawText(label, ex, ey, { size: 7, color: col });
        ex += Math.min(250, label.length * 4.4 + 24);
        if (ex > W - 200) { ex = 56; ey += 11; }
      });
      var blink = 0.5 + 0.5 * Math.sin(performance.now() * 0.006);
      ctx.globalAlpha = blink;
      ENGINE.drawText('SPACE ▸ begin', W - 116, boxY + 22, { size: 9, color: '#F2CD37' });
      ctx.globalAlpha = 1;
    }
  }

  function isActive() { return state !== null; }

  return { start, update, updateResolve, handleInput, render, isActive };
})();
