// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.
//
// Aviso de consentimiento de DIX Atlas (tarea 2.3 de ORDEN_TRABAJO.md). Por
// defecto Atlas está desactivado — este banner solo aparece mientras
// get_atlas_opt_in() devuelva null (el usuario nunca respondió). En cuanto
// acepta o rechaza, no vuelve a mostrarse.

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { C } from "../constants";

export function AtlasConsentBanner() {
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    invoke<boolean | null>("get_atlas_opt_in")
      .then((value) => setVisible(value === null || value === undefined))
      .catch(() => setVisible(false));
  }, []);

  async function respond(value: boolean) {
    setPending(true);
    try {
      await invoke("set_atlas_opt_in", { value });
      setVisible(false);
    } catch {
      // Si falla el guardado, dejamos el banner visible para reintentar —
      // nunca asumimos un "sí" silencioso.
    } finally {
      setPending(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="card" style={{ marginBottom: 16, padding: "14px 16px", borderColor: `${C.orange}44` }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        🛰 ¿Compartir datos anónimos con DIX Atlas?
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
        Si aceptas, DIX envía de forma anónima tu modelo de CPU/GPU, distro y la mejora de score
        antes/después de cada análisis, para mejorar las recomendaciones de todos. Nunca se envía
        hostname, usuario, IP ni rutas de archivos. Puedes cambiarlo cuando quieras. Por defecto
        está desactivado — si no decides ahora, sigue desactivado.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn-secondary" disabled={pending} onClick={() => respond(true)}
          style={{ fontSize: 12, color: C.green, borderColor: `${C.green}55` }}>
          Compartir datos anónimos
        </button>
        <button className="btn-secondary" disabled={pending} onClick={() => respond(false)} style={{ fontSize: 12 }}>
          No, gracias
        </button>
      </div>
    </div>
  );
}
