// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { C, METRIC_DEFS, STATUS_COLOR, STATUS_LABEL } from "../constants";
import { useT } from "../i18n";
import type { LiveMetrics } from "../types/dix";

export function LiveOptimizingPanel({ active }: { active: boolean }) {
  const { t } = useT();
  const [m, setM] = useState<LiveMetrics | null>(null);

  useEffect(() => {
    if (!active) return;
    const poll = async () => {
      try { setM(await invoke<LiveMetrics>("get_live_metrics")); }
      catch { /* silencioso */ }
    };
    poll();
    const id = setInterval(poll, 400);
    return () => clearInterval(id);
  }, [active]);

  if (!m) return (
    <div style={{ flex: 1, borderTop: `1px solid ${C.border}`, padding: "14px", display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.orange, animation: "pulse 1s infinite" }} />
      <div style={{ fontSize: 11, color: C.muted }}>{t("live_optimizing_panel_starting_monitor")}</div>
    </div>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", borderTop: `1px solid ${C.border}` }}>
      <div style={{ padding: "8px 14px 6px", fontSize: 10, color: C.muted, letterSpacing: "1px", display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
        <span>{t("live_optimizing_panel_realtime_status")}</span>
        <span style={{ color: C.green, fontSize: 9 }}>⬤ LIVE 400ms</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0 10px" }}>
        {METRIC_DEFS.map((def) => {
          const status = def.status(m);
          const color  = STATUS_COLOR[status];
          const pct    = def.pct(m);
          return (
            <div key={def.id} style={{
              padding: "9px 14px",
              borderBottom: `1px solid ${C.border}`,
              transition: "background 0.5s ease",
              background: status === "green" ? `${C.green}06` : status === "yellow" ? `${C.yellow}06` : `${C.red}06`,
            }}>
              {/* Cabecera de la métrica */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{def.label}</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{def.sublabel}</div>
                </div>
                <div style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: "0.5px",
                  color: color, background: `${color}18`,
                  border: `1px solid ${color}44`,
                  borderRadius: 4, padding: "2px 7px",
                  flexShrink: 0,
                }}>
                  {STATUS_LABEL[status]}
                </div>
              </div>
              {/* Valor actual */}
              <div style={{ fontSize: 11, color: color, fontWeight: 700, marginBottom: 6, fontFamily: "monospace" }}>
                {def.value(m)}
              </div>
              {/* Barra de progreso */}
              <div style={{ height: 5, background: "#1a1f2e", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: color,
                  borderRadius: 3,
                  transition: "width 0.6s ease, background 0.6s ease",
                  boxShadow: `0 0 6px ${color}66`,
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
