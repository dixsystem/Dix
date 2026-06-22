// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.
//
// Esqueleto de DixKontrol — SOLO LECTURA. Ver docs/threat-model/dixkontrol.md
// antes de añadir cualquier capacidad de escritura/control activo a este
// módulo. Nada aquí debe ejecutar comandos, tocar pkexec, ni modificar el
// sistema — solo observar y reportar.

use serde::Serialize;

#[derive(Serialize)]
pub struct ForegroundContext {
    /// Nombre de la app/ventana en foco, si se pudo detectar. None si no hay
    /// soporte en este entorno (p.ej. Wayland sin portal compatible).
    pub app_name: Option<String>,
    pub supported: bool,
}

/// Detección de contexto de solo lectura. Implementación real pendiente
/// (X11 vía _NET_ACTIVE_WINDOW / Wayland vía portal) — placeholder seguro
/// que nunca falla ni modifica nada, para poder cablear la UI antes de
/// construir la detección real.
pub fn read_foreground_context() -> ForegroundContext {
    ForegroundContext { app_name: None, supported: false }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_only_skeleton_never_panics() {
        let ctx = read_foreground_context();
        assert!(!ctx.supported);
    }
}
