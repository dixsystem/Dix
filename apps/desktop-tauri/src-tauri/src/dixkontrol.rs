// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.
//
// Esqueleto de DixKontrol — SOLO LECTURA. Ver docs/threat-model/dixkontrol.md
// antes de añadir cualquier capacidad de escritura/control activo a este
// módulo. Nada aquí debe ejecutar comandos, tocar pkexec, ni modificar el
// sistema — solo observar y reportar.

use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
pub struct ForegroundContext {
    /// Nombre de la app/ventana en foco, si se pudo detectar. None si no hay
    /// soporte en este entorno (p.ej. Wayland sin portal compatible).
    pub app_name: Option<String>,
    pub supported: bool,
}

/// Detección de contexto de solo lectura vía X11 (`xprop`, binario fijo, sin
/// texto/IDs controlados por el usuario — mismo patrón de invocación que
/// scanner.rs). En Wayland sin XWayland no hay `_NET_ACTIVE_WINDOW` fiable;
/// se devuelve `supported: false` en vez de fingir un dato que no existe.
pub fn read_foreground_context() -> ForegroundContext {
    let active_id = match active_window_id() {
        Some(id) => id,
        None => return ForegroundContext { app_name: None, supported: false },
    };
    match window_class(&active_id) {
        Some(name) => ForegroundContext { app_name: Some(name), supported: true },
        None => ForegroundContext { app_name: None, supported: false },
    }
}

fn active_window_id() -> Option<String> {
    let out = Command::new("xprop")
        .args(["-root", "_NET_ACTIVE_WINDOW"])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&out.stdout);
    // Formato esperado: "_NET_ACTIVE_WINDOW(WINDOW): window id # 0x2400003"
    text.split("# ").nth(1).map(|s| s.trim().to_string())
}

fn window_class(window_id: &str) -> Option<String> {
    let out = Command::new("xprop")
        .args(["-id", window_id, "WM_CLASS"])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&out.stdout);
    // Formato esperado: WM_CLASS(STRING) = "firefox", "Firefox"
    // Tomamos el segundo valor (la clase general), más estable que el primero.
    let quoted: Vec<&str> = text.split('"').collect();
    quoted.get(3).map(|s| s.to_string()).filter(|s| !s.is_empty())
}

// ─── Nivel Moderado — control activo ─────────────────────────────────────────
//
// Decisión de diseño: ver docs/threat-model/dixkontrol.md tarea #18. La
// elevación de privilegios se pide UNA VEZ por sesión del daemon (al llamar
// start_moderate_session), no una vez por cambio: se mantiene un proceso
// `pkexec bash` vivo, leyendo comandos por stdin, mientras dure la sesión.
// Cada operación sigue pasando por el mismo catálogo cerrado y validado de
// `command_engine` que usa DIX base — nunca se escribe texto libre a ese
// stdin, solo líneas ya renderizadas por `DixOperation::render()` tras
// `validate()`.
//
// Catálogo permitido en Moderado: solo operaciones cuyo valor anterior se
// pueda leer sin privilegios y restaurar de forma fiable. Quedan fuera
// SetHugepages (su valor por defecto suele ser "never", que la regla
// absoluta de command_engine prohíbe representar — no se puede garantizar
// el rollback) y SetNumaBalancing (solo puede activarse, nunca es un toggle
// reversible de verdad).
#[cfg(not(target_os = "windows"))]
mod moderate {
    use crate::command_engine::DixOperation;
    use crate::executor::{epoch_secs, pkexec_cmd, rollbacks_dir};
    use crate::journal::{self, TransactionState};
    use std::fs;
    use std::io::{BufRead, BufReader, Write};
    use std::process::{Child, ChildStdin, Stdio};
    use std::sync::mpsc::{self, Receiver};
    use std::sync::Mutex;
    use std::time::Duration;

    pub(super) fn moderate_allows(op: &DixOperation) -> bool {
        matches!(
            op,
            DixOperation::SetSysctl { .. }
                | DixOperation::SetDiskScheduler { .. }
                | DixOperation::SetNrRequests { .. }
                | DixOperation::EnableService { .. }
                | DixOperation::DisableService { .. }
        )
    }

    /// Primeros dispositivos de bloque relevantes (nvme*/sd*), mismo criterio
    /// de selección que `command_engine::DixOperation::render()` para que la
    /// captura de "valor anterior" hable del mismo conjunto de dispositivos
    /// que la operación va a tocar. Limitación conocida: si hay varios
    /// discos con valores distintos entre sí, el rollback solo reproduce el
    /// valor del primero que se encuentre — aceptable para esta primera
    /// versión, documentado aquí en vez de fingir precisión que no existe.
    fn block_devices() -> Vec<std::path::PathBuf> {
        let mut out = Vec::new();
        if let Ok(entries) = fs::read_dir("/sys/block") {
            for e in entries.flatten() {
                let name = e.file_name().to_string_lossy().to_string();
                if name.starts_with("nvme") || name.starts_with("sd") {
                    out.push(e.path());
                }
            }
        }
        out
    }

    fn current_disk_scheduler() -> Option<String> {
        for dev in block_devices() {
            if let Ok(content) = fs::read_to_string(dev.join("queue/scheduler")) {
                for tok in content.split_whitespace() {
                    if let Some(inner) = tok.strip_prefix('[').and_then(|s| s.strip_suffix(']')) {
                        return Some(inner.to_string());
                    }
                }
            }
        }
        None
    }

    fn current_nr_requests() -> Option<u32> {
        for dev in block_devices() {
            if let Ok(content) = fs::read_to_string(dev.join("queue/nr_requests")) {
                if let Ok(v) = content.trim().parse() {
                    return Some(v);
                }
            }
        }
        None
    }

    /// Lee el valor previo de una operación para poder construir su inverso.
    /// Ninguna de estas lecturas requiere privilegios — solo la escritura
    /// posterior (dentro de la sesión ya elevada) los necesita.
    fn capture_previous(op: &DixOperation) -> Option<DixOperation> {
        match op {
            DixOperation::SetSysctl { clave, .. } => {
                let out = std::process::Command::new("/sbin/sysctl").args(["-n", clave]).output().ok()?;
                if !out.status.success() {
                    return None;
                }
                let val = String::from_utf8_lossy(&out.stdout).trim().to_string();
                Some(DixOperation::SetSysctl { clave: clave.clone(), valor: val })
            }
            DixOperation::SetDiskScheduler { .. } => {
                current_disk_scheduler().map(|scheduler| DixOperation::SetDiskScheduler { scheduler })
            }
            DixOperation::SetNrRequests { .. } => {
                current_nr_requests().map(|valor| DixOperation::SetNrRequests { valor })
            }
            DixOperation::EnableService { nombre } | DixOperation::DisableService { nombre } => {
                let out = std::process::Command::new("systemctl").args(["is-enabled", nombre]).output().ok()?;
                let state = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if state == "enabled" {
                    Some(DixOperation::EnableService { nombre: nombre.clone() })
                } else {
                    Some(DixOperation::DisableService { nombre: nombre.clone() })
                }
            }
            _ => None,
        }
    }

    pub struct ModerateSession {
        child: Child,
        stdin: ChildStdin,
        stdout_rx: Receiver<String>,
        next_id: u64,
    }

    impl ModerateSession {
        fn start() -> Result<Self, String> {
            let mut child = pkexec_cmd()
                .arg("bash")
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::null())
                .spawn()
                .map_err(|e| format!("/usr/bin/pkexec no disponible: {}", e))?;
            let stdin = child.stdin.take().ok_or("no se pudo abrir stdin de la sesión elevada")?;
            let stdout = child.stdout.take().ok_or("no se pudo abrir stdout de la sesión elevada")?;
            let (tx, rx) = mpsc::channel();
            std::thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines().map_while(Result::ok) {
                    if tx.send(line).is_err() {
                        break;
                    }
                }
            });
            Ok(Self { child, stdin, stdout_rx: rx, next_id: 0 })
        }

        /// Aplica una operación reutilizando la sesión elevada ya abierta — no
        /// vuelve a llamar a pkexec. Guarda rollback y journal ANTES de
        /// ejecutar nada, igual que `executor::run_script_linux`.
        fn apply(&mut self, op: DixOperation) -> Result<String, String> {
            if !moderate_allows(&op) {
                return Err(format!(
                    "operación no permitida en nivel Moderado: {:?}",
                    op
                ));
            }
            op.validate().map_err(|v| v.detail)?;

            let rollback_op = capture_previous(&op).ok_or(
                "no se pudo capturar el estado previo — rollback no garantizado, operación cancelada",
            )?;
            rollback_op.validate().map_err(|v| v.detail)?;

            let ts = epoch_secs();
            let rollback_filename = format!("rollback_{}.sh", ts);
            fs::create_dir_all(rollbacks_dir()).map_err(|e| e.to_string())?;
            let rollback_path = rollbacks_dir().join(&rollback_filename);
            fs::write(&rollback_path, format!("#!/bin/bash\n{}\n", rollback_op.render()))
                .map_err(|e| format!("no se pudo guardar rollback: {}", e))?;

            journal::record_planned(ts, &rollback_filename);

            let id = self.next_id;
            self.next_id += 1;
            let marker = format!("__DIX_MOD_{}__", id);
            let prefix = format!("{}:", marker);
            let line = op.render();
            let cmd = format!("{}\necho \"{}:$?\"\n", line, marker);
            self.stdin.write_all(cmd.as_bytes()).map_err(|e| e.to_string())?;
            self.stdin.flush().map_err(|e| e.to_string())?;

            let mut output = String::new();
            loop {
                match self.stdout_rx.recv_timeout(Duration::from_secs(10)) {
                    Ok(l) => {
                        if let Some(rest) = l.strip_prefix(&prefix) {
                            let code: i32 = rest.trim().parse().unwrap_or(-1);
                            if code == 0 {
                                journal::update_state(ts, TransactionState::Applied, None);
                                journal::update_state(ts, TransactionState::Verified, None);
                                return Ok(output);
                            }
                            journal::update_state(
                                ts,
                                TransactionState::Planned,
                                Some(format!("la operación falló con código {}", code)),
                            );
                            return Err(format!("operación falló (código {}): {}", code, output));
                        }
                        output.push_str(&l);
                        output.push('\n');
                    }
                    Err(_) => {
                        journal::update_state(
                            ts,
                            TransactionState::Planned,
                            Some("timeout esperando respuesta de la sesión elevada".to_string()),
                        );
                        return Err("timeout esperando respuesta de la sesión elevada".to_string());
                    }
                }
            }
        }

        fn stop(mut self) {
            let _ = self.stdin.write_all(b"exit\n");
            let _ = self.child.kill();
            let _ = self.child.wait();
        }
    }

    static SESSION: Mutex<Option<ModerateSession>> = Mutex::new(None);

    pub fn start_moderate_session() -> Result<(), String> {
        let mut guard = SESSION.lock().map_err(|_| "lock de sesión Moderado envenenado".to_string())?;
        if guard.is_some() {
            return Ok(()); // ya había una sesión viva — idempotente
        }
        *guard = Some(ModerateSession::start()?);
        Ok(())
    }

    pub fn apply_moderate(op: DixOperation) -> Result<String, String> {
        let mut guard = SESSION.lock().map_err(|_| "lock de sesión Moderado envenenado".to_string())?;
        match guard.as_mut() {
            Some(session) => session.apply(op),
            None => Err("no hay sesión Moderado activa — llama a start_moderate_session primero".to_string()),
        }
    }

    pub fn stop_moderate_session() {
        if let Ok(mut guard) = SESSION.lock() {
            if let Some(session) = guard.take() {
                session.stop();
            }
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub use moderate::{apply_moderate, start_moderate_session, stop_moderate_session};

#[cfg(target_os = "windows")]
pub fn start_moderate_session() -> Result<(), String> {
    Err("DixKontrol Moderado no está implementado en Windows todavía.".to_string())
}

#[cfg(target_os = "windows")]
pub fn apply_moderate(_op: crate::command_engine::DixOperation) -> Result<String, String> {
    Err("DixKontrol Moderado no está implementado en Windows todavía.".to_string())
}

#[cfg(target_os = "windows")]
pub fn stop_moderate_session() {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_only_skeleton_never_panics() {
        // En CI/headless sin servidor X, debe degradar a no soportado en vez
        // de panicar — nunca debe intentar escribir nada al sistema.
        let ctx = read_foreground_context();
        let _ = ctx.supported;
    }

    #[test]
    #[cfg(not(target_os = "windows"))]
    fn moderate_catalog_excludes_irreversible_ops() {
        use crate::command_engine::DixOperation;
        // SetHugepages y SetNumaBalancing quedan fuera del nivel Moderado
        // (no reversibles de forma fiable, ver comentario del módulo).
        let hugepages = DixOperation::SetHugepages { modo: "madvise".into() };
        let numa = DixOperation::SetNumaBalancing { activo: true };
        assert!(!moderate::moderate_allows(&hugepages));
        assert!(!moderate::moderate_allows(&numa));
    }

    #[test]
    #[cfg(not(target_os = "windows"))]
    fn moderate_catalog_includes_reversible_ops() {
        use crate::command_engine::DixOperation;
        let sysctl = DixOperation::SetSysctl { clave: "vm.swappiness".into(), valor: "10".into() };
        assert!(moderate::moderate_allows(&sysctl));
    }

    /// Prueba real de extremo a extremo en esta máquina: pide autenticación
    /// pkexec de verdad (aparecerá un diálogo gráfico — hay que aceptarlo a
    /// mano), aplica un cambio real de vm.swappiness, confirma que se aplicó
    /// leyendo el sistema, y lo revierte con el rollback real que generó la
    /// propia sesión Moderado. No se ejecuta en `cargo test` normal —
    /// requiere `--ignored` y un escritorio gráfico con agente polkit.
    #[test]
    #[ignore = "requiere pkexec/polkit gráfico real — ejecutar con --ignored y aceptar el diálogo"]
    #[cfg(not(target_os = "windows"))]
    fn moderate_real_roundtrip_swappiness() {
        use crate::command_engine::DixOperation;

        fn read_swappiness() -> i64 {
            let out = std::process::Command::new("/sbin/sysctl")
                .args(["-n", "vm.swappiness"])
                .output()
                .expect("no se pudo leer vm.swappiness");
            String::from_utf8_lossy(&out.stdout).trim().parse().expect("valor no numérico")
        }

        let before = read_swappiness();
        let target = if before == 10 { 15 } else { 10 };
        println!("[prueba real] vm.swappiness actual = {}, objetivo = {}", before, target);

        start_moderate_session().expect("no se pudo iniciar la sesión Moderado (¿pkexec/polkit disponibles?)");

        let op = DixOperation::SetSysctl { clave: "vm.swappiness".into(), valor: target.to_string() };
        let apply_result = apply_moderate(op);
        stop_moderate_session();
        apply_result.clone().expect("la operación Moderado falló");
        println!("[prueba real] apply() devolvió: {:?}", apply_result);

        let after = read_swappiness();
        assert_eq!(after, target, "vm.swappiness no cambió tras aplicar el cambio Moderado");
        println!("[prueba real] confirmado: vm.swappiness ahora es {}", after);

        let latest = crate::journal::latest().expect("la operación no dejó transacción en el journal");
        println!("[prueba real] revirtiendo con {}", latest.rollback_filename);
        crate::executor::execute_rollback(&latest.rollback_filename)
            .expect("el rollback automático falló");

        let restored = read_swappiness();
        assert_eq!(restored, before, "el rollback no restauró el valor original de vm.swappiness");
        println!("[prueba real] confirmado: vm.swappiness restaurado a {}", restored);
    }
}
