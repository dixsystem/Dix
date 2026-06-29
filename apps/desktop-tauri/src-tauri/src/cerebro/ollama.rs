use reqwest::Client;
use serde_json::{json, Value};

/// Error del cliente Ollama.
#[derive(Debug, thiserror::Error)]
pub enum OllamaError {
    #[error("HTTP: {0}")]
    Http(#[from] reqwest::Error),
    #[error("JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Modelo no disponible: {0}")]
    ModelUnavailable(String),
}

/// Cliente HTTP para el servidor Ollama local.
pub struct OllamaClient {
    base_url: String,
    client: Client,
}

impl OllamaClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            client: Client::new(),
        }
    }

    /// Llama a /api/generate con stream:false y devuelve el campo "response".
    pub async fn generate(&self, model: &str, prompt: &str) -> Result<String, OllamaError> {
        let url = format!("{}/api/generate", self.base_url);
        let body = json!({
            "model": model,
            "prompt": prompt,
            "stream": false,
        });
        let resp = self.client.post(&url).json(&body).send().await?;
        let v: Value = resp.json().await?;
        v["response"]
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| OllamaError::ModelUnavailable(format!("Sin campo 'response' para modelo {model}")))
    }

    /// Lista los modelos disponibles en el servidor Ollama.
    pub async fn list_models(&self) -> Result<Vec<String>, OllamaError> {
        let url = format!("{}/api/tags", self.base_url);
        let resp = self.client.get(&url).send().await?;
        let v: Value = resp.json().await?;
        let names = v["models"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|m| m["name"].as_str().map(|s| s.to_string()))
            .collect();
        Ok(names)
    }
}
