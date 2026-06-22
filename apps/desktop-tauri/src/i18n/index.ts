// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.
//
// Sistema de i18n de la app de escritorio (tarea #17 — unificar idioma entre
// landing, que ya tiene EN/ES, y la app, que era 100% español). Diseño
// deliberadamente simple: un diccionario plano de claves -> {es, en}, sin
// pluralización ni interpolación compleja (la app no la necesita hoy). Cada
// archivo de origen aporta su propio diccionario parcial (ver app.ts,
// components.ts) para que se puedan extender en paralelo sin pisarse en el
// mismo archivo.

import { useCallback, useEffect, useState } from "react";
import { APP_STRINGS } from "./app";
import { COMPONENT_STRINGS } from "./components";

export type Lang = "es" | "en";

export type Dict = Record<string, { es: string; en: string }>;

const STRINGS: Dict = { ...APP_STRINGS, ...COMPONENT_STRINGS };

const STORAGE_KEY = "dix_lang";

function detectInitialLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "es" || stored === "en") return stored;
  // Mismo criterio que la landing: español por idioma del navegador/sistema,
  // inglés en cualquier otro caso (público por defecto más amplio).
  return navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
}

export function useLang() {
  const [lang, setLangState] = useState<Lang>(detectInitialLang);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  const setLang = useCallback((next: Lang) => setLangState(next), []);

  // Si falta una clave o una traducción, se ve el texto en español tal cual
  // (nunca la clave en crudo) — degradación honesta, no un "[missing key]".
  const t = useCallback(
    (key: string): string => {
      const entry = STRINGS[key];
      if (!entry) return key;
      return entry[lang] ?? entry.es;
    },
    [lang]
  );

  return { lang, setLang, t };
}
