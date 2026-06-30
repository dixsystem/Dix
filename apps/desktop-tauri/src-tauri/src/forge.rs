/// DIX Forge — punto de entrada único del sistema de fabricación de AppIAs.
///
/// Inicializa y cablea todos los módulos en el orden correcto:
/// Memory API → Knowledge Core → Event Bus → Context Engine →
/// CEREBRO → TALLER → VUELTA → LANZADOR → PANEL → PUBLISHER
use std::sync::Arc;

use crate::cerebro::ollama::OllamaClient;
use crate::cerebro::Cerebro;
use crate::context_engine::ContextEngine;
use crate::contracts::{Artifact, Pipeline, Spec};
use crate::event_bus::EventBus;
use crate::knowledge_core::KnowledgeCore;
use crate::lanzador::{Lanzador, LanzadorError};
use crate::memory_api::sqlite::SqliteProvider;
use crate::memory_api::StorageProvider;
use crate::panel::{Panel, PanelError, ResumenPanel};
use crate::publisher::{Publisher, PublisherError};
use crate::taller::Taller;
use crate::vuelta::Vuelta;

/// Error raíz del sistema Forge.
#[derive(Debug, thiserror::Error)]
pub enum ForgeError {
    #[error("Storage: {0}")]
    Storage(#[from] crate::memory_api::error::MemoryError),
    #[error("Lanzador: {0}")]
    Lanzador(#[from] LanzadorError),
    #[error("Panel: {0}")]
    Panel(#[from] PanelError),
    #[error("Publisher: {0}")]
    Publisher(#[from] PublisherError),
}

/// Sistema DIX Forge completamente cableado.
/// Creado con `ForgeSystem::init` y mantenido como estado global Tauri.
pub struct ForgeSystem {
    pub lanzador: Arc<Lanzador>,
    pub panel: Arc<Panel>,
    pub publisher: Arc<Publisher>,
    pub knowledge: Arc<KnowledgeCore>,
    pub bus: Arc<EventBus>,
}

impl ForgeSystem {
    /// Inicializa todos los componentes y los cablea.
    ///
    /// - `db_path`: ruta al archivo SQLite (se crea automáticamente si no existe).
    /// - `ollama_url`: base URL de Ollama, por defecto `http://localhost:11434`.
    pub async fn init(db_path: &str, ollama_url: &str) -> Result<Self, ForgeError> {
        let storage: Arc<dyn StorageProvider + Send + Sync> =
            Arc::new(SqliteProvider::new(db_path).await?);

        let bus = Arc::new(EventBus::new(256));
        let knowledge = Arc::new(KnowledgeCore::new(Arc::clone(&storage), Arc::clone(&bus)));

        let ollama = Arc::new(OllamaClient::new(ollama_url));
        let context_engine =
            Arc::new(ContextEngine::new(Arc::clone(&knowledge), Arc::clone(&bus)));
        let cerebro = Arc::new(Cerebro::new(
            Arc::clone(&ollama),
            Arc::clone(&context_engine),
            Arc::clone(&knowledge),
            Arc::clone(&bus),
        ));

        let taller = Arc::new(Taller::new(
            Arc::clone(&cerebro),
            Arc::clone(&knowledge),
            Arc::clone(&bus),
        ));
        let vuelta = Arc::new(Vuelta::new(Arc::clone(&ollama), Arc::clone(&bus)));
        let lanzador = Arc::new(Lanzador::new(
            Arc::clone(&cerebro),
            Arc::clone(&taller),
            Arc::clone(&vuelta),
            Arc::clone(&knowledge),
            Arc::clone(&bus),
        ));

        let panel = Arc::new(Panel::new(Arc::clone(&bus)));
        let publisher = Arc::new(Publisher::new(Arc::clone(&knowledge), Arc::clone(&bus)));

        Ok(Self { lanzador, panel, publisher, knowledge, bus })
    }

    /// Crea y ejecuta un pipeline completo a partir de una Spec.
    /// Registra el estado en el Panel antes y después de la ejecución.
    pub async fn fabricar(&self, spec: Spec) -> Result<Pipeline, ForgeError> {
        let mut pipeline = self.lanzador.crear_pipeline(spec.clone());
        self.panel.registrar(pipeline.clone())?;
        let resultado = self.lanzador.ejecutar_pipeline(&mut pipeline, &spec).await;
        // Actualizar el panel siempre, incluso si el pipeline falló
        self.panel.registrar(pipeline.clone())?;
        resultado?;
        Ok(pipeline)
    }

    /// Devuelve el resumen actual de todos los pipelines en el Panel.
    pub fn resumen(&self) -> Result<ResumenPanel, ForgeError> {
        Ok(self.panel.resumen()?)
    }

    /// Publica el artefacto final de un pipeline completado.
    pub async fn publicar(
        &self,
        pipeline: &Pipeline,
        nombre: &str,
        version: &str,
        descripcion: &str,
        ruta_binario: Option<&str>,
    ) -> Result<Artifact, ForgeError> {
        Ok(self
            .publisher
            .publicar(pipeline, nombre, version, descripcion, ruta_binario)
            .await?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::contracts::{Dominio, EstadoPipeline, Spec};
    use chrono::Utc;
    use uuid::Uuid;

    async fn sistema_test() -> ForgeSystem {
        ForgeSystem::init("/tmp/forge_test.db", "http://localhost:11434")
            .await
            .expect("ForgeSystem::init falló")
    }

    #[tokio::test]
    async fn test_init_y_resumen() {
        let forge = sistema_test().await;
        let resumen = forge.resumen().expect("resumen() falló");
        assert_eq!(resumen.total, 0);
        assert_eq!(resumen.activos, 0);
        println!("✓ ForgeSystem iniciado — resumen: {:?}", resumen);
    }

    #[tokio::test]
    async fn test_pipeline_vacio_se_completa() {
        let forge = sistema_test().await;
        let spec = Spec {
            id: Uuid::new_v4(),
            nombre: "AppIA de prueba".to_string(),
            descripcion: "Test de integración".to_string(),
            dominio: Dominio::Rust,
            objetivo: "Verificar que el pipeline vacío completa sin error".to_string(),
            criterios_aceptacion: vec!["Build OK".to_string()],
            restricciones: vec![],
            creado_en: Utc::now(),
        };
        // Un pipeline sin tareas debe completarse inmediatamente
        let pipeline = forge.fabricar(spec).await.expect("fabricar() falló");
        assert_eq!(pipeline.estado, EstadoPipeline::Completado);
        assert_eq!(pipeline.tareas.len(), 0);
        println!("✓ Pipeline vacío completado — id: {}", pipeline.id);
    }

    #[tokio::test]
    async fn test_panel_registra_pipeline() {
        let forge = sistema_test().await;
        let spec = Spec {
            id: Uuid::new_v4(),
            nombre: "Pipeline panel test".to_string(),
            descripcion: "Verifica registro en Panel".to_string(),
            dominio: Dominio::Frontend,
            objetivo: "Verificar Panel".to_string(),
            criterios_aceptacion: vec![],
            restricciones: vec![],
            creado_en: Utc::now(),
        };
        let pipeline = forge.fabricar(spec).await.expect("fabricar falló");
        let resumen = forge.resumen().expect("resumen falló");
        assert!(resumen.completados >= 1);
        println!("✓ Panel tiene ≥1 completado — total: {}", resumen.total);
    }
}
