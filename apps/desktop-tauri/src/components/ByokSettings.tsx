// SPDX-License-Identifier: AGPL-3.0-only
// Copyright © 2026 DixSystem

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export function ByokSettings({ onClose }: { onClose: () => void }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refreshStatus = () => {
    invoke<boolean>("byok_status").then(setConfigured).catch(() => setConfigured(false));
  };

  useEffect(() => { refreshStatus(); }, []);

  const save = async () => {
    if (!input.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await invoke("byok_save_key", { key: input.trim() });
      setInput("");
      setMsg("Clave guardada localmente.");
      refreshStatus();
    } catch (e) {
      setMsg(`Error: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await invoke("byok_clear_key");
      setMsg("Clave eliminada.");
      refreshStatus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 20, width: "min(480px, 92vw)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: "#fff", fontSize: 16 }}>Tu propia clave de API (BYOK)</h3>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: 18 }}>✕</button>
      </div>

      <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.5 }}>
        Introduce tu propia clave de la API de Anthropic para usar DIX sin licencia ni límites de demo.
        Se guarda solo en este equipo (llavero del sistema operativo) y las llamadas van directas a Anthropic —
        nunca pasan por servidores de DixSystem.
      </p>

      <div style={{ marginBottom: 8, fontSize: 13, color: configured ? "#00FF88" : "#64748b" }}>
        {configured === null ? "Comprobando…" : configured ? "● Clave configurada" : "○ Sin clave configurada"}
      </div>

      <input
        type="password"
        placeholder="sk-ant-..."
        value={input}
        onChange={e => setInput(e.target.value)}
        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #30363d", background: "#161b22", color: "#fff", fontSize: 14, marginBottom: 10, boxSizing: "border-box" }}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={save}
          disabled={busy || !input.trim()}
          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "none", background: "#FF6B00", color: "#fff", cursor: busy ? "default" : "pointer", opacity: busy || !input.trim() ? 0.6 : 1 }}
        >
          Guardar
        </button>
        {configured && (
          <button
            onClick={clear}
            disabled={busy}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #30363d", background: "transparent", color: "#94a3b8", cursor: busy ? "default" : "pointer" }}
          >
            Borrar
          </button>
        )}
      </div>

      {msg && <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>{msg}</p>}
    </div>
  );
}
