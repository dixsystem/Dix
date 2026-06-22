// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Los módulos del núcleo viven en lib.rs (crate `dix`) para poder
// reutilizarse desde otros binarios (ver src/bin/dix_cli.rs) sin la capa
// Tauri. Aquí solo se importan.
use dix::{
    ai_budget, atlas, benchmark, cache, claude_gateway, command_engine, dixkontrol, executor,
    journal, memory, policy, safe_mode, scanner, startup, state,
};
#[cfg(target_os = "windows")]
use dix::winutil;

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
async fn scan_system() -> Result<SystemScan, String> {
    tokio::task::spawn_blocking(scanner::scan)
        .await
        .map_err(|e| format!("Error interno esperando el escaneo: {}", e))?
}

#[tauri::command]
async fn analyze_system(scan_json: String, bench_json: Option<String>, profile: Option<String>) -> Result<AnalysisResponse, String> {
    // Modo creador — Alonso Torres, DixSystem. Sin límites.

    let scan: SystemScan = serde_json::from_str(&scan_json)
        .map_err(|e| format!("Scan JSON inválido: {}", e))?;
    let bench: Option<benchmark::BenchmarkResult> = bench_json
        .as_deref()
        .and_then(|j| serde_json::from_str(j).ok());
    let profile_str = profile.as_deref().unwrap_or("balanced");

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
    let system = format!(
        "Eres un experto en optimizacion Windows. Respondes SOLO con JSON valido sin markdown.\n{}",
        profile_hint(profile_str)
    );
    #[cfg(not(target_os = "windows"))]
    let system = format!(
        "{}\n{}\n{}",
        obfstr!("Eres un experto en optimización Linux. Respondes SOLO con JSON válido sin markdown."),
        policy::policy_rules_for_prompt(),
        profile_hint(profile_str)
    );
    let user = build_analysis_prompt(&scan, bench.as_ref(), profile_str);
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

/// Optimizaciones de disco conocidas por tardar mucho más que el resto del lote
/// (p.ej. Optimize-Volume -Defrag en un HDD mecánico puede tardar 10-30 min).
/// Se detectan por su comando y se sacan del prompt que recibe la IA, para que
/// no terminen mezcladas en el script principal de 5 min de timeout.
#[cfg(target_os = "windows")]
fn is_slow_disk_optimization(comando_preview: &str) -> bool {
    let lower = comando_preview.to_lowercase();
    lower.contains("optimize-volume") || lower.contains("defrag.exe")
}

#[derive(Serialize)]
struct GeneratedScript {
    script: String,
    /// Script de mantenimiento de disco lento, a ejecutar aparte con su propio
    /// timeout largo (ver `execute_maintenance_script`). None si no aplica.
    maintenance_script: Option<String>,
}

#[tauri::command]
async fn generate_script(optimizations_json: String, scan_json: String, profile: Option<String>) -> Result<GeneratedScript, String> {
    let scan: SystemScan = serde_json::from_str(&scan_json)
        .map_err(|e| format!("Scan JSON inválido: {}", e))?;
    let ram_gb = (scan.mem_total_mb + 512) / 1024;
    let hw_desc = format!(
        "{} {}, {}, GPU: {}, {}GB RAM",
        scan.distro_id, scan.distro_version, scan.cpu_model, scan.gpu_model, ram_gb
    );
    let profile_str = profile.as_deref().unwrap_or("balanced");

    // Sacar del lote las optimizaciones de disco lentas (Windows) antes de
    // pedirle el script a la IA, para que no se mezclen con tweaks rápidos
    // bajo el mismo timeout de 5 min.
    #[cfg(target_os = "windows")]
    let (optimizations_json, maintenance_script) = {
        let parsed: Vec<serde_json::Value> = serde_json::from_str(&optimizations_json)
            .map_err(|e| format!("optimizations_json inválido: {}", e))?;
        let (slow, fast): (Vec<_>, Vec<_>) = parsed.into_iter().partition(|o| {
            o["comando_preview"].as_str().map(is_slow_disk_optimization).unwrap_or(false)
        });

        let maintenance = if slow.is_empty() {
            None
        } else {
            let mut lines = vec![
                "$ErrorActionPreference = 'Continue'".to_string(),
                "Write-Host '[Dix] Mantenimiento de disco (puede tardar hasta 30 min en HDD)...'".to_string(),
            ];
            for opt in &slow {
                if let Some(cmd) = opt["comando_preview"].as_str() {
                    let titulo = opt["titulo"].as_str().unwrap_or("Optimización de disco");
                    lines.push(format!("Write-Host '[Dix] {}'", titulo.replace('\'', "''")));
                    lines.push(cmd.to_string());
                }
            }
            lines.push("Write-Host '[Dix] Mantenimiento de disco completado.'".to_string());
            Some(lines.join("\n"))
        };

        let fast_json = serde_json::to_string(&fast)
            .map_err(|e| format!("Error serializando optimizaciones: {}", e))?;
        (fast_json, maintenance)
    };
    #[cfg(not(target_os = "windows"))]
    let maintenance_script: Option<String> = None;

    #[cfg(target_os = "windows")]
    let system = format!(
        "Experto en PowerShell/Windows. Genera script de optimizacion para: {}. \
        REGLAS: 1) SOLO PowerShell puro. Maximo 80 lineas. 2) Sin markdown ni backticks. \
        3) Empieza con $ErrorActionPreference = 'Continue'. 4) Usa Write-Host para mensajes. \
        5) Usa -ErrorAction SilentlyContinue en comandos que pueden fallar. \
        6) Para persistencia: usa schtasks y registro de Windows. \
        7) NUNCA formatear discos, eliminar archivos del sistema, deshabilitar el Firewall \
        ni Windows Defender por completo, ni borrar shadow copies/backups. \
        8) NUNCA usar 'bcdedit' ni tocar 'useplatformclock' (HPET) — ya lo gestiona el catálogo \
        determinista de Dix; si sugieres algo de resolución de timer, hazlo solo a nivel de \
        proceso/usuario, nunca a nivel de firmware/arranque.\n{}",
        hw_desc,
        profile_hint(profile_str)
    );
    #[cfg(not(target_os = "windows"))]
    let system = format!(
        "Experto en bash/Linux. Genera script de optimización para: {}. \
        REGLAS: 1) SOLO bash puro. Máximo 60 líneas. 2) Sin markdown ni backticks. \
        3) Empieza con #!/bin/bash. 4) Usa echo para mensajes. \
        5) Usa /sbin/sysctl con ruta absoluta para sysctl. \
        6) Termina comandos que pueden fallar con || true. 7) Sin EOF ni heredocs.\n{}\n{}",
        hw_desc,
        policy::policy_rules_for_prompt(),
        profile_hint(profile_str)
    );

    // En Windows seguimos pidiendo el script a la IA (riesgo ya cubierto por
    // validate_script_windows + tarea TOCTOU dedicada). En Linux, a partir de
    // aquí la IA YA NO escribe bash: solo eligió operaciones de un catálogo
    // cerrado en `optimizations_json.operacion`, y Rust las valida y renderiza.
    #[cfg(target_os = "windows")]
    let user = format!(
        "Genera el script PowerShell para estas optimizaciones:\n{}\nResumen del sistema:\n{}",
        optimizations_json, scan_json
    );
    #[cfg(target_os = "windows")]
    let ai_script = claude_gateway::call(&system, &user, 2000).await?;

    // Defensa adicional además de la regla 8 del prompt: el catálogo
    // determinista es la única fuente de verdad para HPET/useplatformclock.
    // Si la IA desobedece la instrucción y mete una línea de bcdedit que lo
    // toque, se descarta esa línea entera en vez de bloquear todo el script
    // (ya vimos en producción que la IA puede revertir con esto la
    // optimización de HPET en el mismo "Aplicar" en que el catálogo la fija).
    #[cfg(target_os = "windows")]
    let ai_script: String = ai_script
        .lines()
        .filter(|l| {
            let lower = l.to_lowercase();
            !(lower.contains("bcdedit") && lower.contains("useplatformclock"))
        })
        .collect::<Vec<_>>()
        .join("\n");

    // En Linux: extraer el campo "operacion" de cada optimización marcada
    // "aplicar": true, deserializarlo a DixOperation y validar contra el
    // catálogo cerrado. Las operaciones inválidas o desconocidas se
    // descartan — nunca se ejecuta texto libre escrito por la IA.
    #[cfg(not(target_os = "windows"))]
    let (ai_script, op_warnings): (String, Vec<String>) = {
        let parsed: Vec<serde_json::Value> = serde_json::from_str(&optimizations_json)
            .map_err(|e| format!("optimizations_json inválido: {}", e))?;
        let ops: Vec<command_engine::DixOperation> = parsed
            .iter()
            .filter(|o| o["aplicar"].as_bool().unwrap_or(false))
            .filter_map(|o| o.get("operacion"))
            .filter_map(|op_val| serde_json::from_value(op_val.clone()).ok())
            .collect();
        command_engine::render_all(&ops)
    };

    // En Windows, antepone el catálogo determinista de mejoras reales (no
    // depende de lo que la IA escriba ese día) y luego añade lo que sugiera
    // la IA encima. Garantiza una mejora real y medible en cada "Aplicar".
    #[cfg(target_os = "windows")]
    let script = {
        let mut lines = vec![
            "$ErrorActionPreference = 'Continue'".to_string(),
            "Write-Host '[Dix] Aplicando mejoras base verificadas...'".to_string(),
        ];
        lines.extend(executor::deterministic_tweaks_windows(&scan));
        lines.push(ai_script);
        lines.join("\n")
    };
    // En Linux, mismo principio: catálogo determinista primero, y luego solo
    // las operaciones de IA que pasaron la validación del motor de comandos
    // estructurados (command_engine), nunca bash libre.
    #[cfg(not(target_os = "windows"))]
    let script = {
        let mut lines = vec![
            "#!/bin/bash".to_string(),
            "echo '[Dix] Aplicando mejoras base verificadas...'".to_string(),
        ];
        lines.extend(executor::deterministic_tweaks_linux(&scan));
        if !op_warnings.is_empty() {
            lines.push(format!(
                "echo '[Dix] {} operación(es) descartadas por política: {}'",
                op_warnings.len(),
                op_warnings.join("; ").replace('\'', "'\\''")
            ));
        }
        lines.push(ai_script);
        lines.join("\n")
    };

    // Validación de seguridad: capa adicional de defensa en profundidad.
    // En Linux el script ya solo contiene líneas renderizadas por
    // command_engine (nunca texto libre de la IA), pero esta segunda
    // comprobación se mantiene por si el catálogo determinista cambiara.
    #[cfg(not(target_os = "windows"))]
    let violations = policy::validate_script(&script);
    #[cfg(target_os = "windows")]
    let violations = policy::validate_script_windows(&script);

    if !violations.is_empty() {
        let msgs: Vec<String> = violations
            .iter()
            .map(|v| format!("[{}] {}", v.rule, v.detail))
            .collect();
        return Err(format!("Script violó políticas de seguridad:\n{}", msgs.join("\n")));
    }

    Ok(GeneratedScript { script, maintenance_script })
}

#[tauri::command]
async fn execute_maintenance_script(script_content: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || executor::run_disk_maintenance(&script_content))
        .await
        .map_err(|e| format!("Error interno esperando el mantenimiento de disco: {}", e))?
}

#[tauri::command]
async fn execute_script(script_content: String, scan_json: String) -> Result<String, String> {
    let scan: SystemScan = serde_json::from_str(&scan_json)
        .map_err(|e| format!("Scan JSON inválido para rollback: {}", e))?;

    // El script elevado puede tardar varios minutos (p.ej. Optimize-Volume).
    // spawn_blocking lo mueve a un hilo dedicado para no congelar la ventana
    // principal mientras se espera al proceso de PowerShell.
    let content = script_content.clone();
    let result = tokio::task::spawn_blocking(move || executor::run_script(&content, &scan))
        .await
        .map_err(|e| format!("Error interno esperando el script: {}", e))??;

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

// Registra (o borra) una entrada RunOnce para que Windows relance Dix
// automáticamente justo después del próximo login — sin esto, tras el
// reinicio el usuario se queda con el escritorio y tiene que abrir Dix a
// mano sin ninguna señal de que las optimizaciones se aplicaron y siguen
// vigentes. RunOnce se autoborra en cuanto Windows lo ejecuta una vez.
#[cfg(target_os = "windows")]
fn set_relaunch_after_reboot(enabled: bool) -> Result<(), String> {
    let script = if enabled {
        let exe = std::env::current_exe()
            .map_err(|e| format!("No se pudo obtener la ruta de Dix: {}", e))?;
        let exe_str = exe.display().to_string().replace('\'', "''");
        format!(
            "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce' \
             -Name 'DixPostReboot' -Value '\"{}\"' -Type String -ErrorAction Stop",
            exe_str
        )
    } else {
        "Remove-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce' \
         -Name 'DixPostReboot' -ErrorAction SilentlyContinue".to_string()
    };
    crate::winutil::run_powershell(&script, std::time::Duration::from_secs(8));
    Ok(())
}

#[tauri::command]
fn reboot_system() -> Result<(), String> {
    // .output() en vez de .spawn(): espera a que el comando termine y revisa
    // su código de salida real. Con .spawn() un fallo (permisos, política de
    // grupo, etc.) se perdía en silencio y el usuario se quedaba esperando un
    // reinicio que nunca iba a llegar, sin ningún error visible.
    #[cfg(target_os = "windows")]
    {
        set_relaunch_after_reboot(true)?;
        let output = Command::new("shutdown")
            .args(["/r", "/t", "60", "/c", "Dix: reiniciando para aplicar optimizaciones"])
            .output()
            .map_err(|e| format!("No se pudo programar el reinicio: {}", e))?;
        if !output.status.success() {
            return Err(format!(
                "No se pudo programar el reinicio: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("/usr/bin/pkexec")
            .args(["/sbin/shutdown", "-r", "+1", "Dix: reiniciando para aplicar optimizaciones"])
            .output()
            .map_err(|e| format!("No se pudo programar el reinicio: {}", e))?;
        if !output.status.success() {
            return Err(format!(
                "No se pudo programar el reinicio: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }
    }
    Ok(())
}

#[tauri::command]
fn cancel_reboot() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        set_relaunch_after_reboot(false)?;
        let output = Command::new("shutdown")
            .args(["/a"])
            .output()
            .map_err(|e| format!("No se pudo cancelar el reinicio: {}", e))?;
        if !output.status.success() {
            return Err(format!(
                "No se pudo cancelar el reinicio: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("/usr/bin/pkexec")
            .args(["/sbin/shutdown", "-c"])
            .output()
            .map_err(|e| format!("No se pudo cancelar el reinicio: {}", e))?;
        if !output.status.success() {
            return Err(format!(
                "No se pudo cancelar el reinicio: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }
    }
    Ok(())
}

#[tauri::command]
fn list_rollbacks() -> Vec<RollbackInfo> {
    executor::list_rollbacks()
}

#[tauri::command]
async fn execute_rollback(filename: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || executor::execute_rollback(&filename))
        .await
        .map_err(|e| format!("Error interno esperando el rollback: {}", e))?
}

#[tauri::command]
fn get_cache_stats() -> cache::CacheStats {
    cache::get_stats(&cache::load_cache())
}

#[tauri::command]
fn run_doctor() -> journal::DoctorReport {
    journal::run_doctor()
}

// ─── Hardware Fingerprint + Sistema de licencias (Semana 1) ──────────────────

#[tauri::command]
fn get_hw_fingerprint() -> String {
    #[cfg(target_os = "windows")]
    {
        // Windows: usa MachineGuid del registro — único por instalación del SO
        let guid = winutil::run_powershell(
            "(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography').MachineGuid",
            std::time::Duration::from_secs(10),
        );
        if let Some(guid) = guid {
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

#[derive(serde::Serialize, Clone)]
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
    use std::sync::{Mutex, OnceLock};
    use std::time::{Duration, Instant};

    // El frontend hace polling cada 400ms (LiveOptimizingPanel). Lanzar un
    // powershell.exe nuevo en cada tick es caro y, si alguna vez se cuelga,
    // los procesos se amontonan. Cacheamos 2s — sigue sintiéndose "en vivo"
    // pero evita la mayoría de los spawns.
    static CACHE: OnceLock<Mutex<Option<(Instant, LiveMetrics)>>> = OnceLock::new();
    let cache = CACHE.get_or_init(|| Mutex::new(None));

    if let Ok(guard) = cache.lock() {
        if let Some((ts, cached)) = guard.as_ref() {
            if ts.elapsed() < Duration::from_secs(2) {
                return cached.clone();
            }
        }
    }

    let script = "$p = (Get-CimInstance Win32_Processor | Select-Object -First 1);\
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
             \"$gov|$freq|$maxf|$cores|$free|$total|$load\"";

    // Timeout corto: esto es telemetría no crítica que se repite — si falla,
    // mejor devolver ceros que arriesgar bloquear el hilo de comandos de Tauri.
    let line = winutil::run_powershell(script, Duration::from_secs(3)).unwrap_or_default();

    let parts: Vec<&str> = line.split('|').collect();
    let get = |i: usize| parts.get(i).unwrap_or(&"0");

    let metrics = LiveMetrics {
        governor:         if *get(0) == "0" { "balanced".to_string() } else { get(0).to_string() },
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
    };

    if let Ok(mut guard) = cache.lock() {
        *guard = Some((Instant::now(), metrics.clone()));
    }
    metrics
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
    // PowerShell es síncrono y puede colgarse (AV, perfil lento) — se ejecuta
    // en spawn_blocking con timeout para no bloquear el runtime de Tokio.
    #[cfg(target_os = "windows")]
    let instance_name = tokio::task::spawn_blocking(|| {
        let cpu = winutil::run_powershell(
            "(Get-CimInstance Win32_Processor | Select-Object -First 1).Name",
            std::time::Duration::from_secs(10),
        )
        .unwrap_or_else(|| "unknown-cpu".to_string());
        format!("dix-{}", &cpu[..cpu.len().min(40)])
    })
    .await
    .unwrap_or_else(|_| "dix-unknown-cpu".to_string());

    #[cfg(not(target_os = "windows"))]
    let instance_name = {
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
    let scan: SystemScan = serde_json::from_str(&scan_json)
        .map_err(|e| format!("Scan JSON inválido: {}", e))?;
    Ok(benchmark::run_all(scan.cpu_cores).await)
}

#[tauri::command]
async fn run_benchmarks_partial(
    scan_json: String,
    categories_json: String,
) -> Result<benchmark::BenchmarkResult, String> {
    let scan: SystemScan = serde_json::from_str(&scan_json)
        .map_err(|e| format!("Scan JSON inválido: {}", e))?;
    let cats: Vec<String> = serde_json::from_str(&categories_json)
        .map_err(|e| format!("Categories JSON inválido: {}", e))?;
    Ok(benchmark::run_for_categories(scan.cpu_cores, &cats).await)
}

// ─── Comandos de estado post-reinicio ─────────────────────────────────────────

#[tauri::command]
fn save_applied_state(scan_json: String) -> Result<(), String> {
    let scan: SystemScan = serde_json::from_str(&scan_json)
        .map_err(|e| format!("Scan JSON inválido: {}", e))?;
    state::save_from_scan(&scan)
}

#[tauri::command]
fn check_post_reboot(scan_json: String) -> Vec<state::LostOpt> {
    let scan: SystemScan = match serde_json::from_str(&scan_json) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    match state::load() {
        Some(applied) => state::compare(&scan, &applied),
        None => vec![],
    }
}

#[tauri::command]
fn reapply_lost_opts(lost_json: String) -> Result<String, String> {
    let lost: Vec<state::LostOpt> = serde_json::from_str(&lost_json)
        .map_err(|e| format!("LostOpt JSON inválido: {}", e))?;
    if lost.is_empty() {
        return Ok("No hay optimizaciones que reaplicar.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        // Re-escanear para guardar un rollback real (no un valor por defecto vacío)
        let current_scan = scanner::scan()?;
        let script = state::generate_reapply_script_windows(&lost);
        executor::run_script(&script, &current_scan)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let script = state::generate_reapply_script(&lost);
        executor::run_privileged_script(&script)
    }
}

// ─── Comandos de programas de inicio ──────────────────────────────────────────

#[tauri::command]
async fn list_startup_items() -> Result<Vec<startup::StartupItem>, String> {
    tokio::task::spawn_blocking(startup::scan_startup_items)
        .await
        .map_err(|e| format!("Error interno escaneando programas de inicio: {}", e))
}

#[tauri::command]
async fn set_startup_item_enabled(id: String, enabled: bool) -> Result<String, String> {
    tokio::task::spawn_blocking(move || startup::set_enabled(&id, enabled))
        .await
        .map_err(|e| format!("Error interno: {}", e))?
}

// ─── Builder de prompt ────────────────────────────────────────────────────────

fn profile_hint(profile: &str) -> &'static str {
    match profile {
        "gaming"    => "PERFIL OBJETIVO: Gaming. Prioriza latencia CPU mínima (plan alto rendimiento, boost máximo), scheduler foreground, TCP sin Nagle, máxima RAM libre. Penaliza optimizaciones que sacrifiquen latencia por throughput.",
        "streaming" => "PERFIL OBJETIVO: Streaming/Contenido. Prioriza throughput de red estable, CPU sin throttling térmico para encoding, I/O disco para grabación, temperatura baja para sesiones largas. Evita cambios que causen micro-stutters.",
        "dev"       => "PERFIL OBJETIVO: Desarrollo. Prioriza velocidad de compilación (CPU máxima en builds), I/O escritura rápida, swappiness muy bajo para no paginar durante builds, inotify alto para file watchers.",
        "server"    => "PERFIL OBJETIVO: Servidor. Prioriza throughput máximo red/disco, estabilidad absoluta, scheduling equitativo para múltiples procesos. NUNCA sacrifiques estabilidad por rendimiento puntual.",
        _           => "PERFIL OBJETIVO: Equilibrado. Optimiza el balance general de rendimiento, estabilidad y consumo energético.",
    }
}

fn build_analysis_prompt(scan: &SystemScan, bench: Option<&benchmark::BenchmarkResult>, profile: &str) -> String {
    #[cfg(target_os = "windows")]
    return build_analysis_prompt_windows(scan, bench, profile);
    #[cfg(not(target_os = "windows"))]
    return build_analysis_prompt_linux(scan, bench, profile);
}

#[cfg(not(target_os = "windows"))]
fn build_analysis_prompt_linux(scan: &SystemScan, bench: Option<&benchmark::BenchmarkResult>, profile: &str) -> String {
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
      "comando_preview": "string con /sbin/sysctl si aplica (solo texto informativo para el usuario)",
      "operacion": {
        "tipo": "set_sysctl|set_disk_scheduler|set_hugepages|set_numa_balancing|set_nr_requests|enable_service|disable_service",
        "clave": "ej. vm.swappiness (solo para set_sysctl)",
        "valor": "ej. 10 (solo para set_sysctl/set_nr_requests)",
        "scheduler": "mq-deadline|kyber|bfq|none (solo para set_disk_scheduler)",
        "modo": "always|madvise (solo para set_hugepages, nunca never)",
        "activo": true,
        "nombre": "irqbalance|fstrim.timer (solo para enable_service/disable_service)"
      },
      "tiempo_estimado": "string"
    }
  ]
}"#;

    format!(
        "Analiza estos datos reales del sistema y genera un plan de optimización.\n\
        {profile_line}\
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
        - En batería (no conectado a AC): {}\n\
        - CPU freq: {}-{} MHz\n\
        - CPU temperatura: {:.1}°C\n\n\
        {hardware_line}\n\n\
        {pinned}\
        {rules}\
        YA SE APLICAN SIEMPRE DE FORMA GARANTIZADA (no los repitas en tu plan, \
        céntrate en optimizaciones DISTINTAS a estas): CPU governor performance, \
        vm.swappiness<=10, vm.dirty_ratio<=15, vm.dirty_background_ratio<=10, \
        transparent hugepages != never, kernel.numa_balancing=1, irqbalance activo.\n\n\
        Incluye 8-12 optimizaciones reales basadas en los datos actuales, distintas a las garantizadas. \
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
        scan.on_battery,
        scan.cpu_min_freq_mhz, scan.cpu_max_freq_mhz,
        scan.cpu_temp_celsius,
        schema,
        bench = bench_section,
        hardware_line = hardware_line,
        profile_line = format!("{}\n\n", profile_hint(profile)),
        pinned = if pinned_hint.is_empty() {
            String::new()
        } else {
            format!("{}\n\n", pinned_hint)
        },
        rules = format!("{}\n", policy::policy_rules_for_prompt()),
    )
}

// Sin cfg-gate para poder testear en Linux la lógica del prompt Windows.
fn build_analysis_prompt_windows(scan: &SystemScan, bench: Option<&benchmark::BenchmarkResult>, profile: &str) -> String {
    let opt_cache = cache::load_cache();
    let pinned_hint = cache::format_pinned_hint(&opt_cache.pinned_params);
    let ram_gb = (scan.mem_total_mb + 512) / 1024;
    let hardware_line = format!(
        "HARDWARE: {} {}, {}, GPU: {}, {}GB RAM.",
        scan.distro_id, scan.distro_version, scan.cpu_model, scan.gpu_model, ram_gb
    );
    let bench_section = match bench {
        Some(b) if b.measured => format!(
            "BENCHMARKS REALES MEDIDOS (micro-benchmarks nativos Dix):\n\
            - CPU: {:.0} primos/s ({} hilos, 5 segundos)\n\
            - RAM: {:.0} MB/s (copia secuencial, 3 segundos)\n\
            - Disco: {:.0} IOPS (4K random read, 5 segundos)\n\
            Usa estos numeros reales en el campo 'analisis' y en mejora_estimada.\n\n",
            b.cpu_events_per_sec, scan.cpu_cores,
            b.ram_mb_per_sec,
            b.disk_iops,
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
      "comando_preview": "string PowerShell si aplica",
      "tiempo_estimado": "string"
    }
  ]
}"#;

    format!(
        "Eres un experto en optimizacion de Windows. Analiza estos datos y genera un plan.\n\
        {profile_line}\
        {bench}\
        SISTEMA OPERATIVO: Windows\n\
        DATOS REALES:\n\
        - Plan de energia activo: {}\n\
        - Nucleos logicos CPU: {}\n\
        - Nagle TCP (TcpAckFrequency): {}\n\
        - Scheduler disco: {}\n\
        - Large Pages: {}\n\
        - Efectos visuales: {}\n\
        - Network Throttling Index: {}\n\
        - GPU Hardware Scheduling: {}\n\
        - Retardo de menus (ms): {}\n\
        - RAM: {} MB total, {} MB disponible\n\
        - CPU freq: {}-{} MHz\n\
        - CPU temperatura: {:.1}C\n\n\
        {hardware_line}\n\n\
        {pinned}\
        YA SE APLICAN SIEMPRE DE FORMA GARANTIZADA (no los repitas en tu plan, \
        céntrate en optimizaciones DISTINTAS a estas): plan de energia alto rendimiento, \
        efectos visuales en rendimiento, Network Throttling Index sin limite, \
        GPU Hardware Scheduling activado, retardo de menus a 0, Nagle desactivado, \
        HPET desactivado, Game DVR desactivado, SysMain desactivado en SSD/NVMe, \
        telemetria en nivel Basico.\n\n\
        REGLAS ABSOLUTAS (Windows):\n\
        - NUNCA deshabilitar Windows Defender ni el Firewall\n\
        - NUNCA formatear discos ni eliminar archivos del sistema\n\
        - NUNCA deshabilitar el servicio de actualizaciones si el riesgo es alto\n\
        - SIEMPRE usar PowerShell con -ErrorAction SilentlyContinue\n\n\
        Genera 8-12 optimizaciones reales adicionales a las garantizadas: prefetch, \
        timer resolution, programas de inicio, servicios en segundo plano, indexado de busqueda.\n\
        No sugieras cambios que ya esten en su valor optimo ni los ya garantizados arriba.\n\n\
        Responde UNICAMENTE con JSON valido sin texto extra ni backticks:\n{}",
        scan.cpu_governor, scan.cpu_cores,
        scan.dirty_ratio,
        scan.disk_scheduler,
        scan.hugepages,
        scan.visual_effects,
        scan.network_throttling,
        scan.gpu_hw_scheduling,
        scan.menu_show_delay,
        scan.mem_total_mb, scan.mem_available_mb,
        scan.cpu_min_freq_mhz, scan.cpu_max_freq_mhz,
        scan.cpu_temp_celsius,
        schema,
        hardware_line = hardware_line,
        bench = bench_section,
        profile_line = format!("{}\n\n", profile_hint(profile)),
        pinned = if pinned_hint.is_empty() {
            String::new()
        } else {
            format!("{}\n\n", pinned_hint)
        },
    )
}

// ─── Comandos Odyssey ─────────────────────────────────────────────────────────

#[tauri::command]
fn get_tier() -> String {
    memory::get_tier()
}

#[tauri::command]
fn export_report(content: String, filename: String) -> Result<String, String> {
    let home = dirs::home_dir().ok_or("No se pudo determinar el directorio home")?;
    let path = home.join(&filename);
    std::fs::write(&path, content).map_err(|e| format!("Error guardando reporte: {}", e))?;
    Ok(path.to_string_lossy().to_string())
}

// ─── Comandos DixKontrol ──────────────────────────────────────────────────────
// Ver docs/threat-model/dixkontrol.md. El nivel Moderado solo arranca si el
// usuario lo activa explícitamente (start) — nunca de forma automática.

#[tauri::command]
fn dixkontrol_foreground_context() -> dixkontrol::ForegroundContext {
    dixkontrol::read_foreground_context()
}

#[tauri::command]
fn dixkontrol_start_moderate() -> Result<String, String> {
    dixkontrol::start_moderate_session()?;
    Ok("Sesión Moderado iniciada.".to_string())
}

#[tauri::command]
fn dixkontrol_apply_moderate(operacion: command_engine::DixOperation) -> Result<String, String> {
    dixkontrol::apply_moderate(operacion)
}

#[tauri::command]
fn dixkontrol_stop_moderate() -> String {
    dixkontrol::stop_moderate_session();
    "Sesión Moderado cerrada.".to_string()
}

// ─── Arranque ─────────────────────────────────────────────────────────────────

/// Comprueba si el WebView2 Runtime está presente; si no, busca el instalador
/// standalone junto al ejecutable y lo lanza (el propio instalador pide elevación
/// UAC si hace falta). Permite que dix.exe funcione en cualquier Windows sin pasos
/// manuales previos.
#[cfg(target_os = "windows")]
fn ensure_webview2_installed() {
    let installed = std::path::Path::new(r"C:\Program Files (x86)\Microsoft\EdgeWebView\Application").exists()
        || std::path::Path::new(r"C:\Program Files\Microsoft\EdgeWebView\Application").exists();
    if installed {
        return;
    }

    let exe_dir = match std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.to_path_buf())) {
        Some(dir) => dir,
        None => return,
    };

    for candidate in ["WebView2_Standalone.exe", "MicrosoftEdgeWebview2Setup.exe"] {
        let installer = exe_dir.join(candidate);
        if installer.exists() {
            let _ = Command::new(installer).args(["/silent", "/install"]).status();
            break;
        }
    }
}

fn main() {
    #[cfg(target_os = "windows")]
    ensure_webview2_installed();

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
            execute_maintenance_script,
            get_sessions,
            save_session,
            clear_sessions,
            reboot_system,
            cancel_reboot,
            list_rollbacks,
            execute_rollback,
            get_cache_stats,
            run_doctor,
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
            list_startup_items,
            set_startup_item_enabled,
            get_tier,
            export_report,
            dixkontrol_foreground_context,
            dixkontrol_start_moderate,
            dixkontrol_apply_moderate,
            dixkontrol_stop_moderate,
        ])
        .run(tauri::generate_context!())
        .expect("Error arrancando Dix");
}

// ─── Tests simulados Windows ──────────────────────────────────────────────────
// Se ejecutan en Linux para validar la lógica Windows sin necesitar un PC Windows.
// Uso: cargo test tests_win -- --nocapture
// Uso (red): cargo test tests_win -- --nocapture --include-ignored

#[cfg(test)]
mod tests_win {
    use crate::scanner::SystemScan;
    use crate::build_analysis_prompt_windows;
    use crate::profile_hint;

    fn mock_scan_gaming() -> SystemScan {
        SystemScan {
            cpu_governor: "balanced".to_string(), cpu_cores: 8,
            swappiness: 50, dirty_ratio: 20, dirty_background_ratio: 10,
            disk_scheduler: "Samsung SSD 980 PRO 1TB".to_string(),
            audio_server: "wasapi".to_string(), hugepages: "madvise".to_string(),
            numa_balancing: "0".to_string(),
            mem_total_mb: 16384, mem_available_mb: 6144,
            load_avg: "45 45 45".to_string(), nvme_queue_depth: "32".to_string(),
            irqbalance_active: false, on_battery: false, cpu_min_freq_mhz: 800, cpu_max_freq_mhz: 4800,
            cpu_model: "Intel(R) Core(TM) i7-12700H @ 2.30GHz".to_string(),
            gpu_model: "NVIDIA GeForce RTX 3060 Laptop GPU".to_string(),
            distro_id: "windows".to_string(),
            distro_version: "Microsoft Windows 11 Home".to_string(),
            kernel_version: "10.0.22631.0".to_string(), cpu_temp_celsius: 72.0,
            visual_effects: "appearance".to_string(), network_throttling: "default".to_string(),
            gpu_hw_scheduling: "off".to_string(), menu_show_delay: 400,
            hpet_disabled: false, gamedvr_enabled: true, sysmain_running: true, telemetry_level: 255,
            boot_time_seconds: 0.0, slowest_boot_service: "n/a".to_string(),
        }
    }

    fn mock_scan_low_end() -> SystemScan {
        SystemScan {
            cpu_governor: "powersave".to_string(), cpu_cores: 4,
            swappiness: 50, dirty_ratio: 20, dirty_background_ratio: 10,
            disk_scheduler: "Seagate ST1000LM048-2E7172".to_string(),
            audio_server: "unknown".to_string(), hugepages: "madvise".to_string(),
            numa_balancing: "0".to_string(),
            mem_total_mb: 8192, mem_available_mb: 2048,
            load_avg: "80 80 80".to_string(), nvme_queue_depth: "64".to_string(),
            irqbalance_active: false, on_battery: false, cpu_min_freq_mhz: 400, cpu_max_freq_mhz: 2400,
            cpu_model: "Intel(R) Core(TM) i5-8250U @ 1.60GHz".to_string(),
            gpu_model: "Intel(R) UHD Graphics 620".to_string(),
            distro_id: "windows".to_string(),
            distro_version: "Microsoft Windows 10 Home".to_string(),
            kernel_version: "10.0.19045.0".to_string(), cpu_temp_celsius: 88.0,
            visual_effects: "appearance".to_string(), network_throttling: "default".to_string(),
            gpu_hw_scheduling: "off".to_string(), menu_show_delay: 400,
            hpet_disabled: false, gamedvr_enabled: true, sysmain_running: true, telemetry_level: 255,
            boot_time_seconds: 0.0, slowest_boot_service: "n/a".to_string(),
        }
    }

    fn mock_scan_workstation() -> SystemScan {
        SystemScan {
            cpu_governor: "high-performance".to_string(), cpu_cores: 16,
            swappiness: 50, dirty_ratio: 5, dirty_background_ratio: 10,
            disk_scheduler: "Samsung MZVL21T0HCLR-00B00 (NVMe)".to_string(),
            audio_server: "wasapi".to_string(), hugepages: "always".to_string(),
            numa_balancing: "0".to_string(),
            mem_total_mb: 65536, mem_available_mb: 40960,
            load_avg: "20 20 20".to_string(), nvme_queue_depth: "32".to_string(),
            irqbalance_active: false, on_battery: false, cpu_min_freq_mhz: 800, cpu_max_freq_mhz: 5600,
            cpu_model: "AMD Ryzen 9 7950X 16-Core Processor".to_string(),
            gpu_model: "NVIDIA GeForce RTX 4090".to_string(),
            distro_id: "windows".to_string(),
            distro_version: "Microsoft Windows 11 Pro".to_string(),
            kernel_version: "10.0.22631.0".to_string(), cpu_temp_celsius: 55.0,
            visual_effects: "performance".to_string(), network_throttling: "unlimited".to_string(),
            gpu_hw_scheduling: "on".to_string(), menu_show_delay: 0,
            hpet_disabled: true, gamedvr_enabled: false, sysmain_running: false, telemetry_level: 1,
            boot_time_seconds: 0.0, slowest_boot_service: "n/a".to_string(),
        }
    }

    // ── Tests unitarios (sin red) ──────────────────────────────────────────────

    #[test]
    fn test_scan_serializa_correctamente() {
        let scan = mock_scan_gaming();
        let json = serde_json::to_string(&scan).expect("Serialización del scan Windows falló");
        assert!(json.contains("\"windows\""), "distro_id debe ser 'windows'");
        assert!(json.contains("16384"), "mem_total_mb debe aparecer");
        assert!(json.contains("i7-12700H"), "cpu_model debe aparecer");
        let scan2: SystemScan = serde_json::from_str(&json).expect("Deserialización falló");
        assert_eq!(scan2.cpu_model, scan.cpu_model);
        assert_eq!(scan2.mem_total_mb, scan.mem_total_mb);
        println!("✓ JSON roundtrip OK ({} bytes)", json.len());
    }

    #[test]
    fn test_prompt_contiene_campos_criticos() {
        let scan = mock_scan_gaming();
        let prompt = build_analysis_prompt_windows(&scan, None, "gaming");
        assert!(!prompt.is_empty(), "Prompt no puede estar vacío");
        assert!(prompt.contains("Windows"), "Debe mencionar Windows");
        assert!(prompt.contains("Gaming"), "Debe incluir el perfil");
        assert!(prompt.contains("balanced"), "Debe incluir el plan de energía");
        assert!(prompt.contains("score_actual"), "Debe incluir el schema JSON");
        assert!(prompt.contains("optimizaciones"), "Debe incluir el campo optimizaciones");
        assert!(prompt.len() > 500, "Prompt demasiado corto: {} chars", prompt.len());
        println!("✓ Prompt gaming OK ({} chars)", prompt.len());
    }

    #[test]
    fn test_todos_los_perfiles_windows() {
        let perfiles = ["gaming", "streaming", "dev", "server", "balanced"];
        for perfil in &perfiles {
            let scan = mock_scan_gaming();
            let prompt = build_analysis_prompt_windows(&scan, None, perfil);
            assert!(!prompt.is_empty(), "Perfil '{}' generó prompt vacío", perfil);
            assert!(prompt.contains("score_actual"), "Perfil '{}' sin schema", perfil);
            println!("✓ Perfil '{}' → {} chars", perfil, prompt.len());
        }
    }

    #[test]
    fn test_escenario_low_end_windows10() {
        let scan = mock_scan_low_end();
        let prompt = build_analysis_prompt_windows(&scan, None, "balanced");
        assert!(prompt.contains("8192"), "Debe incluir la RAM (8GB)");
        assert!(prompt.contains("i5-8250U"), "Debe incluir el CPU");
        assert!(prompt.contains("Windows 10"), "Debe indicar Windows 10");
        assert!(prompt.contains("powersave"), "Debe incluir el plan de energía powersave");
        println!("✓ Escenario low-end Windows 10 OK");
    }

    #[test]
    fn test_escenario_workstation_windows11() {
        let scan = mock_scan_workstation();
        let prompt = build_analysis_prompt_windows(&scan, None, "dev");
        assert!(prompt.contains("65536"), "Debe incluir 64GB RAM");
        assert!(prompt.contains("Ryzen 9"), "Debe incluir el CPU");
        assert!(prompt.contains("Desarrollo"), "Debe incluir perfil dev en español");
        println!("✓ Escenario workstation Windows 11 OK");
    }

    #[test]
    fn test_schema_json_en_prompt() {
        let scan = mock_scan_gaming();
        let prompt = build_analysis_prompt_windows(&scan, None, "balanced");
        // El schema JSON debe aparecer completo en el prompt
        assert!(prompt.contains("\"id\""), "Falta campo id en schema");
        assert!(prompt.contains("\"categoria\""), "Falta campo categoria en schema");
        assert!(prompt.contains("\"impacto\""), "Falta campo impacto en schema");
        assert!(prompt.contains("\"riesgo\""), "Falta campo riesgo en schema");
        assert!(prompt.contains("\"aplicar\""), "Falta campo aplicar en schema");
        println!("✓ Schema JSON completo en prompt OK");
    }

    #[test]
    fn test_profile_hints_no_vacios() {
        for p in &["gaming", "streaming", "dev", "server", "balanced", "desconocido"] {
            let hint = profile_hint(p);
            assert!(!hint.is_empty(), "profile_hint('{}') no puede estar vacío", p);
        }
        println!("✓ Todos los profile_hints tienen contenido");
    }

    // ── Tests de red (requieren conexión) ─────────────────────────────────────
    // Ejecutar con: cargo test tests_win -- --nocapture --include-ignored

    #[tokio::test]
    #[ignore = "requiere conexión a internet"]
    async fn test_proxy_responde_sin_timeout() {
        use std::time::Duration;
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .connect_timeout(Duration::from_secs(5))
            .build().unwrap();

        // POST sin body válido → proxy debe responder 400, NO timeout
        let start = std::time::Instant::now();
        let res = client
            .post("https://dix-proxy.dixsystem.workers.dev/v1/messages")
            .header("content-type", "application/json")
            .body("{}")
            .send()
            .await;
        let elapsed = start.elapsed();

        match &res {
            Ok(r)  => println!("✓ Proxy responde en {:.1}s — status HTTP {}", elapsed.as_secs_f32(), r.status()),
            Err(e) if e.is_timeout()  => panic!("✗ TIMEOUT ({:.1}s) — Posible firewall bloqueando la salida", elapsed.as_secs_f32()),
            Err(e) if e.is_connect()  => panic!("✗ ERROR CONEXIÓN — {}", e),
            Err(e) => println!("⚠ Error no crítico en {:.1}s — {}", elapsed.as_secs_f32(), e),
        }
        assert!(res.is_ok(), "No se pudo contactar el proxy");
        assert!(elapsed.as_secs() < 10, "Respuesta tardó {}s (esperado <10s)", elapsed.as_secs());
    }

    #[tokio::test]
    #[ignore = "requiere conexión a internet + consume cuota demo"]
    async fn test_analisis_windows_completo_simulado() {
        let scan = mock_scan_gaming();
        let system = format!(
            "Eres un experto en optimizacion Windows. Respondes SOLO con JSON valido sin markdown.\n{}",
            profile_hint("gaming")
        );
        let user = build_analysis_prompt_windows(&scan, None, "gaming");

        println!("Enviando análisis simulado Windows al proxy...");
        println!("System: {} chars | User: {} chars", system.len(), user.len());

        let start = std::time::Instant::now();
        let result = crate::claude_gateway::call(&system, &user, 4000).await;
        let elapsed = start.elapsed();

        match result {
            Ok(json) => {
                println!("✓ Respuesta en {:.1}s — {} chars", elapsed.as_secs_f32(), json.len());
                let v: serde_json::Value = serde_json::from_str(&json)
                    .expect("Claude devolvió JSON inválido");
                assert!(v["score_actual"].is_number(),   "Falta score_actual");
                assert!(v["score_optimizado"].is_number(),"Falta score_optimizado");
                assert!(v["optimizaciones"].is_array(),   "Falta array optimizaciones");
                let n_opts = v["optimizaciones"].as_array().unwrap().len();
                assert!(n_opts >= 4, "Menos de 4 optimizaciones: {}", n_opts);
                println!("✓ Score: {} → {} | {} optimizaciones",
                    v["score_actual"], v["score_optimizado"], n_opts);
            }
            Err(e) => panic!("✗ Error en análisis Windows: {}", e),
        }
    }
}
