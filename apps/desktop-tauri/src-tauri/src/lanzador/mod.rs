pub mod pipeline_mgr;

use crate::cerebro::Cerebro;
use crate::contracts::{
    Approval, Decision, EstadoPipeline, NivelHallazgo, Pipeline, Spec,
};
use crate::event_bus::{DixEvent, EventBus};
use crate::knowledge_core::KnowledgeCore;
use crate::taller::{Taller, TallerError};
use crate::vuelta::{Vuelta, VueltaError};
use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;

/// Error del Lanzador.
#[derive(Debug, thiserror::Error)]
pub enum LanzadorError {
    #[error("Taller: {0}")]
    Taller(#[from] TallerError),
    #[error("Vuelta: {0}")]
    Vuelta(#[from] VueltaError),
    #[error("Pipeline cancelado por decisión: {0:?}")]
    Cancelado(Decision),
    #[error("Hallazgo crítico sin resolver en tarea {0}")]
    HallazgoCritico(Uuid),
}

/// Orquestador de pipelines completos.
/// Crea un Pipeline desde una Spec y coordina ciclos TALLER+VUELTA por cada tarea.
pub struct Lanzador {
    cerebro: Arc<Cerebro>,
    taller: Arc<Taller>,
    vuelta: Arc<Vuelta>,
    knowledge: Arc<KnowledgeCore>,
    bus: Arc<EventBus>,
}

impl Lanzador {
    pub fn new(
        cerebro: Arc<Cerebro>,
        taller: Arc<Taller>,
        vuelta: Arc<Vuelta>,
        knowledge: Arc<KnowledgeCore>,
        bus: Arc<EventBus>,
    ) -> Self {
        Self { cerebro, taller, vuelta, knowledge, bus }
    }

    /// Crea un Pipeline en estado Borrador desde una Spec.
    pub fn crear_pipeline(&self, spec: Spec) -> Pipeline {
        Pipeline {
            id: Uuid::new_v4(),
            spec_id: spec.id,
            nombre: spec.nombre.clone(),
            estado: EstadoPipeline::Borrador,
            tareas: Vec::new(),
            artefactos: Vec::new(),
            creado_en: Utc::now(),
            actualizado_en: Utc::now(),
        }
    }

    /// Ejecuta el pipeline completo: itera tareas en ciclos TALLER+VUELTA.
    /// Para si hay un Hallazgo Crítico sin resolver o si se recibe Decision::Stop.
    /// El caller provee la Spec original para que el Taller tenga contexto completo.
    pub async fn ejecutar_pipeline(&self, pipeline: &mut Pipeline, spec: &Spec) -> Result<(), LanzadorError> {
        pipeline_mgr::transicionar(pipeline, EstadoPipeline::Activo);
        let _ = self.bus.publish(DixEvent::PipelineStateChanged {
            pipeline_id: pipeline.id,
            estado: pipeline.estado,
        });

        // Si el pipeline no tiene tareas, el Cerebro las genera ahora
        if pipeline.tareas.is_empty() {
            pipeline.tareas = self.cerebro.planificar(spec).await;
        }

        let task_count = pipeline.tareas.len();
        for i in 0..task_count {
            if !pipeline_mgr::puede_continuar(pipeline) {
                break;
            }

            let resultado = self.taller.ejecutar(spec, &mut pipeline.tareas[i]).await;

            match resultado {
                Err(TallerError::Agotado { motivo, .. }) => {
                    pipeline_mgr::transicionar(pipeline, EstadoPipeline::Fallido);
                    let _ = self.bus.publish(DixEvent::PipelineStateChanged {
                        pipeline_id: pipeline.id,
                        estado: pipeline.estado,
                    });
                    return Err(LanzadorError::Taller(TallerError::Agotado {
                        max: pipeline.tareas[i].max_intentos,
                        motivo,
                    }));
                }
                Err(e) => return Err(LanzadorError::Taller(e)),
                Ok(_) => {
                    // Revisión post-ejecución
                    let review = self.vuelta.revisar(&pipeline.tareas[i]).await?;

                    // Solo para el pipeline si hay críticos Y el build también falló
                    let hay_criticos = review
                        .hallazgos
                        .iter()
                        .any(|h| matches!(h.nivel, NivelHallazgo::Critico));
                    if hay_criticos && !review.build_ok {
                        pipeline_mgr::transicionar(pipeline, EstadoPipeline::Fallido);
                        let _ = self.bus.publish(DixEvent::PipelineStateChanged {
                            pipeline_id: pipeline.id,
                            estado: pipeline.estado,
                        });
                        return Err(LanzadorError::HallazgoCritico(pipeline.tareas[i].id));
                    }

                    // Guarda la revisión en memoria
                    let _ = self
                        .knowledge
                        .remember(
                            pipeline.tareas[i].dominio,
                            &format!("review:{}", pipeline.tareas[i].id),
                            &format!("{:?}", review.decision),
                        )
                        .await;
                }
            }
        }

        pipeline_mgr::transicionar(pipeline, EstadoPipeline::Completado);
        let _ = self.bus.publish(DixEvent::PipelineStateChanged {
            pipeline_id: pipeline.id,
            estado: pipeline.estado,
        });

        Ok(())
    }

    /// Aplica una decisión humana al pipeline.
    pub fn aplicar_approval(&self, pipeline: &mut Pipeline, approval: Approval) {
        let _ = self.bus.publish(DixEvent::ApprovalReceived {
            pipeline_id: pipeline.id,
            decision: approval.decision,
        });
        match approval.decision {
            Decision::Stop => pipeline_mgr::transicionar(pipeline, EstadoPipeline::Cancelado),
            Decision::Go => {
                if matches!(pipeline.estado, EstadoPipeline::Borrador) {
                    pipeline_mgr::transicionar(pipeline, EstadoPipeline::Activo);
                }
            }
            Decision::Wait => {} // no cambia estado
        }
    }
}
