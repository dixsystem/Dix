// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo

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

    // Los tres corren en paralelo — tiempo total ~8-10s
    let (cpu_r, ram_r, disk_r) = tokio::join!(
        tokio::task::spawn_blocking(move || if do_cpu  { bench_cpu(cores) } else { 0.0 }),
        tokio::task::spawn_blocking(move || if do_ram  { bench_ram()      } else { 0.0 }),
        tokio::task::spawn_blocking(move || if do_disk { bench_disk()     } else { 0.0 }),
    );

    let any_ran = do_cpu || do_ram || do_disk;
    BenchmarkResult {
        cpu_events_per_sec: cpu_r.unwrap_or(0.0),
        ram_mb_per_sec:     ram_r.unwrap_or(0.0),
        disk_iops:          disk_r.unwrap_or(0.0),
        measured:           missing.is_empty() && any_ran,
        missing_tools:      missing,
    }
}

fn tool_ok(name: &str) -> bool {
    Command::new("which").arg(name)
        .output().map(|o| o.status.success()).unwrap_or(false)
}

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
