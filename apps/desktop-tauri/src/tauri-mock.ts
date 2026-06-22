// Mock de Tauri para desarrollo en navegador — no se incluye en el build de producción

const mockScan = {
  cpu_governor: "powersave", cpu_cores: 12, swappiness: 60,
  dirty_ratio: 20, dirty_background_ratio: 10, disk_scheduler: "cfq",
  audio_server: "pipewire", hugepages: "always", numa_balancing: "1",
  mem_total_mb: 32768, mem_available_mb: 18000, load_avg: "1.20 0.95 0.88",
  nvme_queue_depth: "64", irqbalance_active: true,
  cpu_min_freq_mhz: 400, cpu_max_freq_mhz: 4800,
  cpu_model: "AMD Ryzen 9 7900X 12-Core Processor",
  gpu_model: "NVIDIA GeForce RTX 4070", distro_id: "Ubuntu", distro_version: "24.04",
  kernel_version: "6.8.0-57-generic",
};

const mockAnalysis = {
  analysis_json: JSON.stringify({
    analisis: "Tu sistema tiene un rendimiento moderado. El governor en powersave limita la velocidad del CPU, y el swappiness de 60 provoca uso innecesario del swap. Con las optimizaciones propuestas puedes ganar hasta 18 puntos.",
    score_actual: 52,
    score_optimizado: 70,
    optimizaciones: [
      { id: "opt1", categoria: "CPU", titulo: "Activar governor performance", descripcion: "Cambia el governor de powersave a performance para máxima velocidad", impacto: 85, riesgo: "bajo", mejora_estimada: "+12% velocidad CPU", aplicar: true, comando_preview: "echo performance | tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor", tiempo_estimado: "< 1s" },
      { id: "opt2", categoria: "RAM", titulo: "Reducir swappiness a 10", descripcion: "El valor actual de 60 provoca que el kernel use swap innecesariamente", impacto: 70, riesgo: "bajo", mejora_estimada: "+8% velocidad RAM", aplicar: true, comando_preview: "/sbin/sysctl -w vm.swappiness=10", tiempo_estimado: "< 1s" },
      { id: "opt3", categoria: "Storage", titulo: "Cambiar scheduler a mq-deadline", descripcion: "cfq no está optimizado para NVMe, mq-deadline da menor latencia", impacto: 60, riesgo: "bajo", mejora_estimada: "-15% latencia disco", aplicar: true, comando_preview: "echo mq-deadline > /sys/block/nvme0n1/queue/scheduler", tiempo_estimado: "< 1s" },
      { id: "opt4", categoria: "RAM", titulo: "Configurar Transparent Hugepages a madvise", descripcion: "El modo always puede causar latencia extra en algunas aplicaciones", impacto: 50, riesgo: "bajo", mejora_estimada: "+5% estabilidad", aplicar: true, comando_preview: "echo madvise > /sys/kernel/mm/transparent_hugepage/enabled", tiempo_estimado: "< 1s" },
      { id: "opt5", categoria: "Sistema", titulo: "Desactivar NUMA balancing", descripcion: "En sistemas con una sola zona NUMA el balanceo genera overhead", impacto: 30, riesgo: "medio", mejora_estimada: "+3% rendimiento", aplicar: false, comando_preview: "/sbin/sysctl -w kernel.numa_balancing=0", tiempo_estimado: "< 1s" },
    ]
  }),
  from_cache: false,
  response_time_ms: 2340,
};

const mockScript = `#!/bin/bash
echo '[Dix] Aplicando optimizaciones de CPU...'
echo performance | tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor > /dev/null || true
echo '[Dix] Optimizando parámetros de RAM...'
/sbin/sysctl -w vm.swappiness=10 || true
/sbin/sysctl -w vm.dirty_ratio=15 || true
echo '[Dix] Configurando scheduler NVMe...'
echo mq-deadline > /sys/block/nvme0n1/queue/scheduler || true
echo '[Dix] Configurando hugepages...'
echo madvise > /sys/kernel/mm/transparent_hugepage/enabled || true
echo '[Dix] Listo.'`;

const mockLiveMetrics = {
  governor: "performance", swappiness: 10, dirty_ratio: 15, dirty_bg: 10,
  hugepages: "madvise", mem_free_mb: 18000, mem_total_mb: 32768,
  load_1: 1.2, load_5: 0.95, nr_requests: 256,
  cpu_freq_mhz: 4200, cpu_max_mhz: 4800,
};

const mockSessions = [
  { id: "1", timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), score_before: 42, score_after: 67, optimizations_applied: ["Activar governor performance", "Reducir swappiness a 10"], scan_summary: "gov:performance swap:10 dirty:15%" },
  { id: "2", timestamp: new Date(Date.now() - 86400000).toISOString(), score_before: 67, score_after: 74, optimizations_applied: ["Cambiar scheduler a mq-deadline", "Configurar Transparent Hugepages"], scan_summary: "gov:performance swap:10 dirty:15%" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function mockInvoke(cmd: string): Promise<any> {
  await new Promise(r => setTimeout(r, 300));
  switch (cmd) {
    case "scan_system":        return mockScan;
    case "analyze_system":     return mockAnalysis;
    case "generate_script":    return mockScript;
    case "execute_script":     return "[Dix] Aplicando optimizaciones...\n[Dix] Listo.";
    case "get_sessions":       return mockSessions;
    case "get_live_metrics":   return mockLiveMetrics;
    case "get_license_status": return false;
    case "get_demo_count":     return 0;
    case "list_rollbacks":     return [];
    case "save_session":       return null;
    case "clear_sessions":     return null;
    default:                   return null;
  }
}

export function installTauriMock() {
  // Inyectar el mock global que usa @tauri-apps/api/core
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__TAURI_INTERNALS__ = {
    invoke: mockInvoke,
    metadata: { currentWindow: { label: "main" } },
    plugins: {},
  };
}
