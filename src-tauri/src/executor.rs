// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.

use std::fs;
use std::path::PathBuf;
use std::process::Command;
use serde::{Deserialize, Serialize};
use crate::scanner::SystemScan;

#[cfg(not(target_os = "windows"))]
use crate::policy;

// Construye un Command para pkexec inyectando las variables de entorno que el
// agente GNOME/Polkit necesita para localizar el bus de sesión y la pantalla.
#[cfg(not(target_os = "windows"))]
fn pkexec_cmd() -> Command {
    let mut cmd = Command::new("/usr/bin/pkexec");
    for var in &[
        "DISPLAY",
        "WAYLAND_DISPLAY",
        "XAUTHORITY",
        "DBUS_SESSION_BUS_ADDRESS",
        "XDG_RUNTIME_DIR",
        "XDG_SESSION_TYPE",
    ] {
        if let Ok(val) = std::env::var(var) {
            cmd.env(var, val);
        }
    }
    // Fallback: si DISPLAY vacío, asumir :0
    if std::env::var("DISPLAY").is_err() && std::env::var("WAYLAND_DISPLAY").is_err() {
        cmd.env("DISPLAY", ":0");
    }
    cmd
}

// ─── Tipos públicos ───────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
pub struct RollbackInfo {
    pub filename: String,
    pub timestamp: u64,
    pub date_human: String,
}

// ─── Rutas ────────────────────────────────────────────────────────────────────

fn rollbacks_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA")
            .unwrap_or_else(|_| r"C:\Users\Default\AppData\Roaming".to_string());
        return PathBuf::from(appdata).join("Dix").join("rollbacks");
    }
    #[cfg(not(target_os = "windows"))]
    {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
        PathBuf::from(home).join(".config").join("dix").join("rollbacks")
    }
}

// ─── Punto de entrada principal ───────────────────────────────────────────────

pub fn run_script(content: &str, pre_scan: &SystemScan) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    return run_script_windows(content, pre_scan);
    #[cfg(not(target_os = "windows"))]
    return run_script_linux(content, pre_scan);
}

// ─── Implementación Linux ─────────────────────────────────────────────────────

#[cfg(not(target_os = "windows"))]
fn run_script_linux(content: &str, pre_scan: &SystemScan) -> Result<String, String> {
    let violations = policy::validate_script(content);
    if !violations.is_empty() {
        let msgs: Vec<String> = violations
            .iter()
            .map(|v| format!("[{}] {}", v.rule, v.detail))
            .collect();
        return Err(format!(
            "Script bloqueado por política de seguridad:\n{}",
            msgs.join("\n")
        ));
    }

    let clean = strip_fences(content);
    let ts = epoch_secs();

    // Guardar rollback ANTES de ejecutar nada
    save_rollback(pre_scan, ts)?;

    let sysctl_conf = build_sysctl_conf(&clean);
    let boot_tweaks = build_boot_tweaks(&clean);
    let service_content =
        "[Unit]\nDescription=Dix - Apply boot optimizations\n\
         After=multi-user.target power-profiles-daemon.service thermald.service\n\
         \n[Service]\nType=oneshot\nRemainAfterExit=yes\n\
         ExecStart=/bin/bash /usr/local/lib/dix/boot-tweaks.sh\n\
         \n[Install]\nWantedBy=multi-user.target\n";
    let sleep_hook =
        "#!/bin/bash\n# Dix — Reaplicar optimizaciones tras resume\n\
         [ \"$1\" = \"post\" ] && /bin/bash /usr/local/lib/dix/boot-tweaks.sh\n";

    let opt_path      = format!("/tmp/dix_opt_{}.sh", ts);
    let sysctl_path   = format!("/tmp/dix_sysctl_{}.conf", ts);
    let boot_path     = format!("/tmp/dix_boot_{}.sh", ts);
    let service_path  = format!("/tmp/dix_service_{}.service", ts);
    let sleep_path    = format!("/tmp/dix_sleep_{}.sh", ts);
    let combined_path = format!("/tmp/dix_{}.sh", ts);

    fs::write(&opt_path, &clean).map_err(|e| format!("No se pudo escribir el script: {}", e))?;
    fs::write(&sysctl_path, &sysctl_conf).map_err(|e| format!("sysctl tmp: {}", e))?;
    fs::write(&boot_path, &boot_tweaks).map_err(|e| format!("boot tmp: {}", e))?;
    fs::write(&service_path, service_content).map_err(|e| format!("service tmp: {}", e))?;
    fs::write(&sleep_path, sleep_hook).map_err(|e| format!("sleep tmp: {}", e))?;

    // Script combinado — una sola autenticación para todo
    let combined = format!(
        "#!/bin/bash\n\
         echo '[Dix] Aplicando optimizaciones...'\n\
         bash {opt}\n\
         echo '[Dix] Guardando persistencia...'\n\
         /usr/bin/tee /etc/sysctl.d/99-dix.conf < {s} > /dev/null\n\
         mkdir -p /usr/local/lib/dix\n\
         /usr/bin/tee /usr/local/lib/dix/boot-tweaks.sh < {b} > /dev/null\n\
         chmod +x /usr/local/lib/dix/boot-tweaks.sh\n\
         /usr/bin/tee /etc/systemd/system/dix-boot.service < {sv} > /dev/null\n\
         /usr/bin/tee /lib/systemd/system-sleep/dix.sh < {sh} > /dev/null\n\
         chmod +x /lib/systemd/system-sleep/dix.sh\n\
         /sbin/sysctl -p /etc/sysctl.d/99-dix.conf 2>/dev/null || true\n\
         systemctl daemon-reload 2>/dev/null || true\n\
         systemctl enable --now dix-boot.service 2>/dev/null || true\n\
         echo '[Dix] Listo.'\n",
        opt = opt_path, s = sysctl_path, b = boot_path, sv = service_path, sh = sleep_path,
    );

    fs::write(&combined_path, &combined).map_err(|e| format!("script combinado: {}", e))?;
    Command::new("chmod").args(["+x", &combined_path]).output().ok();

    let output = pkexec_cmd()
        .args(["bash", &combined_path])
        .output()
        .map_err(|e| format!("/usr/bin/pkexec no disponible: {}", e))?;

    for p in &[&opt_path, &sysctl_path, &boot_path, &service_path, &sleep_path, &combined_path] {
        let _ = fs::remove_file(p);
    }

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let code = output.status.code().unwrap_or(-1);
        if code == 126 || code == 127 {
            Err("Autenticación cancelada.".to_string())
        } else {
            Err(format!("Script falló (código {}):\n{}{}", code, stdout, stderr))
        }
    }
}

// ─── Implementación Windows ───────────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn run_script_windows(content: &str, pre_scan: &SystemScan) -> Result<String, String> {
    let clean = strip_fences(content);
    let ts = epoch_secs();

    // Guardar rollback ANTES de ejecutar nada
    save_rollback(pre_scan, ts)?;

    let temp_dir = std::env::temp_dir();
    let script_path = temp_dir.join(format!("dix_{}.ps1", ts));

    fs::write(&script_path, &clean)
        .map_err(|e| format!("No se pudo escribir el script PS1: {}", e))?;

    // La app requiere elevación UAC al inicio (requestedExecutionLevel = requireAdministrator)
    // por lo que PowerShell hereda privilegios de administrador
    let output = Command::new("powershell")
        .args([
            "-ExecutionPolicy", "Bypass",
            "-NoProfile",
            "-NonInteractive",
            "-File",
            script_path.to_str().unwrap_or(""),
        ])
        .output()
        .map_err(|e| format!("PowerShell no disponible: {}", e))?;

    let _ = fs::remove_file(&script_path);

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let code = output.status.code().unwrap_or(-1);
        Err(format!(
            "Script falló (código {}):\n{}{}",
            code,
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        ))
    }
}

// ─── Sistema de rollback ──────────────────────────────────────────────────────

fn save_rollback(scan: &SystemScan, ts: u64) -> Result<(), String> {
    fs::create_dir_all(rollbacks_dir()).map_err(|e| e.to_string())?;
    let script = generate_rollback_script(scan, ts);

    #[cfg(target_os = "windows")]
    let filename = format!("rollback_{}.ps1", ts);
    #[cfg(not(target_os = "windows"))]
    let filename = format!("rollback_{}.sh", ts);

    let path = rollbacks_dir().join(&filename);
    fs::write(&path, &script).map_err(|e| format!("No se pudo guardar rollback: {}", e))?;
    prune_old_rollbacks();
    Ok(())
}

fn generate_rollback_script(scan: &SystemScan, ts: u64) -> String {
    #[cfg(target_os = "windows")]
    return generate_rollback_script_windows(scan, ts);
    #[cfg(not(target_os = "windows"))]
    return generate_rollback_script_linux(scan, ts);
}

#[cfg(not(target_os = "windows"))]
fn generate_rollback_script_linux(scan: &SystemScan, ts: u64) -> String {
    let date = format_unix_ts(ts);
    let lines: Vec<String> = vec![
        "#!/bin/bash".into(),
        format!("# Dix — Rollback generado el {}", date),
        "# Restaura el estado del sistema previo a la última optimización".into(),
        "# NO editar manualmente".into(),
        "set -e".into(),
        "echo 'Dix: restaurando configuración previa...'".into(),
        "".into(),
        "# ── CPU Governor ─────────────────────────────────────────────────".into(),
        format!(
            "for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do\n  echo {} > \"$cpu\" || true\ndone",
            scan.cpu_governor
        ),
        "".into(),
        "# ── Parámetros de memoria ────────────────────────────────────────".into(),
        format!("/sbin/sysctl -w vm.swappiness={} || true", scan.swappiness),
        format!("/sbin/sysctl -w vm.dirty_ratio={} || true", scan.dirty_ratio),
        format!("/sbin/sysctl -w vm.dirty_background_ratio={} || true", scan.dirty_background_ratio),
        "".into(),
        "# ── Scheduler de disco ───────────────────────────────────────────".into(),
        format!(
            "for dev in /sys/block/nvme* /sys/block/sd*; do\n  [ -f \"$dev/queue/scheduler\" ] && echo {} > \"$dev/queue/scheduler\" || true\ndone",
            scan.disk_scheduler
        ),
        "".into(),
        "# ── Transparent Hugepages ────────────────────────────────────────".into(),
        format!(
            "echo {} > /sys/kernel/mm/transparent_hugepage/enabled || true",
            scan.hugepages
        ),
        "".into(),
        "# ── NUMA balancing ───────────────────────────────────────────────".into(),
        format!("/sbin/sysctl -w kernel.numa_balancing={} || true", scan.numa_balancing),
        "".into(),
        "echo 'Rollback completado. Sistema restaurado al estado previo.'".into(),
    ];
    lines.join("\n")
}

#[cfg(target_os = "windows")]
fn generate_rollback_script_windows(scan: &SystemScan, ts: u64) -> String {
    let date = format_unix_ts(ts);

    // Mapear governor al GUID del plan de energía Windows
    let plan_guid = match scan.cpu_governor.as_str() {
        "ultimate-performance" => "e9a42b02-d5df-448d-aa00-03f14749eb61",
        "high-performance"     => "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c",
        "powersave"            => "a1841308-3541-4fab-bc81-f71556f20b4a",
        _                      => "381b4222-f694-41f0-9685-ff5bb260df2e", // balanced
    };

    // dirty_ratio <= 1 indica que Nagle ya estaba desactivado antes de la opt.
    let nagle_was_disabled = scan.dirty_ratio <= 1;

    let nagle_block = if nagle_was_disabled {
        "# Nagle ya estaba desactivado antes — sin cambios necesarios".to_string()
    } else {
        "# Restaurar Nagle — eliminar claves TcpAckFrequency/TCPNoDelay\n\
         $ifaces = Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces'\n\
         foreach ($iface in $ifaces) {\n\
         \tRemove-ItemProperty -Path $iface.PSPath -Name 'TcpAckFrequency' -ErrorAction SilentlyContinue\n\
         \tRemove-ItemProperty -Path $iface.PSPath -Name 'TCPNoDelay' -ErrorAction SilentlyContinue\n\
         }".to_string()
    };

    format!(
        "# Dix - Rollback PowerShell generado el {date}\n\
         # Restaura el estado del sistema previo a la ultima optimizacion\n\
         # NO editar manualmente\n\
         $ErrorActionPreference = 'Continue'\n\
         Write-Host '[Dix] Restaurando configuracion previa...'\n\
         \n\
         # -- Plan de energia --------------------------------------------------\n\
         Write-Host '[Dix] Restaurando plan de energia: {guid}'\n\
         powercfg /setactive {guid}\n\
         \n\
         # -- Algoritmo Nagle (TCP) --------------------------------------------\n\
         {nagle}\n\
         \n\
         Write-Host '[Dix] Rollback completado. Sistema restaurado al estado previo.'\n",
        date = date,
        guid = plan_guid,
        nagle = nagle_block,
    )
}

pub fn list_rollbacks() -> Vec<RollbackInfo> {
    let dir = rollbacks_dir();
    let Ok(entries) = fs::read_dir(&dir) else { return vec![]; };

    #[cfg(target_os = "windows")]
    let ext = ".ps1";
    #[cfg(not(target_os = "windows"))]
    let ext = ".sh";

    let mut infos: Vec<RollbackInfo> = entries
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            if !name.starts_with("rollback_") || !name.ends_with(ext) {
                return None;
            }
            let ts_str = name
                .strip_prefix("rollback_")?
                .strip_suffix(ext)?;
            let ts: u64 = ts_str.parse().ok()?;
            Some(RollbackInfo {
                filename: name,
                timestamp: ts,
                date_human: format_unix_ts(ts),
            })
        })
        .collect();

    infos.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    infos
}

pub fn execute_rollback(filename: &str) -> Result<String, String> {
    if !filename.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '.') {
        return Err("Nombre de rollback inválido.".to_string());
    }

    #[cfg(target_os = "windows")]
    return execute_rollback_windows(filename);
    #[cfg(not(target_os = "windows"))]
    return execute_rollback_linux(filename);
}

#[cfg(not(target_os = "windows"))]
fn execute_rollback_linux(filename: &str) -> Result<String, String> {
    if !filename.starts_with("rollback_") || !filename.ends_with(".sh") {
        return Err("Archivo de rollback inválido.".to_string());
    }

    let path = rollbacks_dir().join(filename);
    if !path.exists() {
        return Err(format!("Rollback no encontrado: {}", filename));
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("No se pudo leer rollback: {}", e))?;

    let violations = policy::validate_script(&content);
    if !violations.is_empty() {
        let msgs: Vec<String> = violations
            .iter()
            .map(|v| format!("[{}] {}", v.rule, v.detail))
            .collect();
        return Err(format!("Rollback bloqueado por política:\n{}", msgs.join("\n")));
    }

    let ts = epoch_secs();
    let tmp = format!("/tmp/dix_rollback_{}.sh", ts);
    fs::write(&tmp, &content).map_err(|e| format!("No se pudo preparar rollback: {}", e))?;
    Command::new("chmod").args(["+x", &tmp]).output().ok();

    let output = pkexec_cmd()
        .args(["bash", &tmp])
        .output()
        .map_err(|e| format!("pkexec no disponible: {}", e))?;

    let _ = fs::remove_file(&tmp);

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let code = output.status.code().unwrap_or(-1);
        if code == 126 || code == 127 {
            Err("Autenticación cancelada.".to_string())
        } else {
            Err(format!(
                "Rollback falló (código {}): {}",
                code,
                String::from_utf8_lossy(&output.stderr)
            ))
        }
    }
}

#[cfg(target_os = "windows")]
fn execute_rollback_windows(filename: &str) -> Result<String, String> {
    if !filename.starts_with("rollback_") || !filename.ends_with(".ps1") {
        return Err("Archivo de rollback inválido.".to_string());
    }

    let path = rollbacks_dir().join(filename);
    if !path.exists() {
        return Err(format!("Rollback no encontrado: {}", filename));
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("No se pudo leer rollback: {}", e))?;

    let ts = epoch_secs();
    let tmp = std::env::temp_dir().join(format!("dix_rollback_{}.ps1", ts));
    fs::write(&tmp, &content)
        .map_err(|e| format!("No se pudo preparar rollback: {}", e))?;

    let output = Command::new("powershell")
        .args([
            "-ExecutionPolicy", "Bypass",
            "-NoProfile",
            "-NonInteractive",
            "-File",
            tmp.to_str().unwrap_or(""),
        ])
        .output()
        .map_err(|e| format!("PowerShell no disponible: {}", e))?;

    let _ = fs::remove_file(&tmp);

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let code = output.status.code().unwrap_or(-1);
        Err(format!(
            "Rollback falló (código {}): {}",
            code,
            String::from_utf8_lossy(&output.stderr)
        ))
    }
}

fn prune_old_rollbacks() {
    let mut infos = list_rollbacks();
    if infos.len() <= 10 { return; }
    infos.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));
    for old in infos.iter().take(infos.len() - 10) {
        let _ = fs::remove_file(rollbacks_dir().join(&old.filename));
    }
}

// ─── Helpers Linux ────────────────────────────────────────────────────────────

#[cfg(not(target_os = "windows"))]
fn build_sysctl_conf(script: &str) -> String {
    let mut params: Vec<String> = Vec::new();
    for line in script.lines() {
        let t = line.trim();
        if t.is_empty() || t.starts_with('#') { continue; }
        let rest = if let Some(r) = t.strip_prefix("/sbin/sysctl ") { r }
                   else if let Some(r) = t.strip_prefix("sysctl ")   { r }
                   else                                               { continue };
        let kv = rest.strip_prefix("-w ").unwrap_or(rest).trim();
        let kv = kv.split("||").next().unwrap_or(kv).trim();
        if kv.contains('=') && !kv.contains(' ') {
            if let Some((k, v)) = kv.split_once('=') {
                params.push(format!("{} = {}", k.trim(), v.trim()));
            }
        }
    }
    if params.is_empty() {
        "# Dix - No sysctl parameters detected\n".to_string()
    } else {
        format!(
            "# Dix - Persistent sysctl parameters\n\
             # Auto-generated — do not edit manually\n\
             {}\n",
            params.join("\n")
        )
    }
}

#[cfg(not(target_os = "windows"))]
fn build_boot_tweaks(script: &str) -> String {
    let mut cmds: Vec<String> = vec![
        "#!/bin/bash".into(),
        "# Dix - Boot-time kernel tweaks".into(),
    ];
    for line in script.lines() {
        let t = line.trim();
        if t.is_empty() || t.starts_with('#') { continue; }
        if t.contains("scaling_governor") || t.contains("cpufreq")
            || t.contains("/sys/block/nvme")
            || (t.contains("irqbalance") && (t.contains("systemctl") || t.contains("service")))
        {
            cmds.push(t.to_string());
        }
    }
    format!("{}\n", cmds.join("\n"))
}

// ─── Helpers comunes ──────────────────────────────────────────────────────────

fn epoch_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn format_unix_ts(ts: u64) -> String {
    let secs = ts;
    let days_since_epoch = secs / 86400;
    let time_of_day = secs % 86400;
    let hh = time_of_day / 3600;
    let mm = (time_of_day % 3600) / 60;

    let mut y = 1970u64;
    let mut remaining_days = days_since_epoch;
    loop {
        let days_in_year = if y % 4 == 0 && (y % 100 != 0 || y % 400 == 0) { 366 } else { 365 };
        if remaining_days < days_in_year { break; }
        remaining_days -= days_in_year;
        y += 1;
    }
    let months = [31u64, if y % 4 == 0 && (y % 100 != 0 || y % 400 == 0) { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut m = 0usize;
    let mut d = remaining_days;
    for days in months.iter() {
        if d < *days { break; }
        d -= days;
        m += 1;
    }
    format!("{:04}-{:02}-{:02} {:02}:{:02}", y, m + 1, d + 1, hh, mm)
}

fn strip_fences(content: &str) -> String {
    let trimmed = content.trim();
    if let Some(start) = trimmed.find("```") {
        if let Some(newline) = trimmed[start..].find('\n') {
            let inner = start + newline + 1;
            if let Some(end) = trimmed[inner..].rfind("```") {
                return trimmed[inner..inner + end].trim().to_string();
            }
        }
    }
    trimmed.to_string()
}
