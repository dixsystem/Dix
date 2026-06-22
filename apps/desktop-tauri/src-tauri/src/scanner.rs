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
    // Estado real de batería/AC — antes en Windows se reusaba (mal) el campo
    // irqbalance_active para esto, un concepto que ni existe en Windows.
    #[serde(default)]
    pub on_battery: bool,
    pub cpu_min_freq_mhz: u32,
    pub cpu_max_freq_mhz: u32,
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
    // ── Windows: parámetros reales adicionales con impacto sensible ──────────
    // "n/a" en Linux (no aplica). Ver scan_windows() para el detalle de cada uno.
    #[serde(default)]
    pub visual_effects: String,
    #[serde(default)]
    pub network_throttling: String,
    #[serde(default)]
    pub gpu_hw_scheduling: String,
    #[serde(default)]
    pub menu_show_delay: u32,
    #[serde(default)]
    pub hpet_disabled: bool,
    #[serde(default)]
    pub gamedvr_enabled: bool,
    #[serde(default)]
    pub sysmain_running: bool,
    #[serde(default)]
    pub telemetry_level: u32,
    // ── Linux: Boot Score real (systemd-analyze, dato exacto, no estimado) ───
    #[serde(default)]
    pub boot_time_seconds: f32,
    #[serde(default)]
    pub slowest_boot_service: String,
}

// ─── Entry point (platform dispatch) ─────────────────────────────────────────

pub fn scan() -> Result<SystemScan, String> {
    #[cfg(target_os = "windows")]
    return scan_windows();

    #[cfg(not(target_os = "windows"))]
    return scan_linux();
}

// ═════════════════════════════════════════════════════════════════════════════
// LINUX IMPLEMENTATION
// ═════════════════════════════════════════════════════════════════════════════

#[cfg(not(target_os = "windows"))]
fn sys_root() -> String {
    std::env::var("DIX_SYS_ROOT").unwrap_or_default()
}

#[cfg(not(target_os = "windows"))]
fn p(path: &str) -> String {
    let root = sys_root();
    if root.is_empty() { path.to_string() } else { format!("{}{}", root, path) }
}

#[cfg(not(target_os = "windows"))]
fn scan_linux() -> Result<SystemScan, String> {
    let cpu_governor = read_sys(&p("/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor"), "unknown");
    let cpu_cores = count_cpu_cores();
    let swappiness = read_sys(&p("/proc/sys/vm/swappiness"), "60").parse::<u8>().unwrap_or(60);
    let dirty_ratio = read_sys(&p("/proc/sys/vm/dirty_ratio"), "20").parse::<u8>().unwrap_or(20);
    let dirty_background_ratio = read_sys(&p("/proc/sys/vm/dirty_background_ratio"), "10").parse::<u8>().unwrap_or(10);
    let disk_scheduler = read_disk_scheduler();
    let hugepages = read_hugepages_active();
    let numa_balancing = read_sys(&p("/proc/sys/kernel/numa_balancing"), "1");
    let audio_server = detect_audio_server();
    let (mem_total_mb, mem_available_mb) = read_meminfo();
    let load_avg = read_sys(&p("/proc/loadavg"), "0.0 0.0 0.0")
        .split_whitespace().take(3).collect::<Vec<_>>().join(" ");
    let nvme_queue_depth = read_nvme_queue_depth();
    let irqbalance_active = check_service_active("irqbalance");
    let on_battery = read_on_battery_linux();
    let cpu_min_freq_mhz = read_cpu_freq(&p("/sys/devices/system/cpu/cpu0/cpufreq/scaling_min_freq"));
    let cpu_max_freq_mhz = read_cpu_freq(&p("/sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq"));
    let cpu_model = detect_cpu_model();
    let gpu_model = detect_gpu_model();
    let (distro_id, distro_version) = detect_distro();
    let kernel_version = detect_kernel();
    let cpu_temp_celsius = read_cpu_temp();
    let (boot_time_seconds, slowest_boot_service) = read_boot_stats();

    Ok(SystemScan {
        cpu_governor, cpu_cores, swappiness, dirty_ratio, dirty_background_ratio,
        disk_scheduler, audio_server, hugepages, numa_balancing, mem_total_mb,
        mem_available_mb, load_avg, nvme_queue_depth, irqbalance_active, on_battery,
        cpu_min_freq_mhz, cpu_max_freq_mhz, cpu_model, gpu_model, distro_id,
        distro_version, kernel_version, cpu_temp_celsius,
        visual_effects: "n/a".to_string(), network_throttling: "n/a".to_string(),
        gpu_hw_scheduling: "n/a".to_string(), menu_show_delay: 0,
        hpet_disabled: false, gamedvr_enabled: false, sysmain_running: false, telemetry_level: 0,
        boot_time_seconds, slowest_boot_service,
    })
}

#[cfg(not(target_os = "windows"))]
fn read_sys(path: &str, default: &str) -> String {
    fs::read_to_string(path).unwrap_or_else(|_| default.to_string()).trim().to_string()
}

#[cfg(not(target_os = "windows"))]
fn count_cpu_cores() -> usize {
    let cpu_dir = p("/sys/devices/system/cpu");
    fs::read_dir(&cpu_dir)
        .map(|entries| entries.filter_map(|e| e.ok())
            .filter(|e| { let n = e.file_name(); let s = n.to_string_lossy();
                s.starts_with("cpu") && s.len() > 3 && s[3..].chars().all(|c| c.is_ascii_digit()) })
            .count())
        .unwrap_or(1)
}

// true solo si hay una batería real presente y está descargando — un
// sobremesa sin batería (la mayoría de /sys/class/power_supply/BAT* no
// existen) nunca debe marcarse como "en batería".
#[cfg(not(target_os = "windows"))]
fn read_on_battery_linux() -> bool {
    let base = format!("{}/sys/class/power_supply", sys_root());
    let Ok(entries) = fs::read_dir(&base) else { return false; };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with("BAT") {
            let status = fs::read_to_string(entry.path().join("status"))
                .unwrap_or_default();
            if status.trim().eq_ignore_ascii_case("discharging") {
                return true;
            }
        }
    }
    false
}

#[cfg(not(target_os = "windows"))]
fn read_disk_scheduler() -> String {
    let root = sys_root();
    for dev in &["nvme0n1", "nvme1n1", "sda"] {
        let path = format!("{}/sys/block/{}/queue/scheduler", root, dev);
        if let Ok(content) = fs::read_to_string(&path) {
            let raw = content.trim().to_string();
            if let Some(start) = raw.find('[') {
                if let Some(end) = raw.find(']') { return raw[start + 1..end].to_string(); }
            }
            return raw;
        }
    }
    "unknown".to_string()
}

#[cfg(not(target_os = "windows"))]
fn read_nvme_queue_depth() -> String {
    let root = sys_root();
    for dev in &["nvme0n1", "nvme1n1", "sda"] {
        let path = format!("{}/sys/block/{}/queue/nr_requests", root, dev);
        if let Ok(content) = fs::read_to_string(&path) {
            let val = content.trim().to_string();
            if !val.is_empty() { return val; }
        }
    }
    "64".to_string()
}

#[cfg(not(target_os = "windows"))]
fn read_hugepages_active() -> String {
    let raw = read_sys(&p("/sys/kernel/mm/transparent_hugepage/enabled"), "madvise");
    if let Some(start) = raw.find('[') {
        if let Some(end) = raw.find(']') { return raw[start + 1..end].to_string(); }
    }
    raw
}

#[cfg(not(target_os = "windows"))]
fn detect_audio_server() -> String {
    let root = sys_root();
    if !root.is_empty() {
        let mock_path = format!("{}/mock/audio_server", root);
        if let Ok(val) = fs::read_to_string(&mock_path) { return val.trim().to_string(); }
        return "unknown".to_string();
    }
    if let Ok(o) = Command::new("pactl").arg("info").output() {
        if o.status.success() {
            let s = String::from_utf8_lossy(&o.stdout);
            return if s.contains("PipeWire") { "pipewire".to_string() } else { "pulseaudio".to_string() };
        }
    }
    "unknown".to_string()
}

#[cfg(not(target_os = "windows"))]
fn read_meminfo() -> (u64, u64) {
    let content = fs::read_to_string(p("/proc/meminfo")).unwrap_or_default();
    let mut total = 0u64;
    let mut available = 0u64;
    for line in content.lines() {
        if line.starts_with("MemTotal:") {
            total = line.split_whitespace().nth(1).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0) / 1024;
        } else if line.starts_with("MemAvailable:") {
            available = line.split_whitespace().nth(1).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0) / 1024;
        }
    }
    (total, available)
}

#[cfg(not(target_os = "windows"))]
fn check_service_active(service: &str) -> bool {
    let root = sys_root();
    if !root.is_empty() {
        return std::path::Path::new(&format!("{}/mock/services/{}", root, service)).exists();
    }
    Command::new("systemctl").args(["is-active", "--quiet", service])
        .output().map(|o| o.status.success()).unwrap_or(false)
}

#[cfg(not(target_os = "windows"))]
fn read_cpu_freq(path: &str) -> u32 {
    fs::read_to_string(path).unwrap_or_default().trim().parse::<u32>().map(|v| v / 1000).unwrap_or(0)
}

#[cfg(not(target_os = "windows"))]
fn detect_cpu_model() -> String {
    let path = format!("{}/proc/cpuinfo", sys_root());
    fs::read_to_string(&path).unwrap_or_default().lines()
        .find(|l| l.contains("model name"))
        .and_then(|l| l.split(':').nth(1))
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "unknown CPU".to_string())
}

#[cfg(not(target_os = "windows"))]
fn detect_gpu_model() -> String {
    let root = sys_root();
    if !root.is_empty() {
        let mock_path = format!("{}/mock/gpu_model", root);
        if let Ok(val) = fs::read_to_string(&mock_path) { return val.trim().to_string(); }
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

#[cfg(not(target_os = "windows"))]
fn detect_distro() -> (String, String) {
    let path = format!("{}/etc/os-release", sys_root());
    let content = fs::read_to_string(&path).unwrap_or_default();
    let mut id = String::from("linux");
    let mut version = String::from("unknown");
    for line in content.lines() {
        if line.starts_with("ID=") { id = line[3..].trim_matches('"').to_string(); }
        else if line.starts_with("VERSION_ID=") { version = line[11..].trim_matches('"').to_string(); }
    }
    (id, version)
}

#[cfg(not(target_os = "windows"))]
fn detect_kernel() -> String {
    let root = sys_root();
    if !root.is_empty() {
        let mock_path = format!("{}/proc/version", root);
        if let Ok(val) = fs::read_to_string(&mock_path) {
            return val.split_whitespace().nth(2).unwrap_or("unknown").to_string();
        }
        return "unknown".to_string();
    }
    Command::new("uname").arg("-r").output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|_| "unknown".to_string())
}

#[cfg(not(target_os = "windows"))]
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
        let t = fs::read_to_string(path.join("temp")).ok()
            .and_then(|v| v.trim().parse::<i32>().ok())
            .map(|m| m as f32 / 1000.0).unwrap_or(0.0);
        if t <= 0.0 || t > 110.0 { continue; }
        let zone_type = fs::read_to_string(path.join("type")).unwrap_or_default().trim().to_lowercase();
        if zone_type.contains("pkg") || zone_type.contains("package") || zone_type.contains("x86") {
            if t > pkg_temp { pkg_temp = t; }
        }
        if t > max_temp { max_temp = t; }
    }
    if pkg_temp > 0.0 { pkg_temp } else { max_temp }
}

// Boot Score real — `systemd-analyze` da el tiempo de arranque exacto medido
// por el propio sistema (no una estimación de Dix), y `systemd-analyze blame`
// el servicio que más tarda. A diferencia de Windows (donde el "impacto" de
// arranque es una aproximación por categoría), en Linux esto es un dato 100%
// real desde el primer día.
#[cfg(not(target_os = "windows"))]
fn read_boot_stats() -> (f32, String) {
    let time_out = Command::new("systemd-analyze").output();
    let boot_time = time_out.ok()
        .filter(|o| o.status.success())
        .and_then(|o| {
            let s = String::from_utf8_lossy(&o.stdout).to_string();
            // "...= 18.301s reached target ..." — tomamos el número justo antes de "s reached"
            s.split('=').nth(1)
                .and_then(|tail| tail.trim().split('s').next())
                .and_then(|n| n.trim().parse::<f32>().ok())
        })
        .unwrap_or(0.0);

    let blame_out = Command::new("systemd-analyze").arg("blame").output();
    let slowest = blame_out.ok()
        .filter(|o| o.status.success())
        .and_then(|o| String::from_utf8_lossy(&o.stdout).lines().next().map(|l| l.trim().to_string()))
        .unwrap_or_default();

    (boot_time, slowest)
}

// ═════════════════════════════════════════════════════════════════════════════
// WINDOWS IMPLEMENTATION
// ═════════════════════════════════════════════════════════════════════════════

// ── Métricas nativas Win32 ────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn mem_native() -> (u64, u64) {
    use windows::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};
    // zeroed() porque MEMORYSTATUSEX no deriva Default en windows-rs 0.58
    let mut ms: MEMORYSTATUSEX = unsafe { std::mem::zeroed() };
    ms.dwLength = std::mem::size_of::<MEMORYSTATUSEX>() as u32;
    if unsafe { GlobalMemoryStatusEx(&mut ms) }.is_ok() {
        return (ms.ullTotalPhys / (1024 * 1024), ms.ullAvailPhys / (1024 * 1024));
    }
    (0, 0)
}

#[cfg(target_os = "windows")]
fn cpu_count_native() -> usize {
    use windows::Win32::System::SystemInformation::{GetSystemInfo, SYSTEM_INFO};
    let mut si: SYSTEM_INFO = unsafe { std::mem::zeroed() };
    unsafe { GetSystemInfo(&mut si) };
    si.dwNumberOfProcessors as usize
}

// Detecta si el equipo está conectado a corriente (vs en batería) via
// GetSystemPowerStatus — instantáneo, sin PowerShell. ACLineStatus: 0 =
// batería, 1 = conectado, 255 = desconocido (sobre todo en sobremesas sin
// batería: ahí se trata como "conectado" para no penalizar un equipo que
// nunca tuvo este problema). Antes este campo estaba hardcodeado a `false`
// (siempre "en batería"), así que el score en Windows restaba 5 puntos
// permanentemente sin que reflejara nada real.
#[cfg(target_os = "windows")]
fn ac_power_connected_native() -> bool {
    use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
    let mut status: SYSTEM_POWER_STATUS = unsafe { std::mem::zeroed() };
    if unsafe { GetSystemPowerStatus(&mut status) }.is_ok() {
        status.ACLineStatus != 0
    } else {
        true
    }
}

// Detecta el plan de energía activo leyendo el GUID via PowerGetActiveScheme.
// Compara contra GUIDs conocidos de Windows; cae a "balanced" si la API falla.
#[cfg(target_os = "windows")]
fn power_plan_native() -> String {
    use windows::Win32::System::Power::PowerGetActiveScheme;
    use windows::Win32::Foundation::{LocalFree, HLOCAL};
    use windows::Win32::System::Registry::HKEY;
    use windows::core::GUID;

    const HIGH_PERF: GUID = GUID { data1: 0x8c5e7fda, data2: 0xe8bf, data3: 0x4a96,
        data4: [0x9a, 0x85, 0xa6, 0xe2, 0x3a, 0x8c, 0x63, 0x5c] };
    const POWERSAVE: GUID = GUID { data1: 0xa1841308, data2: 0x3541, data3: 0x4fab,
        data4: [0xbc, 0x81, 0xf7, 0x15, 0x56, 0xf2, 0x0b, 0x4a] };
    const ULTIMATE:  GUID = GUID { data1: 0xe9a42b02, data2: 0xd5df, data3: 0x448d,
        data4: [0xaa, 0x00, 0x03, 0xf1, 0x47, 0x49, 0xeb, 0x61] };

    let mut scheme: *mut GUID = std::ptr::null_mut();
    // Ignorar el u32 de retorno — si scheme no es null la llamada tuvo éxito
    unsafe { PowerGetActiveScheme(HKEY::default(), &mut scheme) };
    if !scheme.is_null() {
        let active = unsafe { *scheme };
        unsafe { LocalFree(HLOCAL(scheme.cast())) };
        return match active {
            g if g == HIGH_PERF => "high-performance",
            g if g == POWERSAVE => "powersave",
            g if g == ULTIMATE  => "ultimate-performance",
            _                   => "balanced",
        }.to_string();
    }
    "balanced".to_string()
}

// MSAcpi_ThermalZoneTemperature puede colgarse 30-120s en hardware de consumo
// sin sensor ACPI estándar — por eso antes se deshabilitaba directamente. Con
// un timeout corto (3s) y kill explícito si no responde (winutil::run_powershell
// ya lo hace), se puede intentar de forma segura: si responde rápido, dato
// real; si no, 0.0 — que el frontend ya interpreta como "sin sensor detectado"
// en vez de fingir una lectura inventada.
#[cfg(target_os = "windows")]
fn read_cpu_temp_windows() -> f32 {
    let script = "$t = (Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature \
        -ErrorAction SilentlyContinue | Select-Object -First 1).CurrentTemperature; \
        if ($t) { [math]::Round(($t / 10) - 273.15, 1) }";
    crate::winutil::run_powershell(script, std::time::Duration::from_secs(3))
        .and_then(|s| s.trim().parse::<f32>().ok())
        .filter(|t| *t > -50.0 && *t < 150.0) // descarta lecturas absurdas de sensores defectuosos
        .unwrap_or(0.0)
}

#[cfg(target_os = "windows")]
fn scan_windows() -> Result<SystemScan, String> {
    // Valores nativos — sin PowerShell, instantáneos
    let cpu_cores  = cpu_count_native();
    let cpu_governor = power_plan_native();
    let (mem_total_mb, mem_available_mb) = mem_native();

    // UNA SOLA llamada PowerShell en lugar de 16 separadas.
    // Get-Disk eliminado (requiere módulo Storage, lento). Temperatura eliminada
    // (MSAcpi_ThermalZoneTemperature cuelga 30-120s en hardware de consumo).
    // Timeout de 10s para que nunca bloquee indefinidamente.
    let ps_script = "\
$cpu  = Get-CimInstance Win32_Processor | Select-Object -First 1;\
$os   = Get-CimInstance Win32_OperatingSystem;\
$gpu  = (Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Where-Object {$_.PNPDeviceID -notlike 'ROOT*'} | Select-Object -First 1);\
$nagle = (Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters' \
    -Name TcpAckFrequency -ErrorAction SilentlyContinue).TcpAckFrequency;\
$lp   = (Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management' \
    -Name LargePageMinimum -ErrorAction SilentlyContinue).LargePageMinimum;\
$disk = (Get-CimInstance Win32_DiskDrive -ErrorAction SilentlyContinue | Select-Object -First 1).Model;\
$audio = (Get-Service -Name AudioSrv -ErrorAction SilentlyContinue).Status;\
$vfx  = (Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects' \
    -Name VisualFXSetting -ErrorAction SilentlyContinue).VisualFXSetting;\
$nti  = (Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' \
    -Name NetworkThrottlingIndex -ErrorAction SilentlyContinue).NetworkThrottlingIndex;\
$hws  = (Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' \
    -Name HwSchMode -ErrorAction SilentlyContinue).HwSchMode;\
$msd  = (Get-ItemProperty 'HKCU:\\Control Panel\\Desktop' -Name MenuShowDelay -ErrorAction SilentlyContinue).MenuShowDelay;\
$hpet = ((bcdedit /enum) -join ' ') -match 'useplatformclock\\s+Yes';\
$dvr  = (Get-ItemProperty 'HKCU:\\System\\GameConfigStore' -Name GameDVR_Enabled -ErrorAction SilentlyContinue).GameDVR_Enabled;\
$sysm = (Get-Service -Name SysMain -ErrorAction SilentlyContinue).Status;\
$telm = (Get-ItemProperty 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' \
    -Name AllowTelemetry -ErrorAction SilentlyContinue).AllowTelemetry;\
\"$($cpu.Name)|$nagle|$disk|$audio|$lp|$($cpu.MaxClockSpeed)|$($cpu.CurrentClockSpeed)|$($cpu.LoadPercentage)|$($gpu.Name)|$($os.Caption)|$([System.Environment]::OSVersion.Version.ToString())|$vfx|$nti|$hws|$msd|$hpet|$dvr|$sysm|$telm\"";

    let line = crate::winutil::run_powershell(ps_script, std::time::Duration::from_secs(10))
        .unwrap_or_default();
    // La salida puede tener múltiples líneas si PS imprime advertencias antes del resultado.
    // Tomamos la última línea no vacía que contenga '|'.
    let line = line.lines()
        .rev()
        .find(|l| l.contains('|'))
        .unwrap_or("")
        .to_string();

    let parts: Vec<&str> = line.split('|').collect();
    let get = |i: usize| parts.get(i).copied().unwrap_or("").trim();

    let cpu_model = {
        let v = get(0).to_string();
        if v.is_empty() { "unknown CPU".to_string() } else { v }
    };

    let nagle = get(1);
    let dirty_ratio: u8 = if nagle == "1" { 5 } else { 20 };

    let disk_name = get(2);
    let disk_scheduler = if disk_name.is_empty() {
        "windows-default".to_string()
    } else {
        disk_name[..disk_name.len().min(30)].to_string()
    };
    // Detectar NVMe por nombre del disco — sin Get-StoragePool
    let nvme_queue_depth = if disk_scheduler.to_lowercase().contains("nvme") || disk_scheduler.to_lowercase().contains("ssd") {
        "32".to_string()
    } else {
        "64".to_string()
    };

    let audio_raw = get(3);
    let audio_server = if audio_raw.contains("Running") { "wasapi".to_string() } else { "unknown".to_string() };

    let lp = get(4);
    let hugepages = if lp == "0" { "always".to_string() } else { "madvise".to_string() };

    let max_mhz     = get(5).parse::<u32>().unwrap_or(0);
    let current_mhz = get(6).parse::<u32>().unwrap_or(0);

    let cpu_load = get(7);
    let load_avg = format!("{} {} {}", cpu_load, cpu_load, cpu_load);

    let gpu_raw = get(8);
    let gpu_model = if gpu_raw.is_empty() { "unknown GPU".to_string() } else { gpu_raw.to_string() };

    let distro_version = get(9).to_string();
    let kernel_version = get(10).to_string();

    let cpu_temp_celsius = read_cpu_temp_windows();

    // VisualFXSetting: 2 = mejor rendimiento, 1 = mejor apariencia, 0 = dejar que Windows decida, ausente = sin tocar (custom)
    let visual_effects = match get(11) {
        "2" => "performance".to_string(),
        ""  => "default".to_string(),
        _   => "appearance".to_string(),
    };
    // NetworkThrottlingIndex: 0xffffffff (4294967295) = sin límite, 10 (0xa) = valor por defecto de Windows
    let nti_raw = get(12);
    let network_throttling = if nti_raw == "4294967295" || nti_raw.to_lowercase() == "0xffffffff" {
        "unlimited".to_string()
    } else {
        "default".to_string()
    };
    // HwSchMode: 2 = GPU scheduling acelerado por hardware activado, 1/ausente = desactivado
    let gpu_hw_scheduling = if get(13) == "2" { "on".to_string() } else { "off".to_string() };
    let menu_show_delay = get(14).parse::<u32>().unwrap_or(400);
    // bcdedit devuelve "True"/"False" en texto cuando se usa -match en PowerShell
    let hpet_disabled = get(15).eq_ignore_ascii_case("false") || get(15).is_empty();
    let gamedvr_enabled = get(16) != "0"; // ausente o 1 = activado (valor por defecto de Windows)
    let sysmain_running = get(17).contains("Running");
    // AllowTelemetry ausente (sin política configurada) = 255 (centinela "sin gestionar",
    // no inventamos qué valor por defecto usaría esa instalación de Windows en concreto)
    let telemetry_level = get(18).parse::<u32>().unwrap_or(255);

    Ok(SystemScan {
        cpu_governor, cpu_cores,
        swappiness: 50, dirty_ratio, dirty_background_ratio: 10,
        disk_scheduler, audio_server, hugepages,
        numa_balancing: "0".to_string(),
        mem_total_mb, mem_available_mb, load_avg, nvme_queue_depth,
        irqbalance_active: false, // no aplica en Windows, irqbalance es un daemon de Linux
        on_battery: !ac_power_connected_native(),
        cpu_min_freq_mhz: current_mhz, cpu_max_freq_mhz: max_mhz,
        cpu_model, gpu_model,
        distro_id: "windows".to_string(), distro_version, kernel_version, cpu_temp_celsius,
        visual_effects, network_throttling, gpu_hw_scheduling, menu_show_delay,
        hpet_disabled, gamedvr_enabled, sysmain_running, telemetry_level,
        boot_time_seconds: 0.0, slowest_boot_service: "n/a".to_string(),
    })
}
