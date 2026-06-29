pub mod packager;

use crate::contracts::{Artifact, EstadoPipeline, Pipeline};
use crate::event_bus::{DixEvent, EventBus};
use crate::knowledge_core::KnowledgeCore;
use crate::contracts::Dominio;
use std::sync::Arc;

/// Error del Publisher.
#[derive(Debug, thiserror::Error)]
pub enum PublisherError {
    #[error("Pipeline no completado (estado: {0:?})")]
    PipelineNoCompletado(EstadoPipeline),
    #[error("IO: {0}")]
    Io(#[from] std::io::Error),
    #[error("Memory: {0}")]
    Memory(String),
    #[error("EventBus: {0}")]
    Bus(String),
}

/// Empaqueta artefactos finales: calcula SHA256, registra en KnowledgeCore y emite evento.
pub struct Publisher {
    knowledge: Arc<KnowledgeCore>,
    bus: Arc<EventBus>,
}

impl Publisher {
    pub fn new(knowledge: Arc<KnowledgeCore>, bus: Arc<EventBus>) -> Self {
        Self { knowledge, bus }
    }

    /// Publica un pipeline completado: crea Artifact, calcula hash, registra en Knowledge, emite evento.
    pub async fn publicar(
        &self,
        pipeline: &Pipeline,
        nombre: &str,
        version: &str,
        descripcion: &str,
        ruta_binario: Option<&str>,
    ) -> Result<Artifact, PublisherError> {
        if !matches!(pipeline.estado, EstadoPipeline::Completado) {
            return Err(PublisherError::PipelineNoCompletado(pipeline.estado));
        }

        let artifact = packager::construir_artifact(pipeline.id, nombre, version, descripcion, ruta_binario)?;

        // Registrar en KnowledgeCore
        self.knowledge
            .remember(
                Dominio::Deploy,
                &format!("artifact:{}:{}", nombre, version),
                &format!(
                    "pipeline={} hash={} ruta={}",
                    pipeline.id,
                    artifact.hash_sha256.as_deref().unwrap_or("none"),
                    artifact.ruta_binario.as_deref().unwrap_or("none")
                ),
            )
            .await
            .map_err(|e| PublisherError::Memory(e.to_string()))?;

        self.bus
            .publish(DixEvent::ArtifactProduced {
                artifact_id: artifact.id,
                nombre: artifact.nombre.clone(),
            })
            .map_err(|e| PublisherError::Bus(e.to_string()))?;

        Ok(artifact)
    }
}
