// © 2026 DixSystem — DIX Atlas — Telemetría anónima de optimizaciones
// Solo datos de hardware y kernel. Sin hostname, sin usuario, sin IP almacenada.

use serde::Serialize;
use crate::scanner::SystemScan;

const ATLAS_URL: &str = "https://dix-proxy.dixsystem.workers.dev/atlas";
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

fn current_date() -> String {
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
