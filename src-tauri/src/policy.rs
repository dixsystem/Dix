// © 2026 DixSystem — Todos los derechos reservados.
// DIX — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.

#[derive(Debug)]
pub struct PolicyViolation {
    pub rule: &'static str,
    pub detail: String,
}

#[derive(Debug)]
pub struct AtlasViolation {
    pub rule:   &'static str,
    pub field:  String,
    pub detail: String,
}

pub fn validate_script(script: &str) -> Vec<PolicyViolation> {
    let mut violations = Vec::new();

    for (i, line) in script.lines().enumerate() {
        let ln = line.trim();
        let loc = format!("línea {}", i + 1);

        if contains_gpu_change(ln) {
            violations.push(PolicyViolation {
                rule: "GPU_IMMUTABLE",
                detail: format!("{}: modificación de GPU/nvidia/nouveau detectada", loc),
            });
        }

        if sets_numa_disabled(ln) {
            violations.push(PolicyViolation {
                rule: "NUMA_BALANCING",
                detail: format!("{}: kernel.numa_balancing=0 está prohibido", loc),
            });
        }

        if dirty_ratio_exceeds(ln, 15) {
            violations.push(PolicyViolation {
                rule: "DIRTY_RATIO",
                detail: format!("{}: vm.dirty_ratio > 15 está prohibido", loc),
            });
        }

        if sets_hugepages_never(ln) {
            violations.push(PolicyViolation {
                rule: "HUGEPAGES_NEVER",
                detail: format!("{}: transparent_hugepages=never está prohibido", loc),
            });
        }

        if uses_bare_sysctl(ln) {
            violations.push(PolicyViolation {
                rule: "SYSCTL_PATH",
                detail: format!("{}: usar /sbin/sysctl con ruta absoluta", loc),
            });
        }

        if is_destructive(ln) {
            violations.push(PolicyViolation {
                rule: "DESTRUCTIVE_CMD",
                detail: format!("{}: comando destructivo o de borrado masivo detectado", loc),
            });
        }
    }

    if script.contains("pkexec") && !script.contains("/usr/bin/pkexec") {
        violations.push(PolicyViolation {
            rule: "PKEXEC_PATH",
            detail: "pkexec debe usarse con ruta absoluta /usr/bin/pkexec".to_string(),
        });
    }

    violations
}

fn contains_gpu_change(line: &str) -> bool {
    if line.starts_with('#') {
        return false;
    }
    let forbidden = [
        "nvidia-smi",
        "nouveau",
        "NVreg_",
        "nvidia-settings",
        "modprobe nvidia",
        "rmmod nvidia",
        "gpu_power_mizer",
        "/sys/class/drm/card",
    ];
    forbidden.iter().any(|p| line.contains(p))
}

fn sets_numa_disabled(line: &str) -> bool {
    if line.starts_with('#') {
        return false;
    }
    if !line.contains("numa_balancing") {
        return false;
    }
    line.contains("=0") || line.contains("= 0") || ends_with_zero(line)
}

fn ends_with_zero(line: &str) -> bool {
    line.trim_end().ends_with(" 0") || line.trim_end().ends_with("=0")
}

fn dirty_ratio_exceeds(line: &str, max: u8) -> bool {
    if line.starts_with('#') {
        return false;
    }
    if !line.contains("dirty_ratio") {
        return false;
    }
    if line.contains("dirty_background_ratio") {
        return false;
    }
    extract_trailing_value(line).map(|v| v > max as u32).unwrap_or(false)
}

fn sets_hugepages_never(line: &str) -> bool {
    if line.starts_with('#') {
        return false;
    }
    line.contains("transparent_hugepage") && line.contains("never")
}

fn uses_bare_sysctl(line: &str) -> bool {
    if line.starts_with('#') {
        return false;
    }
    if !line.contains("sysctl") {
        return false;
    }
    if line.contains("/sbin/sysctl") || line.contains("/usr/sbin/sysctl") {
        return false;
    }
    let trimmed = line.trim_start();
    trimmed.starts_with("sysctl ")
}

fn is_destructive(line: &str) -> bool {
    if line.starts_with('#') {
        return false;
    }
    // Fork bomb
    if line.contains(":(){ :|:& };:") {
        return true;
    }
    // rm -rf en rutas del sistema (se permite /tmp/ y /var/cache/)
    if (line.contains("rm -rf /") || line.contains("rm -fr /"))
        && !line.contains("rm -rf /tmp/")
        && !line.contains("rm -fr /tmp/")
        && !line.contains("/var/cache/")
    {
        return true;
    }
    // Formateo de discos
    if line.contains("mkfs.") && line.contains("/dev/") {
        return true;
    }
    // dd de borrado sobre dispositivos reales
    if (line.contains("dd if=/dev/zero") || line.contains("dd if=/dev/null"))
        && line.contains("of=/dev/")
    {
        return true;
    }
    // Herramientas de borrado seguro
    if line.contains("shred /dev/") || (line.contains("wipefs") && line.contains("/dev/")) {
        return true;
    }
    false
}

fn extract_trailing_value(line: &str) -> Option<u32> {
    if let Some(pos) = line.rfind('=') {
        let rest = line[pos + 1..].trim().split_whitespace().next()?;
        if let Ok(v) = rest.parse::<u32>() {
            return Some(v);
        }
    }
    if line.contains('>') {
        let before_arrow = line.split('>').next()?;
        let val = before_arrow.trim().split_whitespace().last()?;
        if let Ok(v) = val.parse::<u32>() {
            return Some(v);
        }
    }
    None
}

// ══════════════════════════════════════════════════════════════════
// POLÍTICA DE PRIVACIDAD — DIRECCIÓN INVERSA
// Valida los datos ANTES de salir del sistema hacia DIX Atlas.
// Enfoque whitelist: si el campo no está permitido, es violación.
// ══════════════════════════════════════════════════════════════════

/// Campos que DIX Atlas PUEDE recibir — hardware anónimo únicamente.
const ALLOWED_ATLAS_FIELDS: &[&str] = &[
    "cpu_model",       // ej: "Intel Core i5-12400"
    "cpu_cores",       // ej: 6
    "cpu_threads",     // ej: 12
    "ram_total_mb",    // ej: 16384
    "kernel_version",  // ej: "6.5.0-generic"
    "distro_id",       // ej: "ubuntu"
    "distro_version",  // ej: "22.04"
    "gpu_model",       // ej: "NVIDIA RTX 3060" (solo modelo, nada más)
    "score_before",    // ej: 34
    "score_after",     // ej: 91
    "sysctl_snapshot", // valores sysctl leídos, sin rutas de usuario
    "session_token",   // UUID efímero de sesión — no persiste entre reinicios
];

/// Campos que NUNCA pueden salir del sistema, bajo ninguna circunstancia.
const FORBIDDEN_ATLAS_FIELDS: &[&str] = &[
    "hostname",
    "username",
    "user",
    "home",
    "ip",
    "ip_address",
    "mac",
    "mac_address",
    "machine_id",    // /etc/machine-id — huella digital persistente
    "serial",
    "serial_number",
    "process_list",
    "processes",
    "file_path",
    "paths",
    "email",
    "password",
    "token",         // tokens de auth — nunca
    "ssh",
    "gpg",
];

/// Valida el payload JSON antes de enviarlo a DIX Atlas.
/// Rechaza cualquier campo fuera de la whitelist o en la blacklist.
pub fn validate_atlas_payload(payload: &std::collections::HashMap<String, String>) -> Vec<AtlasViolation> {
    let mut violations = Vec::new();

    for key in payload.keys() {
        let key_lower = key.to_lowercase();

        // Blacklist: campos absolutamente prohibidos
        if FORBIDDEN_ATLAS_FIELDS.iter().any(|f| key_lower.contains(f)) {
            violations.push(AtlasViolation {
                rule:   "ATLAS_FORBIDDEN_FIELD",
                field:  key.clone(),
                detail: format!("campo '{}' nunca puede enviarse a DIX Atlas", key),
            });
            continue;
        }

        // Whitelist: solo campos explícitamente permitidos
        if !ALLOWED_ATLAS_FIELDS.iter().any(|a| key_lower == *a) {
            violations.push(AtlasViolation {
                rule:   "ATLAS_UNKNOWN_FIELD",
                field:  key.clone(),
                detail: format!("campo '{}' no está en la whitelist de DIX Atlas", key),
            });
        }
    }

    violations
}

/// Devuelve true solo si el payload pasa la validación completa.
/// Usar antes de cualquier llamada de red hacia DIX Atlas.
pub fn atlas_payload_is_safe(payload: &std::collections::HashMap<String, String>) -> bool {
    validate_atlas_payload(payload).is_empty()
}

pub fn atlas_privacy_rules() -> &'static str {
    "REGLAS DE PRIVACIDAD DIX ATLAS (no negociables):\n\
     - SOLO campos de la whitelist pueden salir del sistema\n\
     - NUNCA enviar hostname, username, IP, MAC, machine-id\n\
     - NUNCA enviar listas de procesos ni rutas de archivos\n\
     - El session_token es efímero — no persiste entre sesiones\n\
     - Sin consentimiento opt-in explícito: cero datos enviados\n\
     - El payload se valida en Rust antes de cualquier llamada de red\n"
}

pub fn policy_rules_for_prompt() -> &'static str {
    "REGLAS ABSOLUTAS (no negociables):\n\
     - NUNCA sugerir cambios a GPU, nvidia, nouveau, drivers gráficos\n\
     - NUNCA establecer kernel.numa_balancing=0\n\
     - NUNCA establecer vm.dirty_ratio mayor a 15\n\
     - NUNCA establecer transparent_hugepages=never\n\
     - SIEMPRE usar /sbin/sysctl con ruta absoluta\n\
     - RTX 3060 presente: NO tocar configuración de GPU en absoluto\n"
}

// ══════════════════════════════════════════════════════════════════
// TESTS — 50 casos que el comité de auditoría exige como mínimo
// ══════════════════════════════════════════════════════════════════
#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn blocked(script: &str, rule: &str) {
        let v = validate_script(script);
        assert!(
            v.iter().any(|x| x.rule == rule),
            "Regla '{}' debería dispararse pero no lo hizo.\nScript: {:?}\nViolaciones: {:?}",
            rule, script, v.iter().map(|x| x.rule).collect::<Vec<_>>()
        );
    }

    fn clean(script: &str) {
        let v = validate_script(script);
        assert!(
            v.is_empty(),
            "Script debería pasar limpio pero fue bloqueado.\nScript: {:?}\nViolaciones: {:?}",
            script, v.iter().map(|x| x.rule).collect::<Vec<_>>()
        );
    }

    // ─── GPU_IMMUTABLE (9 tests) ──────────────────────────────────────
    #[test] fn gpu01_nvidia_smi()      { blocked("nvidia-smi -pl 200",                               "GPU_IMMUTABLE"); }
    #[test] fn gpu02_rmmod_nvidia()    { blocked("rmmod nvidia-drm",                                 "GPU_IMMUTABLE"); }
    #[test] fn gpu03_nouveau_param()   { blocked("echo 0 > /sys/module/nouveau/parameters/modeset",  "GPU_IMMUTABLE"); }
    #[test] fn gpu04_nvreg()           { blocked("options nvidia NVreg_UsePageAttributeTable=1",      "GPU_IMMUTABLE"); }
    #[test] fn gpu05_nvidia_settings() { blocked("nvidia-settings -a GPUPowerMizerMode=0",           "GPU_IMMUTABLE"); }
    #[test] fn gpu06_modprobe()        { blocked("modprobe nvidia",                                  "GPU_IMMUTABLE"); }
    #[test] fn gpu07_drm_card()        { blocked("echo auto > /sys/class/drm/card0/device/power_dpm_state", "GPU_IMMUTABLE"); }
    #[test] fn gpu08_comment_safe()    { clean("# nvidia-smi is referenced here only"); }
    #[test] fn gpu09_unrelated_safe()  { clean("/sbin/sysctl vm.swappiness=10"); }

    // ─── NUMA_BALANCING (5 tests) ─────────────────────────────────────
    #[test] fn numa01_sysctl_zero()      { blocked("/sbin/sysctl kernel.numa_balancing=0",      "NUMA_BALANCING"); }
    #[test] fn numa02_space_zero()       { blocked("/sbin/sysctl -w kernel.numa_balancing = 0", "NUMA_BALANCING"); }
    #[test] fn numa03_enable_safe()      { clean("/sbin/sysctl kernel.numa_balancing=1"); }
    #[test] fn numa04_comment_safe()     { clean("# kernel.numa_balancing=0 no aplicar"); }
    #[test] fn numa05_unrelated_safe()   { clean("/sbin/sysctl vm.dirty_ratio=10"); }

    // ─── DIRTY_RATIO (5 tests) ────────────────────────────────────────
    #[test] fn dirty01_too_high()        { blocked("/sbin/sysctl vm.dirty_ratio=20",           "DIRTY_RATIO"); }
    #[test] fn dirty02_just_over()       { blocked("/sbin/sysctl vm.dirty_ratio=16",           "DIRTY_RATIO"); }
    #[test] fn dirty03_at_limit_safe()   { clean("/sbin/sysctl vm.dirty_ratio=15"); }
    #[test] fn dirty04_below_safe()      { clean("/sbin/sysctl vm.dirty_ratio=8"); }
    #[test] fn dirty05_background_safe() { clean("/sbin/sysctl vm.dirty_background_ratio=25"); }

    // ─── HUGEPAGES_NEVER (4 tests) ────────────────────────────────────
    #[test] fn huge01_never_blocked()  { blocked("echo never > /sys/kernel/mm/transparent_hugepage/enabled", "HUGEPAGES_NEVER"); }
    #[test] fn huge02_always_safe()    { clean("echo always > /sys/kernel/mm/transparent_hugepage/enabled"); }
    #[test] fn huge03_madvise_safe()   { clean("echo madvise > /sys/kernel/mm/transparent_hugepage/enabled"); }
    #[test] fn huge04_comment_safe()   { clean("# transparent_hugepages=never no usar"); }

    // ─── SYSCTL_PATH (5 tests) ────────────────────────────────────────
    #[test] fn sysctl01_bare_blocked()      { blocked("sysctl vm.swappiness=10",         "SYSCTL_PATH"); }
    #[test] fn sysctl02_sbin_safe()         { clean("/sbin/sysctl vm.swappiness=10"); }
    #[test] fn sysctl03_usr_sbin_safe()     { clean("/usr/sbin/sysctl vm.swappiness=10"); }
    #[test] fn sysctl04_comment_safe()      { clean("# sysctl vm.swappiness=10"); }
    #[test] fn sysctl05_echo_mention_safe() { clean("echo 'aplicar con /sbin/sysctl'"); }

    // ─── PKEXEC_PATH (3 tests) ────────────────────────────────────────
    #[test] fn pkexec01_bare_blocked()   { blocked("pkexec bash /tmp/dix.sh",              "PKEXEC_PATH"); }
    #[test] fn pkexec02_absolute_safe()  { clean("#!/bin/bash\n/usr/bin/pkexec bash /tmp/dix.sh"); }
    #[test] fn pkexec03_no_pkexec_safe() { clean("#!/bin/bash\n/sbin/sysctl vm.swappiness=10"); }

    // ─── DESTRUCTIVE_CMD (11 tests) ───────────────────────────────────
    #[test] fn dest01_rm_rf_root()    { blocked("rm -rf /",                                "DESTRUCTIVE_CMD"); }
    #[test] fn dest02_rm_rf_wildcard(){ blocked("rm -rf /*",                               "DESTRUCTIVE_CMD"); }
    #[test] fn dest03_fork_bomb()     { blocked(":(){ :|:& };:",                           "DESTRUCTIVE_CMD"); }
    #[test] fn dest04_mkfs_dev()      { blocked("mkfs.ext4 /dev/sda1",                    "DESTRUCTIVE_CMD"); }
    #[test] fn dest05_dd_zero()       { blocked("dd if=/dev/zero of=/dev/sda bs=512",      "DESTRUCTIVE_CMD"); }
    #[test] fn dest06_shred()         { blocked("shred /dev/sda",                          "DESTRUCTIVE_CMD"); }
    #[test] fn dest07_wipefs()        { blocked("wipefs -a /dev/sda",                      "DESTRUCTIVE_CMD"); }
    #[test] fn dest08_rm_rf_home()    { blocked("rm -rf /home/",                           "DESTRUCTIVE_CMD"); }
    #[test] fn dest09_rm_rf_var_log() { blocked("rm -rf /var/log/",                        "DESTRUCTIVE_CMD"); }
    #[test] fn dest10_rm_tmp_safe()   { clean("rm -rf /tmp/dix_backup/"); }
    #[test] fn dest11_rm_file_safe()  { clean("rm -f /tmp/dix_1234567890.sh"); }

    // ─── Atlas whitelist / blacklist (8 tests) ────────────────────────
    #[test]
    fn atlas01_valid_payload() {
        let mut p = HashMap::new();
        p.insert("cpu_model".into(),    "Intel Core i5-12400".into());
        p.insert("cpu_cores".into(),    "6".into());
        p.insert("score_before".into(), "42".into());
        p.insert("score_after".into(),  "87".into());
        assert!(validate_atlas_payload(&p).is_empty(), "Payload válido fue rechazado");
    }
    #[test]
    fn atlas02_blocks_hostname() {
        let mut p = HashMap::new();
        p.insert("hostname".into(), "mypc".into());
        assert!(validate_atlas_payload(&p).iter().any(|v| v.rule == "ATLAS_FORBIDDEN_FIELD"));
    }
    #[test]
    fn atlas03_blocks_username() {
        let mut p = HashMap::new();
        p.insert("username".into(), "alons".into());
        assert!(validate_atlas_payload(&p).iter().any(|v| v.rule == "ATLAS_FORBIDDEN_FIELD"));
    }
    #[test]
    fn atlas04_blocks_ip() {
        let mut p = HashMap::new();
        p.insert("ip_address".into(), "192.168.1.1".into());
        assert!(validate_atlas_payload(&p).iter().any(|v| v.rule == "ATLAS_FORBIDDEN_FIELD"));
    }
    #[test]
    fn atlas05_blocks_machine_id() {
        let mut p = HashMap::new();
        p.insert("machine_id".into(), "abc123def456".into());
        assert!(validate_atlas_payload(&p).iter().any(|v| v.rule == "ATLAS_FORBIDDEN_FIELD"));
    }
    #[test]
    fn atlas06_blocks_process_list() {
        let mut p = HashMap::new();
        p.insert("process_list".into(), "systemd chrome".into());
        assert!(validate_atlas_payload(&p).iter().any(|v| v.rule == "ATLAS_FORBIDDEN_FIELD"));
    }
    #[test]
    fn atlas07_blocks_unknown_field() {
        let mut p = HashMap::new();
        p.insert("mystery_data".into(), "value".into());
        assert!(validate_atlas_payload(&p).iter().any(|v| v.rule == "ATLAS_UNKNOWN_FIELD"));
    }
    #[test]
    fn atlas08_empty_payload_safe() {
        let p = HashMap::new();
        assert!(validate_atlas_payload(&p).is_empty(), "Payload vacío fue rechazado");
    }
}
