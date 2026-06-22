// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.

import { C, PROFILES } from "../constants";
import type { Profile } from "../types/dix";

export function AnalysisProgress({
  scanStep, elapsed, fromCache, responseMs, profile,
}: {
  scanStep: number; elapsed: number; fromCache: boolean; responseMs: number; profile: Profile;
}) {
  const prof = PROFILES.find(p => p.id === profile)!;
  const steps = [
    { step: 1, label: "Leyendo métricas del kernel",       detail: "/proc · /sys · pactl" },
    { step: 2, label: "Midiendo rendimiento del hardware",  detail: "sysbench cpu · memory · fio 4K (~8s)" },
    { step: 3, label: "Consultando Claude AI",              detail: "POST api.anthropic.com · claude-sonnet-4-6" },
    { step: 4, label: "Generando script bash",              detail: "optimizaciones personalizadas" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "16px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px" }}>● DIX — PROGRESO DEL ANÁLISIS</div>
        <div style={{ fontSize: 10, background: `${C.orange}18`, border: `1px solid ${C.orange}44`, borderRadius: 4, padding: "2px 7px", color: C.orange, fontWeight: 700 }}>
          {prof.icon} {prof.label}
        </div>
      </div>
      {steps.map(({ step, label, detail }) => {
        const done   = scanStep > step;
        const active = scanStep === step;
        // step 2 = benchmarks (~8-10s), step 3 = Claude (~4-8s), resto rápido
        const pct    = done ? 100
          : active && step === 2 ? Math.min(90, elapsed * 10)
          : active && step === 3 ? Math.min(92, elapsed * 3)
          : active ? Math.min(88, elapsed * 12) : 0;
        return (
          <div key={step} style={{
            padding: "10px 12px", borderRadius: 8,
            background: done ? `${C.green}0d` : active ? `${C.orange}10` : C.card,
            border: `1px solid ${done ? C.green + "44" : active ? C.orange + "55" : C.border}`,
            opacity: scanStep < step ? 0.4 : 1,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                background: done ? C.green : active ? C.orange : C.border,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 800, color: done ? "#000" : "#fff",
              }}>
                {done ? "✓" : step}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: done ? C.green : active ? C.text : C.muted }}>
                  {label}
                </div>
                <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", marginTop: 1 }}>{detail}</div>
              </div>
              {(done || active) && (
                <span style={{ fontSize: 12, fontWeight: 700, color: done ? C.green : C.orange, minWidth: 38, textAlign: "right" }}>
                  {pct}%
                </span>
              )}
            </div>
            {(done || active) && (
              <div style={{ marginTop: 8, height: 3, background: C.border, borderRadius: 2 }}>
                <div style={{ height: "100%", width: `${pct}%`, background: done ? C.green : C.orange, borderRadius: 2 }} />
              </div>
            )}
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 11, color: C.muted, fontFamily: "monospace" }}>
        {elapsed > 0 && <span>⏱ {elapsed}s</span>}
        {fromCache && <span style={{ color: C.yellow }}>⚡ desde caché</span>}
        {!fromCache && scanStep >= 2 && <span style={{ color: C.orange }}>📡 api.anthropic.com</span>}
        {responseMs > 0 && !fromCache && <span>IA: {(responseMs / 1000).toFixed(1)}s</span>}
      </div>
    </div>
  );
}
