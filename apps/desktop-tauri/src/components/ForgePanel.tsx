import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { UnlistenFn } from "@tauri-apps/api/event";

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

interface Task {
  id: string;
  titulo: string;
  descripcion: string;
  agente: string;
  dominio: string;
  estado: string;
  intentos: number;
  resultado: string | null;
}

interface Pipeline {
  id: string;
  nombre: string;
  estado: string;
  creadoEn: string;
  tareas: Task[];
  artefactos: unknown[];
}

// Tarea en vivo durante fabricación
interface LiveTask {
  id: string;
  titulo: string;
  agente: string;
  dominio: string;
  estado: "pendiente" | "en_curso" | "completada" | "fallida";
  resultado?: string;
  error?: string;
}

type ForgeView = "panel" | "nuevo" | "detalle";

const DOMINIOS: { val: string; label: string }[] = [
  { val: "rust",          label: "Rust" },
  { val: "frontend",      label: "Frontend" },
  { val: "documentacion", label: "Documentación" },
  { val: "arquitectura",  label: "Arquitectura" },
  { val: "testing",       label: "Testing" },
  { val: "deploy",        label: "Deploy" },
];

const ESTADO_COLOR: Record<string, string> = {
  activo:     "#4ade80",
  completado: "#60a5fa",
  fallido:    "#f87171",
  cancelado:  "#94a3b8",
  borrador:   "#fbbf24",
};

const LIVE_COLOR: Record<string, string> = {
  pendiente:  "#475569",
  en_curso:   "#fbbf24",
  completada: "#4ade80",
  fallida:    "#f87171",
};

const LIVE_ICON: Record<string, string> = {
  pendiente:  "○",
  en_curso:   "⟳",
  completada: "✓",
  fallida:    "✕",
};

// ─── Componente principal ─────────────────────────────────────────────────────

export function ForgePanel() {
  const [view, setView]           = useState<ForgeView>("panel");
  const [info, setInfo]           = useState<ForgeInfo | null>(null);
  const [ollama, setOllama]       = useState<OllamaStatus | null>(null);
  const [activos, setActivos]     = useState<Pipeline[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [selected, setSelected]   = useState<Pipeline | null>(null);

  // formulario
  const [nombre, setNombre]       = useState("");
  const [desc, setDesc]           = useState("");
  const [objetivo, setObjetivo]   = useState("");
  const [dominio, setDominio]     = useState("rust");
  const [running, setRunning]     = useState(false);
  const [resultado, setResultado] = useState<Pipeline | null>(null);

  // progreso en tiempo real
  const [liveTasks, setLiveTasks]           = useState<LiveTask[]>([]);
  const [liveEstado, setLiveEstado]         = useState<string>("");
  const [pipelineNombre, setPipelineNombre] = useState("");

  const unlistenRef = useRef<UnlistenFn[]>([]);

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

  async function suscribirEventos() {
    const uns: UnlistenFn[] = [];

    uns.push(await listen<{ pipelineId: string; estado: string }>("forge:pipeline.state", ({ payload }) => {
      setLiveEstado(payload.estado);
    }));

    uns.push(await listen<{ taskId: string; titulo: string; agente: string; dominio: string }>("forge:task.started", ({ payload }) => {
      setLiveTasks(prev => {
        const existe = prev.find(t => t.id === payload.taskId);
        if (existe) {
          return prev.map(t => t.id === payload.taskId ? { ...t, estado: "en_curso" as const } : t);
        }
        return [...prev, {
          id: payload.taskId,
          titulo: payload.titulo,
          agente: payload.agente,
          dominio: payload.dominio,
          estado: "en_curso" as const,
        }];
      });
    }));

    uns.push(await listen<{ taskId: string; resultado: string }>("forge:task.completed", ({ payload }) => {
      setLiveTasks(prev => prev.map(t =>
        t.id === payload.taskId ? { ...t, estado: "completada" as const, resultado: payload.resultado } : t
      ));
    }));

    uns.push(await listen<{ taskId: string; error: string; intentos: number }>("forge:task.failed", ({ payload }) => {
      setLiveTasks(prev => prev.map(t =>
        t.id === payload.taskId ? { ...t, estado: "fallida" as const, error: payload.error } : t
      ));
    }));

    unlistenRef.current = uns;
  }

  function limpiarEventos() {
    unlistenRef.current.forEach(fn => fn());
    unlistenRef.current = [];
  }

  async function lanzar() {
    if (!nombre || !objetivo) return;
    setRunning(true);
    setResultado(null);
    setError(null);
    setLiveTasks([]);
    setLiveEstado("Activo");
    setPipelineNombre(nombre);

    await suscribirEventos();

    try {
      const spec = {
        id: crypto.randomUUID(),
        nombre, descripcion: desc, dominio, objetivo,
        criteriosAceptacion: [], restricciones: [],
        creadoEn: new Date().toISOString(),
      };
      const p = await invoke<Pipeline>("forge_crear_pipeline", { specJson: JSON.stringify(spec) });
      setResultado(p);
      setLiveEstado("Completado");
      // Sincronizar estado final de tareas con el resultado completo del pipeline
      setLiveTasks(p.tareas.map(t => ({
        id: t.id,
        titulo: t.titulo,
        agente: t.agente,
        dominio: t.dominio,
        estado: (t.estado.toLowerCase() === "completada" || t.estado.toLowerCase() === "completado")
          ? "completada" as const
          : "fallida" as const,
        resultado: t.resultado ?? undefined,
      })));
      await cargar();
    } catch (e) {
      setError(String(e));
      setLiveEstado("Fallido");
    } finally {
      limpiarEventos();
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
        {view === "detalle" && selected && (
          <button style={{ ...S.tab, ...S.tabOn }}>
            📋 {selected.nombre}
          </button>
        )}
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
            ? <p style={S.dim}>No hay pipelines. Crea tu primera AppIA.</p>
            : activos.map(p => {
                const c = ESTADO_COLOR[p.estado.toLowerCase()] ?? "#94a3b8";
                return (
                  <div key={p.id} style={{ ...S.card, cursor: "pointer" }}
                    onClick={() => { setSelected(p); setView("detalle"); }}>
                    <div style={S.cardRow}>
                      <span style={S.cardName}>{p.nombre}</span>
                      <span style={{ ...S.pill, background: c + "22", color: c }}>{p.estado}</span>
                    </div>
                    <span style={S.dim}>{p.tareas.length} tareas · {p.artefactos.length} artefactos · {new Date(p.creadoEn).toLocaleString("es-ES")}</span>
                  </div>
                );
              })
          }
        </div>
      )}

      {/* Vista Detalle pipeline (historial) */}
      {view === "detalle" && selected && (
        <div>
          <button style={{ ...S.btn, marginBottom: 16 }} onClick={() => setView("panel")}>← Volver al Panel</button>
          <div style={{ marginBottom: 16 }}>
            <div style={S.cardRow}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{selected.nombre}</span>
              <span style={{ ...S.pill, background: (ESTADO_COLOR[selected.estado.toLowerCase()] ?? "#94a3b8") + "22", color: ESTADO_COLOR[selected.estado.toLowerCase()] ?? "#94a3b8" }}>
                {selected.estado}
              </span>
            </div>
            <span style={S.dim}>{selected.tareas.length} tareas · {new Date(selected.creadoEn).toLocaleString("es-ES")}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {selected.tareas.map((t, i) => {
              const tc = ESTADO_COLOR[t.estado.toLowerCase()] ?? "#94a3b8";
              return (
                <div key={t.id} style={{ background: "#0f172a", border: `1px solid #1e293b`, borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>#{i + 1} {t.titulo}</span>
                    <span style={{ ...S.pill, background: tc + "22", color: tc }}>{t.estado}</span>
                  </div>
                  <p style={{ ...S.dim, margin: "0 0 8px" }}>{t.descripcion}</p>
                  <div style={{ display: "flex", gap: 8, marginBottom: t.resultado ? 10 : 0 }}>
                    <span style={{ ...S.pill, background: "#1e293b", color: "#94a3b8" }}>{t.agente}</span>
                    <span style={{ ...S.pill, background: "#1e293b", color: "#94a3b8" }}>{t.dominio}</span>
                    <span style={{ ...S.pill, background: "#1e293b", color: "#94a3b8" }}>intento {t.intentos}</span>
                  </div>
                  {t.resultado && (
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ ...S.dim, cursor: "pointer", userSelect: "none" }}>Ver resultado de Ollama</summary>
                      <pre style={{ margin: "8px 0 0", padding: "10px 12px", background: "#020617", borderRadius: 6, fontSize: 11, color: "#94a3b8", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 200, overflowY: "auto" }}>
                        {t.resultado}
                      </pre>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vista Nueva AppIA */}
      {view === "nuevo" && (
        <div style={S.form}>
          {/* Formulario — oculto mientras fabrica */}
          {!running && !resultado && (
            <>
              <label style={S.lbl}>Nombre *</label>
              <input style={S.inp} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="ej: DixKontrol v3" />
              <label style={S.lbl}>Descripción</label>
              <input style={S.inp} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Qué hace esta AppIA" />
              <label style={S.lbl}>Objetivo principal *</label>
              <textarea style={S.area} value={objetivo} onChange={e => setObjetivo(e.target.value)} placeholder="Describe el objetivo…" rows={3} />
              <label style={S.lbl}>Dominio técnico</label>
              <select style={S.sel} value={dominio} onChange={e => setDominio(e.target.value)}>
                {DOMINIOS.map(d => <option key={d.val} value={d.val}>{d.label}</option>)}
              </select>
              <button style={{ ...S.launch, opacity: !nombre || !objetivo ? 0.45 : 1 }}
                disabled={!nombre || !objetivo} onClick={lanzar}>
                ▶ Fabricar AppIA
              </button>
            </>
          )}

          {/* Progreso en tiempo real */}
          {running && (
            <div style={S.liveBox}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={S.spinner} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{pipelineNombre}</div>
                  <div style={{ ...S.dim, marginTop: 2 }}>
                    {liveTasks.length === 0
                      ? "Planificando tareas con Ollama…"
                      : `${liveEstado} · ${liveTasks.filter(t => t.estado === "completada").length} / ${liveTasks.length} completadas`
                    }
                  </div>
                </div>
              </div>

              {liveTasks.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {liveTasks.map((t, i) => {
                    const c = LIVE_COLOR[t.estado];
                    return (
                      <div key={t.id} style={{ background: "#020617", border: `1px solid ${c}33`, borderRadius: 6, padding: "8px 11px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: c, fontSize: 13, fontWeight: 700, minWidth: 14 }}>
                            {LIVE_ICON[t.estado]}
                          </span>
                          <span style={{ fontWeight: 600, fontSize: 12, flex: 1 }}>#{i + 1} {t.titulo}</span>
                          <span style={{ ...S.pill, background: c + "22", color: c, fontSize: 9 }}>
                            {t.estado.replace("_", " ")}
                          </span>
                        </div>
                        {t.estado === "en_curso" && (
                          <div style={{ ...S.dim, marginTop: 3, marginLeft: 22 }}>
                            {t.agente} · {t.dominio}
                          </div>
                        )}
                        {t.estado === "fallida" && t.error && (
                          <div style={{ color: "#f87171", fontSize: 11, marginTop: 3, marginLeft: 22 }}>{t.error}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Resultado final con detalle expandible */}
          {resultado && !running && (
            <div>
              <div style={S.result}>
                <p style={{ color: "#4ade80", fontWeight: 700, margin: "0 0 4px" }}>✓ {pipelineNombre} — Completado</p>
                <p style={S.dim}>Estado: {resultado.estado} · {resultado.tareas.length} tareas · {resultado.artefactos.length} artefactos</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 12 }}>
                {liveTasks.map((t, i) => {
                  const c = LIVE_COLOR[t.estado];
                  return (
                    <div key={t.id} style={{ background: "#0f172a", border: `1px solid #1e293b`, borderRadius: 7, padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ color: c, fontWeight: 700, fontSize: 13 }}>{LIVE_ICON[t.estado]}</span>
                        <span style={{ fontWeight: 600, fontSize: 12, flex: 1 }}>#{i + 1} {t.titulo}</span>
                        <span style={{ ...S.pill, background: c + "22", color: c, fontSize: 9 }}>
                          {t.estado.replace("_", " ")}
                        </span>
                      </div>
                      {t.resultado && (
                        <details style={{ marginLeft: 22 }}>
                          <summary style={{ ...S.dim, cursor: "pointer", userSelect: "none" }}>Ver resultado de Ollama</summary>
                          <pre style={{ margin: "6px 0 0", padding: "8px 10px", background: "#020617", borderRadius: 5, fontSize: 10, color: "#94a3b8", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 180, overflowY: "auto" }}>
                            {t.resultado}
                          </pre>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
              <button style={{ ...S.btn, marginTop: 14 }} onClick={() => { setResultado(null); setLiveTasks([]); }}>
                + Nueva AppIA
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  root:       { padding: 20, color: "#e2e8f0", maxWidth: 760 },
  centered:   { display: "flex", flexDirection: "column", alignItems: "center", padding: 48, gap: 12 },
  spinner:    { width: 22, height: 22, border: "3px solid #1e293b", borderTopColor: "#60a5fa", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 },
  dim:        { color: "#64748b", fontSize: 12, margin: "4px 0" },
  header:     { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  headerRight:{ display: "flex", alignItems: "center", gap: 8 },
  title:      { margin: 0, fontSize: 20, fontWeight: 700 },
  subtitle:   { margin: "3px 0 0", fontSize: 11, color: "#64748b" },
  badge:      { display: "flex", alignItems: "center", gap: 5, fontSize: 11, border: "1px solid", borderRadius: 20, padding: "3px 9px" },
  dot:        { width: 6, height: 6, borderRadius: "50%" },
  btn:        { background: "transparent", border: "1px solid #334155", color: "#94a3b8", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 13 },
  error:      { background: "#7f1d1d44", border: "1px solid #f87171", color: "#fca5a5", borderRadius: 8, padding: "9px 13px", marginBottom: 14, fontSize: 12 },
  tabs:       { display: "flex", gap: 4, marginBottom: 18, borderBottom: "1px solid #1e293b", paddingBottom: 6 },
  tab:        { background: "transparent", border: "none", color: "#64748b", padding: "5px 12px", cursor: "pointer", borderRadius: 6, fontSize: 12 },
  tabOn:      { background: "#1e293b", color: "#f1f5f9", fontWeight: 600 },
  stats:      { display: "flex", gap: 10, marginBottom: 20 },
  statCard:   { flex: 1, background: "#0f172a", border: "1px solid", borderRadius: 8, padding: "12px 14px", textAlign: "center" as const },
  statVal:    { display: "block", fontSize: 26, fontWeight: 700 },
  statLbl:    { display: "block", fontSize: 10, color: "#64748b", marginTop: 3 },
  card:       { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 7, padding: "11px 14px", marginBottom: 7 },
  cardRow:    { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardName:   { fontWeight: 600, fontSize: 13 },
  pill:       { fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10 },
  form:       { display: "flex", flexDirection: "column", gap: 10, maxWidth: 520 },
  lbl:        { fontSize: 11, color: "#94a3b8", fontWeight: 600 },
  inp:        { background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "7px 11px", color: "#f1f5f9", fontSize: 13, outline: "none" },
  area:       { background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "7px 11px", color: "#f1f5f9", fontSize: 13, outline: "none", resize: "vertical" as const, fontFamily: "inherit" },
  sel:        { background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "7px 11px", color: "#f1f5f9", fontSize: 13, outline: "none" },
  launch:     { background: "#1d4ed8", border: "none", color: "#fff", borderRadius: 7, padding: "9px 18px", cursor: "pointer", fontWeight: 700, fontSize: 13, marginTop: 2 },
  result:     { background: "#0f172a", border: "1px solid #166534", borderRadius: 7, padding: "12px 14px" },
  liveBox:    { background: "#0f172a", border: "1px solid #1e3a5f", borderRadius: 9, padding: "14px 16px" },
};
