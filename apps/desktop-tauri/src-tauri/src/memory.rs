// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const KEYRING_SERVICE: &str = "DixSystem";

// Intenta usar el llavero del SO (Windows Credential Manager / Secret
// Service en Linux). Si el backend no está disponible (p.ej. Linux headless
// sin dbus/gnome-keyring), las funciones devuelven None/false y el caller cae
// al store JSON de siempre — la app sigue funcionando en todas partes, solo
// que cifrado en reposo donde el sistema operativo lo permite.
fn keyring_set(account: &str, value: &str) -> bool {
    keyring::Entry::new(KEYRING_SERVICE, account)
        .and_then(|e| e.set_password(value))
        .is_ok()
}

fn keyring_get(account: &str) -> Option<String> {
    keyring::Entry::new(KEYRING_SERVICE, account)
        .ok()
        .and_then(|e| e.get_password().ok())
}

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
    /// None = nunca se le preguntó al usuario. Some(true)/Some(false) = ya
    /// respondió. Por defecto (None tratado como "no") nunca se envía nada a
    /// Atlas — ver docs/threat-model/dixkontrol.md y policy::atlas_privacy_rules.
    #[serde(default)]
    atlas_opt_in: Option<bool>,
    #[serde(default)]
    referral_code: Option<String>,
    #[serde(default)]
    referral_email: Option<String>,
}

/// Carpeta de configuración de Dix. Usa el crate `dirs` (resuelve la carpeta
/// vía API del sistema — `SHGetKnownFolderPath` en Windows, `XDG_CONFIG_HOME`
/// en Linux) en vez de leer `%APPDATA%`/`$HOME` a mano: si esas variables de
/// entorno faltan (lanzado desde un Task Scheduler con entorno reducido, una
/// sesión de servicio, etc.) la lectura manual caía a una ruta de sistema
/// (`C:\Users\Default\...`) que un usuario normal no puede escribir.
pub fn config_dir() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| std::env::temp_dir());
    #[cfg(target_os = "windows")]
    return base.join("Dix");
    #[cfg(not(target_os = "windows"))]
    return base.join("dix");
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
    if let Some(k) = keyring_get("api_key") {
        return Some(k);
    }
    // Migración desde instalaciones previas: si había una key en JSON plano,
    // intentar moverla al llavero ahora y limpiar el texto plano.
    let plain = load().api_key.filter(|k| !k.is_empty())?;
    if keyring_set("api_key", &plain) {
        let mut store = load();
        store.api_key = None;
        let _ = save(&store);
    }
    Some(plain)
}

pub fn save_api_key(key: &str) -> Result<(), String> {
    let key = key.trim();
    if keyring_set("api_key", key) {
        // Asegurar que no queda una copia en texto plano de una key anterior.
        let mut store = load();
        if store.api_key.is_some() {
            store.api_key = None;
            save(&store)?;
        }
        return Ok(());
    }
    // Fallback: llavero no disponible en este sistema, comportamiento de siempre.
    let mut store = load();
    store.api_key = Some(key.to_string());
    save(&store)
}

pub fn clear_api_key() {
    let _ = keyring::Entry::new(KEYRING_SERVICE, "api_key")
        .and_then(|e| e.delete_credential());
    let mut store = load();
    store.api_key = None;
    let _ = save(&store);
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
    if let Some(k) = keyring_get("license_key") {
        return Some(k);
    }
    let plain = load().license_key.filter(|k| !k.is_empty())?;
    if keyring_set("license_key", &plain) {
        let mut store = load();
        store.license_key = None;
        let _ = save(&store);
    }
    Some(plain)
}

pub fn save_license_key(key: &str) -> Result<(), String> {
    let key = key.trim();
    if keyring_set("license_key", key) {
        let mut store = load();
        if store.license_key.is_some() {
            store.license_key = None;
            save(&store)?;
        }
        return Ok(());
    }
    let mut store = load();
    store.license_key = Some(key.to_string());
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

/// `None` = todavía no se le preguntó al usuario (la app debe mostrar el
/// aviso de opt-in). `Some(true)` = aceptó compartir telemetría anónima con
/// Atlas. `Some(false)` = la rechazó explícitamente. Hasta que esto sea
/// `Some(true)`, ningún dato debe salir del dispositivo hacia Atlas.
pub fn get_atlas_opt_in() -> Option<bool> {
    load().atlas_opt_in
}

pub fn set_atlas_opt_in(value: bool) -> Result<(), String> {
    let mut store = load();
    store.atlas_opt_in = Some(value);
    save(&store)
}

pub fn get_referral_code() -> Option<String> {
    load().referral_code.filter(|c| !c.is_empty())
}

pub fn save_referral_code(code: &str) -> Result<(), String> {
    let mut store = load();
    store.referral_code = Some(code.trim().to_string());
    save(&store)
}

pub fn get_referral_email() -> Option<String> {
    load().referral_email.filter(|e| !e.is_empty())
}

pub fn save_referral_email(email: &str) -> Result<(), String> {
    let mut store = load();
    store.referral_email = Some(email.trim().to_string());
    save(&store)
}
