// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Session {
    pub id: String,
    pub timestamp: String,
    pub score_before: u32,
    pub score_after: u32,
    pub optimizations_applied: Vec<String>,
    pub scan_summary: String,
}

#[derive(Serialize, Deserialize, Default)]
struct Store {
    #[serde(default)]
    version: u32,
    #[serde(default)]
    api_key: Option<String>,
    #[serde(default)]
    sessions: Vec<Session>,
    #[serde(default)]
    license_key: Option<String>,
    #[serde(default)]
    license_instance_id: Option<String>,
    #[serde(default)]
    license_hw_fingerprint: Option<String>,
    #[serde(default)]
    demo_analyses_used: u32,
    #[serde(default)]
    tier: Option<String>,
}

fn config_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA")
            .unwrap_or_else(|_| r"C:\Users\Default\AppData\Roaming".to_string());
        return PathBuf::from(appdata).join("Dix");
    }
    #[cfg(not(target_os = "windows"))]
    {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
        PathBuf::from(home).join(".config").join("dix")
    }
}

fn store_path() -> PathBuf {
    config_dir().join("store.json")
}

fn load() -> Store {
    fs::read_to_string(store_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save(store: &Store) -> Result<(), String> {
    let dir = config_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(store).map_err(|e| e.to_string())?;
    // Escritura atómica: escribir en .tmp y renombrar (rename() es atómico en Linux).
    // Si el proceso se interrumpe a mitad, el archivo original queda intacto.
    let tmp = store_path().with_extension("tmp");
    fs::write(&tmp, &json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, store_path()).map_err(|e| e.to_string())
}

pub fn get_api_key() -> Option<String> {
    let from_store = get_api_key_from_store();
    if from_store.is_some() {
        return from_store;
    }
    std::env::var("ANTHROPIC_API_KEY")
        .ok()
        .filter(|k| !k.is_empty())
}

pub fn get_api_key_from_store() -> Option<String> {
    load().api_key.filter(|k| !k.is_empty())
}

pub fn save_api_key(key: &str) -> Result<(), String> {
    let mut store = load();
    store.api_key = Some(key.trim().to_string());
    save(&store)
}

pub fn add_session(session: Session) -> Result<(), String> {
    let mut store = load();
    store.sessions.push(session);
    if store.sessions.len() > 20 {
        let excess = store.sessions.len() - 20;
        store.sessions.drain(0..excess);
    }
    save(&store)
}

pub fn get_sessions() -> Vec<Session> {
    let mut sessions = load().sessions;
    sessions.reverse();
    sessions
}

pub fn clear_sessions() -> Result<(), String> {
    let mut store = load();
    store.sessions.clear();
    save(&store)
}

pub fn get_license_key() -> Option<String> {
    load().license_key.filter(|k| !k.is_empty())
}

pub fn save_license_key(key: &str) -> Result<(), String> {
    let mut store = load();
    store.license_key = Some(key.trim().to_string());
    save(&store)
}

pub fn get_license_instance_id() -> Option<String> {
    load().license_instance_id.filter(|k| !k.is_empty())
}

pub fn save_license_instance_id(id: &str) -> Result<(), String> {
    let mut store = load();
    store.license_instance_id = Some(id.trim().to_string());
    save(&store)
}

pub fn get_license_hw_fingerprint() -> Option<String> {
    load().license_hw_fingerprint.filter(|k| !k.is_empty())
}

pub fn save_license_hw_fingerprint(fp: &str) -> Result<(), String> {
    let mut store = load();
    store.license_hw_fingerprint = Some(fp.to_string());
    save(&store)
}

pub fn get_demo_count() -> u32 {
    load().demo_analyses_used
}

pub fn increment_demo_count() -> Result<(), String> {
    let mut store = load();
    store.demo_analyses_used += 1;
    save(&store)
}

pub fn get_tier() -> String {
    // Si hay API key propia → acceso developer (equivalente a Odyssey)
    if get_api_key().is_some() {
        return "odyssey".to_string();
    }
    load().tier.unwrap_or_else(|| "pro".to_string())
}

pub fn save_tier(tier: &str) -> Result<(), String> {
    let mut store = load();
    store.tier = Some(tier.to_string());
    save(&store)
}
