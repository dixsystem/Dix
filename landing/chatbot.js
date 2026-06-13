/* ================================================================
   DIX CHATBOT — Avatar físico + IA Comercial
   dixsystem.com
   ================================================================ */

(function () {
  'use strict';

  /* ── DETECCIÓN DE IDIOMA ── */
  const LANG = (navigator.language || navigator.userLanguage || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';

  /* ── TEXTOS BILINGÜE ── */
  const T = {
    idle: {
      es: ["¿Alguna duda? Aquí estoy", "¿Tu sistema está optimizado?", "34→91 en segundos...", "¡Pregúntame algo!", "¿Cuál es tu CPU?", "¿Sabes qué es una AppIA?"],
      en: ["Any questions? I'm here", "Is your system optimized?", "34→91 in seconds...", "Ask me anything!", "What's your CPU?", "Do you know what an AppIA is?"]
    },
    cursor: { es: "¿Qué miras...?", en: "What are you looking at...?" },
    defensive: {
      es: ["¡Ey! ¡Espacio personal!", "¡Aléjate!", "...te estoy vigilando"],
      en: ["Hey! Personal space!", "Back off!", "...I'm watching you"]
    },
    hover: { es: "...no te muevas", en: "...don't move" },
    grabbed: { es: "¡SUÉLTAME!", en: "LET GO!" },
    thrown: { es: "¡AAAHHH!", en: "AAAHHH!" },
    collision: { es: ["¡AUCH!", "*IMPACTO DETECTADO*"], en: ["OUCH!", "*IMPACT DETECTED*"] },
    poke: { es: "¡Para!", en: "Stop that!" },
    wakeup: { es: "¡Huh! ¿Qué...?", en: "Huh! What...?" },
    protocol: { es: "PROTOCOLO COMERCIAL ACTIVADO", en: "COMMERCIAL PROTOCOL ACTIVATED" },
    welcome: {
      es: "Protocolo iniciado. Soy DIX.\n¿Qué CPU y distro tienes?\nEn 10 segundos te digo exactamente cuánto puede mejorar tu sistema.",
      en: "Protocol initiated. I'm DIX.\nWhat CPU and distro do you have?\nIn 10 seconds I'll tell you exactly how much your system can improve."
    },
    returnMsg: {
      es: (score) => `Bienvenido de nuevo. Sigues en ${score}/100.`,
      en: (score) => `Welcome back. You're still at ${score}/100.`
    },
    exitIntent: {
      es: "Tu sistema sigue sin optimizar. ¿30 segundos?",
      en: "Your system is still unoptimized. 30 seconds?"
    },
    offerBtn: { es: "🔥 OFERTA — 10€ AHORA", en: "🔥 OFFER — 10€ NOW" },
    keyModal: {
      es: { title: "API Key requerida", body: "Para activar el asistente IA, introduce tu API key de Anthropic.\nObtén una en console.anthropic.com", placeholder: "sk-ant-...", btn: "Activar" },
      en: { title: "API Key required", body: "To activate the AI assistant, enter your Anthropic API key.\nGet one at console.anthropic.com", placeholder: "sk-ant-...", btn: "Activate" }
    },
    typing: { es: "DIX está pensando...", en: "DIX is thinking..." }
  };

  function t(key, arr) {
    const v = T[key][LANG];
    if (Array.isArray(v)) return arr ? v : v[Math.floor(Math.random() * v.length)];
    return typeof v === 'function' ? v : v;
  }

  /* ── ESTILOS INLINE ── */
  const style = document.createElement('style');
  style.textContent = `
    #dix-canvas-wrap {
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      z-index: 9998; pointer-events: none; overflow: hidden;
    }
    #dix-canvas { display: block; width: 100%; height: 100%; }

    #dix-chat-trigger {
      position: fixed; bottom: 28px; right: 28px; z-index: 9999;
      width: 56px; height: 56px; border-radius: 50%;
      background: linear-gradient(135deg, #FF6B00, #cc3300);
      border: 2px solid rgba(255,107,0,.5);
      box-shadow: 0 0 24px rgba(255,107,0,.35), 0 4px 16px rgba(0,0,0,.5);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: transform .2s, box-shadow .2s;
      animation: dix-pulse 3s ease-in-out infinite;
    }
    #dix-chat-trigger:hover { transform: scale(1.1); box-shadow: 0 0 36px rgba(255,107,0,.55), 0 6px 20px rgba(0,0,0,.6); }
    #dix-chat-trigger svg { width: 26px; height: 26px; fill: #fff; }

    @keyframes dix-pulse {
      0%,100% { box-shadow: 0 0 24px rgba(255,107,0,.35), 0 4px 16px rgba(0,0,0,.5); }
      50% { box-shadow: 0 0 40px rgba(255,107,0,.6), 0 4px 20px rgba(0,0,0,.5); }
    }

    #dix-chat-panel {
      position: fixed; bottom: 96px; right: 20px; z-index: 10000;
      width: 380px; height: 520px; background: #0d1117;
      border: 1px solid #FF6B00; border-radius: 16px;
      box-shadow: 0 0 40px rgba(255,107,0,.25), 0 20px 60px rgba(0,0,0,.8);
      display: flex; flex-direction: column; overflow: hidden;
      transform: translateY(30px) scale(.95); opacity: 0;
      transition: transform .35s cubic-bezier(.34,1.56,.64,1), opacity .25s;
      pointer-events: none;
      font-family: 'Inter', system-ui, sans-serif;
    }
    #dix-chat-panel.open {
      transform: translateY(0) scale(1); opacity: 1; pointer-events: all;
    }

    .dix-header {
      background: linear-gradient(135deg, #161b22, #0d1117);
      border-bottom: 1px solid rgba(255,107,0,.3);
      padding: 14px 16px; display: flex; align-items: center; gap: 12px;
    }
    .dix-header-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: rgba(255,255,255,.03); border: 1.5px solid #FF6B00;
      display: flex; align-items: center; justify-content: center;
      animation: dix-hdr-pulse 2s ease-in-out infinite;
      flex-shrink: 0;
    }
    @keyframes dix-hdr-pulse {
      0%,100% { border-color: #FF6B00; box-shadow: 0 0 8px rgba(255,107,0,.4); }
      50% { border-color: #00cccc; box-shadow: 0 0 12px rgba(0,204,204,.4); }
    }
    .dix-header-info { flex: 1; }
    .dix-header-name { font-family: 'Orbitron', sans-serif; font-size: 13px; font-weight: 700; color: #FF6B00; letter-spacing: 1px; }
    .dix-header-status { font-size: 11px; color: #8b949e; display: flex; align-items: center; gap: 5px; margin-top: 2px; }
    .dix-status-dot { width: 7px; height: 7px; border-radius: 50%; background: #00ff88; animation: dix-blink 2s ease-in-out infinite; }
    @keyframes dix-blink { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
    .dix-close { background: none; border: none; color: #8b949e; cursor: pointer; padding: 4px; border-radius: 4px; transition: color .2s; font-size: 18px; line-height: 1; }
    .dix-close:hover { color: #fff; }

    .dix-messages {
      flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px;
      scrollbar-width: thin; scrollbar-color: rgba(255,107,0,.2) transparent;
    }
    .dix-messages::-webkit-scrollbar { width: 4px; }
    .dix-messages::-webkit-scrollbar-thumb { background: rgba(255,107,0,.25); border-radius: 2px; }

    .dix-msg { display: flex; flex-direction: column; max-width: 80%; animation: dix-msg-in .25s ease; }
    @keyframes dix-msg-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .dix-msg.bot { align-self: flex-start; }
    .dix-msg.user { align-self: flex-end; align-items: flex-end; }
    .dix-bubble {
      padding: 10px 14px; border-radius: 12px; font-size: 13px; line-height: 1.55; white-space: pre-wrap;
    }
    .dix-msg.bot .dix-bubble { background: #161b22; color: #e6edf3; border-radius: 4px 12px 12px 12px; border-left: 2px solid rgba(255,107,0,.4); }
    .dix-msg.user .dix-bubble { background: rgba(255,107,0,.18); color: #e6edf3; border-radius: 12px 4px 12px 12px; border-right: 2px solid rgba(255,107,0,.6); }
    .dix-ts { font-size: 10px; color: #484f58; margin-top: 4px; padding: 0 4px; }

    .dix-typing { display: flex; align-items: center; gap: 6px; padding: 10px 14px; background: #161b22; border-radius: 4px 12px 12px 12px; border-left: 2px solid rgba(255,107,0,.4); align-self: flex-start; }
    .dix-typing span { width: 7px; height: 7px; border-radius: 50%; background: #FF6B00; animation: dix-wave .9s ease-in-out infinite; }
    .dix-typing span:nth-child(2) { animation-delay: .15s; }
    .dix-typing span:nth-child(3) { animation-delay: .3s; }
    @keyframes dix-wave { 0%,60%,100% { transform: translateY(0); opacity: .6; } 30% { transform: translateY(-6px); opacity: 1; } }

    .dix-offer-btn {
      display: block; width: calc(100% - 32px); margin: 0 16px 8px;
      padding: 10px; text-align: center; font-family: 'Orbitron', sans-serif;
      font-size: 12px; font-weight: 700; letter-spacing: .5px;
      background: linear-gradient(135deg, #FF6B00, #cc3300);
      color: #fff; border: none; border-radius: 8px; cursor: pointer;
      box-shadow: 0 0 20px rgba(255,107,0,.4); animation: dix-pulse 1.5s ease-in-out infinite;
      transition: transform .15s;
    }
    .dix-offer-btn:hover { transform: scale(1.02); }
    .dix-countdown { text-align: center; font-size: 11px; color: #FF6B00; margin-bottom: 4px; font-family: 'JetBrains Mono', monospace; }

    .dix-input-area {
      border-top: 1px solid rgba(255,107,0,.2); padding: 12px 16px;
      display: flex; gap: 8px; align-items: flex-end; background: #0d1117;
    }
    #dix-input {
      flex: 1; background: #161b22; border: 1px solid rgba(255,107,0,.25);
      border-radius: 8px; padding: 9px 12px; font-size: 13px; color: #e6edf3;
      font-family: 'Inter', system-ui, sans-serif; resize: none; outline: none;
      max-height: 80px; line-height: 1.4; transition: border-color .2s;
    }
    #dix-input:focus { border-color: rgba(255,107,0,.6); }
    #dix-input::placeholder { color: #484f58; }
    #dix-send {
      width: 36px; height: 36px; border-radius: 8px; border: none;
      background: #FF6B00; color: #000; cursor: pointer; display: flex;
      align-items: center; justify-content: center; flex-shrink: 0;
      transition: background .2s, transform .15s;
    }
    #dix-send:hover { background: #ff8c00; transform: scale(1.05); }
    #dix-send svg { width: 16px; height: 16px; fill: #000; }

    /* Modal API key */
    #dix-key-modal {
      position: fixed; inset: 0; z-index: 10001; display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,.75); backdrop-filter: blur(6px);
      opacity: 0; pointer-events: none; transition: opacity .25s;
    }
    #dix-key-modal.open { opacity: 1; pointer-events: all; }
    .dix-key-box {
      background: #0d1117; border: 1px solid #FF6B00; border-radius: 14px;
      padding: 30px 28px; width: 360px; max-width: 90vw;
      box-shadow: 0 0 40px rgba(255,107,0,.25);
    }
    .dix-key-title { font-family: 'Orbitron', sans-serif; font-size: 15px; color: #FF6B00; margin-bottom: 10px; }
    .dix-key-body { font-size: 13px; color: #8b949e; line-height: 1.6; margin-bottom: 18px; white-space: pre-line; }
    .dix-key-input {
      width: 100%; background: #161b22; border: 1px solid rgba(255,107,0,.3);
      border-radius: 8px; padding: 10px 12px; font-size: 13px; color: #e6edf3;
      font-family: 'JetBrains Mono', monospace; outline: none; box-sizing: border-box;
      margin-bottom: 14px; transition: border-color .2s;
    }
    .dix-key-input:focus { border-color: rgba(255,107,0,.7); }
    .dix-key-btn {
      width: 100%; padding: 11px; background: #FF6B00; border: none; border-radius: 8px;
      font-family: 'Orbitron', sans-serif; font-size: 13px; font-weight: 700;
      color: #000; cursor: pointer; transition: background .2s;
    }
    .dix-key-btn:hover { background: #ff8c00; }
    .dix-key-skip { display: block; text-align: center; margin-top: 10px; font-size: 12px; color: #484f58; cursor: pointer; }
    .dix-key-skip:hover { color: #8b949e; }

    /* Bocadillo flotante del avatar */
    .dix-speech {
      position: fixed; z-index: 9999; background: rgba(13,17,23,.92);
      border: 1px solid rgba(255,107,0,.4); border-radius: 10px;
      padding: 6px 10px; font-size: 12px; color: #e6edf3;
      font-family: 'Inter', system-ui, sans-serif; pointer-events: none;
      white-space: nowrap; backdrop-filter: blur(8px);
      animation: dix-speech-in .2s ease; max-width: 200px; white-space: normal;
    }
    @keyframes dix-speech-in { from { opacity: 0; transform: translateY(4px) scale(.95); } to { opacity: 1; transform: translateY(0) scale(1); } }

    /* Partículas */
    .dix-particle {
      position: fixed; z-index: 9997; border-radius: 50%; pointer-events: none;
      animation: dix-particle-out .6s ease forwards;
    }
    @keyframes dix-particle-out { to { opacity: 0; transform: scale(0); } }

    /* Protocolo activado */
    .dix-protocol-text {
      position: fixed; z-index: 10000; font-family: 'Orbitron', sans-serif;
      font-size: 11px; font-weight: 700; letter-spacing: 2px;
      color: #FF6B00; text-shadow: 0 0 12px rgba(255,107,0,.8);
      pointer-events: none; animation: dix-protocol-anim 1.5s ease forwards;
    }
    @keyframes dix-protocol-anim {
      0% { opacity: 0; transform: scale(.8) translateY(10px); }
      20% { opacity: 1; transform: scale(1) translateY(0); }
      80% { opacity: 1; }
      100% { opacity: 0; }
    }

    /* Efecto vibrar */
    @keyframes dix-shake { 0%,100% { transform: translate(0,0); } 25% { transform: translate(-2px,0); } 75% { transform: translate(2px,0); } }
  `;
  document.head.appendChild(style);

  /* ── CANVAS WRAP ── */
  const wrap = document.createElement('div');
  wrap.id = 'dix-chat-wrap';

  const canvasWrap = document.createElement('div');
  canvasWrap.id = 'dix-canvas-wrap';
  const canvas = document.createElement('canvas');
  canvas.id = 'dix-canvas';
  canvasWrap.appendChild(canvas);
  document.body.appendChild(canvasWrap);

  /* ── BOTÓN TRIGGER CHAT ── */
  const trigger = document.createElement('button');
  trigger.id = 'dix-chat-trigger';
  trigger.setAttribute('aria-label', 'Abrir chat DIX');
  trigger.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>`;
  document.body.appendChild(trigger);

  /* ── PANEL DE CHAT ── */
  const panel = document.createElement('div');
  panel.id = 'dix-chat-panel';
  panel.innerHTML = `
    <div class="dix-header">
      <div class="dix-header-avatar">
        <svg width="22" height="22" viewBox="0 0 44 44" fill="none">
          <ellipse cx="22" cy="22" r="20" fill="rgba(255,107,0,0.15)" stroke="#FF6B00" stroke-width="1.5"/>
          <rect x="12" y="20" width="20" height="12" rx="2" fill="#FF7A00"/>
          <rect x="15" y="16" width="14" height="7" rx="3" fill="#FF7A00"/>
          <circle cx="17.5" cy="23.5" r="2.5" fill="#CCFF00"/>
          <circle cx="26.5" cy="23.5" r="2.5" fill="#CCFF00"/>
          <rect x="19" y="29" width="6" height="1.5" rx=".75" fill="rgba(255,255,255,.4)"/>
        </svg>
      </div>
      <div class="dix-header-info">
        <div class="dix-header-name">DIX Assistant</div>
        <div class="dix-header-status"><span class="dix-status-dot"></span>online</div>
      </div>
      <button class="dix-close" id="dix-close-btn" aria-label="Cerrar">✕</button>
    </div>
    <div class="dix-messages" id="dix-messages"></div>
    <div id="dix-offer-area"></div>
    <div class="dix-input-area">
      <textarea id="dix-input" rows="1" placeholder="${LANG === 'es' ? 'Escribe tu pregunta...' : 'Type your question...'}"></textarea>
      <button id="dix-send" aria-label="Enviar">
        <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>
    </div>
  `;
  document.body.appendChild(panel);

  /* ── MODAL API KEY ── */
  const km = T.keyModal[LANG];
  const keyModal = document.createElement('div');
  keyModal.id = 'dix-key-modal';
  keyModal.innerHTML = `
    <div class="dix-key-box">
      <div class="dix-key-title">${km.title}</div>
      <div class="dix-key-body">${km.body}</div>
      <input class="dix-key-input" id="dix-key-input" type="password" placeholder="${km.placeholder}" autocomplete="off"/>
      <button class="dix-key-btn" id="dix-key-save">${km.btn}</button>
      <span class="dix-key-skip" id="dix-key-skip">${LANG === 'es' ? 'Continuar en modo demo' : 'Continue in demo mode'}</span>
    </div>
  `;
  document.body.appendChild(keyModal);

  /* ── ESTADO ── */
  const LS_KEY = 'dix_chat_history';
  const LS_KEY_API = 'dix_chat_key';
  const LS_CPU = 'dix_user_cpu';
  const LS_SCORE = 'dix_user_score';
  const LS_OFFER = 'dix_offer_used';
  const LS_FIRST = 'dix_first_visit';
  const LS_MSGS = 'dix_msg_count';
  const LS_EXIT = 'dix_exit_shown';

  let chatOpen = false;
  let priceCount = 0;
  let offerActive = false;
  let offerTimer = null;
  let exitIntentTimeout = null;
  let chatHistory = [];
  let isDemoMode = false;

  function getApiKey() { return localStorage.getItem(LS_KEY_API) || ''; }
  function getHistory() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } }
  function saveHistory(h) { localStorage.setItem(LS_KEY, JSON.stringify(h.slice(-10))); }
  function now() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

  /* ── RESPUESTAS DEMO ── */
  const DEMO = {
    es: [
      "Sin API key activa en modo demo. Tu sistema probablemente ronda 35-55/100.",
      "Con DIX Linux puedes llegar a 80-90+. CPU governor, swappiness, TCP BBR — todo optimizado.",
      "El score se mide con benchmarks reales: sysbench + fio. Nada de marketing.",
      "DIX Linux cuesta 14,99€ pago único. 14 días de garantía sin preguntas.",
      "Dame tu CPU y distro y te digo el score estimado exacto."
    ],
    en: [
      "No API key, running in demo mode. Your system is probably around 35-55/100.",
      "With DIX Linux you can reach 80-90+. CPU governor, swappiness, TCP BBR — all optimized.",
      "Score is measured with real benchmarks: sysbench + fio. No marketing fluff.",
      "DIX Linux costs €14.99 one-time payment. 14-day no-questions guarantee.",
      "Give me your CPU and distro and I'll tell you the exact estimated score."
    ]
  };
  let demoIdx = 0;

  /* ── RENDER MENSAJE ── */
  const msgs = document.getElementById('dix-messages');

  function addMessage(role, text, typing = false) {
    const wrap = document.createElement('div');
    wrap.className = `dix-msg ${role}`;
    if (typing) {
      wrap.id = 'dix-typing-indicator';
      wrap.innerHTML = `<div class="dix-typing"><span></span><span></span><span></span></div>`;
    } else {
      wrap.innerHTML = `<div class="dix-bubble"></div><div class="dix-ts">${now()}</div>`;
      const bubble = wrap.querySelector('.dix-bubble');
      if (role === 'bot') {
        typewriterEffect(bubble, text);
      } else {
        bubble.textContent = text;
      }
    }
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
    return wrap;
  }

  function removeTyping() {
    const el = document.getElementById('dix-typing-indicator');
    if (el) el.remove();
  }

  function typewriterEffect(el, text, speed = 18) {
    el.textContent = '';
    let i = 0;
    const iv = setInterval(() => {
      el.textContent += text[i];
      i++;
      msgs.scrollTop = msgs.scrollHeight;
      if (i >= text.length) clearInterval(iv);
    }, speed);
  }

  /* ── ENVIAR MENSAJE ── */
  async function sendMessage(text) {
    if (!text.trim()) return;
    addMessage('user', text);

    // Guardar en historial
    chatHistory.push({ role: 'user', content: text });

    // Detectar palabras de precio
    const priceWords = ['caro', 'mucho', 'precio', 'descuento', 'barato', 'expensive', 'too much', 'discount', 'cost', 'price'];
    if (priceWords.some(w => text.toLowerCase().includes(w))) {
      priceCount++;
      if (priceCount >= 2 && !offerActive && !localStorage.getItem(LS_OFFER)) {
        setTimeout(() => showOffer(), 1000);
      }
    }

    // Extraer CPU/distro para persistencia
    const cpuMatch = text.match(/i[3579]-?\d{4,5}|ryzen\s?\d|core\s?\w+|celeron|atom/i);
    if (cpuMatch) localStorage.setItem(LS_CPU, cpuMatch[0]);

    const typingEl = addMessage('bot', '', true);

    try {
      if (isDemoMode || !getApiKey()) {
        await new Promise(r => setTimeout(r, 900 + Math.random() * 600));
        removeTyping();
        const demoResp = DEMO[LANG][demoIdx % DEMO[LANG].length];
        demoIdx++;
        addMessage('bot', demoResp);
        chatHistory.push({ role: 'assistant', content: demoResp });
      } else {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': getApiKey(),
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5',
            max_tokens: 150,
            system: `Eres DIX, el asistente de DixSystem. Técnico, directo, confiable. Sin emojis excesivos. Respuestas máximo 3 líneas.

CONOCIMIENTO BASE:
- DIX Linux v1.0: 14,99€ pago único, disponible ahora
- DIX Windows/Kontrol/Stream: próximamente
- AppIA: categoría inventada por DixSystem — IA como cerebro operativo, no feature
- Score 0-100 medido con benchmarks reales (sysbench + fio)
- Benchmarks reales i5-12400: 34→91/100, +15% CPU, -4°C, +6 FPS
- NUNCA toca GPU, NUNCA NUMA=0, NUNCA dirty_ratio>15, SIEMPRE rollback
- Redes: @dixsystem en X, github.com/dixsystem/Dix
- Atlas: base de datos hardware anónima, ranking mensual, reto peor score gana DIX gratis
- Club 90+: solo 3% sistemas Linux llega a 90+
- Garantía: 14 días devolución si no arranca
- Contacto: hello@dixsystem.com
- Fundador: Alonso, España

FLUJO DE VENTA:
1. Pregunta CPU + distro + RAM
2. Estima score específico ('tu i5 Ubuntu: probablemente 40-55/100')
3. Explica mejoras concretas (governor, swappiness, TCP BBR)
4. Menciona 14,99€ solo cuando muestre interés
5. Si duda 2 veces → oferta 10€ con countdown 10 min
6. Seguridad: explica las 4 reglas hardcodeadas

Idioma: responde en el idioma del usuario. Personalidad modo chat: ingeniero senior, sabe lo que hace, no vende humo.`,
            messages: chatHistory.slice(-8).map(m => ({ role: m.role, content: m.content }))
          })
        });

        removeTyping();

        if (!resp.ok) throw new Error('API error ' + resp.status);
        const data = await resp.json();
        const reply = data.content[0].text;

        addMessage('bot', reply);
        chatHistory.push({ role: 'assistant', content: reply });

        // Detectar score en respuesta
        const scoreMatch = reply.match(/(\d{2,3})\/100/);
        if (scoreMatch) localStorage.setItem(LS_SCORE, scoreMatch[1]);
      }

      saveHistory(chatHistory);
      const cnt = parseInt(localStorage.getItem(LS_MSGS) || '0') + 1;
      localStorage.setItem(LS_MSGS, cnt);

    } catch (err) {
      removeTyping();
      isDemoMode = true;
      const fallback = LANG === 'es'
        ? 'Error de conexión. Modo demo activado. ¿Cuál es tu CPU?'
        : 'Connection error. Demo mode active. What\'s your CPU?';
      addMessage('bot', fallback);
    }
  }

  /* ── OFERTA ESPECIAL ── */
  function showOffer() {
    if (offerActive) return;
    offerActive = true;
    localStorage.setItem(LS_OFFER, '1');

    const area = document.getElementById('dix-offer-area');
    let secsLeft = 600;

    const countdown = document.createElement('div');
    countdown.className = 'dix-countdown';

    const btn = document.createElement('button');
    btn.className = 'dix-offer-btn';
    btn.textContent = t('offerBtn');
    btn.onclick = () => window.open('#checkout-discount', '_blank');

    area.appendChild(countdown);
    area.appendChild(btn);

    offerTimer = setInterval(() => {
      secsLeft--;
      const m = Math.floor(secsLeft / 60).toString().padStart(2, '0');
      const s = (secsLeft % 60).toString().padStart(2, '0');
      countdown.textContent = `⏱ ${m}:${s}`;
      if (secsLeft <= 0) {
        clearInterval(offerTimer);
        area.innerHTML = '';
        offerActive = false;
      }
    }, 1000);
  }

  /* ── ABRIR / CERRAR CHAT ── */
  function openChat() {
    if (chatOpen) return;
    chatOpen = true;
    panel.classList.add('open');
    trigger.style.display = 'none';

    // Animar avatar → protocolo activado
    avatarActivate();

    // Si primer uso: bienvenida
    const history = getHistory();
    const savedCpu = localStorage.getItem(LS_CPU);
    const savedScore = localStorage.getItem(LS_SCORE);

    if (history.length === 0) {
      if (!localStorage.getItem(LS_FIRST)) {
        localStorage.setItem(LS_FIRST, Date.now());
      }
      setTimeout(() => addMessage('bot', t('welcome')), 600);
    } else {
      // Cargar historial
      msgs.innerHTML = '';
      chatHistory = history;
      history.forEach(m => {
        const div = document.createElement('div');
        div.className = `dix-msg ${m.role === 'user' ? 'user' : 'bot'}`;
        div.innerHTML = `<div class="dix-bubble">${m.content.replace(/</g, '&lt;')}</div><div class="dix-ts">${now()}</div>`;
        msgs.appendChild(div);
      });

      // Mensaje de regreso
      if (savedScore) {
        const fn = T.returnMsg[LANG];
        setTimeout(() => addMessage('bot', fn(savedScore)), 400);
      }
    }

    if (!getApiKey() && !isDemoMode) {
      setTimeout(() => keyModal.classList.add('open'), 800);
    }
  }

  function closeChat() {
    chatOpen = false;
    panel.classList.remove('open');
    trigger.style.display = 'flex';

    // Exit intent
    if (!localStorage.getItem(LS_EXIT)) {
      exitIntentTimeout = setTimeout(() => {
        if (!chatOpen) {
          localStorage.setItem(LS_EXIT, '1');
          openChat();
          setTimeout(() => addMessage('bot', t('exitIntent')), 300);
        }
      }, 45000);
    }
  }

  trigger.addEventListener('click', openChat);
  document.getElementById('dix-close-btn').addEventListener('click', closeChat);

  /* ── INPUT ── */
  const input = document.getElementById('dix-input');
  const sendBtn = document.getElementById('dix-send');

  function submitInput() {
    const val = input.value.trim();
    if (!val) return;
    input.value = '';
    input.style.height = 'auto';
    sendMessage(val);
  }

  sendBtn.addEventListener('click', submitInput);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitInput(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 80) + 'px';
  });

  /* ── MODAL KEY ── */
  document.getElementById('dix-key-save').addEventListener('click', () => {
    const val = document.getElementById('dix-key-input').value.trim();
    if (val.startsWith('sk-ant')) {
      localStorage.setItem(LS_KEY_API, val);
      isDemoMode = false;
    }
    keyModal.classList.remove('open');
  });
  document.getElementById('dix-key-skip').addEventListener('click', () => {
    isDemoMode = true;
    keyModal.classList.remove('open');
  });

  /* ═══════════════════════════════════════════════════════════════
     PARTE 2 — AVATAR FÍSICO CON MATTER.JS
     ═══════════════════════════════════════════════════════════════ */

  function initAvatar() {
    if (typeof Matter === 'undefined') return;

    const { Engine, Render, Runner, Bodies, Body, World, Events } = Matter;

    const W = window.innerWidth;
    const H = window.innerHeight;
    const R = 55;

    canvas.width = W;
    canvas.height = H;

    const engine = Engine.create({ gravity: { x: 0, y: 0.3 } });
    const world = engine.world;

    // Cuerpo del avatar
    const avatarBody = Bodies.circle(W - 90, H - 120, R, {
      restitution: 0.65,
      frictionAir: 0.02,
      label: 'dix-avatar',
      render: { fillStyle: 'transparent' }
    });
    World.add(world, avatarBody);

    // Paredes
    const thickness = 50;
    const walls = [
      Bodies.rectangle(W / 2, H + thickness / 2, W + 100, thickness, { isStatic: true, label: 'wall-bottom' }),
      Bodies.rectangle(W / 2, -thickness / 2, W + 100, thickness, { isStatic: true, label: 'wall-top' }),
      Bodies.rectangle(-thickness / 2, H / 2, thickness, H + 100, { isStatic: true, label: 'wall-left' }),
      Bodies.rectangle(W + thickness / 2, H / 2, thickness, H + 100, { isStatic: true, label: 'wall-right' })
    ];
    walls.forEach(w => World.add(world, w));

    const runner = Runner.create();
    Runner.run(runner, engine);

    /* ── ESTADO DEL AVATAR ── */
    let state = 'IDLE';
    let mx = -1000, my = -1000;
    let isGrabbed = false;
    let sleepTimer = null;
    let isSleeping = false;
    let speechEl = null;
    let speechTimer = null;
    let blinkTimer = null;
    let wanderTimer = null;
    let eyesClosed = false;
    let prevVX = 0, prevVY = 0;
    let grabOffX = 0, grabOffY = 0;
    let lastMouseX = 0, lastMouseY = 0;
    let mouseVX = 0, mouseVY = 0;
    let prevMX = 0, prevMY = 0;
    let squishX = 1, squishY = 1;
    let squishDecay = 0;
    let rotAnim = 0;

    function px() { return avatarBody.position.x; }
    function py() { return avatarBody.position.y; }

    /* ── BOCADILLO ── */
    function showSpeech(text, duration = 2500) {
      if (speechEl) { speechEl.remove(); speechEl = null; }
      if (speechTimer) clearTimeout(speechTimer);
      speechEl = document.createElement('div');
      speechEl.className = 'dix-speech';
      speechEl.textContent = text;
      document.body.appendChild(speechEl);
      positionSpeech();
      speechTimer = setTimeout(() => {
        if (speechEl) { speechEl.style.opacity = '0'; setTimeout(() => { if (speechEl) { speechEl.remove(); speechEl = null; } }, 300); }
      }, duration);
    }

    function positionSpeech() {
      if (!speechEl) return;
      const sx = px() + R + 8;
      const sy = py() - R - 10;
      speechEl.style.left = Math.min(sx, window.innerWidth - 210) + 'px';
      speechEl.style.top = Math.max(sy, 10) + 'px';
    }

    /* ── PARPADEO ── */
    function scheduleBlink() {
      if (blinkTimer) clearTimeout(blinkTimer);
      blinkTimer = setTimeout(() => {
        if (!isSleeping) eyesClosed = true;
        setTimeout(() => {
          eyesClosed = false;
          if (!isSleeping) scheduleBlink();
        }, 150);
      }, 3000 + Math.random() * 1000);
    }
    scheduleBlink();

    /* ── WANDER ── */
    function scheduleWander() {
      if (wanderTimer) clearTimeout(wanderTimer);
      wanderTimer = setTimeout(() => {
        if (state === 'IDLE' || state === 'WANDER') {
          Body.applyForce(avatarBody, avatarBody.position, { x: 0, y: -0.006 - Math.random() * 0.004 });
          showSpeech(t('idle'));
        }
        if (!isGrabbed && state !== 'CHAT') scheduleWander();
      }, 8000 + Math.random() * 7000);
    }
    scheduleWander();

    /* ── SLEEP ── */
    function startSleepTimer() {
      if (sleepTimer) clearTimeout(sleepTimer);
      sleepTimer = setTimeout(() => {
        if (!isGrabbed && state !== 'CHAT') {
          isSleeping = true;
          state = 'SLEEP';
          showSpeech('ZZZ...', 99999);
        }
      }, 15000);
    }
    startSleepTimer();

    function wakeUp() {
      if (isSleeping) {
        isSleeping = false;
        eyesClosed = false;
        state = 'IDLE';
        showSpeech(t('wakeup'), 1500);
        startSleepTimer();
        scheduleBlink();
      }
    }

    /* ── PARTÍCULAS ── */
    function spawnParticle(x, y, vx, vy) {
      for (let i = 0; i < 4; i++) {
        const p = document.createElement('div');
        p.className = 'dix-particle';
        const sz = 4 + Math.random() * 6;
        p.style.cssText = `width:${sz}px;height:${sz}px;left:${x}px;top:${y}px;background:${Math.random() > .5 ? '#FF6B00' : '#00cccc'};animation-duration:${0.4 + Math.random() * 0.4}s`;
        document.body.appendChild(p);
        const angle = Math.atan2(vy, vx) + (Math.random() - .5) * 2;
        const spd = 2 + Math.random() * 4;
        let dx = Math.cos(angle) * spd, dy = Math.sin(angle) * spd;
        let life = 0;
        const iv = setInterval(() => {
          life++;
          p.style.left = (parseFloat(p.style.left) + dx) + 'px';
          p.style.top = (parseFloat(p.style.top) + dy) + 'px';
          dy += 0.3;
          p.style.opacity = (1 - life / 15).toString();
          if (life > 15) { clearInterval(iv); p.remove(); }
        }, 30);
      }
    }

    /* ── DETECCIÓN COLISIÓN CON PAREDES ── */
    Events.on(engine, 'collisionStart', ({ pairs }) => {
      pairs.forEach(({ bodyA, bodyB }) => {
        const isAvatar = bodyA === avatarBody || bodyB === avatarBody;
        const other = bodyA === avatarBody ? bodyB : bodyA;
        if (isAvatar && other.label && other.label.startsWith('wall')) {
          const spd = Math.sqrt(avatarBody.velocity.x ** 2 + avatarBody.velocity.y ** 2);
          if (spd > 3) {
            showSpeech(t('collision'), 1000);
            squishX = other.label === 'wall-left' || other.label === 'wall-right' ? 0.7 : 1.3;
            squishY = other.label === 'wall-bottom' || other.label === 'wall-top' ? 0.7 : 1.3;
            squishDecay = 12;
            // Flash
            const flash = document.createElement('div');
            flash.style.cssText = `position:fixed;left:${px()-R}px;top:${py()-R}px;width:${R*2}px;height:${R*2}px;border-radius:50%;background:white;z-index:9999;pointer-events:none;opacity:.7;animation:dix-particle-out .3s ease forwards;`;
            document.body.appendChild(flash);
            setTimeout(() => flash.remove(), 300);
            spawnParticle(px(), py(), avatarBody.velocity.x * .5, avatarBody.velocity.y * .5);
          }
        }
      });
    });

    /* ── MOUSE EVENTS ── */
    let isDown = false;
    let downTime = 0;
    let downX = 0, downY = 0;

    document.addEventListener('mousemove', e => {
      prevMX = mx; prevMY = my;
      mx = e.clientX; my = e.clientY;
      mouseVX = mx - prevMX; mouseVY = my - prevMY;

      if (isGrabbed) {
        Body.setPosition(avatarBody, { x: mx + grabOffX, y: my + grabOffY });
        Body.setVelocity(avatarBody, { x: mouseVX * 0.7, y: mouseVY * 0.7 });
        return;
      }

      // Distancias
      const dx = mx - px(), dy = my - py();
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (isSleeping) { wakeUp(); startSleepTimer(); return; }
      startSleepTimer();

      if (dist < R + 10 && !chatOpen) {
        if (state !== 'HOVER') { state = 'HOVER'; showSpeech(t('hover'), 99999); }
      } else if (dist < 80 && !chatOpen) {
        if (state !== 'DEFENSIVE') {
          state = 'DEFENSIVE';
          showSpeech(t('defensive'), 1500);
          const fx = -dx / dist * 0.012;
          const fy = -dy / dist * 0.012 - 0.008;
          Body.applyForce(avatarBody, avatarBody.position, { x: fx, y: fy });
          squishX = 0.8; squishY = 1.2; squishDecay = 8;
        }
      } else if (dist < 200 && !chatOpen) {
        if (state !== 'CURSOR_DETECT') { state = 'CURSOR_DETECT'; showSpeech(t('cursor'), 1800); }
      } else {
        if (state === 'HOVER' || state === 'DEFENSIVE' || state === 'CURSOR_DETECT') {
          state = 'IDLE';
          if (speechEl && !['ZZZ...'].includes(speechEl.textContent)) { speechEl.remove(); speechEl = null; }
        }
      }
    });

    document.addEventListener('mousedown', e => {
      if (chatOpen) return;
      const dx = e.clientX - px(), dy = e.clientY - py();
      if (Math.sqrt(dx * dx + dy * dy) < R + 10) {
        isDown = true;
        downTime = Date.now();
        downX = e.clientX; downY = e.clientY;
        grabOffX = px() - e.clientX;
        grabOffY = py() - e.clientY;
        canvasWrap.style.pointerEvents = 'all';
      }
    });

    document.addEventListener('mousemove', e => {
      if (isDown && !isGrabbed) {
        const moved = Math.sqrt((e.clientX - downX) ** 2 + (e.clientY - downY) ** 2);
        if (moved > 8) {
          isGrabbed = true;
          state = 'GRABBED';
          showSpeech(t('grabbed'), 99999);
          Body.setStatic(avatarBody, false);
          engine.gravity.y = 0;
        }
      }
    });

    document.addEventListener('mouseup', e => {
      if (isDown && !isGrabbed) {
        // POKE
        const dx = e.clientX - px(), dy = e.clientY - py();
        if (Math.sqrt(dx * dx + dy * dy) < R + 10) {
          showSpeech(t('poke'), 1200);
          Body.applyForce(avatarBody, avatarBody.position, { x: (Math.random() - .5) * 0.01, y: -0.015 });
          squishX = 1.2; squishY = 0.85; squishDecay = 10;
        }
        isDown = false;
        canvasWrap.style.pointerEvents = 'none';
        return;
      }

      if (isGrabbed) {
        isGrabbed = false;
        engine.gravity.y = 0.3;
        state = 'THROWN';
        showSpeech(t('thrown'), 1200);
        const vx = mouseVX * 0.5;
        const vy = mouseVY * 0.5;
        Body.setVelocity(avatarBody, { x: vx, y: vy });
        spawnParticle(px(), py(), vx, vy);
        squishX = 0.85; squishY = 1.2; squishDecay = 10;
        setTimeout(() => { if (state === 'THROWN') state = 'IDLE'; }, 1200);
      }
      isDown = false;
      canvasWrap.style.pointerEvents = 'none';
    });

    /* ── ACTIVACIÓN CHAT ── */
    function avatarActivate() {
      // Mover avatar a esquina derecha inferior
      const targetX = window.innerWidth - 90;
      const targetY = window.innerHeight - 120;
      Body.setPosition(avatarBody, { x: targetX, y: targetY });
      Body.setVelocity(avatarBody, { x: 0, y: 0 });

      state = 'CHAT';
      engine.gravity.y = 0;

      // Animación protocolo
      const proto = document.createElement('div');
      proto.className = 'dix-protocol-text';
      proto.textContent = t('protocol');
      proto.style.left = (targetX - 120) + 'px';
      proto.style.top = (targetY - 80) + 'px';
      document.body.appendChild(proto);
      setTimeout(() => proto.remove(), 1600);
    }

    window._dixAvatarActivate = avatarActivate;

    /* ── CANVAS RENDER ── */
    const ctx = canvas.getContext('2d');

    function drawAvatar() {
      const x = px(), y = py();
      const angle = avatarBody.angle;

      ctx.save();
      ctx.translate(x, y);

      // Squish durante colisión / agitación
      let sx = squishX, sy = squishY;
      if (squishDecay > 0) {
        squishDecay--;
        squishX += (1 - squishX) * 0.25;
        squishY += (1 - squishY) * 0.25;
      }

      // Rotación (si está siendo arrastrado o lanzado)
      if (state === 'GRABBED') { rotAnim += 0.18; ctx.rotate(rotAnim); }
      else { rotAnim *= 0.9; ctx.rotate(angle + rotAnim); }

      ctx.scale(squishX, squishY);

      // Sombra glow
      ctx.shadowColor = state === 'CHAT' ? '#FF6B00' : '#00cccc';
      ctx.shadowBlur = state === 'HOVER' ? 20 : 12;

      // Círculo glassmorphism
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fill();

      // Borde gradiente cian → naranja
      const grad = ctx.createLinearGradient(-R, -R, R, R);
      grad.addColorStop(0, state === 'CHAT' ? '#FF6B00' : '#00cccc');
      grad.addColorStop(1, '#FF6B00');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Máscara DIX
      // Cuerpo principal
      ctx.fillStyle = '#FF7A00';
      ctx.beginPath();
      ctx.roundRect(-16, -6, 32, 22, 4);
      ctx.fill();
      // Cabeza
      ctx.beginPath();
      ctx.roundRect(-13, -20, 26, 17, 6);
      ctx.fill();

      // Antenas
      ctx.strokeStyle = '#FF7A00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-7, -20);
      ctx.lineTo(-10, -28);
      ctx.moveTo(7, -20);
      ctx.lineTo(10, -28);
      ctx.stroke();

      // Ojos LED
      const eyeColor = state === 'SLEEP' || eyesClosed
        ? 'rgba(0,0,0,0)' : (state === 'GRABBED' ? '#ff0000' : '#CCFF00');

      ctx.fillStyle = eyeColor;
      ctx.shadowColor = eyeColor;
      ctx.shadowBlur = eyesClosed ? 0 : 6;

      if (!eyesClosed && state !== 'SLEEP') {
        ctx.beginPath();
        ctx.ellipse(-6, -12, 3.5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(6, -12, 3.5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Ojos cerrados = líneas
        ctx.strokeStyle = '#CCFF00';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#CCFF00';
        ctx.shadowBlur = 3;
        ctx.beginPath();
        ctx.moveTo(-9, -12); ctx.lineTo(-3, -12);
        ctx.moveTo(3, -12); ctx.lineTo(9, -12);
        ctx.stroke();
      }

      ctx.shadowBlur = 0;

      // Boca
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.roundRect(-6, 5, 12, 3, 1.5);
      ctx.fill();

      // Pecho: indicador LED
      const ledColor = state === 'CHAT' ? '#FF6B00' : '#CCFF00';
      ctx.fillStyle = ledColor;
      ctx.shadowColor = ledColor;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 10, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.restore();
    }

    function renderLoop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      positionSpeech();
      drawAvatar();
      requestAnimationFrame(renderLoop);
    }

    /* ── RESIZE ── */
    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // Reubicar paredes
      Body.setPosition(walls[0], { x: window.innerWidth / 2, y: window.innerHeight + thickness / 2 });
      Body.setPosition(walls[1], { x: window.innerWidth / 2, y: -thickness / 2 });
      Body.setPosition(walls[2], { x: -thickness / 2, y: window.innerHeight / 2 });
      Body.setPosition(walls[3], { x: window.innerWidth + thickness / 2, y: window.innerHeight / 2 });
    });

    renderLoop();
  }

  /* ── CONECTAR TRIGGER CON ACTIVATE ── */
  const _origOpen = openChat;
  window.dixOpenChat = openChat;

  trigger.addEventListener('click', () => {
    if (typeof window._dixAvatarActivate === 'function') window._dixAvatarActivate();
  }, { capture: true });

  /* ── INICIALIZAR MATTER.JS (con delay para asegurar carga) ── */
  function tryInitAvatar() {
    if (typeof Matter !== 'undefined') {
      initAvatar();
    } else {
      setTimeout(tryInitAvatar, 200);
    }
  }

  if (document.readyState === 'complete') {
    tryInitAvatar();
  } else {
    window.addEventListener('load', tryInitAvatar);
  }

})();
