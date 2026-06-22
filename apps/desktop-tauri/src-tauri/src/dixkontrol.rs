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
}
