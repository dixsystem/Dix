// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.

//! Utilidades compartidas para invocar PowerShell desde Windows sin riesgo de
//! cuelgue. `powershell.exe` puede tardar indefinidamente en hardware con
//! antivirus agresivo, perfiles de usuario lentos o políticas de grupo
//! pesadas — nunca se debe esperar un proceso externo sin límite de tiempo.

#![cfg(target_os = "windows")]

use std::os::windows::process::CommandExt;
use std::process::{Command, Stdio};
use std::time::Duration;

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Ejecuta un script de PowerShell y devuelve su stdout (trimmed), o `None`
/// si el proceso no se pudo lanzar, no respondió dentro de `timeout`, o
/// terminó sin output.
///
/// Si se agota el timeout, el proceso se mata explícitamente vía `taskkill`
/// para no dejar `powershell.exe` huérfanos acumulándose en sistemas que
/// hacen polling frecuente (p. ej. métricas en vivo).
pub fn run_powershell(script: &str, timeout: Duration) -> Option<String> {
    let mut child = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .creation_flags(CREATE_NO_WINDOW)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .stdin(Stdio::null())
        .spawn()
        .ok()?;

    let pid = child.id();
    let (tx, rx) = std::sync::mpsc::channel::<std::io::Result<std::process::Output>>();
    std::thread::spawn(move || {
        let _ = tx.send(child.wait_with_output());
    });

    match rx.recv_timeout(timeout) {
        Ok(Ok(out)) if out.status.success() || !out.stdout.is_empty() => {
            let text = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if text.is_empty() { None } else { Some(text) }
        }
        Ok(_) => None,
        Err(_) => {
            // Timeout: el hilo que espera el proceso queda detrás, pero el
            // proceso en sí se mata para no acumular powershell.exe colgados.
            let _ = Command::new("taskkill")
                .args(["/F", "/PID", &pid.to_string()])
                .creation_flags(CREATE_NO_WINDOW)
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn();
            None
        }
    }
}
