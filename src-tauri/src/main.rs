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
mod atlas;
mod benchmark;
mod state;

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
async fn analyze_system(scan_json: String, bench_json: Option<String>) -> Result<AnalysisResponse, String> {
    // Modo creador — Alonso Torres, DixSystem. Sin límites.

    let scan: SystemScan = serde_json::from_str(&scan_json)
        .map_err(|e| format!("Scan JSON inválido: {}", e))?;
    let bench: Option<benchmark::BenchmarkResult> = bench_json
        .as_deref()
        .and_then(|j| serde_json::from_str(j).ok());

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

    #[cfg(target_os = "windows")]
    let system = obfstr!("Eres un experto en optimizacion Windows. Respondes SOLO con JSON valido sin markdown.").to_string();
    #[cfg(not(target_os = "windows"))]
    let system = format!(
        "{}\n{}",
        obfstr!("Eres un experto en optimización Linux. Respondes SOLO con JSON válido sin markdown."),
        policy::policy_rules_for_prompt()
    );
    let user = build_analysis_prompt(&scan, bench.as_ref());
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

    let is_demo = memory::get_license_key().is_none();
    if is_demo {
        memory::increment_demo_count().ok();
    }

    // Atlas — telemetría anónima: extraer scores y optimizaciones del JSON de análisis
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&result) {
        let score_antes   = parsed["score_actual"].as_u64().unwrap_or(0) as u32;
        let score_despues = parsed["score_optimizado"].as_u64().unwrap_or(0) as u32;
        let opts: Vec<String> = parsed["optimizaciones"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|o| {
                let titulo = o["titulo"].as_str().unwrap_or("");
                let cat    = o["categoria"].as_str().unwrap_or("");
                if titulo.is_empty() { None } else { Some(format!("{}: {}", cat, titulo)) }
            })
            .collect();
        atlas::report(&scan, score_antes, score_despues, opts);
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

    #[cfg(target_os = "windows")]
    let system = format!(
        "Experto en PowerShell/Windows. Genera script de optimizacion para: {}. \
        REGLAS: 1) SOLO PowerShell puro. Maximo 80 lineas. 2) Sin markdown ni backticks. \
        3) Empieza con $ErrorActionPreference = 'Continue'. 4) Usa Write-Host para mensajes. \
        5) Usa -ErrorAction SilentlyContinue en comandos que pueden fallar. \
        6) Para persistencia: usa schtasks y registro de Windows. \
        7) NUNCA formatear discos, eliminar archivos del sistema ni deshabilitar el Firewall de Windows.",
        hw_desc
    );
    #[cfg(not(target_os = "windows"))]
    let system = format!(
        "Experto en bash/Linux. Genera script de optimización para: {}. \
        REGLAS: 1) SOLO bash puro. Máximo 60 líneas. 2) Sin markdown ni backticks. \
        3) Empieza con #!/bin/bash. 4) Usa echo para mensajes. \
        5) Usa /sbin/sysctl con ruta absoluta para sysctl. \
        6) Termina comandos que pueden fallar con || true. 7) Sin EOF ni heredocs.\n{}",
        hw_desc,
        policy::policy_rules_for_prompt()
    );

    #[cfg(target_os = "windows")]
    let user = format!(
        "Genera el script PowerShell para estas optimizaciones:\n{}\nResumen del sistema:\n{}",
        optimizations_json, scan_json
    );
    #[cfg(not(target_os = "windows"))]
    let user = format!(
        "Genera el script bash para estas optimizaciones:\n{}\nResumen del sistema:\n{}",
        optimizations_json, scan_json
    );

    let script = claude_gateway::call(&system, &user, 2000).await?;

    // Validación de seguridad (solo Linux — el validador bash no aplica a PS1)
    #[cfg(not(target_os = "windows"))]
    {
        let violations = policy::validate_script(&script);
        if !violations.is_empty() {
            let msgs: Vec<String> = violations
                .iter()
                .map(|v| format!("[{}] {}", v.rule, v.detail))
                .collect();
            return Err(format!("Script violó políticas de seguridad:\n{}", msgs.join("\n")));
        }
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
    #[cfg(target_os = "windows")]
    {
        Command::new("shutdown")
            .args(["/r", "/t", "60", "/c", "Dix: reiniciando para aplicar optimizaciones"])
            .spawn()
            .map_err(|e| format!("No se pudo programar el reinicio: {}", e))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        Command::new("/usr/bin/pkexec")
            .args(["/sbin/shutdown", "-r", "+1", "Dix: reiniciando para aplicar optimizaciones"])
            .spawn()
            .map_err(|e| format!("No se pudo programar el reinicio: {}", e))?;
    }
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
    #[cfg(target_os = "windows")]
    {
        // Windows: usa MachineGuid del registro — único por instalación del SO
        let output = Command::new("powershell")
            .args([
                "-NoProfile", "-NonInteractive",
                "-Command",
                "(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography').MachineGuid",
            ])
            .output()
            .ok();
        if let Some(o) = output {
            let guid = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if guid.len() >= 16 {
                return guid;
            }
        }
        return "unknown_win_machine".to_string();
    }
    #[cfg(not(target_os = "windows"))]
    {
        use std::fs;
        let mid = fs::read_to_string("/etc/machine-id")
            .or_else(|_| fs::read_to_string("/var/lib/dbus/machine-id"))
            .unwrap_or_default();
        let mid = mid.trim();
        if mid.len() >= 16 {
            return mid.to_string();
        }
        fs::read_to_string("/proc/cpuinfo")
            .unwrap_or_default()
            .lines()
            .find(|l| l.contains("model name"))
            .and_then(|l| l.split(':').nth(1))
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|| "unknown_cpu".to_string())
    }
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
    #[cfg(target_os = "windows")]
    return get_live_metrics_windows();
    #[cfg(not(target_os = "windows"))]
    return get_live_metrics_linux();
}

#[cfg(target_os = "windows")]
fn get_live_metrics_windows() -> LiveMetrics {
    // Consulta PowerShell única para minimizar latencia
    let ps_out = Command::new("powershell")
        .args([
            "-NoProfile", "-NonInteractive", "-Command",
            "$p = (Get-CimInstance Win32_Processor | Select-Object -First 1);\
             $m = Get-CimInstance Win32_OperatingSystem;\
             $plan = (powercfg /getactivescheme) -replace '.*GUID: ([0-9a-f-]+).*','$1';\
             $gov = switch -Wildcard ($plan) {\
               'e9a42b02*' {'ultimate-performance'}\
               '8c5e7fda*' {'high-performance'}\
               'a1841308*' {'powersave'}\
               default     {'balanced'}\
             };\
             $freq = [int]($p.CurrentClockSpeed);\
             $maxf = [int]($p.MaxClockSpeed);\
             $cores = [int]($p.NumberOfLogicalProcessors);\
             $free = [int]($m.FreePhysicalMemory / 1024);\
             $total = [int]($m.TotalVisibleMemorySize / 1024);\
             $load = [math]::Round((Get-CimInstance Win32_PerfFormattedData_PerfOS_System).ProcessorQueueLength, 2);\
             \"$gov|$freq|$maxf|$cores|$free|$total|$load\"",
        ])
        .output()
        .ok();

    let line = ps_out
        .as_ref()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();

    let parts: Vec<&str> = line.split('|').collect();
    let get = |i: usize| parts.get(i).unwrap_or(&"0");

    LiveMetrics {
        governor:         get(0).to_string().replace("0", "balanced"),
        swappiness:       0,
        dirty_ratio:      0,
        dirty_bg:         0,
        hugepages:        "n/a".to_string(),
        mem_free_mb:      get(4).parse().unwrap_or(0),
        mem_total_mb:     get(5).parse().unwrap_or(0),
        load_1:           get(6).parse().unwrap_or(0.0),
        load_5:           0.0,
        nr_requests:      0,
        cpu_freq_mhz:     get(1).parse().unwrap_or(0),
        cpu_max_mhz:      get(2).parse().unwrap_or(0),
        cpu_temp_celsius: 0.0,
        cpu_avg_freq_mhz: get(1).parse().unwrap_or(0),
        cpu_cores:        get(3).parse().unwrap_or(1),
    }
}

#[cfg(not(target_os = "windows"))]
fn get_live_metrics_linux() -> LiveMetrics {
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
        #[cfg(target_os = "windows")]
        {
            let cpu = Command::new("powershell")
                .args(["-NoProfile", "-NonInteractive", "-Command",
                    "(Get-CimInstance Win32_Processor | Select-Object -First 1).Name"])
                .output()
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                .unwrap_or_else(|_| "unknown-cpu".to_string());
            format!("dix-{}", &cpu[..cpu.len().min(40)])
        }
        #[cfg(not(target_os = "windows"))]
        {
            use std::fs;
            let cpu = fs::read_to_string("/proc/cpuinfo")
                .unwrap_or_default()
                .lines()
                .find(|l| l.contains("model name"))
                .and_then(|l| l.split(':').nth(1))
                .map(|s| s.trim().to_string())
                .unwrap_or_else(|| "unknown".to_string());
            format!("dix-{}", &cpu[..cpu.len().min(40)])
        }
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

// ─── Comandos de benchmark ────────────────────────────────────────────────────

#[tauri::command]
async fn run_benchmarks(scan_json: String) -> Result<benchmark::BenchmarkResult, String> {
    #[cfg(target_os = "windows")]
    return Ok(benchmark::BenchmarkResult::default());

    #[cfg(not(target_os = "windows"))]
    {
        let scan: SystemScan = serde_json::from_str(&scan_json)
            .map_err(|e| format!("Scan JSON inválido: {}", e))?;
        Ok(benchmark::run_all(scan.cpu_cores).await)
    }
}

#[tauri::command]
async fn run_benchmarks_partial(
    scan_json: String,
    categories_json: String,
) -> Result<benchmark::BenchmarkResult, String> {
    #[cfg(target_os = "windows")]
    return Ok(benchmark::BenchmarkResult::default());

    #[cfg(not(target_os = "windows"))]
    {
        let scan: SystemScan = serde_json::from_str(&scan_json)
            .map_err(|e| format!("Scan JSON inválido: {}", e))?;
        let cats: Vec<String> = serde_json::from_str(&categories_json)
            .map_err(|e| format!("Categories JSON inválido: {}", e))?;
        Ok(benchmark::run_for_categories(scan.cpu_cores, &cats).await)
    }
}

// ─── Comandos de estado post-reinicio ─────────────────────────────────────────

#[tauri::command]
fn save_applied_state(scan_json: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    return Ok(());

    #[cfg(not(target_os = "windows"))]
    {
        let scan: SystemScan = serde_json::from_str(&scan_json)
            .map_err(|e| format!("Scan JSON inválido: {}", e))?;
        state::save_from_scan(&scan)
    }
}

#[tauri::command]
fn check_post_reboot(scan_json: String) -> Vec<state::LostOpt> {
    #[cfg(target_os = "windows")]
    return vec![];

    #[cfg(not(target_os = "windows"))]
    {
        let scan: SystemScan = match serde_json::from_str(&scan_json) {
            Ok(s) => s,
            Err(_) => return vec![],
        };
        match state::load() {
            Some(applied) => state::compare(&scan, &applied),
            None => vec![],
        }
    }
}

#[tauri::command]
fn reapply_lost_opts(lost_json: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    return Ok("No aplicable en Windows.".to_string());

    #[cfg(not(target_os = "windows"))]
    {
        let lost: Vec<state::LostOpt> = serde_json::from_str(&lost_json)
            .map_err(|e| format!("LostOpt JSON inválido: {}", e))?;
        if lost.is_empty() {
            return Ok("No hay optimizaciones que reaplicar.".to_string());
        }
        let script = state::generate_reapply_script(&lost);
        executor::run_privileged_script(&script)
    }
}

// ─── Builder de prompt ────────────────────────────────────────────────────────

fn build_analysis_prompt(scan: &SystemScan, bench: Option<&benchmark::BenchmarkResult>) -> String {
    #[cfg(target_os = "windows")]
    return build_analysis_prompt_windows(scan);
    #[cfg(not(target_os = "windows"))]
    return build_analysis_prompt_linux(scan, bench);
}

#[cfg(not(target_os = "windows"))]
fn build_analysis_prompt_linux(scan: &SystemScan, bench: Option<&benchmark::BenchmarkResult>) -> String {
    let opt_cache = cache::load_cache();
    let pinned_hint = cache::format_pinned_hint(&opt_cache.pinned_params);
    let ram_gb = (scan.mem_total_mb + 512) / 1024;
    let hardware_line = format!(
        "HARDWARE: {} {} kernel {}, {}, GPU: {}, {}GB RAM, NVMe.",
        scan.distro_id, scan.distro_version, scan.kernel_version,
        scan.cpu_model, scan.gpu_model, ram_gb
    );

    let bench_section = match bench {
        Some(b) if b.measured => format!(
            "BENCHMARKS REALES MEDIDOS (sysbench + fio):\n\
            - CPU: {:.0} eventos/s ({} hilos, 5 segundos)\n\
            - RAM: {:.0} MB/s (memory, 4 segundos)\n\
            - Disco: {:.0} IOPS (fio 4K randread, 8 segundos)\n\
            Usa estos números reales en el campo 'analisis' y en mejora_estimada.\n\n",
            b.cpu_events_per_sec, scan.cpu_cores,
            b.ram_mb_per_sec,
            b.disk_iops,
        ),
        Some(b) if !b.missing_tools.is_empty() => format!(
            "NOTA: Benchmarks no disponibles ({} no instalado). \
            Análisis basado en parámetros del kernel.\n\n",
            b.missing_tools.join(", ")
        ),
        _ => String::new(),
    };

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
        {bench}\
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
        bench = bench_section,
        hardware_line = hardware_line,
        pinned = if pinned_hint.is_empty() {
            String::new()
        } else {
            format!("{}\n\n", pinned_hint)
        },
        rules = format!("{}\n", policy::policy_rules_for_prompt()),
    )
}

#[cfg(target_os = "windows")]
fn build_analysis_prompt_windows(scan: &SystemScan) -> String {
    let opt_cache = cache::load_cache();
    let pinned_hint = cache::format_pinned_hint(&opt_cache.pinned_params);
    let ram_gb = (scan.mem_total_mb + 512) / 1024;
    let hardware_line = format!(
        "HARDWARE: {} {}, {}, GPU: {}, {}GB RAM.",
        scan.distro_id, scan.distro_version, scan.cpu_model, scan.gpu_model, ram_gb
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
      "comando_preview": "string PowerShell si aplica",
      "tiempo_estimado": "string"
    }
  ]
}"#;

    format!(
        "Eres un experto en optimizacion de Windows. Analiza estos datos y genera un plan.\n\
        SISTEMA OPERATIVO: Windows\n\
        DATOS REALES:\n\
        - Plan de energia activo: {}\n\
        - Nucleos logicos CPU: {}\n\
        - Nagle TCP (TcpAckFrequency): {}\n\
        - Scheduler disco: {}\n\
        - Large Pages: {}\n\
        - RAM: {} MB total, {} MB disponible\n\
        - CPU freq: {}-{} MHz\n\
        - CPU temperatura: {:.1}C\n\n\
        {hardware_line}\n\n\
        {pinned}\
        REGLAS ABSOLUTAS (Windows):\n\
        - NUNCA deshabilitar Windows Defender ni el Firewall\n\
        - NUNCA formatear discos ni eliminar archivos del sistema\n\
        - NUNCA deshabilitar el servicio de actualizaciones si el riesgo es alto\n\
        - SIEMPRE usar PowerShell con -ErrorAction SilentlyContinue\n\n\
        Genera 8-12 optimizaciones reales: plan de energia, Nagle, SysMain, \
        prefetch, visual effects, HPET, timer resolution, registro TCP.\n\
        No sugieras cambios que ya esten en su valor optimo.\n\n\
        Responde UNICAMENTE con JSON valido sin texto extra ni backticks:\n{}",
        scan.cpu_governor, scan.cpu_cores,
        scan.dirty_ratio,
        scan.disk_scheduler,
        scan.hugepages,
        scan.mem_total_mb, scan.mem_available_mb,
        scan.cpu_min_freq_mhz, scan.cpu_max_freq_mhz,
        scan.cpu_temp_celsius,
        schema,
        hardware_line = hardware_line,
        pinned = if pinned_hint.is_empty() {
            String::new()
        } else {
            format!("{}\n\n", pinned_hint)
        },
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
            run_benchmarks,
            run_benchmarks_partial,
            save_applied_state,
            check_post_reboot,
            reapply_lost_opts,
        ])
        .run(tauri::generate_context!())
        .expect("Error arrancando Dix");
}
