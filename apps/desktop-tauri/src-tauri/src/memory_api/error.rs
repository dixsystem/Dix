use uuid::Uuid;

/// Errores del subsistema de memoria de DIX Forge.
#[derive(Debug, thiserror::Error)]
pub enum MemoryError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] sqlx::Error),
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("Serialización: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Registro no encontrado: {0}")]
    NotFound(Uuid),
    #[error("ChromaDB no disponible: {0}")]
    ChromaUnavailable(String),
}
