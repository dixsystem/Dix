use super::{MemoryError, StorageProvider};
use crate::contracts::{Dominio, MemoryRecord};
use chrono::{DateTime, Utc};
use sqlx::SqlitePool;
use std::future::Future;
use std::pin::Pin;
use uuid::Uuid;

/// Implementación SQLite del StorageProvider.
pub struct SqliteProvider {
    pool: SqlitePool,
}

impl SqliteProvider {
    /// Crea el provider y garantiza que la tabla existe.
    pub async fn new(db_path: &str) -> Result<Self, MemoryError> {
        let url = format!("sqlite:{db_path}?mode=rwc");
        let pool = SqlitePool::connect(&url).await?;
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS memory_records (
                id          TEXT PRIMARY KEY NOT NULL,
                dominio     TEXT NOT NULL,
                clave       TEXT NOT NULL,
                valor       TEXT NOT NULL,
                embedding   TEXT,
                relevancia  REAL NOT NULL DEFAULT 1.0,
                creado_en   TEXT NOT NULL,
                accedido_en TEXT
            )",
        )
        .execute(&pool)
        .await?;
        Ok(Self { pool })
    }
}

// ── helpers de conversión ────────────────────────────────────────────────────

fn dominio_to_str(d: &Dominio) -> &'static str {
    match d {
        Dominio::Rust => "rust",
        Dominio::Frontend => "frontend",
        Dominio::Documentacion => "documentacion",
        Dominio::Arquitectura => "arquitectura",
        Dominio::Testing => "testing",
        Dominio::Deploy => "deploy",
    }
}

fn str_to_dominio(s: &str) -> Dominio {
    match s {
        "frontend" => Dominio::Frontend,
        "documentacion" => Dominio::Documentacion,
        "arquitectura" => Dominio::Arquitectura,
        "testing" => Dominio::Testing,
        "deploy" => Dominio::Deploy,
        _ => Dominio::Rust,
    }
}

fn row_to_record(
    id: &str,
    dominio: &str,
    clave: &str,
    valor: &str,
    embedding_json: Option<&str>,
    relevancia: f64,
    creado_en: &str,
    accedido_en: Option<&str>,
) -> Result<MemoryRecord, MemoryError> {
    let embedding: Option<Vec<f32>> = match embedding_json {
        Some(j) => Some(serde_json::from_str(j)?),
        None => None,
    };
    let accedido: Option<DateTime<Utc>> = match accedido_en {
        Some(s) => Some(s.parse().unwrap_or(Utc::now())),
        None => None,
    };
    Ok(MemoryRecord {
        id: id.parse().unwrap_or_else(|_| Uuid::new_v4()),
        dominio: str_to_dominio(dominio),
        clave: clave.to_string(),
        valor: valor.to_string(),
        embedding,
        relevancia: relevancia as f32,
        creado_en: creado_en.parse().unwrap_or(Utc::now()),
        accedido_en: accedido,
    })
}

// ── StorageProvider impl ─────────────────────────────────────────────────────

impl StorageProvider for SqliteProvider {
    fn save<'a>(
        &'a self,
        record: &'a MemoryRecord,
    ) -> Pin<Box<dyn Future<Output = Result<(), MemoryError>> + Send + 'a>> {
        Box::pin(async move {
            let embedding_json = match &record.embedding {
                Some(v) => Some(serde_json::to_string(v)?),
                None => None,
            };
            sqlx::query(
                "INSERT OR REPLACE INTO memory_records
                 (id, dominio, clave, valor, embedding, relevancia, creado_en, accedido_en)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(record.id.to_string())
            .bind(dominio_to_str(&record.dominio))
            .bind(&record.clave)
            .bind(&record.valor)
            .bind(embedding_json)
            .bind(record.relevancia as f64)
            .bind(record.creado_en.to_rfc3339())
            .bind(record.accedido_en.map(|d| d.to_rfc3339()))
            .execute(&self.pool)
            .await?;
            Ok(())
        })
    }

    fn get<'a>(
        &'a self,
        id: Uuid,
    ) -> Pin<Box<dyn Future<Output = Result<Option<MemoryRecord>, MemoryError>> + Send + 'a>> {
        Box::pin(async move {
            let row = sqlx::query_as::<_, (String, String, String, String, Option<String>, f64, String, Option<String>)>(
                "SELECT id, dominio, clave, valor, embedding, relevancia, creado_en, accedido_en
                 FROM memory_records WHERE id = ?",
            )
            .bind(id.to_string())
            .fetch_optional(&self.pool)
            .await?;

            match row {
                None => Ok(None),
                Some((id, dom, clave, valor, emb, rel, cr, ac)) => {
                    Ok(Some(row_to_record(&id, &dom, &clave, &valor, emb.as_deref(), rel, &cr, ac.as_deref())?))
                }
            }
        })
    }

    fn search_by_clave<'a>(
        &'a self,
        clave: &'a str,
        dominio: Option<Dominio>,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<MemoryRecord>, MemoryError>> + Send + 'a>> {
        Box::pin(async move {
            let pattern = format!("%{clave}%");
            let rows = match dominio {
                None => {
                    sqlx::query_as::<_, (String, String, String, String, Option<String>, f64, String, Option<String>)>(
                        "SELECT id, dominio, clave, valor, embedding, relevancia, creado_en, accedido_en
                         FROM memory_records WHERE clave LIKE ?",
                    )
                    .bind(&pattern)
                    .fetch_all(&self.pool)
                    .await?
                }
                Some(d) => {
                    sqlx::query_as::<_, (String, String, String, String, Option<String>, f64, String, Option<String>)>(
                        "SELECT id, dominio, clave, valor, embedding, relevancia, creado_en, accedido_en
                         FROM memory_records WHERE clave LIKE ? AND dominio = ?",
                    )
                    .bind(&pattern)
                    .bind(dominio_to_str(&d))
                    .fetch_all(&self.pool)
                    .await?
                }
            };
            rows.into_iter()
                .map(|(id, dom, clave, valor, emb, rel, cr, ac)| {
                    row_to_record(&id, &dom, &clave, &valor, emb.as_deref(), rel, &cr, ac.as_deref())
                })
                .collect()
        })
    }

    fn update<'a>(
        &'a self,
        record: &'a MemoryRecord,
    ) -> Pin<Box<dyn Future<Output = Result<(), MemoryError>> + Send + 'a>> {
        Box::pin(async move {
            let embedding_json = match &record.embedding {
                Some(v) => Some(serde_json::to_string(v)?),
                None => None,
            };
            sqlx::query(
                "UPDATE memory_records SET dominio=?, clave=?, valor=?, embedding=?,
                 relevancia=?, accedido_en=? WHERE id=?",
            )
            .bind(dominio_to_str(&record.dominio))
            .bind(&record.clave)
            .bind(&record.valor)
            .bind(embedding_json)
            .bind(record.relevancia as f64)
            .bind(record.accedido_en.map(|d| d.to_rfc3339()))
            .bind(record.id.to_string())
            .execute(&self.pool)
            .await?;
            Ok(())
        })
    }

    fn delete<'a>(
        &'a self,
        id: Uuid,
    ) -> Pin<Box<dyn Future<Output = Result<(), MemoryError>> + Send + 'a>> {
        Box::pin(async move {
            sqlx::query("DELETE FROM memory_records WHERE id = ?")
                .bind(id.to_string())
                .execute(&self.pool)
                .await?;
            Ok(())
        })
    }

    fn list_by_dominio<'a>(
        &'a self,
        dominio: Option<Dominio>,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<MemoryRecord>, MemoryError>> + Send + 'a>> {
        Box::pin(async move {
            let rows = match dominio {
                None => {
                    sqlx::query_as::<_, (String, String, String, String, Option<String>, f64, String, Option<String>)>(
                        "SELECT id, dominio, clave, valor, embedding, relevancia, creado_en, accedido_en
                         FROM memory_records ORDER BY relevancia DESC",
                    )
                    .fetch_all(&self.pool)
                    .await?
                }
                Some(d) => {
                    sqlx::query_as::<_, (String, String, String, String, Option<String>, f64, String, Option<String>)>(
                        "SELECT id, dominio, clave, valor, embedding, relevancia, creado_en, accedido_en
                         FROM memory_records WHERE dominio = ? ORDER BY relevancia DESC",
                    )
                    .bind(dominio_to_str(&d))
                    .fetch_all(&self.pool)
                    .await?
                }
            };
            rows.into_iter()
                .map(|(id, dom, clave, valor, emb, rel, cr, ac)| {
                    row_to_record(&id, &dom, &clave, &valor, emb.as_deref(), rel, &cr, ac.as_deref())
                })
                .collect()
        })
    }
}
