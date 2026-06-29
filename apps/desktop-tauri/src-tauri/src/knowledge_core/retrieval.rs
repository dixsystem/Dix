use crate::contracts::MemoryRecord;

/// Ordena registros por relevancia descendente y devuelve los primeros N.
pub fn top_n(mut records: Vec<MemoryRecord>, n: usize) -> Vec<MemoryRecord> {
    records.sort_by(|a, b| b.relevancia.partial_cmp(&a.relevancia).unwrap_or(std::cmp::Ordering::Equal));
    records.truncate(n);
    records
}
