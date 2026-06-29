use crate::contracts::Artifact;
use sha2::{Digest, Sha256};
use std::io::Read;
use uuid::Uuid;
use super::PublisherError;

/// Calcula el hash SHA256 de un archivo en el path dado.
pub fn calcular_sha256(ruta: &str) -> Result<String, std::io::Error> {
    let mut file = std::fs::File::open(ruta)?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 8192];
    loop {
        let n = file.read(&mut buf)?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

/// Construye el Artifact struct con todos sus campos rellenos.
pub fn construir_artifact(
    pipeline_id: Uuid,
    nombre: &str,
    version: &str,
    descripcion: &str,
    ruta_binario: Option<&str>,
) -> Result<Artifact, PublisherError> {
    let hash_sha256 = match ruta_binario {
        Some(ruta) => Some(calcular_sha256(ruta)?),
        None => None,
    };
    Ok(Artifact {
        id: Uuid::new_v4(),
        pipeline_id,
        nombre: nombre.to_string(),
        version: version.to_string(),
        descripcion: descripcion.to_string(),
        ruta_binario: ruta_binario.map(|s| s.to_string()),
        hash_sha256,
        producido_en: chrono::Utc::now(),
    })
}
