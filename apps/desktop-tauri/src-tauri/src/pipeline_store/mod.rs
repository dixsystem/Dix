use crate::contracts::Pipeline;
use sqlx::SqlitePool;
use uuid::Uuid;

#[derive(Debug, thiserror::Error)]
pub enum PipelineStoreError {
    #[error("SQLite: {0}")]
    Db(#[from] sqlx::Error),
    #[error("JSON: {0}")]
    Json(#[from] serde_json::Error),
}

/// Persiste pipelines completos en SQLite como JSON.
pub struct PipelineStore {
    pool: SqlitePool,
}

impl PipelineStore {
    pub async fn new(db_path: &str) -> Result<Self, PipelineStoreError> {
        let url = format!("sqlite:{db_path}?mode=rwc");
        let pool = SqlitePool::connect(&url).await?;
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS pipelines (
                id             TEXT PRIMARY KEY NOT NULL,
                nombre         TEXT NOT NULL,
                estado         TEXT NOT NULL,
                data_json      TEXT NOT NULL,
                creado_en      TEXT NOT NULL,
                actualizado_en TEXT NOT NULL
            )",
        )
        .execute(&pool)
        .await?;
        Ok(Self { pool })
    }

    /// Inserta o actualiza un pipeline (upsert por id).
    pub async fn upsert(&self, pipeline: &Pipeline) -> Result<(), PipelineStoreError> {
        let data = serde_json::to_string(pipeline)?;
        sqlx::query(
            "INSERT OR REPLACE INTO pipelines
             (id, nombre, estado, data_json, creado_en, actualizado_en)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(pipeline.id.to_string())
        .bind(&pipeline.nombre)
        .bind(format!("{:?}", pipeline.estado))
        .bind(&data)
        .bind(pipeline.creado_en.to_rfc3339())
        .bind(pipeline.actualizado_en.to_rfc3339())
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Devuelve todos los pipelines ordenados por fecha de creación descendente.
    pub async fn list_all(&self) -> Result<Vec<Pipeline>, PipelineStoreError> {
        let rows = sqlx::query_as::<_, (String,)>(
            "SELECT data_json FROM pipelines ORDER BY creado_en DESC",
        )
        .fetch_all(&self.pool)
        .await?;

        rows.into_iter()
            .map(|(json,)| serde_json::from_str(&json).map_err(PipelineStoreError::Json))
            .collect()
    }

    /// Elimina un pipeline por id.
    pub async fn delete(&self, id: Uuid) -> Result<(), PipelineStoreError> {
        sqlx::query("DELETE FROM pipelines WHERE id = ?")
            .bind(id.to_string())
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
