import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ResumenPanel {
  total: number;
  activos: number;
  completados: number;
  fallidos: number;
  cancelados: number;
}

interface ForgeInfo {
  version: string;
  ollama_url: string;
  resumen: ResumenPanel;
}

interface OllamaStatus {
  disponible: boolean;
  modelos: string[];
}

interface Pipeline {
  id: string;
  nombre: string;
  estado: string;
  creado_en: string;
  tareas: unknown[];
  artefactos: unknown[];
}

type ForgeView = "panel" | "nuevo";

const DOMINIOS = ["Rust", "Frontend", "Documentacion", "Arquitectura", "Testing", "Deploy"];
const ESTADO_COLOR: Record<string, string> = {
  activo:     "#4ade80",
  completado: "#60a5fa",
  fallido:    "#f87171",
  cancelado:  "#94a3b8",
  borrador:   "#fbbf24",
};

// ─── Componente principal ─────────────────────────────────────────────────────

export function ForgePanel() {
  const [view, setView]       = useState<ForgeView>("panel");
  const [info, setInfo]       = useState<ForgeInfo | null>(null);
  const [ollama, setOllama]   = useState<OllamaStatus | null>(null);
  const [activos, setActivos] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // formulario nuevo pipeline
  const [nombre, setNombre]     = useState("");
  const [desc, setDesc]         = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [dominio, setDominio]   = useState("Rust");
  const [running, setRunning]   = useState(false);
  const [resultado, setResultado] = useState<Pipeline | null>(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const [fi, os, pipes] = await Promise.all([
        invoke<ForgeInfo>("forge_status"),
        invoke<OllamaStatus>("forge_ollama_check"),
        invoke<Pipeline[]>("forge_panel_activos"),
      ]);
      setInfo(fi); setOllama(os); setActivos(pipes);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function lanzar() {
    if (!nombre || !objetivo) return;
    setRunning(true); setResultado(null); setError(null);
    try {
      const spec = {
        id: crypto.randomUUID(),
        nombre, descripcion: desc, dominio, objetivo,
        criterios_aceptacion: [], restricciones: [],
        creado_en: new Date().toISOString(),
      };
      const p = await invoke<Pipeline>("forge_crear_pipeline", { specJson: JSON.stringify(spec) });
      setResultado(p);
      await cargar();
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  if (loading) return (
    <div style={S.centered}>
      <div style={S.spinner} />
      <p style={S.dim}>Inicializando DIX Forge…</p>
    </div>
  );

  const resumen = info?.resumen;

  return (
    <div style={S.root}>
      {/* Cabecera */}
      <div style={S.header}>
        <div>
          <h2 style={S.title}>⚙ DIX Forge</h2>
          <p style={S.subtitle}>Fabricación de AppIAs · v{info?.version}</p>
        </div>
        <div style={S.headerRight}>
          {ollama && (
            <span style={{ ...S.badge, borderColor: ollama.disponible ? "#4ade80" : "#f87171", color: ollama.disponible ? "#4ade80" : "#f87171" }}>
              <span style={{ ...S.dot, background: ollama.disponible ? "#4ade80" : "#f87171" }} />
              {ollama.disponible ? `Ollama · ${ollama.modelos.length} modelos` : "Ollama offline"}
            </span>
          )}
          <button style={S.btn} onClick={cargar}>↺</button>
        </div>
      </div>

      {error && <div style={S.error}>{error}</div>}

      {/* Tabs */}
      <div style={S.tabs}>
        {(["panel", "nuevo"] as ForgeView[]).map(v => (
          <button key={v} style={{ ...S.tab, ...(view === v ? S.tabOn : {}) }} onClick={() => setView(v)}>
            {v === "panel" ? "Panel" : "+ Nueva AppIA"}
          </button>
        ))}
      </div>

      {/* Vista Panel */}
      {view === "panel" && (
        <div>
          {resumen && (
            <div style={S.stats}>
              {([["Total", resumen.total, "#94a3b8"], ["Activos", resumen.activos, "#fbbf24"], ["Completados", resumen.completados, "#60a5fa"], ["Fallidos", resumen.fallidos, "#f87171"]] as [string, number, string][]).map(([l, v, c]) => (
                <div key={l} style={{ ...S.statCard, borderColor: c }}>
                  <span style={{ ...S.statVal, color: c }}>{v}</span>
                  <span style={S.statLbl}>{l}</span>
                </div>
              ))}
            </div>
          )}
          {activos.length === 0
            ? <p style={S.dim}>No hay pipelines activos.</p>
            : activos.map(p => {
                const c = ESTADO_COLOR[p.estado.toLowerCase()] ?? "#94a3b8";
                return (
                  <div key={p.id} style={S.card}>
                    <div style={S.cardRow}>
                      <span style={S.cardName}>{p.nombre}</span>
                      <span style={{ ...S.pill, background: c + "22", color: c }}>{p.estado}</span>
                    </div>
                    <span style={S.dim}>{p.tareas.length} tareas · {p.artefactos.length} artefactos · {new Date(p.creado_en).toLocaleString("es-ES")}</span>
                  </div>
                );
              })
          }
        </div>
      )}

      {/* Vista Nueva AppIA */}
      {view === "nuevo" && (
        <div style={S.form}>
          <label style={S.lbl}>Nombre *</label>
          <input style={S.inp} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="ej: DixKontrol v3" disabled={running} />
          <label style={S.lbl}>Descripción</label>
          <input style={S.inp} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Qué hace esta AppIA" disabled={running} />
          <label style={S.lbl}>Objetivo principal *</label>
          <textarea style={S.area} value={objetivo} onChange={e => setObjetivo(e.target.value)} placeholder="Describe el objetivo…" rows={3} disabled={running} />
          <label style={S.lbl}>Dominio técnico</label>
          <select style={S.sel} value={dominio} onChange={e => setDominio(e.target.value)} disabled={running}>
            {DOMINIOS.map(d => <option key={d}>{d}</option>)}
          </select>
          <button style={{ ...S.launch, opacity: running || !nombre || !objetivo ? 0.45 : 1 }}
            disabled={running || !nombre || !objetivo} onClick={lanzar}>
            {running ? "⟳ Fabricando…" : "▶ Fabricar AppIA"}
          </button>
          {resultado && (
            <div style={S.result}>
              <p style={{ color: "#4ade80", fontWeight: 600, margin: "0 0 6px" }}>✓ Pipeline completado</p>
              <p style={S.dim}>Estado: {resultado.estado} · Tareas: {resultado.tareas.length} · Artefactos: {resultado.artefactos.length}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  root:      { padding: 20, color: "#e2e8f0", maxWidth: 760 },
  centered:  { display: "flex", flexDirection: "column", alignItems: "center", padding: 48, gap: 12 },
  spinner:   { width: 30, height: 30, border: "3px solid #1e293b", borderTopColor: "#60a5fa", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  dim:       { color: "#64748b", fontSize: 12, margin: "4px 0" },
  header:    { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  headerRight:{ display: "flex", alignItems: "center", gap: 8 },
  title:     { margin: 0, fontSize: 20, fontWeight: 700 },
  subtitle:  { margin: "3px 0 0", fontSize: 11, color: "#64748b" },
  badge:     { display: "flex", alignItems: "center", gap: 5, fontSize: 11, border: "1px solid", borderRadius: 20, padding: "3px 9px" },
  dot:       { width: 6, height: 6, borderRadius: "50%" },
  btn:       { background: "transparent", border: "1px solid #334155", color: "#94a3b8", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 13 },
  error:     { background: "#7f1d1d44", border: "1px solid #f87171", color: "#fca5a5", borderRadius: 8, padding: "9px 13px", marginBottom: 14, fontSize: 12 },
  tabs:      { display: "flex", gap: 4, marginBottom: 18, borderBottom: "1px solid #1e293b", paddingBottom: 6 },
  tab:       { background: "transparent", border: "none", color: "#64748b", padding: "5px 12px", cursor: "pointer", borderRadius: 6, fontSize: 12 },
  tabOn:     { background: "#1e293b", color: "#f1f5f9", fontWeight: 600 },
  stats:     { display: "flex", gap: 10, marginBottom: 20 },
  statCard:  { flex: 1, background: "#0f172a", border: "1px solid", borderRadius: 8, padding: "12px 14px", textAlign: "center" as const },
  statVal:   { display: "block", fontSize: 26, fontWeight: 700 },
  statLbl:   { display: "block", fontSize: 10, color: "#64748b", marginTop: 3 },
  card:      { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 7, padding: "11px 14px", marginBottom: 7 },
  cardRow:   { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardName:  { fontWeight: 600, fontSize: 13 },
  pill:      { fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10 },
  form:      { display: "flex", flexDirection: "column", gap: 10, maxWidth: 500 },
  lbl:       { fontSize: 11, color: "#94a3b8", fontWeight: 600 },
  inp:       { background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "7px 11px", color: "#f1f5f9", fontSize: 13, outline: "none" },
  area:      { background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "7px 11px", color: "#f1f5f9", fontSize: 13, outline: "none", resize: "vertical" as const, fontFamily: "inherit" },
  sel:       { background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "7px 11px", color: "#f1f5f9", fontSize: 13, outline: "none" },
  launch:    { background: "#1d4ed8", border: "none", color: "#fff", borderRadius: 7, padding: "9px 18px", cursor: "pointer", fontWeight: 700, fontSize: 13, marginTop: 2 },
  result:    { background: "#0f172a", border: "1px solid #166534", borderRadius: 7, padding: "12px 14px", marginTop: 6 },
};
