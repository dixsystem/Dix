pub mod error;
pub mod sqlite;
pub mod chromadb;

pub use error::MemoryError;
pub use sqlite::SqliteProvider;
pub use chromadb::ChromaDbProvider;

use crate::contracts::{Dominio, MemoryRecord};
use std::future::Future;
use std::pin::Pin;
use uuid::Uuid;

/// Contrato de almacenamiento de memoria para DIX Forge.
/// Ningún módulo accede a SQLite/ChromaDB directamente — solo via este trait.
pub trait StorageProvider: Send + Sync {
    fn save<'a>(
        &'a self,
        record: &'a MemoryRecord,
    ) -> Pin<Box<dyn Future<Output = Result<(), MemoryError>> + Send + 'a>>;

    fn get<'a>(
        &'a self,
        id: Uuid,
    ) -> Pin<Box<dyn Future<Output = Result<Option<MemoryRecord>, MemoryError>> + Send + 'a>>;

    fn search_by_clave<'a>(
        &'a self,
        clave: &'a str,
        dominio: Option<Dominio>,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<MemoryRecord>, MemoryError>> + Send + 'a>>;

    fn update<'a>(
        &'a self,
        record: &'a MemoryRecord,
    ) -> Pin<Box<dyn Future<Output = Result<(), MemoryError>> + Send + 'a>>;

    fn delete<'a>(
        &'a self,
        id: Uuid,
    ) -> Pin<Box<dyn Future<Output = Result<(), MemoryError>> + Send + 'a>>;

    fn list_by_dominio<'a>(
        &'a self,
        dominio: Option<Dominio>,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<MemoryRecord>, MemoryError>> + Send + 'a>>;
}
