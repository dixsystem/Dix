const SAYINGS = [
  '¡Hola! Soy DIXBOT 🤖',
  'Tu kernel necesita amor ❤️',
  '¿Has optimizado hoy?',
  '¡Score 91 o te debo una!',
  'DIX: €14.99 de poder puro ⚡',
  'Linux > todo lo demás 🐧',
  'Corre, no camines, optimiza',
  '¿Qué hace tu governor ahora?',
  'El 3% llega a 90+. Tú puedes.',
  '¡Cómprame! No me arrepiento.',
];

const SIZE    = 110;
const FLOOR_PAD = 10;
const GRAVITY   = 0.45;
const BOUNCE    = 0.55;
const WALK_SPD  = 1.4;
const FLEE_DIST = 100;
const FLEE_SPD  = 5.5;
const BUBBLE_MS = 3000;
const BUBBLE_INTERVAL = 10000;

export class DixBotMascot {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = WALK_SPD;
    this.vy = 0;
    this.visible = false;
    this.dragging = false;
    this.dragOX = 0;
    this.dragOY = 0;
    this.dragLastX = 0;
    this.dragLastY = 0;
    this.dragVX = 0;
    this.dragVY = 0;
    this.mouseX = -999;
    this.mouseY = -999;
    this.raf = null;
    this.bubbleTimer = null;
    this.sayingTimer = null;
    this.clickStartX = 0;
    this.clickStartY = 0;

    this.el = null;
    this.img = null;
    this.bubble = null;
    this.chat = null;
    this.booth = null;
    this.chatOpen = false;
  }

  mount(container) {
    this._injectStyles();
    this._buildBooth(container);
    this._buildBot(container);
    this._buildChat(container);
    this._bindMouse();
  }

  /* ── ESTILOS ─────────────────────────────────────────────── */
  _injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
#dix-booth {
  position:fixed; bottom:20px; right:20px;
  width:52px; height:52px; border-radius:50%;
  background:#FF6B00; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 4px 18px rgba(255,107,0,.55);
  z-index:9100; transition:transform .18s,box-shadow .18s;
  user-select:none;
}
#dix-booth:hover { transform:scale(1.12); box-shadow:0 6px 26px rgba(255,107,0,.75); }
#dix-booth svg { width:26px; height:26px; fill:#000; }

#dix-bot {
  position:fixed; width:${SIZE}px; height:${SIZE}px;
  z-index:9050; cursor:grab; display:none;
  user-select:none; pointer-events:auto;
  transition:transform .08s;
}
#dix-bot img {
  width:100%; height:100%; object-fit:contain;
  pointer-events:none; mix-blend-mode:screen;
  filter:drop-shadow(0 4px 10px rgba(0,0,0,.5));
}
#dix-bot.grabbing { cursor:grabbing; }

#dix-bubble {
  position:fixed; z-index:9200; display:none;
  background:rgba(20,24,30,.92); color:#fff;
  border:1px solid #FF6B00; border-radius:10px;
  padding:8px 14px; font:500 13px/1.4 'Inter',sans-serif;
  max-width:180px; pointer-events:none;
  box-shadow:0 4px 16px rgba(0,0,0,.4);
  white-space:normal;
}
#dix-bubble::after {
  content:''; position:absolute; bottom:-8px; left:20px;
  border:8px solid transparent;
  border-top-color:rgba(20,24,30,.92);
  border-bottom:none; border-left:none;
}

#dix-chat {
  position:fixed; bottom:84px; right:20px;
  width:280px; background:#0d1117;
  border:1px solid #FF6B00; border-radius:12px;
  z-index:9300; display:none; flex-direction:column;
  overflow:hidden; box-shadow:0 8px 32px rgba(0,0,0,.6);
  font-family:'Inter',sans-serif;
}
#dix-chat.open { display:flex; }
#dix-chat-head {
  display:flex; align-items:center; justify-content:space-between;
  padding:12px 16px; background:#FF6B00; color:#000;
  font-weight:700; font-size:14px;
}
#dix-chat-close {
  background:none; border:none; font-size:20px;
  cursor:pointer; color:#000; line-height:1; padding:0 4px;
}
#dix-chat-body {
  flex:1; padding:14px; min-height:120px; max-height:220px;
  overflow-y:auto; font-size:13px; color:rgba(255,255,255,.8);
  display:flex; flex-direction:column; gap:8px;
}
.dix-msg { padding:8px 12px; border-radius:8px; max-width:92%; }
.dix-msg-bot { background:#161b22; border:1px solid #21262d; align-self:flex-start; }
.dix-msg-user { background:rgba(255,107,0,.15); border:1px solid rgba(255,107,0,.3); align-self:flex-end; }
#dix-chat-input {
  display:flex; border-top:1px solid #21262d; gap:0;
}
#dix-chat-input input {
  flex:1; padding:10px 14px; background:#0d1117;
  border:none; color:#fff; font-size:13px; font-family:'Inter',sans-serif;
  outline:none;
}
#dix-chat-input button {
  padding:10px 16px; background:#FF6B00; border:none;
  color:#000; font-weight:700; font-size:12px; cursor:pointer;
  font-family:'Orbitron',sans-serif; letter-spacing:.5px;
  transition:background .15s;
}
#dix-chat-input button:hover { background:#ff8533; }
    `;
    document.head.appendChild(s);
  }

  /* ── DOM ─────────────────────────────────────────────────── */
  _buildBooth(container) {
    this.booth = document.createElement('div');
    this.booth.id = 'dix-booth';
    this.booth.title = 'Llamar a DIXBOT';
    this.booth.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4m0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4z"/></svg>`;
    this.booth.addEventListener('click', () => this._toggle());
    container.appendChild(this.booth);
  }

  _buildBot(container) {
    this.el = document.createElement('div');
    this.el.id = 'dix-bot';

    this.img = document.createElement('img');
    this.img.src = './assets/dixbot_walk_side.png';
    this.img.alt = 'DIXBOT';
    this.el.appendChild(this.img);

    this.bubble = document.createElement('div');
    this.bubble.id = 'dix-bubble';
    container.appendChild(this.bubble);

    this.el.addEventListener('mousedown', e => this._onMouseDown(e));
    container.appendChild(this.el);
  }

  _buildChat(container) {
    this.chat = document.createElement('div');
    this.chat.id = 'dix-chat';
    this.chat.innerHTML = `
      <div id="dix-chat-head">
        🤖 DIXBOT
        <button id="dix-chat-close">×</button>
      </div>
      <div id="dix-chat-body">
        <div class="dix-msg dix-msg-bot">¡Hola! Soy DIXBOT. ¿Quieres optimizar tu sistema? 🔥</div>
      </div>
      <div id="dix-chat-input">
        <input id="dix-chat-text" type="text" placeholder="Escribe algo..." autocomplete="off"/>
        <button id="dix-chat-send">Enviar</button>
      </div>
    `;
    container.appendChild(this.chat);

    this.chat.querySelector('#dix-chat-close').addEventListener('click', () => this._closeChat());
    this.chat.querySelector('#dix-chat-send').addEventListener('click', () => this._sendChat());
    this.chat.querySelector('#dix-chat-text').addEventListener('keydown', e => {
      if (e.key === 'Enter') this._sendChat();
    });
  }

  /* ── TOGGLE / SHOW / HIDE ────────────────────────────────── */
  _toggle() {
    if (this.visible) {
      this._hide();
      this._closeChat();
    } else {
      this._show();
    }
  }

  _show() {
    this.visible = true;
    this.x = window.innerWidth - SIZE - 80;
    this.y = this._floor();
    this.vx = -WALK_SPD * 2;
    this.vy = -4;
    this.el.style.display = 'block';
    this._render();
    this._startLoop();
    this._scheduleSaying();
    this._say('¡Aquí estoy! 🚀', 2000);
  }

  _hide() {
    this.visible = false;
    this.el.style.display = 'none';
    this.bubble.style.display = 'none';
    cancelAnimationFrame(this.raf);
    clearTimeout(this.sayingTimer);
    clearTimeout(this.bubbleTimer);
  }

  /* ── LOOP ────────────────────────────────────────────────── */
  _startLoop() {
    cancelAnimationFrame(this.raf);
    const tick = () => {
      if (!this.visible) return;
      if (!this.dragging) this._step();
      this._render();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  _step() {
    const floor = this._floor();
    const onFloor = this.y >= floor - 1;

    // ── huida del cursor ──
    const dx = this.x + SIZE / 2 - this.mouseX;
    const dy = this.y + SIZE / 2 - this.mouseY;
    const dist = Math.hypot(dx, dy);
    if (dist < FLEE_DIST && dist > 0) {
      const nx = dx / dist;
      const ny = dy / dist;
      const force = (FLEE_DIST - dist) / FLEE_DIST;
      this.vx += nx * force * FLEE_SPD * 0.18;
      if (onFloor) this.vy -= ny * force * 3.5;
    }

    // ── gravedad ──
    if (!onFloor) {
      this.vy += GRAVITY;
    }

    // ── movimiento ──
    this.x += this.vx;
    this.y += this.vy;

    // ── rebotes en bordes ──
    const maxX = window.innerWidth - SIZE;
    const maxY = window.innerHeight - SIZE;

    if (this.x < 0) {
      this.x = 0;
      this.vx = Math.abs(this.vx) * BOUNCE + WALK_SPD;
    }
    if (this.x > maxX) {
      this.x = maxX;
      this.vx = -(Math.abs(this.vx) * BOUNCE + WALK_SPD);
    }
    if (this.y < 0) {
      this.y = 0;
      this.vy = Math.abs(this.vy) * BOUNCE;
    }
    if (this.y >= floor) {
      this.y = floor;
      this.vy = 0;
      // fricción en suelo
      this.vx *= 0.94;
      // mantener caminar si velocidad es baja
      if (Math.abs(this.vx) < WALK_SPD) {
        this.vx = this.vx >= 0 ? WALK_SPD : -WALK_SPD;
      }
    }

    // límite de velocidad horizontal
    this.vx = Math.max(-12, Math.min(12, this.vx));
  }

  _render() {
    this.el.style.left = this.x + 'px';
    this.el.style.top  = this.y + 'px';
    // espejo según dirección
    this.img.style.transform = this.vx > 0 ? 'scaleX(-1)' : 'scaleX(1)';

    // mover burbuja sobre DIXBOT
    if (this.bubble.style.display !== 'none') {
      this.bubble.style.left = (this.x + SIZE / 2 - 90) + 'px';
      this.bubble.style.top  = (this.y - 56) + 'px';
    }
  }

  _floor() {
    return window.innerHeight - SIZE - FLOOR_PAD;
  }

  /* ── DRAG ────────────────────────────────────────────────── */
  _onMouseDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    this.dragging = true;
    this.clickStartX = e.clientX;
    this.clickStartY = e.clientY;
    this.dragOX = e.clientX - this.x;
    this.dragOY = e.clientY - this.y;
    this.dragLastX = e.clientX;
    this.dragLastY = e.clientY;
    this.dragVX = 0;
    this.dragVY = 0;
    this.el.classList.add('grabbing');
    cancelAnimationFrame(this.raf);

    const onMove = ev => {
      this.dragVX = ev.clientX - this.dragLastX;
      this.dragVY = ev.clientY - this.dragLastY;
      this.dragLastX = ev.clientX;
      this.dragLastY = ev.clientY;
      this.x = ev.clientX - this.dragOX;
      this.y = ev.clientY - this.dragOY;
      this._render();
    };

    const onUp = ev => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      this.el.classList.remove('grabbing');
      this.dragging = false;

      const moved = Math.hypot(ev.clientX - this.clickStartX, ev.clientY - this.clickStartY);
      if (moved < 6) {
        // fue click, no drag
        this._onBotClick();
        this._startLoop();
        return;
      }
      // lanzar con inercia
      this.vx = Math.max(-14, Math.min(14, this.dragVX));
      this.vy = Math.max(-14, Math.min(14, this.dragVY));
      this._startLoop();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  _onBotClick() {
    if (this.chatOpen) {
      this._closeChat();
    } else {
      this._openChat();
    }
  }

  /* ── CHAT ────────────────────────────────────────────────── */
  _openChat() {
    this.chatOpen = true;
    this.chat.classList.add('open');
    this._say('¡Cuéntame! 💬', 1500);
  }

  _closeChat() {
    this.chatOpen = false;
    this.chat.classList.remove('open');
  }

  _sendChat() {
    const input = this.chat.querySelector('#dix-chat-text');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    const body = this.chat.querySelector('#dix-chat-body');

    const userMsg = document.createElement('div');
    userMsg.className = 'dix-msg dix-msg-user';
    userMsg.textContent = text;
    body.appendChild(userMsg);

    const responses = [
      '¡Optimiza ya! ⚡',
      'Prueba DIX Linux por €14.99 🔥',
      'Tu kernel merece más 💪',
      'Score 91 al alcance 🎯',
      '¡Compra DIX y lo verás! 🚀',
    ];
    const reply = document.createElement('div');
    reply.className = 'dix-msg dix-msg-bot';
    reply.textContent = responses[Math.floor(Math.random() * responses.length)];

    setTimeout(() => {
      body.appendChild(reply);
      body.scrollTop = body.scrollHeight;
    }, 600);

    body.scrollTop = body.scrollHeight;
  }

  /* ── BOCADILLOS ──────────────────────────────────────────── */
  _say(text, duration = BUBBLE_MS) {
    clearTimeout(this.bubbleTimer);
    this.bubble.textContent = text;
    this.bubble.style.display = 'block';
    this.bubbleTimer = setTimeout(() => {
      this.bubble.style.display = 'none';
    }, duration);
  }

  _scheduleSaying() {
    clearTimeout(this.sayingTimer);
    this.sayingTimer = setTimeout(() => {
      if (!this.visible) return;
      this._say(SAYINGS[Math.floor(Math.random() * SAYINGS.length)]);
      this._scheduleSaying();
    }, BUBBLE_INTERVAL + Math.random() * 4000);
  }

  /* ── MOUSE TRACKING ──────────────────────────────────────── */
  _bindMouse() {
    window.addEventListener('mousemove', e => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
  }
}
