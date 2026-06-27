// © 2026 DixSystem — Todos los derechos reservados.

use crate::memory;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReferralStatus {
    pub code: String,
    pub downloads: u32,
    pub activated: bool,
    pub email: Option<String>,
}

fn fnv1a(s: &str) -> u64 {
    let mut h: u64 = 14695981039346656037;
    for b in s.bytes() {
        h ^= b as u64;
        h = h.wrapping_mul(1099511628211);
    }
    h
}

fn machine_id() -> String {
    #[cfg(target_os = "windows")]
    {
        crate::winutil::run_powershell(
            "(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography').MachineGuid",
            std::time::Duration::from_secs(10),
        )
        .filter(|s| s.len() >= 16)
        .unwrap_or_else(|| "unknown_win".to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::fs::read_to_string("/etc/machine-id")
            .unwrap_or_else(|_| std::fs::read_to_string("/proc/cpuinfo").unwrap_or_default())
    }
}

fn generate_code() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let seed = fnv1a(&format!("{}{}", nanos, machine_id().trim()));
    let a = ((seed >> 16) & 0xFFFF) as u32;
    let b = (seed & 0xFFFF) as u32;
    format!("DIX-{:04X}-{:04X}", a, b)
}

/// Devuelve el código del usuario — crea uno nuevo si es la primera vez.
pub fn get_or_create_code() -> String {
    if let Some(code) = memory::get_referral_code() {
        return code;
    }
    let code = generate_code();
    let _ = memory::save_referral_code(&code);
    code
}

const PROXY_BASE: &str = "https://dix-proxy.dixsystem.workers.dev";

/// Registra el código en el worker. Devuelve Ok(true) si se registró ahora, Ok(false) si ya existía.
pub async fn register(code: &str, device_id: &str, email: Option<&str>) -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let mut payload = serde_json::json!({
        "code": code,
        "device_id": device_id,
    });
    if let Some(e) = email {
        payload["email"] = serde_json::Value::String(e.to_string());
    }

    let resp = client
        .post(format!("{}/referral/register", PROXY_BASE))
        .header("content-type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Error de red: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Error del servidor: {}", resp.status()));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(!data["already_registered"].as_bool().unwrap_or(false))
}

/// Consulta el estado actual del referral (descargas, activado).
pub async fn get_status(code: &str) -> Result<ReferralStatus, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(format!("{}/referral/{}", PROXY_BASE, code))
        .send()
        .await
        .map_err(|e| format!("Error de red: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Código no encontrado: {}", resp.status()));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(ReferralStatus {
        code: data["code"].as_str().unwrap_or(code).to_string(),
        downloads: data["downloads"].as_u64().unwrap_or(0) as u32,
        activated: data["activated"].as_bool().unwrap_or(false),
        email: memory::get_referral_email(),
    })
}
