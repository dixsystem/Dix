use crate::contracts::{MemoryRecord, Spec, Task};
use chrono::Utc;
use uuid::Uuid;

use super::AgentContext;

/// Constructor fluent para AgentContext.
pub struct ContextBuilder {
    pipeline_id: Uuid,
    task_id: Uuid,
    spec: Option<Spec>,
    tarea_actual: Option<Task>,
    memoria_relevante: Vec<MemoryRecord>,
    historial_eventos: Vec<String>,
    restricciones_globales: Vec<String>,
}

impl ContextBuilder {
    pub fn new(pipeline_id: Uuid, task_id: Uuid) -> Self {
        Self {
            pipeline_id,
            task_id,
            spec: None,
            tarea_actual: None,
            memoria_relevante: vec![],
            historial_eventos: vec![],
            restricciones_globales: vec![],
        }
    }

    pub fn spec(mut self, spec: Spec) -> Self {
        self.spec = Some(spec);
        self
    }

    pub fn tarea(mut self, task: Task) -> Self {
        self.tarea_actual = Some(task);
        self
    }

    pub fn memoria(mut self, records: Vec<MemoryRecord>) -> Self {
        self.memoria_relevante = records;
        self
    }

    pub fn eventos(mut self, eventos: Vec<String>) -> Self {
        self.historial_eventos = eventos;
        self
    }

    pub fn restricciones(mut self, restricciones: Vec<String>) -> Self {
        self.restricciones_globales = restricciones;
        self
    }

    /// Construye el AgentContext. Devuelve Err si faltan spec o tarea.
    pub fn build(self) -> Result<AgentContext, String> {
        let spec = self.spec.ok_or("Spec requerida")?;
        let tarea_actual = self.tarea_actual.ok_or("Tarea requerida")?;
        Ok(AgentContext {
            pipeline_id: self.pipeline_id,
            task_id: self.task_id,
            spec,
            tarea_actual,
            memoria_relevante: self.memoria_relevante,
            historial_eventos: self.historial_eventos,
            restricciones_globales: self.restricciones_globales,
            generado_en: Utc::now(),
        })
    }
}
