// SPDX-License-Identifier: AGPL-3.0-only
// Copyright © 2026 DixSystem

use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct BenchmarkResult {
    pub cpu_events_per_sec: f64,
    pub ram_mb_per_sec:     f64,
    pub disk_iops:          f64,
    pub measured:           bool,
    pub missing_tools:      Vec<String>,
}

// Categorías soportadas: "CPU", "RAM", "Storage"
pub async fn run_all(cpu_cores: usize) -> BenchmarkResult {
    run_partial(cpu_cores, true, true, true).await
}

pub async fn run_for_categories(cpu_cores: usize, categories: &[String]) -> BenchmarkResult {
    let want_cpu     = categories.iter().any(|c| c == "CPU");
    let want_ram     = categories.iter().any(|c| c == "RAM");
    let want_storage = categories.iter().any(|c| c == "Storage");
    run_partial(cpu_cores, want_cpu, want_ram, want_storage).await
}

#[cfg(not(target_os = "windows"))]
async fn run_partial(
    cores: usize,
    want_cpu: bool,
    want_ram: bool,
    want_disk: bool,
) -> BenchmarkResult {
    let sysbench = tool_ok("sysbench");
    let fio      = tool_ok("fio");

    let mut missing = Vec::new();
    if !sysbench && (want_cpu || want_ram) { missing.push("sysbench".to_string()); }
    if !fio      && want_disk             { missing.push("fio".to_string()); }

    let do_cpu  = want_cpu  && sysbench;
    let do_ram  = want_ram  && sysbench;
    let do_disk = want_disk && fio;

    // Secuencial (CPU → RAM → disco) — cada categoría mide su recurso sin
    // interferencia de las demás, a costa de tiempo total (~17s vs ~8-10s
    // en paralelo). Prioriza reproducibilidad: el resultado se muestra al
    // usuario como "MEDIDO, no es una estimación".
    let cpu_r  = tokio::task::spawn_blocking(move || if do_cpu  { bench_cpu(cores) } else { 0.0 }).await;
    let ram_r  = tokio::task::spawn_blocking(move || if do_ram  { bench_ram()      } else { 0.0 }).await;
    let disk_r = tokio::task::spawn_blocking(move || if do_disk { bench_disk()     } else { 0.0 }).await;

    let any_ran = do_cpu || do_ram || do_disk;
    BenchmarkResult {
        cpu_events_per_sec: cpu_r.unwrap_or(0.0),
        ram_mb_per_sec:     ram_r.unwrap_or(0.0),
        disk_iops:          disk_r.unwrap_or(0.0),
        measured:           missing.is_empty() && any_ran,
        missing_tools:      missing,
    }
}

// ─── Windows: micro-benchmarks nativos ─────────────────────────────────────
// sysbench/fio no vienen instalados en Windows y no tiene sentido obligar al
// usuario a instalarlos. En vez de devolver un resultado vacío (como hacía
// antes), medimos con Rust puro — sin dependencias externas, mismo método en
// cualquier Windows. Los números no son comparables 1:1 con sysbench/fio,
// pero son reales y consistentes entre el "antes" y el "después" de aplicar
// optimizaciones, que es lo único que importa para el score.
#[cfg(target_os = "windows")]
async fn run_partial(
    cores: usize,
    want_cpu: bool,
    want_ram: bool,
    want_disk: bool,
) -> BenchmarkResult {
    // Secuencial (CPU → RAM → disco) — ver comentario en la variante Linux.
    let cpu_r  = tokio::task::spawn_blocking(move || if want_cpu  { bench_cpu_native(cores) } else { 0.0 }).await;
    let ram_r  = tokio::task::spawn_blocking(move || if want_ram  { bench_ram_native()      } else { 0.0 }).await;
    let disk_r = tokio::task::spawn_blocking(move || if want_disk { bench_disk_native()     } else { 0.0 }).await;

    let any_ran = want_cpu || want_ram || want_disk;
    BenchmarkResult {
        cpu_events_per_sec: cpu_r.unwrap_or(0.0),
        ram_mb_per_sec:     ram_r.unwrap_or(0.0),
        disk_iops:          disk_r.unwrap_or(0.0),
        measured:           any_ran,
        missing_tools:      Vec::new(),
    }
}

// CPU: cuenta cuántos números primos se comprueban por segundo en `cores`
// hilos durante 5s — mismo orden de magnitud conceptual que sysbench cpu.
#[cfg(target_os = "windows")]
fn bench_cpu_native(cores: usize) -> f64 {
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Arc;
    use std::time::{Duration, Instant};

    fn is_prime(n: u64) -> bool {
        if n < 2 { return false; }
        let mut i = 2;
        while i * i <= n {
            if n % i == 0 { return false; }
            i += 1;
        }
        true
    }

    let counter = Arc::new(AtomicU64::new(0));
    let stop_at = Instant::now() + Duration::from_secs(5);
    let threads: Vec<_> = (0..cores.max(1)).map(|t| {
        let counter = Arc::clone(&counter);
        std::thread::spawn(move || {
            let mut n: u64 = 100_000 + (t as u64) * 1_000_003;
            let mut local = 0u64;
            while Instant::now() < stop_at {
                if is_prime(n) { local += 1; }
                n += 1;
                if local % 64 == 0 { counter.fetch_add(64, Ordering::Relaxed); local = 0; }
            }
            counter.fetch_add(local, Ordering::Relaxed);
        })
    }).collect();
    for t in threads { let _ = t.join(); }

    counter.load(Ordering::Relaxed) as f64 / 5.0
}

// RAM: throughput de copia secuencial de un buffer de 256MB durante ~3s.
#[cfg(target_os = "windows")]
fn bench_ram_native() -> f64 {
    use std::time::{Duration, Instant};

    const SIZE: usize = 256 * 1024 * 1024;
    let src = vec![0xABu8; SIZE];
    let mut dst = vec![0u8; SIZE];

    let start = Instant::now();
    let deadline = start + Duration::from_secs(3);
    let mut bytes_copied: u64 = 0;
    while Instant::now() < deadline {
        dst.copy_from_slice(&src);
        // Evita que el optimizador elimine la copia por "no usarse"
        std::hint::black_box(dst[0]);
        bytes_copied += SIZE as u64;
    }
    let secs = start.elapsed().as_secs_f64();
    (bytes_copied as f64 / 1024.0 / 1024.0) / secs
}

// Disco: 4K random write+read sobre un fichero temporal de 256MB durante ~5s,
// midiendo IOPS reales. Usa I/O con buffer normal de Windows (no hay forma
// sencilla de bypasear la caché desde Rust puro sin flags nativas adicionales),
// así que mide rendimiento efectivo percibido, no velocidad cruda del disco —
// es real y consistente para comparar antes/después, igual que el resto.
#[cfg(target_os = "windows")]
fn bench_disk_native() -> f64 {
    use std::fs::OpenOptions;
    use std::io::{Read, Seek, SeekFrom, Write};
    use std::time::{Duration, Instant};

    const BLOCK: usize = 4096;
    const FILE_SIZE: u64 = 256 * 1024 * 1024;
    let path = std::env::temp_dir().join("dix_bench_disk.tmp");

    let file = OpenOptions::new().create(true).read(true).write(true).truncate(true).open(&path);
    let Ok(mut file) = file else { return 0.0; };

    let block = vec![0x5Au8; BLOCK];
    let blocks_total = (FILE_SIZE / BLOCK as u64) as usize;
    for _ in 0..blocks_total {
        if file.write_all(&block).is_err() { let _ = std::fs::remove_file(&path); return 0.0; }
    }
    let _ = file.flush();

    let mut rng_state: u64 = 0x1234_5678_9abc_def0;
    let mut next = || { rng_state ^= rng_state << 13; rng_state ^= rng_state >> 7; rng_state ^= rng_state << 17; rng_state };

    let mut buf = vec![0u8; BLOCK];
    let start = Instant::now();
    let deadline = start + Duration::from_secs(5);
    let mut ops: u64 = 0;
    while Instant::now() < deadline {
        let block_idx = (next() as usize) % blocks_total;
        let offset = (block_idx * BLOCK) as u64;
        if file.seek(SeekFrom::Start(offset)).is_err() { break; }
        if file.read_exact(&mut buf).is_err() { break; }
        ops += 1;
    }
    let secs = start.elapsed().as_secs_f64();
    let _ = std::fs::remove_file(&path);

    if secs <= 0.0 { 0.0 } else { ops as f64 / secs }
}

#[cfg(not(target_os = "windows"))]
fn tool_ok(name: &str) -> bool {
    Command::new("which").arg(name)
        .output().map(|o| o.status.success()).unwrap_or(false)
}

#[cfg(not(target_os = "windows"))]
fn bench_cpu(cores: usize) -> f64 {
    let Ok(out) = Command::new("sysbench")
        .args(["cpu", "--time=5", &format!("--threads={}", cores), "run"])
        .output() else { return 0.0; };
    let s = String::from_utf8_lossy(&out.stdout);
    for line in s.lines() {
        if line.contains("events per second") {
            if let Some(v) = line.split(':').nth(1) {
                return v.trim().parse::<f64>().unwrap_or(0.0);
            }
        }
    }
    0.0
}

#[cfg(not(target_os = "windows"))]
fn bench_ram() -> f64 {
    let Ok(out) = Command::new("sysbench")
        .args(["memory", "--time=4", "run"])
        .output() else { return 0.0; };
    let s = String::from_utf8_lossy(&out.stdout);
    for line in s.lines() {
        if let Some(idx) = line.find("MiB/sec") {
            let before = &line[..idx];
            if let Some(last) = before.split_whitespace().last() {
                return last.trim_start_matches('(').parse::<f64>().unwrap_or(0.0);
            }
        }
    }
    0.0
}

#[cfg(not(target_os = "windows"))]
fn bench_disk() -> f64 {
    let out = Command::new("fio")
        .args([
            "--name=dix_test", "--rw=randread", "--bs=4k",
            "--size=256M",     "--runtime=8",
            "--filename=/tmp/dix_fio_test",
            "--output-format=json", "--group_reporting",
        ])
        .output();
    let _ = std::fs::remove_file("/tmp/dix_fio_test");
    let Ok(out) = out else { return 0.0; };
    let s = String::from_utf8_lossy(&out.stdout);
    serde_json::from_str::<serde_json::Value>(&s)
        .ok()
        .and_then(|j| j["jobs"][0]["read"]["iops"].as_f64())
        .unwrap_or(0.0)
}
