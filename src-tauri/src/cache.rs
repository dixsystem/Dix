// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.

use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::fs;
use std::path::PathBuf;
use crate::scanner::SystemScan;

// ─── ACP Encoder ──────────────────────────────────────────────────────────────

/// Convierte un SystemScan a ACP compacto usando solo parámetros estables.
/// Excluye mem_available y load_avg porque cambian en cada lectura.
pub fn encode_stable_acp(scan: &SystemScan) -> String {
    format!(
        "CPU:GOV={}|CPU:CORES={}|CPU:FREQ={}-{}|\
         MEM:SWP={}|MEM:DIRTY={}|MEM:BGDIRTY={}|\
         IO:SCHED={}|IO:NRREQ={}|\
         SYS:HUGE={}|SYS:NUMA={}|SYS:IRQ={}|\
         AUD:SRV={}",
        scan.cpu_governor.to_uppercase(),
        scan.cpu_cores,
        scan.cpu_min_freq_mhz,
        scan.cpu_max_freq_mhz,
        scan.swappiness,
        scan.dirty_ratio,
        scan.dirty_background_ratio,
        scan.disk_scheduler.to_uppercase(),
        scan.nvme_queue_depth,
        scan.hugepages.to_uppercase(),
        scan.numa_balancing,
        scan.irqbalance_active as u8,
        scan.audio_server.to_uppercase(),
    )
}

pub fn acp_hash(acp: &str) -> String {
    let mut hasher = DefaultHasher::new();
    acp.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

pub fn hardware_id(scan: &SystemScan) -> String {
    format!("{}cores_{}MB", scan.cpu_cores, scan.mem_total_mb)
}

// ─── Tipos de datos ───────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CacheEntry {
    pub timestamp: u64,
    pub acp: String,
    pub acp_hash: String,
    pub analysis_json: String,
    pub response_time_ms: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct HistoryRecord {
    pub timestamp: u64,
    pub acp_hash: String,
    pub used_cache: bool,
    pub response_time_ms: u32,
}

#[derive(Serialize, Deserialize, Default)]
pub struct OptimizationCache {
    pub version: String,
    pub hardware_id: String,
    pub last_analysis: Option<CacheEntry>,
    pub history: Vec<HistoryRecord>,
    pub hit_count: u32,
    pub miss_count: u32,
    /// Parámetros aplicados en optimizaciones previas. Se pasan a Claude
    /// para evitar que oscile entre valores opuestos entre sesiones.
    #[serde(default)]
    pub pinned_params: HashMap<String, String>,
}

#[derive(Serialize, Clone)]
pub struct CacheStats {
    pub hit_count: u32,
    pub miss_count: u32,
    pub hit_rate: f32,
    pub last_analysis_timestamp: Option<u64>,
    pub hardware_id: String,
    pub last_acp: Option<String>,
}

// ─── Decisión de caché ────────────────────────────────────────────────────────

pub enum CacheDecision {
    Hit(String),
    Miss,
}

// Las entradas de caché expiran a los 7 días
const CACHE_TTL_SECS: u64 = 7 * 24 * 3600;

pub fn decide_cache(current_acp: &str, cache: &OptimizationCache) -> CacheDecision {
    let Some(ref last) = cache.last_analysis else {
        return CacheDecision::Miss;
    };

    // TTL: si el análisis tiene más de 7 días, invalidar
    let now = current_unix_secs();
    if now.saturating_sub(last.timestamp) > CACHE_TTL_SECS {
        return CacheDecision::Miss;
    }

    // Comparación exacta por hash ACP
    if acp_hash(current_acp) == last.acp_hash {
        return CacheDecision::Hit(last.analysis_json.clone());
    }

    CacheDecision::Miss
}

// ─── Persistencia ─────────────────────────────────────────────────────────────

fn config_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home).join(".config").join("dix")
}

fn cache_path() -> PathBuf {
    config_dir().join("state.json")
}

pub fn load_cache() -> OptimizationCache {
    fs::read_to_string(cache_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| OptimizationCache {
            version: "1.0".to_string(),
            ..Default::default()
        })
}

pub fn save_cache(cache: &OptimizationCache) -> Result<(), String> {
    fs::create_dir_all(config_dir()).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(cache).map_err(|e| e.to_string())?;
    fs::write(cache_path(), json).map_err(|e| e.to_string())
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

pub fn current_unix_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

pub fn record_history(
    cache: &mut OptimizationCache,
    acp: &str,
    used_cache: bool,
    response_time_ms: u32,
) {
    cache.history.push(HistoryRecord {
        timestamp: current_unix_secs(),
        acp_hash: acp_hash(acp),
        used_cache,
        response_time_ms,
    });
    // Conservar máximo 50 registros históricos
    if cache.history.len() > 50 {
        let excess = cache.history.len() - 50;
        cache.history.drain(0..excess);
    }
}

/// Extrae parámetros clave de un script bash aplicado para anclarlos en el caché.
pub fn extract_pinnable_params(script: &str) -> HashMap<String, String> {
    let mut params = HashMap::new();
    for line in script.lines() {
        // Procesar partes separadas por && en la misma línea
        for part in line.split("&&") {
            let t = part.trim();
            if t.is_empty() || t.starts_with('#') { continue; }

            // echo VAL | tee /sys/block/.../nr_requests
            if t.contains("/sys/block/") && t.contains("nr_requests") {
                if let Some(val) = extract_echo_pipe_value(t) {
                    params.insert("nvme_nr_requests".to_string(), val);
                }
            }
            // echo VAL | tee /sys/block/.../scheduler
            if t.contains("/sys/block/") && t.contains("/queue/scheduler") {
                if let Some(val) = extract_echo_pipe_value(t) {
                    params.insert("nvme_scheduler".to_string(), val);
                }
            }
            // sysctl -w key=val  (omite valores compuestos con espacios como tcp_rmem)
            if t.contains("sysctl") && t.contains("-w") {
                if let Some(rest) = t.split("-w").nth(1) {
                    let kv = rest.split("||").next().unwrap_or(rest).trim();
                    if let Some((k, v)) = kv.split_once('=') {
                        let k = k.trim().to_string();
                        let raw_v = v.trim().trim_matches('\'').trim_matches('"');
                        if !k.is_empty() && !raw_v.is_empty()
                            && !k.contains(' ') && !raw_v.contains(' ')
                        {
                            params.insert(k, raw_v.to_string());
                        }
                    }
                }
            }
        }
    }
    params
}

fn extract_echo_pipe_value(line: &str) -> Option<String> {
    // "echo VALUE | tee PATH ..."
    let pipe_idx = line.find('|')?;
    let before_pipe = line[..pipe_idx].trim();
    let after_echo = before_pipe.strip_prefix("echo")?.trim();
    let val = after_echo.split_whitespace().next()?;
    let val = val.trim_matches('"').trim_matches('\'');
    if val.is_empty() { None } else { Some(val.to_string()) }
}

/// Formatea los parámetros anclados para incluirlos en el prompt de Claude.
pub fn format_pinned_hint(params: &HashMap<String, String>) -> String {
    if params.is_empty() { return String::new(); }

    let name_map: &[(&str, &str)] = &[
        ("nvme_nr_requests",                   "NVMe nr_requests"),
        ("nvme_scheduler",                     "NVMe scheduler"),
        ("vm.swappiness",                      "vm.swappiness"),
        ("vm.dirty_ratio",                     "vm.dirty_ratio"),
        ("vm.dirty_background_ratio",          "vm.dirty_background_ratio"),
        ("vm.vfs_cache_pressure",              "vm.vfs_cache_pressure"),
        ("vm.min_free_kbytes",                 "vm.min_free_kbytes"),
        ("net.ipv4.tcp_congestion_control",    "TCP congestion control"),
        ("net.core.default_qdisc",             "net qdisc"),
        ("kernel.pid_max",                     "kernel.pid_max"),
        ("kernel.nmi_watchdog",                "kernel.nmi_watchdog"),
        ("kernel.sched_autogroup_enabled",     "sched_autogroup"),
        ("kernel.sched_migration_cost_ns",     "sched_migration_cost_ns"),
        ("net.core.rmem_max",                  "net.core.rmem_max"),
        ("net.core.wmem_max",                  "net.core.wmem_max"),
    ];

    let mut lines = vec![
        "VALORES OBJETIVO para este hardware (decididos en sesión anterior — si el sistema actual difiere, inclúyelos como optimización para restaurarlos):".to_string()
    ];
    let mut covered = std::collections::HashSet::new();

    for (key, human) in name_map {
        if let Some(val) = params.get(*key) {
            lines.push(format!("- {}: {}", human, val));
            covered.insert(*key);
        }
    }
    for (k, v) in params {
        if !covered.contains(k.as_str()) {
            lines.push(format!("- {}: {}", k, v));
        }
    }

    lines.join("\n")
}

pub fn get_stats(cache: &OptimizationCache) -> CacheStats {
    let total = cache.hit_count + cache.miss_count;
    let hit_rate = if total > 0 {
        cache.hit_count as f32 / total as f32
    } else {
        0.0
    };
    CacheStats {
        hit_count: cache.hit_count,
        miss_count: cache.miss_count,
        hit_rate,
        last_analysis_timestamp: cache.last_analysis.as_ref().map(|e| e.timestamp),
        hardware_id: cache.hardware_id.clone(),
        last_acp: cache.last_analysis.as_ref().map(|e| e.acp.clone()),
    }
}
