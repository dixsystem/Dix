export class DixBotMascot {
  constructor() {
    this.visible = false;
    this.x = window.innerWidth - 110;
    this.y = window.innerHeight - 110;
    this.vx = -1.2;
    this.vy = 0;
    this.raf = null;
    this.el = null;
    this.booth = null;
  }

  mount(container) {
    this._createStyles();
    this._createBooth(container);
    this._createBot(container);
    window.addEventListener('resize', () => this._clamp());
  }

  _createStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #dix-booth {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 56px;
        height: 56px;
        background: #FF6B00;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 20px rgba(255,107,0,0.5);
        z-index: 9000;
        transition: transform 0.2s, box-shadow 0.2s;
        user-select: none;
      }
      #dix-booth:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 28px rgba(255,107,0,0.7);
      }
      #dix-booth svg {
        width: 28px;
        height: 28px;
        fill: #000;
      }
      #dix-bot {
        position: fixed;
        width: 90px;
        height: 90px;
        z-index: 8999;
        cursor: grab;
        display: none;
        user-select: none;
        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));
      }
      #dix-bot img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  _createBooth(container) {
    this.booth = document.createElement('div');
    this.booth.id = 'dix-booth';
    this.booth.title = 'Abrir DIXBOT';
    this.booth.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4m0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4z"/></svg>`;
    this.booth.addEventListener('click', () => this._toggle());
    container.appendChild(this.booth);
  }

  _createBot(container) {
    this.el = document.createElement('div');
    this.el.id = 'dix-bot';

    const img = document.createElement('img');
    img.src = './assets/dixbot_walk_side.png';
    img.alt = 'DIXBOT';
    this.el.appendChild(img);

    this.el.addEventListener('mousedown', e => this._grab(e));
    container.appendChild(this.el);
  }

  _toggle() {
    if (this.visible) {
      this._hide();
    } else {
      this._show();
    }
  }

  _show() {
    this.visible = true;
    this.x = window.innerWidth - 130;
    this.y = window.innerHeight - 130;
    this.vx = -1.2;
    this.vy = -0.5;
    this.el.style.display = 'block';
    this.el.style.left = this.x + 'px';
    this.el.style.top = this.y + 'px';
    this._loop();
  }

  _hide() {
    this.visible = false;
    this.el.style.display = 'none';
    cancelAnimationFrame(this.raf);
  }

  _loop() {
    this.raf = requestAnimationFrame(() => {
      if (!this.visible) return;
      this._physics();
      this._render();
      this._loop();
    });
  }

  _physics() {
    this.x += this.vx;
    this.y += this.vy;

    const maxX = window.innerWidth - 90;
    const maxY = window.innerHeight - 90;

    if (this.x <= 0) { this.x = 0; this.vx = Math.abs(this.vx); }
    if (this.x >= maxX) { this.x = maxX; this.vx = -Math.abs(this.vx); }
    if (this.y <= 0) { this.y = 0; this.vy = Math.abs(this.vy); }
    if (this.y >= maxY) {
      this.y = maxY;
      this.vy = 0;
    }

    // gravedad suave si no está en el suelo
    if (this.y < window.innerHeight - 90) {
      this.vy += 0.05;
    }
  }

  _render() {
    this.el.style.left = this.x + 'px';
    this.el.style.top = this.y + 'px';
    this.el.style.transform = this.vx > 0 ? 'scaleX(-1)' : 'scaleX(1)';
  }

  _clamp() {
    this.x = Math.min(this.x, window.innerWidth - 90);
    this.y = Math.min(this.y, window.innerHeight - 90);
  }

  _grab(e) {
    e.preventDefault();
    cancelAnimationFrame(this.raf);
    this.el.style.cursor = 'grabbing';

    const ox = e.clientX - this.x;
    const oy = e.clientY - this.y;
    let lastX = e.clientX;
    let lastY = e.clientY;

    const onMove = ev => {
      this.vx = ev.clientX - lastX;
      this.vy = ev.clientY - lastY;
      lastX = ev.clientX;
      lastY = ev.clientY;
      this.x = ev.clientX - ox;
      this.y = ev.clientY - oy;
      this._render();
    };

    const onUp = () => {
      this.el.style.cursor = 'grab';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      this.vx = Math.max(-8, Math.min(8, this.vx));
      this.vy = Math.max(-8, Math.min(8, this.vy));
      this._loop();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }
}
