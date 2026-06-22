// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.

use crate::{benchmark, cache, policy};
use crate::scanner::SystemScan;

// ─── Builder de prompt ────────────────────────────────────────────────────────

pub fn profile_hint(profile: &str) -> &'static str {
    match profile {
        "gaming"    => "PERFIL OBJETIVO: Gaming. Prioriza latencia CPU mínima (plan alto rendimiento, boost máximo), scheduler foreground, TCP sin Nagle, máxima RAM libre. Penaliza optimizaciones que sacrifiquen latencia por throughput.",
        "streaming" => "PERFIL OBJETIVO: Streaming/Contenido. Prioriza throughput de red estable, CPU sin throttling térmico para encoding, I/O disco para grabación, temperatura baja para sesiones largas. Evita cambios que causen micro-stutters.",
        "dev"       => "PERFIL OBJETIVO: Desarrollo. Prioriza velocidad de compilación (CPU máxima en builds), I/O escritura rápida, swappiness muy bajo para no paginar durante builds, inotify alto para file watchers.",
        "server"    => "PERFIL OBJETIVO: Servidor. Prioriza throughput máximo red/disco, estabilidad absoluta, scheduling equitativo para múltiples procesos. NUNCA sacrifiques estabilidad por rendimiento puntual.",
        _           => "PERFIL OBJETIVO: Equilibrado. Optimiza el balance general de rendimiento, estabilidad y consumo energético.",
    }
}

pub fn build_analysis_prompt(scan: &SystemScan, bench: Option<&benchmark::BenchmarkResult>, profile: &str) -> String {
    #[cfg(target_os = "windows")]
    return build_analysis_prompt_windows(scan, bench, profile);
    #[cfg(not(target_os = "windows"))]
    return build_analysis_prompt_linux(scan, bench, profile);
}

#[cfg(not(target_os = "windows"))]
pub fn build_analysis_prompt_linux(scan: &SystemScan, bench: Option<&benchmark::BenchmarkResult>, profile: &str) -> String {
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
pub fn build_analysis_prompt_windows(scan: &SystemScan, bench: Option<&benchmark::BenchmarkResult>, profile: &str) -> String {
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
