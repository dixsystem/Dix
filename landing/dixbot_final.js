(() => {
'use strict';

/* ═══════════════════════════════════════════════
   DIXBOT FINAL — Platform Mascot Engine
   DixSystem © 2026

   Comportamiento:
   - Camina por el suelo
   - Trepa a elementos DOM (navbar, cards, botones)
   - Lanza liana y se desplaza entre elementos
   - Se asusta si el ratón pasa cerca rápido
   - Se sienta en el borde de cards/secciones
   - Duerme si hay inactividad
   - Mimos → descuento DIXLOVE-2
   - Enfado → precio sube (temporal)
   - Arrastrado a caseta → chatbot Claude
═══════════════════════════════════════════════ */

class DixBot {
  constructor(opts = {}) {
    this.BASE = opts.assetBase || './assets/poses/';
    this.POSES = {
      walk_a:    'walk_a.png',
      walk_b:    'walk_b.png',
      fall:      'fall.png',
      angry:     'angry.png',
      sleep:     'sleep.png',
      punch:     'punch.png',
    };

    // Física
    this.x = 80;
    this.y = window.innerHeight - 220;
    this.vx = 1.4;
    this.vy = 0;
    this.facing = 1;
    this.onGround = true;
    this.gravity = 0.55;
    this.friction = 0.82;

    // Estado
    this.STATE = Object.freeze({
      WALK:'WALK', IDLE:'IDLE', SLEEP:'SLEEP', SCARED:'SCARED',
      SIT:'SIT', CLIMB:'CLIMB', SWING:'SWING', GRABBED:'GRABBED',
      ANGRY:'ANGRY', HAPPY:'HAPPY', CHAT:'CHAT', HOUSE:'HOUSE'
    });
    this.state = this.STATE.HOUSE;
    this.poseFrame = 0;
    this.walkTimer = 0;

    // Interacción
    this.angerLevel = 0;
    this.petCount = 0;
    this.discountUnlocked = false;
    this.priceRaised = false;
    this.drag = { on:false, ox:0, oy:0, vx:0, vy:0, moved:false };
    this.mouse = { x:0, y:0, vx:0, vy:0, lastX:0, lastY:0, lastT: performance.now() };

    // Timers
    this.timers = new Set();
    this.idleSince = performance.now();
    this.lastPet = 0;
    this.lastScared = 0;
    this.lastSwing = 0;
    this.lastClimb = 0;
    this.lastSit = 0;

    // Liana
    this.swing = null;  // { x, y, len, angle, av } péndulo

    // Plataformas DOM
    this.platforms = [];
    this.currentPlatform = null;

    // Konami
    this.KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA'];
    this.konamiIdx = 0;

    this._build();
    this._bindEvents();
    this._cachePlatforms();
    this._loop(performance.now());
    window.DIXBOT = this;
  }

  /* ─── BUILD DOM ──────────────────────────────── */
  _build() {
    // Caseta
    this.house = document.createElement('div');
    this.house.id = 'dix-house';
    this.house.innerHTML = `
      <div class="dix-house-roof"></div>
      <div class="dix-house-shell">
        <div class="dix-house-title">INFO DIXSYSTEM</div>
        <div class="dix-house-win"></div>
        <div class="dix-house-peek"></div>
        <button class="dix-house-door" aria-label="Abrir DIXBOT">D</button>
        <div class="dix-zzz">ZZZ</div>
      </div>`;
    document.body.appendChild(this.house);
    this.house.style.setProperty('--peek', `url("${this.BASE}${this.POSES.sleep}")`);

    this.svcBtn = document.createElement('button');
    this.svcBtn.className = 'dix-svc-btn';
    this.svcBtn.textContent = 'DIXBOT FUERA DE SERVICIO';
    document.body.appendChild(this.svcBtn);

    // Bot
    this.root = document.createElement('div');
    this.root.id = 'dix-bot';
    this.root.setAttribute('role','button');
    this.root.setAttribute('aria-label','DIXBOT mascota');
    document.body.appendChild(this.root);
    this._setPose('walk_a');

    this.shadow = document.createElement('div');
    this.shadow.id = 'dix-shadow';
    document.body.appendChild(this.shadow);

    // Canvas para liana
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'dix-canvas';
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.canvas.style.height = '100vh';
    this.canvas.style.width = '100vw';
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    // Bubble
    this.bubble = document.createElement('div');
    this.bubble.id = 'dix-bubble';
    document.body.appendChild(this.bubble);

    // Chat panel
    this.chatPanel = document.createElement('div');
    this.chatPanel.id = 'dix-chat';
    this.chatPanel.innerHTML = `
      <div class="dix-chat-header">
        <span>DIX — Asistente DixSystem</span>
        <button id="dix-chat-close">✕</button>
      </div>
      <div class="dix-chat-msgs" id="dix-msgs"></div>
      <div class="dix-chat-input">
        <input id="dix-chat-in" placeholder="Pregúntame algo..." autocomplete="off"/>
        <button id="dix-chat-send">→</button>
      </div>`;
    this.chatPanel.style.display = 'none';
    document.body.appendChild(this.chatPanel);

    // Inject CSS
    const style = document.createElement('style');
    style.textContent = DIX_CSS;
    document.head.appendChild(style);

    // Events caseta/chat
    this.house.querySelector('.dix-house-door').addEventListener('click', e => { e.stopPropagation(); this._release(); });
    this.svcBtn.addEventListener('click', () => this._sleep());
    document.getElementById('dix-chat-close').addEventListener('click', () => this._closeChat());
    document.getElementById('dix-chat-send').addEventListener('click', () => this._sendChat());
    document.getElementById('dix-chat-in').addEventListener('keydown', e => { if(e.key==='Enter') this._sendChat(); });
    window.addEventListener('resize', () => { this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; this._cachePlatforms(); });
  }

  /* ─── PLATAFORMAS DOM ─────────────────────────── */
  _cachePlatforms() {
    const selectors = 'nav, header, section, .hero, .card, article, footer, [data-dix-platform]';
    this.platforms = Array.from(document.querySelectorAll(selectors))
      .filter(el => !el.closest('#dix-house') && !el.id?.startsWith('dix-'))
      .map(el => {
        const r = el.getBoundingClientRect();
        return { el, top: r.top + window.scrollY, left: r.left, right: r.right, width: r.width };
      })
      .filter(p => p.width > 80);
  }

  _nearestPlatformAbove() {
    const botBottom = this.y + 80;
    let best = null, bestDist = Infinity;
    for (const p of this.platforms) {
      const top = p.top - window.scrollY;
      if (top < this.y - 20 && top > this.y - 400) {
        const dist = this.y - top;
        if (dist < bestDist && this.x >= p.left - 30 && this.x <= p.right + 30) {
          bestDist = dist;
          best = p;
        }
      }
    }
    return best;
  }

  _nearestPlatformForSwing() {
    let best = null, bestDist = Infinity;
    for (const p of this.platforms) {
      const top = p.top - window.scrollY;
      const cx = (p.left + p.right) / 2;
      if (top < this.y - 60) {
        const dist = Math.hypot(cx - this.x, top - this.y);
        if (dist < 350 && dist < bestDist) { bestDist = dist; best = p; }
      }
    }
    return best;
  }

  /* ─── EVENTS ─────────────────────────────────── */
  _bindEvents() {
    window.addEventListener('pointermove', e => this._onMove(e), { passive:true });
    window.addEventListener('pointerdown', e => this._onDown(e), { passive:false });
    window.addEventListener('pointerup',   e => this._onUp(e),   { passive:false });
    window.addEventListener('pointercancel', e => this._onUp(e), { passive:true });
    window.addEventListener('contextmenu', e => { if(this._onBot(e.clientX,e.clientY)) e.preventDefault(); });
    window.addEventListener('scroll', () => this._cachePlatforms(), { passive:true });
    window.addEventListener('keydown', e => this._onKey(e));
  }

  _onMove(e) {
    const now = performance.now();
    const dt = Math.max(16, now - this.mouse.lastT);
    this.mouse.vx = (e.clientX - this.mouse.x) / dt * 16;
    this.mouse.vy = (e.clientY - this.mouse.y) / dt * 16;
    this.mouse.lastX = this.mouse.x; this.mouse.lastY = this.mouse.y;
    this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.lastT = now;
    this.idleSince = now;
    if (this.drag.on) {
      this.drag.vx = this.mouse.vx; this.drag.vy = this.mouse.vy;
      this.x = e.clientX + this.drag.ox;
      this.y = e.clientY + this.drag.oy;
      this.drag.moved = true;
    }
    // Susto si ratón rápido cerca
    if ([this.STATE.WALK, this.STATE.IDLE, this.STATE.SIT, this.STATE.SLEEP].includes(this.state)) {
      const spd = Math.hypot(this.mouse.vx, this.mouse.vy);
      const dist = Math.hypot(e.clientX - this.x, e.clientY - this.y);
      if (spd > 18 && dist < 130 && performance.now() - this.lastScared > 4000) {
        this.lastScared = performance.now();
        this._scared();
      }
    }
  }

  _onDown(e) {
    if (!this._onBot(e.clientX, e.clientY)) return;
    if ([this.STATE.HOUSE, this.STATE.CHAT].includes(this.state)) return;
    e.preventDefault();
    if (e.button === 2 || e.pointerType === 'touch') { this._pet(); return; }
    this.drag = { on:true, moved:false, vx:0, vy:0, ox: this.x - e.clientX, oy: this.y - e.clientY };
    this._setState(this.STATE.GRABBED);
    this._setPose('angry');
    this.root.classList.add('dix-grabbed');
  }

  _onUp(e) {
    if (!this.drag.on) return;
    e.preventDefault?.();
    const spd = Math.hypot(this.drag.vx, this.drag.vy);
    const moved = this.drag.moved;
    this.drag.on = false;
    this.root.classList.remove('dix-grabbed');
    if (!moved) { this._pet(); return; }
    // Arrastrado a caseta?
    const hr = this.house.getBoundingClientRect();
    if (this.x >= hr.left-40 && this.x <= hr.right+40 && this.y >= hr.top-40 && this.y <= hr.bottom+40) {
      this._openChat(); return;
    }
    // Lanzar
    this.vx = this.drag.vx * 0.9;
    this.vy = this.drag.vy * 0.9;
    if (spd > 12) { this.angerLevel++; this._say('¡Eso ha dolido! 😠', 1800); }
    if (this.angerLevel >= 3) this._angry();
    this._setState(this.STATE.WALK);
    this._setPose('fall');
  }

  _onKey(e) {
    if (e.code === this.KONAMI[this.konamiIdx]) {
      this.konamiIdx++;
      if (this.konamiIdx === this.KONAMI.length) { this.konamiIdx = 0; this._konami(); }
    } else this.konamiIdx = e.code === this.KONAMI[0] ? 1 : 0;
  }

  /* ─── MAIN LOOP ──────────────────────────────── */
  _loop(now) {
    const dt = Math.min(32, now - (this._lastFrame || now)) / 16.67;
    this._lastFrame = now;
    this._update(dt, now);
    this._render();
    requestAnimationFrame(t => this._loop(t));
  }

  _update(dt, now) {
    if ([this.STATE.HOUSE, this.STATE.CHAT].includes(this.state)) return;

    // Sleep check
    if (now - this.idleSince > 25000 && [this.STATE.WALK, this.STATE.IDLE, this.STATE.SIT].includes(this.state)) {
      this._sleep(); return;
    }

    if (this.state === this.STATE.SWING) { this._updateSwing(dt); return; }
    if (this.state === this.STATE.GRABBED) return;

    // Física
    if (this.state !== this.STATE.SIT && this.state !== this.STATE.CLIMB) {
      this.vy += this.gravity * dt;
      this.vx *= Math.pow(this.friction, dt);
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Suelo
    const floor = window.innerHeight - 200;
    if (this.y >= floor) {
      this.y = floor;
      this.vy = 0;
      this.onGround = true;
    }

    // Paredes
    if (this.x < 60) { this.x = 60; this.vx = Math.abs(this.vx); this.facing = 1; }
    if (this.x > window.innerWidth - 60) { this.x = window.innerWidth - 60; this.vx = -Math.abs(this.vx); this.facing = -1; }

    // Subirse a plataformas (trepar)
    if (this.state === this.STATE.WALK && now - this.lastClimb > 12000 && Math.random() < 0.0008) {
      const p = this._nearestPlatformAbove();
      if (p) { this.lastClimb = now; this._climbTo(p); return; }
    }

    // Lanzar liana
    if (this.state === this.STATE.WALK && now - this.lastSwing > 20000 && Math.random() < 0.0005) {
      const p = this._nearestPlatformForSwing();
      if (p) { this.lastSwing = now; this._startSwing(p); return; }
    }

    // Sentarse en borde
    if (this.state === this.STATE.WALK && now - this.lastSit > 18000 && Math.random() < 0.0006) {
      const p = this._nearestPlatformAbove();
      if (p) { this.lastSit = now; this._sitOn(p); return; }
    }

    // Caminar
    if (this.state === this.STATE.WALK) {
      const spd = this.angerLevel >= 2 ? 2.2 : 1.4;
      if (Math.abs(this.vx) < spd) this.vx += this.facing * 0.04 * dt;
      // walk frame
      this.walkTimer += dt;
      if (this.walkTimer > 8) {
        this.walkTimer = 0;
        this.poseFrame = this.poseFrame === 0 ? 1 : 0;
        this._setPose(this.poseFrame === 0 ? 'walk_a' : 'walk_b');
      }
    }
  }

  _updateSwing(dt) {
    const s = this.swing;
    const g = 0.004;
    s.av += (-g / s.len * Math.sin(s.angle)) * dt * 16;
    s.av *= 0.995;
    s.angle += s.av * dt;
    this.x = s.ax + Math.sin(s.angle) * s.len;
    this.y = s.ay + Math.cos(s.angle) * s.len;
    this.vx = s.av * Math.cos(s.angle) * s.len * 0.1;
    if (Math.abs(s.av) < 0.015 || this.y > window.innerHeight - 170) {
      this.swing = null;
      this.vy = 0;
      this._setState(this.STATE.WALK);
      this._say('¡Wheee! 🎉', 1400);
    }
  }

  /* ─── BEHAVIOURS ─────────────────────────────── */
  _scared() {
    this._setState(this.STATE.SCARED);
    this._setPose('fall');
    this.vy = -9;
    this.vx = (Math.random() > 0.5 ? 1 : -1) * 5;
    this._say('¡AAAAH! 😱', 1200);
    this._timer(() => { if(this.state===this.STATE.SCARED) this._setState(this.STATE.WALK); }, 1500);
  }

  _climbTo(p) {
    this._setState(this.STATE.CLIMB);
    this._setPose('walk_a');
    this._say('¡Me subo! 🐒', 1400);
    const targetX = p.left + p.width * 0.5 + (Math.random()-0.5)*60;
    const targetY = p.top - window.scrollY - 80;
    const dur = 1200;
    const startX = this.x, startY = this.y, t0 = performance.now();
    const animate = () => {
      const prog = Math.min(1, (performance.now()-t0)/dur);
      const ease = 1 - Math.pow(1-prog, 3);
      this.x = startX + (targetX-startX)*ease;
      this.y = startY + (targetY-startY)*ease;
      if (prog < 1) requestAnimationFrame(animate);
      else { this._setState(this.STATE.SIT); this._setPose('sleep'); this._timer(() => { if(this.state===this.STATE.SIT){this._setState(this.STATE.WALK); this.vy=-4;} }, 6000); }
    };
    requestAnimationFrame(animate);
  }

  _sitOn(p) {
    this._setState(this.STATE.SIT);
    this.x = p.left + p.width * 0.5 + (Math.random()-0.5)*80;
    this.y = p.top - window.scrollY - 80;
    this.vx = 0; this.vy = 0;
    this._setPose('sleep');
    this._say('Descansito 😴', 1600);
    this._timer(() => { if(this.state===this.STATE.SIT){ this._setState(this.STATE.WALK); this.vy=-3; } }, 7000);
  }

  _startSwing(p) {
    this._setState(this.STATE.SWING);
    this._setPose('fall');
    const ax = (p.left + p.right) / 2;
    const ay = p.top - window.scrollY;
    const len = Math.hypot(ax - this.x, ay - this.y);
    const angle = Math.atan2(this.x - ax, ay - this.y) * -1;
    this.swing = { ax, ay, len: Math.max(len, 80), angle, av: 0.04 * (Math.random()>0.5?1:-1) };
    this._say('¡Liana! 🦧', 1600);
  }

  _sleep() {
    this._setState(this.STATE.SLEEP);
    this._setPose('sleep');
    this.vx = 0; this.vy = 0;
    this._say('ZZZ... 💤', 2000);
    this.house.classList.add('sleeping');
    this._timer(() => { if(this.state===this.STATE.SLEEP) { this.house.classList.remove('sleeping'); this._setState(this.STATE.WALK); } }, 12000);
  }

  _pet() {
    const now = performance.now();
    if (now - this.lastPet < 1000) return;
    this.lastPet = now;
    this.petCount++; this.angerLevel = Math.max(0, this.angerLevel-1);
    this._spawnHeart(this.x, this.y - 40);
    this._say('bip... mimo 💛', 1400);
    this.idleSince = now;
    if (this.state === this.STATE.SLEEP) { this.house.classList.remove('sleeping'); this._setState(this.STATE.WALK); }
    if (this.petCount >= 5 && !this.discountUnlocked) this._unlockDiscount();
    if (this.priceRaised && this.petCount >= 3) this._restorePrice();
  }

  _angry() {
    if (this.state === this.STATE.ANGRY) return;
    this._setState(this.STATE.ANGRY);
    this._setPose('angry');
    if (!this.priceRaised) this._raisePrice();
    this._say('¡SISTEMA EN LLAMAS! 🔥', 2200);
    this._timer(() => { this.angerLevel = 0; this._setState(this.STATE.WALK); this._setPose('walk_a'); }, 5000);
  }

  _unlockDiscount() {
    this.discountUnlocked = true; this.petCount = 0;
    this._say('Te mereces esto 💚', 1800);
    this._timer(() => this._showBadge('💚 CÓDIGO ESPECIAL','DIXLOVE-2','2€ descuento',10000), 1600);
    this._spawnConfetti(this.x, this.y, 30);
    this._emit('discount', { code:'DIXLOVE-2', amount:2 });
  }

  _raisePrice() {
    this.priceRaised = true;
    document.querySelectorAll('.dix-price, [data-dix-price]').forEach(el => {
      el.dataset.origPrice = el.textContent;
      el.textContent = '€17.99';
      el.style.color = '#FF3030';
    });
    this._showBadge('😠 ¡ME HAS ENFADADO!','','Precio subido 30s','warn',3000);
    this._timer(() => this._restorePrice(), 30000);
  }

  _restorePrice() {
    this.priceRaised = false; this.petCount = 0;
    document.querySelectorAll('.dix-price, [data-dix-price]').forEach(el => {
      if (el.dataset.origPrice) { el.textContent = el.dataset.origPrice; el.style.color = ''; }
    });
  }

  _konami() {
    this._setPose('fall'); this._say('¡MODO SECRETO! 🎮🔥', 2400);
    this._spawnConfetti(window.innerWidth/2, 100, 60);
    this._showBadge('🎮 KONAMI CODE','DIXMASTER-2','2€ descuento',15000);
    this._emit('discount', { code:'DIXMASTER-2', amount:2 });
  }

  /* ─── HOUSE / CHAT ───────────────────────────── */
  _release() {
    if (![this.STATE.HOUSE, this.STATE.SLEEP, this.STATE.CHAT].includes(this.state)) return;
    this.house.classList.add('open','away'); this.house.classList.remove('sleeping');
    this.root.classList.remove('hidden');
    const r = this.house.getBoundingClientRect();
    this.x = r.left + r.width*0.5; this.y = r.top + r.height*0.5;
    this.vx = -2; this.vy = -5;
    this._setState(this.STATE.WALK); this._setPose('walk_a');
    this._say('¡Yujuuuu! Arrástralo de vuelta para chatear 🎉', 5000);
    this.idleSince = performance.now();
  }

  _openChat() {
    this._setState(this.STATE.CHAT);
    this.root.classList.add('hidden');
    this.house.classList.remove('open','away');
    this.chatPanel.style.display = 'flex';
    this._addMsg('dix', '¡Hola! Soy DIX. ¿En qué puedo ayudarte? Pregúntame sobre el precio, funciones, instalación...');
  }

  _closeChat() {
    this.chatPanel.style.display = 'none';
    this._release();
  }

  async _sendChat() {
    const inp = document.getElementById('dix-chat-in');
    const msg = inp.value.trim(); if (!msg) return;
    inp.value = '';
    this._addMsg('user', msg);
    const typing = this._addMsg('dix', '...');
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          model:'claude-sonnet-4-6',
          max_tokens:400,
          system:`Eres DIX, el asistente de DixSystem. Eres conciso, amigable y técnico.
Responde en el idioma del usuario.
DixSystem: app nativa Linux/Windows que lee métricas del kernel, usa Claude AI para analizarlas y genera scripts bash de optimización personalizados.
Precio: €14.99 pago único. BYOK (bring your own key) gratis con API key propia.
Descuento: DIXLOVE-2 (2€ off) si el usuario ha sido amable con DIX.
Web: dixsystem.com. GitHub: github.com/dixsystem/dix`,
          messages:[{ role:'user', content:msg }]
        })
      });
      const data = await res.json();
      typing.textContent = data.content?.[0]?.text || 'Error al responder.';
    } catch(e) {
      typing.textContent = 'Sin conexión. Visita dixsystem.com para más info.';
    }
    const msgs = document.getElementById('dix-msgs');
    msgs.scrollTop = msgs.scrollHeight;
  }

  _addMsg(who, text) {
    const msgs = document.getElementById('dix-msgs');
    const el = document.createElement('div');
    el.className = `dix-msg dix-msg-${who}`;
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  /* ─── RENDER ─────────────────────────────────── */
  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.state === this.STATE.HOUSE || this.state === this.STATE.CHAT) {
      this.shadow.style.opacity = '0';
      return;
    }

    // Liana
    if (this.state === this.STATE.SWING && this.swing) {
      ctx.save();
      ctx.strokeStyle = '#FF6B00';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(this.swing.ax, this.swing.ay);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
      ctx.restore();
    }

    // Bot DOM
    const s = 160;
    const half = s/2;
    let angle = 0;
    if (this.state === this.STATE.SCARED || this.state === this.STATE.SWING) angle = this.vx * 0.02;

    const sx = this.facing >= 0 ? 1 : -1;
    const spd = Math.hypot(this.vx, this.vy);
    const stretch = this.state === this.STATE.SWING ? 1.15 : 1 + Math.min(spd*0.004, 0.1);

    this.root.style.transform = `translate3d(${this.x-half}px,${this.y-half}px,0) scaleX(${sx*stretch}) rotate(${angle}rad)`;

    // Sombra
    const floor = window.innerHeight - 200;
    const dist = Math.max(0, floor - this.y);
    const sh = Math.max(0.3, 1.1 - dist/400);
    this.shadow.style.opacity = String(Math.max(0.04, 0.45 - dist/500));
    this.shadow.style.transform = `translate3d(${this.x-32}px,${floor+4}px,0) scale(${sh},${sh*0.55})`;

    // Bubble pos
    this.bubble.style.left = `${this.x + 28}px`;
    this.bubble.style.top  = `${this.y - 90}px`;
  }

  /* ─── PARTICLES ──────────────────────────────── */
  _spawnHeart(x, y) {
    const el = document.createElement('div');
    el.className = 'dix-heart'; el.textContent = '❤';
    el.style.cssText = `left:${x}px;top:${y}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  _spawnConfetti(x, y, n) {
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'dix-conf';
      el.style.cssText = `left:${x+(Math.random()-.5)*80}px;top:${y+(Math.random()-.5)*30}px;background:hsl(${Math.floor(Math.random()*360)} 90% 60%);--tx:${(Math.random()-.5)*260}px`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 2200);
    }
  }

  _showBadge(title, code, desc, ms) {
    const el = document.createElement('div');
    el.className = 'dix-badge';
    el.innerHTML = `<div class="dix-badge-title">${title}</div>${code?`<div class="dix-badge-code">${code}</div>`:''}<div class="dix-badge-desc">${desc}</div>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  /* ─── UTILS ──────────────────────────────────── */
  _say(text, ms=1800) {
    this.bubble.textContent = text;
    this.bubble.classList.add('visible');
    clearTimeout(this._bubbleT);
    this._bubbleT = setTimeout(() => this.bubble.classList.remove('visible'), ms);
  }
  _setState(s) { if(this.state===s) return; this.state = s; }
  _setPose(k) { this.root.style.backgroundImage = `url("${this.BASE}${this.POSES[k]||this.POSES.walk_a}")`; }
  _onBot(x,y) { if(this.state===this.STATE.HOUSE||this.state===this.STATE.CHAT) return false; return Math.hypot(x-this.x,y-this.y)<=100; }
  _timer(fn,ms) { const id=setTimeout(()=>{this.timers.delete(id);fn();},ms); this.timers.add(id); return id; }
  _emit(name,d) { window.dispatchEvent(new CustomEvent(`dixbot:${name}`,{detail:d})); }
}

/* ─── CSS ─────────────────────────────────────── */
const DIX_CSS = `
#dix-house{position:fixed;right:18px;bottom:18px;width:148px;height:118px;z-index:99990;pointer-events:auto;user-select:none;filter:drop-shadow(0 18px 28px rgba(0,0,0,.55))}
.dix-house-shell{position:absolute;inset:24px 0 0 0;border-radius:18px 18px 12px 12px;background:linear-gradient(160deg,rgba(28,32,40,.97),rgba(10,12,17,.99));border:2px solid rgba(255,107,0,.8);overflow:hidden}
.dix-house-roof{position:absolute;left:12px;right:12px;top:0;height:42px;background:linear-gradient(135deg,#FF6B00,#cc3a00);clip-path:polygon(50% 0,100% 100%,0 100%)}
.dix-house-title{position:absolute;left:9px;right:9px;top:33px;height:16px;color:#0d1117;background:#FFB347;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:900;letter-spacing:.7px;z-index:3}
.dix-house-win{position:absolute;left:14px;top:50px;width:36px;height:30px;border-radius:8px;border:1px solid rgba(0,255,136,.9);background:radial-gradient(circle,rgba(0,255,136,.3),rgba(8,12,10,.85));animation:dix-win 1.5s infinite ease-in-out}
.dix-house-door{position:absolute;right:14px;bottom:0;width:46px;height:58px;border-radius:12px 12px 0 0;background:linear-gradient(135deg,#FF6B00,#b03600);border:1px solid rgba(255,255,255,.22);color:#0d1117;font-weight:900;font-size:22px;display:flex;align-items:center;justify-content:center;transform-origin:left center;transition:transform .45s cubic-bezier(.34,1.56,.64,1);cursor:pointer;z-index:4}
#dix-house.open .dix-house-door{transform:perspective(160px) rotateY(-68deg)}
.dix-house-peek{position:absolute;left:44px;bottom:26px;width:60px;height:60px;background-image:var(--peek);background-size:contain;background-repeat:no-repeat;background-position:center;opacity:1;transform:translateY(6px) scale(.84);transition:opacity .22s,transform .32s;z-index:2;filter:drop-shadow(0 0 10px rgba(0,255,136,.38))}
#dix-house.away .dix-house-peek{opacity:0;transform:translateY(30px) scale(.5)}
.dix-zzz{position:absolute;right:4px;top:16px;color:#fff;font-weight:900;font-size:11px;opacity:0;animation:dix-zzz 1.6s infinite}
#dix-house.sleeping .dix-zzz{opacity:1}
.dix-svc-btn{position:fixed;right:174px;bottom:30px;z-index:99990;border-radius:14px;padding:10px 12px;max-width:112px;font-size:9px;line-height:1.1;color:#fff;background:rgba(15,17,20,.94);border:1px solid rgba(255,107,0,.5);cursor:pointer;font-family:inherit}

#dix-bot{position:fixed;left:0;top:0;width:160px;height:160px;z-index:99995;background-size:contain;background-repeat:no-repeat;background-position:center;will-change:transform;transform-origin:50% 78%;cursor:grab;touch-action:none;user-select:none;filter:drop-shadow(0 20px 22px rgba(0,0,0,.5)) drop-shadow(0 0 18px rgba(255,107,0,.18))}
#dix-bot.hidden{opacity:0;pointer-events:none}
#dix-bot.dix-grabbed{cursor:grabbing}

#dix-shadow{position:fixed;width:68px;height:11px;border-radius:50%;background:rgba(0,0,0,.52);filter:blur(7px);z-index:99993;pointer-events:none;will-change:transform,opacity}

#dix-canvas{position:fixed;inset:0;z-index:99980;pointer-events:none}

#dix-bubble{position:fixed;z-index:100001;max-width:260px;color:#fff;background:rgba(10,12,17,.95);border:1px solid rgba(255,107,0,.7);padding:10px 14px;border-radius:18px 18px 18px 4px;box-shadow:0 18px 36px rgba(0,0,0,.45);font-size:13px;line-height:1.3;opacity:0;pointer-events:none;transform:translate3d(0,4px,0) scale(.94);transition:opacity .18s,transform .18s;backdrop-filter:blur(12px);font-family:'Courier New',monospace}
#dix-bubble.visible{opacity:1;transform:translate3d(0,0,0) scale(1)}

#dix-chat{position:fixed;right:18px;bottom:148px;width:320px;height:420px;z-index:100005;background:rgba(10,12,17,.97);border:1px solid rgba(255,107,0,.7);border-radius:18px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.5)}
.dix-chat-header{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid rgba(255,107,0,.3);color:#fff;font-weight:700;font-size:13px;font-family:'Courier New',monospace}
.dix-chat-header button{background:none;border:none;color:rgba(255,255,255,.6);cursor:pointer;font-size:16px;padding:0}
.dix-chat-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
.dix-msg{max-width:85%;padding:8px 12px;border-radius:12px;font-size:12px;line-height:1.4;font-family:'Courier New',monospace}
.dix-msg-dix{background:rgba(255,107,0,.15);color:#FFB347;border-radius:4px 12px 12px 12px;align-self:flex-start}
.dix-msg-user{background:rgba(255,255,255,.08);color:#fff;border-radius:12px 12px 4px 12px;align-self:flex-end}
.dix-chat-input{display:flex;gap:8px;padding:12px;border-top:1px solid rgba(255,107,0,.3)}
.dix-chat-input input{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,107,0,.4);border-radius:10px;color:#fff;padding:8px 12px;font-size:12px;font-family:'Courier New',monospace;outline:none}
.dix-chat-input button{background:#FF6B00;border:none;border-radius:10px;color:#0d1117;padding:8px 14px;font-weight:900;cursor:pointer;font-size:14px}

.dix-heart{position:fixed;pointer-events:none;z-index:100000;font-size:22px;animation:dix-heart 1.5s forwards}
.dix-conf{position:fixed;pointer-events:none;z-index:100000;width:8px;height:8px;border-radius:2px;animation:dix-conf 2s forwards}
.dix-badge{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0);background:rgba(12,14,18,.98);border:2px solid #FF6B00;border-radius:22px;padding:22px 32px;text-align:center;z-index:100010;font-family:'Courier New',monospace;box-shadow:0 0 50px rgba(255,107,0,.4);animation:dix-badge .42s cubic-bezier(.34,1.56,.64,1) forwards}
.dix-badge-title{color:#FF6B00;font-size:13px;letter-spacing:2px;margin-bottom:8px}
.dix-badge-code{color:#fff;font-size:24px;letter-spacing:4px;font-weight:900}
.dix-badge-desc{color:rgba(255,255,255,.5);font-size:12px;margin-top:6px}

@keyframes dix-win{0%,100%{opacity:.7;box-shadow:0 0 8px rgba(0,255,136,.3)}50%{opacity:1;box-shadow:0 0 22px rgba(0,255,136,.8)}}
@keyframes dix-zzz{0%{transform:translateY(0);opacity:0}35%{opacity:1}100%{transform:translateY(-18px);opacity:0}}
@keyframes dix-heart{0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-65px) scale(1.6)}}
@keyframes dix-conf{0%{opacity:1;transform:translateY(0) rotate(0)}100%{opacity:0;transform:translateY(230px) translateX(var(--tx)) rotate(720deg)}}
@keyframes dix-badge{0%{transform:translate(-50%,-50%) scale(0)}65%{transform:translate(-50%,-50%) scale(1.18)}100%{transform:translate(-50%,-50%) scale(1)}}
@media(prefers-reduced-motion:reduce){#dix-bot,.dix-heart,.dix-conf{animation-duration:.01ms!important}}
`;

window.DixBot = DixBot;
window.addEventListener('DOMContentLoaded', () => {
  if (!window.__DIX_DISABLE__) window.dixbot = new DixBot();
});

})();
