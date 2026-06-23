// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.
//
// Diccionario de cadenas de los componentes en components/ (StepsPanel,
// AnalysisProgress, LiveOptimizingPanel, ScoreRing, LiveTerminal,
// DixKontrolPanel, AtlasConsentBanner...). Separado de app.ts para que se
// pueda completar en paralelo sin tocar el mismo archivo — ver tarea #17.

import type { Dict } from "./index";

export const COMPONENT_STRINGS: Dict = {
  steps_panel_step1_label: { es: "Leyendo métricas del kernel", en: "Reading kernel metrics" },
  steps_panel_step2_label: { es: "Midiendo rendimiento del hardware", en: "Measuring hardware performance" },
  steps_panel_step3_label: { es: "Consultando Claude AI", en: "Consulting Claude AI" },
  steps_panel_step4_label: { es: "Generando script bash", en: "Generating bash script" },
  steps_panel_step4_sublabel: { es: "optimizaciones personalizadas", en: "custom optimizations" },

  analysis_progress_step1_label: { es: "Leyendo métricas del kernel", en: "Reading kernel metrics" },
  analysis_progress_step2_label: { es: "Midiendo rendimiento del hardware", en: "Measuring hardware performance" },
  analysis_progress_step3_label: { es: "Consultando Claude AI", en: "Consulting Claude AI" },
  analysis_progress_step4_label: { es: "Generando script bash", en: "Generating bash script" },
  analysis_progress_step4_detail: { es: "optimizaciones personalizadas", en: "custom optimizations" },
  analysis_progress_header: { es: "● DIX — PROGRESO DEL ANÁLISIS", en: "● DIX — ANALYSIS PROGRESS" },
  analysis_progress_from_cache: { es: "⚡ desde caché", en: "⚡ from cache" },

  live_optimizing_panel_starting_monitor: { es: "Iniciando monitor…", en: "Starting monitor…" },
  live_optimizing_panel_realtime_status: { es: "● ESTADO DEL SISTEMA EN TIEMPO REAL", en: "● REAL-TIME SYSTEM STATUS" },

  live_terminal_header: { es: "● DIX — ANÁLISIS EN VIVO", en: "● DIX — LIVE ANALYSIS" },

  dix_kontrol_panel_title: {
    es: "🛡 DixKontrol — Nivel Moderado (manual, beta interna)",
    en: "🛡 DixKontrol — Moderate Level (manual, internal beta)",
  },
  dix_kontrol_panel_close_button: { es: "Cerrar", en: "Close" },
  dix_kontrol_panel_description: {
    es: "Esto NO reacciona solo todavía a qué app uses — cada paso lo disparas tú. Cambios reversibles únicamente (ver rollback automático). Pide permiso de administrador una sola vez por sesión, no por cada cambio.",
    en: "This does NOT yet react automatically to which app you use — you trigger each step yourself. Reversible changes only (see automatic rollback). It asks for administrator permission once per session, not for every change.",
  },
  dix_kontrol_panel_check_foreground_button: { es: "🔍 Ver app en primer plano", en: "🔍 View foreground app" },
  dix_kontrol_panel_unknown_app: { es: "desconocida", en: "unknown" },
  dix_kontrol_panel_unsupported_environment: { es: "no soportado en este entorno", en: "not supported in this environment" },
  dix_kontrol_panel_start_session_button: { es: "▶ Iniciar sesión Moderado", en: "▶ Start Moderate session" },
  dix_kontrol_panel_session_active: { es: "● Sesión activa", en: "● Session active" },
  dix_kontrol_panel_stop_session_button: { es: "■ Cerrar sesión", en: "■ End session" },
  dix_kontrol_panel_swappiness_label: { es: "vm.swappiness objetivo", en: "target vm.swappiness" },
  dix_kontrol_panel_apply_change_button: { es: "Aplicar cambio", en: "Apply change" },
  dix_kontrol_panel_unsupported_log: {
    es: "No soportado en este entorno (¿Wayland sin XWayland?)",
    en: "Not supported in this environment (Wayland without XWayland?)",
  },

  atlas_consent_banner_title: { es: "🛰 ¿Compartir datos anónimos con DIX Atlas?", en: "🛰 Share anonymous data with DIX Atlas?" },
  atlas_consent_banner_body: {
    es: "Si aceptas, DIX envía de forma anónima tu modelo de CPU/GPU, distro y la mejora de score antes/después de cada análisis, para mejorar las recomendaciones de todos. Nunca se envía hostname, usuario, IP ni rutas de archivos. Puedes cambiarlo cuando quieras. Por defecto está desactivado — si no decides ahora, sigue desactivado.",
    en: "If you accept, DIX anonymously sends your CPU/GPU model, distro, and score improvement before/after each analysis to improve recommendations for everyone. Hostname, user, IP, and file paths are never sent. You can change this whenever you want. It is disabled by default — if you do not decide now, it stays disabled.",
  },
  atlas_consent_banner_accept_button: { es: "Compartir datos anónimos", en: "Share anonymous data" },
  atlas_consent_banner_decline_button: { es: "No, gracias", en: "No, thanks" },
};
