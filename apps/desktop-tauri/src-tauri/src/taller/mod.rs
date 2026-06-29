pub mod executor;

use crate::cerebro::{Cerebro, CerebroError};
use crate::contracts::{EstadoTarea, Spec, Task};
use crate::event_bus::{DixEvent, EventBus};
use crate::knowledge_core::KnowledgeCore;
use std::sync::Arc;

/// Error del módulo Taller.
#[derive(Debug, thiserror::Error)]
pub enum TallerError {
    #[error("Cerebro: {0}")]
    Cerebro(#[from] CerebroError),
    #[error("Tarea agotó {max} intentos: {motivo}")]
    Agotado { max: u32, motivo: String },
    #[error("EventBus: {0}")]
    Bus(String),
}

/// Módulo de ejecución de tareas individuales.
/// Recibe una Task, la ejecuta usando Cerebro con reintentos,
/// emite eventos vía EventBus y guarda resultados en KnowledgeCore.
pub struct Taller {
    cerebro: Arc<Cerebro>,
    knowledge: Arc<KnowledgeCore>,
    bus: Arc<EventBus>,
}

impl Taller {
    pub fn new(cerebro: Arc<Cerebro>, knowledge: Arc<KnowledgeCore>, bus: Arc<EventBus>) -> Self {
        Self { cerebro, knowledge, bus }
    }

    /// Ejecuta una tarea con reintentos hasta `task.max_intentos`.
    /// Emite TaskStarted, luego TaskCompleted, TaskFailed o TaskEscalated.
    pub async fn ejecutar(&self, spec: &Spec, task: &mut Task) -> Result<String, TallerError> {
        task.estado = EstadoTarea::EnCurso;
        let _ = self.bus.publish(DixEvent::TaskStarted { task_id: task.id });

        match executor::ejecutar_con_reintentos(&self.cerebro, spec, task).await {
            Ok(resultado) => {
                let _ = self.bus.publish(DixEvent::TaskCompleted {
                    task_id: task.id,
                    resultado: resultado.clone(),
                });
                // Refuerza la memoria si la tarea completó exitosamente
                if let Ok(records) = self.knowledge.recall(&task.titulo, Some(task.dominio)).await {
                    for r in records {
                        let _ = self.knowledge.reinforce(r.id, 0.5).await;
                    }
                }
                Ok(resultado)
            }
            Err(TallerError::Agotado { ref motivo, .. }) => {
                let _ = self.bus.publish(DixEvent::TaskEscalated {
                    task_id: task.id,
                    motivo: motivo.clone(),
                });
                Err(TallerError::Agotado {
                    max: task.max_intentos,
                    motivo: motivo.clone(),
                })
            }
            Err(e) => {
                let _ = self.bus.publish(DixEvent::TaskFailed {
                    task_id: task.id,
                    error: e.to_string(),
                    intentos: task.intentos,
                });
                Err(e)
            }
        }
    }
}
