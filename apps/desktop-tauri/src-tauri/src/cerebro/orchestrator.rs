use crate::contracts::{Decision, EstadoPipeline, EstadoTarea, Pipeline, Spec, Task, TipoAgente};
use crate::context_engine::ContextError;
use crate::memory_api::MemoryError;
use super::ollama::OllamaError;

/// Error del orquestador CEREBRO.
#[derive(Debug, thiserror::Error)]
pub enum CerebroError {
    #[error("Ollama: {0}")]
    Ollama(#[from] OllamaError),
    #[error("Contexto: {0}")]
    Context(#[from] ContextError),
    #[error("Memory: {0}")]
    Memory(#[from] MemoryError),
    #[error("Tarea fallida tras {intentos} intentos: {motivo}")]
    TaskFailed { intentos: u32, motivo: String },
}

/// Decide el modelo Ollama correcto según el agente asignado a la tarea.
pub fn select_model<'a>(task: &Task, coder_model: &'a str, reasoner_model: &'a str) -> &'a str {
    match task.agente {
        TipoAgente::CoderLocal => coder_model,
        TipoAgente::RazonadorLocal => reasoner_model,
        TipoAgente::Claude => reasoner_model,
        TipoAgente::Humano => reasoner_model,
    }
}

/// Decide si el pipeline debe continuar (Go), esperar (Wait) o parar (Stop).
pub fn decide_pipeline(pipeline: &Pipeline) -> Decision {
    match pipeline.estado {
        EstadoPipeline::Fallido | EstadoPipeline::Cancelado => Decision::Stop,
        EstadoPipeline::Completado => Decision::Stop,
        EstadoPipeline::Borrador => Decision::Wait,
        EstadoPipeline::Activo => {
            let hay_escaladas = pipeline.tareas.iter().any(|t| t.estado == EstadoTarea::Escalada);
            let hay_fallidas = pipeline.tareas.iter().any(|t| t.estado == EstadoTarea::Fallida);
            if hay_escaladas || hay_fallidas {
                Decision::Wait
            } else {
                Decision::Go
            }
        }
    }
}

/// Construye el prompt que se envía al agente para ejecutar una tarea.
pub fn build_task_prompt(spec: &Spec, task: &Task, memoria: &str) -> String {
    format!(
        "Eres un agente de DIX Forge trabajando en el proyecto: {nombre}.\n\
         Objetivo del proyecto: {objetivo}\n\
         Restricciones: {restricciones}\n\
         \n\
         Tu tarea actual: {titulo}\n\
         Descripción: {descripcion}\n\
         \n\
         Contexto de memoria relevante:\n{memoria}\n\
         \n\
         Ejecuta la tarea. Sé preciso y production-ready.",
        nombre = spec.nombre,
        objetivo = spec.objetivo,
        restricciones = spec.restricciones.join(", "),
        titulo = task.titulo,
        descripcion = task.descripcion,
        memoria = memoria,
    )
}
