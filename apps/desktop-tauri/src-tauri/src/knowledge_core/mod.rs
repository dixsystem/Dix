pub mod retrieval;

use crate::contracts::{Dominio, MemoryRecord};
use crate::event_bus::{DixEvent, EventBus};
use crate::memory_api::{MemoryError, StorageProvider};
use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;

/// Capa de alto nivel sobre StorageProvider.
/// Gestiona recuperación, priorización y acceso contextual a la memoria de DIX Forge.
pub struct KnowledgeCore {
    storage: Arc<dyn StorageProvider + Send + Sync>,
    bus: Arc<EventBus>,
}

impl KnowledgeCore {
    pub fn new(storage: Arc<dyn StorageProvider + Send + Sync>, bus: Arc<EventBus>) -> Self {
        Self { storage, bus }
    }

    /// Guarda nuevo conocimiento y emite evento MemoryRecordSaved.
    pub async fn remember(
        &self,
        dominio: Dominio,
        clave: &str,
        valor: &str,
    ) -> Result<MemoryRecord, MemoryError> {
        let record = MemoryRecord {
            id: Uuid::new_v4(),
            dominio,
            clave: clave.to_string(),
            valor: valor.to_string(),
            embedding: None,
            relevancia: 1.0,
            creado_en: Utc::now(),
            accedido_en: None,
        };
        self.storage.save(&record).await?;
        let _ = self.bus.publish(DixEvent::MemoryRecordSaved { record_id: record.id });
        Ok(record)
    }

    /// Recupera registros por clave (búsqueda parcial).
    pub async fn recall(
        &self,
        clave: &str,
        dominio: Option<Dominio>,
    ) -> Result<Vec<MemoryRecord>, MemoryError> {
        self.storage.search_by_clave(clave, dominio).await
    }

    /// Recupera los N registros más relevantes de un dominio.
    pub async fn recall_top(
        &self,
        dominio: Dominio,
        n: usize,
    ) -> Result<Vec<MemoryRecord>, MemoryError> {
        let all = self.storage.list_by_dominio(Some(dominio)).await?;
        Ok(retrieval::top_n(all, n))
    }

    /// Incrementa la relevancia de un registro (refuerzo de memoria).
    pub async fn reinforce(&self, id: Uuid, delta: f32) -> Result<(), MemoryError> {
        let record = self
            .storage
            .get(id)
            .await?
            .ok_or(MemoryError::NotFound(id))?;
        let mut updated = record;
        updated.relevancia = (updated.relevancia + delta).clamp(0.0, 10.0);
        self.storage.update(&updated).await
    }

    /// Actualiza la fecha de último acceso de un registro.
    pub async fn touch(&self, id: Uuid) -> Result<(), MemoryError> {
        let record = self
            .storage
            .get(id)
            .await?
            .ok_or(MemoryError::NotFound(id))?;
        let mut updated = record;
        updated.accedido_en = Some(Utc::now());
        self.storage.update(&updated).await
    }
}
