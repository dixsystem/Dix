// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.

use serde::{Deserialize, Serialize};
use std::fs;
use std::process::Command;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SystemScan {
    pub cpu_governor: String,
    pub cpu_cores: usize,
    pub swappiness: u8,
    pub dirty_ratio: u8,
    pub dirty_background_ratio: u8,
    pub disk_scheduler: String,
    pub audio_server: String,
    pub hugepages: String,
    pub numa_balancing: String,
    pub mem_total_mb: u64,
    pub mem_available_mb: u64,
    pub load_avg: String,
    pub nvme_queue_depth: String,
    pub irqbalance_active: bool,
    pub cpu_min_freq_mhz: u32,
    pub cpu_max_freq_mhz: u32,
    // Hardware real — con default para compatibilidad con caché antigua
    #[serde(default)]
    pub cpu_model: String,
    #[serde(default)]
    pub gpu_model: String,
    #[serde(default)]
    pub distro_id: String,
    #[serde(default)]
    pub distro_version: String,
    #[serde(default)]
    pub kernel_version: String,
    #[serde(default)]
    pub cpu_temp_celsius: f32,
}

// Devuelve el prefijo de ruta para el mock, vacío en producción real.
fn sys_root() -> String {
    std::env::var("DIX_SYS_ROOT").unwrap_or_default()
}

fn p(path: &str) -> String {
    let root = sys_root();
    if root.is_empty() {
        path.to_string()
    } else {
        format!("{}{}", root, path)
    }
}

pub fn scan() -> Result<SystemScan, String> {
    let cpu_governor = read_sys(&p("/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor"), "unknown");
    let cpu_cores = count_cpu_cores();
    let swappiness = read_sys(&p("/proc/sys/vm/swappiness"), "60")
        .parse::<u8>()
        .unwrap_or(60);
    let dirty_ratio = read_sys(&p("/proc/sys/vm/dirty_ratio"), "20")
        .parse::<u8>()
        .unwrap_or(20);
    let dirty_background_ratio = read_sys(&p("/proc/sys/vm/dirty_background_ratio"), "10")
        .parse::<u8>()
        .unwrap_or(10);
    let disk_scheduler = read_disk_scheduler();
    let hugepages = read_hugepages_active();
    let numa_balancing = read_sys(&p("/proc/sys/kernel/numa_balancing"), "1");
    let audio_server = detect_audio_server();
    let (mem_total_mb, mem_available_mb) = read_meminfo();
    let load_avg = read_sys(&p("/proc/loadavg"), "0.0 0.0 0.0")
        .split_whitespace()
        .take(3)
        .collect::<Vec<_>>()
        .join(" ");
    let nvme_queue_depth = read_nvme_queue_depth();
    let irqbalance_active = check_service_active("irqbalance");
    let cpu_min_freq_mhz = read_cpu_freq(&p("/sys/devices/system/cpu/cpu0/cpufreq/scaling_min_freq"));
    let cpu_max_freq_mhz = read_cpu_freq(&p("/sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq"));

    let cpu_model = detect_cpu_model();
    let gpu_model = detect_gpu_model();
    let (distro_id, distro_version) = detect_distro();
    let kernel_version = detect_kernel();
    let cpu_temp_celsius = read_cpu_temp();

    Ok(SystemScan {
        cpu_governor,
        cpu_cores,
        swappiness,
        dirty_ratio,
        dirty_background_ratio,
        disk_scheduler,
        audio_server,
        hugepages,
        numa_balancing,
        mem_total_mb,
        mem_available_mb,
        load_avg,
        nvme_queue_depth,
        irqbalance_active,
        cpu_min_freq_mhz,
        cpu_max_freq_mhz,
        cpu_model,
        gpu_model,
        distro_id,
        distro_version,
        kernel_version,
        cpu_temp_celsius,
    })
}

fn read_sys(path: &str, default: &str) -> String {
    fs::read_to_string(path)
        .unwrap_or_else(|_| default.to_string())
        .trim()
        .to_string()
}

fn count_cpu_cores() -> usize {
    let cpu_dir = p("/sys/devices/system/cpu");
    fs::read_dir(&cpu_dir)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| {
                    let name = e.file_name();
                    let s = name.to_string_lossy();
                    s.starts_with("cpu")
                        && s.len() > 3
                        && s[3..].chars().all(|c| c.is_ascii_digit())
                })
                .count()
        })
        .unwrap_or(1)
}

fn read_disk_scheduler() -> String {
    let root = sys_root();
    for dev in &["nvme0n1", "nvme1n1", "sda"] {
        let path = format!("{}/sys/block/{}/queue/scheduler", root, dev);
        if let Ok(content) = fs::read_to_string(&path) {
            let raw = content.trim().to_string();
            if let Some(start) = raw.find('[') {
                if let Some(end) = raw.find(']') {
                    return raw[start + 1..end].to_string();
                }
            }
            return raw;
        }
    }
    "unknown".to_string()
}

fn read_nvme_queue_depth() -> String {
    let root = sys_root();
    for dev in &["nvme0n1", "nvme1n1", "sda"] {
        let path = format!("{}/sys/block/{}/queue/nr_requests", root, dev);
        if let Ok(content) = fs::read_to_string(&path) {
            let val = content.trim().to_string();
            if !val.is_empty() {
                return val;
            }
        }
    }
    "64".to_string()
}

fn read_hugepages_active() -> String {
    let raw = read_sys(
        &p("/sys/kernel/mm/transparent_hugepage/enabled"),
        "madvise",
    );
    if let Some(start) = raw.find('[') {
        if let Some(end) = raw.find(']') {
            return raw[start + 1..end].to_string();
        }
    }
    raw
}

fn detect_audio_server() -> String {
    // En modo mock, lee el valor directamente de un fichero
    let root = sys_root();
    if !root.is_empty() {
        let mock_path = format!("{}/mock/audio_server", root);
        if let Ok(val) = fs::read_to_string(&mock_path) {
            return val.trim().to_string();
        }
        return "unknown".to_string();
    }

    if let Ok(o) = Command::new("pactl").arg("info").output() {
        if o.status.success() {
            let s = String::from_utf8_lossy(&o.stdout);
            return if s.contains("PipeWire") {
                "pipewire".to_string()
            } else {
                "pulseaudio".to_string()
            };
        }
    }
    "unknown".to_string()
}

fn read_meminfo() -> (u64, u64) {
    let content = fs::read_to_string(p("/proc/meminfo")).unwrap_or_default();
    let mut total = 0u64;
    let mut available = 0u64;
    for line in content.lines() {
        if line.starts_with("MemTotal:") {
            total = line
                .split_whitespace()
                .nth(1)
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(0)
                / 1024;
        } else if line.starts_with("MemAvailable:") {
            available = line
                .split_whitespace()
                .nth(1)
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(0)
                / 1024;
        }
    }
    (total, available)
}

fn check_service_active(service: &str) -> bool {
    // En modo mock, la presencia del fichero indica que el servicio está activo
    let root = sys_root();
    if !root.is_empty() {
        let mock_path = format!("{}/mock/services/{}", root, service);
        return std::path::Path::new(&mock_path).exists();
    }

    Command::new("systemctl")
        .args(["is-active", "--quiet", service])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn read_cpu_freq(path: &str) -> u32 {
    fs::read_to_string(path)
        .unwrap_or_default()
        .trim()
        .parse::<u32>()
        .map(|v| v / 1000)
        .unwrap_or(0)
}

fn detect_cpu_model() -> String {
    let path = format!("{}/proc/cpuinfo", sys_root());
    fs::read_to_string(&path)
        .unwrap_or_default()
        .lines()
        .find(|l| l.contains("model name"))
        .and_then(|l| l.split(':').nth(1))
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "unknown CPU".to_string())
}

fn detect_gpu_model() -> String {
    let root = sys_root();
    if !root.is_empty() {
        let mock_path = format!("{}/mock/gpu_model", root);
        if let Ok(val) = fs::read_to_string(&mock_path) {
            return val.trim().to_string();
        }
        return "unknown GPU".to_string();
    }
    if let Ok(output) = Command::new("lspci").output() {
        let s = String::from_utf8_lossy(&output.stdout);
        for line in s.lines() {
            let lower = line.to_lowercase();
            if lower.contains("vga compatible") || lower.contains("3d controller") {
                let parts: Vec<&str> = line.splitn(3, ':').collect();
                if parts.len() >= 3 {
                    let gpu = parts[2].trim();
                    let gpu = gpu.rfind('(').map(|i| gpu[..i].trim()).unwrap_or(gpu);
                    return gpu.to_string();
                }
            }
        }
    }
    "unknown GPU".to_string()
}

fn detect_distro() -> (String, String) {
    let path = format!("{}/etc/os-release", sys_root());
    let content = fs::read_to_string(&path).unwrap_or_default();
    let mut id = String::from("linux");
    let mut version = String::from("unknown");
    for line in content.lines() {
        if line.starts_with("ID=") {
            id = line[3..].trim_matches('"').to_string();
        } else if line.starts_with("VERSION_ID=") {
            version = line[11..].trim_matches('"').to_string();
        }
    }
    (id, version)
}

fn detect_kernel() -> String {
    let root = sys_root();
    if !root.is_empty() {
        let mock_path = format!("{}/proc/version", root);
        if let Ok(val) = fs::read_to_string(&mock_path) {
            return val.split_whitespace().nth(2).unwrap_or("unknown").to_string();
        }
        return "unknown".to_string();
    }
    Command::new("uname")
        .arg("-r")
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|_| "unknown".to_string())
}

fn read_cpu_temp() -> f32 {
    let root = sys_root();
    let thermal_dir = format!("{}/sys/class/thermal", root);
    let Ok(entries) = fs::read_dir(&thermal_dir) else { return 0.0; };
    let mut max_temp = 0.0f32;
    let mut pkg_temp = 0.0f32;
    for entry in entries.filter_map(|e| e.ok()) {
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.starts_with("thermal_zone") { continue; }
        let path = entry.path();
        let t = fs::read_to_string(path.join("temp"))
            .ok()
            .and_then(|v| v.trim().parse::<i32>().ok())
            .map(|m| m as f32 / 1000.0)
            .unwrap_or(0.0);
        if t <= 0.0 || t > 110.0 { continue; }
        let zone_type = fs::read_to_string(path.join("type"))
            .unwrap_or_default()
            .trim()
            .to_lowercase();
        if zone_type.contains("pkg") || zone_type.contains("package") || zone_type.contains("x86") {
            if t > pkg_temp { pkg_temp = t; }
        }
        if t > max_temp { max_temp = t; }
    }
    if pkg_temp > 0.0 { pkg_temp } else { max_temp }
}
