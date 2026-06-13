// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use crate::scanner::SystemScan;

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct AppliedState {
    pub timestamp:              u64,
    pub cpu_governor:           String,
    pub swappiness:             u8,
    pub dirty_ratio:            u8,
    pub dirty_background_ratio: u8,
    pub hugepages:              String,
    pub numa_balancing:         String,
    pub nr_requests:            u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LostOpt {
    pub key:      String,
    pub label:    String,
    pub expected: String,
    pub current:  String,
}

fn state_path() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA")
            .unwrap_or_else(|_| r"C:\Users\Default\AppData\Roaming".to_string());
        return PathBuf::from(appdata).join("Dix").join("state.json");
    }
    #[cfg(not(target_os = "windows"))]
    {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
        PathBuf::from(home).join(".config").join("dix").join("state.json")
    }
}

fn epoch_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub fn save_from_scan(scan: &SystemScan) -> Result<(), String> {
    let state = AppliedState {
        timestamp:              epoch_secs(),
        cpu_governor:           scan.cpu_governor.clone(),
        swappiness:             scan.swappiness,
        dirty_ratio:            scan.dirty_ratio,
        dirty_background_ratio: scan.dirty_background_ratio,
        hugepages:              scan.hugepages.clone(),
        numa_balancing:         scan.numa_balancing.clone(),
        nr_requests:            scan.nvme_queue_depth.parse().unwrap_or(64),
    };
    let path = state_path();
    if let Some(p) = path.parent() {
        std::fs::create_dir_all(p).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

pub fn load() -> Option<AppliedState> {
    serde_json::from_str(&std::fs::read_to_string(state_path()).ok()?).ok()
}

pub fn compare(current: &SystemScan, applied: &AppliedState) -> Vec<LostOpt> {
    let mut lost = Vec::new();

    macro_rules! chk {
        ($key:expr, $label:expr, $cur:expr, $exp:expr) => {
            if $cur.to_string() != $exp.to_string() {
                lost.push(LostOpt {
                    key:      $key.to_string(),
                    label:    $label.to_string(),
                    expected: $exp.to_string(),
                    current:  $cur.to_string(),
                });
            }
        };
    }

    chk!("cpu_governor", "CPU Governor",               current.cpu_governor,            &applied.cpu_governor);
    chk!("swappiness",   "vm.swappiness",               current.swappiness,              applied.swappiness);
    chk!("dirty_ratio",  "vm.dirty_ratio",              current.dirty_ratio,             applied.dirty_ratio);
    chk!("dirty_bg",     "vm.dirty_background_ratio",   current.dirty_background_ratio,  applied.dirty_background_ratio);
    chk!("hugepages",    "Transparent Hugepages",       current.hugepages,               &applied.hugepages);

    lost
}

// Genera script mínimo para reaplicar solo los parámetros perdidos.
// Respeta todas las reglas inviolables.
pub fn generate_reapply_script(lost: &[LostOpt]) -> String {
    let mut lines = vec![
        "#!/bin/bash".to_string(),
        "# Dix — Reaplicar optimizaciones perdidas tras reinicio".to_string(),
    ];
    for opt in lost {
        match opt.key.as_str() {
            "cpu_governor" => {
                lines.push(format!(
                    "for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; \
                    do echo {} > \"$cpu\" || true; done",
                    opt.expected
                ));
            }
            "swappiness" => {
                lines.push(format!("/sbin/sysctl -w vm.swappiness={} || true", opt.expected));
            }
            "dirty_ratio" => {
                // Regla inviolable: dirty_ratio <= 15
                let val: u8 = opt.expected.parse().unwrap_or(10).min(15);
                lines.push(format!("/sbin/sysctl -w vm.dirty_ratio={} || true", val));
            }
            "dirty_bg" => {
                lines.push(format!("/sbin/sysctl -w vm.dirty_background_ratio={} || true", opt.expected));
            }
            "hugepages" => {
                // Regla inviolable: hugepages != never
                let val = if opt.expected == "never" { "madvise" } else { opt.expected.as_str() };
                lines.push(format!(
                    "echo {} > /sys/kernel/mm/transparent_hugepage/enabled || true",
                    val
                ));
            }
            _ => {}
        }
    }
    lines.join("\n")
}
