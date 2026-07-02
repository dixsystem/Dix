// SPDX-License-Identifier: AGPL-3.0-only
// Copyright © 2026 DixSystem
//
// Circuit breaker de gasto de IA. Si un bug de estado en el frontend entra en
// un bucle de análisis, esto evita que se agote el crédito de la API de
// Claude en minutos: un tope diario de llamadas, comprobado e incrementado
// de forma atómica justo antes de cada llamada real a la red.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// Tope diario de llamadas reales a la API (no cuenta los aciertos de
/// caché). Generoso para uso normal — varias decenas de análisis por
/// sesión — pero corta un bucle descontrolado mucho antes de que sea
/// costoso en la factura de Anthropic.
const DAILY_LIMIT: u32 = 50;

#[derive(Serialize, Deserialize, Default)]
struct BudgetState {
    date: String,
    count: u32,
}

fn budget_path() -> PathBuf {
    crate::memory::config_dir().join("ai_budget.json")
}

fn load_from(path: &Path) -> BudgetState {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_to(path: &Path, state: &BudgetState) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, &json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

/// Comprueba el presupuesto e incrementa el contador atómicamente. Si ya se
/// alcanzó el límite del día, devuelve Err sin tocar el contador — la
/// llamada de red ni siquiera se intenta.
fn check_and_increment_at(path: &Path, today: &str, limit: u32) -> Result<u32, String> {
    let mut state = load_from(path);
    if state.date != today {
        state.date = today.to_string();
        state.count = 0;
    }
    if state.count >= limit {
        return Err(format!(
            "Límite diario de análisis con IA alcanzado ({}/{}). Esto protege tu crédito de \
             la API ante un posible error de la app. Vuelve a intentarlo en unas horas o, si \
             crees que esto es un error, contacta con soporte.",
            state.count, limit
        ));
    }
    state.count += 1;
    let count = state.count;
    save_to(path, &state)?;
    Ok(count)
}

pub fn check_and_increment() -> Result<u32, String> {
    check_and_increment_at(&budget_path(), &crate::atlas::current_date(), DAILY_LIMIT)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("dix_ai_budget_test_{}_{}.json", name, epoch_nanos()))
    }

    fn epoch_nanos() -> u128 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    }

    #[test]
    fn allows_calls_under_limit() {
        let path = temp_path("under");
        for i in 1..=5 {
            let count = check_and_increment_at(&path, "2026-06-22", 10).unwrap();
            assert_eq!(count, i);
        }
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn blocks_calls_at_limit() {
        let path = temp_path("at_limit");
        for _ in 0..3 {
            check_and_increment_at(&path, "2026-06-22", 3).unwrap();
        }
        let result = check_and_increment_at(&path, "2026-06-22", 3);
        assert!(result.is_err());
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn resets_on_new_day() {
        let path = temp_path("reset");
        for _ in 0..3 {
            check_and_increment_at(&path, "2026-06-22", 3).unwrap();
        }
        assert!(check_and_increment_at(&path, "2026-06-22", 3).is_err());
        // Nuevo día: el contador debe resetear y permitir de nuevo.
        let count = check_and_increment_at(&path, "2026-06-23", 3).unwrap();
        assert_eq!(count, 1);
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn never_decrements_count_on_block() {
        let path = temp_path("no_decrement");
        for _ in 0..2 {
            check_and_increment_at(&path, "2026-06-22", 2).unwrap();
        }
        let _ = check_and_increment_at(&path, "2026-06-22", 2); // bloqueado
        let state = load_from(&path);
        assert_eq!(state.count, 2); // no se incrementó al bloquear
        let _ = fs::remove_file(&path);
    }
}
