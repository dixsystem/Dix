// SPDX-License-Identifier: AGPL-3.0-only
// Copyright © 2026 DixSystem

import type { Profile, LiveMetrics } from "./types/dix";

export const PROFILES: { id: Profile; icon: string; label: string; hint: string; labelKey: string; hintKey: string }[] = [
  { id: "gaming",    icon: "🎮", label: "Gaming",     hint: "FPS máximos, latencia mínima",      labelKey: "profile_gaming_label",    hintKey: "profile_gaming_hint" },
  { id: "streaming", icon: "📡", label: "Streaming",  hint: "Red estable, encoding sin drops",    labelKey: "profile_streaming_label", hintKey: "profile_streaming_hint" },
  { id: "dev",       icon: "💻", label: "Desarrollo", hint: "Compilación rápida, I/O rápido",     labelKey: "profile_dev_label",       hintKey: "profile_dev_hint" },
  { id: "server",    icon: "🖥️", label: "Servidor",   hint: "Throughput máximo, uptime",          labelKey: "profile_server_label",    hintKey: "profile_server_hint" },
  { id: "balanced",  icon: "⚖️", label: "Equilibrado", hint: "Balance general",                   labelKey: "profile_balanced_label",  hintKey: "profile_balanced_hint" },
];

export const C = {
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

export const CAT: Record<string, { bg: string; color: string }> = {
  CPU:     { bg: "#1a1040", color: "#a78bfa" },
  RAM:     { bg: "#0d1f3c", color: "#60a5fa" },
  Storage: { bg: "#1f1208", color: "#fb923c" },
  Red:     { bg: "#1f0e1a", color: "#f472b6" },
  Sistema: { bg: "#111827", color: "#94a3b8" },
};

export interface MetricDef {
  id: string;
  label: string;
  sublabel: string;
  value: (m: LiveMetrics) => string;
  pct: (m: LiveMetrics) => number;
  status: (m: LiveMetrics) => "red" | "yellow" | "green";
}

export const METRIC_DEFS: MetricDef[] = [
  {
    id: "governor",
    label: "Velocidad CPU",
    sublabel: "governor / plan de energía",
    value: (m) => {
      const g = m.governor;
      if (g === "performance" || g === "high-performance" || g === "ultimate-performance") return "Máximo rendimiento";
      if (g === "schedutil") return "Adaptativo (bueno)";
      if (g === "balanced") return "Balanceado";
      if (g === "powersave") return "Ahorro energético";
      if (g === "ondemand") return "Bajo demanda";
      return g;
    },
    pct: (m) => {
      const g = m.governor;
      if (g === "performance" || g === "high-performance" || g === "ultimate-performance") return 100;
      if (g === "schedutil" || g === "balanced") return 80;
      if (g === "ondemand") return 50;
      return 20;
    },
    status: (m) => {
      const g = m.governor;
      if (g === "performance" || g === "high-performance" || g === "ultimate-performance" || g === "schedutil") return "green";
      if (g === "ondemand" || g === "balanced") return "yellow";
      return "red";
    },
  },
  {
    id: "freq",
    label: "Frecuencia del procesador",
    sublabel: "media de todos los cores en tiempo real",
    value: (m) => {
      const isOptimal = m.governor === "performance" || m.governor === "schedutil" || m.governor === "high-performance" || m.governor === "ultimate-performance";
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
      if (m.governor === "performance" || m.governor === "schedutil" || m.governor === "high-performance" || m.governor === "ultimate-performance") return "green";
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

export const STATUS_COLOR = { red: C.red, yellow: C.yellow, green: C.green };
export const STATUS_LABEL = { red: "SIN OPTIMIZAR", yellow: "MEJORANDO", green: "ÓPTIMO" };
