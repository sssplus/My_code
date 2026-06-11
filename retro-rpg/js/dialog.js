// ============================================================
//  CHRONICLES OF THE SHATTERED REALM — Dialog System
//  Typewriter effect, choice trees, memory flags
// ============================================================

var DIALOG = (function() {

  var state   = null;
  var onEnd   = null;  // callback(flags, actions)

  var CHAR_DELAY = 30; // ms per character
  var lastTime   = 0;
  var elapsed    = 0;
  var accumulatedActions = [];

  // ── Start a dialog tree ────────────────────────────────────
  function start(treeId, callback) {
    var tree = DATA.DIALOGS[treeId];
    if (!tree) { if(callback) callback({}); return; }

    onEnd = callback;
    accumulatedActions = [];

    var startNode = tree.nodes[tree.start];
    state = {
      tree:        tree,
      currentNode: startNode,
      nodeId:      tree.start,
      displayText: '',
      fullText:    formatText(startNode.text),
      charIdx:     0,
      textDone:    false,
      choices:     startNode.choices || null,
      selectedChoice: 0,
      phase:       'typing',  // typing | choices | end
      portrait: {
        speaker:  startNode.speaker || '',
        emotion:  startNode.emotion || 'neutral'
      },
      flags:       {},
      timer:       0
    };

    lastTime = performance.now();
    return state;
  }

  function getState() { return state; }

  function formatText(text) {
    // Newline-aware, supports \n
    return (text || '').replace(/\\n/g, '\n');
  }

  // ── Update typewriter ──────────────────────────────────────
  function update(dt) {
    if (!state || state.phase === 'end') return;

    // Advance typewriter
    if (state.phase === 'typing') {
      state.timer += dt;
      while (state.timer >= CHAR_DELAY && state.charIdx < state.fullText.length) {
        state.displayText += state.fullText[state.charIdx];
        state.charIdx++;
        state.timer -= CHAR_DELAY;
      }
      if (state.charIdx >= state.fullText.length) {
        state.textDone = true;
        if (!state.choices || state.choices.length === 0) {
          state.phase = 'await_continue';
        } else {
          state.phase = 'choices';
        }
      }
    }
  }

  // ── Input handling ─────────────────────────────────────────
  function handleInput() {
    if (!state) return false;

    if (state.phase === 'typing') {
      // Skip typewriter on Space/Enter/Click
      if (ENGINE.isKeyJust('Space') || ENGINE.isKeyJust('Enter') || ENGINE.wasClicked()) {
        state.displayText = state.fullText;
        state.charIdx     = state.fullText.length;
        state.textDone    = true;
        if (!state.choices || state.choices.length === 0) {
          state.phase = 'await_continue';
        } else {
          state.phase = 'choices';
        }
        return true;
      }
    }

    if (state.phase === 'await_continue') {
      if (ENGINE.isKeyJust('Space') || ENGINE.isKeyJust('Enter') || ENGINE.wasClicked()) {
        // Check for node action
        executeNodeAction(state.currentNode);
        advanceOrEnd(null);
        return true;
      }
    }

    if (state.phase === 'choices') {
      var choices = state.choices;

      // Keyboard navigation
      if (ENGINE.isKeyJust('ArrowUp') || ENGINE.isKeyJust('KeyW')) {
        state.selectedChoice = (state.selectedChoice - 1 + choices.length) % choices.length;
      }
      if (ENGINE.isKeyJust('ArrowDown') || ENGINE.isKeyJust('KeyS')) {
        state.selectedChoice = (state.selectedChoice + 1) % choices.length;
      }

      // Confirm selection
      if (ENGINE.isKeyJust('Space') || ENGINE.isKeyJust('Enter')) {
        selectChoice(state.selectedChoice);
        return true;
      }

      // Number keys for quick select
      choices.forEach(function(c, i) {
        if (ENGINE.isKeyJust('Digit' + (i+1))) {
          selectChoice(i);
        }
      });

      // Mouse click on choices
      var canvasH = ENGINE.getCanvas().height;
      var choiceY = canvasH - 170;
      choices.forEach(function(c, i) {
        var cy = choiceY + i * 32;
        if (ENGINE.isButtonClicked(60, cy, ENGINE.getCanvas().width - 120, 28)) {
          selectChoice(i);
        }
      });
    }

    return false;
  }

  function selectChoice(idx) {
    var choice = state.choices[idx];
    if (!choice) return;

    // Store flag from choice
    if (choice.flag) {
      state.flags[choice.flag] = true;
      PLAYER.setFlag(choice.flag, true);
    }

    // Execute choice action
    if (choice.action) {
      executeAction(choice.action, choice);
    }

    advanceOrEnd(choice);
  }

  function advanceOrEnd(choice) {
    var nextNodeId = choice ? choice.next : null;

    if (!nextNodeId) {
      // Dialog ends
      state.phase = 'end';
      executeNodeAction(state.currentNode);
      if (onEnd) onEnd(state.flags, accumulatedActions);
      return;
    }

    var nextNode = state.tree.nodes[nextNodeId];
    if (!nextNode) {
      state.phase = 'end';
      if (onEnd) onEnd(state.flags, accumulatedActions);
      return;
    }

    // Transition to next node
    state.currentNode  = nextNode;
    state.nodeId       = nextNodeId;
    state.fullText     = formatText(nextNode.text);
    state.displayText  = '';
    state.charIdx      = 0;
    state.textDone     = false;
    state.choices      = nextNode.choices || null;
    state.selectedChoice = 0;
    state.phase        = 'typing';
    state.timer        = 0;
    state.portrait.speaker = nextNode.speaker || state.portrait.speaker;
    state.portrait.emotion = nextNode.emotion || 'neutral';

    // Execute node action immediately
    executeNodeAction(nextNode);
  }

  function executeNodeAction(node) {
    if (!node || !node.action) return;
    var action = { type: node.action };
    if (node.questId)  action.questId  = node.questId;
    if (node.enemyId)  action.enemyId  = node.enemyId;
    if (node.lead)     action.lead     = node.lead;
    accumulatedActions.push(action);
  }

  function executeAction(actionType, choice) {
    var action = { type: actionType };
    if (choice.lead)     action.lead     = choice.lead;
    if (choice.questId)  action.questId  = choice.questId;
    accumulatedActions.push(action);
  }

  // ── Get NPC figure options for portrait ───────────────────
  function getSpeakerOptions(speaker) {
    // Look up romance lead
    var lead = Object.values(DATA.ROMANCE_LEADS).find(function(l) { return l.name === speaker; });
    if (lead) return { torsoColor: lead.torsoColor, headColor: lead.headColor || '#F2CD37' };

    // Look up NPC from zones
    var opts = { torsoColor: '#9BA19D', headColor: '#F2CD37' };
    switch(speaker) {
      case 'Palace Guard':     return { torsoColor: '#C91A09', headColor: '#F2CD37' };
      case 'Bram':             return { torsoColor: '#9BA19D', headColor: '#F2CD37' };
      case 'Clan Elder Varos': return { torsoColor: '#6C6E68', headColor: '#F2CD37', hat:'hood' };
      case 'Kael':             var p = PLAYER.get(); return { torsoColor: p.torsoColor, legColor: p.legColor, headColor: p.headColor, weapon: p.weapon, hat: p.hat };
      case 'Malachar':         return { torsoColor: '#1B2A34', legColor: '#81007B', headColor: '#1B2A34' };
    }
    return opts;
  }

  // ── Render ─────────────────────────────────────────────────
  function render(ctx, canvasW, canvasH) {
    if (!state || state.phase === 'end') return;

    var boxH   = 200;
    var boxY   = canvasH - boxH - 10;
    var boxX   = 10;
    var boxW   = canvasW - 20;
    var textX  = boxX + 110;
    var textW  = boxW - 120;

    // ── Dialog box ────────────────────────────────────────────
    ENGINE.drawPanel(boxX, boxY, boxW, boxH, {
      bg:     'rgba(10, 10, 30, 0.95)',
      border: '#F2CD37',
      title:  state.portrait.speaker
    });

    // ── Speaker portrait (left) ───────────────────────────────
    var figOpts = getSpeakerOptions(state.portrait.speaker);
    figOpts.emotion = state.portrait.emotion;
    figOpts.scale   = 1.5;
    ENGINE.drawMinifigure(boxX + 54, boxY + boxH - 20, figOpts);

    // Speaker name plate
    ENGINE.drawLegoBrick(boxX + 12, boxY + 10, 82, 14, '#F2CD37', '#DBA000', {plate:true});
    ENGINE.drawText(state.portrait.speaker.substring(0,10), boxX+16, boxY+20, {size:7, color:'#1B2A34', bold:true});

    // ── Dialog text ───────────────────────────────────────────
    var lines = state.displayText.split('\n');
    var cy = boxY + 30;
    lines.forEach(function(line) {
      ENGINE.drawTextWrapped(line, textX, cy, textW, 14, {size:9, color:'#FFFFFF'});
      cy += 14;
    });

    // ── Choices ───────────────────────────────────────────────
    if (state.phase === 'choices' && state.choices) {
      var choiceY = boxY + boxH - (state.choices.length * 32) - 10;
      state.choices.forEach(function(choice, i) {
        var cy2 = choiceY + i * 32;
        var isSelected = (i === state.selectedChoice);
        var isHovered  = ENGINE.isButtonHovered(textX, cy2, textW, 28);
        var active     = isSelected || isHovered;

        // Choice button
        ENGINE.drawButton(textX, cy2, textW, 28,
          '[' + (i+1) + '] ' + choice.text,
          active, { color: active ? '#0055BF' : '#1B2A34', fontSize: 9 }
        );

        if (active) {
          state.selectedChoice = i;
        }
      });
    }

    // ── Continue indicator ────────────────────────────────────
    if (state.phase === 'await_continue') {
      var blinkAlpha = 0.5 + 0.5 * Math.sin(performance.now() * 0.005);
      ctx.globalAlpha = blinkAlpha;
      ENGINE.drawText('▼ Press SPACE to continue', boxX + boxW - 200, boxY + boxH - 14, {size:8, color:'#F2CD37'});
      ctx.globalAlpha = 1;
    }

    // ── Typing indicator ──────────────────────────────────────
    if (state.phase === 'typing') {
      var dotCount = Math.floor(performance.now() / 200) % 4;
      ENGINE.drawText('.'.repeat(dotCount), textX + ctx.measureText(state.displayText).width + 2, boxY + 30, {size:9, color:'#9BA19D'});
    }
  }

  function isActive() {
    return state !== null && state.phase !== 'end';
  }

  function end() {
    state = null;
    onEnd = null;
  }

  return {
    start, getState, update, handleInput, render, isActive, end
  };
})();
