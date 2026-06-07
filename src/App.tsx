import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { check as checkUpdate, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import dixIdle from "./assets/dix-idle.png";
import logoDs  from "./assets/logo-dixsystem.png";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface SystemScan {
  cpu_governor: string; cpu_cores: number; swappiness: number;
  dirty_ratio: number; dirty_background_ratio: number; disk_scheduler: string;
  audio_server: string; hugepages: string; numa_balancing: string;
  mem_total_mb: number; mem_available_mb: number; load_avg: string;
  nvme_queue_depth: string; irqbalance_active: boolean;
  cpu_min_freq_mhz: number; cpu_max_freq_mhz: number;
  cpu_model: string; gpu_model: string; distro_id: string;
  distro_version: string; kernel_version: string;
  cpu_temp_celsius: number;
}
interface Optimization {
  id: string; categoria: string; titulo: string; descripcion: string;
  impacto: number; riesgo: string; mejora_estimada: string;
  aplicar: boolean; comando_preview: string; tiempo_estimado: string;
}
interface AnalysisResult {
  analisis: string; score_actual: number; score_optimizado: number;
  optimizaciones: Optimization[];
}
interface AnalysisResponse {
  analysis_json: string; from_cache: boolean; response_time_ms: number;
}
interface Session {
  id: string; timestamp: string; score_before: number;
  score_after: number; optimizations_applied: string[]; scan_summary: string;
}
interface RollbackInfo { filename: string; timestamp: number; date_human: string; }

type View = "init" | "idle" | "scanning" | "results" | "applying" | "done" | "activate";

interface LiveMetrics {
  governor: string; swappiness: number; dirty_ratio: number; dirty_bg: number;
  hugepages: string; mem_free_mb: number; mem_total_mb: number;
  load_1: number; load_5: number; nr_requests: number;
  cpu_freq_mhz: number; cpu_max_mhz: number;
  cpu_temp_celsius: number; cpu_avg_freq_mhz: number; cpu_cores: number;
}

// ─── Constantes de color ──────────────────────────────────────────────────────

const C = {
  bg:       "#0d1117",
  card:     "#161b22",
  border:   "#21262d",
  text:     "#e6edf3",
  muted:    "#8b949e",
  orange:   "#FF6B00",
  orangeD:  "#cc5500",
  green:    "#00FF88",
  red:      "#f85149",
  yellow:   "#FFD700",
};

const CAT: Record<string, { bg: string; color: string }> = {
  CPU:     { bg: "#1a1040", color: "#a78bfa" },
  RAM:     { bg: "#0d1f3c", color: "#60a5fa" },
  Storage: { bg: "#1f1208", color: "#fb923c" },
  Red:     { bg: "#1f0e1a", color: "#f472b6" },
  Sistema: { bg: "#111827", color: "#94a3b8" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeParseJSON<T>(text: string): T {
  try { return JSON.parse(text) as T; } catch { /**/ }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]) as T; } catch { /**/ } }
  throw new Error(`No se pudo parsear: ${text.slice(0, 200)}`);
}

function scoreColor(s: number) {
  return s >= 80 ? C.green : s >= 55 ? C.yellow : C.red;
}

// Score determinista basado en métricas reales — evita inconsistencias entre sesiones
function computeScore(scan: SystemScan): number {
  let score = 100;
  if (scan.cpu_governor !== "performance" && scan.cpu_governor !== "schedutil")
    score -= scan.cpu_governor === "ondemand" ? 8 : 15;
  if (scan.swappiness > 60)        score -= 12;
  else if (scan.swappiness > 40)   score -= 8;
  else if (scan.swappiness > 20)   score -= 4;
  if (scan.dirty_ratio > 30)       score -= 10;
  else if (scan.dirty_ratio > 20)  score -= 6;
  else if (scan.dirty_ratio > 15)  score -= 3;
  if (scan.hugepages === "always") score -= 10;
  else if (scan.hugepages === "never") score -= 3;
  if (!scan.irqbalance_active)     score -= 5;
  if (scan.numa_balancing === "1") score -= 3;
  const sched = scan.disk_scheduler;
  if (sched && sched !== "none" && sched !== "kyber" && sched !== "mq-deadline" && sched !== "bfq") score -= 5;
  if (scan.cpu_temp_celsius > 85)      score -= 10;
  else if (scan.cpu_temp_celsius > 75) score -= 5;
  return Math.max(30, Math.min(100, score));
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("es", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

// ─── Score Ring SVG ───────────────────────────────────────────────────────────

function ScoreRing({ score, label, size = 110 }: { score: number; label: string; size?: number }) {
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

// ─── Contador estático (sin animación) ───────────────────────────────────────

function AnimatedCounter({ target }: { target: number }) {
  return <>{target}</>;
}

// ─── Terminal de métricas en tiempo real ──────────────────────────────────────

function LiveTerminal({
  scan,
  revealedCount,
  analysisText,
}: {
  scan: Record<string, unknown> | null;
  revealedCount: number;
  analysisText?: string;
}) {
  const termRef = useRef<HTMLDivElement>(null);
  const entries = scan ? Object.entries(scan) : [];
  const visible = entries.slice(0, revealedCount);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [revealedCount, analysisText]);

  return (
    <div
      ref={termRef}
      style={{
        flex: 1,
        background: "#010409",
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "12px 14px",
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontSize: 11,
        lineHeight: 1.85,
        overflowY: "auto",
        minHeight: 200,
      }}
    >
      <div style={{ color: C.muted, marginBottom: 6, fontSize: 10, letterSpacing: "0.5px" }}>
        ● DIX — ANÁLISIS EN VIVO
      </div>
      {visible.map(([k, v]) => (
        <div key={k} style={{ display: "flex", gap: 6 }}>
          <span style={{ color: C.orange, minWidth: 130 }}>{k}</span>
          <span style={{ color: C.green }}>{String(v)}</span>
        </div>
      ))}
      {scan && revealedCount < entries.length && (
        <div style={{ color: C.muted }}>▋</div>
      )}
      {analysisText && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}33` }}>
          <div style={{ color: C.yellow, fontSize: 10, marginBottom: 4 }}>─ CLAUDE AI ──────────────────</div>
          <div style={{ color: "#94a3b8", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{analysisText}</div>
        </div>
      )}
    </div>
  );
}

// ─── Panel de pasos del proceso ───────────────────────────────────────────────

function StepsPanel({ scanStep }: { scanStep: number }) {
  const steps = [
    { step: 1, label: "Leyendo métricas del kernel", sublabel: "/proc · /sys · pactl" },
    { step: 2, label: "Consultando Claude AI",        sublabel: "claude-sonnet-4-6" },
    { step: 3, label: "Generando script bash",        sublabel: "optimizaciones personalizadas" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {steps.map(({ step, label, sublabel }) => {
        const done    = scanStep > step;
        const active  = scanStep === step;
        const pending = scanStep < step;
        return (
          <div
            key={step}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 12px", borderRadius: 8,
              background: done ? `${C.green}0d` : active ? `${C.orange}12` : `${C.card}`,
              border: `1px solid ${done ? C.green + "33" : active ? C.orange + "44" : C.border}`,
              opacity: pending ? 0.45 : 1,
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
              background: done ? C.green : active ? C.orange : C.border,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 800, color: done ? "#000" : "#fff",
            }}>
              {done ? "✓" : step}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: done ? C.green : active ? C.text : C.muted }}>{label}</div>
              <div style={{ fontSize: 10, color: C.muted }}>{sublabel}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Panel de progreso del análisis ──────────────────────────────────────────

function AnalysisProgress({
  scanStep, elapsed, fromCache, responseMs,
}: {
  scanStep: number; elapsed: number; fromCache: boolean; responseMs: number;
}) {
  const steps = [
    { step: 1, label: "Leyendo métricas del kernel", detail: "/proc · /sys · pactl" },
    { step: 2, label: "Consultando Claude AI",        detail: "POST api.anthropic.com · claude-sonnet-4-6" },
    { step: 3, label: "Generando script bash",        detail: "optimizaciones personalizadas" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "16px 14px" }}>
      <div style={{ fontSize: 10, color: C.muted, letterSpacing: "1px", marginBottom: 4 }}>
        ● DIX — PROGRESO DEL ANÁLISIS
      </div>
      {steps.map(({ step, label, detail }) => {
        const done   = scanStep > step;
        const active = scanStep === step;
        const pct    = done ? 100 : active && step === 2 ? Math.min(92, elapsed * 3) : active ? Math.min(88, elapsed * 12) : 0;
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

// ─── Panel de optimización en vivo — semáforo rojo→amarillo→verde ────────────

interface MetricDef {
  id: string;
  label: string;
  sublabel: string;
  value: (m: LiveMetrics) => string;
  pct: (m: LiveMetrics) => number;
  status: (m: LiveMetrics) => "red" | "yellow" | "green";
}

const METRIC_DEFS: MetricDef[] = [
  {
    id: "governor",
    label: "Velocidad CPU",
    sublabel: "governor del procesador",
    value: (m) => m.governor === "performance" ? "Máximo rendimiento" : m.governor === "schedutil" ? "Adaptativo (bueno)" : m.governor === "powersave" ? "Ahorro energético" : m.governor,
    pct: (m) => m.governor === "performance" ? 100 : m.governor === "schedutil" ? 80 : 20,
    status: (m) => m.governor === "performance" || m.governor === "schedutil" ? "green" : m.governor === "ondemand" ? "yellow" : "red",
  },
  {
    id: "freq",
    label: "Frecuencia del procesador",
    sublabel: "media de todos los cores en tiempo real",
    value: (m) => {
      const isOptimal = m.governor === "performance" || m.governor === "schedutil";
      const avg = m.cpu_avg_freq_mhz || m.cpu_freq_mhz;
      if (isOptimal && m.cpu_max_mhz > 0 && avg < m.cpu_max_mhz * 0.35) {
        return `${avg.toLocaleString()} MHz — reposo, escalará automáticamente`;
      }
      return m.cpu_max_mhz > 0
        ? `${avg.toLocaleString()} MHz de ${m.cpu_max_mhz.toLocaleString()} MHz máx`
        : `${avg} MHz`;
    },
    pct: (m) => {
      const avg = m.cpu_avg_freq_mhz || m.cpu_freq_mhz;
      return m.cpu_max_mhz > 0 ? Math.round((avg / m.cpu_max_mhz) * 100) : 50;
    },
    status: (m) => {
      if (m.governor === "performance" || m.governor === "schedutil") return "green";
      const avg = m.cpu_avg_freq_mhz || m.cpu_freq_mhz;
      const p = m.cpu_max_mhz > 0 ? avg / m.cpu_max_mhz : 0.5;
      return p > 0.6 ? "green" : p > 0.3 ? "yellow" : "red";
    },
  },
  {
    id: "temp",
    label: "Temperatura CPU",
    sublabel: "temperatura del paquete del procesador",
    value: (m) => {
      if (!m.cpu_temp_celsius || m.cpu_temp_celsius <= 0) return "Sin sensor detectado";
      const t = m.cpu_temp_celsius;
      const estado = t < 60 ? "fría" : t < 70 ? "normal" : t < 80 ? "cálida" : t < 90 ? "caliente" : "crítica";
      return `${t.toFixed(1)}°C — ${estado}`;
    },
    pct: (m) => {
      if (!m.cpu_temp_celsius || m.cpu_temp_celsius <= 0) return 75;
      return Math.max(0, Math.min(100, Math.round(((100 - m.cpu_temp_celsius) / 70) * 100)));
    },
    status: (m) => {
      if (!m.cpu_temp_celsius || m.cpu_temp_celsius <= 0) return "green";
      return m.cpu_temp_celsius < 70 ? "green" : m.cpu_temp_celsius < 85 ? "yellow" : "red";
    },
  },
  {
    id: "swap",
    label: "Prioridad de la RAM",
    sublabel: "qué tanto usa el disco como memoria",
    value: (m) => m.swappiness <= 20 ? `Alta — swap ${m.swappiness}` : m.swappiness <= 40 ? `Media — swap ${m.swappiness}` : `Baja — swap ${m.swappiness}`,
    pct: (m) => Math.round(100 - m.swappiness),
    status: (m) => m.swappiness <= 20 ? "green" : m.swappiness <= 40 ? "yellow" : "red",
  },
  {
    id: "dirty",
    label: "Buffer de escritura en disco",
    sublabel: "datos pendientes de escribir en disco",
    value: (m) => m.dirty_ratio <= 15 ? `Óptimo — ${m.dirty_ratio}%` : m.dirty_ratio <= 20 ? `Aceptable — ${m.dirty_ratio}%` : `Alto — ${m.dirty_ratio}%`,
    pct: (m) => Math.round(Math.max(0, 100 - ((m.dirty_ratio / 30) * 100))),
    status: (m) => m.dirty_ratio <= 15 ? "green" : m.dirty_ratio <= 20 ? "yellow" : "red",
  },
  {
    id: "nvme",
    label: "Cola de peticiones del disco",
    sublabel: "capacidad de respuesta del almacenamiento",
    value: (m) => m.nr_requests >= 256 ? `Alta — ${m.nr_requests} peticiones` : m.nr_requests >= 64 ? `Media — ${m.nr_requests} peticiones` : `Baja — ${m.nr_requests} peticiones`,
    pct: (m) => Math.min(100, Math.round((m.nr_requests / 512) * 100)),
    status: (m) => m.nr_requests >= 256 ? "green" : m.nr_requests >= 64 ? "yellow" : "red",
  },
  {
    id: "hugepages",
    label: "Gestión de memoria avanzada",
    sublabel: "páginas de memoria grandes del kernel",
    value: (m) => m.hugepages === "madvise" ? "Inteligente (madvise)" : m.hugepages === "never" ? "Desactivado (never)" : "Siempre activo — ineficiente",
    pct: (_m) => _m.hugepages === "madvise" ? 100 : _m.hugepages === "never" ? 60 : 15,
    status: (m) => m.hugepages === "madvise" ? "green" : m.hugepages === "never" ? "yellow" : "red",
  },
];

const STATUS_COLOR = { red: C.red, yellow: C.yellow, green: C.green };
const STATUS_LABEL = { red: "SIN OPTIMIZAR", yellow: "MEJORANDO", green: "ÓPTIMO" };

function LiveOptimizingPanel({ active }: { active: boolean }) {
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
      <div style={{ fontSize: 11, color: C.muted }}>Iniciando monitor…</div>
    </div>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", borderTop: `1px solid ${C.border}` }}>
      <div style={{ padding: "8px 14px 6px", fontSize: 10, color: C.muted, letterSpacing: "1px", display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
        <span>● ESTADO DEL SISTEMA EN TIEMPO REAL</span>
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

// ─── Componente principal ─────────────────────────────────────────────────────

export default function App() {
  const [view, setView]               = useState<View>("init");
  const [scan, setScan]                 = useState<SystemScan | null>(null);
  const [analysis, setAnalysis]         = useState<AnalysisResult | null>(null);
  const [fromCache, setFromCache]       = useState(false);
  const [responseMs, setResponseMs]     = useState(0);
  const [script, setScript]             = useState("");
  const [scriptVisible, setScriptVisible] = useState(false);
  const [applyLog, setApplyLog]         = useState("");
  const [error, setError]               = useState<string | null>(null);
  const [sessions, setSessions]         = useState<Session[]>([]);
  const [showReboot, setShowReboot]     = useState(false);
  const [rollbacks, setRollbacks]       = useState<RollbackInfo[]>([]);
  const [showRollbacks, setShowRollbacks] = useState(false);
  const [rollingBack, setRollingBack]   = useState(false);
  const [scanStep, setScanStep]         = useState(0);
  const [revealedMetrics, setRevealedMetrics] = useState(0);
  const scanRef      = useRef<SystemScan | null>(null);
  const startTimeRef = useRef<number>(0);
  const [elapsed, setElapsed] = useState(0);
  const [isLicensed, setIsLicensed]     = useState(false);
  const [demoCount, setDemoCount]       = useState(0);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [licenseInput, setLicenseInput] = useState("");
  const [activatingLicense, setActivatingLicense] = useState(false);
  const [pendingUpdate, setPendingUpdate]   = useState<Update | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateTotal, setUpdateTotal]       = useState(0);
  const [updateState, setUpdateState]       = useState<"idle" | "downloading" | "done">("idle");
  const [hwSummary, setHwSummary] = useState<{ cpu: string; ram: string; distro: string } | null>(null);
  const [idleScan, setIdleScan]   = useState<SystemScan | null>(null);

  // Mostrar todas las métricas inmediatamente cuando llegan
  useEffect(() => {
    if (!scan) { setRevealedMetrics(0); return; }
    setRevealedMetrics(Object.keys(scan).length);
  }, [scan]);

  useEffect(() => {
    // Restaurar estado de reinicio pendiente si la app se cerró antes de reiniciar
    if (localStorage.getItem("dix_needs_reboot") === "1") {
      setShowReboot(true);
    }

    Promise.all([
      invoke<boolean>("get_license_status").catch(() => false),
      invoke<number>("get_demo_count").catch(() => 0),
    ]).then(([licensed, demo]) => {
      setIsLicensed(licensed);
      setDemoCount(demo);
      invoke<Session[]>("get_sessions").then(setSessions).catch(() => {});
      invoke<RollbackInfo[]>("list_rollbacks").then(setRollbacks).catch(() => {});
      setView("idle");
      // Scan de hardware en background para mostrar info real en idle
      invoke<SystemScan>("scan_system").then((s) => {
        const ramGb = Math.round((s.mem_total_mb + 512) / 1024);
        setHwSummary({
          cpu: s.cpu_model || "CPU detectada",
          ram: `${ramGb} GB RAM`,
          distro: s.distro_id ? `${s.distro_id} ${s.distro_version}`.trim() : "Linux",
        });
        setIdleScan(s);
      }).catch(() => {});
    }).catch(() => { setView("idle"); });

    checkUpdate()
      .then((update) => { if (update) setPendingUpdate(update); })
      .catch(() => {});
  }, []);

  // Temporizador de análisis — arranca en scanning, para en results/done
  useEffect(() => {
    if (view === "scanning") {
      startTimeRef.current = Date.now();
      setElapsed(0);
      const id = setInterval(() => {
        setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
      return () => clearInterval(id);
    }
  }, [view]);



  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleStart = async () => {
    setError(null); setScanStep(0); setRevealedMetrics(0);
    setView("scanning");
    setScan(null); setAnalysis(null); setScript(""); setFromCache(false);
    try {
      setScanStep(1);
      const scanResult = await invoke<SystemScan>("scan_system");
      setScan(scanResult); scanRef.current = scanResult;

      setScanStep(2);
      const resp = await invoke<AnalysisResponse>("analyze_system", {
        scanJson: JSON.stringify(scanResult),
      });
      const parsed = safeParseJSON<AnalysisResult>(resp.analysis_json);
      // Usar el delta de Claude anclado a nuestro score determinista — evita inversiones
      const claudeDelta = Math.max(0, parsed.score_optimizado - parsed.score_actual);
      parsed.score_actual = computeScore(scanResult);
      parsed.score_optimizado = Math.min(100, parsed.score_actual + claudeDelta);
      setAnalysis(parsed); setFromCache(resp.from_cache); setResponseMs(resp.response_time_ms);

      setScanStep(3);
      const selected = parsed.optimizaciones
        .filter((o) => o.aplicar)
        .map((o) => ({ titulo: o.titulo, descripcion: o.descripcion, comando_preview: o.comando_preview }));
      const scriptText = await invoke<string>("generate_script", {
        optimizationsJson: JSON.stringify(selected),
        scanJson: JSON.stringify(scanResult),
      });
      setScript(scriptText);
      setScanStep(4);
      await new Promise(r => setTimeout(r, 450));
      setView("results");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "DEMO_LIMIT_REACHED") {
        setShowDemoModal(true); setView("idle"); return;
      }
      setError(msg); setView("idle");
    }
    invoke<number>("get_demo_count").then(setDemoCount).catch(() => {});
    invoke<boolean>("get_license_status").then(setIsLicensed).catch(() => {});
  };

  const handleApply = async () => {
    if (!scanRef.current) return;
    setView("applying");
    try {
      const output = await invoke<string>("execute_script", {
        scriptContent: script,
        scanJson: JSON.stringify(scanRef.current),
      });
      setApplyLog(output || "Script ejecutado correctamente.");
      if (analysis && scanRef.current) {
        const postScan = await invoke<SystemScan>("scan_system").catch(() => scanRef.current!);
        const sess: Session = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          score_before: analysis.score_actual,
          score_after: computeScore(postScan),
          optimizations_applied: analysis.optimizaciones.filter((o) => o.aplicar).map((o) => o.titulo),
          scan_summary: `gov:${postScan.cpu_governor} swap:${postScan.swappiness} dirty:${postScan.dirty_ratio}%`,
        };
        await invoke("save_session", { session: sess }).catch(() => {});
        const updated = await invoke<Session[]>("get_sessions").catch(() => sessions);
        setSessions(updated);
        const rb = await invoke<RollbackInfo[]>("list_rollbacks").catch(() => rollbacks);
        setRollbacks(rb);
      }
      setView("done"); setShowReboot(true);
      localStorage.setItem("dix_needs_reboot", "1");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setView("results");
    }
  };

  const handleRollback = async (filename: string) => {
    setRollingBack(true); setError(null);
    try {
      await invoke("execute_rollback", { filename });
      alert("Rollback completado. El sistema ha vuelto al estado previo.");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setRollingBack(false); }
  };

  const handleDownload = () => {
    const blob = new Blob([script], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "dix_boost.sh"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleInstallUpdate = async () => {
    if (!pendingUpdate) return;
    setUpdateState("downloading"); setUpdateProgress(0);
    try {
      await pendingUpdate.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data.contentLength) {
          setUpdateTotal(event.data.contentLength);
        } else if (event.event === "Progress") {
          setUpdateProgress((p) => p + (event.data.chunkLength ?? 0));
        } else if (event.event === "Finished") {
          setUpdateState("done");
        }
      });
      setUpdateState("done");
      await relaunch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setUpdateState("idle"); setShowUpdateModal(false);
    }
  };

  const handleActivateLicense = async () => {
    setActivatingLicense(true); setError(null);
    try {
      await invoke("activate_license", { key: licenseInput.trim() });
      setIsLicensed(true); setLicenseInput("");
      setShowDemoModal(false); setView("idle");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setActivatingLicense(false); }
  };

  const handleReset = () => {
    setView("idle"); setAnalysis(null); setScript(""); setScan(null);
    setApplyLog(""); setError(null); setScriptVisible(false);
    setShowReboot(false); setFromCache(false); setScanStep(0);
    setRevealedMetrics(0); scanRef.current = null;
  };

  const handleReboot = async () => {
    try {
      await invoke("reboot_system");
      setShowReboot(false);
      localStorage.removeItem("dix_needs_reboot");
    }
    catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const aplicadas = analysis?.optimizaciones.filter((o) => o.aplicar) ?? [];
  const saltadas  = analysis?.optimizaciones.filter((o) => !o.aplicar) ?? [];
  const mejora    = analysis ? analysis.score_optimizado - analysis.score_actual : 0;

  const isProcessView = view === "scanning" || view === "applying" || view === "done";

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.bg}; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${C.card}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        .card { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 12px; }
        .btn-primary {
          background: ${C.orange}; color: #fff; border: none; border-radius: 10px;
          padding: 12px 32px; font-size: 15px; font-weight: 700; cursor: pointer;
          letter-spacing: 0.3px;
        }
        .btn-primary:hover { background: ${C.orangeD}; }
        .btn-secondary {
          background: transparent; color: ${C.muted}; border: 1px solid ${C.border};
          border-radius: 8px; padding: 7px 16px; font-size: 13px; cursor: pointer;
        }
        .btn-secondary:hover { border-color: ${C.orange}; color: ${C.text}; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: `${C.bg}ee`, backdropFilter: "blur(8px)", zIndex: 100, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src={logoDs} alt="DixSystem" style={{ width: 28, height: 28, borderRadius: 4 }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.3px" }}>Dix</div>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.5px", textTransform: "uppercase" }}>La primera AppIA del Mundo</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {pendingUpdate && (
            <button onClick={() => setShowUpdateModal(true)}
              style={{ background: `${C.green}18`, color: C.green, border: `1px solid ${C.green}55`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
              ↑ v{pendingUpdate.version} disponible
            </button>
          )}
          {rollbacks.length > 0 && view === "idle" && (
            <button className="btn-secondary" onClick={() => setShowRollbacks(!showRollbacks)} style={{ fontSize: 12 }}>
              ↩ Rollbacks ({rollbacks.length})
            </button>
          )}
          <span style={{ fontSize: 11, color: C.border, padding: "2px 8px", border: `1px solid ${C.border}`, borderRadius: 4 }}>v1.0</span>
          {isLicensed ? (
            <span style={{ fontSize: 11, color: C.green, padding: "2px 8px", border: `1px solid ${C.green}55`, borderRadius: 4, fontWeight: 700, letterSpacing: "0.5px" }}>✓ PRO</span>
          ) : (
            <button className="btn-secondary" onClick={() => setView("activate")}
              style={{ fontSize: 11, color: C.orange, borderColor: `${C.orange}55`, fontWeight: 600 }}>
              {demoCount >= 1 ? "🔒 DEMO AGOTADO" : `🎁 DEMO (${1 - demoCount} gratis)`}
            </button>
          )}
        </div>
      </div>

      {/* ── Layout principal ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ════ VISTA DE PROCESO (scanning / applying / done) — layout split ════ */}
        {isProcessView && (
          <div className="fade-in" style={{ flex: 1, display: "flex", gap: 0, overflow: "hidden" }}>

            {/* Panel izquierdo — Análisis en tiempo real + valores del sistema */}
            <div style={{
              width: "44%",
              display: "flex",
              flexDirection: "column",
              background: "#0a0d12",
              borderRight: `1px solid ${C.border}`,
              flexShrink: 0,
              overflow: "hidden",
            }}>
              {/* Mitad superior: progreso del análisis */}
              <div style={{ flexShrink: 0 }}>
                <AnalysisProgress
                  scanStep={scanStep}
                  elapsed={elapsed}
                  fromCache={fromCache}
                  responseMs={responseMs}
                />
              </div>

              {/* Score antes/después cuando está en done */}
              {view === "done" && analysis && (
                <div style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "center", padding: "10px 14px", borderTop: `1px solid ${C.border}` }}>
                  <ScoreRing score={analysis.score_actual}     label="Antes" size={72} />
                  <div style={{ fontSize: 22, color: C.muted }}>→</div>
                  <ScoreRing score={analysis.score_optimizado} label="Ahora"  size={72} />
                </div>
              )}

              {/* Mitad inferior: valores del kernel en vivo — polling cada 1s */}
              <LiveOptimizingPanel active={isProcessView} />
            </div>

            {/* Panel derecho — análisis en tiempo real */}
            <div style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "16px 20px 16px 16px",
              gap: 12,
              overflow: "hidden",
            }}>
              {/* Pasos del proceso */}
              {view === "scanning" && <StepsPanel scanStep={scanStep} />}

              {/* Banner de completado */}
              {view === "done" && (
                <div style={{
                  padding: "12px 16px", borderRadius: 10, flexShrink: 0,
                  background: `${C.green}12`, border: `1px solid ${C.green}55`,
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  <span style={{ fontSize: 24, color: C.green }}>✓</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.green }}>OPTIMIZACIÓN COMPLETADA</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Parámetros del kernel aplicados correctamente.</div>
                  </div>
                </div>
              )}

              {/* Cabecera del panel de datos */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "7px 12px",
                background: "#010409",
                border: `1px solid ${C.border}`,
                borderRadius: "8px 8px 0 0",
                borderBottom: "none",
                flexShrink: 0,
              }}>
                <div style={{ display: "flex", gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f85149" }} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FFD700" }} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#00FF88" }} />
                </div>
                <span style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", marginLeft: 4 }}>
                  dix — análisis en vivo
                </span>
                {scan && (
                  <span style={{ marginLeft: "auto", fontSize: 10, color: C.green, fontFamily: "monospace" }}>
                    {revealedMetrics}/{Object.keys(scan).length} métricas
                  </span>
                )}
              </div>

              {/* Terminal de métricas */}
              <LiveTerminal
                scan={scan as Record<string, unknown> | null}
                revealedCount={revealedMetrics}
                analysisText={view === "scanning" && analysis ? analysis.analisis : undefined}
              />

              {/* Panel de log al aplicar */}
              {view === "applying" && (
                <div style={{ background: `${C.orange}0a`, border: `1px solid ${C.orange}44`, borderRadius: 8, padding: "12px 14px", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.orange }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.orange }}>Aplicando optimizaciones…</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
                    Dix está modificando parámetros del kernel con permisos de administrador.<br/>
                    <span style={{ color: C.text }}>Observa cómo cambian los indicadores de rojo a verde en tiempo real.</span>
                  </div>
                </div>
              )}

              {/* Acciones en done */}
              {view === "done" && (
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {applyLog && (
                    <pre style={{
                      background: "#010409", border: `1px solid ${C.green}33`,
                      borderRadius: 8, padding: "10px 14px", fontSize: 10, fontFamily: "monospace",
                      color: C.green, maxHeight: 120, overflowY: "auto", lineHeight: 1.7,
                    }}>
                      {applyLog}
                    </pre>
                  )}
                  {showReboot && (
                    <div className="card" style={{ padding: "12px 14px", border: `1px solid ${C.yellow}44` }}>
                      <p style={{ fontSize: 12, color: "#fbbf24", marginBottom: 10 }}>
                        ⚠️ Se recomienda reiniciar para aplicar todos los cambios.
                      </p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn-primary" onClick={handleReboot}
                          style={{ background: C.red, padding: "7px 18px", fontSize: 13 }}>
                          Reiniciar ahora
                        </button>
                        <button className="btn-secondary" onClick={() => { setShowReboot(false); localStorage.removeItem("dix_needs_reboot"); }} style={{ fontSize: 12 }}>Después</button>
                      </div>
                    </div>
                  )}
                  <button className="btn-primary" onClick={handleReset} style={{ alignSelf: "flex-start", padding: "9px 22px", fontSize: 13 }}>
                    Nuevo análisis
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════ VISTAS NORMALES (scroll) ════ */}
        {!isProcessView && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <div style={{ maxWidth: 820, margin: "0 auto", padding: "24px 20px 60px" }}>

              {/* Error banner */}
              {error && (
                <div style={{ background: "#2d0f0f", border: `1px solid ${C.red}44`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: C.red, fontSize: 13, display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span><strong>Error:</strong> {error}</span>
                  <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.red, fontSize: 16 }}>✕</button>
                </div>
              )}

              {/* ── INIT ── */}
              {view === "init" && (
                <div style={{ textAlign: "center", padding: "4rem", color: C.muted, fontSize: 14 }}>
                  <div style={{ fontSize: 28, display: "inline-block" }}>⚙</div>
                </div>
              )}

              {/* ── IDLE ── */}
              {view === "idle" && (
                <div className="fade-in">

                  {/* Banner de reinicio pendiente */}
                  {showReboot && (
                    <div style={{
                      marginBottom: 14, padding: "12px 16px", borderRadius: 10,
                      background: "#1a1208", border: `1px solid ${C.yellow}55`,
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 18 }}>⚠️</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>Reinicio pendiente</div>
                          <div style={{ fontSize: 11, color: C.muted }}>Algunas optimizaciones requieren reiniciar para aplicarse completamente.</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button className="btn-primary" onClick={handleReboot}
                          style={{ background: C.red, padding: "7px 16px", fontSize: 12 }}>
                          Reiniciar ahora
                        </button>
                        <button className="btn-secondary" onClick={() => { setShowReboot(false); localStorage.removeItem("dix_needs_reboot"); }} style={{ fontSize: 12 }}>
                          Ignorar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Rollbacks */}
                  {showRollbacks && rollbacks.length > 0 && (
                    <div className="card" style={{ marginBottom: 16, overflow: "hidden" }}>
                      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>↩ Rollbacks disponibles</span>
                        <button className="btn-secondary" onClick={() => setShowRollbacks(false)} style={{ fontSize: 11 }}>Cerrar</button>
                      </div>
                      {rollbacks.map((rb) => (
                        <div key={rb.filename} style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{rb.date_human}</div>
                            <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>{rb.filename}</div>
                          </div>
                          <button className="btn-secondary" onClick={() => handleRollback(rb.filename)} disabled={rollingBack} style={{ fontSize: 12, color: C.orange, borderColor: `${C.orange}55` }}>
                            {rollingBack ? "Restaurando…" : "Restaurar"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Hero card: score + CTA ── */}
                  <div className="card" style={{ marginBottom: 12, padding: "28px 28px 24px", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% -20%, ${C.orange}14 0%, transparent 65%)`, pointerEvents: "none" }} />

                    {/* Hardware en una sola línea */}
                    <div style={{ display: "flex", gap: 18, fontSize: 11, color: C.muted, fontFamily: "monospace", marginBottom: 24, flexWrap: "wrap" }}>
                      <span style={{ color: C.orange }}>⚙</span>
                      <span>{hwSummary?.cpu ?? "Detectando CPU…"}</span>
                      <span style={{ color: C.border }}>·</span>
                      <span>{hwSummary?.ram ?? "…"}</span>
                      <span style={{ color: C.border }}>·</span>
                      <span>{hwSummary?.distro ?? "Linux"}</span>
                      {idleScan && <><span style={{ color: C.border }}>·</span><span>kernel {idleScan.kernel_version}</span></>}
                    </div>

                    {/* Score rings o placeholder */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 40, marginBottom: 28 }}>
                      {sessions.length >= 2 ? (
                        <>
                          <ScoreRing score={sessions[1].score_after} label="Hace 2 sesiones" size={100} />
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                            <div style={{ fontSize: 22, color: C.border }}>→</div>
                            {(() => {
                              const delta = sessions[0].score_after - sessions[1].score_after;
                              return (
                                <div style={{ fontSize: 11, fontWeight: 700, color: delta >= 0 ? C.green : C.red }}>
                                  {delta >= 0 ? `+${delta}` : delta} pts
                                </div>
                              );
                            })()}
                          </div>
                          <ScoreRing score={sessions[0].score_after} label="Última sesión" size={120} />
                        </>
                      ) : sessions.length === 1 ? (
                        <>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 44, color: C.border, fontWeight: 800, lineHeight: 1 }}>—</div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Antes de Dix</div>
                          </div>
                          <div style={{ fontSize: 22, color: C.border }}>→</div>
                          <ScoreRing score={sessions[0].score_after} label="Tras optimizar" size={120} />
                        </>
                      ) : (
                        <div style={{ textAlign: "center", padding: "8px 0" }}>
                          <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto" }}>
                            <svg width={120} height={120} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
                              <circle cx={60} cy={60} r={52} fill="none" stroke={C.border} strokeWidth={7} />
                              <circle cx={60} cy={60} r={52} fill="none" stroke={C.border} strokeWidth={7}
                                strokeDasharray="0 327" strokeLinecap="round" />
                            </svg>
                            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ fontSize: 36, color: C.border, fontWeight: 800, lineHeight: 1 }}>?</span>
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: C.border, marginTop: 10 }}>Analiza para ver tu puntuación real</div>
                        </div>
                      )}
                    </div>

                    {/* CTA */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <button className="btn-primary" onClick={handleStart} style={{ padding: "13px 48px", fontSize: 15 }}>
                        ⚡ ANALIZAR Y OPTIMIZAR
                      </button>
                      <div style={{ fontSize: 11, color: C.border }}>
                        22 métricas del kernel · Claude AI · Script personalizado
                      </div>
                    </div>
                  </div>

                  {/* ── Historial ── */}
                  {sessions.length > 0 && (
                    <div className="card" style={{ overflow: "hidden" }}>
                      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px" }}>
                          Historial · PC quedó en {sessions[0].score_after}/100 tras la última sesión
                        </span>
                        <button onClick={() => invoke("clear_sessions").then(() => setSessions([])).catch(() => {})}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: C.muted }}>
                          Limpiar
                        </button>
                      </div>
                      {sessions.slice(0, 5).map((s, i) => {
                        const delta = s.score_after - s.score_before;
                        return (
                          <div key={s.id} style={{ padding: "10px 16px", borderBottom: i < Math.min(sessions.length, 5) - 1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 500 }}>{fmtDate(s.timestamp)}</div>
                              <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", marginTop: 2 }}>{s.scan_summary}</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>
                                  <span style={{ color: scoreColor(s.score_before) }}>{s.score_before}</span>
                                  <span style={{ color: C.border, margin: "0 5px" }}>→</span>
                                  <span style={{ color: scoreColor(s.score_after) }}>{s.score_after}</span>
                                </div>
                                <div style={{ fontSize: 10, color: C.muted }}>{s.optimizations_applied.length} opts</div>
                              </div>
                              <div style={{
                                minWidth: 44, textAlign: "center",
                                background: delta > 0 ? `${C.green}15` : `${C.red}15`,
                                border: `1px solid ${delta > 0 ? C.green : C.red}33`,
                                borderRadius: 6, padding: "3px 8px",
                                fontSize: 12, fontWeight: 800,
                                color: delta > 0 ? C.green : C.red,
                              }}>
                                {delta > 0 ? `+${delta}` : delta}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── RESULTS — sistema ya óptimo ── */}
              {view === "results" && analysis && aplicadas.length === 0 && (
                <div className="fade-in">
                  <div className="card" style={{ padding: "48px 32px", textAlign: "center", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 0%, ${C.green}12 0%, transparent 65%)`, pointerEvents: "none" }} />
                    <div style={{ marginBottom: 28, display: "flex", justifyContent: "center" }}>
                      <ScoreRing score={analysis.score_actual} label="Score actual" size={130} />
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.green, marginBottom: 10, letterSpacing: "-0.3px" }}>
                      Tu sistema está al máximo rendimiento
                    </div>
                    <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, maxWidth: 420, margin: "0 auto 24px" }}>
                      Dix ha analizado {Object.keys(scan ?? {}).length} parámetros del kernel y determina que tu sistema ya está optimizado. No hay cambios necesarios en este momento.
                    </p>
                    {analysis.analisis && (
                      <div style={{ background: `${C.green}08`, border: `1px solid ${C.green}22`, borderRadius: 10, padding: "14px 18px", maxWidth: 480, margin: "0 auto 24px", textAlign: "left" }}>
                        <div style={{ fontSize: 10, color: C.green, letterSpacing: "1px", marginBottom: 6 }}>● DIAGNÓSTICO CLAUDE AI</div>
                        <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.65 }}>{analysis.analisis}</p>
                      </div>
                    )}
                    {saltadas.length > 0 && (
                      <div style={{ fontSize: 11, color: C.border, marginBottom: 20 }}>
                        {saltadas.length} optimizaciones descartadas por política de seguridad
                      </div>
                    )}
                    <button className="btn-primary" onClick={handleReset} style={{ padding: "11px 32px" }}>
                      Volver al inicio
                    </button>
                  </div>
                </div>
              )}

              {/* ── RESULTS — con optimizaciones ── */}
              {view === "results" && analysis && aplicadas.length > 0 && (
                <div className="fade-in">
                  <div className="card" style={{ padding: "24px 28px", marginBottom: 16, display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 100% 50%, ${C.green}08 0%, transparent 60%)`, pointerEvents: "none" }} />
                    <img src={dixIdle} alt="DIX" style={{ width: 90, height: 90, objectFit: "contain", filter: "drop-shadow(0 0 16px #00FF8844)" }} />
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                      <ScoreRing score={analysis.score_actual}    label="Actual"     size={100} />
                      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                        <div style={{ fontSize: 28, color: C.muted }}>→</div>
                      </div>
                      <ScoreRing score={analysis.score_optimizado} label="Optimizado" size={100} />
                      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 4, minWidth: 80 }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: C.green }}>+<AnimatedCounter target={mejora} /></div>
                        <div style={{ fontSize: 11, color: C.muted }}>puntos</div>
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      {fromCache && (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: `${C.yellow}15`, border: `1px solid ${C.yellow}44`, borderRadius: 6, padding: "3px 10px", fontSize: 11, color: C.yellow, marginBottom: 10 }}>
                          ⚡ Desde caché · instantáneo
                        </div>
                      )}
                      {!fromCache && responseMs > 0 && (
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>⏱ Análisis IA en {(responseMs / 1000).toFixed(1)}s</div>
                      )}
                      <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.65 }}>{analysis.analisis}</p>
                    </div>
                  </div>

                  {scan && (
                    <details className="card" style={{ marginBottom: 16, overflow: "hidden" }}>
                      <summary style={{ padding: "11px 16px", cursor: "pointer", fontSize: 12, color: C.muted, userSelect: "none" }}>
                        Ver métricas del sistema ({Object.keys(scan).length} parámetros)
                      </summary>
                      <div style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 11, lineHeight: 1.85, borderTop: `1px solid ${C.border}` }}>
                        {Object.entries(scan).map(([k, v]) => (
                          <div key={k}><span style={{ color: C.orange }}>{k}:</span> <span style={{ color: C.muted }}>{String(v)}</span></div>
                        ))}
                      </div>
                    </details>
                  )}

                  <h3 style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>✅ A aplicar ({aplicadas.length})</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                    {aplicadas.map((o) => {
                      const cat = CAT[o.categoria] ?? CAT.Sistema;
                      return (
                        <div key={o.id} className="card" style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", gap: 12 }}>
                            <span style={{ background: cat.bg, color: cat.color, borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700, flexShrink: 0, height: "fit-content" }}>{o.categoria}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{o.titulo}</div>
                              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, lineHeight: 1.5 }}>{o.descripcion}</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 11, marginBottom: 8 }}>
                                <span style={{ background: `${C.green}18`, color: C.green, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>{o.mejora_estimada}</span>
                                <span style={{ color: C.muted }}>⏱ {o.tiempo_estimado}</span>
                                <span style={{ color: o.riesgo === "bajo" ? C.green : o.riesgo === "medio" ? C.yellow : C.red }}>riesgo {o.riesgo}</span>
                              </div>
                              {o.comando_preview && (
                                <div style={{ background: "#010409", color: "#7dd3fc", fontFamily: "monospace", fontSize: 11, padding: "5px 10px", borderRadius: 6, border: `1px solid ${C.border}` }}>
                                  $ {o.comando_preview}
                                </div>
                              )}
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                                <div style={{ flex: 1, height: 3, background: C.border, borderRadius: 2 }}>
                                  <div style={{ height: "100%", width: `${o.impacto}%`, background: cat.color, borderRadius: 2 }} />
                                </div>
                                <span style={{ fontSize: 11, color: C.muted, minWidth: 28, textAlign: "right" }}>{o.impacto}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {saltadas.length > 0 && (
                    <>
                      <h3 style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>⏭ Descartadas ({saltadas.length})</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 20, opacity: 0.45 }}>
                        {saltadas.map((o) => (
                          <div key={o.id} className="card" style={{ padding: "8px 14px", fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                            <span>{o.titulo}</span>
                            <span style={{ color: C.muted, fontSize: 12 }}>{o.mejora_estimada} · riesgo {o.riesgo}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <div className="card" style={{ overflow: "hidden", marginBottom: 12 }}>
                    <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: scriptVisible ? `1px solid ${C.border}` : "none" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>Script bash generado</div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 2, fontFamily: "monospace" }}>sudo bash dix_boost.sh</div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn-secondary" onClick={() => setScriptVisible(!scriptVisible)} style={{ fontSize: 11 }}>{scriptVisible ? "Ocultar" : "Ver"}</button>
                        <button className="btn-secondary" onClick={handleDownload} style={{ fontSize: 11 }}>⬇ Descargar</button>
                        <button className="btn-primary" onClick={handleApply} style={{ padding: "7px 20px", fontSize: 13,  }}>▶ Aplicar</button>
                      </div>
                    </div>
                    {scriptVisible && (
                      <pre style={{ background: "#010409", color: "#94a3b8", fontFamily: "monospace", fontSize: 11, padding: "14px 16px", margin: 0, overflowX: "auto", maxHeight: 300, overflowY: "auto", lineHeight: 1.7 }}>
                        {script}
                      </pre>
                    )}
                  </div>

                  <div style={{ background: "#1a1208", border: `1px solid ${C.yellow}33`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#fbbf24", marginBottom: 14 }}>
                    ⚠️ Se abrirá el diálogo de autenticación GNOME. El script requiere privilegios root. Se guardará un rollback automáticamente.
                  </div>
                  <button className="btn-secondary" onClick={handleReset}>← Nuevo análisis</button>
                </div>
              )}

              {/* ── ACTIVATE ── */}
              {view === "activate" && (
                <div className="card fade-in" style={{ padding: "2.5rem 2rem", textAlign: "center", maxWidth: 480, margin: "40px auto" }}>
                  <div style={{ fontSize: 36, marginBottom: 16 }}>🔑</div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Activar Dix</h2>
                  <p style={{ color: C.muted, fontSize: 13, marginBottom: 8, lineHeight: 1.6 }}>Introduce tu clave de licencia para desbloquear análisis ilimitados.</p>
                  <p style={{ fontSize: 12, color: C.muted, marginBottom: 24 }}>
                    ¿No tienes licencia?{" "}
                    <span style={{ color: C.orange, cursor: "pointer", textDecoration: "underline" }} onClick={() => window.open("https://dixsystem.com/comprar", "_blank")}>
                      Comprar por 14,99€ →
                    </span>
                  </p>
                  <input
                    type="text" value={licenseInput}
                    onChange={(e) => setLicenseInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !activatingLicense && licenseInput.trim() && handleActivateLicense()}
                    placeholder="XXXX-XXXX-XXXX-XXXX" autoFocus
                    style={{ display: "block", width: "100%", padding: "11px 14px", fontSize: 14, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, outline: "none", marginBottom: 14, fontFamily: "monospace", textAlign: "center", letterSpacing: "2px" }}
                  />
                  {error && <p style={{ color: C.red, fontSize: 12, marginBottom: 12 }}>{error}</p>}
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    <button className="btn-primary" onClick={handleActivateLicense} disabled={activatingLicense || !licenseInput.trim()} style={{ opacity: activatingLicense || !licenseInput.trim() ? 0.5 : 1,  }}>
                      {activatingLicense ? "Verificando…" : "Activar"}
                    </button>
                    <button className="btn-secondary" onClick={() => { setError(null); setView("idle"); }}>Cancelar</button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>

      {/* ── Modal de actualización ── */}
      {showUpdateModal && pendingUpdate && (
        <div style={{ position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 }}>
          <div className="card fade-in" style={{ padding: "2rem", textAlign: "center", maxWidth: 420, width: "100%", border: `1px solid ${C.green}44` }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🚀</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Dix {pendingUpdate.version}</h2>
            {pendingUpdate.body && (
              <p style={{ color: C.muted, fontSize: 13, marginBottom: 20, lineHeight: 1.6, textAlign: "left", background: C.bg, borderRadius: 8, padding: "10px 14px", maxHeight: 140, overflowY: "auto" }}>
                {pendingUpdate.body}
              </p>
            )}
            {updateState === "downloading" && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ height: 6, background: C.border, borderRadius: 3, marginBottom: 8, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 3, background: C.green, width: updateTotal > 0 ? `${Math.round((updateProgress / updateTotal) * 100)}%` : "0%",  }} />
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>
                  {updateTotal > 0 ? `${(updateProgress / 1024 / 1024).toFixed(1)} / ${(updateTotal / 1024 / 1024).toFixed(1)} MB` : "Descargando…"}
                </div>
              </div>
            )}
            {updateState === "done" && <p style={{ color: C.green, fontSize: 13, marginBottom: 16 }}>✓ Instalado — reiniciando…</p>}
            {updateState === "idle" && (
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button className="btn-primary" onClick={handleInstallUpdate} style={{ padding: "10px 24px",  }}>Descargar e instalar</button>
                <button className="btn-secondary" onClick={() => setShowUpdateModal(false)}>Después</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal demo agotado ── */}
      {showDemoModal && (
        <div style={{ position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 }}>
          <div className="card fade-in" style={{ padding: "2.5rem 2rem", textAlign: "center", maxWidth: 440, width: "100%", border: `1px solid ${C.orange}44` }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚀</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Has agotado el análisis gratuito</h2>
            <p style={{ color: C.muted, fontSize: 14, marginBottom: 24, lineHeight: 1.7 }}>
              Ya realizaste tu análisis de demo. Con Dix tienes análisis ilimitados, caché inteligente y actualizaciones de por vida.
            </p>
            <div className="card" style={{ padding: "16px", marginBottom: 20, background: "#0f1a0f", border: `1px solid ${C.green}33` }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.green, marginBottom: 4 }}>14,99€</div>
              <div style={{ fontSize: 12, color: C.muted }}>pago único · sin suscripción · actualizaciones incluidas</div>
            </div>
            <button className="btn-primary" onClick={() => window.open("https://dixsystem.com/comprar", "_blank")} style={{ width: "100%", marginBottom: 10, padding: "13px" }}>
              Comprar Dix →
            </button>
            <button className="btn-secondary" onClick={() => { setShowDemoModal(false); setView("activate"); }} style={{ width: "100%", marginBottom: 8 }}>
              Ya tengo una clave — Activar licencia
            </button>
            <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: C.muted }} onClick={() => setShowDemoModal(false)}>Cerrar</button>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: "10px 24px", textAlign: "center", fontSize: 11, color: C.border, flexShrink: 0 }}>
        DixSystem · Dix v1.0 · <span style={{ color: C.orange }}>La primera AppIA del Mundo</span>
      </div>
    </div>
  );
}
