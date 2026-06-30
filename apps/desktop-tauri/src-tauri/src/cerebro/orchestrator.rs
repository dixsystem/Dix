use crate::contracts::{Decision, Dominio, EstadoPipeline, EstadoTarea, Pipeline, Spec, Task, TipoAgente};
use crate::context_engine::ContextError;
use crate::memory_api::MemoryError;
use chrono::Utc;
use serde::Deserialize;
use super::ollama::OllamaError;
use uuid::Uuid;

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

/// Prompt para que el razonador descomponga una Spec en tareas ejecutables.
pub fn build_plan_prompt(spec: &Spec) -> String {
    format!(
        "Eres el planificador de DIX Forge. Descompón esta especificación en 3-5 tareas ejecutables.\n\
         \n\
         Proyecto: {nombre}\n\
         Descripción: {descripcion}\n\
         Objetivo: {objetivo}\n\
         Dominio: {dominio:?}\n\
         \n\
         Responde ÚNICAMENTE con un array JSON válido, sin texto adicional ni bloques markdown.\n\
         Formato exacto:\n\
         [\n\
           {{\"titulo\": \"Analizar requisitos\", \"descripcion\": \"Descripción detallada\", \"agente\": \"razonadorLocal\", \"dominio\": \"arquitectura\"}},\n\
           {{\"titulo\": \"Implementar núcleo\", \"descripcion\": \"Código principal\", \"agente\": \"coderLocal\", \"dominio\": \"rust\"}}\n\
         ]\n\
         \n\
         Agentes: coderLocal (genera código), razonadorLocal (análisis y diseño)\n\
         Dominios: rust, frontend, documentacion, arquitectura, testing, deploy\n\
         \n\
         Array JSON:",
        nombre = spec.nombre,
        descripcion = spec.descripcion,
        objetivo = spec.objetivo,
        dominio = spec.dominio,
    )
}

/// Parsea la respuesta del LLM y construye la lista de Tasks.
/// Si el JSON falla, devuelve una tarea genérica de fallback.
pub fn parse_tasks(spec: &Spec, response: &str) -> Vec<Task> {
    #[derive(Deserialize)]
    struct TaskPlan {
        titulo: String,
        #[serde(default)]
        descripcion: String,
        #[serde(default)]
        agente: String,
        #[serde(default)]
        dominio: String,
    }

    let json_str = extract_json_array(response).unwrap_or_default();
    let plans: Vec<TaskPlan> = serde_json::from_str(&json_str).unwrap_or_default();

    if plans.is_empty() {
        return vec![make_task(
            spec,
            "Ejecutar objetivo principal",
            &spec.objetivo,
            TipoAgente::CoderLocal,
            spec.dominio,
        )];
    }

    plans
        .into_iter()
        .map(|p| {
            let agente = match p.agente.as_str() {
                "coderLocal" | "coder" => TipoAgente::CoderLocal,
                _ => TipoAgente::RazonadorLocal,
            };
            let dominio = match p.dominio.as_str() {
                "frontend" => Dominio::Frontend,
                "documentacion" => Dominio::Documentacion,
                "arquitectura" => Dominio::Arquitectura,
                "testing" => Dominio::Testing,
                "deploy" => Dominio::Deploy,
                _ => spec.dominio,
            };
            make_task(spec, &p.titulo, &p.descripcion, agente, dominio)
        })
        .collect()
}

fn extract_json_array(text: &str) -> Option<String> {
    let start = text.find('[')?;
    let end = text.rfind(']')?;
    if end > start { Some(text[start..=end].to_string()) } else { None }
}

fn make_task(spec: &Spec, titulo: &str, descripcion: &str, agente: TipoAgente, dominio: Dominio) -> Task {
    let now = Utc::now();
    Task {
        id: Uuid::new_v4(),
        spec_id: spec.id,
        titulo: titulo.to_string(),
        descripcion: descripcion.to_string(),
        agente,
        dominio,
        estado: EstadoTarea::Pendiente,
        intentos: 0,
        max_intentos: 3,
        creado_en: now,
        actualizado_en: now,
        resultado: None,
    }
}
