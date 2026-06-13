// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.

use obfstr::obfstr;
use serde::{Deserialize, Serialize};
use crate::memory;

#[derive(Deserialize, Debug)]
struct ApiResponse {
    content: Vec<ContentBlock>,
    #[serde(default)]
    error: Option<ApiError>,
}

#[derive(Deserialize, Debug)]
struct ApiError {
    message: String,
    #[serde(rename = "type")]
    error_type: String,
}

#[derive(Deserialize, Debug)]
struct ContentBlock {
    #[serde(rename = "type")]
    block_type: String,
    #[serde(default)]
    text: String,
}

#[derive(Serialize)]
struct Request {
    model: String,
    max_tokens: u32,
    system: String,
    messages: Vec<Msg>,
}

#[derive(Serialize)]
struct Msg {
    role: String,
    content: String,
}

pub async fn call(system: &str, user: &str, max_tokens: u32) -> Result<String, String> {
    let client = reqwest::Client::new();
    let body = Request {
        model: obfstr!("claude-sonnet-4-6").to_string(),
        max_tokens,
        system: system.to_string(),
        messages: vec![Msg {
            role: obfstr!("user").to_string(),
            content: user.to_string(),
        }],
    };

    // Si hay API key directa → llamada directa a Anthropic sin pasar por el proxy
    let api_key = memory::get_api_key();
    let use_direct = api_key.is_some();

    let response = if use_direct {
        client
            .post("https://api.anthropic.com/v1/messages")
            .header("content-type", "application/json")
            .header("x-api-key", api_key.unwrap())
            .header("anthropic-version", "2023-06-01")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Error de red: {}", e))?
    } else {
        // Sin API key → proxy con licencia o device_id (modo demo)
        let mut req = client
            .post(obfstr!("https://dix-proxy.dixsystem.workers.dev/v1/messages"))
            .header(obfstr!("content-type"), obfstr!("application/json"))
            .json(&body);
        // Siempre incluir device fingerprint — el proxy lo usa para atar la licencia al hardware
        req = req.header(obfstr!("X-Device-Id"), device_fingerprint());
        if let Some(license_key) = memory::get_license_key() {
            req = req.header(obfstr!("X-License-Key"), license_key);
        }
        req.send().await.map_err(|e| format!("Error de red: {}", e))?
    };

    let status = response.status();
    let raw = response
        .text()
        .await
        .map_err(|e| format!("Error leyendo respuesta: {}", e))?;

    if !status.is_success() {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&raw) {
            if let Some(err) = val.get("error") {
                let err_type = err.get("type").and_then(|v| v.as_str()).unwrap_or("error");
                let err_msg  = err.get("message").and_then(|v| v.as_str()).unwrap_or("Error del servidor");
                if err_type == "demo_limit" {
                    return Err(obfstr!("DEMO_LIMIT_REACHED").to_string());
                }
                return Err(format!("[{}] {}", err_type, err_msg));
            }
        }
        return Err(format!("Error HTTP {}: {}", status, &raw[..raw.len().min(200)]));
    }

    let parsed: ApiResponse = serde_json::from_str(&raw).map_err(|e| {
        format!(
            "JSON inválido: {} — fragmento: {}",
            e,
            &raw[..raw.len().min(200)]
        )
    })?;

    if let Some(err) = parsed.error {
        return Err(format!("[Anthropic {}] {}", err.error_type, err.message));
    }

    let text = parsed
        .content
        .into_iter()
        .find(|b| b.block_type == "text")
        .map(|b| b.text)
        .unwrap_or_default();

    Ok(strip_fences(&text))
}

fn device_fingerprint() -> String {
    std::fs::read_to_string("/proc/cpuinfo")
        .unwrap_or_default()
        .lines()
        .find(|l| l.contains("model name"))
        .and_then(|l| l.split(':').nth(1))
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "unknown_cpu".to_string())
}

fn strip_fences(input: &str) -> String {
    let trimmed = input.trim();
    if let Some(start) = trimmed.find("```") {
        if let Some(newline) = trimmed[start..].find('\n') {
            let inner = start + newline + 1;
            if let Some(end) = trimmed[inner..].rfind("```") {
                return trimmed[inner..inner + end].trim().to_string();
            }
        }
    }
    trimmed.to_string()
}
