// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.
//
// Motor de comandos estructurados — sustituye al bash libre generado por IA.
// La IA elige QUÉ operación aplicar de un catálogo cerrado y con qué valor,
// pero nunca escribe directamente el texto que se ejecuta como root.
// Cada variante se valida (rango, allowlist) antes de poder renderizarse.

use serde::Deserialize;

#[derive(Debug, Deserialize, Clone)]
#[serde(tag = "tipo", rename_all = "snake_case")]
pub enum DixOperation {
    SetSysctl { clave: String, valor: String },
    SetDiskScheduler { scheduler: String },
    SetHugepages { modo: String },
    SetNumaBalancing { activo: bool },
    SetNrRequests { valor: u32 },
    EnableService { nombre: String },
    DisableService { nombre: String },
}

#[derive(Debug)]
pub struct OperationViolation {
    pub detail: String,
}

/// Whitelist de claves sysctl permitidas y su rango/regla de validación.
/// Si una clave no está aquí, la operación se rechaza sin excepción.
fn validate_sysctl(clave: &str, valor: &str) -> Result<(), String> {
    let v: i64 = valor
        .trim()
        .parse()
        .map_err(|_| format!("valor no numérico para {}: {:?}", clave, valor))?;

    match clave {
        "vm.swappiness" => {
            if !(0..=100).contains(&v) {
                return Err(format!("vm.swappiness fuera de rango: {}", v));
            }
        }
        "vm.dirty_ratio" => {
            // Regla absoluta: nunca por encima de 15.
            if !(1..=15).contains(&v) {
                return Err(format!("vm.dirty_ratio fuera de rango permitido (1-15): {}", v));
            }
        }
        "vm.dirty_background_ratio" => {
            if !(1..=10).contains(&v) {
                return Err(format!("vm.dirty_background_ratio fuera de rango (1-10): {}", v));
            }
        }
        "vm.vfs_cache_pressure" => {
            if !(1..=200).contains(&v) {
                return Err(format!("vm.vfs_cache_pressure fuera de rango: {}", v));
            }
        }
        "kernel.numa_balancing" => {
            // Regla absoluta: nunca 0. Usar SetNumaBalancing{activo:false} no
            // existe — esta clave por sysctl directo solo admite activarlo.
            if v != 1 {
                return Err("kernel.numa_balancing solo puede fijarse a 1 por esta vía".to_string());
            }
        }
        "net.core.default_qdisc" | "net.ipv4.tcp_congestion_control" => {
            return Err(format!("{} no es numérico, usar variante dedicada", clave));
        }
        _ => return Err(format!("clave sysctl no permitida: {}", clave)),
    }
    Ok(())
}

const ALLOWED_SCHEDULERS: &[&str] = &["mq-deadline", "kyber", "bfq", "none"];
const ALLOWED_HUGEPAGES: &[&str] = &["always", "madvise"]; // nunca "never" — regla absoluta
const ALLOWED_SERVICES: &[&str] = &["irqbalance", "fstrim.timer"];
const MAX_NR_REQUESTS: u32 = 4096;
const MIN_NR_REQUESTS: u32 = 32;

impl DixOperation {
    pub fn validate(&self) -> Result<(), OperationViolation> {
        let result = match self {
            DixOperation::SetSysctl { clave, valor } => validate_sysctl(clave, valor),
            DixOperation::SetDiskScheduler { scheduler } => {
                if ALLOWED_SCHEDULERS.contains(&scheduler.as_str()) {
                    Ok(())
                } else {
                    Err(format!("scheduler de disco no permitido: {}", scheduler))
                }
            }
            DixOperation::SetHugepages { modo } => {
                if ALLOWED_HUGEPAGES.contains(&modo.as_str()) {
                    Ok(())
                } else {
                    Err(format!("modo de hugepages no permitido (regla absoluta): {}", modo))
                }
            }
            DixOperation::SetNumaBalancing { activo } => {
                if *activo {
                    Ok(())
                } else {
                    Err("desactivar NUMA balancing está prohibido (regla absoluta)".to_string())
                }
            }
            DixOperation::SetNrRequests { valor } => {
                if (MIN_NR_REQUESTS..=MAX_NR_REQUESTS).contains(valor) {
                    Ok(())
                } else {
                    Err(format!("nr_requests fuera de rango ({}-{}): {}", MIN_NR_REQUESTS, MAX_NR_REQUESTS, valor))
                }
            }
            DixOperation::EnableService { nombre } | DixOperation::DisableService { nombre } => {
                if ALLOWED_SERVICES.contains(&nombre.as_str()) {
                    Ok(())
                } else {
                    Err(format!("servicio no permitido: {}", nombre))
                }
            }
        };
        result.map_err(|detail| OperationViolation { detail })
    }

    /// Renderiza la línea bash exacta y segura para esta operación.
    /// Solo se llama tras `validate()` haber devuelto Ok.
    pub fn render(&self) -> String {
        match self {
            DixOperation::SetSysctl { clave, valor } => {
                format!("/sbin/sysctl -w {}={} || true", clave, valor)
            }
            DixOperation::SetDiskScheduler { scheduler } => format!(
                "for dev in /sys/block/nvme* /sys/block/sd*; do [ -f \"$dev/queue/scheduler\" ] && echo {} > \"$dev/queue/scheduler\" || true; done",
                scheduler
            ),
            DixOperation::SetHugepages { modo } => {
                format!("echo {} > /sys/kernel/mm/transparent_hugepage/enabled || true", modo)
            }
            DixOperation::SetNumaBalancing { .. } => {
                "/sbin/sysctl -w kernel.numa_balancing=1 || true".to_string()
            }
            DixOperation::SetNrRequests { valor } => format!(
                "for dev in /sys/block/nvme* /sys/block/sd*; do [ -f \"$dev/queue/nr_requests\" ] && echo {} > \"$dev/queue/nr_requests\" || true; done",
                valor
            ),
            DixOperation::EnableService { nombre } => {
                format!("systemctl enable --now {} 2>/dev/null || true", nombre)
            }
            DixOperation::DisableService { nombre } => {
                format!("systemctl disable --now {} 2>/dev/null || true", nombre)
            }
        }
    }
}

/// Valida y renderiza un lote de operaciones. Las operaciones inválidas se
/// descartan (no se ejecutan) y se reportan como advertencias — nunca se cae
/// de vuelta a ejecutar texto libre.
pub fn render_all(ops: &[DixOperation]) -> (String, Vec<String>) {
    let mut lines = Vec::new();
    let mut warnings = Vec::new();
    for op in ops {
        match op.validate() {
            Ok(()) => lines.push(op.render()),
            Err(v) => warnings.push(v.detail),
        }
    }
    (lines.join("\n"), warnings)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn swappiness_in_range_ok() {
        let op = DixOperation::SetSysctl { clave: "vm.swappiness".into(), valor: "10".into() };
        assert!(op.validate().is_ok());
    }

    #[test]
    fn dirty_ratio_above_15_rejected() {
        let op = DixOperation::SetSysctl { clave: "vm.dirty_ratio".into(), valor: "20".into() };
        assert!(op.validate().is_err());
    }

    #[test]
    fn numa_balancing_disable_rejected() {
        let op = DixOperation::SetNumaBalancing { activo: false };
        assert!(op.validate().is_err());
    }

    #[test]
    fn hugepages_never_rejected() {
        let op = DixOperation::SetHugepages { modo: "never".into() };
        assert!(op.validate().is_err());
    }

    #[test]
    fn unknown_sysctl_key_rejected() {
        let op = DixOperation::SetSysctl { clave: "kernel.something_unknown".into(), valor: "1".into() };
        assert!(op.validate().is_err());
    }

    #[test]
    fn unknown_service_rejected() {
        let op = DixOperation::EnableService { nombre: "cron".into() };
        assert!(op.validate().is_err());
    }

    #[test]
    fn render_all_drops_invalid_keeps_valid() {
        let ops = vec![
            DixOperation::SetSysctl { clave: "vm.swappiness".into(), valor: "10".into() },
            DixOperation::SetNumaBalancing { activo: false }, // inválida, se descarta
        ];
        let (script, warnings) = render_all(&ops);
        assert!(script.contains("vm.swappiness=10"));
        assert!(!script.contains("numa_balancing=0"));
        assert_eq!(warnings.len(), 1);
    }
}
