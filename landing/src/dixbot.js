/**
 * DIXBOT Living Mascot v5
 * DixSystem-ready character controller.
 *
 * Philosophy:
 * - Physics are controlled by the character system, not the other way around.
 * - Walking must feel intentional, calm and readable.
 * - Full body rotation is only allowed during thrown/flying/stuck states.
 * - The visual baseline is corrected so DIXBOT never appears buried in the page.
 */

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const now = () => performance.now();

const STATE = Object.freeze({
  WALK: 'walk',
  IDLE: 'idle',
  CURIOUS: 'curious',
  SLEEP: 'sleep',
  GRABBED: 'grabbed',
  FLYING: 'flying',
  LANDED: 'landed',
  STUCK: 'stuck',
  CHAT: 'chat',
});

const FRAME = Object.freeze({
  WALK: [0, 1, 2, 3, 4, 5, 6, 7],
  IDLE: [0],
  CURIOUS: [2],
  SLEEP: [6],
  ANGRY: [5],
  FALL: [7],
  STUCK: [4],
  CHAT: [1],
});

export class DixBotMascot {
  constructor(options = {}) {
    this.options = {
      spriteUrl: options.spriteUrl ?? './assets/dixbot_spritesheet.png',
      size: options.size ?? 92,
      minSize: 80,
      maxSize: 116,
      floorPadding: options.floorPadding ?? 16,
      wallPadding: options.wallPadding ?? 12,
      startX: options.startX ?? window.innerWidth - 140,
      startY: options.startY ?? window.innerHeight - 150,
      chatTitle: options.chatTitle ?? 'DIXBOT',
      chatSubtitle: options.chatSubtitle ?? 'Asistente de DixSystem',
      welcomeMessage: options.welcomeMessage ?? 'Hola, soy DIXBOT.',
      debug: Boolean(options.debug),
    };

    this.size = clamp(this.options.size, this.options.minSize, this.options.maxSize);
    this.radius = this.size * 0.42;
    this.visualFootOffset = this.size * 0.08; // prevents “sunk into the floor” effect

    this.pos = {
      x: clamp(this.options.startX, this.leftLimit(), this.rightLimit()),
      y: clamp(this.options.startY, 80, this.floorY()),
    };
    this.vel = { x: 0, y: 0 };
    this.target = { x: this.pos.x, y: this.floorY() };

    this.state = STATE.IDLE;
    this.facing = -1;
    this.angle = 0;
    this.visualAngle = 0;
    this.scaleX = 1;
    this.frame = 0;
    this.frameTimer = 0;
    this.walkCycleSpeed = 120;

    this.energy = 80;
    this.annoyance = 0;
    this.trust = 70;

    this.lastTime = 0;
    this.lastHumanActivity = now();
    this.lastAutonomyDecision = 0;
    this.lastFloorDust = 0;
    this.lastPointer = { x: 0, y: 0, t: 0 };
    this.drag = null;
    this.clickCandidate = false;
    this.chatOpen = false;
    this.isMounted = false;

    this.boundTick = this.tick.bind(this);
    this.boundPointerMoveGlobal = this.onGlobalPointerMove.bind(this);
    this.boundResize = this.onResize.bind(this);
  }

  mount(parent = document.body) {
    if (this.isMounted) return;
    this.root = document.createElement('div');
    this.root.className = 'dixbot-root';
    this.root.style.setProperty('--dixbot-size', `${this.size}px`);
    this.root.style.setProperty('--dixbot-sprite', `url("${this.options.spriteUrl}")`);

    this.hitbox = document.createElement('div');
    this.hitbox.className = 'dixbot-hitbox';
    this.hitbox.dataset.state = this.state;

    this.character = document.createElement('div');
    this.character.className = 'dixbot-character';

    this.sprite = document.createElement('div');
    this.sprite.className = 'dixbot-sprite';

    this.shadow = document.createElement('div');
    this.shadow.className = 'dixbot-shadow';

    this.bubble = document.createElement('div');
    this.bubble.className = 'dixbot-bubble';

    this.chat = this.createChat();

    this.character.appendChild(this.sprite);
    this.hitbox.appendChild(this.shadow);
    this.hitbox.appendChild(this.character);
    this.root.appendChild(this.hitbox);
    this.root.appendChild(this.bubble);
    this.root.appendChild(this.chat);
    parent.appendChild(this.root);

    this.hitbox.addEventListener('pointerdown', this.onPointerDown.bind(this));
    window.addEventListener('pointermove', this.boundPointerMoveGlobal, { passive: true });
    window.addEventListener('resize', this.boundResize);

    this.setState(STATE.WALK);
    this.say('Hola, soy DIXBOT 👋', 2200);
    this.isMounted = true;
    requestAnimationFrame(this.boundTick);
  }

  createChat() {
    const chat = document.createElement('section');
    chat.className = 'dixbot-chat';
    chat.innerHTML = `
      <div class="dixbot-chat__head">
        <div>
          <div class="dixbot-chat__title"></div>
          <div class="dixbot-chat__subtitle"></div>
        </div>
        <button class="dixbot-chat__close" type="button" aria-label="Cerrar">×</button>
      </div>
      <div class="dixbot-chat__body">
        <div class="dixbot-msg dixbot-msg--bot"></div>
      </div>
      <form class="dixbot-chat__input">
        <input placeholder="Pregúntame sobre DixSystem..." autocomplete="off" />
        <button type="submit">Enviar</button>
      </form>
    `;
    chat.querySelector('.dixbot-chat__title').textContent = this.options.chatTitle;
    chat.querySelector('.dixbot-chat__subtitle').textContent = this.options.chatSubtitle;
    chat.querySelector('.dixbot-msg').textContent = this.options.welcomeMessage;
    chat.querySelector('.dixbot-chat__close').addEventListener('click', () => this.closeChat());
    chat.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault();
      const input = chat.querySelector('input');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      this.addBotMessage('Estoy preparado para conectarme a tu backend real. Ahora mismo soy la interfaz viva de DixSystem.');
      this.celebrate();
    });
    return chat;
  }

  addBotMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'dixbot-msg dixbot-msg--bot';
    msg.textContent = text;
    this.chat.querySelector('.dixbot-chat__body').appendChild(msg);
  }

  leftLimit() { return this.options.wallPadding + this.size * 0.5; }
  rightLimit() { return window.innerWidth - this.options.wallPadding - this.size * 0.5; }
  floorY() { return window.innerHeight - this.options.floorPadding - this.size * 0.5 + this.visualFootOffset; }
  ceilingY() { return this.size * 0.5 + 10; }

  setState(next) {
    if (this.state === next) return;
    this.state = next;
    if (this.hitbox) this.hitbox.dataset.state = next;
  }

  wake() {
    this.lastHumanActivity = now();
    if (this.state === STATE.SLEEP) {
      this.say('Ya voy, ya voy...');
      this.setState(STATE.IDLE);
      this.chooseNewWalkTarget();
    }
  }

  sleep() {
    this.vel.x = 0;
    this.vel.y = 0;
    this.pos.y = this.floorY();
    this.angle = 0;
    this.visualAngle = 0;
    this.setState(STATE.SLEEP);
    this.setFrame(FRAME.SLEEP[0]);
    this.say('Me quedo vigilando en modo reposo...', 2600);
  }

  celebrate() {
    this.wake();
    this.setState(STATE.CURIOUS);
    this.setFrame(2);
    this.vel.y = -4.2;
    this.spawnDust(this.pos.x, this.floorY(), 7);
    this.say('¡DixSystem activo!');
  }

  say(text, duration = 2600) {
    if (!this.bubble) return;
    this.bubble.textContent = text;
    this.positionBubble();
    this.bubble.classList.add('is-visible');
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => this.bubble?.classList.remove('is-visible'), duration);
  }

  onGlobalPointerMove(event) {
    this.lastHumanActivity = now();
    this.lastPointer = { x: event.clientX, y: event.clientY, t: now() };
    if (this.state === STATE.SLEEP && dist({ x: event.clientX, y: event.clientY }, this.pos) < 140) {
      this.wake();
      this.say('¿Me necesitabas?');
    }
  }

  onPointerDown(event) {
    event.preventDefault();
    this.lastHumanActivity = now();
    this.wake();

    this.clickCandidate = true;
    this.drag = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY, t: now() },
      current: { x: event.clientX, y: event.clientY, t: now() },
      previous: { x: event.clientX, y: event.clientY, t: now() },
      velocity: { x: 0, y: 0 },
      offset: { x: this.pos.x - event.clientX, y: this.pos.y - event.clientY },
    };

    this.hitbox.setPointerCapture(event.pointerId);
    this.hitbox.addEventListener('pointermove', this.onPointerMoveBound = this.onPointerMove.bind(this));
    this.hitbox.addEventListener('pointerup', this.onPointerUpBound = this.onPointerUp.bind(this), { once: true });
    this.hitbox.addEventListener('pointercancel', this.onPointerUpBound, { once: true });

    this.annoyance = clamp(this.annoyance + 10, 0, 100);
    this.setState(STATE.GRABBED);
    this.setFrame(FRAME.ANGRY[0]);
    this.vel.x = 0;
    this.vel.y = 0;
    this.say(this.annoyance > 45 ? '¡Con cuidado, humano!' : '¡Eh! ¿A dónde vamos?');
  }

  onPointerMove(event) {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    const t = now();
    const dt = Math.max(12, t - this.drag.current.t);

    this.drag.previous = this.drag.current;
    this.drag.current = { x: event.clientX, y: event.clientY, t };
    this.drag.velocity = {
      x: ((this.drag.current.x - this.drag.previous.x) / dt) * 16.67,
      y: ((this.drag.current.y - this.drag.previous.y) / dt) * 16.67,
    };

    if (dist(this.drag.start, this.drag.current) > 8) this.clickCandidate = false;

    const desired = {
      x: event.clientX + this.drag.offset.x,
      y: event.clientY + this.drag.offset.y,
    };

    // Rigid enough to feel direct, smoothed enough to avoid spasms.
    this.pos.x = lerp(this.pos.x, clamp(desired.x, this.leftLimit(), this.rightLimit()), 0.58);
    this.pos.y = lerp(this.pos.y, clamp(desired.y, this.ceilingY(), this.floorY()), 0.58);
    this.angle = 0;
    this.visualAngle = 0;
  }

  onPointerUp(event) {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    this.hitbox.releasePointerCapture(event.pointerId);
    this.hitbox.removeEventListener('pointermove', this.onPointerMoveBound);

    const duration = now() - this.drag.start.t;
    const travel = dist(this.drag.start, this.drag.current);
    const speed = Math.hypot(this.drag.velocity.x, this.drag.velocity.y);

    if (this.clickCandidate && duration < 260 && travel < 9) {
      this.drag = null;
      this.toggleChat();
      return;
    }

    this.vel.x = clamp(this.drag.velocity.x * 1.05, -22, 22);
    this.vel.y = clamp(this.drag.velocity.y * 1.05, -22, 22);
    this.angle = 0;
    this.visualAngle = 0;
    this.drag = null;
    this.setState(STATE.FLYING);
    this.setFrame(FRAME.FALL[0]);

    if (speed > 13) this.say('¡Woooooo!');
  }

  toggleChat() {
    if (this.chatOpen) this.closeChat();
    else this.openChat();
  }

  openChat() {
    this.chatOpen = true;
    this.hitbox.dataset.chat = 'open';
    this.chat.classList.add('is-open');
    this.setState(STATE.CHAT);
    this.setFrame(FRAME.CHAT[0]);
    this.vel.x = 0;
    this.vel.y = 0;
    this.target.x = window.innerWidth - 74;
    this.target.y = this.floorY();
    this.say('Modo asistente activado.', 1600);
  }

  closeChat() {
    this.chatOpen = false;
    this.hitbox.dataset.chat = 'closed';
    this.chat.classList.remove('is-open');
    this.setState(STATE.IDLE);
    this.chooseNewWalkTarget();
    this.say('Vuelvo a patrullar.');
  }

  onResize() {
    this.pos.x = clamp(this.pos.x, this.leftLimit(), this.rightLimit());
    this.pos.y = clamp(this.pos.y, this.ceilingY(), this.floorY());
    this.target.x = clamp(this.target.x, this.leftLimit(), this.rightLimit());
    this.target.y = this.floorY();
  }

  chooseNewWalkTarget() {
    const margin = Math.max(90, this.size);
    const min = margin;
    const max = window.innerWidth - margin;
    const nextX = clamp(min + Math.random() * (max - min), this.leftLimit(), this.rightLimit());
    this.target = { x: nextX, y: this.floorY() };
    this.facing = nextX >= this.pos.x ? 1 : -1;
    this.setState(STATE.WALK);
  }

  tick(time) {
    if (!this.lastTime) this.lastTime = time;
    const dt = clamp((time - this.lastTime) / 16.67, 0.5, 2.0);
    this.lastTime = time;

    this.updateAutonomy(time);
    this.updatePhysics(dt, time);
    this.updateAnimation(dt, time);
    this.render();

    requestAnimationFrame(this.boundTick);
  }

  updateAutonomy(time) {
    const inactiveFor = now() - this.lastHumanActivity;

    if (!this.chatOpen && !this.drag && this.state !== STATE.FLYING && this.state !== STATE.STUCK) {
      if (inactiveFor > 24000 && this.state !== STATE.SLEEP) {
        this.sleep();
        return;
      }

      if (time - this.lastAutonomyDecision > 4200) {
        this.lastAutonomyDecision = time;
        const r = Math.random();
        if (this.state === STATE.WALK && Math.abs(this.target.x - this.pos.x) < 12) {
          this.setState(STATE.IDLE);
          this.vel.x = 0;
        } else if (this.state === STATE.IDLE && r < 0.72) {
          this.chooseNewWalkTarget();
        } else if (this.state === STATE.IDLE && r < 0.86) {
          this.setState(STATE.CURIOUS);
          this.setFrame(FRAME.CURIOUS[0]);
          if (Math.random() < 0.35) this.say('Estoy observando la web...');
        } else if (this.state === STATE.CURIOUS) {
          this.setState(STATE.IDLE);
        }
      }
    }
  }

  updatePhysics(dt, time) {
    const floor = this.floorY();

    if (this.chatOpen && this.state === STATE.CHAT) {
      this.pos.x = lerp(this.pos.x, this.target.x, 0.06 * dt);
      this.pos.y = lerp(this.pos.y, floor, 0.07 * dt);
      this.vel.x = 0;
      this.vel.y = 0;
      this.angle = 0;
      this.visualAngle = lerp(this.visualAngle, 0, 0.14 * dt);
      return;
    }

    if (this.state === STATE.SLEEP || this.state === STATE.GRABBED) {
      this.vel.x *= 0.8;
      this.vel.y *= 0.8;
      this.pos.y = this.state === STATE.SLEEP ? lerp(this.pos.y, floor, 0.12 * dt) : this.pos.y;
      this.angle = 0;
      this.visualAngle = lerp(this.visualAngle, 0, 0.22 * dt);
      return;
    }

    if (this.state === STATE.WALK || this.state === STATE.IDLE || this.state === STATE.CURIOUS || this.state === STATE.LANDED) {
      // Grounded character locomotion: slow, intentional, no physical rotation.
      const dx = this.target.x - this.pos.x;
      const desiredSpeed = this.state === STATE.WALK ? clamp(dx * 0.022, -1.35, 1.35) : 0;
      this.vel.x = lerp(this.vel.x, desiredSpeed, 0.055 * dt);
      this.pos.x += this.vel.x * dt;
      this.pos.y = lerp(this.pos.y, floor, 0.2 * dt);

      if (Math.abs(this.vel.x) > 0.08) this.facing = this.vel.x > 0 ? 1 : -1;
      if (this.state === STATE.WALK && Math.abs(dx) < 10) {
        this.setState(STATE.IDLE);
        this.vel.x = 0;
      }

      this.angle = 0;
      this.visualAngle = lerp(this.visualAngle, 0, 0.18 * dt);
      this.collideWallsGrounded();
      return;
    }

    if (this.state === STATE.FLYING || this.state === STATE.STUCK) {
      if (this.state === STATE.STUCK) {
        this.vel.x *= 0.86;
        this.vel.y *= 0.86;
        return;
      }

      const gravity = 0.46;
      const air = 0.988;
      this.vel.y += gravity * dt;
      this.vel.x *= Math.pow(air, dt);
      this.vel.y *= Math.pow(air, dt);

      this.pos.x += this.vel.x * dt;
      this.pos.y += this.vel.y * dt;

      this.angle += clamp(this.vel.x * 0.011, -0.13, 0.13) * dt;
      this.visualAngle = lerp(this.visualAngle, clamp(this.angle, -0.65, 0.65), 0.16 * dt);

      this.collideWhileFlying(time);
    }
  }

  collideWallsGrounded() {
    if (this.pos.x < this.leftLimit()) {
      this.pos.x = this.leftLimit();
      this.vel.x = Math.abs(this.vel.x) * 0.2;
      this.chooseNewWalkTarget();
    }
    if (this.pos.x > this.rightLimit()) {
      this.pos.x = this.rightLimit();
      this.vel.x = -Math.abs(this.vel.x) * 0.2;
      this.chooseNewWalkTarget();
    }
  }

  collideWhileFlying(time) {
    const floor = this.floorY();
    const left = this.leftLimit();
    const right = this.rightLimit();
    let collided = false;
    let impactX = this.pos.x;
    let impactY = this.pos.y;

    if (this.pos.x <= left) {
      this.pos.x = left;
      impactX = left;
      this.handleWallImpact('left');
      collided = true;
    } else if (this.pos.x >= right) {
      this.pos.x = right;
      impactX = right;
      this.handleWallImpact('right');
      collided = true;
    }

    if (this.pos.y >= floor) {
      this.pos.y = floor;
      impactY = floor + this.size * 0.34;
      const impact = Math.abs(this.vel.y);
      this.vel.y = -this.vel.y * 0.34;
      this.vel.x *= 0.76;
      this.angle *= 0.35;
      collided = true;

      if (impact > 8) this.spawnDust(this.pos.x, impactY, 9);
      if (impact < 2.2 && Math.abs(this.vel.x) < 1.1) {
        this.vel.x = 0;
        this.vel.y = 0;
        this.setState(STATE.LANDED);
        this.setFrame(FRAME.IDLE[0]);
        this.spawnImpact(this.pos.x, impactY);
        setTimeout(() => {
          if (this.state === STATE.LANDED && !this.chatOpen) {
            this.setState(STATE.IDLE);
            this.chooseNewWalkTarget();
          }
        }, 420);
      }
    }

    if (collided && time - this.lastFloorDust > 90) {
      this.lastFloorDust = time;
      this.spawnImpact(impactX, impactY);
    }
  }

  handleWallImpact(side) {
    const speed = Math.hypot(this.vel.x, this.vel.y);
    if (speed > 18) {
      this.vel.x = 0;
      this.vel.y = 0;
      this.setState(STATE.STUCK);
      this.setFrame(FRAME.STUCK[0]);
      this.angle = side === 'left' ? -0.28 : 0.28;
      this.visualAngle = this.angle;
      this.say('Creo que me he quedado clavado...');
      setTimeout(() => {
        if (this.state === STATE.STUCK) {
          this.vel.y = 1.2;
          this.vel.x = side === 'left' ? 1.8 : -1.8;
          this.setState(STATE.FLYING);
          this.setFrame(FRAME.FALL[0]);
        }
      }, 1400);
      return;
    }

    this.vel.x = -this.vel.x * 0.42;
    this.vel.y *= 0.82;
    this.angle *= -0.25;
  }

  updateAnimation(dt) {
    const moving = Math.abs(this.vel.x) > 0.16 && this.state === STATE.WALK;
    const sequence = this.sequenceForState(moving);
    const speed = moving ? clamp(170 - Math.abs(this.vel.x) * 28, 95, 170) : 520;

    this.frameTimer += 16.67 * dt;
    if (this.frameTimer > speed) {
      this.frameTimer = 0;
      const currentIndex = sequence.indexOf(this.frame);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % sequence.length : 0;
      this.setFrame(sequence[nextIndex]);
    }
  }

  sequenceForState(moving) {
    if (this.state === STATE.WALK && moving) return FRAME.WALK;
    if (this.state === STATE.SLEEP) return FRAME.SLEEP;
    if (this.state === STATE.GRABBED) return FRAME.ANGRY;
    if (this.state === STATE.FLYING) return FRAME.FALL;
    if (this.state === STATE.STUCK) return FRAME.STUCK;
    if (this.state === STATE.CHAT) return FRAME.CHAT;
    if (this.state === STATE.CURIOUS) return FRAME.CURIOUS;
    return FRAME.IDLE;
  }

  setFrame(index) {
    this.frame = index;
    if (!this.sprite) return;
    const col = index % 4;
    const row = Math.floor(index / 4);
    this.sprite.style.backgroundPosition = `${col * 33.333333}% ${row * 100}%`;
  }

  render() {
    this.hitbox.style.left = `${this.pos.x}px`;
    this.hitbox.style.top = `${this.pos.y}px`;

    const flip = this.facing < 0 ? -1 : 1;
    const characterScaleX = flip;
    this.character.style.transform = `rotate(${this.visualAngle}rad) scaleX(${characterScaleX})`;

    const heightAboveFloor = clamp(this.floorY() - this.pos.y, 0, 220);
    const shadowScale = clamp(1 - heightAboveFloor / 260, 0.42, 1);
    this.shadow.style.transform = `translateX(-50%) scale(${shadowScale}, ${clamp(shadowScale * 0.72, .32, .76)})`;
    this.shadow.style.opacity = `${clamp(0.78 - heightAboveFloor / 330, 0.18, 0.78)}`;

    this.positionBubble();
  }

  positionBubble() {
    if (!this.bubble) return;
    const gap = 12;
    const bubbleWidth = Math.min(260, window.innerWidth - 34);
    let left = this.pos.x + this.size * 0.16;
    let top = this.pos.y - this.size * 0.74;
    left = clamp(left, 12, window.innerWidth - bubbleWidth - 12);
    top = clamp(top, 12, window.innerHeight - 90);
    this.bubble.style.left = `${left}px`;
    this.bubble.style.top = `${top}px`;
  }

  spawnImpact(x, y) {
    if (!this.root) return;
    const el = document.createElement('span');
    el.className = 'dixbot-impact';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.root.appendChild(el);
    setTimeout(() => el.remove(), 520);
  }

  spawnDust(x, y, count = 5) {
    if (!this.root) return;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.className = 'dixbot-dust';
      el.style.left = `${x + (Math.random() - .5) * 18}px`;
      el.style.top = `${y}px`;
      el.style.setProperty('--dx', `${(Math.random() - .5) * 54}px`);
      el.style.setProperty('--dy', `${-10 - Math.random() * 24}px`);
      this.root.appendChild(el);
      setTimeout(() => el.remove(), 620);
    }
  }

  destroy() {
    window.removeEventListener('pointermove', this.boundPointerMoveGlobal);
    window.removeEventListener('resize', this.boundResize);
    this.root?.remove();
    this.isMounted = false;
  }
}
