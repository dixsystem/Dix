pub mod ollama;
pub mod orchestrator;

pub use ollama::{OllamaClient, OllamaError};
pub use orchestrator::CerebroError;

use crate::contracts::{Decision, EstadoTarea, Pipeline, Spec, Task};
use crate::context_engine::ContextEngine;
use crate::event_bus::{DixEvent, EventBus};
use crate::knowledge_core::KnowledgeCore;
use std::sync::Arc;

/// Orquestador principal de DIX Forge.
/// Recibe una Spec, construye contexto, delega a agentes Ollama y decide si continuar.
pub struct Cerebro {
    ollama: Arc<OllamaClient>,
    context_engine: Arc<ContextEngine>,
    knowledge: Arc<KnowledgeCore>,
    bus: Arc<EventBus>,
    coder_model: String,
    reasoner_model: String,
}

impl Cerebro {
    pub fn new(
        ollama: Arc<OllamaClient>,
        context_engine: Arc<ContextEngine>,
        knowledge: Arc<KnowledgeCore>,
        bus: Arc<EventBus>,
    ) -> Self {
        Self {
            ollama,
            context_engine,
            knowledge,
            bus,
            coder_model: "qwen3-coder:latest".to_string(),
            reasoner_model: "qwen-es:latest".to_string(),
        }
    }

    /// Ejecuta una tarea: construye contexto, llama al agente y guarda el resultado.
    pub async fn execute_task(
        &self,
        spec: &Spec,
        task: &mut Task,
    ) -> Result<String, CerebroError> {
        let _ = self.bus.publish(DixEvent::AgentCalled {
            agente: task.agente,
            task_id: task.id,
        });

        let ctx = self.context_engine.build_context(spec, task).await?;

        let memoria_str = ctx
            .memoria_relevante
            .iter()
            .map(|r| format!("[{:?}] {}: {}", r.dominio, r.clave, r.valor))
            .collect::<Vec<_>>()
            .join("\n");

        let prompt = orchestrator::build_task_prompt(spec, task, &memoria_str);
        let model = orchestrator::select_model(task, &self.coder_model, &self.reasoner_model);

        let response = self.ollama.generate(model, &prompt).await?;

        task.estado = EstadoTarea::Completada;
        task.resultado = Some(response.clone());
        task.intentos += 1;

        let _ = self.bus.publish(DixEvent::AgentResponded {
            agente: task.agente,
            task_id: task.id,
            ok: true,
        });
        let _ = self.bus.publish(DixEvent::TaskCompleted {
            task_id: task.id,
            resultado: response.clone(),
        });

        // Guarda el resultado en la memoria
        let _ = self
            .knowledge
            .remember(task.dominio, &task.titulo, &response)
            .await;

        Ok(response)
    }

    /// Decide si el pipeline debe continuar (Go), esperar (Wait) o parar (Stop).
    pub async fn decide(&self, pipeline: &Pipeline) -> Result<Decision, CerebroError> {
        Ok(orchestrator::decide_pipeline(pipeline))
    }

    /// Llama al razonador para descomponer una Spec en tareas ejecutables.
    /// Si Ollama falla o el JSON es inválido, devuelve una tarea de fallback.
    pub async fn planificar(&self, spec: &Spec) -> Vec<Task> {
        let prompt = orchestrator::build_plan_prompt(spec);
        match self.ollama.generate(&self.reasoner_model, &prompt).await {
            Ok(response) => orchestrator::parse_tasks(spec, &response),
            Err(e) => {
                eprintln!("[CEREBRO] planificar error: {e} — usando fallback");
                orchestrator::parse_tasks(spec, "")
            }
        }
    }
}
