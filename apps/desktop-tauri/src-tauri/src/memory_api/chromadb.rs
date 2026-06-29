use super::{MemoryError, StorageProvider};
use crate::contracts::{Dominio, MemoryRecord};
use chrono::Utc;
use reqwest::Client;
use serde_json::{json, Value};
use std::future::Future;
use std::pin::Pin;
use uuid::Uuid;

const COLLECTION: &str = "dix_forge_memory";

/// Implementación ChromaDB del StorageProvider via HTTP.
pub struct ChromaDbProvider {
    base_url: String,
    client: Client,
}

impl ChromaDbProvider {
    /// Crea el provider apuntando a la URL base de ChromaDB.
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            client: Client::new(),
        }
    }

    async fn ensure_collection(&self) -> Result<(), MemoryError> {
        let url = format!("{}/api/v1/collections", self.base_url);
        let resp = self
            .client
            .post(&url)
            .json(&json!({ "name": COLLECTION }))
            .send()
            .await
            .map_err(|e| MemoryError::ChromaUnavailable(e.to_string()))?;
        // 200 = created, 409 = ya existe — ambos son OK
        if !resp.status().is_success() && resp.status().as_u16() != 409 {
            return Err(MemoryError::ChromaUnavailable(format!(
                "No se pudo crear colección: {}",
                resp.status()
            )));
        }
        Ok(())
    }
}

fn record_to_metadata(r: &MemoryRecord) -> Value {
    json!({
        "dominio": format!("{:?}", r.dominio),
        "clave": r.clave,
        "valor": r.valor,
        "relevancia": r.relevancia,
        "creado_en": r.creado_en.to_rfc3339(),
        "accedido_en": r.accedido_en.map(|d| d.to_rfc3339()),
    })
}

impl StorageProvider for ChromaDbProvider {
    fn save<'a>(
        &'a self,
        record: &'a MemoryRecord,
    ) -> Pin<Box<dyn Future<Output = Result<(), MemoryError>> + Send + 'a>> {
        Box::pin(async move {
            self.ensure_collection().await?;
            let url = format!("{}/api/v1/collections/{}/add", self.base_url, COLLECTION);
            let embedding = record.embedding.clone().unwrap_or_default();
            let body = json!({
                "ids": [record.id.to_string()],
                "embeddings": [embedding],
                "metadatas": [record_to_metadata(record)],
                "documents": [record.valor],
            });
            let resp = self
                .client
                .post(&url)
                .json(&body)
                .send()
                .await
                .map_err(|e| MemoryError::ChromaUnavailable(e.to_string()))?;
            if !resp.status().is_success() {
                return Err(MemoryError::ChromaUnavailable(format!(
                    "Error al guardar: {}",
                    resp.status()
                )));
            }
            Ok(())
        })
    }

    fn get<'a>(
        &'a self,
        id: Uuid,
    ) -> Pin<Box<dyn Future<Output = Result<Option<MemoryRecord>, MemoryError>> + Send + 'a>> {
        Box::pin(async move {
            self.ensure_collection().await?;
            let url = format!("{}/api/v1/collections/{}/get", self.base_url, COLLECTION);
            let body = json!({ "ids": [id.to_string()], "include": ["metadatas", "documents"] });
            let resp = self
                .client
                .post(&url)
                .json(&body)
                .send()
                .await
                .map_err(|e| MemoryError::ChromaUnavailable(e.to_string()))?;
            let v: Value = resp.json().await?;
            let ids = v["ids"].as_array().and_then(|a| a.first());
            if ids.is_none() {
                return Ok(None);
            }
            let meta = &v["metadatas"][0];
            let record = MemoryRecord {
                id,
                dominio: crate::contracts::Dominio::Rust, // simplificado
                clave: meta["clave"].as_str().unwrap_or("").to_string(),
                valor: v["documents"][0].as_str().unwrap_or("").to_string(),
                embedding: None,
                relevancia: meta["relevancia"].as_f64().unwrap_or(1.0) as f32,
                creado_en: meta["creado_en"]
                    .as_str()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or_else(Utc::now),
                accedido_en: meta["accedido_en"]
                    .as_str()
                    .and_then(|s| s.parse().ok()),
            };
            Ok(Some(record))
        })
    }

    fn search_by_clave<'a>(
        &'a self,
        clave: &'a str,
        _dominio: Option<Dominio>,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<MemoryRecord>, MemoryError>> + Send + 'a>> {
        Box::pin(async move {
            self.ensure_collection().await?;
            let url = format!("{}/api/v1/collections/{}/query", self.base_url, COLLECTION);
            let body = json!({
                "query_texts": [clave],
                "n_results": 10,
                "include": ["metadatas", "documents"],
            });
            let resp = self
                .client
                .post(&url)
                .json(&body)
                .send()
                .await
                .map_err(|e| MemoryError::ChromaUnavailable(e.to_string()))?;
            let v: Value = resp.json().await?;
            let ids = match v["ids"][0].as_array() {
                Some(a) => a.clone(),
                None => return Ok(vec![]),
            };
            let mut results = Vec::new();
            for (i, id_val) in ids.iter().enumerate() {
                let id_str = id_val.as_str().unwrap_or("");
                let id = id_str.parse().unwrap_or_else(|_| Uuid::new_v4());
                let meta = &v["metadatas"][0][i];
                let doc = v["documents"][0][i].as_str().unwrap_or("");
                results.push(MemoryRecord {
                    id,
                    dominio: Dominio::Rust,
                    clave: meta["clave"].as_str().unwrap_or("").to_string(),
                    valor: doc.to_string(),
                    embedding: None,
                    relevancia: meta["relevancia"].as_f64().unwrap_or(1.0) as f32,
                    creado_en: meta["creado_en"]
                        .as_str()
                        .and_then(|s| s.parse().ok())
                        .unwrap_or_else(Utc::now),
                    accedido_en: meta["accedido_en"].as_str().and_then(|s| s.parse().ok()),
                });
            }
            Ok(results)
        })
    }

    fn update<'a>(
        &'a self,
        record: &'a MemoryRecord,
    ) -> Pin<Box<dyn Future<Output = Result<(), MemoryError>> + Send + 'a>> {
        Box::pin(async move {
            self.ensure_collection().await?;
            let url = format!("{}/api/v1/collections/{}/update", self.base_url, COLLECTION);
            let embedding = record.embedding.clone().unwrap_or_default();
            let body = json!({
                "ids": [record.id.to_string()],
                "embeddings": [embedding],
                "metadatas": [record_to_metadata(record)],
                "documents": [record.valor],
            });
            let resp = self
                .client
                .post(&url)
                .json(&body)
                .send()
                .await
                .map_err(|e| MemoryError::ChromaUnavailable(e.to_string()))?;
            if !resp.status().is_success() {
                return Err(MemoryError::ChromaUnavailable(format!(
                    "Error al actualizar: {}",
                    resp.status()
                )));
            }
            Ok(())
        })
    }

    fn delete<'a>(
        &'a self,
        id: Uuid,
    ) -> Pin<Box<dyn Future<Output = Result<(), MemoryError>> + Send + 'a>> {
        Box::pin(async move {
            self.ensure_collection().await?;
            let url = format!("{}/api/v1/collections/{}/delete", self.base_url, COLLECTION);
            let body = json!({ "ids": [id.to_string()] });
            let resp = self
                .client
                .post(&url)
                .json(&body)
                .send()
                .await
                .map_err(|e| MemoryError::ChromaUnavailable(e.to_string()))?;
            if !resp.status().is_success() {
                return Err(MemoryError::ChromaUnavailable(format!(
                    "Error al eliminar: {}",
                    resp.status()
                )));
            }
            Ok(())
        })
    }

    fn list_by_dominio<'a>(
        &'a self,
        dominio: Option<Dominio>,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<MemoryRecord>, MemoryError>> + Send + 'a>> {
        Box::pin(async move {
            let query = match &dominio {
                Some(d) => format!("{:?}", d).to_lowercase(),
                None => String::new(),
            };
            self.search_by_clave(&query, dominio).await
        })
    }
}
