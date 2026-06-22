// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.

import { C } from "../constants";
import type { SystemScan, BenchmarkResult, Optimization } from "../types/dix";

export function safeParseJSON<T>(text: string): T {
  try { return JSON.parse(text) as T; } catch { /**/ }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]) as T; } catch { /**/ } }
  throw new Error(`No se pudo parsear: ${text.slice(0, 200)}`);
}

export function scoreColor(s: number) {
  return s >= 80 ? C.green : s >= 55 ? C.yellow : C.red;
}

// Techo físico de hardware — incluso con ajustes perfectos no se puede superar
export function hardwareCeiling(scan: SystemScan): number {
  const model = (scan.cpu_model ?? "").toLowerCase();
  const freq   = scan.cpu_max_freq_mhz  ?? 0;
  const ram    = scan.mem_total_mb      ?? 0;
  const cores  = scan.cpu_cores         ?? 1;

  let ceiling = 95;

  // Clase de CPU (línea de producto)
  if (model.includes("celeron") || model.includes("pentium") || model.includes("atom"))
    ceiling -= 12;
  else if (model.includes("i3") || model.includes("ryzen 3") || /\ba[46]-/.test(model))
    ceiling -= 8;
  else if (model.includes("i5") || model.includes("ryzen 5"))
    ceiling -= 3;
  // i7/i9/Ryzen 7/9/Xeon/EPYC → sin penalización de clase

  // Frecuencia boost máxima
  if      (freq < 2500) ceiling -= 7;
  else if (freq < 3200) ceiling -= 4;
  else if (freq < 3800) ceiling -= 2;

  // RAM instalada
  if      (ram < 4096)  ceiling -= 8;
  else if (ram < 8192)  ceiling -= 5;
  else if (ram < 16384) ceiling -= 2;

  // Hilos lógicos disponibles
  if      (cores < 4) ceiling -= 5;
  else if (cores < 8) ceiling -= 2;

  return Math.max(70, Math.min(95, ceiling));
}

// Score determinista basado en métricas reales — evita inconsistencias entre sesiones
export function computeScore(scan: SystemScan): number {
  const ceiling = hardwareCeiling(scan);
  let score = ceiling;
  const isWin = scan.distro_id === "windows";

  if (isWin) {
    // Plan de energía (cpu_governor en Windows)
    if (scan.cpu_governor === "balanced") score -= 8;
    else if (scan.cpu_governor === "powersave") score -= 15;
    if (scan.on_battery) score -= 5;
    // TCP Nagle: dirty_ratio==20 → Nagle activo (peor latencia gaming/streaming)
    if (scan.dirty_ratio === 20) score -= 5;
    // Large Pages no habilitadas
    if (scan.hugepages !== "always") score -= 5;
  } else {
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
  }

  if (scan.cpu_temp_celsius > 85)      score -= 10;
  else if (scan.cpu_temp_celsius > 75) score -= 5;
  return Math.max(30, Math.min(ceiling, score));
}

// Parámetros kernel 25% del score — la semántica de los campos cambia según
// el SO (en Windows, dirty_ratio/numa_balancing se reutilizan como proxies de
// Nagle/estado AC, no son lo que dicen sus nombres). Extraído como función
// propia para poder usarlo también al proyectar el "objetivo" antes de
// aplicar — así la proyección sale del mismo margen real medible que luego
// usa el "verificado", en vez de la promesa libre de la IA.
// La IA decide qué optimizaciones sugerir, pero no ejecuta nada sin
// confirmación granular del usuario: las de riesgo medio/alto solo se marcan
// como seleccionadas si el usuario las activa explícitamente en la pantalla
// de resultados (ver selectedOpts). Las de riesgo bajo siguen el criterio de
// la IA por defecto para no añadir fricción donde el riesgo real es mínimo.
export function defaultSelected(o: Optimization): boolean {
  return o.riesgo === "bajo" && o.aplicar;
}

export const KERNEL_SCORE_MAX = 25;
export function kernelScoreFromScan(scan: SystemScan): number {
  let kernelScore = 0;
  const gov = scan.cpu_governor;
  const isWinBench = scan.distro_id === "windows";
  if (isWinBench) {
    // numa_balancing e irqbalance_active están hardcodeados en el scanner de
    // Windows (no reflejan nada real ahí) — solo se usan las señales que sí
    // varían de verdad: plan de energía, Nagle (proxy en dirty_ratio) y
    // Large Pages (proxy en hugepages).
    if (gov === "high-performance" || gov === "ultimate-performance") kernelScore += 13;
    else if (gov === "balanced") kernelScore += 5;
    if (scan.dirty_ratio !== 20) kernelScore += 7; // Nagle desactivado
    if (scan.hugepages === "always") kernelScore += 5; // Large Pages habilitadas
  } else {
    if (gov === "performance" || gov === "schedutil") kernelScore += 8;
    else if (gov === "ondemand") kernelScore += 5;
    if (scan.swappiness <= 20) kernelScore += 5;
    else if (scan.swappiness <= 40) kernelScore += 3;
    if (scan.hugepages !== "never") kernelScore += 5;
    if (scan.numa_balancing !== "0") kernelScore += 3;
    if (scan.dirty_ratio <= 15) kernelScore += 4;
  }
  return kernelScore;
}

// Score calculado desde benchmarks reales (componentes ponderados)
export function computeScoreFromBenchmarks(scan: SystemScan, bench: BenchmarkResult): number {
  if (!bench.measured || (bench.cpu_events_per_sec === 0 && bench.ram_mb_per_sec === 0 && bench.disk_iops === 0)) {
    return computeScore(scan);
  }
  const ceiling = hardwareCeiling(scan);

  // CPU 30% — baseline ~750 eventos/s por core a rendimiento normal
  const cpuMax = scan.cpu_cores * 750;
  const cpuScore = Math.min(bench.cpu_events_per_sec / cpuMax, 1.0) * 30;

  // RAM 20% — DDR4-3200 práctico ~22 GB/s
  const ramScore = Math.min(bench.ram_mb_per_sec / 22000, 1.0) * 20;

  // Disco 25% — NVMe Gen3 bueno ~280K IOPS
  const diskScore = Math.min(bench.disk_iops / 280000, 1.0) * 25;

  const kernelScore = kernelScoreFromScan(scan);

  const total = cpuScore + ramScore + diskScore + kernelScore;
  return Math.max(30, Math.min(ceiling, Math.round(total)));
}

// run_benchmarks_partial solo re-mide las categorías afectadas; las demás
// vuelven a 0 en la respuesta. Sin esto, fusionar el resultado a pelo
// "borraría" los números reales de las categorías no tocadas.
export function mergeBenchmarks(old: BenchmarkResult | null, fresh: BenchmarkResult, affectedCats: string[]): BenchmarkResult {
  const base: BenchmarkResult = old ?? { cpu_events_per_sec: 0, ram_mb_per_sec: 0, disk_iops: 0, measured: false, missing_tools: [] };
  return {
    cpu_events_per_sec: affectedCats.includes("CPU")     ? fresh.cpu_events_per_sec : base.cpu_events_per_sec,
    ram_mb_per_sec:     affectedCats.includes("RAM")      ? fresh.ram_mb_per_sec     : base.ram_mb_per_sec,
    disk_iops:          affectedCats.includes("Storage")  ? fresh.disk_iops          : base.disk_iops,
    measured: fresh.measured || base.measured,
    missing_tools: fresh.missing_tools.length > 0 ? fresh.missing_tools : base.missing_tools,
  };
}

export function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("es", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}
