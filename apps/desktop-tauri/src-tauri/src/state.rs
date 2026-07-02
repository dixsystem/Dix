// SPDX-License-Identifier: AGPL-3.0-only
// Copyright © 2026 DixSystem

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
    #[serde(default)]
    pub visual_effects:         String,
    #[serde(default)]
    pub network_throttling:     String,
    #[serde(default)]
    pub gpu_hw_scheduling:      String,
    #[serde(default)]
    pub menu_show_delay:        u32,
    #[serde(default)]
    pub hpet_disabled:          bool,
    #[serde(default)]
    pub gamedvr_enabled:        bool,
    #[serde(default)]
    pub sysmain_running:        bool,
    #[serde(default)]
    pub telemetry_level:        u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LostOpt {
    pub key:      String,
    pub label:    String,
    pub expected: String,
    pub current:  String,
}

fn state_path() -> PathBuf {
    crate::memory::config_dir().join("applied_state.json")
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
        visual_effects:         scan.visual_effects.clone(),
        network_throttling:     scan.network_throttling.clone(),
        gpu_hw_scheduling:      scan.gpu_hw_scheduling.clone(),
        menu_show_delay:        scan.menu_show_delay,
        hpet_disabled:          scan.hpet_disabled,
        gamedvr_enabled:        scan.gamedvr_enabled,
        sysmain_running:        scan.sysmain_running,
        telemetry_level:        scan.telemetry_level,
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
    chk!("visual_effects",     "Efectos visuales",          current.visual_effects,        &applied.visual_effects);
    chk!("network_throttling", "Network Throttling Index",  current.network_throttling,    &applied.network_throttling);
    chk!("gpu_hw_scheduling",  "GPU Hardware Scheduling",   current.gpu_hw_scheduling,      &applied.gpu_hw_scheduling);
    chk!("menu_show_delay",    "Retardo de menús",          current.menu_show_delay,        applied.menu_show_delay);
    chk!("hpet_disabled",      "HPET (reloj de plataforma)", current.hpet_disabled,          applied.hpet_disabled);
    chk!("gamedvr_enabled",    "Game DVR",                  current.gamedvr_enabled,        applied.gamedvr_enabled);
    chk!("sysmain_running",    "SysMain (Superfetch)",      current.sysmain_running,        applied.sysmain_running);
    chk!("telemetry_level",    "Nivel de telemetría",       current.telemetry_level,        applied.telemetry_level);

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

// ─── Windows ────────────────────────────────────────────────────────────────
// En Windows, cpu_governor/dirty_ratio/hugepages se reutilizan (ver scanner.rs)
// para representar plan de energía / TCP ACK (Nagle) / LargePageMinimum, y
// visual_effects/network_throttling/gpu_hw_scheduling/menu_show_delay son
// parámetros propios — todos valores que el scanner mide de verdad en Windows
// y que pueden revertirse tras un reinicio (GPO, actualización, OEM software).
// swappiness/dirty_background_ratio/numa_balancing/nr_requests son constantes
// fijas en scan_windows() y nunca aparecen como "perdidos".
#[cfg(target_os = "windows")]
pub fn generate_reapply_script_windows(lost: &[LostOpt]) -> String {
    let mut lines = vec![
        "$ErrorActionPreference = 'Continue'".to_string(),
        "Write-Host '[Dix] Reaplicando optimizaciones perdidas tras el reinicio...'".to_string(),
    ];
    for opt in lost {
        match opt.key.as_str() {
            "cpu_governor" => {
                let guid = match opt.expected.as_str() {
                    "high-performance"      => "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c",
                    "powersave"             => "a1841308-3541-4fab-bc81-f71556f20b4a",
                    "ultimate-performance"  => "e9a42b02-d5df-448d-aa00-03f14749eb61",
                    _                       => "381b4222-f694-41f0-9685-ff5bb260df2e", // balanced
                };
                lines.push(format!("powercfg /setactive {}", guid));
            }
            "dirty_ratio" => {
                // expected "5" → Nagle desactivado (TcpAckFrequency=1); "20" → valor por defecto (quitar override)
                if opt.expected == "5" {
                    lines.push(
                        "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters' \
                         -Name TcpAckFrequency -Value 1 -Type DWord -ErrorAction SilentlyContinue".to_string()
                    );
                } else {
                    lines.push(
                        "Remove-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters' \
                         -Name TcpAckFrequency -ErrorAction SilentlyContinue".to_string()
                    );
                }
            }
            "hugepages" => {
                // expected "always" → LargePageMinimum=0; "madvise" → quitar override
                if opt.expected == "always" {
                    lines.push(
                        "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management' \
                         -Name LargePageMinimum -Value 0 -Type DWord -ErrorAction SilentlyContinue".to_string()
                    );
                } else {
                    lines.push(
                        "Remove-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management' \
                         -Name LargePageMinimum -ErrorAction SilentlyContinue".to_string()
                    );
                }
            }
            "visual_effects" => {
                let val = if opt.expected == "performance" { "2" } else { "0" };
                lines.push(format!(
                    "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects' \
                     -Name VisualFXSetting -Value {} -Type DWord -ErrorAction SilentlyContinue",
                    val
                ));
            }
            "network_throttling" => {
                if opt.expected == "unlimited" {
                    lines.push(
                        "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' \
                         -Name NetworkThrottlingIndex -Value 0xffffffff -Type DWord -ErrorAction SilentlyContinue".to_string()
                    );
                } else {
                    lines.push(
                        "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' \
                         -Name NetworkThrottlingIndex -Value 10 -Type DWord -ErrorAction SilentlyContinue".to_string()
                    );
                }
            }
            "gpu_hw_scheduling" => {
                let val = if opt.expected == "on" { "2" } else { "1" };
                lines.push(format!(
                    "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' \
                     -Name HwSchMode -Value {} -Type DWord -ErrorAction SilentlyContinue",
                    val
                ));
            }
            "menu_show_delay" => {
                lines.push(format!(
                    "Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name MenuShowDelay -Value '{}' -Type String -ErrorAction SilentlyContinue",
                    opt.expected
                ));
            }
            "hpet_disabled" => {
                if opt.expected == "true" {
                    lines.push("bcdedit /deletevalue useplatformclock".to_string());
                } else {
                    lines.push("bcdedit /set useplatformclock true".to_string());
                }
            }
            "gamedvr_enabled" => {
                let val = if opt.expected == "true" { "1" } else { "0" };
                lines.push(format!(
                    "Set-ItemProperty -Path 'HKCU:\\System\\GameConfigStore' -Name GameDVR_Enabled -Value {} -Type DWord -ErrorAction SilentlyContinue",
                    val
                ));
            }
            "sysmain_running" => {
                if opt.expected == "true" {
                    lines.push("Set-Service -Name SysMain -StartupType Automatic -ErrorAction SilentlyContinue".to_string());
                    lines.push("Start-Service -Name SysMain -ErrorAction SilentlyContinue".to_string());
                } else {
                    lines.push("Stop-Service -Name SysMain -Force -ErrorAction SilentlyContinue".to_string());
                    lines.push("Set-Service -Name SysMain -StartupType Disabled -ErrorAction SilentlyContinue".to_string());
                }
            }
            "telemetry_level" => {
                lines.push(format!(
                    "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' -Name AllowTelemetry -Value {} -Type DWord -ErrorAction SilentlyContinue",
                    opt.expected
                ));
            }
            _ => {}
        }
    }
    lines.push("Write-Host '[Dix] Listo.'".to_string());
    lines.join("\n")
}
