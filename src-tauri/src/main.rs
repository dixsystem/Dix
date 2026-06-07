// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod scanner;
mod policy;
mod memory;
mod claude_gateway;
mod executor;
mod cache;

use executor::RollbackInfo;
use memory::Session;
use obfstr::obfstr;
use scanner::SystemScan;
use serde::Serialize;
use std::process::Command;
use tauri::Manager;

/// Retorno de analyze_system — incluye si vino del caché para mostrarlo en UI
#[derive(Serialize)]
struct AnalysisResponse {
    analysis_json: String,
    from_cache: bool,
    response_time_ms: u32,
}

// ─── Comandos Tauri ───────────────────────────────────────────────────────────

#[tauri::command]
fn scan_system() -> Result<SystemScan, String> {
    scanner::scan()
}

#[tauri::command]
async fn analyze_system(scan_json: String) -> Result<AnalysisResponse, String> {
    // Modo creador — Alonso Torres, DixSystem. Sin límites.

    let scan: SystemScan = serde_json::from_str(&scan_json)
        .map_err(|e| format!("Scan JSON inválido: {}", e))?;

    let stable_acp = cache::encode_stable_acp(&scan);
    let mut opt_cache = cache::load_cache();

    // Comprobar caché primero
    if let cache::CacheDecision::Hit(cached_json) = cache::decide_cache(&stable_acp, &opt_cache) {
        opt_cache.hit_count += 1;
        cache::record_history(&mut opt_cache, &stable_acp, true, 0);
        cache::save_cache(&opt_cache).ok();
        return Ok(AnalysisResponse {
            analysis_json: cached_json,
            from_cache: true,
            response_time_ms: 0,
        });
    }

    // Miss → llamada a Claude
    let start = std::time::Instant::now();

    let system = format!(
        "{}\n{}",
        obfstr!("Eres un experto en optimización Linux. Respondes SOLO con JSON válido sin markdown."),
        policy::policy_rules_for_prompt()
    );
    let user = build_analysis_prompt(&scan);
    let result = claude_gateway::call(&system, &user, 4000).await?;

    let elapsed_ms = start.elapsed().as_millis() as u32;

    opt_cache.miss_count += 1;
    opt_cache.hardware_id = cache::hardware_id(&scan);
    opt_cache.last_analysis = Some(cache::CacheEntry {
        timestamp: cache::current_unix_secs(),
        acp: stable_acp.clone(),
        acp_hash: cache::acp_hash(&stable_acp),
        analysis_json: result.clone(),
        response_time_ms: elapsed_ms,
    });
    cache::record_history(&mut opt_cache, &stable_acp, false, elapsed_ms);
    cache::save_cache(&opt_cache).ok();
    if memory::get_license_key().is_none() {
        memory::increment_demo_count().ok();
    }

    Ok(AnalysisResponse {
        analysis_json: result,
        from_cache: false,
        response_time_ms: elapsed_ms,
    })
}

#[tauri::command]
async fn generate_script(optimizations_json: String, scan_json: String) -> Result<String, String> {
    let scan: SystemScan = serde_json::from_str(&scan_json)
        .map_err(|e| format!("Scan JSON inválido: {}", e))?;
    let ram_gb = (scan.mem_total_mb + 512) / 1024;
    let hw_desc = format!(
        "{} {}, {}, GPU: {}, {}GB RAM",
        scan.distro_id, scan.distro_version, scan.cpu_model, scan.gpu_model, ram_gb
    );
    let system = format!(
        "Experto en bash/Linux. Genera script de optimización para: {}. \
        REGLAS: 1) SOLO bash puro. Máximo 60 líneas. 2) Sin markdown ni backticks. \
        3) Empieza con #!/bin/bash. 4) Usa echo para mensajes. \
        5) Usa /sbin/sysctl con ruta absoluta para sysctl. \
        6) Termina comandos que pueden fallar con || true. 7) Sin EOF ni heredocs.\n{}",
        hw_desc,
        policy::policy_rules_for_prompt()
    );
    let user = format!(
        "Genera el script bash para estas optimizaciones:\n{}\nResumen del sistema:\n{}",
        optimizations_json, scan_json
    );

    let script = claude_gateway::call(&system, &user, 2000).await?;

    let violations = policy::validate_script(&script);
    if !violations.is_empty() {
        let msgs: Vec<String> = violations
            .iter()
            .map(|v| format!("[{}] {}", v.rule, v.detail))
            .collect();
        return Err(format!("Script violó políticas de seguridad:\n{}", msgs.join("\n")));
    }

    Ok(script)
}

#[tauri::command]
fn execute_script(script_content: String, scan_json: String) -> Result<String, String> {
    let scan: SystemScan = serde_json::from_str(&scan_json)
        .map_err(|e| format!("Scan JSON inválido para rollback: {}", e))?;
    let result = executor::run_script(&script_content, &scan)?;

    // Anclar los parámetros aplicados para que Claude no oscile entre sesiones
    let new_pins = cache::extract_pinnable_params(&script_content);
    if !new_pins.is_empty() {
        let mut opt_cache = cache::load_cache();
        opt_cache.pinned_params.extend(new_pins);
        cache::save_cache(&opt_cache).ok();
    }

    Ok(result)
}

#[tauri::command]
fn get_sessions() -> Vec<Session> {
    memory::get_sessions()
}

#[tauri::command]
fn save_session(session: Session) -> Result<(), String> {
    memory::add_session(session)
}

#[tauri::command]
fn clear_sessions() -> Result<(), String> {
    memory::clear_sessions()
}

#[tauri::command]
fn reboot_system() -> Result<(), String> {
    Command::new("/usr/bin/pkexec")
        .args(["/sbin/shutdown", "-r", "+1", "Dix: reiniciando para aplicar optimizaciones"])
        .spawn()
        .map_err(|e| format!("No se pudo programar el reinicio: {}", e))?;
    Ok(())
}

#[tauri::command]
fn list_rollbacks() -> Vec<RollbackInfo> {
    executor::list_rollbacks()
}

#[tauri::command]
fn execute_rollback(filename: String) -> Result<String, String> {
    executor::execute_rollback(&filename)
}

#[tauri::command]
fn get_cache_stats() -> cache::CacheStats {
    cache::get_stats(&cache::load_cache())
}

// ─── Hardware Fingerprint + Sistema de licencias (Semana 1) ──────────────────

#[tauri::command]
fn get_hw_fingerprint() -> String {
    use std::fs;
    // Usa /etc/machine-id: único por instalación Linux, no varía con el hardware
    let mid = fs::read_to_string("/etc/machine-id")
        .or_else(|_| fs::read_to_string("/var/lib/dbus/machine-id"))
        .unwrap_or_default();
    let mid = mid.trim();
    if mid.len() >= 16 {
        return mid.to_string();
    }
    // Fallback si no existe machine-id (muy raro en Linux moderno)
    fs::read_to_string("/proc/cpuinfo")
        .unwrap_or_default()
        .lines()
        .find(|l| l.contains("model name"))
        .and_then(|l| l.split(':').nth(1))
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "unknown_cpu".to_string())
}

#[derive(serde::Serialize)]
struct LiveMetrics {
    governor:         String,
    swappiness:       u32,
    dirty_ratio:      u32,
    dirty_bg:         u32,
    hugepages:        String,
    mem_free_mb:      u32,
    mem_total_mb:     u32,
    load_1:           f32,
    load_5:           f32,
    nr_requests:      u32,
    cpu_freq_mhz:     u32,
    cpu_max_mhz:      u32,
    cpu_temp_celsius: f32,
    cpu_avg_freq_mhz: u32,
    cpu_cores:        u32,
}

#[tauri::command]
fn get_live_metrics() -> LiveMetrics {
    use std::fs;
    let r = |p: &str| fs::read_to_string(p).unwrap_or_default().trim().to_string();
    let n = |p: &str| r(p).parse::<u32>().unwrap_or(0);

    let governor = fs::read_dir("/sys/devices/system/cpu")
        .ok()
        .and_then(|mut d| d.find(|e| e.as_ref().map(|e| {
            e.file_name().to_string_lossy().starts_with("cpu") &&
            e.file_name().to_string_lossy().chars().nth(3).map(|c| c.is_ascii_digit()).unwrap_or(false)
        }).unwrap_or(false)))
        .and_then(|e| e.ok())
        .map(|e| r(&format!("{}/cpufreq/scaling_governor", e.path().display())))
        .unwrap_or_else(|| r("/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor"));

    let hugepages = r("/sys/kernel/mm/transparent_hugepage/enabled");
    let hugepages = hugepages.split_whitespace()
        .find(|w| w.starts_with('['))
        .map(|w| w.trim_matches(|c| c == '[' || c == ']').to_string())
        .unwrap_or(hugepages);

    let mem_free_mb = fs::read_to_string("/proc/meminfo").unwrap_or_default()
        .lines()
        .find(|l| l.starts_with("MemAvailable:"))
        .and_then(|l| l.split_whitespace().nth(1))
        .and_then(|v| v.parse::<u32>().ok())
        .unwrap_or(0) / 1024;

    let loadavg = fs::read_to_string("/proc/loadavg").unwrap_or_default();
    let mut load_parts = loadavg.split_whitespace();
    let load_1 = load_parts.next().unwrap_or("0.00").parse::<f32>().unwrap_or(0.0);
    let load_5 = load_parts.next().unwrap_or("0.00").parse::<f32>().unwrap_or(0.0);

    let nr_requests = ["nvme0n1","nvme1n1","sda","sdb"].iter()
        .find_map(|d| {
            let p = format!("/sys/block/{}/queue/nr_requests", d);
            fs::read_to_string(&p).ok().and_then(|v| v.trim().parse::<u32>().ok())
        })
        .unwrap_or(0);

    let cpu_freq_mhz = fs::read_to_string("/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq")
        .ok()
        .and_then(|v| v.trim().parse::<u32>().ok())
        .map(|khz| khz / 1000)
        .unwrap_or(0);

    let cpu_max_mhz = fs::read_to_string("/sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq")
        .ok()
        .and_then(|v| v.trim().parse::<u32>().ok())
        .map(|khz| khz / 1000)
        .unwrap_or(4000);

    let mem_total_mb = fs::read_to_string("/proc/meminfo").unwrap_or_default()
        .lines()
        .find(|l| l.starts_with("MemTotal:"))
        .and_then(|l| l.split_whitespace().nth(1))
        .and_then(|v| v.parse::<u32>().ok())
        .unwrap_or(0) / 1024;

    // Temperatura del paquete CPU (preferimos x86_pkg_temp, sino la zona más caliente)
    let cpu_temp_celsius = {
        let mut max_t = 0.0f32;
        let mut pkg_t = 0.0f32;
        if let Ok(entries) = fs::read_dir("/sys/class/thermal") {
            for e in entries.filter_map(|e| e.ok()) {
                if !e.file_name().to_string_lossy().starts_with("thermal_zone") { continue; }
                let path = e.path();
                let t = fs::read_to_string(path.join("temp"))
                    .ok().and_then(|v| v.trim().parse::<i32>().ok())
                    .map(|m| m as f32 / 1000.0).unwrap_or(0.0);
                if t <= 0.0 || t > 110.0 { continue; }
                let zone_type = fs::read_to_string(path.join("type"))
                    .unwrap_or_default().trim().to_lowercase();
                if zone_type.contains("pkg") || zone_type.contains("package") || zone_type.contains("x86") {
                    if t > pkg_t { pkg_t = t; }
                }
                if t > max_t { max_t = t; }
            }
        }
        if pkg_t > 0.0 { pkg_t } else { max_t }
    };

    // Frecuencia media de todos los cores y conteo de cores
    let (cpu_avg_freq_mhz, cpu_cores) = {
        let mut freqs: Vec<u32> = Vec::new();
        if let Ok(entries) = fs::read_dir("/sys/devices/system/cpu") {
            for e in entries.filter_map(|e| e.ok()) {
                let name = e.file_name().to_string_lossy().to_string();
                if name.starts_with("cpu") && name.len() > 3 && name[3..].chars().all(|c| c.is_ascii_digit()) {
                    let freq_path = e.path().join("cpufreq/scaling_cur_freq");
                    if let Ok(v) = fs::read_to_string(freq_path) {
                        if let Ok(khz) = v.trim().parse::<u32>() {
                            freqs.push(khz / 1000);
                        }
                    }
                }
            }
        }
        let count = freqs.len() as u32;
        let avg = if freqs.is_empty() { cpu_freq_mhz } else { freqs.iter().sum::<u32>() / count };
        (avg, count.max(1))
    };

    LiveMetrics {
        governor,
        swappiness:       n("/proc/sys/vm/swappiness"),
        dirty_ratio:      n("/proc/sys/vm/dirty_ratio"),
        dirty_bg:         n("/proc/sys/vm/dirty_background_ratio"),
        hugepages,
        mem_free_mb,
        mem_total_mb,
        load_1,
        load_5,
        nr_requests,
        cpu_freq_mhz,
        cpu_max_mhz,
        cpu_temp_celsius,
        cpu_avg_freq_mhz,
        cpu_cores,
    }
}

#[tauri::command]
fn get_license_status() -> bool {
    match memory::get_license_key() {
        None => false,
        Some(_) => {
            match memory::get_license_hw_fingerprint() {
                None => {
                    // Licencia sin fingerprint (instalación previa) — vincular esta máquina ahora
                    memory::save_license_hw_fingerprint(&get_hw_fingerprint()).ok();
                    true
                }
                Some(stored_fp) => stored_fp == get_hw_fingerprint(),
            }
        }
    }
}

#[tauri::command]
fn get_demo_count() -> u32 {
    memory::get_demo_count()
}

#[tauri::command]
async fn activate_license(key: String) -> Result<bool, String> {
    let key = key.trim().to_string();
    if key.is_empty() {
        return Err("La clave de licencia no puede estar vacía.".to_string());
    }

    // Nombre de instancia: CPU model (anónimo, sin hostname)
    let instance_name = {
        use std::fs;
        let cpu = fs::read_to_string("/proc/cpuinfo")
            .unwrap_or_default()
            .lines()
            .find(|l| l.contains("model name"))
            .and_then(|l| l.split(':').nth(1))
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|| "unknown".to_string());
        format!("dix-{}", &cpu[..cpu.len().min(40)])
    };

    // Validación real contra Lemon Squeezy
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Error de red: {}", e))?;

    let response = client
        .post(obfstr!("https://api.lemonsqueezy.com/v1/licenses/activate"))
        .header("Accept", "application/json")
        .form(&[
            ("license_key", key.as_str()),
            ("instance_name", instance_name.as_str()),
        ])
        .send()
        .await
        .map_err(|_| "No se pudo conectar con el servidor de licencias. Comprueba tu conexión.".to_string())?;

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|_| "Respuesta inválida del servidor de licencias.".to_string())?;

    let activated = body.get("activated").and_then(|v| v.as_bool()).unwrap_or(false);

    if !activated {
        let msg = body
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("Clave de licencia inválida o ya activada en otro dispositivo.");
        return Err(msg.to_string());
    }

    // Guardar clave, instance_id y fingerprint de esta máquina
    memory::save_license_key(&key)?;
    memory::save_license_hw_fingerprint(&get_hw_fingerprint())?;
    if let Some(instance_id) = body
        .get("instance")
        .and_then(|i| i.get("id"))
        .and_then(|i| i.as_str())
    {
        memory::save_license_instance_id(instance_id)?;
    }

    Ok(true)
}

// ─── Builder de prompt ────────────────────────────────────────────────────────

fn build_analysis_prompt(scan: &SystemScan) -> String {
    let opt_cache = cache::load_cache();
    let pinned_hint = cache::format_pinned_hint(&opt_cache.pinned_params);
    let ram_gb = (scan.mem_total_mb + 512) / 1024;
    let hardware_line = format!(
        "HARDWARE: {} {} kernel {}, {}, GPU: {}, {}GB RAM, NVMe.",
        scan.distro_id, scan.distro_version, scan.kernel_version,
        scan.cpu_model, scan.gpu_model, ram_gb
    );

    let schema = r#"{
  "analisis": "2-3 frases del estado actual",
  "score_actual": 0,
  "score_optimizado": 0,
  "optimizaciones": [
    {
      "id": "opt1",
      "categoria": "CPU|RAM|Storage|Red|Sistema",
      "titulo": "string",
      "descripcion": "1 frase",
      "impacto": 0,
      "riesgo": "bajo|medio|alto",
      "mejora_estimada": "string",
      "aplicar": true,
      "comando_preview": "string con /sbin/sysctl si aplica",
      "tiempo_estimado": "string"
    }
  ]
}"#;

    format!(
        "Analiza estos datos reales del sistema y genera un plan de optimización.\n\
        DATOS REALES:\n\
        - CPU Governor: {} ({} núcleos lógicos)\n\
        - vm.swappiness: {}\n\
        - vm.dirty_ratio: {}%   vm.dirty_background_ratio: {}%\n\
        - Scheduler disco: {}\n\
        - Audio: {}\n\
        - Hugepages activo: {}\n\
        - NUMA Balancing: {}\n\
        - RAM: {} MB total, {} MB disponible\n\
        - Load avg (1/5/15min): {}\n\
        - NVMe nr_requests: {}\n\
        - IRQbalance activo: {}\n\
        - CPU freq: {}-{} MHz\n\
        - CPU temperatura: {:.1}°C\n\n\
        {hardware_line}\n\n\
        {pinned}\
        {rules}\
        Incluye 8-12 optimizaciones reales basadas en los datos actuales. \
        No sugieras cambios que ya estén en su valor óptimo.\n\n\
        Responde ÚNICAMENTE con JSON válido sin texto extra ni backticks:\n{}",
        scan.cpu_governor, scan.cpu_cores,
        scan.swappiness,
        scan.dirty_ratio, scan.dirty_background_ratio,
        scan.disk_scheduler,
        scan.audio_server,
        scan.hugepages,
        scan.numa_balancing,
        scan.mem_total_mb, scan.mem_available_mb,
        scan.load_avg,
        scan.nvme_queue_depth,
        scan.irqbalance_active,
        scan.cpu_min_freq_mhz, scan.cpu_max_freq_mhz,
        scan.cpu_temp_celsius,
        schema,
        hardware_line = hardware_line,
        pinned = if pinned_hint.is_empty() {
            String::new()
        } else {
            format!("{}\n\n", pinned_hint)
        },
        rules = format!("{}\n", policy::policy_rules_for_prompt()),
    )
}

// ─── Arranque ─────────────────────────────────────────────────────────────────

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let handle = app.handle().clone();
            if let Some(window) = handle.get_webview_window("main") {
                if let Ok(icon) = tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png")) {
                    window.set_icon(icon).ok();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scan_system,
            analyze_system,
            generate_script,
            execute_script,
            get_sessions,
            save_session,
            clear_sessions,
            reboot_system,
            list_rollbacks,
            execute_rollback,
            get_cache_stats,
            get_hw_fingerprint,
            get_license_status,
            get_demo_count,
            activate_license,
            get_live_metrics,
        ])
        .run(tauri::generate_context!())
        .expect("Error arrancando Dix");
}
