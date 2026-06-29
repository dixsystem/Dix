use crate::contracts::{Decision, DecisionReview, EstadoPipeline, TipoAgente};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Todos los eventos internos que circulan por el Event Bus de DIX Forge.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DixEvent {
    TaskStarted { task_id: Uuid },
    TaskCompleted { task_id: Uuid, resultado: String },
    TaskFailed { task_id: Uuid, error: String, intentos: u32 },
    TaskEscalated { task_id: Uuid, motivo: String },
    PipelineStateChanged { pipeline_id: Uuid, estado: EstadoPipeline },
    ReviewCompleted { review_id: Uuid, decision: DecisionReview },
    ApprovalReceived { pipeline_id: Uuid, decision: Decision },
    ArtifactProduced { artifact_id: Uuid, nombre: String },
    MemoryRecordSaved { record_id: Uuid },
    AgentCalled { agente: TipoAgente, task_id: Uuid },
    AgentResponded { agente: TipoAgente, task_id: Uuid, ok: bool },
}
