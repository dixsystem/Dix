// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.

//! Gestión de programas de inicio — la optimización con más impacto sensible
//! real (arranque más rápido, RAM libre desde el primer segundo) y la más
//! delicada (hay software de fondo que parece "no se usa" pero es crítico:
//! antivirus, sincronización en la nube, VPN, drivers de audio/GPU).
//!
//! Por eso NUNCA se decide solo, ni siquiera lo "seguro": esto solo expone
//! datos reales y una clasificación de confianza. La decisión de aplicar (qué
//! checkbox marcar) la toma siempre el usuario desde la UI — ver App.tsx.
//! Desactivar nunca borra ni desinstala nada: siempre es un flag reversible.

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum StartupTrust {
    /// Entrada huérfana (el ejecutable ya no existe en disco) — limpieza pura, cero riesgo.
    Orphan,
    /// Catálogo conocido de bloatware — preseleccionado en la UI, pero el usuario confirma.
    Safe,
    /// No reconocido — visible pero NUNCA preseleccionado, el usuario debe marcarlo a propósito.
    Review,
    /// Coincide con patrones críticos (antivirus, drivers, nube, VPN) — ni se lista como opción.
    NeverTouch,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct StartupItem {
    pub id: String,           // identificador único para activar/desactivar (formato interno por plataforma)
    pub name: String,
    pub command: String,
    pub location: String,     // de dónde viene (Run/HKCU, Startup Folder, autostart .desktop, systemd --user...)
    pub trust: StartupTrust,
    pub enabled: bool,
    pub exists_on_disk: bool,
}

// Catálogo de nombres conocidos — substring match, case-insensitive. Mismo
// catálogo conceptual en ambas plataformas, el formato real del nombre varía.
const SAFE_PATTERNS: &[&str] = &[
    "adobe updater", "adobe arm", "adobereader_de", "jusched", "sunjavaupdatesched",
    "hp support assistant", "dell supportassist", "lenovo vantage", "asus giftbox",
    "msi center", "realtek update", "skypeupdate", "googleupdate", "mcupdate",
    "epson", "canon my printer", "brother status monitor", "qttask",
];

const NEVER_TOUCH_PATTERNS: &[&str] = &[
    "defender", "msmpeng", "antivirus", "avast", "avg", "bitdefender", "kaspersky",
    "eset", "malwarebytes", "norton", "mcafee security",
    "onedrive", "dropbox", "google drive", "googledrive", "box sync", "nextcloud",
    "nordvpn", "expressvpn", "openvpn", "wireguard", "protonvpn", "surfshark",
    "realtek hd audio", "ravcpl", "nahimic", "audio enhancer",
    "nvidia container", "nvidia tray", "amd software", "intel graphics",
    "logitech", "razer synapse", "steelseries", "corsair",
    "networkmanager", "nm-applet", "pulseaudio", "pipewire", "wireplumber",
    "ibus", "fcitx", "bluetooth",
];

fn classify(name: &str, command: &str, exists_on_disk: bool) -> StartupTrust {
    if !exists_on_disk {
        return StartupTrust::Orphan;
    }
    let haystack = format!("{} {}", name, command).to_lowercase();
    if NEVER_TOUCH_PATTERNS.iter().any(|p| haystack.contains(p)) {
        return StartupTrust::NeverTouch;
    }
    if SAFE_PATTERNS.iter().any(|p| haystack.contains(p)) {
        return StartupTrust::Safe;
    }
    StartupTrust::Review
}

pub fn scan_startup_items() -> Vec<StartupItem> {
    #[cfg(target_os = "windows")]
    return scan_windows();
    #[cfg(not(target_os = "windows"))]
    return scan_linux();
}

pub fn set_enabled(id: &str, enabled: bool) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    return set_enabled_windows(id, enabled);
    #[cfg(not(target_os = "windows"))]
    return set_enabled_linux(id, enabled);
}

// ═════════════════════════════════════════════════════════════════════════════
// LINUX — autostart XDG (~/.config/autostart, /etc/xdg/autostart) + systemd --user
// ═════════════════════════════════════════════════════════════════════════════

#[cfg(not(target_os = "windows"))]
fn autostart_dirs() -> Vec<std::path::PathBuf> {
    let mut dirs = vec![std::path::PathBuf::from("/etc/xdg/autostart")];
    if let Some(home) = dirs::home_dir() {
        dirs.push(home.join(".config/autostart"));
    }
    dirs
}

// Resuelve el ejecutable real a partir de la línea Exec= de un .desktop,
// quitando los placeholders de campo (%f, %U, etc.) que define la spec XDG.
#[cfg(not(target_os = "windows"))]
fn resolve_exec_path(exec: &str) -> Option<std::path::PathBuf> {
    let bin = exec.split_whitespace().next()?;
    if bin.starts_with('/') {
        return Some(std::path::PathBuf::from(bin));
    }
    std::env::var("PATH").ok()?.split(':').find_map(|dir| {
        let candidate = std::path::Path::new(dir).join(bin);
        candidate.is_file().then_some(candidate)
    })
}

#[cfg(not(target_os = "windows"))]
fn scan_linux() -> Vec<StartupItem> {
    let mut items = Vec::new();

    for dir in autostart_dirs() {
        let Ok(entries) = std::fs::read_dir(&dir) else { continue; };
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("desktop") { continue; }
            let Ok(content) = std::fs::read_to_string(&path) else { continue; };

            let get = |key: &str| -> Option<String> {
                content.lines()
                    .find(|l| l.starts_with(&format!("{}=", key)))
                    .map(|l| l.splitn(2, '=').nth(1).unwrap_or("").trim().to_string())
            };

            let name = get("Name").unwrap_or_else(|| path.file_stem().unwrap().to_string_lossy().to_string());
            let exec = get("Exec").unwrap_or_default();
            let hidden = get("Hidden").map(|v| v == "true").unwrap_or(false)
                || get("X-GNOME-Autostart-enabled").map(|v| v == "false").unwrap_or(false);
            let exists_on_disk = resolve_exec_path(&exec).map(|p| p.is_file()).unwrap_or(false);

            items.push(StartupItem {
                id: path.to_string_lossy().to_string(),
                name: name.clone(),
                command: exec.clone(),
                location: format!("autostart: {}", dir.display()),
                trust: classify(&name, &exec, exists_on_disk),
                enabled: !hidden,
                exists_on_disk,
            });
        }
    }

    items
}

// Desactivar = añadir "Hidden=true" al .desktop (mecanismo estándar XDG, NO se
// borra el fichero). Reactivar = quitar esa línea. 100% reversible.
#[cfg(not(target_os = "windows"))]
fn set_enabled_linux(id: &str, enabled: bool) -> Result<String, String> {
    let path = std::path::Path::new(id);
    if !path.is_file() {
        return Err(format!("No se encontró el fichero de autostart: {}", id));
    }
    let content = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    let mut lines: Vec<String> = content.lines()
        .filter(|l| !l.starts_with("Hidden=") && !l.starts_with("X-GNOME-Autostart-enabled="))
        .map(|l| l.to_string())
        .collect();
    if !enabled {
        lines.push("Hidden=true".to_string());
    }
    std::fs::write(path, lines.join("\n") + "\n").map_err(|e| e.to_string())?;
    Ok(format!("{} {}", id, if enabled { "reactivado" } else { "desactivado" }))
}

// ═════════════════════════════════════════════════════════════════════════════
// WINDOWS — Run keys (HKLM/HKCU) + carpeta de inicio, vía Win32_StartupCommand
// ═════════════════════════════════════════════════════════════════════════════

#[cfg(target_os = "windows")]
fn scan_windows() -> Vec<StartupItem> {
    use std::time::Duration;

    // Win32_StartupCommand cubre Run/RunOnce (HKLM+HKCU) y la carpeta de inicio.
    // Quedan fuera las tareas programadas con disparador de inicio de sesión —
    // gap conocido y documentado, no se finge cubrirlo.
    let script = "Get-CimInstance Win32_StartupCommand | ForEach-Object { \
        \"$($_.Name)|$($_.Command)|$($_.Location)\" }";
    let out = crate::winutil::run_powershell(script, Duration::from_secs(8)).unwrap_or_default();

    let mut items = Vec::new();
    for line in out.lines() {
        let parts: Vec<&str> = line.splitn(3, '|').collect();
        if parts.len() < 3 { continue; }
        let (name, command, location) = (parts[0].trim(), parts[1].trim(), parts[2].trim());
        if name.is_empty() { continue; }

        let exe_path = extract_exe_path(command);
        let exists_on_disk = exe_path.as_ref().map(|p| p.is_file()).unwrap_or(true); // si no se pudo parsear, no asumimos huérfano

        items.push(StartupItem {
            id: format!("{}::{}", location, name),
            name: name.to_string(),
            command: command.to_string(),
            location: location.to_string(),
            trust: classify(name, command, exists_on_disk),
            enabled: true, // Win32_StartupCommand solo lista las que están activas
            exists_on_disk,
        });
    }
    items
}

#[cfg(target_os = "windows")]
fn extract_exe_path(command: &str) -> Option<std::path::PathBuf> {
    let trimmed = command.trim();
    let raw = if trimmed.starts_with('"') {
        trimmed[1..].split('"').next()?
    } else {
        trimmed.split_whitespace().next()?
    };
    Some(std::path::PathBuf::from(raw))
}

// Réplica del mecanismo nativo de "Deshabilitar" del Administrador de tareas:
// escribe un valor binario de 12 bytes en StartupApproved\Run (o \StartupFolder
// si viene de la carpeta de inicio) — primer byte 0x02=habilitado, 0x03=deshabilitado.
// El valor original en Run/la carpeta de inicio NO se toca ni se borra: Windows
// respeta este flag y simplemente no lo ejecuta. 100% reversible, mismo mecanismo
// que vería el usuario en el Administrador de tareas.
#[cfg(target_os = "windows")]
fn set_enabled_windows(id: &str, enabled: bool) -> Result<String, String> {
    use std::time::Duration;

    let Some((location, name)) = id.split_once("::") else {
        return Err(format!("Id de programa de inicio inválido: {}", id));
    };

    let (hive, subkey) = if location.contains("Startup Folder") {
        let hive = if location.to_uppercase().contains("HKLM") { "HKLM" } else { "HKCU" };
        (hive, "StartupFolder")
    } else if location.to_uppercase().contains("HKLM") {
        ("HKLM", "Run")
    } else {
        ("HKCU", "Run")
    };

    let flag = if enabled { "0x02" } else { "0x03" };
    let script = format!(
        "$path = '{hive}:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\{subkey}'; \
         if (!(Test-Path $path)) {{ New-Item -Path $path -Force | Out-Null }}; \
         $bytes = [byte[]]({flag},0,0,0,0,0,0,0,0,0,0,0); \
         Set-ItemProperty -Path $path -Name '{name}' -Value $bytes -Type Binary -ErrorAction Stop; \
         Write-Output OK",
        hive = hive, subkey = subkey, flag = flag, name = name.replace('\'', "''"),
    );

    match crate::winutil::run_powershell(&script, Duration::from_secs(8)) {
        Some(out) if out.trim() == "OK" => Ok(format!(
            "{} {}", name, if enabled { "reactivado" } else { "desactivado" }
        )),
        _ => Err(format!("No se pudo {} '{}'", if enabled { "reactivar" } else { "desactivar" }, name)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn orphan_takes_priority_over_everything() {
        assert_eq!(classify("Defender Update", "C:\\nope.exe", false), StartupTrust::Orphan);
    }

    #[test]
    fn never_touch_detects_antivirus_and_cloud() {
        assert_eq!(classify("Windows Defender", "MsMpEng.exe", true), StartupTrust::NeverTouch);
        assert_eq!(classify("OneDrive", "OneDrive.exe /background", true), StartupTrust::NeverTouch);
        assert_eq!(classify("NordVPN", "nordvpn.exe", true), StartupTrust::NeverTouch);
    }

    #[test]
    fn safe_detects_known_bloat() {
        assert_eq!(classify("Adobe Updater", "AdobeARM.exe", true), StartupTrust::Safe);
        assert_eq!(classify("Java Update Scheduler", "jusched.exe", true), StartupTrust::Safe);
    }

    #[test]
    fn unknown_goes_to_review_never_preselected() {
        assert_eq!(classify("MyRandomApp", "myrandomapp.exe --tray", true), StartupTrust::Review);
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn resolve_exec_path_strips_xdg_placeholders() {
        let p = resolve_exec_path("/bin/echo %f");
        assert_eq!(p, Some(std::path::PathBuf::from("/bin/echo")));
    }
}
