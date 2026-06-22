// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.

export interface SystemScan {
  cpu_governor: string; cpu_cores: number; swappiness: number;
  dirty_ratio: number; dirty_background_ratio: number; disk_scheduler: string;
  audio_server: string; hugepages: string; numa_balancing: string;
  mem_total_mb: number; mem_available_mb: number; load_avg: string;
  nvme_queue_depth: string; irqbalance_active: boolean; on_battery: boolean;
  cpu_min_freq_mhz: number; cpu_max_freq_mhz: number;
  cpu_model: string; gpu_model: string; distro_id: string;
  distro_version: string; kernel_version: string;
  cpu_temp_celsius: number;
}

export interface Optimization {
  id: string; categoria: string; titulo: string; descripcion: string;
  impacto: number; riesgo: string; mejora_estimada: string;
  aplicar: boolean; comando_preview: string; tiempo_estimado: string;
}

export interface AnalysisResult {
  analisis: string; score_actual: number; score_optimizado: number;
  optimizaciones: Optimization[];
}

export interface AnalysisResponse {
  analysis_json: string; from_cache: boolean; response_time_ms: number;
}

export interface Session {
  id: string; timestamp: string; score_before: number;
  score_after: number; optimizations_applied: string[]; scan_summary: string;
}

export interface RollbackInfo { filename: string; timestamp: number; date_human: string; }

export interface StartupItem {
  id: string; name: string; command: string; location: string;
  trust: "Orphan" | "Safe" | "Review" | "NeverTouch";
  enabled: boolean; exists_on_disk: boolean;
}

export type View = "init" | "idle" | "scanning" | "results" | "applying" | "done" | "activate";

export interface LiveMetrics {
  governor: string; swappiness: number; dirty_ratio: number; dirty_bg: number;
  hugepages: string; mem_free_mb: number; mem_total_mb: number;
  load_1: number; load_5: number; nr_requests: number;
  cpu_freq_mhz: number; cpu_max_mhz: number;
  cpu_temp_celsius: number; cpu_avg_freq_mhz: number; cpu_cores: number;
}

export interface BenchmarkResult {
  cpu_events_per_sec: number;
  ram_mb_per_sec: number;
  disk_iops: number;
  measured: boolean;
  missing_tools: string[];
}

export interface LostOpt {
  key: string;
  label: string;
  expected: string;
  current: string;
}

export type Profile = "gaming" | "streaming" | "dev" | "server" | "balanced";

export interface CacheStats {
  hit_count: number;
  miss_count: number;
  hit_rate: number;
  last_analysis_timestamp: number | null;
  hardware_id: string;
  last_acp: string | null;
  pinned_params: Record<string, string>;
}

// ─── DixKontrol (ver docs/threat-model/dixkontrol.md) ──────────────────────

export interface ForegroundContext {
  app_name: string | null;
  supported: boolean;
}

/** Espejo de `command_engine::DixOperation` en Rust — el tag "tipo" y los
 *  nombres de variante en snake_case vienen de `#[serde(tag = "tipo",
 *  rename_all = "snake_case")]`. Solo el subconjunto permitido en el nivel
 *  Moderado (ver dixkontrol.rs::moderate::moderate_allows). */
export type DixOperation =
  | { tipo: "set_sysctl"; clave: string; valor: string }
  | { tipo: "set_disk_scheduler"; scheduler: string }
  | { tipo: "set_nr_requests"; valor: number }
  | { tipo: "enable_service"; nombre: string }
  | { tipo: "disable_service"; nombre: string };
