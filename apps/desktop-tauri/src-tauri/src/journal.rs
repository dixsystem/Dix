// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.
//
// Journal transaccional de optimizaciones. Cada vez que se aplica un script,
// queda un registro con su estado (Planned → Applied → Verified, o
// RolledBack/RollbackFailed si algo sale mal). `run_doctor()` compara el
// último estado contra lo esperado para detectar transacciones que quedaron
// a medio camino.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum TransactionState {
    Planned,
    Applied,
    Verified,
    RolledBack,
    RollbackFailed,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Transaction {
    pub ts: u64,
    pub state: TransactionState,
    pub rollback_filename: String,
    pub note: Option<String>,
}

#[derive(Serialize, Deserialize, Default)]
struct JournalFile {
    transactions: Vec<Transaction>,
}

fn journal_path() -> PathBuf {
    crate::memory::config_dir().join("journal.json")
}

fn load_from(path: &Path) -> JournalFile {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_to(path: &Path, j: &JournalFile) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(j).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, &json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

fn record_planned_at(path: &Path, ts: u64, rollback_filename: &str) {
    let mut j = load_from(path);
    j.transactions.push(Transaction {
        ts,
        state: TransactionState::Planned,
        rollback_filename: rollback_filename.to_string(),
        note: None,
    });
    if j.transactions.len() > 50 {
        let excess = j.transactions.len() - 50;
        j.transactions.drain(0..excess);
    }
    let _ = save_to(path, &j);
}

fn update_state_at(path: &Path, ts: u64, state: TransactionState, note: Option<String>) {
    let mut j = load_from(path);
    if let Some(t) = j.transactions.iter_mut().find(|t| t.ts == ts) {
        t.state = state;
        t.note = note;
    }
    let _ = save_to(path, &j);
}

fn latest_at(path: &Path) -> Option<Transaction> {
    load_from(path).transactions.last().cloned()
}

pub fn record_planned(ts: u64, rollback_filename: &str) {
    record_planned_at(&journal_path(), ts, rollback_filename);
}

pub fn update_state(ts: u64, state: TransactionState, note: Option<String>) {
    update_state_at(&journal_path(), ts, state, note);
}

pub fn latest() -> Option<Transaction> {
    latest_at(&journal_path())
}

#[derive(Serialize)]
pub struct DoctorReport {
    pub has_drift: bool,
    pub detail: String,
}

fn doctor_for(t: Option<Transaction>) -> DoctorReport {
    match t {
        None => DoctorReport {
            has_drift: false,
            detail: "Sin transacciones registradas.".to_string(),
        },
        Some(t) => match t.state {
            TransactionState::Applied => DoctorReport {
                has_drift: true,
                detail: format!(
                    "Transacción {} quedó en 'Applied' sin verificar — pudo quedar en estado intermedio. Rollback disponible: {}",
                    t.ts, t.rollback_filename
                ),
            },
            TransactionState::RollbackFailed => DoctorReport {
                has_drift: true,
                detail: format!(
                    "Transacción {} falló al revertir automáticamente. Rollback manual disponible: {}",
                    t.ts, t.rollback_filename
                ),
            },
            TransactionState::Planned => DoctorReport {
                has_drift: true,
                detail: format!(
                    "Transacción {} se quedó en 'Planned': nunca llegó a ejecutarse o el proceso se interrumpió antes de aplicar nada.",
                    t.ts
                ),
            },
            TransactionState::Verified | TransactionState::RolledBack => DoctorReport {
                has_drift: false,
                detail: format!("Último estado: {:?} (ts {})", t.state, t.ts),
            },
        },
    }
}

/// "dix doctor" — detecta transacciones que quedaron a medio camino.
pub fn run_doctor() -> DoctorReport {
    doctor_for(latest())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("dix_journal_test_{}_{}.json", name, epoch_nanos()))
    }

    fn epoch_nanos() -> u128 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    }

    #[test]
    fn planned_then_verified_no_drift() {
        let path = temp_path("ok");
        record_planned_at(&path, 1, "rollback_1.sh");
        update_state_at(&path, 1, TransactionState::Applied, None);
        update_state_at(&path, 1, TransactionState::Verified, None);
        let report = doctor_for(latest_at(&path));
        assert!(!report.has_drift);
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn applied_without_verify_is_drift() {
        let path = temp_path("stuck_applied");
        record_planned_at(&path, 2, "rollback_2.sh");
        update_state_at(&path, 2, TransactionState::Applied, None);
        let report = doctor_for(latest_at(&path));
        assert!(report.has_drift);
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn rollback_failed_is_drift() {
        let path = temp_path("rollback_failed");
        record_planned_at(&path, 3, "rollback_3.sh");
        update_state_at(&path, 3, TransactionState::Applied, None);
        update_state_at(&path, 3, TransactionState::RollbackFailed, Some("pkexec no disponible".to_string()));
        let report = doctor_for(latest_at(&path));
        assert!(report.has_drift);
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn rolled_back_successfully_no_drift() {
        let path = temp_path("rolled_back_ok");
        record_planned_at(&path, 4, "rollback_4.sh");
        update_state_at(&path, 4, TransactionState::Applied, None);
        update_state_at(&path, 4, TransactionState::RolledBack, None);
        let report = doctor_for(latest_at(&path));
        assert!(!report.has_drift);
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn stuck_planned_is_drift() {
        let path = temp_path("stuck_planned");
        record_planned_at(&path, 5, "rollback_5.sh");
        // Simula interrupción: nunca llegó a Applied.
        let report = doctor_for(latest_at(&path));
        assert!(report.has_drift);
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn no_transactions_no_drift() {
        let path = temp_path("empty");
        let report = doctor_for(latest_at(&path));
        assert!(!report.has_drift);
    }

    #[test]
    fn journal_caps_at_50_entries() {
        let path = temp_path("cap50");
        for i in 0..60u64 {
            record_planned_at(&path, i, &format!("rollback_{}.sh", i));
        }
        let j = load_from(&path);
        assert_eq!(j.transactions.len(), 50);
        // Se conservan las últimas 50, no las primeras.
        assert_eq!(j.transactions.first().unwrap().ts, 10);
        let _ = fs::remove_file(&path);
    }
}
