// ============================================================
//  CHRONICLES OF THE SHATTERED REALM — Character Creation
// ============================================================

var CHARGEN = (function() {

  var state   = null;
  var onDone  = null;  // callback(name, kingdom, origin)

  var KINGDOMS = Object.values(DATA.KINGDOMS);
  var ORIGINS  = Object.values(DATA.ORIGINS);

  function start(callback) {
    onDone = callback;
    state = {
      page:          0,      // 0=kingdom, 1=origin, 2=name, 3=confirm
      selectedKing:  0,
      selectedOrigin:0,
      name:          'Kael',
      nameInput:     false,
      cursor:        true,
      cursorTimer:   0,
      previewAnim:   0,
      bgScroll:      0
    };
    return state;
  }

  function getState() { return state; }

  function handleInput() {
    if (!state) return;

    state.cursorTimer++;
    if (state.cursorTimer > 30) { state.cursor = !state.cursor; state.cursorTimer = 0; }

    switch (state.page) {
      case 0: handleKingdomInput(); break;
      case 1: handleOriginInput();  break;
      case 2: handleNameInput();    break;
      case 3: handleConfirmInput(); break;
    }
  }

  function handleKingdomInput() {
    if (ENGINE.action('left'))  state.selectedKing = (state.selectedKing - 1 + KINGDOMS.length) % KINGDOMS.length;
    if (ENGINE.action('right')) state.selectedKing = (state.selectedKing + 1) % KINGDOMS.length;

    if (ENGINE.action('confirm')) { state.page = 1; return; }

    // Mouse clicks on kingdom cards
    KINGDOMS.forEach(function(k, i) {
      var bx = 60 + i * 146;
      var by = 180;
      if (ENGINE.isButtonClicked(bx, by, 136, 220)) {
        state.selectedKing = i;
        state.page = 1;
      }
      if (ENGINE.didMouseMove() && ENGINE.isButtonHovered(bx, by, 136, 220)) {
        state.selectedKing = i;
      }
    });
  }

  function handleOriginInput() {
    if (ENGINE.action('left'))   state.selectedOrigin = (state.selectedOrigin - 1 + ORIGINS.length) % ORIGINS.length;
    if (ENGINE.action('right'))  state.selectedOrigin = (state.selectedOrigin + 1) % ORIGINS.length;
    if (ENGINE.action('cancel'))  { state.page = 0; return; }
    if (ENGINE.action('confirm')) { state.page = 2; return; }

    ORIGINS.forEach(function(o, i) {
      var bx = 60 + i * 124;
      var by = 200;
      if (ENGINE.isButtonClicked(bx, by, 114, 230)) { state.selectedOrigin = i; state.page = 2; }
      if (ENGINE.didMouseMove() && ENGINE.isButtonHovered(bx, by, 114, 230)) state.selectedOrigin = i;
    });
  }

  function handleNameInput() {
    if (ENGINE.action('cancel'))  { state.page = 1; return; }
    if (ENGINE.action('confirm')) { if (state.name.trim()) state.page = 3; return; }

    // Backspace
    if (ENGINE.isKeyJust('Backspace')) {
      state.name = state.name.slice(0, -1);
      return;
    }

    // Preset names
    var presets = ['Kael', 'Aldric', 'Theron', 'Vael', 'Sion', 'Mira'];
    presets.forEach(function(n, i) {
      var bx = 280 + i * 80;
      if (ENGINE.isButtonClicked(bx, 340, 72, 22)) { state.name = n; }
    });

    // Continue button
    if (ENGINE.isButtonClicked(300, 390, 200, 32)) { if (state.name.trim()) state.page = 3; }
  }

  function handleConfirmInput() {
    // Confirm
    if (ENGINE.action('confirm') || ENGINE.isButtonClicked(280, 430, 240, 36)) {
      if (onDone) onDone(state.name || 'Kael', KINGDOMS[state.selectedKing].id, ORIGINS[state.selectedOrigin].id);
    }
    // Back
    if (ENGINE.action('cancel') || ENGINE.isButtonClicked(280, 476, 240, 28)) {
      state.page = 2;
    }
  }

  // ── Keyboard input for name entry ──────────────────────────
  function charInput(char) {
    if (!state || state.page !== 2) return;
    if (state.name.length >= 12) return;
    if (/^[a-zA-Z\s]$/.test(char)) {
      state.name += char;
    }
  }

  // ── Render ─────────────────────────────────────────────────
  function render(ctx, canvasW, canvasH) {
    if (!state) return;

    state.previewAnim++;
    state.bgScroll = (state.bgScroll + 0.3) % (ENGINE.TILE * 2);

    // ── Animated Lego-stud background ────────────────────────
    renderLegoBackground(ctx, canvasW, canvasH);

    // ── Logo / Title ──────────────────────────────────────────
    renderGameTitle(ctx, canvasW);

    switch (state.page) {
      case 0: renderKingdomPage(ctx, canvasW, canvasH);  break;
      case 1: renderOriginPage(ctx, canvasW, canvasH);   break;
      case 2: renderNamePage(ctx, canvasW, canvasH);     break;
      case 3: renderConfirmPage(ctx, canvasW, canvasH);  break;
    }

    ENGINE.drawScanlines(0.06);
  }

  function renderLegoBackground(ctx, canvasW, canvasH) {
    // Scrolling stud background
    ctx.fillStyle = '#0F1B2D';
    ctx.fillRect(0, 0, canvasW, canvasH);

    var studSpacing = 32;
    ctx.fillStyle = '#182840';
    for (var sy = -studSpacing + state.bgScroll; sy < canvasH + studSpacing; sy += studSpacing) {
      for (var sx = 0; sx < canvasW + studSpacing; sx += studSpacing) {
        ctx.beginPath();
        ctx.arc(sx, sy, 8, 0, Math.PI*2);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#1A2E48';
    for (var sy2 = -studSpacing + state.bgScroll; sy2 < canvasH + studSpacing; sy2 += studSpacing) {
      for (var sx2 = 0; sx2 < canvasW + studSpacing; sx2 += studSpacing) {
        ctx.beginPath();
        ctx.ellipse(sx2, sy2, 8, 3, 0, 0, Math.PI*2);
        ctx.fill();
      }
    }
  }

  function renderGameTitle(ctx, canvasW) {
    // Lego brick logo
    var bricks = [
      { x:canvasW/2-180, color:'#C91A09', label:'C' },
      { x:canvasW/2-120, color:'#0055BF', label:'H' },
      { x:canvasW/2-60,  color:'#237841', label:'R' },
      { x:canvasW/2+0,   color:'#DBA000', label:'O' },
      { x:canvasW/2+60,  color:'#81007B', label:'N' },
      { x:canvasW/2+120, color:'#FE8A18', label:'I' },
    ];
    bricks.forEach(function(b) {
      var bounce = Math.sin(state.previewAnim * 0.03 + b.x * 0.01) * 4;
      ENGINE.drawLegoBrick(b.x, 30 + bounce, 52, 28, b.color, ENGINE.darken(b.color, 30));
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, b.x + 26, 52 + bounce);
    });

    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#F2CD37';
    ctx.textAlign = 'center';
    ctx.fillText('CHRONICLES OF THE SHATTERED REALM', canvasW/2, 82);
    ctx.font = '8px monospace';
    ctx.fillStyle = '#9BA19D';
    ctx.fillText('— A Lego RPG —', canvasW/2, 96);
    ctx.textAlign = 'left';
  }

  // ── Page 0: Kingdom Selection ─────────────────────────────
  function renderKingdomPage(ctx, canvasW, canvasH) {
    ENGINE.drawText('STEP 1 — Choose Your Kingdom', canvasW/2, 128, {size:11, color:'#F2CD37', bold:true, align:'center'});
    ENGINE.drawText('Where were you born? Your origin begins here.', canvasW/2, 148, {size:8, color:'#9BA19D', align:'center'});

    KINGDOMS.forEach(function(k, i) {
      var selected = (i === state.selectedKing);
      var bx = 60 + i * 146;
      var by = 168;
      var bw = 136;
      var bh = 240;

      // Card background
      ENGINE.drawPanel(bx, by, bw, bh, {
        bg:     selected ? ENGINE.darken(k.color, 60) : '#1B2A34',
        border: selected ? k.color : '#333'
      });

      // Kingdom flag
      ENGINE.drawLegoBrick(bx + 8, by + 14, bw - 16, 40, k.color, ENGINE.darken(k.color, 30));
      ctx.fillStyle = k.accentColor || '#FFF';
      ctx.fillRect(bx + 8, by + 14, bw - 16, 12);

      // Kingdom minifigure (representative)
      var figY = by + 104;
      ENGINE.drawMinifigure(bx + bw/2, figY, {
        torsoColor: k.color,
        legColor:   ENGINE.darken(k.color, 40),
        headColor:  '#F2CD37',
        scale:      1.0,
        emotion:    selected ? 'happy' : 'neutral',
        hat:        k.id === 'prince' ? 'crown' : null
      });

      // Kingdom name
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = selected ? k.color : '#9BA19D';
      ctx.textAlign = 'center';
      ctx.fillText(k.name, bx + bw/2, by + 128);

      // Capital
      ctx.font = '7px monospace';
      ctx.fillStyle = '#6C6E68';
      ctx.fillText('⚑ ' + k.capital, bx + bw/2, by + 142);

      // Biome
      ctx.font = '7px monospace';
      ctx.fillStyle = '#6C6E68';
      ctx.fillText(k.biome.substring(0,16), bx + bw/2, by + 154);

      // Description
      ctx.font = '6px monospace';
      ctx.fillStyle = selected ? '#DDEEFF' : '#9BA19D';
      var descLines = k.description.match(/.{1,18}/g) || [];
      descLines.slice(0,4).forEach(function(line, li) {
        ctx.fillText(line, bx + bw/2, by + 170 + li * 11);
      });

      // Selected indicator
      if (selected) {
        ctx.fillStyle = k.color;
        ctx.fillRect(bx+8, by+bh-24, bw-16, 16);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 8px monospace';
        ctx.fillText('SELECTED', bx+bw/2, by+bh-12);
      }

      ctx.textAlign = 'left';
    });

    // Controls hint
    var selK = KINGDOMS[state.selectedKing];
    ENGINE.drawPanel(60, canvasH-64, canvasW-120, 48, { bg:'rgba(10,10,20,0.85)', border:'#F2CD37' });
    ENGINE.drawText('← → Arrow Keys to select  •  ENTER / Click to confirm', canvasW/2, canvasH-44, {size:8, color:'#9BA19D', align:'center'});
    ENGINE.drawText('Selected: ' + selK.name + ' — ' + selK.capital, canvasW/2, canvasH-28, {size:9, color:'#F2CD37', bold:true, align:'center'});
  }

  // ── Page 1: Origin Selection ──────────────────────────────
  function renderOriginPage(ctx, canvasW, canvasH) {
    ENGINE.drawText('STEP 2 — Choose Your Origin', canvasW/2, 128, {size:11, color:'#F2CD37', bold:true, align:'center'});
    ENGINE.drawText('Who are you? Your class and destiny begin here.', canvasW/2, 148, {size:8, color:'#9BA19D', align:'center'});

    ORIGINS.forEach(function(o, i) {
      var selected = (i === state.selectedOrigin);
      var bx = 60 + i * 124;
      var by = 168;
      var bw = 114;
      var bh = 270;

      ENGINE.drawPanel(bx, by, bw, bh, {
        bg:     selected ? ENGINE.darken(o.color, 60) : '#1B2A34',
        border: selected ? o.color : '#333'
      });

      // Origin icon/minifigure
      ENGINE.drawMinifigure(bx + bw/2, by + 100, {
        torsoColor: o.torsoColor,
        legColor:   o.legColor || ENGINE.darken(o.torsoColor, 40),
        headColor:  '#F2CD37',
        scale:      1.0,
        emotion:    selected ? 'happy' : 'neutral',
        weapon:     getWeaponForOrigin(o.id),
        hat:        o.id === 'prince' ? 'crown' : (o.id === 'mage_clan' ? 'hood' : null)
      });

      ctx.textAlign = 'center';
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = selected ? o.color : '#9BA19D';
      ctx.fillText(o.name, bx+bw/2, by+124);

      ctx.font = '7px monospace';
      ctx.fillStyle = '#6C6E68';
      ctx.fillText(o.class, bx+bw/2, by+136);

      // Stats mini-display
      var stats = o.stats;
      ctx.font = '6px monospace';
      ctx.fillStyle = selected ? '#DDEEFF' : '#9BA19D';
      ctx.fillText('HP:'+stats.hp+' MP:'+stats.mp, bx+bw/2, by+150);
      ctx.fillText('ATK:'+stats.atk+' DEF:'+stats.def, bx+bw/2, by+162);
      ctx.fillText('MAG:'+stats.mag+' AGI:'+stats.agi, bx+bw/2, by+174);

      // Blood power badge
      if (o.bloodPower) {
        ctx.fillStyle = '#F2CD37';
        ctx.fillRect(bx+8, by+184, bw-16, 14);
        ctx.fillStyle = '#1B2A34';
        ctx.font = 'bold 7px monospace';
        ctx.fillText(o.bloodPower === 'royal_blood' ? 'SSS BLOOD' : 'SS BLOOD', bx+bw/2, by+194);
      }

      // Mechanic description
      ctx.font = '6px monospace';
      ctx.fillStyle = selected ? '#F2CD37' : '#6C6E68';
      var mechLines = o.mechanic.match(/.{1,15}/g) || [];
      mechLines.slice(0,5).forEach(function(line, li) {
        ctx.fillText(line, bx+bw/2, by+204+li*11);
      });

      if (selected) {
        ctx.fillStyle = o.color;
        ctx.fillRect(bx+8, by+bh-24, bw-16, 16);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 7px monospace';
        ctx.fillText('CHOSEN', bx+bw/2, by+bh-12);
      }
      ctx.textAlign = 'left';
    });

    ENGINE.drawPanel(60, canvasH-64, canvasW-120, 48, {bg:'rgba(10,10,20,0.85)'});
    ENGINE.drawText('← → to select  •  ENTER to confirm  •  ESC to go back', canvasW/2, canvasH-44, {size:8, color:'#9BA19D', align:'center'});
    var selO = ORIGINS[state.selectedOrigin];
    ENGINE.drawText(selO.name + ': ' + selO.description.substring(0,50), canvasW/2, canvasH-28, {size:7, color:'#F2CD37', align:'center'});
  }

  // ── Page 2: Name Entry ────────────────────────────────────
  function renderNamePage(ctx, canvasW, canvasH) {
    var king = KINGDOMS[state.selectedKing];
    var orig = ORIGINS[state.selectedOrigin];

    ENGINE.drawText('STEP 3 — Name Your Hero', canvasW/2, 128, {size:11, color:'#F2CD37', bold:true, align:'center'});

    // Large preview minifigure
    ENGINE.drawMinifigure(canvasW/2, 260, {
      torsoColor: orig.torsoColor,
      legColor:   orig.legColor || ENGINE.darken(orig.torsoColor, 40),
      headColor:  '#F2CD37',
      scale:      2.5,
      weapon:     getWeaponForOrigin(orig.id),
      hat:        orig.id === 'prince' ? 'crown' : null,
      emotion:    'happy'
    });

    // Name input box
    ENGINE.drawPanel(canvasW/2-180, 310, 360, 60, {title:'ENTER NAME', border:'#F2CD37'});

    var displayName = state.name + (state.cursor ? '█' : ' ');
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#F2CD37';
    ctx.textAlign = 'center';
    ctx.fillText(displayName, canvasW/2, 350);
    ctx.textAlign = 'left';

    // Preset names
    ENGINE.drawText('Quick Select:', canvasW/2-160, 388, {size:8, color:'#9BA19D', align:'center'});
    var presets = ['Kael','Aldric','Theron','Vael','Sion','Mira'];
    presets.forEach(function(n, i) {
      var bx = 280 + i*80;
      ENGINE.drawButton(bx, 396, 72, 22, n, ENGINE.isButtonHovered(bx,396,72,22), {fontSize:8});
    });

    // Origin hint
    ENGINE.drawText('"' + orig.openingLine.substring(0,50) + '"', canvasW/2, 438, {size:7, color:'#6C6E68', align:'center'});
    ENGINE.drawText('— ' + orig.class + ' of ' + king.name, canvasW/2, 452, {size:7, color:'#9BA19D', align:'center'});

    ENGINE.drawButton(canvasW/2-100, 468, 200, 32, '[ CONTINUE ]', ENGINE.isButtonHovered(canvasW/2-100,468,200,32), {fontSize:9, color:'#237841'});
    ENGINE.drawText('ESC — Go Back  •  Type your name  •  ENTER to confirm', canvasW/2, 512, {size:7, color:'#6C6E68', align:'center'});
  }

  // ── Page 3: Confirmation ──────────────────────────────────
  function renderConfirmPage(ctx, canvasW, canvasH) {
    var king = KINGDOMS[state.selectedKing];
    var orig = ORIGINS[state.selectedOrigin];
    var name = state.name || 'Kael';

    ENGINE.drawPanel(canvasW/2-260, 110, 520, 380, {title:'CHARACTER SUMMARY', border:king.color});

    // Large preview
    ENGINE.drawMinifigure(canvasW/2-120, 260, {
      torsoColor: orig.torsoColor,
      legColor:   orig.legColor,
      headColor:  '#F2CD37',
      scale:      2.5,
      weapon:     getWeaponForOrigin(orig.id),
      hat:        orig.id === 'prince' ? 'crown' : null,
      emotion:    'happy'
    });

    // Summary text
    var tx = canvasW/2 + 10;
    var ty = 130;
    ctx.textAlign = 'left';

    ENGINE.drawText(name, tx, ty, {size:18, color:'#F2CD37', bold:true});
    ENGINE.drawText(orig.class + ' of ' + king.name, tx, ty+24, {size:9, color:king.color});
    ENGINE.drawText('Kingdom: ' + king.name + ' — ' + king.capital, tx, ty+44, {size:8, color:'#9BA19D'});

    // Stats
    var stats = orig.stats;
    ENGINE.drawText('BASE STATS', tx, ty+66, {size:8, color:'#F2CD37', bold:true});
    ENGINE.drawBar(tx, ty+76, 160, 9, stats.hp, 150, '#C91A09', 'HP');
    ENGINE.drawBar(tx, ty+90, 160, 9, stats.mp, 150, '#0055BF', 'MP');
    ENGINE.drawBar(tx, ty+104,160, 9, stats.sp, 150, '#F2CD37', 'SP');
    ENGINE.drawBar(tx, ty+118,160, 9, stats.atk, 25,  '#FE8A18', 'ATK');
    ENGINE.drawBar(tx, ty+132,160, 9, stats.def, 25,  '#9BA19D', 'DEF');
    ENGINE.drawBar(tx, ty+146,160, 9, stats.mag, 25,  '#81007B', 'MAG');
    ENGINE.drawBar(tx, ty+160,160, 9, stats.agi, 20,  '#77C537', 'AGI');

    // Special mechanic
    if (orig.bloodPower) {
      ENGINE.drawText('⚡ BLOOD POWER: ' + orig.bloodPower.replace('_',' ').toUpperCase(), tx, ty+180, {size:7, color:'#F2CD37', bold:true});
    }
    ENGINE.drawText('Class Mechanic:', tx, ty+194, {size:7, color:'#9BA19D'});
    ENGINE.drawTextWrapped(orig.mechanic, tx, ty+206, 200, 12, {size:7, color:'#6C6E68'});

    // Skills
    ENGINE.drawText('Starting Skills:', tx, ty+240, {size:7, color:'#F2CD37'});
    orig.startingSkills.forEach(function(sk, i) {
      var skill = DATA.SKILLS[sk];
      if (skill) ENGINE.drawText('• ' + skill.name, tx, ty+252+i*14, {size:7, color:'#9BA19D'});
    });

    // Opening quote
    ENGINE.drawText('"' + orig.openingLine.substring(0,44) + '..."', canvasW/2-260+10, 460, {size:7, color:'#6C6E68'});

    // Confirm / Back buttons
    ENGINE.drawButton(canvasW/2-120, 482, 240, 36, '[ BEGIN YOUR LEGEND ]', ENGINE.isButtonHovered(canvasW/2-120,482,240,36), {color:'#237841', fontSize:9});
    ENGINE.drawButton(canvasW/2-60, 524, 120, 22, 'ESC — Go Back', ENGINE.isButtonHovered(canvasW/2-60,524,120,22), {color:'#6C6E68', fontSize:7});
  }

  function getWeaponForOrigin(id) {
    if (id === 'mage_clan' || id === 'priest') return 'staff';
    if (id === 'sword_clan'|| id === 'noble' || id === 'prince') return 'sword';
    return null;
  }

  return { start, getState, handleInput, charInput, render };
})();
