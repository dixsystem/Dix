// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.
//
// Panel manual del nivel Moderado de DixKontrol. Ver docs/threat-model/dixkontrol.md.
// No hay todavía un bucle automático que reaccione a cambios de contexto —
// este panel solo expone los tres pasos que ya existen en el backend
// (iniciar sesión / aplicar un cambio / cerrar sesión) para probarlos a mano.

import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { C } from "../constants";
import type { ForegroundContext } from "../types/dix";

type LogEntry = { ts: number; text: string; kind: "info" | "ok" | "error" };

export function DixKontrolPanel({ onClose }: { onClose: () => void }) {
  const [foreground, setForeground]   = useState<ForegroundContext | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [busy, setBusy]               = useState(false);
  const [swappiness, setSwappiness]   = useState(10);
  const [log, setLog]                 = useState<LogEntry[]>([]);

  const pushLog = (text: string, kind: LogEntry["kind"] = "info") =>
    setLog((prev) => [{ ts: Date.now(), text, kind }, ...prev].slice(0, 20));

  async function checkForeground() {
    setBusy(true);
    try {
      const ctx = await invoke<ForegroundContext>("dixkontrol_foreground_context");
      setForeground(ctx);
      pushLog(ctx.supported ? `App en primer plano: ${ctx.app_name ?? "desconocida"}` : "No soportado en este entorno (¿Wayland sin XWayland?)");
    } catch (e) {
      pushLog(`Error leyendo contexto: ${e}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function startSession() {
    setBusy(true);
    try {
      const msg = await invoke<string>("dixkontrol_start_moderate");
      setSessionActive(true);
      pushLog(msg, "ok");
    } catch (e) {
      pushLog(`No se pudo iniciar la sesión: ${e}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function applySwappiness() {
    setBusy(true);
    try {
      const result = await invoke<string>("dixkontrol_apply_moderate", {
        operacion: { tipo: "set_sysctl", clave: "vm.swappiness", valor: String(swappiness) },
      });
      pushLog(`vm.swappiness → ${swappiness}: ${result.trim()}`, "ok");
    } catch (e) {
      pushLog(`Falló al aplicar el cambio: ${e}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function stopSession() {
    setBusy(true);
    try {
      const msg = await invoke<string>("dixkontrol_stop_moderate");
      setSessionActive(false);
      pushLog(msg, "ok");
    } catch (e) {
      pushLog(`Error cerrando la sesión: ${e}`, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16, overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>🛡 DixKontrol — Nivel Moderado (manual, beta interna)</span>
        <button className="btn-secondary" onClick={onClose} style={{ fontSize: 11 }}>Cerrar</button>
      </div>

      <div style={{ padding: "10px 16px", fontSize: 11, color: C.muted, borderBottom: `1px solid ${C.border}` }}>
        Esto NO reacciona solo todavía a qué app uses — cada paso lo disparas tú. Cambios reversibles únicamente (ver rollback automático). Pide permiso de administrador una sola vez por sesión, no por cada cambio.
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn-secondary" disabled={busy} onClick={checkForeground} style={{ fontSize: 12 }}>
            🔍 Ver app en primer plano
          </button>
          <span style={{ fontSize: 12, color: foreground?.supported ? C.text : C.muted }}>
            {foreground === null ? "—" : foreground.supported ? foreground.app_name ?? "desconocida" : "no soportado en este entorno"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!sessionActive ? (
            <button className="btn-secondary" disabled={busy} onClick={startSession} style={{ fontSize: 12, color: C.green, borderColor: `${C.green}55` }}>
              ▶ Iniciar sesión Moderado
            </button>
          ) : (
            <>
              <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>● Sesión activa</span>
              <button className="btn-secondary" disabled={busy} onClick={stopSession} style={{ fontSize: 12, color: C.red, borderColor: `${C.red}55` }}>
                ■ Cerrar sesión
              </button>
            </>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: sessionActive ? 1 : 0.4 }}>
          <label style={{ fontSize: 12, color: C.muted }}>vm.swappiness objetivo</label>
          <input
            type="number" min={0} max={100} value={swappiness} disabled={!sessionActive || busy}
            onChange={(e) => setSwappiness(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
            style={{ width: 60, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, padding: "3px 6px", fontSize: 12 }}
          />
          <button className="btn-secondary" disabled={!sessionActive || busy} onClick={applySwappiness} style={{ fontSize: 12 }}>
            Aplicar cambio
          </button>
        </div>

        {log.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, display: "flex", flexDirection: "column", gap: 4, maxHeight: 140, overflowY: "auto" }}>
            {log.map((entry) => (
              <div key={entry.ts} style={{
                fontSize: 11, fontFamily: "monospace",
                color: entry.kind === "error" ? C.red : entry.kind === "ok" ? C.green : C.muted,
              }}>
                {new Date(entry.ts).toLocaleTimeString()} — {entry.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
