pub mod monitor;

use crate::contracts::{EstadoPipeline, Pipeline};
use crate::event_bus::EventBus;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use uuid::Uuid;

/// Error del Panel.
#[derive(Debug, thiserror::Error)]
pub enum PanelError {
    #[error("Lock envenenado")]
    LockPoisoned,
    #[error("Pipeline no encontrado: {0}")]
    NotFound(Uuid),
}

/// Resumen del estado general de todos los pipelines registrados.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ResumenPanel {
    pub total: usize,
    pub activos: usize,
    pub completados: usize,
    pub fallidos: usize,
    pub cancelados: usize,
}

/// Dashboard de monitoreo en memoria de todos los pipelines activos.
pub struct Panel {
    pub(crate) pipelines: Arc<RwLock<HashMap<Uuid, Pipeline>>>,
    _bus: Arc<EventBus>,
}

impl Panel {
    pub fn new(bus: Arc<EventBus>) -> Self {
        Self {
            pipelines: Arc::new(RwLock::new(HashMap::new())),
            _bus: bus,
        }
    }

    /// Registra un pipeline en el panel.
    pub fn registrar(&self, pipeline: Pipeline) -> Result<(), PanelError> {
        self.pipelines
            .write()
            .map_err(|_| PanelError::LockPoisoned)?
            .insert(pipeline.id, pipeline);
        Ok(())
    }

    /// Devuelve todos los pipelines en estado Activo.
    pub fn activos(&self) -> Result<Vec<Pipeline>, PanelError> {
        let lock = self.pipelines.read().map_err(|_| PanelError::LockPoisoned)?;
        Ok(lock
            .values()
            .filter(|p| matches!(p.estado, EstadoPipeline::Activo))
            .cloned()
            .collect())
    }

    /// Devuelve un pipeline por su ID.
    pub fn get(&self, id: Uuid) -> Result<Option<Pipeline>, PanelError> {
        let lock = self.pipelines.read().map_err(|_| PanelError::LockPoisoned)?;
        Ok(lock.get(&id).cloned())
    }

    /// Devuelve un resumen del estado de todos los pipelines registrados.
    pub fn resumen(&self) -> Result<ResumenPanel, PanelError> {
        let lock = self.pipelines.read().map_err(|_| PanelError::LockPoisoned)?;
        let total = lock.len();
        let activos = lock.values().filter(|p| matches!(p.estado, EstadoPipeline::Activo)).count();
        let completados = lock.values().filter(|p| matches!(p.estado, EstadoPipeline::Completado)).count();
        let fallidos = lock.values().filter(|p| matches!(p.estado, EstadoPipeline::Fallido)).count();
        let cancelados = lock.values().filter(|p| matches!(p.estado, EstadoPipeline::Cancelado)).count();
        Ok(ResumenPanel { total, activos, completados, fallidos, cancelados })
    }
}
