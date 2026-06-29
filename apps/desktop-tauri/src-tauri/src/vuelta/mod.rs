pub mod auditor;

use crate::cerebro::ollama::OllamaClient;
use crate::contracts::{Review, Task};
use crate::event_bus::{DixEvent, EventBus};
use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;

/// Error del módulo Vuelta.
#[derive(Debug, thiserror::Error)]
pub enum VueltaError {
    #[error("Ollama: {0}")]
    Ollama(String),
    #[error("Tarea sin resultado para revisar")]
    SinResultado,
    #[error("JSON: {0}")]
    Json(#[from] serde_json::Error),
}

/// Revisión técnica + auditoría independiente de una tarea completada.
/// Llama a qwen-es para auditar el resultado y genera un Review con hallazgos.
pub struct Vuelta {
    ollama: Arc<OllamaClient>,
    bus: Arc<EventBus>,
    reviewer_model: String,
}

impl Vuelta {
    pub fn new(ollama: Arc<OllamaClient>, bus: Arc<EventBus>) -> Self {
        Self {
            ollama,
            bus,
            reviewer_model: "qwen-es:latest".to_string(),
        }
    }

    /// Revisa una tarea completada y genera un Review.
    pub async fn revisar(&self, task: &Task) -> Result<Review, VueltaError> {
        if task.resultado.is_none() {
            return Err(VueltaError::SinResultado);
        }

        let prompt = auditor::build_audit_prompt(task);
        let response = self
            .ollama
            .generate(&self.reviewer_model, &prompt)
            .await
            .map_err(|e| VueltaError::Ollama(e.to_string()))?;

        let (hallazgos, decision) = auditor::parse_audit_response(&response, task.id);

        let build_ok = !response.to_lowercase().contains("build fail")
            && !response.to_lowercase().contains("no compila");
        let tests_ok = !response.to_lowercase().contains("test fail")
            && !response.to_lowercase().contains("tests fallan");
        let clippy_ok = !response.to_lowercase().contains("clippy");

        let review = Review {
            id: Uuid::new_v4(),
            task_id: task.id,
            decision,
            hallazgos,
            build_ok,
            tests_ok,
            clippy_ok,
            notas: Some(response),
            revisado_en: Utc::now(),
        };

        let _ = self.bus.publish(DixEvent::ReviewCompleted {
            review_id: review.id,
            decision: review.decision,
        });

        Ok(review)
    }
}
