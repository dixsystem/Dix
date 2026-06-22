// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.

use std::fs;
use std::path::PathBuf;
use std::process::Command;
#[cfg(target_os = "windows")]
use std::time::Duration;
use serde::{Deserialize, Serialize};
use crate::scanner::SystemScan;

use crate::policy;
#[cfg(not(target_os = "windows"))]
use std::os::unix::fs::PermissionsExt;

// Catálogo determinista de mejoras reales en Linux — espejo de
// deterministic_tweaks_windows. No depende de lo que la IA improvise; cada
// línea es un comando conocido, idempotente (no repite si ya está aplicado),
// reversible y respeta las reglas inviolables de policy.rs (nunca toca GPU,
// nunca dirty_ratio>15, nunca hugepages=never, nunca numa_balancing=0).
#[cfg(not(target_os = "windows"))]
pub fn deterministic_tweaks_linux(scan: &SystemScan) -> Vec<String> {
    let mut lines = Vec::new();

    if scan.cpu_governor != "performance" {
        lines.push(
            "for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; \
             do echo performance > \"$cpu\" 2>/dev/null || true; done".to_string()
        );
    }
    if scan.swappiness > 10 {
        lines.push("/sbin/sysctl -w vm.swappiness=10 || true".to_string());
    }
    if scan.dirty_ratio > 15 {
        // Regla inviolable: nunca por encima de 15
        lines.push("/sbin/sysctl -w vm.dirty_ratio=10 || true".to_string());
    }
    if scan.dirty_background_ratio > 10 {
        lines.push("/sbin/sysctl -w vm.dirty_background_ratio=5 || true".to_string());
    }
    if scan.hugepages == "never" {
        // Regla inviolable: nunca dejarlo en "never"
        lines.push("echo madvise > /sys/kernel/mm/transparent_hugepage/enabled || true".to_string());
    }
    if scan.numa_balancing == "0" {
        // Regla inviolable: nunca establecer kernel.numa_balancing=0 — si ya está
        // así (lo dejó otra herramienta, o el hardware viene así), lo corregimos.
        lines.push("/sbin/sysctl -w kernel.numa_balancing=1 || true".to_string());
    }
    if !scan.irqbalance_active {
        lines.push("systemctl enable --now irqbalance 2>/dev/null || true".to_string());
    }

    lines
}

// Construye un Command para pkexec inyectando las variables de entorno que el
// agente GNOME/Polkit necesita para localizar el bus de sesión y la pantalla.
#[cfg(not(target_os = "windows"))]
pub(crate) fn pkexec_cmd() -> Command {
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

// ─── Ejecución privilegiada reutilizable ─────────────────────────────────────

#[cfg(not(target_os = "windows"))]
pub fn run_privileged_script(content: &str) -> Result<String, String> {
    let ts = epoch_secs();
    let dir = run_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::set_permissions(&dir, fs::Permissions::from_mode(0o700))
        .map_err(|e| e.to_string())?;
    let path = dir.join(format!("dix_priv_{}.sh", ts));
    fs::write(&path, content)
        .map_err(|e| format!("No se pudo escribir script privilegiado: {}", e))?;
    fs::set_permissions(&path, fs::Permissions::from_mode(0o500))
        .map_err(|e| e.to_string())?;

    let output = pkexec_cmd()
        .args(["bash", &path.to_string_lossy()])
        .output()
        .map_err(|e| format!("/usr/bin/pkexec no disponible: {}", e))?;
    let _ = fs::remove_file(&path);

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let code = output.status.code().unwrap_or(-1);
        if code == 126 || code == 127 {
            Err("Autenticación cancelada.".to_string())
        } else {
            Err(format!(
                "Script falló (código {}):\n{}{}",
                code,
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            ))
        }
    }
}

// ─── Tipos públicos ───────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
pub struct RollbackInfo {
    pub filename: String,
    pub timestamp: u64,
    pub date_human: String,
}

// ─── Rutas ────────────────────────────────────────────────────────────────────

pub(crate) fn rollbacks_dir() -> PathBuf {
    crate::memory::config_dir().join("rollbacks")
}

// Directorio privado para scripts de ejecución efímeros (0700)
#[cfg(not(target_os = "windows"))]
fn run_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home).join(".config").join("dix").join("run")
}

// ─── Punto de entrada principal ───────────────────────────────────────────────

pub fn run_script(content: &str, pre_scan: &SystemScan) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    return run_script_windows(content, pre_scan);
    #[cfg(not(target_os = "windows"))]
    return run_script_linux(content, pre_scan);
}

// Solo tiene sentido en Windows (Optimize-Volume sobre HDD); en Linux no hay
// ninguna optimización de mantenimiento de disco lenta en el catálogo actual.
pub fn run_disk_maintenance(content: &str) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    return run_disk_maintenance_windows(content);
    #[cfg(not(target_os = "windows"))]
    {
        let _ = content;
        Ok(String::new())
    }
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

    // Journal transaccional: queda registrado que esta transacción se
    // planeó y tiene un rollback asociado, antes de tocar nada del sistema.
    let rollback_filename = format!("rollback_{}.sh", ts);
    crate::journal::record_planned(ts, &rollback_filename);

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

    // Directorio privado 0700 — evita rutas predecibles en /tmp
    let dir = run_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::set_permissions(&dir, fs::Permissions::from_mode(0o700)).map_err(|e| e.to_string())?;

    let opt_path      = dir.join(format!("dix_opt_{}.sh", ts));
    let sysctl_path   = dir.join(format!("dix_sysctl_{}.conf", ts));
    let boot_path     = dir.join(format!("dix_boot_{}.sh", ts));
    let service_path  = dir.join(format!("dix_service_{}.service", ts));
    let sleep_path    = dir.join(format!("dix_sleep_{}.sh", ts));
    let combined_path = dir.join(format!("dix_{}.sh", ts));
    let boot_check_path        = dir.join(format!("dix_boot_check_{}.sh", ts));
    let boot_confirm_path      = dir.join(format!("dix_boot_confirm_{}.sh", ts));
    let boot_check_svc_path    = dir.join(format!("dix_boot_check_{}.service", ts));
    let boot_confirm_svc_path  = dir.join(format!("dix_boot_confirm_{}.service", ts));

    let write_secure = |path: &PathBuf, data: &str| -> Result<(), String> {
        fs::write(path, data).map_err(|e| format!("No se pudo escribir {}: {}", path.display(), e))?;
        fs::set_permissions(path, fs::Permissions::from_mode(0o500)).map_err(|e| e.to_string())
    };

    write_secure(&opt_path, &clean)?;
    write_secure(&sysctl_path, &sysctl_conf)?;
    write_secure(&boot_path, &boot_tweaks)?;
    write_secure(&service_path, service_content)?;
    write_secure(&sleep_path, sleep_hook)?;
    write_secure(&boot_check_path, crate::safe_mode::BOOT_CHECK_SCRIPT)?;
    write_secure(&boot_confirm_path, crate::safe_mode::BOOT_CONFIRM_SCRIPT)?;
    write_secure(&boot_check_svc_path, crate::safe_mode::BOOT_CHECK_SERVICE)?;
    write_secure(&boot_confirm_svc_path, crate::safe_mode::BOOT_CONFIRM_SERVICE)?;

    // Modo de rescate: instala la red de seguridad de arranque y deja
    // anotado que el rollback de ESTA transacción es el que hay que
    // restaurar si el sistema deja de arrancar bien tras este cambio.
    let rollback_abs_path = rollbacks_dir().join(&rollback_filename);
    let safe_mode_lines = crate::safe_mode::install_lines(
        &boot_check_path.to_string_lossy(),
        &boot_confirm_path.to_string_lossy(),
        &boot_check_svc_path.to_string_lossy(),
        &boot_confirm_svc_path.to_string_lossy(),
        &rollback_abs_path.to_string_lossy(),
    );

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
         echo '[Dix] Instalando red de seguridad de arranque...'\n\
         {safe_mode}\
         echo '[Dix] Listo.'\n",
        opt = opt_path.display(), s = sysctl_path.display(),
        b = boot_path.display(), sv = service_path.display(), sh = sleep_path.display(),
        safe_mode = safe_mode_lines,
    );

    write_secure(&combined_path, &combined)?;

    let output = pkexec_cmd()
        .args(["bash", combined_path.to_str().ok_or("ruta inválida")?])
        .output()
        .map_err(|e| format!("/usr/bin/pkexec no disponible: {}", e))?;

    for p in &[
        &opt_path, &sysctl_path, &boot_path, &service_path, &sleep_path, &combined_path,
        &boot_check_path, &boot_confirm_path, &boot_check_svc_path, &boot_confirm_svc_path,
    ] {
        let _ = fs::remove_file(p);
    }

    if output.status.success() {
        crate::journal::update_state(ts, crate::journal::TransactionState::Applied, None);
        // Verificación ligera: si el sistema sigue respondiendo a un re-scan,
        // la transacción se marca Verified. Si el re-scan falla, se deja en
        // Applied — `dix doctor` lo reportará como posible estado a medias.
        match crate::scanner::scan() {
            Ok(_) => crate::journal::update_state(ts, crate::journal::TransactionState::Verified, None),
            Err(e) => crate::journal::update_state(
                ts,
                crate::journal::TransactionState::Applied,
                Some(format!("Verificación post-aplicar falló: {}", e)),
            ),
        }
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let code = output.status.code().unwrap_or(-1);

        if code == 126 || code == 127 {
            // Autenticación cancelada antes de ejecutar nada: no hay nada que
            // revertir. La transacción se queda en Planned (correcto: nunca
            // llegó a aplicarse), no hace falta tocar pkexec otra vez.
            Err("Autenticación cancelada.".to_string())
        } else {
            // El script falló a mitad de camino: intentar revertir
            // automáticamente con el rollback ya guardado antes de tocar nada.
            crate::journal::update_state(
                ts,
                crate::journal::TransactionState::Applied,
                Some(format!("Falló con código {}, intentando rollback automático", code)),
            );
            match execute_rollback_linux(&rollback_filename) {
                Ok(_) => crate::journal::update_state(
                    ts,
                    crate::journal::TransactionState::RolledBack,
                    Some("Rollback automático tras fallo de aplicación".to_string()),
                ),
                Err(rollback_err) => crate::journal::update_state(
                    ts,
                    crate::journal::TransactionState::RollbackFailed,
                    Some(format!("Rollback automático también falló: {}", rollback_err)),
                ),
            }
            Err(format!("Script falló (código {}):\n{}{}", code, stdout, stderr))
        }
    }
}

// ─── Implementación Windows ───────────────────────────────────────────────────

// Ejecuta un .ps1 elevado vía Start-Process -Verb RunAs -Wait.
// Captura stdout+stderr en un archivo temporal porque el proceso elevado
// no hereda los handles de I/O del padre cuando se lanza con RunAs.
//
// `expected_sha256` es el hash calculado en Rust inmediatamente después de
// escribir el script ya validado. El wrapper —que corre YA elevado, después
// de que el usuario aprobó el diálogo de UAC— recalcula el hash del archivo
// y lo compara antes de ejecutar una sola línea. Si no coincide, aborta sin
// ejecutar nada: cierra la ventana de TOCTOU entre validar y ejecutar.
#[cfg(target_os = "windows")]
fn elevate_and_run_verified(script: &std::path::Path, timeout: Duration, expected_sha256: &str) -> Result<String, String> {
    let ts = epoch_secs();
    let temp_dir = run_dir_windows();
    let out_path  = temp_dir.join(format!("dix_{}_out.txt", ts));
    let wrap_path = temp_dir.join(format!("dix_{}_wrap.ps1", ts));

    // Wrapper: verifica integridad del script real ANTES de ejecutarlo (ya
    // con privilegios de administrador), y solo entonces vuelca su output.
    let wrap_content = format!(
        "$ErrorActionPreference = 'Continue'\n\
         $actualHash = (certutil -hashfile '{script}' SHA256 | Select-Object -Index 1).Trim().Replace(' ', '').ToLower()\n\
         if ($actualHash -ne '{expected}') {{\n\
         \t'[Dix] ABORTADO: el script fue modificado tras la validación (hash no coincide).' | Out-File -FilePath '{out}' -Encoding UTF8\n\
         \texit 87\n\
         }}\n\
         $out = & powershell.exe -ExecutionPolicy Bypass -NonInteractive \
         -File '{script}' 2>&1\n\
         $out | Out-File -FilePath '{out}' -Encoding UTF8\n",
        script = script.display().to_string().replace('\'', "''"),
        out = out_path.display().to_string().replace('\'', "''"),
        expected = expected_sha256,
    );
    fs::write(&wrap_path, &wrap_content)
        .map_err(|e| format!("No se pudo escribir wrapper de elevación: {}", e))?;

    let wrap_str = wrap_path.display().to_string().replace('\'', "''");
    let ps_cmd = format!(
        "Start-Process powershell.exe -Verb RunAs -Wait \
         -ArgumentList @('-ExecutionPolicy','Bypass','-NonInteractive','-File','{}')",
        wrap_str
    );

    use std::os::windows::process::CommandExt;
    use std::process::Stdio;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    let child = Command::new("powershell.exe")
        .args(["-ExecutionPolicy", "Bypass", "-NonInteractive", "-Command", &ps_cmd])
        .creation_flags(CREATE_NO_WINDOW)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null())
        .spawn()
        .map_err(|e| format!("powershell.exe no disponible: {}", e))?;

    let pid = child.id();
    let (tx, rx) = std::sync::mpsc::channel::<std::io::Result<std::process::Output>>();
    std::thread::spawn(move || {
        let mut child = child;
        let _ = tx.send(child.wait_with_output());
    });

    // Timeout parametrizable: da tiempo de sobra a que el usuario apruebe el
    // UAC y el script corra, pero evita que la app se congele para siempre si
    // el proceso elevado se cuelga (AV, política de grupo, etc.). El script
    // principal usa un timeout corto (~5 min); el de mantenimiento de disco
    // (Optimize-Volume en HDD) necesita uno mucho más largo porque su propia
    // duración esperada ya supera esos 5 min en discos mecánicos viejos.
    let wait_result = rx.recv_timeout(timeout);

    let _ = fs::remove_file(&wrap_path);

    let output = match wait_result {
        Ok(Ok(out)) => out,
        Ok(Err(e)) => return Err(format!("Error esperando el proceso elevado: {}", e)),
        Err(_) => {
            let _ = Command::new("taskkill")
                .args(["/F", "/T", "/PID", &pid.to_string()])
                .creation_flags(CREATE_NO_WINDOW)
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn();
            let _ = fs::remove_file(&out_path);
            return Err(format!(
                "El script de optimización tardó demasiado (más de {} min) y se ha cancelado. \
                 Comprueba el Administrador de tareas por si quedó algún proceso de PowerShell \
                 colgado, y vuelve a intentarlo.",
                timeout.as_secs() / 60
            ));
        }
    };

    let code = output.status.code().unwrap_or(-1);
    let captured = fs::read_to_string(&out_path).unwrap_or_default();
    let _ = fs::remove_file(&out_path);

    // El wrapper escribe este mensaje y sale ANTES de ejecutar el script real
    // si el hash de integridad no coincide — independientemente de cómo
    // Start-Process propague el código de salida del proceso elevado.
    if captured.starts_with("[Dix] ABORTADO") {
        return Err(
            "El script fue modificado después de validarse y antes de ejecutarse con \
             privilegios de administrador. Por seguridad, Dix ha abortado sin aplicar \
             ningún cambio. Vuelve a intentar la optimización.".to_string()
        );
    }

    match code {
        // 1223 = ERROR_CANCELLED (usuario rechazó UAC), 5 = ERROR_ACCESS_DENIED
        1223 | 5 => Err("Autenticación cancelada.".to_string()),
        0 => Ok(captured),
        c => Err(format!(
            "Script falló (código {}):\n{}{}",
            c, captured,
            String::from_utf8_lossy(&output.stderr)
        )),
    }
}

// Catálogo determinista de mejoras reales en Windows — NO depende de lo que la IA
// improvise. Cada línea es un comando conocido, probado, idempotente y reversible
// (el rollback ya guarda el scan previo en save_rollback). Solo emite la línea si
// el valor medido en el scan real no está ya en su óptimo, así que aplicar dos
// veces seguidas no hace nada en la segunda. Esto garantiza una mejora real y
// medible en cada "Aplicar", al margen de lo que el LLM decida añadir encima.
#[cfg(target_os = "windows")]
pub fn deterministic_tweaks_windows(scan: &SystemScan) -> Vec<String> {
    let mut lines = Vec::new();

    if scan.cpu_governor != "high-performance" && scan.cpu_governor != "ultimate-performance" {
        lines.push("powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c".to_string());
    }
    if scan.visual_effects != "performance" {
        lines.push(
            "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects' \
             -Name VisualFXSetting -Value 2 -Type DWord -ErrorAction SilentlyContinue".to_string()
        );
    }
    if scan.network_throttling != "unlimited" {
        lines.push(
            "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' \
             -Name NetworkThrottlingIndex -Value 0xffffffff -Type DWord -ErrorAction SilentlyContinue".to_string()
        );
    }
    if scan.gpu_hw_scheduling != "on" {
        lines.push(
            "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' \
             -Name HwSchMode -Value 2 -Type DWord -ErrorAction SilentlyContinue".to_string()
        );
    }
    if scan.menu_show_delay != 0 {
        lines.push(
            "Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name MenuShowDelay -Value '0' \
             -Type String -ErrorAction SilentlyContinue".to_string()
        );
    }
    if scan.dirty_ratio != 5 {
        lines.push(
            "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters' \
             -Name TcpAckFrequency -Value 1 -Type DWord -ErrorAction SilentlyContinue".to_string()
        );
    }
    if !scan.hpet_disabled {
        // No borra otras configuraciones de bcdedit, solo el override del reloj de plataforma
        lines.push("bcdedit /deletevalue useplatformclock".to_string());
    }
    if scan.gamedvr_enabled {
        lines.push(
            "Set-ItemProperty -Path 'HKCU:\\System\\GameConfigStore' -Name GameDVR_Enabled \
             -Value 0 -Type DWord -ErrorAction SilentlyContinue".to_string()
        );
    }
    if scan.sysmain_running && scan.nvme_queue_depth == "32" {
        // SysMain (Superfetch) ayuda en HDD con poca RAM; en SSD/NVMe (detectado por
        // nvme_queue_depth) solo añade I/O de fondo sin beneficio real. En HDD se deja
        // activo a propósito — desactivarlo ahí sería una regresión real, no una mejora.
        lines.push("Stop-Service -Name SysMain -Force -ErrorAction SilentlyContinue".to_string());
        lines.push("Set-Service -Name SysMain -StartupType Disabled -ErrorAction SilentlyContinue".to_string());
    }
    if scan.telemetry_level != 1 {
        lines.push(
            "New-Item -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' \
             -Force -ErrorAction SilentlyContinue | Out-Null".to_string()
        );
        lines.push(
            "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' \
             -Name AllowTelemetry -Value 1 -Type DWord -ErrorAction SilentlyContinue".to_string()
        );
    }

    lines
}

// Carpeta privada para scripts elevados en Windows — equivalente al 0700
// de Linux. icacls quita la herencia y deja solo al usuario actual con
// control total, para que otro proceso del mismo sistema (sin ser el mismo
// usuario, o un proceso de baja integridad) no pueda escribir aquí mientras
// el usuario está respondiendo al diálogo de UAC.
#[cfg(target_os = "windows")]
fn run_dir_windows() -> PathBuf {
    let base = std::env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir());
    let dir = base.join("Dix").join("run");
    let _ = fs::create_dir_all(&dir);
    let _ = Command::new("icacls")
        .args([
            dir.to_string_lossy().as_ref(),
            "/inheritance:r",
            "/grant:r",
            &format!("{}:(OI)(CI)F", whoami_windows()),
        ])
        .output();
    dir
}

#[cfg(target_os = "windows")]
fn whoami_windows() -> String {
    std::env::var("USERNAME").unwrap_or_else(|_| "%USERNAME%".to_string())
}

// SHA256 vía certutil (incluido en Windows desde XP, sin añadir dependencias
// de hashing a Cargo). Se calcula justo tras escribir el script ya validado,
// y el propio wrapper elevado (ver elevate_and_run_verified) lo recalcula
// justo antes de ejecutar el script real, ya dentro del proceso con permisos
// de administrador — el punto más tardío posible antes de correr el código.
// Si no coincide, algo modificó el archivo durante el diálogo de UAC y se
// aborta sin ejecutar nada.
#[cfg(target_os = "windows")]
fn certutil_sha256(path: &std::path::Path) -> Result<String, String> {
    let output = Command::new("certutil")
        .args(["-hashfile", &path.to_string_lossy(), "SHA256"])
        .output()
        .map_err(|e| format!("certutil no disponible: {}", e))?;
    let text = String::from_utf8_lossy(&output.stdout);
    text.lines()
        .nth(1)
        .map(|l| l.trim().replace(' ', "").to_lowercase())
        .filter(|h| h.len() == 64 && h.chars().all(|c| c.is_ascii_hexdigit()))
        .ok_or_else(|| "No se pudo calcular el hash de integridad del script".to_string())
}

#[cfg(target_os = "windows")]
fn run_script_windows(content: &str, pre_scan: &SystemScan) -> Result<String, String> {
    let clean = strip_fences(content);

    let violations = policy::validate_script_windows(&clean);
    if !violations.is_empty() {
        let msgs: Vec<String> = violations
            .iter()
            .map(|v| format!("[{}] {}", v.rule, v.detail))
            .collect();
        return Err(format!("Script bloqueado por política:\n{}", msgs.join("\n")));
    }

    let ts = epoch_secs();

    save_rollback(pre_scan, ts)?;

    let temp_dir = run_dir_windows();
    let script_path = temp_dir.join(format!("dix_{}.ps1", ts));
    fs::write(&script_path, &clean)
        .map_err(|e| format!("No se pudo escribir el script PS1: {}", e))?;

    // Hash tomado AHORA, justo tras escribir el contenido ya validado —
    // la ventana entre este punto y la ejecución elevada queda protegida.
    let expected_hash = certutil_sha256(&script_path)?;

    let result = elevate_and_run_verified(&script_path, Duration::from_secs(300), &expected_hash);
    let _ = fs::remove_file(&script_path);
    result
}

// Optimizaciones de disco lentas pero legítimas (p.ej. Optimize-Volume -Defrag
// sobre un HDD mecánico) se ejecutan aparte del script principal, con su propio
// timeout largo. Así un disco viejo que tarda 20-30 min no dispara el timeout
// de 5 min pensado para el resto de tweaks (rápidos por naturaleza), y la app
// no informa un "error" falso mientras el disco sigue trabajando de verdad.
#[cfg(target_os = "windows")]
pub fn run_disk_maintenance_windows(content: &str) -> Result<String, String> {
    let clean = strip_fences(content);
    let ts = epoch_secs();

    let temp_dir = run_dir_windows();
    let script_path = temp_dir.join(format!("dix_maint_{}.ps1", ts));
    fs::write(&script_path, &clean)
        .map_err(|e| format!("No se pudo escribir el script de mantenimiento: {}", e))?;
    let expected_hash = certutil_sha256(&script_path)?;

    let result = elevate_and_run_verified(&script_path, Duration::from_secs(2400), &expected_hash);
    let _ = fs::remove_file(&script_path);
    result
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

    let violations = policy::validate_script_windows(&content);
    if !violations.is_empty() {
        let msgs: Vec<String> = violations
            .iter()
            .map(|v| format!("[{}] {}", v.rule, v.detail))
            .collect();
        return Err(format!("Rollback bloqueado por política:\n{}", msgs.join("\n")));
    }

    let ts = epoch_secs();
    let tmp = run_dir_windows().join(format!("dix_rollback_{}.ps1", ts));
    fs::write(&tmp, &content)
        .map_err(|e| format!("No se pudo preparar rollback: {}", e))?;
    let expected_hash = certutil_sha256(&tmp)?;

    let result = elevate_and_run_verified(&tmp, Duration::from_secs(300), &expected_hash);
    let _ = fs::remove_file(&tmp);
    result
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

pub(crate) fn epoch_secs() -> u64 {
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

#[cfg(test)]
mod determinism_tests {
    use super::*;

    fn base_scan() -> SystemScan {
        SystemScan {
            cpu_governor: "performance".to_string(), cpu_cores: 8,
            swappiness: 10, dirty_ratio: 10, dirty_background_ratio: 5,
            disk_scheduler: "none".to_string(), audio_server: "pipewire".to_string(),
            hugepages: "madvise".to_string(), numa_balancing: "1".to_string(),
            mem_total_mb: 16384, mem_available_mb: 8192,
            load_avg: "1 1 1".to_string(), nvme_queue_depth: "32".to_string(),
            irqbalance_active: true, on_battery: false, cpu_min_freq_mhz: 800, cpu_max_freq_mhz: 4800,
            cpu_model: "Test CPU".to_string(), gpu_model: "Test GPU".to_string(),
            distro_id: "linux".to_string(), distro_version: "test".to_string(),
            kernel_version: "6.0".to_string(), cpu_temp_celsius: 50.0,
            visual_effects: "n/a".to_string(), network_throttling: "n/a".to_string(),
            gpu_hw_scheduling: "n/a".to_string(), menu_show_delay: 0,
            hpet_disabled: false, gamedvr_enabled: false, sysmain_running: false, telemetry_level: 0,
            boot_time_seconds: 0.0, slowest_boot_service: "n/a".to_string(),
        }
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn linux_tweaks_idempotent_when_already_optimal() {
        let lines = deterministic_tweaks_linux(&base_scan());
        assert!(lines.is_empty(), "No debería sugerir nada sobre un sistema ya óptimo: {:?}", lines);
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn linux_tweaks_fix_violations_of_inviolable_rules() {
        let mut scan = base_scan();
        scan.numa_balancing = "0".to_string(); // viola la regla inviolable
        scan.hugepages = "never".to_string();  // viola la regla inviolable
        scan.dirty_ratio = 30;                  // viola la regla inviolable (>15)
        let lines = deterministic_tweaks_linux(&scan);
        let joined = lines.join("\n");
        assert!(joined.contains("numa_balancing=1"));
        assert!(joined.contains("madvise"));
        assert!(joined.contains("dirty_ratio=10"));
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn linux_tweaks_never_violate_policy() {
        let mut scan = base_scan();
        scan.cpu_governor = "powersave".to_string();
        scan.swappiness = 60;
        scan.dirty_ratio = 30;
        scan.dirty_background_ratio = 20;
        scan.hugepages = "never".to_string();
        scan.numa_balancing = "0".to_string();
        scan.irqbalance_active = false;
        let lines = deterministic_tweaks_linux(&scan);
        let script = lines.join("\n");
        let violations = crate::policy::validate_script(&script);
        assert!(violations.is_empty(), "El catálogo determinista no debería violar nunca la política: {:?}", violations);
    }
}
