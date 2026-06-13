(() => {
'use strict';

/* ═══════════════════════════════════════════════
   DIXBOT v2 — GTA VI PREMIUM ENGINE
   DixSystem © 2026
═══════════════════════════════════════════════ */

class DixbotV2 {
  constructor(opts = {}) {
    this.cfg = {
      size: 160,
      base: opts.assetBase || './assets/poses/',
      basePrice: 14.99,
      calmPrice: 16.99,
      devilPrice: 17.99,
      gravity: 0.44,
      friction: 0.983,
      bounce: 0.44,
      floor: 20,
      maxChaos: 2,
      maxDevil: 1,
      walkFPS: 6,           // frames por segundo animación walk
      trailLen: 12,         // longitud trail naranja
      maxParticles: 120,
      poses: {
        walk_a: 'walk_a.png',
        walk_b: 'walk_b.png',
        fall:   'fall.png',
        angry:  'angry.png',
        sleep:  'sleep.png',
        punch:  'punch.png',
      }
    };

    // Estado
    this.S = Object.freeze({
      HOUSE:'HOUSE', WANDER:'WANDER', IDLE:'IDLE', GRABBED:'GRABBED',
      FALLING:'FALLING', WALL:'WALL', CHASE:'CHASE', CHAOS:'CHAOS',
      DEVIL:'DEVIL', SLEEP:'SLEEP', HAPPY:'HAPPY', DANCE:'DANCE',
      CHAT:'CHAT', OFF:'OFF'
    });
    this.state = this.S.HOUSE;
    this.prev  = null;

    // Bot físico
    this.bot = { x: window.innerWidth - 90, y: window.innerHeight - 80,
                 vx: 0, vy: 0, facing: -1, static: true, visible: false, angle: 0 };

    // Contadores
    this.anger = 0; this.mood = 0; this.caress = 0; this.trust = 0;
    this.chaosUsed = 0; this.devilUsed = 0;
    this.discounts = new Set();

    // Walk animation
    this.walkFrame = 0; this.walkTimer = 0;

    // Trail
    this.trail = [];

    // Partículas vivas
    this.pAlive = 0;

    // Drag
    this.drag = { on: false, moved: false, ox: 0, oy: 0, vx: 0, vy: 0 };

    // Pointer
    this.ptr = { x: window.innerWidth / 2, y: window.innerHeight / 2,
                 vx: 0, vy: 0, idleSince: performance.now(), lastAt: performance.now() };

    // Timers activos
    this.timers = new Set();

    // Caress
    this.caressState = { on: false, startedAt: 0, stage: 0 };

    // Sesión
    this.sess = { chaosAt: 0, devilAt: 0, nagAt: 0, startAt: performance.now() };
    this.lastScroll = { y: window.scrollY, t: performance.now() };

    // Konami
    this.KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA'];
    this.konamiIdx = 0;

    // Misc flags
    this.l1said = false; this.l2said = false;
    this.houseRect = null;
    this.env = [];
    this.priceEls = [];
    this.origPrices = new Map();
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.lastDevCheck = 0;
    this.angryChaseAt = 0;
    this.lastChaosBreak = 0;
    this.lastDevilBreak = 0;
    this.chaosModest = 0;
    this.chaseAt = 0;
    this.fallingAt = 0;
    this.lastCuriosityAt = 0;
    this.lastNoDisturbAt = 0;
    this.lastNagAt = 0;
    this.lastAngryAttackAt = 0;
    this.lastClickPetAt = 0;
    this.lastFrameAt = performance.now();
    this.rafId = 0;
    this.counterEl = null;

    this._init();
  }

  /* ─── INIT ─────────────────────────────────── */
  _init() {
    this._buildHUD();
    this._buildHouse();
    this._buildBot();
    this._buildCanvas();
    this._bindEvents();
    this._startupCtx();
    this._setState(this.S.HOUSE);
    this.rafId = requestAnimationFrame(t => this._loop(t));
    window.DIXBOT = this;
    this._emit('ready', {});
  }

  /* ─── HUD GTA ───────────────────────────────── */
  _buildHUD() {
    this.hud = document.createElement('div');
    this.hud.id = 'dix-hud';
    this.hud.innerHTML = `
      <div class="dix-hud-inner">
        <div class="dix-wanted">
          <span class="dix-wanted-label">ANGER</span>
          <div class="dix-stars" id="dix-stars">
            ${[1,2,3,4,5,6,7].map(i=>`<div class="dix-star-seg" data-n="${i}"></div>`).join('')}
          </div>
        </div>
        <div class="dix-notification" id="dix-notif"></div>
      </div>`;
    document.body.appendChild(this.hud);
    this.hudStars = this.hud.querySelectorAll('.dix-star-seg');
    this.hudNotif = this.hud.querySelector('#dix-notif');
  }

  _updateHUD() {
    this.hudStars.forEach((s, i) => {
      s.classList.toggle('active', i < this.anger);
      s.classList.toggle('critical', i < this.anger && this.anger >= 5);
      s.classList.toggle('devil', this.state === this.S.DEVIL);
    });
  }

  _gtaNotif(title, sub = '', color = '#FF6B00') {
    this.hudNotif.innerHTML = `<div class="dix-notif-bar" style="--nc:${color}">
      <div class="dix-notif-title">${title}</div>
      ${sub ? `<div class="dix-notif-sub">${sub}</div>` : ''}
    </div>`;
    this.hudNotif.classList.add('show');
    clearTimeout(this._notifTimer);
    this._notifTimer = setTimeout(() => this.hudNotif.classList.remove('show'), 4000);
  }

  /* ─── HOUSE ─────────────────────────────────── */
  _buildHouse() {
    this.house = document.createElement('div');
    this.house.className = 'dix-house';
    this.house.innerHTML = `
      <div class="dix-house-roof"></div>
      <div class="dix-house-shell">
        <div class="dix-house-title">INFO DIXSYSTEM</div>
        <div class="dix-house-window"></div>
        <div class="dix-house-peek"></div>
        <button class="dix-house-door" aria-label="Abrir puerta DIXBOT">D</button>
        <div class="dix-house-zzz">ZZZ</div>
      </div>`;
    document.body.appendChild(this.house);
    this.house.style.setProperty('--peek', `url("${this.cfg.base}${this.cfg.poses.sleep}")`);

    this.svcBtn = document.createElement('button');
    this.svcBtn.className = 'dix-svc-btn';
    this.svcBtn.textContent = 'DIXBOT FUERA DE SERVICIO';
    document.body.appendChild(this.svcBtn);

    this.helpBtn = document.createElement('button');
    this.helpBtn.className = 'dix-help-btn';
    this.helpBtn.textContent = '?';
    document.body.appendChild(this.helpBtn);

    this.house.querySelector('.dix-house-door').addEventListener('click', e => { e.stopPropagation(); this._release(); });
    this.house.addEventListener('click', () => { if ([this.S.OFF, this.S.SLEEP].includes(this.state)) this._returnHouse(true); });
    this.svcBtn.addEventListener('click', () => this._outOfService());
    this.helpBtn.addEventListener('click', () => this._secrets());
  }

  /* ─── BOT + CANVAS ──────────────────────────── */
  _buildBot() {
    this.root = document.createElement('div');
    this.root.className = 'dix-bot hidden';
    this.root.setAttribute('role', 'button');
    this.root.setAttribute('aria-label', 'DIXBOT mascota');
    document.body.appendChild(this.root);
    this._pose('walk_a');

    this.shadow = document.createElement('div');
    this.shadow.className = 'dix-shadow';
    document.body.appendChild(this.shadow);

    this.bubble = document.createElement('div');
    this.bubble.className = 'dix-bubble';
    document.body.appendChild(this.bubble);
  }

  _buildCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'dix-canvas';
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    document.body.appendChild(this.canvas);
    this.ctx2d = this.canvas.getContext('2d');
    window.addEventListener('resize', () => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }, { passive: true });
  }

  /* ─── EVENTS ────────────────────────────────── */
  _bindEvents() {
    window.addEventListener('pointermove',  e => this._onMove(e),   { passive: true });
    window.addEventListener('pointerdown',  e => this._onDown(e),   { passive: false });
    window.addEventListener('pointerup',    e => this._onUp(e),     { passive: false });
    window.addEventListener('pointercancel',e => this._onUp(e),     { passive: true });
    window.addEventListener('contextmenu',  e => { if (this._onBot(e.clientX, e.clientY)) e.preventDefault(); });
    window.addEventListener('scroll',       () => this._onScroll(), { passive: true });
    window.addEventListener('resize',       this._debounce(() => this._cacheEnv(), 140), { passive: true });
    window.addEventListener('copy',         () => this._onCopy());
    window.addEventListener('keydown',      e => this._onKey(e));
    document.addEventListener('visibilitychange', () => { if (document.hidden) this._setState(this.S.IDLE); });
  }

  _startupCtx() {
    const h = new Date().getHours();
    if (h >= 22 || h < 6) this.house.classList.add('sleeping');
    if (new Date().getDay() === 1) this._timer(() => this._say('Yo tampoco quería currar hoy 😒', 2600), 1800);
  }

  /* ─── MAIN LOOP ─────────────────────────────── */
  _loop(now) {
    const dt = Math.min(34, now - this.lastFrameAt) / 16.67;
    this.lastFrameAt = now;
    this._detectDev(now);
    this._update(dt, now);
    this._renderCanvas(now);
    this._renderDOM();
    this.rafId = requestAnimationFrame(t => this._loop(t));
  }

  _update(dt, now) {
    if ([this.S.HOUSE, this.S.OFF, this.S.CHAT].includes(this.state)) return;
    if (this._noDisturb()) this._updateNoDisturb();
    if (this.caressState.on) this._updateCaress(now);
    if (!this.bot.static) this._physics(dt);

    // Walk animation
    if ([this.S.WANDER, this.S.CHASE].includes(this.state)) {
      this.walkTimer += dt;
      if (this.walkTimer >= 16.67 / this.cfg.walkFPS) {
        this.walkTimer = 0;
        this.walkFrame = this.walkFrame === 0 ? 1 : 0;
        this._pose(this.walkFrame === 0 ? 'walk_a' : 'walk_b');
      }
    }

    if (this.state === this.S.WANDER)    this._updateWander(dt, now);
    if (this.state === this.S.FALLING)   this._updateFalling(now);
    if (this.state === this.S.CHASE)     this._updateChase(dt, now);
    if (this.state === this.S.CHAOS)     this._updateChaos(dt, now);
    if (this.state === this.S.DEVIL)     this._updateDevil(dt, now);
    if ([this.S.IDLE, this.S.WANDER].includes(this.state)) this._updateCuriosity(now);
    this._checkNag(now);
  }

  /* ─── PHYSICS ───────────────────────────────── */
  _physics(dt) {
    if (![this.S.GRABBED, this.S.WALL].includes(this.state)) this.bot.vy += this.cfg.gravity * dt;
    this.bot.vx *= Math.pow(this.cfg.friction, dt);
    this.bot.vy *= Math.pow(this.cfg.friction, dt);
    this.bot.x  += this.bot.vx * dt;
    this.bot.y  += this.bot.vy * dt;
    this._bounds();
  }

  _bounds() {
    const h = this.cfg.size / 2;
    const maxX = window.innerWidth  - h - 3;
    const maxY = window.innerHeight - h - this.cfg.floor;
    let hit = false;
    if (this.bot.x < h + 3) { this.bot.x = h + 3; this.bot.vx =  Math.abs(this.bot.vx) * this.cfg.bounce; hit = true; }
    if (this.bot.x > maxX)  { this.bot.x = maxX;   this.bot.vx = -Math.abs(this.bot.vx) * this.cfg.bounce; hit = true; }
    if (this.bot.y < h + 3) { this.bot.y = h + 3;  this.bot.vy =  Math.abs(this.bot.vy) * this.cfg.bounce; hit = true; }
    if (this.bot.y > maxY)  { this.bot.y = maxY;    this.bot.vy = -Math.abs(this.bot.vy) * this.cfg.bounce; hit = true; }
    if (hit) this._onImpact(Math.hypot(this.bot.vx, this.bot.vy));
  }

  /* ─── STATES UPDATE ─────────────────────────── */
  _updateWander(dt, now) {
    const spd = this.anger >= 3 ? 2.8 : 1.2;
    if (Math.abs(this.bot.vx) < spd) this.bot.vx += this.bot.facing * (this.anger >= 3 ? 0.09 : 0.038) * dt;
    if (this.bot.x < 130) this.bot.facing = 1;
    if (this.bot.x > window.innerWidth - 220) this.bot.facing = -1;
    if (Math.random() < 0.002 && !this.reducedMotion) this.bot.vy -= 4;
    if (this.anger >= 5 && now - this.lastAngryAttackAt > 3500) {
      this.lastAngryAttackAt = now; this._attackInteractive();
    }
  }

  _updateFalling(now) {
    if (Math.abs(this.bot.vy) < 0.8 && this.bot.y > window.innerHeight - this.cfg.size) {
      this._setState(this.S.WANDER);
      this._pose(this.anger >= 3 ? 'angry' : 'walk_a');
    }
    if (now - this.fallingAt > 2200) this._setState(this.S.WANDER);
  }

  _updateChase(dt, now) {
    const dx = this.ptr.x - this.bot.x, dy = this.ptr.y - this.bot.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    this.bot.vx += (dx / len) * 0.85 * dt;
    this.bot.vy += (dy / len) * 0.38 * dt;
    this.bot.facing = dx >= 0 ? 1 : -1;
    if (now - this.chaseAt > 3000) this._setState(this.S.WANDER);
  }

  _updateChaos(dt, now) {
    if (now - this.sess.chaosAt > 10000) { this._endChaos(); return; }
    this.bot.vx += (Math.random() - 0.5) * 1.3 * dt;
    this.bot.vy += (Math.random() - 0.62) * 0.75 * dt;
    this.bot.vx = this._clamp(this.bot.vx, -16, 16);
    this.bot.vy = this._clamp(this.bot.vy, -13, 11);
    if (now - this.lastChaosBreak > 600) {
      this.lastChaosBreak = now;
      this._breakElements(2);
      this._spawnPixels(this.bot.x, this.bot.y, 6);
    }
    if (this.chaosModest && now - this.chaosModest > 5000) this._startDevil();
  }

  _updateDevil(dt, now) {
    if (now - this.sess.devilAt > 15000) { this._endDevil(); return; }
    this.bot.vx += (Math.random() - 0.5) * 2.6 * dt;
    this.bot.vy += (Math.random() - 0.5) * 1.7 * dt;
    this.bot.vx = this._clamp(this.bot.vx, -20, 20);
    this.bot.vy = this._clamp(this.bot.vy, -15, 15);
    if (now - this.lastDevilBreak > 240) {
      this.lastDevilBreak = now;
      this._breakElements(4);
      this._spawnPixels(this.bot.x, this.bot.y, 10);
      if (Math.random() < 0.4) this._attackInteractive('pixel');
    }
  }

  _updateCuriosity(now) {
    if (now - this.ptr.idleSince < 30000 || now - this.lastCuriosityAt < 35000) return;
    this.lastCuriosityAt = now;
    const dx = this.ptr.x - this.bot.x;
    this.bot.facing = dx >= 0 ? 1 : -1;
    this.bot.vx += this.bot.facing * 1.9;
    this._say('¿Qué es eso...? 👀', 1800);
  }

  _updateNoDisturb() {
    if ([this.S.CHAOS, this.S.DEVIL, this.S.GRABBED].includes(this.state)) return;
    this.bot.vx *= 0.91; this.bot.vy *= 0.91;
    const now = performance.now();
    if (now - this.lastNoDisturbAt > 12000) {
      this.lastNoDisturbAt = now;
      this._say('Me quedo quieto 🤫', 1800);
    }
  }

  _checkNag(now) {
    if (now - this.sess.startAt < 300000 || now - this.lastNagAt < 300000) return;
    this.lastNagAt = now;
    this._say('¿Sigues aquí? Tu CPU llora 😢', 2600);
  }

  /* ─── CANVAS RENDER (trail + glow) ──────────── */
  _renderCanvas(now) {
    const ctx = this.ctx2d;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.bot.visible) return;

    const speed = Math.hypot(this.bot.vx, this.bot.vy);

    // Trail naranja
    if (speed > 3 && !this.reducedMotion) {
      this.trail.push({ x: this.bot.x, y: this.bot.y, t: now, speed });
      if (this.trail.length > this.cfg.trailLen) this.trail.shift();
      for (let i = 0; i < this.trail.length; i++) {
        const p = this.trail[i];
        const alpha = (i / this.trail.length) * 0.55;
        const radius = (i / this.trail.length) * 22;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
        grad.addColorStop(0, `rgba(255,107,0,${alpha})`);
        grad.addColorStop(1, `rgba(255,107,0,0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }
    } else {
      this.trail = [];
    }

    // Glow bajo DIX (intensidad según estado)
    let glowColor = 'rgba(255,107,0,0.18)';
    let glowR = 55;
    if (this.state === this.S.DEVIL)  { glowColor = 'rgba(255,0,0,0.35)'; glowR = 80; }
    if (this.state === this.S.CHAOS)  { glowColor = 'rgba(255,100,0,0.3)'; glowR = 70; }
    if (this.state === this.S.HAPPY)  { glowColor = 'rgba(100,255,150,0.25)'; glowR = 60; }
    const gx = this.bot.x, gy = this.bot.y;
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, glowR);
    g.addColorStop(0, glowColor);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(gx, gy, glowR, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    // Chromatic aberration en devil mode
    if (this.state === this.S.DEVIL && !this.reducedMotion) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = 'red';
      ctx.fillRect(this.bot.x - 60 + 4, this.bot.y - 60, 120, 120);
      ctx.fillStyle = 'blue';
      ctx.fillRect(this.bot.x - 60 - 4, this.bot.y - 60, 120, 120);
      ctx.restore();
    }

    // Scanlines en chaos/devil
    if ([this.S.DEVIL, this.S.CHAOS].includes(this.state) && !this.reducedMotion) {
      ctx.save();
      ctx.globalAlpha = 0.04;
      ctx.fillStyle = '#000';
      for (let y = 0; y < this.canvas.height; y += 4) {
        ctx.fillRect(0, y, this.canvas.width, 2);
      }
      ctx.restore();
    }
  }

  /* ─── DOM RENDER ────────────────────────────── */
  _renderDOM() {
    const s = this.cfg.size, half = s / 2;
    if (!this.bot.visible) {
      this.shadow.style.opacity = '0';
      return;
    }

    let angle = 0;
    if (this.state === this.S.FALLING) angle = this._clamp(this.bot.vx * 0.028, -0.6, 0.6);
    if (this.state === this.S.WALL)    angle = this.bot.x < window.innerWidth / 2 ? -0.28 : 0.28;

    const sx = this.bot.facing >= 0 ? 1 : -1;
    const speed = Math.hypot(this.bot.vx, this.bot.vy);

    // Motion blur con scaleX según velocidad horizontal
    const blurX = this.reducedMotion ? 0 : Math.min(speed * 0.12, 3);
    const scaleStretch = this.reducedMotion ? 1 : 1 + Math.min(speed * 0.008, 0.15);

    this.root.style.transform = `translate3d(${this.bot.x - half}px,${this.bot.y - half}px,0) scaleX(${sx * scaleStretch}) rotate(${angle}rad)`;
    this.root.style.filter = blurX > 0.5
      ? `drop-shadow(0 20px 22px rgba(0,0,0,.5)) drop-shadow(0 0 18px rgba(255,107,0,.3)) blur(${blurX * 0.3}px)`
      : `drop-shadow(0 20px 22px rgba(0,0,0,.5)) drop-shadow(0 0 18px rgba(255,107,0,.3))`;

    // Sombra dinámica en suelo
    const floorY = window.innerHeight - this.cfg.floor;
    const dist   = Math.max(0, floorY - this.bot.y);
    const sh     = this._clamp(1.1 - dist / 400, 0.3, 1.1);
    this.shadow.style.opacity  = String(this._clamp(0.45 - dist / 500, 0.04, 0.45));
    this.shadow.style.transform = `translate3d(${this.bot.x - 32}px,${floorY - 4}px,0) scale(${sh},${sh * 0.65})`;

    this.bubble.style.left = `${this.bot.x + 28}px`;
    this.bubble.style.top  = `${this.bot.y - 90}px`;
  }

  /* ─── POINTER EVENTS ────────────────────────── */
  _onMove(e) {
    const now = performance.now();
    const dt  = Math.max(16, now - this.ptr.lastAt);
    this.ptr.vx = ((e.clientX - this.ptr.x) / dt) * 16.67;
    this.ptr.vy = ((e.clientY - this.ptr.y) / dt) * 16.67;
    this.ptr.x = e.clientX; this.ptr.y = e.clientY;
    this.ptr.lastAt = now; this.ptr.idleSince = now;
    if (this.drag.on) {
      this.drag.moved = true;
      this.drag.vx = this.ptr.vx; this.drag.vy = this.ptr.vy;
      this.bot.x = e.clientX + this.drag.ox;
      this.bot.y = e.clientY + this.drag.oy;
    }
  }

  _onDown(e) {
    if (!this._onBot(e.clientX, e.clientY)) return;
    if ([this.S.HOUSE, this.S.OFF].includes(this.state)) return;
    e.preventDefault();
    this.ptr.idleSince = performance.now();
    if (this.state === this.S.CHAOS) this.chaosModest = performance.now();
    if (this.state === this.S.DEVIL && e.button === 2) this._endDevil(true);
    if (e.button === 2 || e.pointerType === 'touch') { this._startCaress(); return; }
    this._startDrag(e);
  }

  _onUp(e) {
    if (this.caressState.on) this._endCaress();
    if (!this.drag.on) return;
    e.preventDefault();
    const spd = Math.hypot(this.drag.vx, this.drag.vy);
    const moved = this.drag.moved;
    this.drag.on = false;
    this.root.classList.remove('dix-grabbed');
    this.bot.static = false;
    if (!moved) { this._pet('click'); return; }
    if (this._inHouse(e.clientX, e.clientY)) { this._activateChat(); return; }
    this._endDrag(spd);
  }

  _startDrag(e) {
    this.drag.on = true; this.drag.moved = false; this.drag.vx = 0; this.drag.vy = 0;
    this.drag.ox = this.bot.x - e.clientX; this.drag.oy = this.bot.y - e.clientY;
    this.bot.static = true; this._setState(this.S.GRABBED);
    this.root.classList.add('dix-grabbed'); this._pose('angry');
  }

  _endDrag(spd) {
    this.bot.static = false;
    this.bot.vx = this.drag.vx * 1.1; this.bot.vy = this.drag.vy * 1.1;
    if (spd > 8)  this._addAnger(1, 'throw');
    if (spd > 15) this._addAnger(1, 'hard_throw');
    if (spd > 12) this._enterWall(spd);
    else { this.fallingAt = performance.now(); this._setState(this.S.FALLING); this._pose('fall'); }
  }

  _enterWall(spd) {
    this._setState(this.S.WALL);
    this.bot.static = true; this._pose('fall');
    this.root.classList.add('dix-impact');
    this._flashWhite(); this._spawnStars(this.bot.x, this.bot.y, 7);
    this._say('*IMPACTO DETECTADO* 💥', 1400);
    this._gtaNotif('IMPACTO CRÍTICO', `DIX ha calculado venganza`, '#FF3030');
    this._addAnger(spd > 20 ? 2 : 1, 'wall');
    if (navigator.vibrate) navigator.vibrate(160);
    if (spd > 20) this._screenShake();
    this._timer(() => {
      this.root.classList.remove('dix-impact');
      this.bot.static = false;
      this.chaseAt = performance.now(); this._setState(this.S.CHASE);
      this._pose('angry'); this._say('¡Te vas a enterar! 🤜', 1600);
    }, 1500);
  }

  _onImpact(spd) {
    if ([this.S.DEVIL, this.S.CHAOS].includes(this.state)) return;
    if (spd > 7)  { this.root.classList.add('dix-impact'); this._clearClassLater(this.root, 'dix-impact', 180); }
    if (spd > 10) this._addAnger(1, 'impact');
  }

  _onScroll() {
    const now = performance.now(); const y = window.scrollY;
    const dy = y - this.lastScroll.y;
    const dt = Math.max(16, now - this.lastScroll.t);
    const v  = Math.abs(dy / dt * 16.67);
    this.lastScroll = { y, t: now }; this.ptr.idleSince = now;
    if (v > 14 && ![this.S.HOUSE, this.S.OFF, this.S.CHAT].includes(this.state)) {
      this.bot.static = false; this.bot.vy = -8;
      this.bot.vx = (dy > 0 ? -1 : 1) * (3 + Math.random() * 4);
      this._pose('fall'); this.fallingAt = performance.now();
      this._setState(this.S.FALLING); this._say('¡TERREMOTO! 🌊', 1200);
    }
  }

  _onCopy() { if (this.state !== this.S.HOUSE) { this._say('Eso es mío 😠', 1500); this._addAnger(0.5, 'copy'); } }

  _onKey(e) {
    if (e.code === this.KONAMI[this.konamiIdx]) {
      this.konamiIdx++;
      if (this.konamiIdx === this.KONAMI.length) { this.konamiIdx = 0; this._konami(); }
    } else this.konamiIdx = e.code === this.KONAMI[0] ? 1 : 0;
  }

  /* ─── ANGER SYSTEM ──────────────────────────── */
  _addAnger(n, reason) {
    if ([this.S.OFF, this.S.CHAT].includes(this.state)) return;
    this.anger = this._clamp(this.anger + n, 0, 7);
    this._updateHUD();
    this._emit('anger', { level: this.anger, reason });
    if (this.anger >= 3) this._angerL1();
    if (this.anger >= 5) this._angerL2();
    if (this.anger >= 7) this._startChaos();
  }

  _angerL1() {
    this.root.classList.add('dix-red-eyes');
    if (!this.l1said) { this.l1said = true; this._say('¡Te estoy avisando...! ⚠️', 1900); }
  }
  _angerL2() {
    if (!this.l2said) { this.l2said = true; this._attackInteractive(); }
  }

  /* ─── CHAOS / DEVIL ─────────────────────────── */
  _startChaos() {
    if ([this.S.CHAOS, this.S.DEVIL].includes(this.state)) return;
    if (this.chaosUsed >= this.cfg.maxChaos) { this._say('Hoy ya gasté toda la rabia.', 1800); return; }
    this.chaosUsed++;
    this.sess.chaosAt = performance.now(); this.chaosModest = 0;
    this._setState(this.S.CHAOS); this._pose('angry');
    document.body.classList.add('dix-body-flash');
    this._clearClassLater(document.body, 'dix-body-flash', 1600);
    document.querySelectorAll('button').forEach(b => b.classList.add('dix-btn-shake'));
    this._say('¡SISTEMA EN LLAMAS! 🔥🔥', 2300);
    this._gtaNotif('⚠ NIVEL DE CAOS MÁXIMO', 'DIX ha perdido el control', '#FF3030');
    this._attackPrice(this.cfg.calmPrice);
    this._startPeaceCounter();
    this._emit('chaos-started', { level: this.anger });
  }

  _startPeaceCounter() {
    if (this.counterEl) this.counterEl.remove();
    this.counterEl = document.createElement('div');
    this.counterEl.className = 'dix-peace-counter';
    this.counterEl.innerHTML = `<h3>PAZ EN</h3><div class="num">10</div>`;
    document.body.appendChild(this.counterEl);
    let n = 10;
    const tick = () => {
      if (!this.counterEl || this.state !== this.S.CHAOS) return;
      n--;
      this.counterEl.querySelector('.num').textContent = String(n);
      if (n <= 0) this._endChaos(); else this._timer(tick, 1000);
    };
    this._timer(tick, 1000);
  }

  _endChaos() {
    if (this.counterEl) { this.counterEl.remove(); this.counterEl = null; }
    document.querySelectorAll('.dix-btn-shake').forEach(b => b.classList.remove('dix-btn-shake'));
    this.anger = 0; this.l1said = false; this.l2said = false;
    this.root.classList.remove('dix-red-eyes');
    this._setState(this.S.WANDER); this._pose('walk_a');
    this._say('...está bien. Me calmo. 😤', 1600);
    this._updateHUD();
  }

  _startDevil() {
    if (this.devilUsed >= this.cfg.maxDevil) return;
    this.devilUsed++;
    this.sess.devilAt = performance.now(); this._setState(this.S.DEVIL);
    this.root.classList.add('dix-devil'); this._pose('punch');
    document.body.classList.add('dix-body-devil');
    this._clearClassLater(document.body, 'dix-body-devil', 3000);
    this._say('¡MODO DEVIL ACTIVADO! 😈💀', 2400);
    this._gtaNotif('👹 MODO DEVIL', 'Reza para que alguien lo mime', '#8B00FF');
    this._attackPrice(this.cfg.devilPrice);
    this._breakElements(9); this._spawnPixels(this.bot.x, this.bot.y, 20);
    this._emit('devil-started', {});
  }

  _endDevil(byCaress = false) {
    this.root.classList.remove('dix-devil');
    document.querySelectorAll('.dix-btn-shake').forEach(b => b.classList.remove('dix-btn-shake'));
    if (this.counterEl) { this.counterEl.remove(); this.counterEl = null; }
    this.anger = byCaress ? Math.max(0, this.anger - 3) : 0;
    this._setState(this.S.WANDER); this._pose('walk_a');
    this._say(byCaress ? 'Vale... núcleo reiniciado. 💚' : 'Fin del modo devil.', 2000);
    this._updateHUD();
    if (byCaress) this._gtaNotif('💚 MODO DEVIL CANCELADO', 'Los mimos ganaron', '#00FF88');
  }

  /* ─── CARESS / PET ──────────────────────────── */
  _pet(kind) {
    const now = performance.now();
    if (now - this.lastClickPetAt < 1200) return;
    this.lastClickPetAt = now;
    this.caress++; this.mood++; this.trust++;
    this.anger = Math.max(0, this.anger - 1);
    this.root.classList.remove('dix-red-eyes');
    this._spawnHeart(this.bot.x, this.bot.y - 28);
    this._say(kind === 'click' ? 'bip... mimo detectado 💛' : 'mmm... eso está bien 🥰', 1600);
    if (this.caress >= 3) { this._pose('sleep'); this._setState(this.S.HAPPY); this.root.classList.add('dix-happy-eyes'); }
    if (this.caress >= 5) this._unlockDiscount();
    this._updateHUD();
    this._emit('pet', { kind, caress: this.caress });
  }

  _startCaress() {
    if ([this.S.HOUSE, this.S.OFF].includes(this.state)) return;
    this.caressState = { on: true, startedAt: performance.now(), stage: 0 };
    this.bot.static = true; this.bot.vx = 0; this.bot.vy = 0;
    this._pose('sleep'); this._setState(this.S.HAPPY);
  }

  _updateCaress(now) {
    const e = now - this.caressState.startedAt;
    if (e >= 1200 && this.caressState.stage < 1) {
      this.caressState.stage = 1; this._spawnHeart(this.bot.x, this.bot.y - 30);
      this._say('Prrrr... ronroneo robótico 🤖', 1400);
      this.anger = Math.max(0, this.anger - 1);
    }
    if (e >= 3000 && this.caressState.stage < 2) {
      this.caressState.stage = 2; this.root.classList.add('dix-happy-eyes');
      this._say('mmm... eso está bien 🥰', 1600);
    }
    if (e >= 5000 && this.caressState.stage < 3) {
      this.caressState.stage = 3; this._unlockDiscount();
    }
  }

  _endCaress() {
    this.caressState.on = false; this.bot.static = false;
    if (this.state === this.S.HAPPY) this._setState(this.S.WANDER);
  }

  _unlockDiscount() {
    if (this.discounts.has('DIXLOVE-2')) return;
    this.discounts.add('DIXLOVE-2'); this.caress = 0;
    this._say('Está bien... te lo mereces 💚', 1800);
    this._timer(() => {
      this._showDiscount('💚 CÓDIGO ESPECIAL', 'DIXLOVE-2', '2€ descuento', 10000);
      this._spawnConfetti(this.bot.x, this.bot.y, 28, true);
      this._emit('discount', { code: 'DIXLOVE-2', amount: 2 });
    }, 1600);
  }

  /* ─── HOUSE FLOW ────────────────────────────── */
  _release() {
    if (![this.S.HOUSE, this.S.OFF, this.S.SLEEP].includes(this.state)) return;
    this.house.classList.add('open', 'away');
    this.house.classList.remove('sleeping');
    this.root.classList.remove('hidden');
    this.bot.visible = true; this.bot.static = false;
    this._updateHouseRect();
    const r = this.houseRect;
    this.bot.x = r.left + r.width * 0.42;
    this.bot.y = r.top  + r.height * 0.62;
    this.bot.vx = -2.4; this.bot.vy = -5;
    this._pose('walk_a'); this._setState(this.S.WANDER);
    this._say('¡Yujuuuu, soy libre! 🎉', 5000);
    this._gtaNotif('DIX HA SALIDO DE LA CASETA', 'Arrástralo de vuelta para chatear');
    this._emit('released', {});
  }

  _returnHouse(sleeping = false) {
    this._updateHouseRect();
    const r = this.houseRect;
    this.bot.x = r.left + r.width * 0.52;
    this.bot.y = r.top  + r.height * 0.52;
    this.bot.vx = 0; this.bot.vy = 0; this.bot.static = true; this.bot.visible = false;
    this.root.classList.add('hidden');
    this.house.classList.remove('open', 'away');
    if (sleeping) this.house.classList.add('sleeping');
    this._setState(sleeping ? this.S.SLEEP : this.S.HOUSE);
  }

  _outOfService() {
    this._returnHouse(true); this._setState(this.S.OFF);
    this._say('Modo descanso... ZZZ 💤', 1600);
    this._emit('hidden', { reason: 'out_of_service' });
  }

  _activateChat() {
    this._setState(this.S.CHAT); this.bot.static = true;
    this._updateHouseRect();
    this.bot.x = this.houseRect.left - 55;
    this.bot.y = this.houseRect.top  + 50;
    this._pose('sleep');
    this._say('Chat DIXBOT activo. Pregúntame lo que quieras sobre DixSystem 🤖', 4500);
    this._gtaNotif('CHAT DIXBOT ABIERTO', 'Modo consulta activado', '#00FF88');
    this._emit('chat-opened', {});
  }

  _secrets() {
    this._say('Click = mimo | Botón derecho = cariño | Arrástrame a caseta = chat | ↑↑↓↓←→←→BA = DIXMASTER 🎮', 7600);
  }

  _konami() {
    this._setState(this.S.DANCE); this.root.classList.add('dix-dance');
    this._pose('fall'); this._say('¡MODO SECRETO AKTIVADO! 🎮🔥', 2200);
    this._spawnConfetti(window.innerWidth / 2, 90, 60, false);
    this._showDiscount('🎮 CÓDIGO SECRETO', 'DIXMASTER-2', '2€ descuento', 15000);
    this._play8bit(); this._gtaNotif('🎮 KONAMI CODE', 'DIXMASTER-2 desbloqueado', '#FFD700');
    this._emit('discount', { code: 'DIXMASTER-2', amount: 2 });
    this._timer(() => { this.root.classList.remove('dix-dance'); if (this.state === this.S.DANCE) this._setState(this.S.WANDER); }, 3400);
  }

  /* ─── ATTACKS / EFFECTS ─────────────────────── */
  _attackInteractive(kind = 'rock') {
    this._cacheEnv();
    const visible = this.env.filter(x => x.el.isConnected && this._visibleRect(x.rect));
    if (!visible.length) return;
    const t = visible[Math.floor(Math.random() * visible.length)];
    this._launchProjectile(t.rect, kind, () => {
      this._crackEl(t.el); this._glitchEl(t.el, 450);
      this._say(kind === 'rock' ? '¡Ahora cuesta más! 💥' : 'Pixel roto 🔧', 1300);
    });
  }

  _attackPrice(price) {
    this._cachePrices();
    const t = this._nearestPrice();
    if (!t) return;
    this._launchProjectile(t.rect, 'pixel', () => { this._setTempPrice(price); this._glitchEl(t.el, 500); this._screenFlash(); });
  }

  _launchProjectile(rect, kind, onHit) {
    const el = document.createElement('div');
    el.className = 'dix-projectile'; el.textContent = kind === 'rock' ? '🪨' : '■';
    el.style.color = '#FF6B00'; document.body.appendChild(el);
    let x = this.bot.x, y = this.bot.y;
    const tx = rect.left + rect.width / 2, ty = rect.top + rect.height / 2;
    const dx = tx - x, dy = ty - y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const spd = kind === 'rock' ? 15 : 18;
    let alive = true;
    const step = () => {
      if (!alive) return;
      x += dx / len * spd; y += dy / len * spd;
      el.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
      if (Math.hypot(tx - x, ty - y) < spd + 4) { alive = false; el.remove(); onHit && onHit(); }
      else requestAnimationFrame(step);
    };
    step();
  }

  _setTempPrice(v) {
    this._cachePrices();
    const txt = `${v.toFixed(2).replace('.', ',')}€`;
    for (const t of this.priceEls) {
      if (!this.origPrices.has(t.el)) this.origPrices.set(t.el, t.el.textContent);
      t.el.textContent = txt; t.el.classList.add('dix-glitched');
      this._clearClassLater(t.el, 'dix-glitched', 700);
    }
    this._timer(() => { for (const [el, txt] of this.origPrices) if (el.isConnected) el.textContent = txt; this.origPrices.clear(); }, 30000);
  }

  _breakElements(count = 3) {
    this._cacheEnv();
    this.env.filter(x => x.el.isConnected && this._visibleRect(x.rect))
      .sort((a, b) => this._dist(a.rect) - this._dist(b.rect))
      .slice(0, count)
      .forEach(x => { this._crackEl(x.el); this._glitchEl(x.el, 320); x.el.classList.add('dix-broken'); this._clearClassLater(x.el, 'dix-broken', 30000); });
  }

  _crackEl(el) {
    el.classList.add('dix-cracked');
    this._timer(() => el.classList.remove('dix-cracked'), 30000);
  }
  _glitchEl(el, ms) {
    el.classList.add('dix-glitched');
    this._timer(() => { if (el.isConnected) el.classList.remove('dix-glitched'); }, ms);
  }

  /* ─── PARTICLES ─────────────────────────────── */
  _spawnHeart(x, y) { this._spawnEmoji('❤', x, y, 'dix-heart'); }
  _spawnStars(x, y, n) {
    for (let i = 0; i < n; i++) {
      const el = this._spawnEmoji('⭐', x, y, 'dix-star');
      el.style.setProperty('--tx', `${(Math.random() - 0.5) * 90}px`);
      el.style.setProperty('--ty', `${(Math.random() - 0.5) * 90}px`);
    }
  }
  _spawnEmoji(ch, x, y, cls) {
    const el = document.createElement('div'); el.className = cls; el.textContent = ch;
    el.style.left = `${x}px`; el.style.top = `${y}px`;
    document.body.appendChild(el); this._timer(() => el.remove(), 1700); return el;
  }
  _spawnPixels(x, y, n) {
    for (let i = 0; i < n && this.pAlive < this.cfg.maxParticles; i++) {
      this.pAlive++;
      const el = document.createElement('div'); el.className = 'dix-pixel';
      el.style.left = `${x + (Math.random() - 0.5) * 30}px`;
      el.style.top  = `${y + (Math.random() - 0.5) * 30}px`;
      el.style.setProperty('--tx', `${(Math.random() - 0.5) * 170}px`);
      // Color varies by state
      if (this.state === this.S.DEVIL) el.style.background = '#FF0033';
      document.body.appendChild(el);
      this._timer(() => { el.remove(); this.pAlive = Math.max(0, this.pAlive - 1); }, 1500);
    }
  }
  _spawnConfetti(x, y, n, orangeOnly) {
    for (let i = 0; i < n && this.pAlive < this.cfg.maxParticles; i++) {
      this.pAlive++;
      const el = document.createElement('div'); el.className = 'dix-confetti';
      el.style.left = `${x + (Math.random() - 0.5) * 80}px`;
      el.style.top  = `${y + (Math.random() - 0.5) * 30}px`;
      if (!orangeOnly) el.style.background = `hsl(${Math.floor(Math.random() * 360)} 90% 60%)`;
      el.style.setProperty('--tx', `${(Math.random() - 0.5) * 280}px`);
      document.body.appendChild(el);
      this._timer(() => { el.remove(); this.pAlive = Math.max(0, this.pAlive - 1); }, 2200);
    }
  }

  /* ─── UI HELPERS ────────────────────────────── */
  _say(text, ms = 1800) {
    if (!this.bot.visible && ![this.S.HOUSE, this.S.OFF].includes(this.state)) return;
    this.bubble.textContent = text; this.bubble.classList.add('visible');
    this._timer(() => { if (this.bubble.textContent === text) this.bubble.classList.remove('visible'); }, ms);
  }

  _showDiscount(title, code, desc, ms) {
    const el = document.createElement('div'); el.className = 'dix-discount';
    el.innerHTML = `<h3>${title}</h3><div class="dix-code">${code}</div><p>${desc}</p>`;
    document.body.appendChild(el);
    this._timer(() => el.remove(), ms);
  }

  _flashWhite()  { this.root.style.filter = 'brightness(4)'; this._timer(() => { this.root.style.filter = ''; }, 80); }
  _screenFlash() { document.body.classList.add('dix-body-flash'); this._clearClassLater(document.body, 'dix-body-flash', 1600); }
  _screenShake() { document.body.classList.add('dix-body-shake'); this._clearClassLater(document.body, 'dix-body-shake', 360); }

  _play8bit() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [523, 659, 784, 1046].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'square'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.12);
        g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + i * 0.12 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.12 + 0.11);
        o.connect(g); g.connect(ctx.destination);
        o.start(ctx.currentTime + i * 0.12);
        o.stop(ctx.currentTime + i * 0.12 + 0.13);
      });
    } catch (e) {}
  }

  /* ─── CACHE / UTILS ─────────────────────────── */
  _cacheEnv() {
    this._updateHouseRect();
    this.env = Array.from(document.querySelectorAll('button, a, .hero-card, [data-dix-interactive], [data-dix-analysis-zone], input'))
      .filter(el => !el.closest('.dix-house') && !el.classList.contains('dix-bot'))
      .map(el => ({ el, rect: el.getBoundingClientRect() }));
  }
  _cachePrices() {
    const explicit = Array.from(document.querySelectorAll('.dix-price, [data-dix-price]'));
    const auto = Array.from(document.body.querySelectorAll('span,strong,button,div,p,h1,h2,h3'))
      .filter(el => /(?:€\s*)?14[,.]99|14[,.]99\s*€/.test(el.textContent || ''));
    this.priceEls = Array.from(new Set([...explicit, ...auto]))
      .filter(el => !el.closest('.dix-house'))
      .map(el => ({ el, rect: el.getBoundingClientRect() }));
  }
  _nearestPrice() {
    this._cachePrices();
    const v = this.priceEls.filter(t => this._visibleRect(t.rect));
    if (!v.length) return null;
    return v.sort((a, b) => this._dist(a.rect) - this._dist(b.rect))[0];
  }

  _detectDev(now) {
    if (now - this.lastDevCheck < 2500) return;
    this.lastDevCheck = now;
    const open = (window.outerHeight - window.innerHeight > 150) || (window.outerWidth - window.innerWidth > 150);
    if (open && ![this.S.HOUSE, this.S.OFF].includes(this.state)) {
      this._say('Ey... ¿qué haces ahí dentro? 🕵️', 2200);
    }
  }

  _noDisturb() {
    const a = document.activeElement;
    return a && a.matches && a.matches('input, textarea, select, [contenteditable], [data-critical-zone], form, .checkout, .payment');
  }

  _setState(next) { if (this.state === next) return; this.prev = this.state; this.state = next; this._emit('state', { state: next, prev: this.prev }); }
  _pose(key) { const f = this.cfg.poses[key] || this.cfg.poses.walk_a; this.root.style.backgroundImage = `url("${this.cfg.base}${f}")`; }
  _onBot(x, y) { if (!this.bot.visible) return false; return Math.hypot(x - this.bot.x, y - this.bot.y) <= this.cfg.size * 0.58; }
  _inHouse(x, y) { this._updateHouseRect(); const r = this.houseRect; return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }
  _updateHouseRect() { this.houseRect = this.house.getBoundingClientRect(); }
  _visibleRect(r) { return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth; }
  _dist(r) { return Math.hypot(r.left + r.width / 2 - this.bot.x, r.top + r.height / 2 - this.bot.y); }
  _clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  _debounce(fn, wait) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); }; }
  _timer(fn, ms) { const id = setTimeout(() => { this.timers.delete(id); fn(); }, ms); this.timers.add(id); return id; }
  _clearClassLater(el, cls, ms) { this._timer(() => { if (el && el.classList) el.classList.remove(cls); }, ms); }
  _emit(name, detail) { window.dispatchEvent(new CustomEvent(`dixbot:${name}`, { detail })); }
}

/* ─── EXPORT & AUTO-INIT ─────────────────────── */
window.DixbotV2 = DixbotV2;
window.addEventListener('DOMContentLoaded', () => {
  if (!window.__DIXBOT_DISABLE_AUTO_INIT__) window.dixbot = new DixbotV2();
});

})();
