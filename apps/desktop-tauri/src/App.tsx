// SPDX-License-Identifier: AGPL-3.0-only
// Copyright © 2026 DixSystem

import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { check as checkUpdate, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import dixIdle from "./assets/dix-idle.png";
import logoDs  from "./assets/logo-dixsystem.png";

import type {
  SystemScan, AnalysisResult, AnalysisResponse, Session,
  RollbackInfo, StartupItem, View, BenchmarkResult, LostOpt, Profile, CacheStats,
} from "./types/dix";
import { C, CAT, PROFILES } from "./constants";
import {
  safeParseJSON, scoreColor, hardwareCeiling, computeScore, defaultSelected,
  kernelScoreFromScan, KERNEL_SCORE_MAX, computeScoreFromBenchmarks,
  mergeBenchmarks, fmtDate,
} from "./utils/score";
import { generateShareCard, downloadDataUrl } from "./utils/shareCard";
import { ScoreRing, AnimatedCounter } from "./components/ScoreRing";
import { LiveTerminal } from "./components/LiveTerminal";
import { StepsPanel } from "./components/StepsPanel";
import { AnalysisProgress } from "./components/AnalysisProgress";
import { LiveOptimizingPanel } from "./components/LiveOptimizingPanel";
import { DixKontrolPanel } from "./components/DixKontrolPanel";
import { AtlasConsentBanner } from "./components/AtlasConsentBanner";
import { ReferralPanel } from "./components/ReferralPanel";
import { ByokSettings } from "./components/ByokSettings";
import { useT } from "./i18n";

// ─── Componente principal ─────────────────────────────────────────────────────

export default function App() {
  const { lang, setLang, t } = useT();
  const [view, setView]               = useState<View>("init");
  const [scan, setScan]                 = useState<SystemScan | null>(null);
  const [analysis, setAnalysis]         = useState<AnalysisResult | null>(null);
  const [fromCache, setFromCache]       = useState(false);
  const [responseMs, setResponseMs]     = useState(0);
  const [script, setScript]             = useState("");
  const [maintenanceScript, setMaintenanceScript] = useState<string | null>(null);
  // IDs de optimizaciones que de verdad se van a aplicar — la IA solo
  // propone, el usuario confirma (riesgo medio/alto empieza desmarcado).
  const [selectedOpts, setSelectedOpts] = useState<Set<string>>(new Set());
  const [regeneratingScript, setRegeneratingScript] = useState(false);
  const [diskMaintenanceStatus, setDiskMaintenanceStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [scriptVisible, setScriptVisible] = useState(false);
  const [applyLog, setApplyLog]         = useState("");
  const [error, setError]               = useState<string | null>(null);
  const [sessions, setSessions]         = useState<Session[]>([]);
  const [showReboot, setShowReboot]     = useState(false);
  const [rebootCountdown, setRebootCountdown] = useState<number | null>(null);
  // Score real verificado tras aplicar (re-midiendo con benchmarks frescos), distinto
  // de analysis.score_optimizado que es solo la proyección de la IA antes de aplicar.
  const [verifiedScoreAfter, setVerifiedScoreAfter] = useState<number | null>(null);
  const [verifyingScore, setVerifyingScore] = useState(false);
  const [rollbacks, setRollbacks]       = useState<RollbackInfo[]>([]);
  const [showRollbacks, setShowRollbacks] = useState(false);
  const [showStartupPanel, setShowStartupPanel] = useState(false);
  const [showDixKontrol, setShowDixKontrol] = useState(false);
  const [showByok, setShowByok] = useState(false);
  const [startupItems, setStartupItems] = useState<StartupItem[]>([]);
  const [startupLoading, setStartupLoading] = useState(false);
  const [startupToDisable, setStartupToDisable] = useState<Set<string>>(new Set());
  const [startupApplying, setStartupApplying] = useState(false);
  const [startupResult, setStartupResult] = useState<string | null>(null);
  const [rollingBack, setRollingBack]   = useState(false);
  const [scanStep, setScanStep]         = useState(0);
  const [revealedMetrics, setRevealedMetrics] = useState(0);
  const [profile, setProfile] = useState<Profile>(() => (localStorage.getItem("dix_profile") as Profile) ?? "balanced");
  const scanRef      = useRef<SystemScan | null>(null);
  const startTimeRef = useRef<number>(0);
  const [elapsed, setElapsed] = useState(0);
  const [isLicensed, setIsLicensed]     = useState(false);
  const [demoCount, setDemoCount]       = useState(0);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [licenseInput, setLicenseInput] = useState("");
  const [activatingLicense, setActivatingLicense] = useState(false);
  const [pendingUpdate, setPendingUpdate]   = useState<Update | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateTotal, setUpdateTotal]       = useState(0);
  const [updateState, setUpdateState]       = useState<"idle" | "downloading" | "done">("idle");
  const [hwSummary, setHwSummary] = useState<{ cpu: string; ram: string; distro: string } | null>(null);
  const [idleScan, setIdleScan]   = useState<SystemScan | null>(null);
  const [shareCardUrl, setShareCardUrl] = useState<string | null>(null);
  const [benchmarks, setBenchmarks] = useState<BenchmarkResult | null>(null);
  // Score calculado en local (determinista, sin red) en cuanto terminan los
  // benchmarks — se muestra al instante, sin esperar la respuesta de Claude.
  // Claude solo aporta la lista de sugerencias y la explicación en texto.
  const [instantScore, setInstantScore] = useState<number | null>(null);
  // Capacidades que el backend ya calculaba pero nunca se mostraban:
  // ajustes "recordados" para este PC y nivel de confianza por caché.
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [lostOpts, setLostOpts]     = useState<LostOpt[]>([]);
  // Confirmación tras un reinicio programado por Dix: "ok" = todo se aplicó y
  // sigue activo, "lost" = se detectó alguna pérdida (ver lostOpts). null = no
  // venimos de un reinicio pendiente, no hay nada que confirmar.
  const [postRebootStatus, setPostRebootStatus] = useState<"ok" | "lost" | null>(null);
  const [postRebootChecking, setPostRebootChecking] = useState(false);
  const [reapplying, setReapplying] = useState(false);
  const [tier, setTier]             = useState<string>("pro");
  const isOdyssey = tier === "odyssey";

  // Mostrar todas las métricas inmediatamente cuando llegan
  useEffect(() => {
    if (!scan) { setRevealedMetrics(0); return; }
    setRevealedMetrics(Object.keys(scan).length);
  }, [scan]);

  useEffect(() => {
    // Si Dix programó un reinicio en la sesión anterior, esta es la relanzada
    // automáticamente por el RunOnce que registra reboot_system — confirmar
    // al usuario que las optimizaciones se aplicaron y siguen activas, en vez
    // de dejarlo en una pantalla idle sin ninguna señal.
    const wasPendingReboot = localStorage.getItem("dix_needs_reboot") === "1";

    Promise.all([
      invoke<boolean>("get_license_status").catch(() => false),
      invoke<number>("get_demo_count").catch(() => 0),
      invoke<string>("get_tier").catch(() => "pro"),
    ]).then(([licensed, demo, t]) => {
      setIsLicensed(licensed);
      setDemoCount(demo);
      setTier(t);
      invoke<Session[]>("get_sessions").then(setSessions).catch(() => {});
      invoke<RollbackInfo[]>("list_rollbacks").then(setRollbacks).catch(() => {});
      setView("idle");
      // Scan de hardware en background para mostrar info real en idle
      invoke<SystemScan>("scan_system").then((s) => {
        const ramGb = Math.round((s.mem_total_mb + 512) / 1024);
        setHwSummary({
          cpu: s.cpu_model || "",
          ram: `${ramGb} GB RAM`,
          distro: s.distro_id ? `${s.distro_id} ${s.distro_version}`.trim() : "",
        });
        setIdleScan(s);

        // Verificar optimizaciones perdidas tras reinicio. Justo después de un
        // arranque en frío (relanzado por el RunOnce) el sistema todavía se
        // está "asentando" — servicios como SysMain pueden seguir iniciando y
        // las políticas de grupo pueden no haber terminado de aplicarse — así
        // que un scan inmediato puede leer valores transitorios y disparar
        // falsos positivos de "optimización perdida". Si venimos de un
        // reinicio programado por Dix, se espera y se repite el scan antes de
        // comparar; en una apertura normal no hay que esperar nada.
        const runPostRebootCheck = (scanForCheck: SystemScan) =>
          invoke<LostOpt[]>("check_post_reboot", { scanJson: JSON.stringify(scanForCheck) })
            .then((lost) => {
              if (lost.length > 0) setLostOpts(lost);
              if (wasPendingReboot) {
                localStorage.removeItem("dix_needs_reboot");
                setPostRebootStatus(lost.length > 0 ? "lost" : "ok");
                setPostRebootChecking(false);
              }
            })
            .catch(() => setPostRebootChecking(false));

        if (wasPendingReboot) {
          setPostRebootChecking(true);
          setTimeout(() => {
            invoke<SystemScan>("scan_system").then(runPostRebootCheck).catch(() => setPostRebootChecking(false));
          }, 12000);
        } else {
          runPostRebootCheck(s);
        }
      }).catch(() => {});
    }).catch(() => { setView("idle"); });

    checkUpdate()
      .then((update) => { if (update) setPendingUpdate(update); })
      .catch(() => {});
  }, []);

  // Temporizador de análisis — arranca en scanning, para en results/done
  useEffect(() => {
    if (view === "scanning") {
      startTimeRef.current = Date.now();
      setElapsed(0);
      const id = setInterval(() => {
        setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
      return () => clearInterval(id);
    }
  }, [view]);



  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleStart = async () => {
    setError(null); setScanStep(0); setRevealedMetrics(0);
    setView("scanning");
    setScan(null); setAnalysis(null); setScript(""); setFromCache(false);
    setBenchmarks(null); setVerifiedScoreAfter(null); setInstantScore(null);
    try {
      setScanStep(1);
      const scanResult = await invoke<SystemScan>("scan_system");
      setScan(scanResult); scanRef.current = scanResult;

      // Paso 2: benchmarks en paralelo internamente (~8-10s)
      setScanStep(2);
      const bench = await invoke<BenchmarkResult>("run_benchmarks", {
        scanJson: JSON.stringify(scanResult),
      });
      setBenchmarks(bench);
      // Score visible al instante: cálculo local determinista, sin esperar
      // a Claude. La IA solo aporta después la lista de sugerencias.
      setInstantScore(computeScoreFromBenchmarks(scanResult, bench));

      setScanStep(3);
      const resp = await invoke<AnalysisResponse>("analyze_system", {
        scanJson: JSON.stringify(scanResult),
        benchJson: JSON.stringify(bench),
        profile,
      });
      const parsed = safeParseJSON<AnalysisResult>(resp.analysis_json);
      // Score "antes" calculado desde benchmarks reales (no la cifra de Claude).
      // El "objetivo" YA NO usa el delta libre que proponía la IA (prometía
      // mejoras que sus propias sugerencias de categoría "Sistema"/"Red" no
      // pueden mover, porque esos puntos no entran en la fórmula del score) —
      // en su lugar se proyecta solo el margen real y garantizado: lo que le
      // falta al apartado "parámetros del kernel" para llegar a su máximo,
      // que es exactamente lo que el catálogo determinista va a dejar fijo al
      // aplicar. Resultado: lo que se promete antes de aplicar es alcanzable
      // de verdad, no una expectativa que el "verificado" luego desmiente.
      const ceiling = hardwareCeiling(scanResult);
      parsed.score_actual = computeScoreFromBenchmarks(scanResult, bench);
      const guaranteedDelta = Math.max(0, KERNEL_SCORE_MAX - kernelScoreFromScan(scanResult));
      parsed.score_optimizado = Math.min(ceiling, parsed.score_actual + guaranteedDelta);
      setAnalysis(parsed); setFromCache(resp.from_cache); setResponseMs(resp.response_time_ms);
      invoke<CacheStats>("get_cache_stats").then(setCacheStats).catch(() => {});

      setScanStep(4);
      const initialIds = new Set(parsed.optimizaciones.filter(defaultSelected).map((o) => o.id));
      setSelectedOpts(initialIds);
      const selected = parsed.optimizaciones
        .filter((o) => initialIds.has(o.id))
        .map((o) => ({ titulo: o.titulo, descripcion: o.descripcion, comando_preview: o.comando_preview }));
      const generated = await invoke<{ script: string; maintenance_script: string | null }>("generate_script", {
        optimizationsJson: JSON.stringify(selected),
        scanJson: JSON.stringify(scanResult),
        profile,
      });
      setScript(generated.script);
      setMaintenanceScript(generated.maintenance_script);
      setScanStep(5);
      await new Promise(r => setTimeout(r, 450));
      setView("results");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "DEMO_LIMIT_REACHED") {
        setShowDemoModal(true); setView("idle"); return;
      }
      if (msg === "SERVICE_UNAVAILABLE") {
        setError("El servicio de análisis IA no está disponible ahora mismo. Inténtalo de nuevo en unos minutos."); setView("idle"); return;
      }
      setError(msg); setView("idle");
    }
    invoke<number>("get_demo_count").then(setDemoCount).catch(() => {});
    invoke<boolean>("get_license_status").then(setIsLicensed).catch(() => {});
  };

  const toggleOptimization = async (id: string) => {
    if (!analysis || !scanRef.current || regeneratingScript) return;
    const next = new Set(selectedOpts);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedOpts(next);
    setRegeneratingScript(true);
    try {
      const selected = analysis.optimizaciones
        .filter((o) => next.has(o.id))
        .map((o) => ({ titulo: o.titulo, descripcion: o.descripcion, comando_preview: o.comando_preview }));
      const generated = await invoke<{ script: string; maintenance_script: string | null }>("generate_script", {
        optimizationsJson: JSON.stringify(selected),
        scanJson: JSON.stringify(scanRef.current),
        profile,
      });
      setScript(generated.script);
      setMaintenanceScript(generated.maintenance_script);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRegeneratingScript(false);
    }
  };

  const handleApply = async () => {
    if (!scanRef.current) return;
    setView("applying");
    try {
      const output = await invoke<string>("execute_script", {
        scriptContent: script,
        scanJson: JSON.stringify(scanRef.current),
      });
      setApplyLog(output || t("apply_success_log"));

      // Mantenimiento de disco lento (p.ej. Optimize-Volume en HDD): se lanza
      // aparte, sin esperar a que termine, porque puede tardar hasta 30 min y
      // no debe bloquear la pantalla "done". Su resultado solo actualiza un
      // estado informativo no bloqueante.
      if (maintenanceScript) {
        setDiskMaintenanceStatus("running");
        invoke<string>("execute_maintenance_script", { scriptContent: maintenanceScript })
          .then(() => setDiskMaintenanceStatus("done"))
          .catch(() => setDiskMaintenanceStatus("error"));
      }
      if (analysis && scanRef.current) {
        const postScan = await invoke<SystemScan>("scan_system").catch(() => scanRef.current!);

        // Guardar estado aplicado para verificación post-reinicio
        invoke("save_applied_state", { scanJson: JSON.stringify(postScan) }).catch(() => {});

        // Re-medir de verdad las categorías afectadas ANTES de calcular el score
        // final — usar los benchmarks de ANTES de aplicar daría un número
        // desactualizado, no el real. Esto es lo que distingue "estimado" de
        // "verificado": el verificado siempre viene de una medición fresca.
        const affectedCats = [...new Set(
          analysis.optimizaciones.filter((o) => selectedOpts.has(o.id)).map((o) => o.categoria)
        )];
        let finalBench = benchmarks;
        if (affectedCats.length > 0) {
          setVerifyingScore(true);
          const fresh = await invoke<BenchmarkResult>("run_benchmarks_partial", {
            scanJson: JSON.stringify(postScan),
            categoriesJson: JSON.stringify(affectedCats),
          }).catch(() => null);
          if (fresh) {
            finalBench = mergeBenchmarks(benchmarks, fresh, affectedCats);
            setBenchmarks(finalBench);
          }
          setVerifyingScore(false);
        }

        const realScoreAfter = finalBench
          ? computeScoreFromBenchmarks(postScan, finalBench)
          : computeScore(postScan);
        setVerifiedScoreAfter(realScoreAfter);

        const sess: Session = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          score_before: analysis.score_actual,
          score_after: realScoreAfter,
          optimizations_applied: analysis.optimizaciones.filter((o) => selectedOpts.has(o.id)).map((o) => o.titulo),
          scan_summary: `gov:${postScan.cpu_governor} swap:${postScan.swappiness} dirty:${postScan.dirty_ratio}%`,
        };
        await invoke("save_session", { session: sess }).catch(() => {});
        const updated = await invoke<Session[]>("get_sessions").catch(() => sessions);
        setSessions(updated);
        const rb = await invoke<RollbackInfo[]>("list_rollbacks").catch(() => rollbacks);
        setRollbacks(rb);
      }
      setView("done"); setShowReboot(true);
      localStorage.setItem("dix_needs_reboot", "1");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setView("results");
    }
  };

  const handleReapply = async () => {
    setReapplying(true); setError(null);
    try {
      await invoke<string>("reapply_lost_opts", { lostJson: JSON.stringify(lostOpts) });
      // Re-escanear y volver a verificar
      const newScan = await invoke<SystemScan>("scan_system");
      const stillLost = await invoke<LostOpt[]>("check_post_reboot", { scanJson: JSON.stringify(newScan) })
        .catch(() => [] as LostOpt[]);
      setLostOpts(stillLost);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setReapplying(false); }
  };

  const handleRollback = async (filename: string) => {
    setRollingBack(true); setError(null);
    try {
      await invoke("execute_rollback", { filename });
      alert(t("rollback_success_alert"));
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setRollingBack(false); }
  };

  const loadStartupItems = async () => {
    setStartupLoading(true); setStartupResult(null);
    try {
      const items = await invoke<StartupItem[]>("list_startup_items");
      setStartupItems(items);
      // Preselecciona solo lo "Seguro" y las entradas huérfanas — nunca lo "Revisar"
      const preselected = new Set(
        items.filter((i) => i.trust === "Safe" || i.trust === "Orphan").map((i) => i.id)
      );
      setStartupToDisable(preselected);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setStartupLoading(false); }
  };

  const toggleStartupSelection = (id: string) => {
    setStartupToDisable((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleApplyStartupChanges = async () => {
    setStartupApplying(true); setError(null);
    try {
      const ids = Array.from(startupToDisable);
      for (const id of ids) {
        await invoke("set_startup_item_enabled", { id, enabled: false });
      }
      setStartupResult(`${ids.length} programa${ids.length === 1 ? "" : "s"} de inicio desactivado${ids.length === 1 ? "" : "s"}. Se notará en el próximo arranque.`);
      await loadStartupItems();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setStartupApplying(false); }
  };

  const handleUndoStartupItem = async (item: StartupItem) => {
    try {
      await invoke("set_startup_item_enabled", { id: item.id, enabled: true });
      await loadStartupItems();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const handleDownload = () => {
    const blob = new Blob([script], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "dix_boost.sh"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleInstallUpdate = async () => {
    if (!pendingUpdate) return;
    setUpdateState("downloading"); setUpdateProgress(0);
    try {
      await pendingUpdate.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data.contentLength) {
          setUpdateTotal(event.data.contentLength);
        } else if (event.event === "Progress") {
          setUpdateProgress((p) => p + (event.data.chunkLength ?? 0));
        } else if (event.event === "Finished") {
          setUpdateState("done");
        }
      });
      setUpdateState("done");
      await relaunch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setUpdateState("idle"); setShowUpdateModal(false);
    }
  };

  const handleActivateLicense = async () => {
    setActivatingLicense(true); setError(null);
    try {
      await invoke("activate_license", { key: licenseInput.trim() });
      setIsLicensed(true); setLicenseInput("");
      setShowDemoModal(false); setView("idle");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setActivatingLicense(false); }
  };

  const handleReset = () => {
    setView("idle"); setAnalysis(null); setScript(""); setScan(null);
    setApplyLog(""); setError(null); setScriptVisible(false);
    setShowReboot(false); setFromCache(false); setScanStep(0);
    setRevealedMetrics(0); scanRef.current = null; setBenchmarks(null);
  };

  const handleReboot = async () => {
    try {
      await invoke("reboot_system");
      setShowReboot(false);
      setRebootCountdown(60);
      // "dix_needs_reboot" se deja puesto a propósito: el reinicio va a ocurrir
      // de verdad ahora, y Dix se relanzará solo (RunOnce) para confirmar que
      // las optimizaciones siguen activas. Se limpia tras esa verificación.
    }
    catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const handleCancelReboot = async () => {
    try {
      await invoke("cancel_reboot");
      setRebootCountdown(null);
    }
    catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
  };

  // Cuenta atrás visible tras pedir el reinicio — sin esto, el usuario no
  // tiene ninguna señal de que Windows va a reiniciar y parece que DIX se
  // quedó colgado durante el minuto de margen que da "shutdown /t 60".
  useEffect(() => {
    if (rebootCountdown === null) return;
    if (rebootCountdown <= 0) return;
    const id = setTimeout(() => setRebootCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(id);
  }, [rebootCountdown]);

  const aplicadas = analysis?.optimizaciones.filter((o) => selectedOpts.has(o.id)) ?? [];
  const saltadas  = analysis?.optimizaciones.filter((o) => !selectedOpts.has(o.id)) ?? [];
  const mejora    = analysis ? analysis.score_optimizado - analysis.score_actual : 0;

  const isProcessView = view === "scanning" || view === "applying" || view === "done";

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.bg}; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${C.card}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        .card { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 12px; }
        .btn-primary {
          background: ${C.orange}; color: #fff; border: none; border-radius: 10px;
          padding: 12px 32px; font-size: 15px; font-weight: 700; cursor: pointer;
          letter-spacing: 0.3px;
        }
        .btn-primary:hover { background: ${C.orangeD}; }
        .btn-secondary {
          background: transparent; color: ${C.muted}; border: 1px solid ${C.border};
          border-radius: 8px; padding: 7px 16px; font-size: 13px; cursor: pointer;
        }
        .btn-secondary:hover { border-color: ${C.orange}; color: ${C.text}; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: `${C.bg}ee`, backdropFilter: "blur(8px)", zIndex: 100, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src={logoDs} alt="DixSystem" style={{ width: 28, height: 28, borderRadius: 4 }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.3px" }}>Dix</div>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.5px", textTransform: "uppercase" }}>{t("header_tagline")}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", border: `1px solid ${C.border}`, borderRadius: 4, overflow: "hidden" }}>
            {(["es", "en"] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)}
                style={{
                  fontSize: 10, fontWeight: 700, padding: "3px 7px", border: "none", cursor: "pointer",
                  background: lang === l ? C.orange : "transparent",
                  color: lang === l ? "#fff" : C.muted,
                }}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          {pendingUpdate && (
            <button onClick={() => setShowUpdateModal(true)}
              style={{ background: `${C.green}18`, color: C.green, border: `1px solid ${C.green}55`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
              ↑ v{pendingUpdate.version} {t("header_update_available")}
            </button>
          )}
          {rollbacks.length > 0 && view === "idle" && (
            <button className="btn-secondary" onClick={() => setShowRollbacks(!showRollbacks)} style={{ fontSize: 12 }}>
              ↩ Rollbacks ({rollbacks.length})
            </button>
          )}
          {view === "idle" && (
            <button className="btn-secondary" onClick={() => { setShowStartupPanel(!showStartupPanel); if (!showStartupPanel) loadStartupItems(); }} style={{ fontSize: 12 }}>
              {t("nav_startup_items")}
            </button>
          )}
          {view === "idle" && (
            <button className="btn-secondary" onClick={() => setShowDixKontrol(!showDixKontrol)} style={{ fontSize: 12 }}>
              {t("nav_dixkontrol")}
            </button>
          )}
          {view === "idle" && (
            <button className="btn-secondary" onClick={() => setShowByok(!showByok)} style={{ fontSize: 12 }}>
              Mi API Key
            </button>
          )}
          <span style={{ fontSize: 11, color: C.border, padding: "2px 8px", border: `1px solid ${C.border}`, borderRadius: 4 }}>v2.0</span>
          {isLicensed ? (
            isOdyssey ? (
              <span style={{ fontSize: 11, color: "#FFD700", padding: "2px 10px", border: "1px solid #FFD70066", borderRadius: 4, fontWeight: 800, letterSpacing: "1px", background: "#FFD70010" }}>
                ✦ ODYSSEY
              </span>
            ) : (
              <span style={{ fontSize: 11, color: C.green, padding: "2px 8px", border: `1px solid ${C.green}55`, borderRadius: 4, fontWeight: 700, letterSpacing: "0.5px" }}>✓ PRO</span>
            )
          ) : (
            <button className="btn-secondary" onClick={() => setView("activate")}
              style={{ fontSize: 11, color: C.orange, borderColor: `${C.orange}55`, fontWeight: 600 }}>
              {demoCount >= 3 ? t("header_demo_exhausted") : t("header_demo_remaining").replace("{n}", String(3 - demoCount))}
            </button>
          )}
        </div>
      </div>

      {/* ── Cuenta atrás de reinicio — visible en cualquier vista ── */}
      {rebootCountdown !== null && (
        <div style={{
          position: "sticky", top: 0, zIndex: 200,
          background: rebootCountdown > 0 ? "#3a1a0a" : "#1a2e10",
          border: `1px solid ${rebootCountdown > 0 ? C.red : C.green}55`,
          padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "center", gap: 16,
        }}>
          <span style={{ fontSize: 13, color: rebootCountdown > 0 ? "#fca5a5" : C.green, fontWeight: 600 }}>
            {rebootCountdown > 0
              ? `🔄 Windows se reiniciará en ${rebootCountdown}s para terminar de aplicar los cambios — guarda tu trabajo`
              : t("reboot_countdown_restarting")}
          </span>
          {rebootCountdown > 0 && (
            <button className="btn-secondary" onClick={handleCancelReboot} style={{ fontSize: 12 }}>
              {t("reboot_countdown_cancel")}
            </button>
          )}
        </div>
      )}

      {/* ── Layout principal ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ════ VISTA DE PROCESO (scanning / applying / done) — layout split ════ */}
        {isProcessView && (
          <div className="fade-in" style={{ flex: 1, display: "flex", gap: 0, overflow: "hidden" }}>

            {/* Panel izquierdo — Análisis en tiempo real + valores del sistema */}
            <div style={{
              width: "44%",
              display: "flex",
              flexDirection: "column",
              background: "#0a0d12",
              borderRight: `1px solid ${C.border}`,
              flexShrink: 0,
              overflow: "hidden",
            }}>
              {/* Mitad superior: progreso del análisis */}
              <div style={{ flexShrink: 0 }}>
                <AnalysisProgress
                  scanStep={scanStep}
                  elapsed={elapsed}
                  fromCache={fromCache}
                  responseMs={responseMs}
                  profile={profile}
                />
              </div>

              {/* Score instantáneo — calculado en local, no depende de Claude */}
              {view === "scanning" && instantScore !== null && scanStep >= 2 && (
                <div style={{ borderTop: `1px solid ${C.border}`, padding: "10px 14px", display: "flex", justifyContent: "center" }}>
                  <ScoreRing score={instantScore} label={t("process_instant_score_label")} size={84} />
                </div>
              )}

              {/* Score antes/después + botón compartir cuando está en done */}
              {view === "done" && analysis && (
                <div style={{ borderTop: `1px solid ${C.border}`, padding: "10px 14px" }}>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "center" }}>
                    <ScoreRing score={analysis.score_actual} label={t("process_before_label")} size={72} />
                    <div style={{ fontSize: 22, color: C.muted }}>→</div>
                    <ScoreRing
                      score={verifyingScore ? analysis.score_optimizado : (verifiedScoreAfter ?? analysis.score_optimizado)}
                      label={verifyingScore ? t("process_measuring_label") : verifiedScoreAfter !== null ? t("process_verified_label") : t("process_estimated_label")}
                      size={72}
                    />
                  </div>
                  <p style={{ textAlign: "center", fontSize: 10, color: C.muted, marginTop: 6 }}>
                    {verifiedScoreAfter !== null
                      ? t("process_verified_score_note")
                      : t("process_estimated_score_note")}
                  </p>
                  {scan && (
                    <button
                      onClick={() => {
                        generateShareCard(
                          analysis.score_actual,
                          verifiedScoreAfter ?? analysis.score_optimizado,
                          scan.cpu_model,
                          scan.mem_total_mb,
                          scan.distro_id,
                          scan.distro_version,
                          dixIdle,
                        ).then(setShareCardUrl);
                      }}
                      style={{
                        marginTop: 10, width: "100%",
                        background: `linear-gradient(135deg, ${C.orange}, #ff8533)`,
                        color: "#fff", border: "none", borderRadius: 8,
                        padding: "8px 0", fontSize: 12, fontWeight: 800,
                        cursor: "pointer", letterSpacing: "0.5px",
                        boxShadow: `0 2px 12px ${C.orange}55`,
                      }}
                    >
                      {t("process_share_score_button")}
                    </button>
                  )}
                </div>
              )}

              {/* Mitad inferior: valores del kernel en vivo — polling cada 1s */}
              <LiveOptimizingPanel active={isProcessView} />
            </div>

            {/* Panel derecho — análisis en tiempo real */}
            <div style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "16px 20px 16px 16px",
              gap: 12,
              overflow: "hidden",
            }}>
              {/* Pasos del proceso */}
              {view === "scanning" && <StepsPanel scanStep={scanStep} />}

              {/* Banner de completado */}
              {view === "done" && (
                <div style={{
                  padding: "12px 16px", borderRadius: 10, flexShrink: 0,
                  background: `${C.green}12`, border: `1px solid ${C.green}55`,
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  <span style={{ fontSize: 24, color: C.green }}>✓</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.green }}>{t("done_banner_title")}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{t("done_banner_subtitle")}</div>
                  </div>
                </div>
              )}

              {view === "done" && diskMaintenanceStatus !== "idle" && (
                <div style={{
                  padding: "10px 16px", borderRadius: 10, flexShrink: 0,
                  background: diskMaintenanceStatus === "error" ? `${C.orange}12` : `${C.orange}0a`,
                  border: `1px solid ${C.orange}44`,
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  <span style={{ fontSize: 18 }}>
                    {diskMaintenanceStatus === "running" ? "⏳" : diskMaintenanceStatus === "done" ? "✓" : "⚠"}
                  </span>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    {diskMaintenanceStatus === "running" &&
                      t("disk_maintenance_running")}
                    {diskMaintenanceStatus === "done" && t("disk_maintenance_done")}
                    {diskMaintenanceStatus === "error" && t("disk_maintenance_error")}
                  </div>
                </div>
              )}

              {/* Cabecera del panel de datos */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "7px 12px",
                background: "#010409",
                border: `1px solid ${C.border}`,
                borderRadius: "8px 8px 0 0",
                borderBottom: "none",
                flexShrink: 0,
              }}>
                <div style={{ display: "flex", gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f85149" }} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FFD700" }} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#00FF88" }} />
                </div>
                <span style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", marginLeft: 4 }}>
                  {t("process_live_analysis_title")}
                </span>
                {scan && (
                  <span style={{ marginLeft: "auto", fontSize: 10, color: C.green, fontFamily: "monospace" }}>
                    {revealedMetrics}/{Object.keys(scan).length} métricas
                  </span>
                )}
              </div>

              {/* Terminal de métricas */}
              <LiveTerminal
                scan={scan as Record<string, unknown> | null}
                revealedCount={revealedMetrics}
                analysisText={view === "scanning" && analysis ? analysis.analisis : undefined}
              />

              {/* Panel de log al aplicar */}
              {view === "applying" && (
                <div style={{ background: `${C.orange}0a`, border: `1px solid ${C.orange}44`, borderRadius: 8, padding: "12px 14px", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.orange }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.orange }}>{t("applying_panel_title")}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
                    {t("applying_panel_body")}<br/>
                    <span style={{ color: C.text }}>{t("applying_panel_hint")}</span>
                  </div>
                </div>
              )}

              {/* Acciones en done */}
              {view === "done" && (
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {applyLog && (
                    <pre style={{
                      background: "#010409", border: `1px solid ${C.green}33`,
                      borderRadius: 8, padding: "10px 14px", fontSize: 10, fontFamily: "monospace",
                      color: C.green, maxHeight: 120, overflowY: "auto", lineHeight: 1.7,
                    }}>
                      {applyLog}
                    </pre>
                  )}
                  {showReboot && (
                    <div className="card" style={{ padding: "12px 14px", border: `1px solid ${C.yellow}44` }}>
                      <p style={{ fontSize: 12, color: "#fbbf24", marginBottom: 10 }}>
                        {t("done_reboot_recommended")}
                      </p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn-primary" onClick={handleReboot}
                          style={{ background: C.red, padding: "7px 18px", fontSize: 13 }}>
                          {t("reboot_now_button")}
                        </button>
                        <button className="btn-secondary" onClick={() => { setShowReboot(false); localStorage.removeItem("dix_needs_reboot"); }} style={{ fontSize: 12 }}>{t("later_button")}</button>
                      </div>
                    </div>
                  )}
                  <button className="btn-primary" onClick={handleReset} style={{ alignSelf: "flex-start", padding: "9px 22px", fontSize: 13 }}>
                    {t("new_analysis_button")}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════ VISTAS NORMALES (scroll) ════ */}
        {!isProcessView && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <div style={{ maxWidth: 820, margin: "0 auto", padding: "24px 20px 60px" }}>

              {/* Error banner */}
              {error && (
                <div style={{ background: "#2d0f0f", border: `1px solid ${C.red}44`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: C.red, fontSize: 13, display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span><strong>{t("error_label")}:</strong> {error}</span>
                  <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.red, fontSize: 16 }}>✕</button>
                </div>
              )}

              {/* ── INIT ── */}
              {view === "init" && (
                <div style={{ textAlign: "center", padding: "4rem", color: C.muted, fontSize: 14 }}>
                  <div style={{ fontSize: 28, display: "inline-block" }}>⚙</div>
                </div>
              )}

              {/* ── IDLE ── */}
              {view === "idle" && (
                <div className="fade-in">

                  <AtlasConsentBanner />

                  <ReferralPanel />

                  {/* Esperando a que el sistema se asiente tras un arranque en frío
                      antes de comparar — evita falsos positivos de "se perdió" por
                      servicios que todavía están iniciando. */}
                  {postRebootChecking && (
                    <div style={{
                      marginBottom: 14, padding: "12px 16px", borderRadius: 10,
                      background: "#0d1117", border: `1px solid ${C.border}`,
                      display: "flex", alignItems: "center", gap: 12,
                    }}>
                      <span style={{ fontSize: 16 }}>⏳</span>
                      <div style={{ fontSize: 12, color: C.muted }}>
                        {t("idle_post_reboot_checking")}
                      </div>
                    </div>
                  )}

                  {/* Confirmación tras el reinicio que Dix programó */}
                  {postRebootStatus === "ok" && (
                    <div style={{
                      marginBottom: 14, padding: "12px 16px", borderRadius: 10,
                      background: `${C.green}12`, border: `1px solid ${C.green}55`,
                      display: "flex", alignItems: "center", gap: 12,
                    }}>
                      <span style={{ fontSize: 18, color: C.green }}>✓</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{t("idle_post_reboot_ok_title")}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{t("idle_post_reboot_ok_body")}</div>
                      </div>
                      <button onClick={() => setPostRebootStatus(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 14 }}>✕</button>
                    </div>
                  )}

                  {/* Banner de reinicio pendiente */}
                  {showReboot && (
                    <div style={{
                      marginBottom: 14, padding: "12px 16px", borderRadius: 10,
                      background: "#1a1208", border: `1px solid ${C.yellow}55`,
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 18 }}>⚠️</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>{t("idle_reboot_pending_title")}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{t("idle_reboot_pending_body")}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button className="btn-primary" onClick={handleReboot}
                          style={{ background: C.red, padding: "7px 16px", fontSize: 12 }}>
                          {t("reboot_now_button")}
                        </button>
                        <button className="btn-secondary" onClick={() => { setShowReboot(false); localStorage.removeItem("dix_needs_reboot"); }} style={{ fontSize: 12 }}>
                          {t("ignore_button")}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Banner post-reinicio — optimizaciones perdidas */}
                  {lostOpts.length > 0 && (
                    <div style={{
                      marginBottom: 14, padding: "12px 16px", borderRadius: 10,
                      background: "#1a0e04", border: `1px solid ${C.orange}55`,
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 16 }}>🔄</span>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.orange }}>
                              {lostOpts.length} optimización{lostOpts.length > 1 ? "es" : ""} se perdió{lostOpts.length > 1 ? "ron" : ""} tras el reinicio
                            </div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8 }}>
                            {lostOpts.map((o) => (
                              <div key={o.key} style={{ fontSize: 11, color: C.muted, display: "flex", gap: 6 }}>
                                <span style={{ color: C.orange }}>·</span>
                                <span><strong style={{ color: C.text }}>{o.label}</strong>: era {o.expected}, ahora {o.current}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              className="btn-primary"
                              onClick={handleReapply}
                              disabled={reapplying}
                              style={{ padding: "7px 18px", fontSize: 12 }}
                            >
                              {reapplying ? t("lost_opts_reapplying") : t("lost_opts_reapply_now")}
                            </button>
                            <button className="btn-secondary" onClick={() => setLostOpts([])} style={{ fontSize: 12 }}>
                              {t("ignore_button")}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Rollbacks */}
                  {showRollbacks && rollbacks.length > 0 && (
                    <div className="card" style={{ marginBottom: 16, overflow: "hidden" }}>
                      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>{t("rollbacks_title")}</span>
                        <button className="btn-secondary" onClick={() => setShowRollbacks(false)} style={{ fontSize: 11 }}>{t("close_button")}</button>
                      </div>
                      {rollbacks.map((rb) => (
                        <div key={rb.filename} style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{rb.date_human}</div>
                            <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>{rb.filename}</div>
                          </div>
                          <button className="btn-secondary" onClick={() => handleRollback(rb.filename)} disabled={rollingBack} style={{ fontSize: 12, color: C.orange, borderColor: `${C.orange}55` }}>
                            {rollingBack ? t("rollbacks_restoring") : t("rollbacks_restore")}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* DixKontrol — nivel Moderado (manual) */}
                  {showDixKontrol && <DixKontrolPanel onClose={() => setShowDixKontrol(false)} />}
                  {showByok && (
                    <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowByok(false)}>
                      <div onClick={e => e.stopPropagation()}>
                        <ByokSettings onClose={() => setShowByok(false)} />
                      </div>
                    </div>
                  )}

                  {/* Programas de inicio */}
                  {showStartupPanel && (
                    <div className="card" style={{ marginBottom: 16, overflow: "hidden" }}>
                      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>{t("nav_startup_items")}</span>
                        <button className="btn-secondary" onClick={() => setShowStartupPanel(false)} style={{ fontSize: 11 }}>{t("close_button")}</button>
                      </div>

                      {startupLoading && (
                        <div style={{ padding: 20, textAlign: "center", color: C.muted, fontSize: 13 }}>{t("startup_loading")}</div>
                      )}

                      {!startupLoading && startupItems.length === 0 && (
                        <div style={{ padding: 20, textAlign: "center", color: C.muted, fontSize: 13 }}>{t("startup_empty")}</div>
                      )}

                      {!startupLoading && startupItems.length > 0 && (
                        <>
                          <div style={{ padding: "10px 16px", fontSize: 11, color: C.muted, borderBottom: `1px solid ${C.border}` }}>
                            {t("startup_help_text")}
                          </div>
                          {startupItems
                            .filter((i) => i.trust !== "NeverTouch")
                            .map((item) => (
                              <div key={item.id} style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
                                {item.enabled ? (
                                  <input
                                    type="checkbox"
                                    checked={startupToDisable.has(item.id)}
                                    onChange={() => toggleStartupSelection(item.id)}
                                    style={{ flexShrink: 0 }}
                                  />
                                ) : <span style={{ width: 13, flexShrink: 0 }} />}
                                <span style={{ fontSize: 14, flexShrink: 0 }}>
                                  {item.trust === "Orphan" ? "🧹" : item.trust === "Safe" ? "🟢" : "🟡"}
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
                                  <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {item.trust === "Orphan" ? t("startup_orphan_location") : item.location}
                                  </div>
                                </div>
                                {!item.enabled && (
                                  <button className="btn-secondary" onClick={() => handleUndoStartupItem(item)} style={{ fontSize: 11, flexShrink: 0 }}>
                                    {t("startup_reactivate")}
                                  </button>
                                )}
                              </div>
                            ))}
                          <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <span style={{ fontSize: 11, color: C.muted }}>
                              {startupResult ?? `${startupToDisable.size} seleccionado${startupToDisable.size === 1 ? "" : "s"} para desactivar`}
                            </span>
                            <button className="btn-primary" onClick={handleApplyStartupChanges}
                              disabled={startupApplying || startupToDisable.size === 0}
                              style={{ padding: "7px 18px", fontSize: 13 }}>
                              {startupApplying ? t("startup_applying") : t("startup_disable_selected")}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Hero card: score + CTA ── */}
                  <div className="card" style={{ marginBottom: 12, padding: "28px 28px 24px", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% -20%, ${C.orange}14 0%, transparent 65%)`, pointerEvents: "none" }} />

                    {/* Hardware en una sola línea */}
                    <div style={{ display: "flex", gap: 18, fontSize: 11, color: C.muted, fontFamily: "monospace", marginBottom: 24, flexWrap: "wrap" }}>
                      <span style={{ color: C.orange }}>⚙</span>
                      <span>{hwSummary ? (hwSummary.cpu || t("idle_cpu_fallback")) : t("idle_detecting_cpu")}</span>
                      <span style={{ color: C.border }}>·</span>
                      <span>{hwSummary?.ram ?? "…"}</span>
                      <span style={{ color: C.border }}>·</span>
                      <span>{hwSummary?.distro || t("idle_system_fallback")}</span>
                      {idleScan && <><span style={{ color: C.border }}>·</span><span>kernel {idleScan.kernel_version}</span></>}
                    </div>

                    {/* Score rings o placeholder */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 40, marginBottom: 28 }}>
                      {sessions.length >= 2 ? (
                        <>
                          <ScoreRing score={sessions[1].score_after} label={t("idle_score_two_sessions_ago")} size={100} />
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                            <div style={{ fontSize: 22, color: C.border }}>→</div>
                            {(() => {
                              const delta = sessions[0].score_after - sessions[1].score_after;
                              return (
                                <div style={{ fontSize: 11, fontWeight: 700, color: delta >= 0 ? C.green : C.red }}>
                                  {delta >= 0 ? `+${delta}` : delta} pts
                                </div>
                              );
                            })()}
                          </div>
                          <ScoreRing score={sessions[0].score_after} label={t("idle_score_last_session")} size={120} />
                        </>
                      ) : sessions.length === 1 ? (
                        <>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 44, color: C.border, fontWeight: 800, lineHeight: 1 }}>—</div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{t("idle_before_dix")}</div>
                          </div>
                          <div style={{ fontSize: 22, color: C.border }}>→</div>
                          <ScoreRing score={sessions[0].score_after} label={t("idle_after_optimizing")} size={120} />
                        </>
                      ) : (
                        <div style={{ textAlign: "center", padding: "8px 0" }}>
                          <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto" }}>
                            <svg width={120} height={120} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
                              <circle cx={60} cy={60} r={52} fill="none" stroke={C.border} strokeWidth={7} />
                              <circle cx={60} cy={60} r={52} fill="none" stroke={C.border} strokeWidth={7}
                                strokeDasharray="0 327" strokeLinecap="round" />
                            </svg>
                            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ fontSize: 36, color: C.border, fontWeight: 800, lineHeight: 1 }}>?</span>
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: C.border, marginTop: 10 }}>{t("idle_analyze_for_score")}</div>
                        </div>
                      )}
                    </div>

                    {/* Botón compartir score — solo si hay análisis en esta sesión */}
                    {analysis && scan && (
                      <button
                        onClick={() => generateShareCard(
                          analysis.score_actual,
                          verifiedScoreAfter ?? analysis.score_optimizado,
                          scan.cpu_model, scan.mem_total_mb,
                          scan.distro_id, scan.distro_version, dixIdle,
                        ).then(setShareCardUrl)}
                        style={{
                          width: "100%", marginBottom: 14,
                          background: `linear-gradient(135deg, ${C.orange}22, ${C.orange}11)`,
                          border: `1px solid ${C.orange}66`, borderRadius: 8,
                          color: C.orange, padding: "9px 0", fontSize: 12,
                          fontWeight: 700, cursor: "pointer", letterSpacing: "0.3px",
                        }}
                      >
                        {t("share_score_button")}
                      </button>
                    )}

                    {/* Selector de perfil */}
                    <div style={{ width: "100%" }}>
                      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8, fontWeight: 600 }}>
                        {t("idle_profile_label")}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                        {PROFILES.map(p => {
                          const active = profile === p.id;
                          return (
                            <button key={p.id}
                              title={t(p.hintKey)}
                              onClick={() => { setProfile(p.id); localStorage.setItem("dix_profile", p.id); }}
                              style={{
                                background: active ? `${C.orange}18` : C.card,
                                border: `1px solid ${active ? C.orange : C.border}`,
                                borderRadius: 8,
                                padding: "8px 4px",
                                cursor: "pointer",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 3,
                                transition: "all 0.15s",
                              }}>
                              <span style={{ fontSize: 16 }}>{p.icon}</span>
                              <span style={{ fontSize: 9, fontWeight: active ? 700 : 500, color: active ? C.orange : C.muted, letterSpacing: "0.3px" }}>
                                {t(p.labelKey)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 5, textAlign: "center" }}>
                        {(() => { const hk = PROFILES.find(p => p.id === profile)?.hintKey; return hk ? t(hk) : ""; })()}
                      </div>
                    </div>

                    {/* CTA */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <button className="btn-primary" onClick={handleStart} style={{ padding: "13px 48px", fontSize: 15 }}>
                        {t("idle_analyze_button")}
                      </button>
                      <div style={{ fontSize: 11, color: C.border }}>
                        {t("idle_analyze_details")}
                      </div>
                    </div>
                  </div>

                  {/* ── Historial ── */}
                  {sessions.length > 0 && (
                    <div className="card" style={{ overflow: "hidden" }}>
                      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px" }}>
                          Historial · PC quedó en {sessions[0].score_after}/100 tras la última sesión
                        </span>
                        <button onClick={() => invoke("clear_sessions").then(() => setSessions([])).catch(() => {})}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: C.muted }}>
                          {t("history_clear")}
                        </button>
                      </div>
                      {sessions.slice(0, 5).map((s, i) => {
                        const delta = s.score_after - s.score_before;
                        return (
                          <div key={s.id} style={{ padding: "10px 16px", borderBottom: i < Math.min(sessions.length, 5) - 1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 500 }}>{fmtDate(s.timestamp)}</div>
                              <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", marginTop: 2 }}>{s.scan_summary}</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>
                                  <span style={{ color: scoreColor(s.score_before) }}>{s.score_before}</span>
                                  <span style={{ color: C.border, margin: "0 5px" }}>→</span>
                                  <span style={{ color: scoreColor(s.score_after) }}>{s.score_after}</span>
                                </div>
                                <div style={{ fontSize: 10, color: C.muted }}>{s.optimizations_applied.length} opts</div>
                              </div>
                              <div style={{
                                minWidth: 44, textAlign: "center",
                                background: delta > 0 ? `${C.green}15` : `${C.red}15`,
                                border: `1px solid ${delta > 0 ? C.green : C.red}33`,
                                borderRadius: 6, padding: "3px 8px",
                                fontSize: 12, fontWeight: 800,
                                color: delta > 0 ? C.green : C.red,
                              }}>
                                {delta > 0 ? `+${delta}` : delta}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── RESULTS — sistema ya óptimo ── */}
              {view === "results" && analysis && aplicadas.length === 0 && (
                <div className="fade-in">
                  <div className="card" style={{ padding: "48px 32px", textAlign: "center", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 0%, ${C.green}12 0%, transparent 65%)`, pointerEvents: "none" }} />
                    <div style={{ marginBottom: 28, display: "flex", justifyContent: "center" }}>
                      <ScoreRing score={analysis.score_actual} label={t("results_current_score_label")} size={130} />
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.green, marginBottom: 10, letterSpacing: "-0.3px" }}>
                      {t("results_optimal_title")}
                    </div>
                    <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, maxWidth: 420, margin: "0 auto 24px" }}>
                      Dix ha analizado {Object.keys(scan ?? {}).length} parámetros del kernel y determina que tu sistema ya está optimizado. No hay cambios necesarios en este momento.
                    </p>
                    {analysis.analisis && (
                      <div style={{ background: `${C.green}08`, border: `1px solid ${C.green}22`, borderRadius: 10, padding: "14px 18px", maxWidth: 480, margin: "0 auto 24px", textAlign: "left" }}>
                        <div style={{ fontSize: 10, color: C.green, letterSpacing: "1px", marginBottom: 6 }}>{t("results_claude_diagnosis_label")}</div>
                        <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.65 }}>{analysis.analisis}</p>
                      </div>
                    )}
                    {saltadas.length > 0 && (
                      <div style={{ fontSize: 11, color: C.border, marginBottom: 20 }}>
                        {saltadas.length} optimizaciones descartadas por política de seguridad
                      </div>
                    )}
                    <button className="btn-primary" onClick={handleReset} style={{ padding: "11px 32px" }}>
                      {t("results_back_home_button")}
                    </button>
                  </div>
                </div>
              )}

              {/* ── RESULTS — con optimizaciones ── */}
              {view === "results" && analysis && aplicadas.length > 0 && (
                <div className="fade-in">
                  <div className="card" style={{ padding: "24px 28px", marginBottom: 16, display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 100% 50%, ${C.green}08 0%, transparent 60%)`, pointerEvents: "none" }} />
                    <img src={dixIdle} alt="DIX" style={{ width: 90, height: 90, objectFit: "contain", filter: "drop-shadow(0 0 16px #00FF8844)" }} />
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                      <ScoreRing score={analysis.score_actual}    label={t("results_actual_label")}     size={100} />
                      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                        <div style={{ fontSize: 28, color: C.muted }}>→</div>
                      </div>
                      <ScoreRing score={analysis.score_optimizado} label={t("results_optimized_label")} size={100} />
                      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 4, minWidth: 80 }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: C.green }}>+<AnimatedCounter target={mejora} /></div>
                        <div style={{ fontSize: 11, color: C.muted }}>{t("results_points_label")}</div>
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      {fromCache && (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: `${C.yellow}15`, border: `1px solid ${C.yellow}44`, borderRadius: 6, padding: "3px 10px", fontSize: 11, color: C.yellow, marginBottom: 10 }}>
                          {t("results_from_cache_badge")}
                        </div>
                      )}
                      {!fromCache && responseMs > 0 && (
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>⏱ {t("results_ai_analysis_in")} {(responseMs / 1000).toFixed(1)}s</div>
                      )}
                      {cacheStats && cacheStats.hit_count + cacheStats.miss_count > 1 && (
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>
                          🔁 {Math.round(cacheStats.hit_rate * 100)}% de coincidencia histórica con análisis anteriores de este PC
                        </div>
                      )}
                      <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.65 }}>{analysis.analisis}</p>
                    </div>
                  </div>

                  {/* Ajustes que Dix "recuerda" de sesiones anteriores — antes invisibles */}
                  {cacheStats && Object.keys(cacheStats.pinned_params).length > 0 && (
                    <div style={{
                      marginBottom: 16, padding: "10px 16px", borderRadius: 10,
                      background: `${C.orange}08`, border: `1px solid ${C.orange}22`,
                    }}>
                      <div style={{ fontSize: 11, color: C.orange, fontWeight: 700, marginBottom: 6 }}>
                        {t("results_cache_memory_title")}
                      </div>
                      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
                        {Object.entries(cacheStats.pinned_params).map(([k, v]) => (
                          <span key={k}><strong style={{ color: C.text }}>{k}</strong> = {v}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {mejora <= 3 && scan && hardwareCeiling(scan) < 85 && (
                    <div style={{
                      marginBottom: 16, padding: "10px 14px", borderRadius: 8,
                      background: `${C.yellow}0d`, border: `1px solid ${C.yellow}33`,
                      fontSize: 12, color: C.muted, lineHeight: 1.6,
                    }}>
                      {t("results_low_ceiling_part_1")} <strong style={{ color: C.text }}>{t("results_low_ceiling_measurable")}</strong> {t("results_low_ceiling_part_2")}
                    </div>
                  )}

                  {/* Panel de métricas benchmark medidas */}
                  {benchmarks && (
                    <div style={{
                      marginBottom: 16, padding: "10px 16px", borderRadius: 10,
                      background: benchmarks.measured ? `${C.green}08` : "#1a1208",
                      border: `1px solid ${benchmarks.measured ? C.green + "33" : C.border}`,
                      display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                    }}>
                      <span style={{
                        fontSize: 9, fontWeight: 800, letterSpacing: "0.8px",
                        color: benchmarks.measured ? "#000" : C.yellow,
                        background: benchmarks.measured ? C.green : C.yellow,
                        borderRadius: 4, padding: "2px 7px", flexShrink: 0,
                      }}>
                        {benchmarks.measured ? t("benchmarks_measured_badge") : t("benchmarks_estimated_badge")}
                      </span>
                      {benchmarks.measured ? (
                        <span style={{ fontSize: 12, color: C.muted, fontFamily: "monospace" }}>
                          CPU:{" "}
                          <strong style={{ color: C.green }}>{benchmarks.cpu_events_per_sec.toFixed(0)}</strong>
                          {" "}ev/s · RAM:{" "}
                          <strong style={{ color: C.green }}>{benchmarks.ram_mb_per_sec.toFixed(0)}</strong>
                          {" "}MB/s · Disco:{" "}
                          <strong style={{ color: C.green }}>
                            {benchmarks.disk_iops >= 1000
                              ? (benchmarks.disk_iops / 1000).toFixed(0) + "K"
                              : benchmarks.disk_iops.toFixed(0)}
                          </strong>
                          {" "}IOPS
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: C.muted }}>
                          {benchmarks.missing_tools.length > 0
                            ? `Instala ${benchmarks.missing_tools.join(" y ")} para score medido`
                            : t("benchmarks_kernel_score")}
                        </span>
                      )}
                    </div>
                  )}

                  {scan && (
                    <details className="card" style={{ marginBottom: 16, overflow: "hidden" }}>
                      <summary style={{ padding: "11px 16px", cursor: "pointer", fontSize: 12, color: C.muted, userSelect: "none" }}>
                        {t("results_view_system_metrics")} ({Object.keys(scan).length} {t("results_parameters_label")})
                      </summary>
                      <div style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 11, lineHeight: 1.85, borderTop: `1px solid ${C.border}` }}>
                        {Object.entries(scan).map(([k, v]) => (
                          <div key={k}><span style={{ color: C.orange }}>{k}:</span> <span style={{ color: C.muted }}>{String(v)}</span></div>
                        ))}
                      </div>
                    </details>
                  )}

                  <h3 style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>✅ {t("results_to_apply_title")} ({aplicadas.length})</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                    {aplicadas.map((o) => {
                      const cat = CAT[o.categoria] ?? CAT.Sistema;
                      return (
                        <div key={o.id} className="card" style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", gap: 12 }}>
                            <input type="checkbox" checked disabled={regeneratingScript}
                              onChange={() => toggleOptimization(o.id)}
                              style={{ marginTop: 3, flexShrink: 0, cursor: regeneratingScript ? "wait" : "pointer" }}
                              title={t("results_uncheck_title")} />
                            <span style={{ background: cat.bg, color: cat.color, borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700, flexShrink: 0, height: "fit-content" }}>{o.categoria}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{o.titulo}</div>
                              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, lineHeight: 1.5 }}>{o.descripcion}</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 11, marginBottom: 8 }}>
                                <span style={{ background: `${C.green}18`, color: C.green, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>{o.mejora_estimada}</span>
                                <span style={{ color: C.muted }}>⏱ {o.tiempo_estimado}</span>
                                <span style={{ color: o.riesgo === "bajo" ? C.green : o.riesgo === "medio" ? C.yellow : C.red }}>riesgo {o.riesgo}</span>
                              </div>
                              {o.comando_preview && (
                                <div style={{ background: "#010409", color: "#7dd3fc", fontFamily: "monospace", fontSize: 11, padding: "5px 10px", borderRadius: 6, border: `1px solid ${C.border}` }}>
                                  $ {o.comando_preview}
                                </div>
                              )}
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                                <div style={{ flex: 1, height: 3, background: C.border, borderRadius: 2 }}>
                                  <div style={{ height: "100%", width: `${o.impacto}%`, background: cat.color, borderRadius: 2 }} />
                                </div>
                                <span style={{ fontSize: 11, color: C.muted, minWidth: 28, textAlign: "right" }}>{o.impacto}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {saltadas.length > 0 && (
                    <>
                      <h3 style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>⏭ {t("results_skipped_title")} ({saltadas.length})</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 20 }}>
                        {saltadas.map((o) => (
                          <div key={o.id} className="card" style={{ padding: "8px 14px", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.65, gap: 10 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <input type="checkbox" checked={false} disabled={regeneratingScript}
                                onChange={() => toggleOptimization(o.id)}
                                style={{ cursor: regeneratingScript ? "wait" : "pointer" }}
                                title={t("results_check_title")} />
                              {o.titulo}
                            </span>
                            <span style={{ color: C.muted, fontSize: 12 }}>{o.mejora_estimada} · riesgo {o.riesgo}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <div className="card" style={{ overflow: "hidden", marginBottom: 12 }}>
                    <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: scriptVisible ? `1px solid ${C.border}` : "none" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{t("results_generated_script_title")}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 2, fontFamily: "monospace" }}>sudo bash dix_boost.sh</div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn-secondary" onClick={() => setScriptVisible(!scriptVisible)} style={{ fontSize: 11 }}>{scriptVisible ? t("results_hide_script") : t("results_show_script")}</button>
                        <button className="btn-secondary" onClick={handleDownload} style={{ fontSize: 11 }}>{t("results_download_script")}</button>
                        <button className="btn-primary" onClick={handleApply} disabled={regeneratingScript} style={{ padding: "7px 20px", fontSize: 13, opacity: regeneratingScript ? 0.6 : 1, cursor: regeneratingScript ? "wait" : "pointer" }}>
                          {regeneratingScript ? t("results_updating_script") : t("results_apply_button")}
                        </button>
                      </div>
                    </div>
                    {scriptVisible && (
                      <pre style={{ background: "#010409", color: "#94a3b8", fontFamily: "monospace", fontSize: 11, padding: "14px 16px", margin: 0, overflowX: "auto", maxHeight: 300, overflowY: "auto", lineHeight: 1.7 }}>
                        {script}
                      </pre>
                    )}
                  </div>

                  <div style={{ background: "#1a1208", border: `1px solid ${C.yellow}33`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#fbbf24", marginBottom: 14 }}>
                    {t("results_gnome_auth_warning")}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn-secondary" onClick={handleReset}>{t("results_new_analysis_back")}</button>
                    {isOdyssey && analysis && (
                      <button className="btn-secondary"
                        style={{ color: "#FFD700", borderColor: "#FFD70055" }}
                        onClick={async () => {
                          const prof = PROFILES.find(p => p.id === profile);
                          const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
                          const filename = `dix-odyssey-report-${ts}.txt`;
                          const content = [
                            "╔══════════════════════════════════════════════════════╗",
                            t("odyssey_report_title_box"),
                            "╚══════════════════════════════════════════════════════╝",
                            `Fecha: ${new Date().toLocaleString("es-ES")}`,
                            `Perfil: ${(prof && t(prof.labelKey)) ?? profile}  (${(prof && t(prof.hintKey)) ?? ""})`,
                            `Sistema: ${scan?.cpu_model ?? ""} · ${scan?.distro_id ?? ""} ${scan?.distro_version ?? ""}`,
                            `RAM: ${Math.round(((scan?.mem_total_mb ?? 0) + 512) / 1024)} GB  ·  GPU: ${scan?.gpu_model ?? ""}`,
                            "",
                            t("odyssey_report_diagnosis_heading"),
                            analysis.analisis,
                            "",
                            `Score actual: ${analysis.score_actual}/100`,
                            `Score optimizado: ${analysis.score_optimizado}/100`,
                            `Mejora esperada: +${analysis.score_optimizado - analysis.score_actual} puntos`,
                            "",
                            t("odyssey_report_optimizations_heading"),
                            ...analysis.optimizaciones.map((o, i) =>
                              `${i + 1}. [${o.categoria}] ${o.titulo}\n   ${o.descripcion}\n   Mejora: ${o.mejora_estimada} · Riesgo: ${o.riesgo}\n   ${o.comando_preview ? `$ ${o.comando_preview}` : ""}`.trim()
                            ),
                            "",
                            t("odyssey_report_script_heading"),
                            script,
                            "",
                            "© 2026 DixSystem — dixsystem.com",
                          ].join("\n");
                          const path = await invoke<string>("export_report", { content, filename }).catch(e => String(e));
                          alert(`✦ Reporte Odyssey guardado en:\n${path}`);
                        }}>
                        {t("results_export_report_button")}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── ACTIVATE ── */}
              {view === "activate" && (
                <div className="card fade-in" style={{ padding: "2.5rem 2rem", textAlign: "center", maxWidth: 480, margin: "40px auto" }}>
                  <div style={{ fontSize: 36, marginBottom: 16 }}>🔑</div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{t("activate_title")}</h2>
                  <p style={{ color: C.muted, fontSize: 13, marginBottom: 8, lineHeight: 1.6 }}>{t("activate_body")}</p>
                  <p style={{ fontSize: 12, color: C.muted, marginBottom: 24 }}>
                    {t("activate_no_license")}{" "}
                    <span style={{ color: C.orange, cursor: "pointer", textDecoration: "underline" }} onClick={() => window.open("https://dixsystem.com/comprar", "_blank")}>
                      {t("activate_buy_link")}
                    </span>
                  </p>
                  <input
                    type="text" value={licenseInput}
                    onChange={(e) => setLicenseInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !activatingLicense && licenseInput.trim() && handleActivateLicense()}
                    placeholder="XXXX-XXXX-XXXX-XXXX" autoFocus
                    style={{ display: "block", width: "100%", padding: "11px 14px", fontSize: 14, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, outline: "none", marginBottom: 14, fontFamily: "monospace", textAlign: "center", letterSpacing: "2px" }}
                  />
                  {error && <p style={{ color: C.red, fontSize: 12, marginBottom: 12 }}>{error}</p>}
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    <button className="btn-primary" onClick={handleActivateLicense} disabled={activatingLicense || !licenseInput.trim()} style={{ opacity: activatingLicense || !licenseInput.trim() ? 0.5 : 1,  }}>
                      {activatingLicense ? t("activate_verifying") : t("activate_button")}
                    </button>
                    <button className="btn-secondary" onClick={() => { setError(null); setView("idle"); }}>{t("cancel_button")}</button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>

      {/* ── Modal de actualización ── */}
      {showUpdateModal && pendingUpdate && (
        <div style={{ position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 }}>
          <div className="card fade-in" style={{ padding: "2rem", textAlign: "center", maxWidth: 420, width: "100%", border: `1px solid ${C.green}44` }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🚀</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Dix {pendingUpdate.version}</h2>
            {pendingUpdate.body && (
              <p style={{ color: C.muted, fontSize: 13, marginBottom: 20, lineHeight: 1.6, textAlign: "left", background: C.bg, borderRadius: 8, padding: "10px 14px", maxHeight: 140, overflowY: "auto" }}>
                {pendingUpdate.body}
              </p>
            )}
            {updateState === "downloading" && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ height: 6, background: C.border, borderRadius: 3, marginBottom: 8, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 3, background: C.green, width: updateTotal > 0 ? `${Math.round((updateProgress / updateTotal) * 100)}%` : "0%",  }} />
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>
                  {updateTotal > 0 ? `${(updateProgress / 1024 / 1024).toFixed(1)} / ${(updateTotal / 1024 / 1024).toFixed(1)} MB` : t("update_downloading")}
                </div>
              </div>
            )}
            {updateState === "done" && <p style={{ color: C.green, fontSize: 13, marginBottom: 16 }}>{t("update_installed_restarting")}</p>}
            {updateState === "idle" && (
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button className="btn-primary" onClick={handleInstallUpdate} style={{ padding: "10px 24px",  }}>{t("update_download_install")}</button>
                <button className="btn-secondary" onClick={() => setShowUpdateModal(false)}>{t("later_button")}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal demo agotado ── */}
      {showDemoModal && (
        <div style={{ position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 }}>
          <div className="card fade-in" style={{ padding: "2.5rem 2rem", textAlign: "center", maxWidth: 440, width: "100%", border: `1px solid ${C.orange}44` }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚀</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{t("demo_modal_title")}</h2>
            <p style={{ color: C.muted, fontSize: 14, marginBottom: 24, lineHeight: 1.7 }}>
              {t("demo_modal_body")}
            </p>
            <div className="card" style={{ padding: "16px", marginBottom: 20, background: "#0f1a0f", border: `1px solid ${C.green}33` }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.green, marginBottom: 4 }}>14,99€</div>
              <div style={{ fontSize: 12, color: C.muted }}>{t("demo_modal_price_note")}</div>
            </div>
            <button className="btn-primary" onClick={() => window.open("https://dixsystem.com/comprar", "_blank")} style={{ width: "100%", marginBottom: 10, padding: "13px" }}>
              {t("demo_modal_buy_button")}
            </button>
            <button className="btn-secondary" onClick={() => { setShowDemoModal(false); setView("activate"); }} style={{ width: "100%", marginBottom: 8 }}>
              {t("demo_modal_activate_button")}
            </button>
            <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: C.muted }} onClick={() => setShowDemoModal(false)}>{t("close_button")}</button>
          </div>
        </div>
      )}

      {/* ── Modal compartir score ── */}
      {shareCardUrl && analysis && (
        <div style={{ position: "fixed", inset: 0, background: "#000000cc", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="card fade-in" style={{ padding: "24px", maxWidth: 680, width: "100%", border: `1px solid ${C.orange}55` }}>
            {/* Cabecera */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: C.text }}>{t("share_modal_title")}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{t("share_modal_subtitle")}</div>
              </div>
              <button onClick={() => setShareCardUrl(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 20, padding: 4 }}>✕</button>
            </div>

            {/* Preview de la imagen */}
            <img
              src={shareCardUrl}
              alt="DIX Score Card"
              style={{ width: "100%", borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 16 }}
            />

            {/* Texto para copiar */}
            <div style={{ background: "#010409", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: C.muted, fontFamily: "monospace" }}>
              My {scan?.distro_id === "windows" ? "Windows" : "Linux"} score went from {analysis.score_actual} to {verifiedScoreAfter ?? analysis.score_optimizado}/100 with DIX 🚀{"\n"}
              Try it free → dixsystem.com #DixBeta #{scan?.distro_id === "windows" ? "Windows" : "Linux"}
            </div>

            {/* Botones */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => downloadDataUrl(shareCardUrl, "dix-score.png")}
                style={{
                  flex: 1, textAlign: "center",
                  background: `linear-gradient(135deg, ${C.orange}, #ff8533)`,
                  color: "#fff", border: "none", borderRadius: 8,
                  padding: "11px 0", fontSize: 13, fontWeight: 800,
                  cursor: "pointer", boxShadow: `0 2px 12px ${C.orange}55`,
                }}
              >
                {t("share_download_image")}
              </button>
              <button
                onClick={() => {
                  const platform = scan?.distro_id === "windows" ? "Windows" : "Linux";
                  const text = `My ${platform} score went from ${analysis.score_actual} to ${verifiedScoreAfter ?? analysis.score_optimizado}/100 with DIX 🚀 Try it free → dixsystem.com #DixBeta #${platform}`;
                  navigator.clipboard.writeText(text).catch(() => {});
                }}
                style={{
                  flex: 1, background: C.card, color: C.text,
                  border: `1px solid ${C.border}`, borderRadius: 8,
                  padding: "11px 0", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}
              >
                {t("share_copy_text")}
              </button>
            </div>

            <div style={{ marginTop: 12, fontSize: 11, color: C.muted, textAlign: "center" }}>
              {t("share_modal_footer")}
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: "10px 24px", textAlign: "center", fontSize: 11, color: C.border, flexShrink: 0 }}>
        DixSystem · Dix v1.0 · <span style={{ color: C.orange }}>{t("header_tagline")}</span>
      </div>
    </div>
  );
}
