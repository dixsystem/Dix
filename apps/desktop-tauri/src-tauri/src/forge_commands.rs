/// Tipos y helpers para los comandos Tauri de DIX Forge.
///
/// Los `#[tauri::command]` están en main.rs (require estar en el binario).
/// Este módulo exporta los tipos compartidos y la lógica reutilizable.
use std::sync::Arc;

use serde::Serialize;

use crate::forge::ForgeSystem;
use crate::panel::ResumenPanel;

/// Tipo del estado Tauri gestionado para DIX Forge.
pub type ForgeState = Arc<ForgeSystem>;

/// Estado de disponibilidad del servidor Ollama local.
#[derive(Serialize)]
pub struct OllamaStatus {
    pub disponible: bool,
    pub modelos: Vec<String>,
}

/// Información general del sistema Forge + resumen del Panel.
#[derive(Serialize)]
pub struct ForgeInfo {
    pub version: &'static str,
    pub ollama_url: &'static str,
    pub resumen: ResumenPanel,
}
