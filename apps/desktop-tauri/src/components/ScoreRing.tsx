// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.

import { C } from "../constants";
import { scoreColor } from "../utils/score";

export function ScoreRing({ score, label, size = 110 }: { score: number; label: string; size?: number }) {
  const strokeW = size * 0.06;
  const r = (size - strokeW) / 2 - 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(Math.max(score, 0), 100) / 100;
  const color = scoreColor(score);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={strokeW} />
          <circle
            cx={size/2} cy={size/2} r={r} fill="none"
            stroke={color} strokeWidth={strokeW}
            strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
            strokeLinecap="round"
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 1,
        }}>
          <span style={{ fontSize: size * 0.26, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: size * 0.11, color: C.muted, lineHeight: 1 }}>/100</span>
        </div>
      </div>
      <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.3px" }}>{label}</div>
    </div>
  );
}

// Contador estático (sin animación)
export function AnimatedCounter({ target }: { target: number }) {
  return <>{target}</>;
}
