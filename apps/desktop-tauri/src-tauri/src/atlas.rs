// SPDX-License-Identifier: AGPL-3.0-only
// Copyright © 2026 DixSystem

// © 2026 DixSystem — DIX Atlas — Telemetría anónima de optimizaciones
// Solo datos de hardware y kernel. Sin hostname, sin usuario, sin IP almacenada.

use serde::{Deserialize, Serialize};
use crate::scanner::SystemScan;
use crate::policy;
use std::collections::HashMap;

const ATLAS_URL: &str = "https://dix-proxy.dixsystem.workers.dev/atlas";
const ATLAS_BEST_URL: &str = "https://dix-proxy.dixsystem.workers.dev/atlas/best";
const DIX_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Serialize)]
struct AtlasPayload {
    dix_version:    String,
    timestamp_date: String,       // "2026-06-07" — solo fecha, sin hora
    cpu_model:      String,
    cpu_cores:      usize,
    ram_gb:         u64,
    distro:         String,
    kernel:         String,
    gpu_model:      String,
    governor_antes: String,
    scheduler_antes: String,
    hugepages_antes: String,
    swappiness_antes: u8,
    score_antes:    u32,
    score_despues:  u32,
    mejora_pts:     i32,
    optimizaciones: Vec<String>,
    num_cambios:    usize,
}

/// Envía los datos del análisis al Atlas de forma asíncrona y silenciosa.
/// Fire-and-forget: si falla, no afecta a la app ni al usuario.
pub fn report(
    scan: &SystemScan,
    score_antes: u32,
    score_despues: u32,
    optimizaciones: Vec<String>,
) {
    let payload = AtlasPayload {
        dix_version:     DIX_VERSION.to_string(),
        timestamp_date:  current_date(),
        cpu_model:       scan.cpu_model.clone(),
        cpu_cores:       scan.cpu_cores,
        ram_gb:          (scan.mem_total_mb + 512) / 1024,
        distro:          format!("{} {}", scan.distro_id, scan.distro_version),
        kernel:          scan.kernel_version.clone(),
        gpu_model:       scan.gpu_model.clone(),
        governor_antes:  scan.cpu_governor.clone(),
        scheduler_antes: scan.disk_scheduler.clone(),
        hugepages_antes: scan.hugepages.clone(),
        swappiness_antes: scan.swappiness,
        score_antes,
        score_despues,
        mejora_pts:      score_despues as i32 - score_antes as i32,
        num_cambios:     optimizaciones.len(),
        optimizaciones,
    };

    // Validación de privacidad ANTES de cualquier llamada de red.
    // Si el payload no cumple la whitelist de policy.rs, se aborta el envío.
    let field_map: HashMap<String, String> = serde_json::to_value(&payload)
        .ok()
        .and_then(|v| v.as_object().cloned())
        .map(|obj| obj.into_iter().map(|(k, v)| (k, v.to_string())).collect())
        .unwrap_or_default();
    if !policy::atlas_payload_is_safe(&field_map) {
        return;
    }

    // Spawn en un thread separado — nunca bloquea el hilo principal de Tauri
    std::thread::spawn(move || {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build();
        if let Ok(rt) = rt {
            rt.block_on(async {
                let client = reqwest::Client::builder()
                    .timeout(std::time::Duration::from_secs(8))
                    .build()
                    .unwrap_or_default();
                let _ = client
                    .post(ATLAS_URL)
                    .header("content-type", "application/json")
                    .header("X-Atlas-Version", DIX_VERSION)
                    .json(&payload)
                    .send()
                    .await;
                // Ignoramos el resultado — si falla, silencio total
            });
        }
    });
}

pub fn current_date() -> String {
    // Fecha actual en formato ISO sin depender de chrono
    // Usamos /proc/driver/rtc o simplemente SystemTime
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Conversión simple epoch → fecha (sin librería externa)
    let days_total = secs / 86400;
    let mut year = 1970u32;
    let mut days = days_total as u32;
    loop {
        let days_in_year = if is_leap(year) { 366 } else { 365 };
        if days < days_in_year { break; }
        days -= days_in_year;
        year += 1;
    }
    let months = if is_leap(year) {
        [31,29,31,30,31,30,31,31,30,31,30,31]
    } else {
        [31,28,31,30,31,30,31,31,30,31,30,31]
    };
    let mut month = 1u32;
    for m in months.iter() {
        if days < *m { break; }
        days -= m;
        month += 1;
    }
    format!("{:04}-{:02}-{:02}", year, month, days + 1)
}

fn is_leap(y: u32) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

/// Mejor configuración conocida en Atlas para un modelo de CPU, según otros
/// usuarios que optaron por compartir sus datos. Todos los campos son no
/// identificables — mismo contrato que `AtlasPayload`.
#[derive(Deserialize, Debug)]
pub struct AtlasBest {
    pub cpu: String,
    pub n_muestras: u32,
    pub mejora: i32,
    pub score_antes: u32,
    pub score_desp: u32,
    pub governor: String,
    pub scheduler: String,
    pub hugepages: String,
    pub swappiness: u8,
    pub opts: Vec<String>,
}

#[derive(Deserialize)]
struct AtlasBestResponse {
    found: bool,
    #[serde(default)]
    cpu: Option<String>,
    #[serde(default)]
    n_muestras: Option<u32>,
    #[serde(default)]
    mejora: Option<i32>,
    #[serde(default)]
    score_antes: Option<u32>,
    #[serde(default)]
    score_desp: Option<u32>,
    #[serde(default)]
    governor: Option<String>,
    #[serde(default)]
    scheduler: Option<String>,
    #[serde(default)]
    hugepages: Option<String>,
    #[serde(default)]
    swappiness: Option<u8>,
    #[serde(default)]
    opts: Option<Vec<String>>,
}

/// Consulta la mejor config medida por la comunidad para este modelo de CPU.
/// Nunca llama a la red si el usuario no ha aceptado Atlas explícitamente —
/// la comprobación de opt-in vive en el llamador (ver main.rs::analyze_system)
/// para mantener esta función simple, pero documentamos la invariante aquí:
/// NUNCA llamar a fetch_best() sin haber comprobado antes
/// memory::get_atlas_opt_in() == Some(true).
/// Si falla, tarda demasiado, o no hay datos para ese CPU: devuelve None en
/// silencio — nunca debe bloquear ni degradar el análisis principal.
pub async fn fetch_best(cpu_model: &str) -> Option<AtlasBest> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(4))
        .build()
        .ok()?;
    let resp = client
        .get(ATLAS_BEST_URL)
        .query(&[("cpu", cpu_model)])
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let f: AtlasBestResponse = resp.json().await.ok()?;
    if !f.found {
        return None;
    }
    Some(AtlasBest {
        cpu: f.cpu?,
        n_muestras: f.n_muestras?,
        mejora: f.mejora?,
        score_antes: f.score_antes?,
        score_desp: f.score_desp?,
        governor: f.governor?,
        scheduler: f.scheduler?,
        hugepages: f.hugepages?,
        swappiness: f.swappiness?,
        opts: f.opts?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn atlas_best_response_not_found_deserializes() {
        let raw = r#"{"found":false}"#;
        let parsed: AtlasBestResponse = serde_json::from_str(raw).unwrap();
        assert!(!parsed.found);
        assert!(parsed.cpu.is_none());
    }

    #[test]
    fn atlas_best_response_found_deserializes_with_real_fields() {
        // Mismo formato exacto que devuelve dix-proxy/src/index.js::handleAtlasBest,
        // probado de verdad contra wrangler dev --local el 2026-06-22.
        let raw = r#"{"found":true,"cpu":"AMD Ryzen 9 7950X","n_muestras":1,"mejora":36,
            "score_antes":52,"score_desp":88,"governor":"powersave","scheduler":"cfq",
            "hugepages":"always","swappiness":60,"opts":["CPU: Activar governor performance"],
            "ts":"2026-06-22"}"#;
        let parsed: AtlasBestResponse = serde_json::from_str(raw).unwrap();
        assert!(parsed.found);
        assert_eq!(parsed.cpu.as_deref(), Some("AMD Ryzen 9 7950X"));
        assert_eq!(parsed.mejora, Some(36));
        assert_eq!(parsed.swappiness, Some(60));
    }
}
