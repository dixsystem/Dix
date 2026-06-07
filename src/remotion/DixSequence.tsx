import { useCurrentFrame, interpolate, spring } from "remotion";

import dixPhase1   from "../assets/dix-phase1.webp";   // DIX+Tux analizando
import dixPhase2   from "../assets/dix-phase2.webp";   // DIX sucio con llave
import dixPhase3   from "../assets/dix-phase3.webp";   // DIX limpiando (cara visible)
import dixApplying from "../assets/dix-applying.webp"; // DIX limpiando ventiladores
import dixDone     from "../assets/dix-done.webp";     // DIX con badge 91/100

// ─── Constantes de fase ───────────────────────────────────────────────────────

const P1 = { start: 0,   end: 150 };   // Trabajo duro
const P2 = { start: 151, end: 300 };   // Limpieza
const P3 = { start: 301, end: 500 };   // Análisis + diagnóstico
const P4 = { start: 501, end: 650 };   // Resultado final

const FPS = 30;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DixSequenceProps {
  scoreActual?: number;
  scoreOptimizado?: number;
}

// ─── Helpers de interpolación ─────────────────────────────────────────────────

function clamp(frame: number, range: [number, number], output: [number, number]): number {
  return interpolate(frame, range, output, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

// ─── Componente: Chispa individual ────────────────────────────────────────────

function Spark({ x, y, delay, color, size = 6 }: {
  x: number; y: number; delay: number; color: string; size?: number;
}) {
  const frame = useCurrentFrame();
  const cycle = (frame + delay) % 24;
  const opacity = cycle < 12 ? cycle / 12 : (24 - cycle) / 12;
  const translateY = clamp(cycle, [0, 24], [0, -12]);
  return (
    <div style={{
      position: "absolute",
      left: `${x}%`,
      top: `${y}%`,
      width: size,
      height: size,
      borderRadius: "50%",
      background: color,
      opacity,
      transform: `translateY(${translateY}px)`,
      boxShadow: `0 0 ${size * 2}px ${color}`,
      pointerEvents: "none",
    }} />
  );
}

// ─── Componente: Línea de escaneo ─────────────────────────────────────────────

function ScanLine({ speed = 1.5, color = "#00FF88" }: { speed?: number; color?: string }) {
  const frame = useCurrentFrame();
  const y = (frame * speed) % 100;
  return (
    <div style={{
      position: "absolute",
      left: 0,
      right: 0,
      top: `${y}%`,
      height: 2,
      background: `linear-gradient(90deg, transparent, ${color}cc, transparent)`,
      opacity: 0.7,
      pointerEvents: "none",
    }} />
  );
}

// ─── Componente: Ventilador RGB girando ───────────────────────────────────────

function RgbFan({ x, y, size = 36, frameOffset = 0 }: {
  x: number; y: number; size?: number; frameOffset?: number;
}) {
  const frame = useCurrentFrame();
  const rotation = (frame + frameOffset) * 5;
  const hue = ((frame + frameOffset) * 2) % 360;
  return (
    <div style={{
      position: "absolute",
      left: `${x}%`,
      top: `${y}%`,
      width: size,
      height: size,
      borderRadius: "50%",
      border: `3px solid hsl(${hue}, 100%, 60%)`,
      boxShadow: `0 0 12px hsl(${hue}, 100%, 60%)`,
      transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
      opacity: 0.75,
      pointerEvents: "none",
    }}>
      {/* aspas del ventilador */}
      {[0, 45, 90, 135].map((a) => (
        <div key={a} style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "40%",
          height: 2,
          background: `hsl(${hue}, 100%, 70%)`,
          transform: `rotate(${a}deg) translateX(0)`,
          transformOrigin: "left center",
          opacity: 0.8,
        }} />
      ))}
    </div>
  );
}

// ─── Componente: Texto de estado parpadeante ──────────────────────────────────

function BlinkLabel({ text, color = "#FF6B00", visible = true }: {
  text: string; color?: string; visible?: boolean;
}) {
  const frame = useCurrentFrame();
  if (!visible) return null;
  const opacity = Math.floor(frame / 12) % 2 === 0 ? 1 : 0.25;
  return (
    <div style={{
      position: "absolute",
      bottom: 14,
      left: "50%",
      transform: "translateX(-50%)",
      background: `${color}22`,
      border: `1px solid ${color}77`,
      borderRadius: 6,
      padding: "5px 16px",
      color,
      fontSize: 10,
      fontFamily: "monospace",
      fontWeight: 700,
      letterSpacing: "2px",
      opacity,
      pointerEvents: "none",
      whiteSpace: "nowrap",
    }}>
      ● {text}
    </div>
  );
}

// ─── Componente: Partículas de confeti en Fase 4 ─────────────────────────────

function ConfettiParticle({ x, speed, color, delay }: {
  x: number; speed: number; color: string; delay: number;
}) {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);
  const y = (f * speed) % 110;
  const opacity = y < 100 ? 1 : 0;
  const rotate = f * 6;
  return (
    <div style={{
      position: "absolute",
      left: `${x}%`,
      top: `${y}%`,
      width: 6,
      height: 6,
      background: color,
      opacity,
      transform: `rotate(${rotate}deg)`,
      borderRadius: 1,
      pointerEvents: "none",
    }} />
  );
}

// ─── Componente principal: DixSequence ───────────────────────────────────────

export function DixSequence({ scoreActual = 62, scoreOptimizado = 91 }: DixSequenceProps) {
  const frame = useCurrentFrame();

  // ── Determinar fase activa ─────────────────────────────────────────────────

  const isP1 = frame <= P1.end;
  const isP2 = frame > P2.start - 1 && frame <= P2.end;
  const isP2b = frame > 225 && frame <= P2.end; // segunda mitad limpieza
  const isP3 = frame > P3.start - 1 && frame <= P3.end;
  const isP4 = frame >= P4.start;

  // ── Crossfades entre fases (10 frames) ────────────────────────────────────

  const img1Opacity = clamp(frame, [P1.end - 5, P1.end + 5], [1, 0]);
  const img2aOpacity = isP2 && !isP2b
    ? clamp(frame, [P2.start, P2.start + 8], [0, 1])
    : clamp(frame, [220, 230], [1, 0]);
  const img2bOpacity = isP2b
    ? clamp(frame, [226, 236], [0, 1])
    : 0;
  const img3Opacity = isP3
    ? clamp(frame, [P3.start, P3.start + 10], [0, 1]) * clamp(frame, [P3.end - 8, P3.end], [1, 0])
    : 0;
  const img4Opacity = isP4
    ? clamp(frame, [P4.start, P4.start + 12], [0, 1])
    : 0;

  // ── FASE 1: Trabajo duro — animaciones ────────────────────────────────────

  const p1Vibx = Math.sin(frame * 0.8) * 3;
  const p1Viby = Math.sin(frame * 1.1) * 2;

  // Brazo con llave: rotación oscilante simulando esfuerzo
  const wrenchRotation = Math.sin(frame * 0.35) * 12;
  const wrenchScale = 1 + Math.abs(Math.sin(frame * 0.35)) * 0.08;

  // ── FASE 2: Limpieza — animaciones ────────────────────────────────────────

  const p2Frame = Math.max(0, frame - P2.start);

  // Brazo que frota: oscilación rápida horizontal
  const cleaningSwipeX = Math.sin(p2Frame * 0.6) * 18;
  const cleaningSwipeY = Math.cos(p2Frame * 0.6) * 6;

  // Imagen completa: pequeño desplazamiento lateral al limpiar
  const p2BodyX = Math.sin(p2Frame * 0.3) * 4;

  // ── FASE 3: Análisis — animaciones ────────────────────────────────────────

  const p3Frame = Math.max(0, frame - P3.start);

  // Cabeza del robot: pequeño pivote de inspección
  const headPivot = Math.sin(p3Frame * 0.28) * 4;

  // Brazo del pingüino escribiendo: rebote rápido en Y
  const penBounceY = Math.sin(p3Frame * 1.3) * 9;
  const penBounceX = Math.sin(p3Frame * 0.7) * 3;

  // Lupa: oscilación suave
  const magnifyX = Math.sin(p3Frame * 0.2) * 10;
  const magnifyY = Math.cos(p3Frame * 0.15) * 6;

  // Entrada del pingüino con spring
  const tuxScale = spring({ frame: p3Frame - 20, fps: FPS, config: { damping: 14, stiffness: 160 } });

  // ── FASE 4: Resultado — animaciones ───────────────────────────────────────

  const p4Frame = Math.max(0, frame - P4.start);

  // Emblema: spring de entrada
  const badgeScale = spring({ frame: p4Frame - 5, fps: FPS, config: { damping: 10, stiffness: 180 } });

  // Pulso neón verde
  const glowPulse = 0.5 + Math.sin(p4Frame * 0.25) * 0.5;

  // Contador de score animado
  const scoreDisplay = Math.round(clamp(frame, [P4.start + 8, P4.start + 55], [scoreActual, scoreOptimizado]));

  // Fade in del texto final
  const textFadeIn = clamp(frame, [P4.start + 45, P4.start + 70], [0, 1]);

  // Brillo RGB del fondo en P4
  const rgbHue = (p4Frame * 1.5) % 360;

  // ── Fondo con gradiente dinámico ──────────────────────────────────────────

  const bgGlow = isP4
    ? `radial-gradient(ellipse at 50% 60%, hsl(${rgbHue},80%,10%) 0%, #0d1117 70%)`
    : isP3
    ? "radial-gradient(ellipse at 50% 60%, #0a2a1a 0%, #0d1117 70%)"
    : isP2
    ? "radial-gradient(ellipse at 50% 40%, #12101a 0%, #0d1117 70%)"
    : "radial-gradient(ellipse at 50% 60%, #1a0c00 0%, #0d1117 70%)";

  return (
    <div style={{
      width: "100%",
      height: "100%",
      position: "relative",
      overflow: "hidden",
      background: bgGlow,
      borderRadius: 12,
    }}>

      {/* ══ FASE 1: Robot sucio con llave inglesa ═══════════════════════════ */}
      {isP1 && (
        <div style={{ position: "absolute", inset: 0, opacity: img1Opacity }}>
          <img
            src={dixPhase2}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
              transform: `translate(${p1Vibx}px, ${p1Viby}px)`,
            }}
          />
          {/* Chispas de trabajo mecánico */}
          <Spark x={38} y={42} delay={0}  color="#FF6B00" size={5} />
          <Spark x={52} y={38} delay={7}  color="#FFD700" size={4} />
          <Spark x={44} y={50} delay={14} color="#FF6B00" size={6} />
          <Spark x={60} y={45} delay={3}  color="#FFD700" size={4} />
          <Spark x={35} y={55} delay={10} color="#FF4400" size={5} />
          <Spark x={56} y={35} delay={18} color="#FFD700" size={3} />

          {/* Overlay de brazo con llave */}
          <div style={{
            position: "absolute",
            right: "25%",
            top: "45%",
            width: 40,
            height: 14,
            background: "transparent",
            transformOrigin: "left center",
            transform: `rotate(${wrenchRotation}deg) scale(${wrenchScale})`,
          }}>
            {/* representación abstracta del movimiento */}
            <div style={{ width: "100%", height: "100%", borderRadius: 4, background: "#FF6B0033", border: "1px solid #FF6B0055" }} />
          </div>

          {/* Glow naranja pulsante en borde */}
          <div style={{
            position: "absolute", inset: 0,
            borderRadius: 12,
            boxShadow: `inset 0 0 ${20 + Math.abs(Math.sin(frame * 0.4)) * 20}px #FF6B0044`,
            pointerEvents: "none",
          }} />
          <BlinkLabel text="CALIBRATING HARDWARE..." color="#FF6B00" />
        </div>
      )}

      {/* ══ FASE 2a: Robot limpiando (cara visible) ══════════════════════════ */}
      {(isP2 && !isP2b) && (
        <div style={{ position: "absolute", inset: 0, opacity: img2aOpacity }}>
          <img
            src={dixPhase3}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
              transform: `translateX(${p2BodyX}px)`,
            }}
          />
          {/* Efecto de brillo limpio */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: 12,
            background: "linear-gradient(135deg, #ffffff08 0%, transparent 60%)",
            pointerEvents: "none",
          }} />
          <BlinkLabel text="REMOVING SYSTEM DEBRIS..." color="#60a5fa" />
        </div>
      )}

      {/* ══ FASE 2b: Robot limpiando ventiladores RGB (de espaldas) ══════════ */}
      {isP2b && (
        <div style={{ position: "absolute", inset: 0, opacity: img2bOpacity }}>
          <img
            src={dixApplying}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
              transform: `translateX(${cleaningSwipeX * 0.2}px)`,
            }}
          />
          {/* Ventiladores RGB girando como overlay visual */}
          <RgbFan x={18} y={12} size={32} frameOffset={0}  />
          <RgbFan x={82} y={12} size={32} frameOffset={45} />
          <RgbFan x={50} y={8}  size={28} frameOffset={90} />

          {/* Brazo limpiando: trayectoria visible */}
          <div style={{
            position: "absolute",
            right: `${28 + cleaningSwipeX * 0.15}%`,
            top:  `${20 + cleaningSwipeY * 0.1}%`,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "radial-gradient(circle, #ffffff88 0%, transparent 70%)",
            opacity: 0.5,
            pointerEvents: "none",
          }} />

          {/* Efecto RGB sweep en fondo */}
          <div style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(${(p2Frame * 2) % 360}deg, transparent 60%, hsl(${(p2Frame * 3) % 360}, 100%, 50%)11)`,
            pointerEvents: "none",
            borderRadius: 12,
          }} />

          <BlinkLabel text="OPTIMIZING RGB EFFICIENCY..." color="#a78bfa" />
        </div>
      )}

      {/* ══ FASE 3: Análisis y diagnóstico ═══════════════════════════════════ */}
      {isP3 && (
        <div style={{ position: "absolute", inset: 0, opacity: img3Opacity }}>
          <img
            src={dixPhase1}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
              transform: `rotate(${headPivot * 0.3}deg)`,
              transformOrigin: "center 30%",
            }}
          />

          {/* Línea de escaneo verde */}
          <ScanLine speed={1.4} color="#00FF88" />
          <ScanLine speed={0.9} color="#60a5fa" />

          {/* Lupa animada (overlay abstracto) */}
          <div style={{
            position: "absolute",
            left: `${45 + magnifyX * 0.1}%`,
            top:  `${30 + magnifyY * 0.1}%`,
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "2px solid #FFD70099",
            boxShadow: "0 0 14px #FFD70066",
            opacity: 0.6,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }} />

          {/* Pingüino Tux: brazo escribiendo (overlay animado) */}
          <div style={{
            position: "absolute",
            right: "20%",
            bottom: "22%",
            transform: `scale(${Math.max(0, tuxScale)}) translate(${penBounceX}px, ${penBounceY}px)`,
            transformOrigin: "right bottom",
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#FFD70088",
            boxShadow: "0 0 8px #FFD70066",
            pointerEvents: "none",
          }} />

          {/* Datos de análisis flotantes */}
          {p3Frame > 30 && (
            <div style={{
              position: "absolute",
              top: "8%",
              right: "5%",
              fontFamily: "monospace",
              fontSize: 9,
              color: "#00FF8888",
              lineHeight: 1.8,
              textAlign: "right",
              animation: "none",
            }}>
              {p3Frame > 30  && <div style={{ opacity: clamp(frame, [P3.start + 30, P3.start + 40], [0, 1]) }}>cpu: i5-12400</div>}
              {p3Frame > 50  && <div style={{ opacity: clamp(frame, [P3.start + 50, P3.start + 60], [0, 1]) }}>ram: 32GB DDR4</div>}
              {p3Frame > 70  && <div style={{ opacity: clamp(frame, [P3.start + 70, P3.start + 80], [0, 1]) }}>gov: powersave</div>}
              {p3Frame > 90  && <div style={{ opacity: clamp(frame, [P3.start + 90, P3.start + 100], [0, 1]) }}>swap: 60 → 10</div>}
              {p3Frame > 110 && <div style={{ opacity: clamp(frame, [P3.start + 110, P3.start + 120], [0, 1]) }}>bbr: disabled</div>}
              {p3Frame > 130 && <div style={{ opacity: clamp(frame, [P3.start + 130, P3.start + 140], [0, 1]) }}>irq: balanced</div>}
            </div>
          )}

          {/* Glow verde de escaneo */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: 12,
            boxShadow: `inset 0 0 ${15 + Math.sin(p3Frame * 0.3) * 10}px #00FF8833`,
            pointerEvents: "none",
          }} />
          <BlinkLabel text="CLAUDE AI ANALYZING..." color="#00FF88" />
        </div>
      )}

      {/* ══ FASE 4: Resultado y puntuación ═══════════════════════════════════ */}
      {isP4 && (
        <div style={{ position: "absolute", inset: 0, opacity: img4Opacity }}>
          <img
            src={dixDone}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
            }}
          />

          {/* Confeti */}
          {[...Array(12)].map((_, i) => (
            <ConfettiParticle
              key={i}
              x={5 + i * 8}
              speed={0.6 + (i % 3) * 0.2}
              delay={i * 4}
              color={["#FF6B00", "#FFD700", "#00FF88", "#a78bfa", "#60a5fa"][i % 5]}
            />
          ))}

          {/* Badge central con score — spring pop */}
          <div style={{
            position: "absolute",
            top: "28%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(${Math.max(0, badgeScale)})`,
            textAlign: "center",
            pointerEvents: "none",
          }}>
            <div style={{
              width: 110,
              height: 110,
              borderRadius: "50%",
              border: `4px solid #00FF88`,
              boxShadow: `0 0 ${20 + glowPulse * 30}px #00FF8866, inset 0 0 ${10 + glowPulse * 20}px #00FF8822`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "radial-gradient(circle, #001a0e 0%, #010409 100%)",
            }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#00FF88", lineHeight: 1, fontFamily: "monospace" }}>
                {scoreDisplay}
              </div>
              <div style={{ fontSize: 10, color: "#00FF8899", fontFamily: "monospace", letterSpacing: "1px" }}>/100</div>
              <div style={{ fontSize: 8, color: "#00FF8866", fontFamily: "monospace", marginTop: 2 }}>SCORE</div>
            </div>
          </div>

          {/* Texto "SISTEMA OPTIMIZADO" */}
          <div style={{
            position: "absolute",
            bottom: "10%",
            left: "50%",
            transform: "translateX(-50%)",
            opacity: textFadeIn,
            pointerEvents: "none",
            textAlign: "center",
          }}>
            <div style={{
              color: "#00FF88",
              fontSize: 13,
              fontWeight: 800,
              fontFamily: "monospace",
              letterSpacing: "3px",
              textShadow: `0 0 12px #00FF8888`,
            }}>
              SISTEMA OPTIMIZADO
            </div>
            <div style={{ color: "#FFD70099", fontSize: 9, fontFamily: "monospace", marginTop: 3, letterSpacing: "2px" }}>
              DIXSYSTEM · DIX PRO
            </div>
          </div>

          {/* Glow RGB pulsante en borde */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: 12,
            boxShadow: `inset 0 0 ${25 + glowPulse * 30}px hsl(${rgbHue}, 80%, 30%)55`,
            pointerEvents: "none",
          }} />
        </div>
      )}

      {/* ── Overlay de viñeta permanente para dar profundidad ──────────────── */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: 12,
        background: "radial-gradient(ellipse at 50% 50%, transparent 55%, #0d111799 100%)",
        pointerEvents: "none",
      }} />

      {/* ── Barra de progreso de fase en la parte inferior ────────────────── */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        background: "#21262d",
        borderRadius: "0 0 12px 12px",
        pointerEvents: "none",
      }}>
        <div style={{
          height: "100%",
          borderRadius: "0 0 12px 12px",
          background: isP4
            ? `linear-gradient(90deg, #00FF88, #FFD700)`
            : isP3
            ? `linear-gradient(90deg, #00FF88, #60a5fa)`
            : isP2
            ? `linear-gradient(90deg, #a78bfa, #60a5fa)`
            : `linear-gradient(90deg, #FF6B00, #FFD700)`,
          width: `${clamp(frame, [0, 650], [0, 100])}%`,
          transition: "none",
        }} />
      </div>
    </div>
  );
}
