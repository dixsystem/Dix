use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Decisión del CEREBRO sobre si continuar con la ejecución.
#[derive(Debug, Clone, Serialize, Deserialize, Copy, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum Decision {
    Go,
    Wait,
    Stop,
}

/// Nivel de severidad de un hallazgo encontrado durante revisión.
#[derive(Debug, Clone, Serialize, Deserialize, Copy, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum NivelHallazgo {
    Critico,
    Importante,
    Opcional,
}

/// Estado de una tarea en el sistema.
#[derive(Debug, Clone, Serialize, Deserialize, Copy, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum EstadoTarea {
    Pendiente,
    EnCurso,
    Completada,
    Fallida,
    Escalada,
}

/// Estado del pipeline de fabricación.
#[derive(Debug, Clone, Serialize, Deserialize, Copy, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum EstadoPipeline {
    Borrador,
    Activo,
    Completado,
    Cancelado,
    Fallido,
}

/// Tipos de agentes disponibles en el sistema.
#[derive(Debug, Clone, Serialize, Deserialize, Copy, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum TipoAgente {
    CoderLocal,
    RazonadorLocal,
    Claude,
    Humano,
}

/// Dominios técnicos asociados a una tarea.
#[derive(Debug, Clone, Serialize, Deserialize, Copy, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum Dominio {
    Rust,
    Frontend,
    Documentacion,
    Arquitectura,
    Testing,
    Deploy,
}

/// Decisión del revisor tras auditoría técnica.
#[derive(Debug, Clone, Serialize, Deserialize, Copy, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum DecisionReview {
    Aprobar,
    NuevaIteracion,
    Escalar,
}

/// Un hallazgo encontrado durante una revisión técnica.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Hallazgo {
    /// Identificador único del hallazgo.
    pub id: Uuid,
    /// Nivel de severidad del hallazgo.
    pub nivel: NivelHallazgo,
    /// Descripción detallada del hallazgo.
    pub descripcion: String,
    /// Ruta al archivo donde se encontró el hallazgo.
    pub archivo: Option<String>,
    /// Número de línea donde ocurre el hallazgo.
    pub linea: Option<u32>,
    /// Sugerencia de corrección o mejora.
    pub sugerencia: Option<String>,
}

/// Plan completo generado por el CEREBRO para una AppIA.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Spec {
    /// Identificador único del plan.
    pub id: Uuid,
    /// Nombre del plan.
    pub nombre: String,
    /// Descripción general del plan.
    pub descripcion: String,
    /// Dominio técnico al que pertenece la tarea.
    pub dominio: Dominio,
    /// Objetivo principal del plan.
    pub objetivo: String,
    /// Criterios de aceptación para el resultado final.
    pub criterios_aceptacion: Vec<String>,
    /// Restricciones técnicas o funcionales.
    pub restricciones: Vec<String>,
    /// Fecha en la que se creó el plan.
    pub creado_en: DateTime<Utc>,
}

/// Tarea individual asignada a un agente.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    /// Identificador único de la tarea.
    pub id: Uuid,
    /// ID del plan asociado a esta tarea.
    pub spec_id: Uuid,
    /// Título de la tarea.
    pub titulo: String,
    /// Descripción detallada de la tarea.
    pub descripcion: String,
    /// Agente asignado a ejecutar la tarea.
    pub agente: TipoAgente,
    /// Dominio técnico asociado a la tarea.
    pub dominio: Dominio,
    /// Estado actual de la tarea.
    pub estado: EstadoTarea,
    /// Número de intentos realizados.
    pub intentos: u32,
    /// Máximo número de intentos permitidos.
    pub max_intentos: u32,
    /// Fecha en la que se creó la tarea.
    pub creado_en: DateTime<Utc>,
    /// Fecha en la que se actualizó por última vez.
    pub actualizado_en: DateTime<Utc>,
    /// Resultado final de la ejecución (opcional).
    pub resultado: Option<String>,
}

/// Informe de revisión técnica y auditoría independiente.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Review {
    /// Identificador único del informe.
    pub id: Uuid,
    /// ID de la tarea asociada al informe.
    pub task_id: Uuid,
    /// Decisión tomada por el revisor.
    pub decision: DecisionReview,
    /// Lista de hallazgos encontrados durante la auditoría.
    pub hallazgos: Vec<Hallazgo>,
    /// Indica si el build fue exitoso.
    pub build_ok: bool,
    /// Indica si los tests pasaron correctamente.
    pub tests_ok: bool,
    /// Indica si clippy no reportó errores.
    pub clippy_ok: bool,
    /// Notas adicionales del revisor (opcional).
    pub notas: Option<String>,
    /// Fecha en la que se completó el informe.
    pub revisado_en: DateTime<Utc>,
}

/// Decisión humana GO/WAIT/STOP sobre el pipeline actual.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Approval {
    /// Identificador único de la aprobación.
    pub id: Uuid,
    /// ID del pipeline asociado.
    pub pipeline_id: Uuid,
    /// Decisión tomada (GO, WAIT o STOP).
    pub decision: Decision,
    /// Motivo de la decisión (opcional).
    pub motivo: Option<String>,
    /// Fecha en la que se tomó la aprobación.
    pub aprobado_en: DateTime<Utc>,
}

/// Artefacto producido como resultado final del pipeline.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Artifact {
    /// Identificador único del artefacto.
    pub id: Uuid,
    /// ID del pipeline asociado.
    pub pipeline_id: Uuid,
    /// Nombre del artefacto.
    pub nombre: String,
    /// Versión del artefacto.
    pub version: String,
    /// Descripción del artefacto.
    pub descripcion: String,
    /// Ruta al binario generado (opcional).
    pub ruta_binario: Option<String>,
    /// Hash SHA256 del binario (opcional).
    pub hash_sha256: Option<String>,
    /// Fecha en la que se produjo el artefacto.
    pub producido_en: DateTime<Utc>,
}

/// Estado completo de fabricación de una AppIA.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pipeline {
    /// Identificador único del pipeline.
    pub id: Uuid,
    /// ID del plan asociado al pipeline.
    pub spec_id: Uuid,
    /// Nombre del pipeline.
    pub nombre: String,
    /// Estado actual del pipeline.
    pub estado: EstadoPipeline,
    /// Lista de tareas asociadas al pipeline.
    pub tareas: Vec<Task>,
    /// Lista de artefactos producidos por el pipeline.
    pub artefactos: Vec<Artifact>,
    /// Fecha en la que se creó el pipeline.
    pub creado_en: DateTime<Utc>,
    /// Fecha en la que se actualizó por última vez.
    pub actualizado_en: DateTime<Utc>,
}

/// Entrada en el Knowledge Core (memoria multicapa).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryRecord {
    /// Identificador único del registro.
    pub id: Uuid,
    /// Dominio al que pertenece el conocimiento.
    pub dominio: Dominio,
    /// Clave única para identificar el registro.
    pub clave: String,
    /// Valor almacenado en el registro.
    pub valor: String,
    /// Embedding vector del contenido (opcional).
    pub embedding: Option<Vec<f32>>,
    /// Nivel de relevancia del registro.
    pub relevancia: f32,
    /// Fecha en la que se creó el registro.
    pub creado_en: DateTime<Utc>,
    /// Fecha en la que fue accedido por última vez (opcional).
    pub accedido_en: Option<DateTime<Utc>>,
}
