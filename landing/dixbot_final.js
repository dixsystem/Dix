/* dixbot_final.js — DIX mascot engine for dixsystem.com */
(function () {
  'use strict';

  // ─── SPRITE CONFIG ───────────────────────────────────────────────────────────
  const S1 = { w: 179, h: 156, offsetY: 0 };    // sheet1 cell size & Y start
  const S2 = { w: 119, h: 104, offsetY: 1254 };  // sheet2 cell size & Y start
  const SHEET_W = 1254;
  const SHEET_H = 3135;
  const DISPLAY = 160;  // rendered px

  // row → { sheet, row, frames }
  const ANIMS = {
    WALK:         { s: S1, row: 0, frames: 7 },
    RUN:          { s: S1, row: 1, frames: 5 },
    IDLE:         { s: S1, row: 2, frames: 3 },
    SCARED_JUMP:  { s: S1, row: 3, frames: 3 },
    CLIMB:        { s: S1, row: 4, frames: 4 },
    SCARED:       { s: S1, row: 5, frames: 4 },
    ANGRY_ANIM:   { s: S1, row: 6, frames: 4 },
    CHEER:        { s: S1, row: 7, frames: 1, col: 0 },
    WAVE:         { s: S1, row: 7, frames: 1, col: 1 },
    POINT:        { s: S1, row: 7, frames: 1, col: 2 },
    THINK:        { s: S1, row: 7, frames: 1, col: 3 },
    SLEEP_ANIM:   { s: S1, row: 7, frames: 1, col: 4 },
    CHAT_ANIM:    { s: S1, row: 7, frames: 1, col: 5 },
    WALK2:        { s: S2, row: 0, frames: 7 },
    RUN2:         { s: S2, row: 1, frames: 5 },
    IDLE2:        { s: S2, row: 2, frames: 3 },
    JUMP:         { s: S2, row: 3, frames: 3 },
    FALL_ANIM:    { s: S2, row: 4, frames: 4 },
    CLIMB2:       { s: S2, row: 5, frames: 4 },
    HANG:         { s: S2, row: 6, frames: 2 },
    SWING:        { s: S2, row: 7, frames: 4 },
    SCARED2:      { s: S2, row: 8, frames: 4 },
    ANGRY2:       { s: S2, row: 9, frames: 4 },
    PUNCH:        { s: S2, row: 10, frames: 3 },
    KICK:         { s: S2, row: 11, frames: 3 },
    CHEER2:       { s: S2, row: 12, frames: 4 },
    WAVE2:        { s: S2, row: 13, frames: 3 },
    POINT2:       { s: S2, row: 14, frames: 2 },
    THINK2:       { s: S2, row: 15, frames: 2 },
    SLEEP2:       { s: S2, row: 16, frames: 2 },
    CHAT2:        { s: S2, row: 17, frames: 2 },
  };

  // ─── STATE MACHINE ────────────────────────────────────────────────────────────
  const STATES = {
    HOUSE: 'HOUSE', WALK: 'WALK', IDLE: 'IDLE', CLIMB: 'CLIMB',
    PERCH: 'PERCH', HANG: 'HANG', SWING: 'SWING', JUMP: 'JUMP',
    FALL: 'FALL', SCARED: 'SCARED', ANGRY: 'ANGRY', GRABBED: 'GRABBED',
    SLEEP: 'SLEEP', CHAT: 'CHAT',
  };

  // ─── PHYSICS ──────────────────────────────────────────────────────────────────
  const WALK_SPEED = 1.0;
  const GRAVITY = 0.45;
  let x = 80, y = 0, vx = WALK_SPEED, vy = 0;
  let facing = 1, onGround = false;
  let FLOOR = 0;

  function getFloor() {
    return document.documentElement.clientHeight - 170;
  }

  // ─── GAME STATE ───────────────────────────────────────────────────────────────
  let state = STATES.HOUSE;
  let anger = 0, throwCount = 0, petCount = 0;
  let lastIdleTime = 0, lastClimbTime = 0, lastActivity = Date.now();
  let waved = false;
  let stateTimer = 0;
  let konamiIdx = 0;
  const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA'];

  // ─── ANIMATION ────────────────────────────────────────────────────────────────
  let currentAnim = ANIMS.IDLE;
  let animFrame = 0, animTimer = 0;
  const ANIM_SPEED = 8; // frames per sprite frame

  // ─── DOM REFS ─────────────────────────────────────────────────────────────────
  let botEl, shadowEl, zzzEl, houseEl, chatEl, bubbleTimeout;

  // ─── CSS ──────────────────────────────────────────────────────────────────────
  function injectCSS() {
    const css = `
      #dix-bot {
        position: fixed;
        width: ${S1.w}px;
        height: ${S1.h}px;
        background-image: url('./assets/dix_sheet.png');
        background-repeat: no-repeat;
        background-size: ${SHEET_W}px ${SHEET_H}px;
        image-rendering: pixelated;
        transform-origin: center bottom;
        transform: scaleX(1) scale(${DISPLAY / S1.w});
        cursor: grab;
        z-index: 9998;
        pointer-events: auto;
        user-select: none;
        touch-action: none;
      }
      #dix-shadow {
        position: fixed;
        width: 80px;
        height: 18px;
        background: radial-gradient(ellipse, rgba(0,0,0,0.35) 0%, transparent 75%);
        transform: translateX(-50%);
        z-index: 9997;
        pointer-events: none;
        transition: opacity 0.2s;
      }
      #dix-zzz {
        position: fixed;
        z-index: 9999;
        pointer-events: none;
        font-size: 18px;
        font-weight: bold;
        color: #aad4ff;
        text-shadow: 0 0 8px #4af;
        animation: dix-zzz-float 2s ease-in-out infinite;
        display: none;
      }
      @keyframes dix-zzz-float {
        0%,100% { transform: translateY(0) scale(1); opacity: 0.9; }
        50% { transform: translateY(-12px) scale(1.1); opacity: 0.5; }
      }
      #dix-house {
        position: fixed;
        right: 18px;
        bottom: 18px;
        width: 148px;
        height: 118px;
        z-index: 9999;
        pointer-events: auto;
        cursor: pointer;
        user-select: none;
      }
      .dix-house-roof {
        width: 0;
        height: 0;
        border-left: 74px solid transparent;
        border-right: 74px solid transparent;
        border-bottom: 54px solid #FF6B00;
        position: absolute;
        top: 0; left: 0;
        filter: drop-shadow(0 -2px 4px rgba(255,107,0,0.4));
      }
      .dix-house-body {
        position: absolute;
        bottom: 0; left: 0;
        width: 148px;
        height: 74px;
        background: #1a1f2e;
        border: 2px solid #FF6B00;
        border-radius: 2px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        padding: 4px;
        box-sizing: border-box;
      }
      .dix-house-sign {
        font-family: monospace;
        font-size: 8px;
        color: #111;
        background: #ffd700;
        padding: 1px 4px;
        border-radius: 2px;
        letter-spacing: 0.5px;
        font-weight: bold;
      }
      .dix-house-row {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .dix-house-window {
        width: 28px;
        height: 28px;
        border: 2px solid #00ff88;
        background: rgba(0,255,136,0.08);
        animation: dix-win-blink 3s ease-in-out infinite;
      }
      @keyframes dix-win-blink {
        0%,80%,100% { border-color: #00ff88; background: rgba(0,255,136,0.08); }
        90% { border-color: #00ff44; background: rgba(0,255,68,0.2); }
      }
      .dix-house-door {
        width: 36px;
        height: 42px;
        background: #0d1117;
        border: 2px solid #FF6B00;
        border-radius: 3px 3px 0 0;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.2s;
      }
      .dix-house-door:hover { background: #1a1f2e; }
      .dix-house-door span {
        font-size: 20px;
        font-weight: bold;
        color: #FF6B00;
        font-family: monospace;
      }
      .dix-house-zzz {
        font-size: 13px;
        color: #aad4ff;
        position: absolute;
        top: 16px;
        right: 14px;
        animation: dix-zzz-float 2s ease-in-out infinite;
        pointer-events: none;
      }
      #dix-chat {
        position: fixed;
        right: 18px;
        bottom: 148px;
        width: 300px;
        height: 400px;
        background: #0d1117;
        border: 1.5px solid #FF6B00;
        border-radius: 12px;
        display: none;
        flex-direction: column;
        z-index: 9999;
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(255,107,0,0.2);
        font-family: system-ui, sans-serif;
      }
      .dix-chat-header {
        background: #FF6B00;
        color: #fff;
        padding: 8px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 13px;
        font-weight: bold;
      }
      .dix-chat-close {
        background: none;
        border: none;
        color: #fff;
        font-size: 18px;
        cursor: pointer;
        padding: 0 4px;
        line-height: 1;
      }
      .dix-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .dix-msg {
        max-width: 85%;
        padding: 7px 10px;
        border-radius: 10px;
        font-size: 12px;
        line-height: 1.4;
        white-space: pre-wrap;
      }
      .dix-msg-bot { background: #1a1f2e; color: #e0e0e0; align-self: flex-start; border: 1px solid #333; }
      .dix-msg-user { background: #FF6B00; color: #fff; align-self: flex-end; }
      .dix-chat-input-row {
        display: flex;
        padding: 8px;
        gap: 6px;
        border-top: 1px solid #222;
      }
      .dix-chat-input {
        flex: 1;
        background: #1a1f2e;
        border: 1px solid #333;
        border-radius: 6px;
        color: #e0e0e0;
        padding: 6px 8px;
        font-size: 12px;
        outline: none;
      }
      .dix-chat-input:focus { border-color: #FF6B00; }
      .dix-chat-send {
        background: #FF6B00;
        border: none;
        border-radius: 6px;
        color: #fff;
        padding: 6px 10px;
        cursor: pointer;
        font-size: 13px;
        font-weight: bold;
      }
      .dix-chat-send:disabled { opacity: 0.5; cursor: default; }
      .dix-heart {
        position: fixed;
        pointer-events: none;
        font-size: 20px;
        z-index: 9999;
        animation: dix-heart-rise 1.4s ease-out forwards;
      }
      @keyframes dix-heart-rise {
        0% { transform: translateY(0) scale(1); opacity: 1; }
        100% { transform: translateY(-60px) scale(1.4); opacity: 0; }
      }
      .dix-badge {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%,-50%) scale(0);
        background: linear-gradient(135deg, #FF6B00, #ff9a00);
        color: #fff;
        padding: 18px 28px;
        border-radius: 14px;
        font-family: monospace;
        font-size: 18px;
        font-weight: bold;
        z-index: 99999;
        box-shadow: 0 8px 40px rgba(255,107,0,0.5);
        text-align: center;
        pointer-events: none;
        animation: dix-badge-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;
      }
      @keyframes dix-badge-pop {
        to { transform: translate(-50%,-50%) scale(1); }
      }
      .dix-bubble {
        position: fixed;
        background: #fff;
        color: #111;
        border-radius: 10px;
        padding: 6px 10px;
        font-size: 12px;
        font-family: system-ui, sans-serif;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 9999;
        pointer-events: none;
        max-width: 180px;
        text-align: center;
        animation: dix-bubble-in 0.2s ease-out;
      }
      .dix-bubble::after {
        content: '';
        position: absolute;
        bottom: -8px;
        left: 50%;
        transform: translateX(-50%);
        border: 5px solid transparent;
        border-top-color: #fff;
        border-bottom: none;
      }
      @keyframes dix-bubble-in { from { opacity:0; transform: scale(0.8); } to { opacity:1; transform: scale(1); } }
      .dix-confetti {
        position: fixed;
        width: 8px;
        height: 8px;
        pointer-events: none;
        z-index: 9999;
        animation: dix-fall 2s ease-in forwards;
      }
      @keyframes dix-fall {
        to { transform: translateY(100vh) rotate(720deg); opacity: 0; }
      }
    `;
    const tag = document.createElement('style');
    tag.id = 'dix-styles';
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  // ─── DOM BUILD ────────────────────────────────────────────────────────────────
  function buildDOM() {
    // shadow
    shadowEl = document.createElement('div');
    shadowEl.id = 'dix-shadow';
    document.body.appendChild(shadowEl);

    // sprite bot
    botEl = document.createElement('div');
    botEl.id = 'dix-bot';
    document.body.appendChild(botEl);

    // zzz external
    zzzEl = document.createElement('div');
    zzzEl.id = 'dix-zzz';
    zzzEl.textContent = 'Z z z';
    document.body.appendChild(zzzEl);

    // house
    houseEl = document.createElement('div');
    houseEl.id = 'dix-house';
    houseEl.innerHTML = `
      <div class="dix-house-roof"></div>
      <div class="dix-house-body">
        <div class="dix-house-sign">INFO DIXSYSTEM</div>
        <div class="dix-house-row">
          <div class="dix-house-window"></div>
          <div class="dix-house-door" id="dix-door"><span>D</span></div>
        </div>
        <div class="dix-house-zzz" id="dix-house-zzz">Z z z</div>
      </div>
    `;
    document.body.appendChild(houseEl);

    // chat
    chatEl = document.createElement('div');
    chatEl.id = 'dix-chat';
    chatEl.innerHTML = `
      <div class="dix-chat-header">
        <span>🤖 DIX — DixSystem</span>
        <button class="dix-chat-close" id="dix-chat-close">✕</button>
      </div>
      <div class="dix-chat-messages" id="dix-chat-messages"></div>
      <div class="dix-chat-input-row">
        <input class="dix-chat-input" id="dix-chat-input" placeholder="Pregúntame algo..." />
        <button class="dix-chat-send" id="dix-chat-send">➤</button>
      </div>
    `;
    document.body.appendChild(chatEl);

    // events
    document.getElementById('dix-door').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      releaseDix();
    });
    document.getElementById('dix-chat-close').addEventListener('click', closeChat);
    document.getElementById('dix-chat-send').addEventListener('click', sendChat);
    document.getElementById('dix-chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendChat();
    });
  }

  // ─── SPRITE RENDERING ────────────────────────────────────────────────────────
  function setAnim(name) {
    const a = ANIMS[name];
    if (!a || currentAnim === a) return;
    currentAnim = a;
    animFrame = 0;
    animTimer = 0;
  }

  function renderSprite() {
    const a = currentAnim;
    const col = (a.col !== undefined) ? a.col : animFrame % a.frames;
    const row = a.row;
    const s = a.s;
    const bx = -(col * s.w);
    const by = -(s.offsetY + row * s.h);

    // When using S2, background-size must account for the full combined sheet
    botEl.style.backgroundPosition = `${bx}px ${by}px`;
    botEl.style.backgroundSize = `${SHEET_W}px ${SHEET_H}px`;

    // Resize div to match current sheet cell
    botEl.style.width = s.w + 'px';
    botEl.style.height = s.h + 'px';
    const scale = DISPLAY / Math.max(s.w, s.h);
    botEl.style.transform = `scaleX(${facing}) scale(${scale})`;
  }

  function tickAnim() {
    animTimer++;
    if (animTimer >= ANIM_SPEED) {
      animTimer = 0;
      if (currentAnim.col === undefined) {
        animFrame = (animFrame + 1) % currentAnim.frames;
      }
    }
  }

  // ─── PHYSICS TICK ─────────────────────────────────────────────────────────────
  function tickPhysics() {
    FLOOR = getFloor();

    if (state === STATES.HOUSE || state === STATES.CHAT || state === STATES.IDLE ||
        state === STATES.SLEEP || state === STATES.GRABBED) return;

    if (state === STATES.WALK) {
      vx = facing * WALK_SPEED;
    }

    if (!onGround) {
      vy += GRAVITY;
    }

    x += vx;
    y += vy;

    // floor collision
    if (y >= FLOOR) {
      y = FLOOR;
      vy = 0;
      onGround = true;
      if (state === STATES.FALL || state === STATES.JUMP) {
        setState(STATES.WALK);
      }
    } else {
      onGround = false;
    }

    // walls
    const maxX = window.innerWidth - 80;
    if (x < 80) { x = 80; facing = 1; }
    if (x > maxX) { x = maxX; facing = -1; }
  }

  // ─── POSITION UPDATE ──────────────────────────────────────────────────────────
  function applyPosition() {
    if (state === STATES.HOUSE) return;
    const hw = DISPLAY / 2;
    botEl.style.left = (x - hw) + 'px';
    botEl.style.top = y + 'px';

    // shadow
    const distToFloor = FLOOR - y;
    const shadowOpacity = Math.max(0, Math.min(0.5, 1 - distToFloor / 400));
    const shadowScale = Math.max(0.2, Math.min(1, 1 - distToFloor / 500));
    shadowEl.style.left = x + 'px';
    shadowEl.style.top = (FLOOR + S1.h * 0.1) + 'px';
    shadowEl.style.opacity = shadowOpacity;
    shadowEl.style.transform = `translateX(-50%) scaleX(${shadowScale})`;

    // zzz
    if (state === STATES.SLEEP) {
      zzzEl.style.display = 'block';
      zzzEl.style.left = (x + 20) + 'px';
      zzzEl.style.top = (y - 30) + 'px';
    } else {
      zzzEl.style.display = 'none';
    }
  }

  // ─── STATE MACHINE ────────────────────────────────────────────────────────────
  function setState(newState) {
    state = newState;
    stateTimer = 0;

    switch (newState) {
      case STATES.WALK:
        setAnim('WALK');
        botEl.style.display = 'block';
        vx = facing * WALK_SPEED;
        break;
      case STATES.IDLE:
        setAnim('IDLE');
        vx = 0; vy = 0;
        lastIdleTime = Date.now();
        break;
      case STATES.SCARED:
        setAnim('SCARED');
        vy = -5;
        vx = -facing * 3;
        onGround = false;
        showBubble('¡Ahhh! 😱');
        break;
      case STATES.ANGRY:
        setAnim('ANGRY_ANIM');
        vx = 0;
        showBubble('😤 ¡Eso duele!');
        break;
      case STATES.FALL:
        setAnim('FALL_ANIM');
        onGround = false;
        break;
      case STATES.JUMP:
        setAnim('JUMP');
        vy = -6;
        onGround = false;
        break;
      case STATES.SLEEP:
        setAnim('SLEEP_ANIM');
        vx = 0; vy = 0;
        showBubble('Z z z... 💤');
        break;
      case STATES.CHAT:
        setAnim('CHAT_ANIM');
        vx = 0; vy = 0;
        chatEl.style.display = 'flex';
        break;
      case STATES.GRABBED:
        setAnim('SCARED_JUMP');
        break;
      case STATES.CLIMB:
        setAnim('CLIMB');
        break;
      case STATES.PERCH:
        setAnim('IDLE');
        vx = 0; vy = 0;
        break;
      case STATES.HOUSE:
        botEl.style.display = 'none';
        shadowEl.style.display = 'none';
        break;
    }
  }

  // ─── AUTO BEHAVIORS ───────────────────────────────────────────────────────────
  const IDLE_PHRASES = ['Hmm... 🤔','Interesante...','¿Todo bien?','Buen sistema 💻','¿Ya tienes DIX? 😏','Kernel tuning... 🔧','...','¡Hola! 👋'];
  const POINT_PHRASES = ['€14.99 → mejor inversión 🔥','¡Compra DIX! 🚀','Solo €14.99 💚','Tu kernel lo necesita 😤'];

  function triggerBehavior() {
    const now = Date.now();
    const roll = Math.random();

    if (!waved) {
      waved = true;
      doWave();
      return;
    }

    if (roll < 0.3 && now - lastIdleTime > 12000) {
      doIdle();
    } else if (roll < 0.5 && now - lastClimbTime > 25000 && onGround) {
      doClimb();
    } else if (roll < 0.7) {
      doLook();
    } else {
      doPoint();
    }
  }

  function doIdle() {
    setState(STATES.IDLE);
    const phrase = IDLE_PHRASES[Math.floor(Math.random() * IDLE_PHRASES.length)];
    showBubble(phrase);
    const dur = 2000 + Math.random() * 2000;
    setTimeout(() => { if (state === STATES.IDLE) setState(STATES.WALK); }, dur);
  }

  function doWave() {
    const prev = state;
    setAnim('WAVE');
    showBubble('¡Hola! Soy DIX 👋');
    setTimeout(() => { if (state === prev || state === STATES.WALK) { setAnim('WALK'); } }, 2500);
  }

  function doClimb() {
    lastClimbTime = Date.now();
    setState(STATES.CLIMB);
    const dur = 800 + Math.random() * 400;
    setTimeout(() => {
      if (state === STATES.CLIMB) {
        y -= 60;
        setState(STATES.PERCH);
        const downDelay = 5000 + Math.random() * 3000;
        setTimeout(() => {
          if (state === STATES.PERCH) {
            vy = -6;
            setState(STATES.FALL);
          }
        }, downDelay);
      }
    }, dur);
  }

  function doLook() {
    setAnim('THINK');
    showBubble('Hmm... 🤔');
    setTimeout(() => { if (state === STATES.WALK) setAnim('WALK'); }, 2000);
  }

  function doPoint() {
    setAnim('POINT');
    const phrase = POINT_PHRASES[Math.floor(Math.random() * POINT_PHRASES.length)];
    showBubble(phrase);
    setTimeout(() => { if (state === STATES.WALK) setAnim('WALK'); }, 2000);
  }

  // ─── WALK TICK ────────────────────────────────────────────────────────────────
  let sleepCheckTimer = 0;
  function tickWalk() {
    if (state !== STATES.WALK) return;

    // random behavior
    if (Math.random() > 0.998) triggerBehavior();

    // sleep after inactivity
    sleepCheckTimer++;
    if (sleepCheckTimer > 60 * 40) { // 40s @ 60fps
      const idle = Date.now() - lastActivity;
      if (idle > 40000) {
        sleepCheckTimer = 0;
        setState(STATES.SLEEP);
        setTimeout(() => { if (state === STATES.SLEEP) setState(STATES.WALK); }, 20000);
      }
    }
  }

  // ─── DRAG & DROP ──────────────────────────────────────────────────────────────
  let dragging = false, dragStartX = 0, dragStartY = 0;
  let lastPx = 0, lastPy = 0, releaseVx = 0, releaseVy = 0;
  let dragOffX = 0, dragOffY = 0;

  function onPointerDown(e) {
    if (state === STATES.HOUSE) return;
    e.preventDefault();
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragOffX = e.clientX - x;
    dragOffY = e.clientY - y;
    lastPx = e.clientX; lastPy = e.clientY;
    releaseVx = 0; releaseVy = 0;
    dragging = false;
    lastActivity = Date.now();

    botEl.setPointerCapture(e.pointerId);
    botEl.addEventListener('pointermove', onPointerMove);
    botEl.addEventListener('pointerup', onPointerUp);
    botEl.addEventListener('pointercancel', onPointerUp);
  }

  function onPointerMove(e) {
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    if (!dragging && Math.hypot(dx, dy) > 5) {
      dragging = true;
      setState(STATES.GRABBED);
    }
    if (dragging) {
      releaseVx = e.clientX - lastPx;
      releaseVy = e.clientY - lastPy;
      lastPx = e.clientX;
      lastPy = e.clientY;
      x = e.clientX - dragOffX + DISPLAY / 2;
      y = e.clientY - dragOffY;
    }
    lastActivity = Date.now();
  }

  function onPointerUp(e) {
    botEl.removeEventListener('pointermove', onPointerMove);
    botEl.removeEventListener('pointerup', onPointerUp);
    botEl.removeEventListener('pointercancel', onPointerUp);

    if (!dragging) {
      // mimo
      doMimo(e.clientX, e.clientY);
    } else {
      const speed = Math.hypot(releaseVx, releaseVy);
      // check if near house
      const hr = houseEl.getBoundingClientRect();
      const nearHouse = Math.hypot(e.clientX - (hr.left + hr.width / 2), e.clientY - (hr.top + hr.height / 2)) < 80;

      if (nearHouse) {
        openChat();
      } else if (speed > 8) {
        throwCount++;
        vx = releaseVx * 0.8;
        vy = releaseVy * 0.8;
        onGround = false;
        setState(STATES.FALL);
        if (throwCount >= 3) goAngry();
      } else {
        vx = facing * WALK_SPEED;
        setState(STATES.WALK);
      }
    }
    dragging = false;
    lastActivity = Date.now();
  }

  // ─── MIMO ─────────────────────────────────────────────────────────────────────
  function doMimo(cx, cy) {
    petCount++;
    anger = Math.max(0, anger - 1);
    spawnHeart(cx || x, cy || y);
    lastActivity = Date.now();

    if (petCount === 5) showBadge('DIXLOVE-2', '¡2€ de descuento! ❤');
    if (state === STATES.ANGRY && petCount % 3 === 0) {
      restorePrice();
      anger = 0;
      setState(STATES.WALK);
    }
    if (state === STATES.SLEEP) {
      setState(STATES.WALK);
    }
  }

  // ─── ANGRY ────────────────────────────────────────────────────────────────────
  function goAngry() {
    anger++;
    setState(STATES.ANGRY);
    updatePrice('€17.99');
    showBubble('😤 ¡Te pasas!');
    setTimeout(() => {
      if (state === STATES.ANGRY) {
        setState(STATES.WALK);
        restorePrice();
      }
    }, 6000);
  }

  function updatePrice(val) {
    document.querySelectorAll('.dix-price, [data-dix-price]').forEach(el => { el.textContent = val; });
  }
  function restorePrice() { updatePrice('€14.99'); }

  // ─── HOUSE ────────────────────────────────────────────────────────────────────
  function releaseDix() {
    if (state !== STATES.HOUSE) return;
    const hr = houseEl.getBoundingClientRect();
    x = hr.left + hr.width / 2;
    y = hr.top;
    FLOOR = getFloor();
    vy = -6;
    vx = facing * WALK_SPEED;
    onGround = false;
    botEl.style.display = 'block';
    shadowEl.style.display = 'block';
    document.getElementById('dix-house-zzz').style.display = 'none';
    setState(STATES.FALL);
  }

  // ─── CHAT ─────────────────────────────────────────────────────────────────────
  function openChat() {
    setState(STATES.CHAT);
    chatEl.style.display = 'flex';
    const msgsEl = document.getElementById('dix-chat-messages');
    if (!msgsEl.children.length) {
      addChatMsg('bot', '¡Hola! Soy DIX 🤖 ¿En qué te puedo ayudar?');
    }
    document.getElementById('dix-chat-input').focus();
  }

  function closeChat() {
    chatEl.style.display = 'none';
    setState(STATES.WALK);
  }

  function addChatMsg(who, text) {
    const msgsEl = document.getElementById('dix-chat-messages');
    const div = document.createElement('div');
    div.className = `dix-msg dix-msg-${who}`;
    div.textContent = text;
    msgsEl.appendChild(div);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return div;
  }

  async function sendChat() {
    const input = document.getElementById('dix-chat-input');
    const btn = document.getElementById('dix-chat-send');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    btn.disabled = true;
    addChatMsg('user', text);
    const typing = addChatMsg('bot', '...');

    try {
      const res = await fetch('https://dix-proxy.dixsystem.workers.dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 400,
          system: 'Eres DIX, asistente comercial de DixSystem. Conciso, amigable, responde en el idioma del usuario. DixSystem: app nativa Linux/Windows que lee métricas del kernel Linux, usa Claude AI para analizarlas y genera scripts bash de optimización personalizados. Precio: €14.99 pago único. BYOK gratis con API key propia de Anthropic. dixsystem.com',
          messages: [{ role: 'user', content: text }]
        })
      });
      const data = await res.json();
      typing.textContent = data.content?.[0]?.text || 'Sin respuesta 😅';
    } catch (err) {
      typing.textContent = '⚠️ Error de conexión';
    }
    btn.disabled = false;
  }

  // ─── PARTICLES ────────────────────────────────────────────────────────────────
  function spawnHeart(cx, cy) {
    const el = document.createElement('div');
    el.className = 'dix-heart';
    el.textContent = '❤';
    el.style.left = (cx + (Math.random() * 20 - 10)) + 'px';
    el.style.top = (cy - 20) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  function spawnConfetti(cx, cy, count) {
    const colors = ['#FF6B00','#ff0','#0f0','#0ff','#f0f','#fff'];
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'dix-confetti';
      el.style.left = (cx + (Math.random() - 0.5) * 200) + 'px';
      el.style.top = cy + 'px';
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      el.style.animationDuration = (1.5 + Math.random()) + 's';
      el.style.animationDelay = (Math.random() * 0.5) + 's';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 2500);
    }
  }

  function showBadge(code, text) {
    const el = document.createElement('div');
    el.className = 'dix-badge';
    el.innerHTML = `🎉 ${code}<br><small style="font-size:13px;font-weight:normal">${text}</small>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  let bubbleEl = null;
  function showBubble(text) {
    clearTimeout(bubbleTimeout);
    if (bubbleEl) bubbleEl.remove();
    bubbleEl = document.createElement('div');
    bubbleEl.className = 'dix-bubble';
    bubbleEl.textContent = text;
    bubbleEl.style.left = (x - 60) + 'px';
    bubbleEl.style.top = (y - 50) + 'px';
    document.body.appendChild(bubbleEl);
    bubbleTimeout = setTimeout(() => { if (bubbleEl) { bubbleEl.remove(); bubbleEl = null; } }, 2200);
  }

  // ─── MOUSE TRACKING (SCARED) ──────────────────────────────────────────────────
  let lastMouseX = 0, lastMouseY = 0, lastMouseTime = 0;
  document.addEventListener('mousemove', (e) => {
    const now = Date.now();
    const dt = now - lastMouseTime || 16;
    const speed = Math.hypot(e.clientX - lastMouseX, e.clientY - lastMouseY) / dt * 16;
    lastMouseX = e.clientX; lastMouseY = e.clientY; lastMouseTime = now;
    lastActivity = now;

    if (state === STATES.WALK && speed > 15) {
      const dist = Math.hypot(e.clientX - x, e.clientY - y);
      if (dist < 100) setState(STATES.SCARED);
    }
  });

  // ─── SCROLL ───────────────────────────────────────────────────────────────────
  let lastScrollY = 0, lastScrollTime = 0;
  window.addEventListener('scroll', () => {
    const now = Date.now();
    const dy = Math.abs(window.scrollY - lastScrollY);
    const dt = now - lastScrollTime || 16;
    const speed = dy / dt * 100;
    lastScrollY = window.scrollY;
    lastScrollTime = now;
    lastActivity = now;
    if (speed > 50 && (state === STATES.WALK || state === STATES.IDLE)) {
      setAnim('KICK');
      showBubble('¡Whoaaa! 😵');
      setTimeout(() => { if (state === STATES.WALK || state === STATES.IDLE) setAnim('WALK'); }, 1000);
    }
  });

  // ─── KONAMI ───────────────────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.code === KONAMI[konamiIdx]) {
      konamiIdx++;
      if (konamiIdx === KONAMI.length) {
        konamiIdx = 0;
        showBadge('DIXMASTER-2', '¡2€ de descuento! 🎮');
        spawnConfetti(window.innerWidth / 2, 100, 50);
        setAnim('CHEER');
        setTimeout(() => { if (state === STATES.WALK) setAnim('WALK'); }, 2000);
      }
    } else {
      konamiIdx = 0;
    }
  });

  // ─── STATE TIMER TICK ────────────────────────────────────────────────────────
  function tickStateTimer(dt) {
    stateTimer += dt;
    switch (state) {
      case STATES.SCARED:
        if (stateTimer > 1200) setState(STATES.WALK);
        break;
    }
  }

  // ─── MAIN LOOP ────────────────────────────────────────────────────────────────
  let lastTime = 0;
  function loop(ts) {
    const dt = ts - lastTime;
    lastTime = ts;

    tickAnim();
    tickPhysics();
    tickWalk();
    tickStateTimer(dt);
    applyPosition();
    renderSprite();

    requestAnimationFrame(loop);
  }

  // ─── INIT ─────────────────────────────────────────────────────────────────────
  function init() {
    injectCSS();
    buildDOM();
    FLOOR = getFloor();
    x = window.innerWidth / 2;
    y = FLOOR;
    botEl.style.display = 'none';
    shadowEl.style.display = 'none';
    botEl.addEventListener('pointerdown', onPointerDown);
    botEl.addEventListener('contextmenu', (e) => { e.preventDefault(); doMimo(e.clientX, e.clientY); });
    window.addEventListener('resize', () => { FLOOR = getFloor(); });
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
