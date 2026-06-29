pub mod builder;

pub use builder::ContextBuilder;

use crate::contracts::{MemoryRecord, Spec, Task};
use crate::event_bus::EventBus;
use crate::knowledge_core::KnowledgeCore;
use crate::memory_api::MemoryError;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

/// Error del Context Engine.
#[derive(Debug, thiserror::Error)]
pub enum ContextError {
    #[error("Memory error: {0}")]
    Memory(#[from] MemoryError),
    #[error("Contexto inválido: {0}")]
    Invalid(String),
}

/// Contexto estructurado que se pasa a los agentes IA en cada ejecución.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentContext {
    pub pipeline_id: Uuid,
    pub task_id: Uuid,
    pub spec: Spec,
    pub tarea_actual: Task,
    pub memoria_relevante: Vec<MemoryRecord>,
    /// Últimos N eventos del bus representados como cadenas de texto.
    pub historial_eventos: Vec<String>,
    pub restricciones_globales: Vec<String>,
    pub generado_en: DateTime<Utc>,
}

/// Ensambla AgentContext reuniendo spec, tarea, memoria relevante y restricciones.
pub struct ContextEngine {
    knowledge: Arc<KnowledgeCore>,
    #[allow(dead_code)]
    bus: Arc<EventBus>,
    max_memoria_items: usize,
    max_historial_eventos: usize,
}

impl ContextEngine {
    pub fn new(knowledge: Arc<KnowledgeCore>, bus: Arc<EventBus>) -> Self {
        Self {
            knowledge,
            bus,
            max_memoria_items: 20,
            max_historial_eventos: 50,
        }
    }

    /// Construye el contexto para un agente a partir de la spec y la tarea actual.
    pub async fn build_context(
        &self,
        spec: &Spec,
        task: &Task,
    ) -> Result<AgentContext, ContextError> {
        let memoria = self
            .knowledge
            .recall_top(task.dominio, self.max_memoria_items)
            .await?;

        ContextBuilder::new(task.spec_id, task.id)
            .spec(spec.clone())
            .tarea(task.clone())
            .memoria(memoria)
            .restricciones(spec.restricciones.clone())
            .build()
            .map_err(ContextError::Invalid)
    }

    pub fn max_memoria_items(&self) -> usize {
        self.max_memoria_items
    }

    pub fn max_historial_eventos(&self) -> usize {
        self.max_historial_eventos
    }
}
