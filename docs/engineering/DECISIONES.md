# DECISIONES.md — Registro Permanente de Decisiones de DixSystem

> Este documento responde a una única pregunta: **"¿Qué sigue siendo válido?"**
>
> Solo contiene decisiones **actualmente vigentes**. Nunca contiene conversaciones ni
> tareas. Cuando una decisión cambia, no se borra: pasa a estado `OBSOLETA` indicando
> qué decisión la sustituye. La historia completa de cómo se llegó a cada decisión
> (contexto, discusión, alternativas descartadas) vive en `BITACORA_DIXSYSTEM.md` y,
> cuando aplica, en el RFC/ADR correspondiente bajo `docs/architecture/`.

**Formato de cada entrada:**

```
## DEC-NNN — <título corto>

- **Fecha:** AAAA-MM-DD
- **Estado:** Aprobada | Sustituida | Obsoleta
- **Contexto:** por qué surgió la necesidad de decidir esto
- **Problema:** qué pregunta concreta resolvía
- **Decisión:** qué se decidió, en una o dos frases verificables
- **Consecuencias:** qué implica hacia adelante (positivo y negativo)
- **Documentos relacionados:** RFC/ADR, commits, u otros DEC afectados
```

---

## DEC-001 — Adopción del Sistema de Bitácora y Registro de Decisiones

- **Fecha:** 2026-07-01
- **Estado:** Aprobada
- **Contexto:** El conocimiento de ingeniería de DixSystem vivía únicamente en el
  código y en conversaciones puntuales, sin memoria persistente del razonamiento
  detrás de las decisiones ni de la evolución de la arquitectura. Alonso definió el
  objetivo de que, dentro de diez años, cualquier ingeniero pueda reconstruir la
  historia completa de DixSystem leyendo solo su documentación técnica.
- **Problema:** ¿Dónde y cómo se registra el razonamiento, las decisiones y las
  lecciones aprendidas, sin duplicar ni el código ni las conversaciones?
- **Decisión:** Se crean dos documentos oficiales con responsabilidades distintas:
  `docs/engineering/BITACORA_DIXSYSTEM.md` (historia cronológica — "¿qué ocurrió?") y
  `docs/engineering/DECISIONES.md` (registro normativo — "¿qué sigue siendo válido?").
  Claude Code los mantiene actualizados en los puntos de control definidos (commit,
  fin de fase/sprint, nueva RFC/ADR/Directiva, cambio arquitectónico, corrección de
  error crítico, u orden explícita del usuario), aplicando el criterio dentro de cada
  sesión activa.
- **Consecuencias:** Positivo — la documentación gana el mismo rigor que el código;
  las decisiones quedan trazables y auditables con el tiempo. Negativo / pendiente —
  la detección automática de puntos de control entre sesiones (sin conversación activa
  con Claude Code) requiere un hook real de `settings.json`, no solo esta directriz en
  texto; hasta que se configure, la actualización depende de que ocurra dentro de una
  sesión activa.
- **Documentos relacionados:** `docs/architecture/DIRECTIVA_FUNDACIONAL.md` (v1.1,
  pendiente de aprobación definitiva), `docs/architecture/RFC-001_DIRECTIVA_PENDIENTES.md`.

---

## DEC-002 — GStack Browser es herramienta externa de desarrollo, no dependencia central

- **Fecha:** 2026-07-01
- **Estado:** Aprobada
- **Contexto:** Se instaló y configuró GStack (framework de automatización de
  navegador de Garry Tan) como herramienta de QA visual para Claude Code durante
  esta sesión (fix de sandbox de Chromium en Ubuntu 26.04, verificación headed y
  headless). Alonso quiso fijar explícitamente su lugar en la arquitectura antes de
  que su uso se normalizara sin clasificación.
- **Problema:** ¿Cómo se clasifica GStack dentro de DixSystem, y qué regla evita que
  se convierta en una dependencia estructural difícil de sustituir más adelante?
- **Decisión:** GStack Browser se clasifica como **Herramienta externa de desarrollo
  / Browser Automation Adapter** — no es AppIA, System Forge, Nexus ni Knowledge
  Core, y no forma parte del producto final. DixSystem no debe depender
  directamente de GStack: cualquier integración futura debe pasar por una
  abstracción propia (`BrowserAutomationProvider` / `VisualValidationAdapter`),
  donde GStack, Playwright, Puppeteer, Selenium o Chromium (headless/headed) son
  implementaciones intercambiables. Hoy no existe esa abstracción — GStack se usa
  de forma directa como herramienta de desarrollo, y la abstracción solo se
  construirá cuando exista necesidad real (creación perezosa), no de antemano.
- **Consecuencias:** Positivo — ninguna AppIA, System Forge ni el producto DIX
  queda acoplado a un CLI o SDK de terceros; sustituir GStack en el futuro (por
  Playwright directo, Puppeteer, etc.) no debería requerir tocar arquitectura de
  producto. Negativo / pendiente — mientras no exista el adaptador, cualquier uso
  de GStack fuera del entorno de desarrollo puro debe revisarse caso a caso para no
  introducir acoplamiento silencioso.
- **Documentos relacionados:** `docs/architecture/HERRAMIENTAS_EXTERNAS.md` v1.0
  (detalle completo de clasificación, función y regla arquitectónica).

---

## DEC-003 — Cierre del RFC-001 y autorización de la Directiva Fundacional v1.2

- **Fecha:** 2026-07-02
- **Estado:** Aprobada
- **Contexto:** El RFC-001 (auditoría adversarial de la Directiva Fundacional v1.1)
  identificó 11 hallazgos (H1-H3, M1-M5, L1-L3). Los 10 primeros se resolvieron el
  2026-07-01; quedaba pendiente únicamente L3 (calificadores vagos sin heurístico
  mínimo).
- **Problema:** ¿Cómo interpretar de forma consistente calificadores cualitativos
  ("importante", "confianza suficiente", "riesgo elevado") repetidos en Confidence
  Score, Reversibilidad y Política de IA, sin crear tres listas de ejemplos que
  puedan divergir con el tiempo ni introducir un test rígido que sustituya el
  juicio técnico?
- **Decisión:** Se cierra L3 incorporando a la Directiva Fundacional un bloque
  único de **Heurísticos Arquitectónicos** — siete criterios ilustrativos y no
  exhaustivos (impacto multi-sistema, datos persistidos, reversibilidad limitada,
  impacto económico real, interfaces públicas, principios/gobernanza, existencia de
  alternativa funcional razonablemente viable), sujetos a una **cláusula de
  precedencia**: cuando exista un test específico ya aprobado (Test Estructural de
  M1, niveles de decisión de H3), ese test prevalece sobre el bloque general. Con
  L3 resuelto, **el Consejo de Arquitectura declara oficialmente cerrado el
  RFC-001** (los 11 hallazgos tienen decisión aprobada) y autoriza el inicio de la
  redacción de la **Directiva Fundacional v1.2**, incorporando todas las decisiones
  del RFC-001. La v1.2 no adquiere carácter oficial hasta superar: auditoría
  técnica (Director Técnico), revisión del Arquitecto del Ecosistema, verificación
  cruzada, y aprobación final del Consejo.
- **Consecuencias:** Positivo — la Directiva deja de tener principios activos sin
  mecanismo de aplicación (H1-M2), gobernanza documental sin jerarquía clara (H2),
  ni calificadores sin heurístico (L3); el ecosistema tiene ahora una base de
  gobernanza completa y auditada hallazgo por hallazgo. Negativo / pendiente —
  quedan cinco ajustes de redacción registrados como no bloqueantes que deben
  incorporarse al redactar la v1.2: diagrama de Arquitectura Vigente sin Nexus
  (H2), frase "embrión real" de Experience Core (M2), esquema de Evento de
  Gobernanza en `GOBERNANZA_INGENIERIA.md` (M3), procedimiento de evolución del
  Estándar DixSystem en `GOBERNANZA_INGENIERIA.md` (M5), y contenedor físico del
  bloque de Heurísticos Arquitectónicos (L3). La v1.2 en sí todavía no está
  redactada.
- **Documentos relacionados:** `docs/architecture/RFC-001_DIRECTIVA_PENDIENTES.md`
  (historial completo de los 11 ADR), `docs/architecture/DIRECTIVA_FUNDACIONAL.md`
  (v1.1, pendiente de sustitución por v1.2), `docs/engineering/BITACORA_DIXSYSTEM.md`
  (entrada 2026-07-02).

---

## DEC-004 — Aprobación de la Retrospectiva Arquitectónica del RFC-001

- **Fecha:** 2026-07-02
- **Estado:** Aprobada
- **Contexto:** Antes de redactar la Directiva Fundacional v1.2, Alonso pidió una
  retrospectiva técnica completa del proceso seguido durante los 11 hallazgos del
  RFC-001 (principios descubiertos, patrones recurrentes, decisiones acertadas,
  mejoras metodológicas, lecciones aprendidas, mejoras al propio proceso de
  gobernanza) — explícitamente sin crear todavía ningún documento oficial ni
  tocar la Directiva.
- **Problema:** ¿Qué aprendió el ecosistema del propio proceso de deliberación,
  más allá del contenido sustantivo de cada hallazgo, y qué de eso merece
  formalizarse antes de escribir la v1.2?
- **Decisión:** Se aprueba `docs/architecture/RETROSPECTIVA_RFC-001.md` como
  documento de aprendizaje del ecosistema, con cinco ajustes del Consejo:
  1. El **Principio de Especificidad** (test específico ya aprobado prevalece
     sobre heurístico general) no se eleva todavía a la Directiva Fundacional —
     se incorporará primero a `GOBERNANZA_INGENIERIA.md`, y solo podrá
     proponerse como principio constitucional tras demostrar utilidad en varios
     RFC futuros.
  2. El glosario de términos reservados evoluciona conceptualmente hacia una
     futura **Taxonomía Oficial del Ecosistema** (protección de vocabulario
     arquitectónico frente a colisiones semánticas) — decisión registrada, sin
     redactar todavía.
  3. La metodología aplicada en los 11 hallazgos del RFC-001 (contrapropuesta →
     auditoría del Director Técnico → respuesta del Consejo → auditoría final →
     verificación cruzada) se nombra oficialmente **Proceso Oficial de
     Deliberación Arquitectónica de DixSystem** — procedimiento por defecto para
     futuros RFC de arquitectura y gobernanza.
  4. Se registra como idea futura, sin implementación: **Jurisprudencia
     Arquitectónica** — los RFC importantes podrán generar precedentes
     reutilizables por futuros Consejos de Arquitectura.
  5. Se autoriza preparar un **Checklist Único de Redacción** que consolide
     todos los ajustes de texto pendientes detectados durante el RFC-001, a
     validar por el Consejo antes de iniciar la redacción de la v1.2.
- **Consecuencias:** Positivo — el ecosistema capitaliza el propio proceso de
  gobernanza como conocimiento reutilizable, no solo el resultado sustantivo;
  el "Proceso Oficial de Deliberación Arquitectónica" queda disponible como
  procedimiento nombrado para el próximo RFC, sin tener que redescubrirlo.
  Negativo / pendiente — ni el Principio de Especificidad ni la Taxonomía
  Oficial del Ecosistema están redactados todavía; ambos dependen de que se
  audite `GOBERNANZA_INGENIERIA.md` (sigue en borrador) junto con la v1.2.
- **Documentos relacionados:** `docs/architecture/RETROSPECTIVA_RFC-001.md`,
  `docs/architecture/RFC-001_DIRECTIVA_PENDIENTES.md`,
  `docs/engineering/GOBERNANZA_INGENIERIA.md` (borrador, pendiente de auditoría).

---

## DEC-006 — Resolución Ejecutiva RES-002: aprobación oficial de GOBERNANZA_INGENIERIA.md v1.1

- **Fecha:** 2026-07-02
- **Estado:** Aprobada
- **Contexto:** Tras RES-001 (aprobación de la Directiva Fundacional v1.2), el
  Consejo de Arquitectura inició la auditoría integral de
  `GOBERNANZA_INGENIERIA.md` como segundo pilar de la gobernanza, con la misma
  metodología usada para la Directiva. Se identificaron quince hallazgos (2
  Críticos, 5 Altos, 5 Medios, 3 Bajos/Observación), cada uno resuelto con el
  ciclo completo: ADR, auditoría del Director Técnico, revisión del Arquitecto
  del Ecosistema, deliberación del Consejo, aplicación, verificación cruzada
  específica y cierre oficial — sin excepciones ni fases reducidas, incluidos los
  hallazgos de severidad Baja/Observación.
- **Problema:** ¿Es `GOBERNANZA_INGENIERIA.md` internamente coherente y
  compatible con la Directiva Fundacional v1.2, RES-001, RFC-001, DECISIONES.md
  y BITACORA_DIXSYSTEM.md, y está lista para adquirir carácter oficial?
- **Decisión:** El CEO emite la **Resolución Ejecutiva RES-002**
  (`docs/architecture/RES-002_RESOLUCION_GOBERNANZA.md`): se aprueba
  oficialmente `GOBERNANZA_INGENIERIA.md` v1.1, incorporando las quince
  correcciones de la auditoría integral; el documento entra en vigor de
  inmediato como **segundo pilar oficial de la gobernanza de DixSystem**,
  complementario a la Directiva Fundacional v1.2; su versión se incrementa de
  v1.0 a v1.1 y su estado pasa de "PROPUESTA" a "VIGENTE".
- **Consecuencias:** Positivo — DixSystem dispone por primera vez de sus dos
  pilares de gobernanza oficiales y mutuamente coherentes (Directiva =
  principios/arquitectura; Gobernanza = proceso); las quince correcciones
  eliminan duplicidades, referencias obsoletas y huecos de gobernanza detectados
  mediante auditoría adversarial real, no una revisión superficial. Negativo /
  pendiente — ninguno registrado; la auditoría no dejó pendientes de redacción
  abiertos, a diferencia del cierre del RFC-001.
- **Documentos relacionados:** `docs/engineering/GOBERNANZA_INGENIERIA.md`
  (v1.1, VIGENTE), `docs/architecture/RES-002_RESOLUCION_GOBERNANZA.md`,
  `docs/architecture/DIRECTIVA_FUNDACIONAL.md` (v1.2, VIGENTE),
  `docs/architecture/RES-001_RESOLUCION_FUNDACIONAL.md`,
  `docs/engineering/BITACORA_DIXSYSTEM.md`.

---

## DEC-005 — Resolución Fundacional RES-001: aprobación oficial de la Directiva Fundacional v1.2

- **Fecha:** 2026-07-02
- **Estado:** Aprobada
- **Contexto:** Tras el cierre del RFC-001 (DEC-003) y la aprobación de la
  Retrospectiva Arquitectónica (DEC-004), se redactó la Directiva Fundacional v1.2
  como reescritura completa. Superó, en orden: auditoría técnica adversarial del
  Director Técnico (11 hallazgos de coherencia/ensamblaje, 6 corregidos de
  inmediato, 5 diferidos por tocar gobernanza), revisión del Arquitecto del
  Ecosistema (identidad, coherencia filosófica, consistencia arquitectónica,
  escalabilidad, atemporalidad — con un hallazgo severo: nombres de producto/
  persona ocupando roles permanentes, corregido), verificación cruzada final
  contra RFC-001/DECISIONES.md/BITACORA_DIXSYSTEM.md/GOBERNANZA_INGENIERIA.md
  (cinco incompatibilidades encontradas, todas ellas exclusivas de
  `GOBERNANZA_INGENIERIA.md`, ninguna bloqueante), y deliberación final del
  Consejo de Arquitectura.
- **Problema:** ¿Representa la v1.2 fielmente la identidad, los principios y la
  forma de gobernar de DixSystem, y está lista para adquirir carácter oficial?
- **Decisión:** El CEO emite la **Resolución Fundacional RES-001**
  (`docs/architecture/RES-001_RESOLUCION_FUNDACIONAL.md`): se aprueba
  oficialmente la Directiva Fundacional v1.2; la v1.1 pierde vigencia con efecto
  inmediato; la v1.2 entra en vigor de inmediato y queda declarada **Constitución
  oficial de DixSystem**; se autoriza el inicio de la auditoría y aprobación de
  `GOBERNANZA_INGENIERIA.md` como siguiente fase de madurez del ecosistema,
  usando como punto de partida las cinco incompatibilidades ya detectadas.
- **Consecuencias:** Positivo — DixSystem tiene, por primera vez, una
  Constitución oficial con carácter vinculante, producida y verificada con el
  mismo rigor de evidencia que exige de cualquier otra decisión del ecosistema.
  Negativo / pendiente — `GOBERNANZA_INGENIERIA.md` sigue siendo borrador; sus
  Secciones 3, 7, 8 y 9 quedan desactualizadas respecto a la propia Directiva ya
  vigente (nombres de rol sin abstraer, modelo de decisión pre-H3, ausencia de la
  delimitación Arquitectura/Negocio de L2) hasta que se audite formalmente.
- **Documentos relacionados:** `docs/architecture/DIRECTIVA_FUNDACIONAL.md` (v1.2,
  VIGENTE), `docs/architecture/RES-001_RESOLUCION_FUNDACIONAL.md`,
  `docs/architecture/RFC-001_DIRECTIVA_PENDIENTES.md`,
  `docs/architecture/RETROSPECTIVA_RFC-001.md`,
  `docs/engineering/BITACORA_DIXSYSTEM.md` (entrada 2026-07-02).

---

## DEC-007 — Separación arquitectónica de DIX Forge en workspace independiente

- **Fecha:** 2026-07-02
- **Estado:** Aprobada
- **Contexto:** Al retomar ORDEN_TRABAJO.md tras el cierre de la gobernanza
  (RES-001, RES-002), la Tarea 3.2 (licencia AGPL-3.0) detectó un impedimento
  real: el código de DIX Forge (`forge`, `forge_commands`, `memory_api`,
  `event_bus`, `knowledge_core`, `context_engine`, `cerebro`, `taller`,
  `vuelta`, `lanzador`, `panel`, `publisher`, `contracts`, `pipeline_store`)
  vivía en el mismo crate y binario que el cliente DIX Windows, sin ninguna
  separación de compilación — solo un flag de runtime (`--forge`). Aplicar
  AGPL-3.0 a ese crate habría obligado a entregar también el código fuente de
  Forge a cualquiera que solicitara el binario público ya distribuido.
- **Problema:** ¿Cómo separar Forge (Infraestructura de Fabricación, interna)
  de DIX Windows (Infraestructura de Producto, pública) de forma
  arquitectónica real, no solo organizativa, sin romper la compatibilidad
  funcional de ninguno de los dos?
- **Decisión:** Se crea un Cargo workspace de tres miembros (`Cargo.toml` en
  la raíz del repositorio): `apps/desktop-tauri/src-tauri` (DIX Windows,
  público), `apps/desktop-tauri/dix-cli` (sin cambios de fondo) y
  `apps/dix-forge/src-tauri` (Forge, nuevo binario propio `dix-forge`,
  `license = "LicenseRef-Proprietary"`). Los 14 módulos de Forge se movieron
  íntegros (sin reescritura de lógica) a `apps/dix-forge/`, junto con su
  frontend (`ForgePanel.tsx`) y su única dependencia exclusiva (`sqlx`). Se
  eliminaron de `apps/desktop-tauri`: los 5 comandos `#[tauri::command]
  forge_*`, la inicialización de `ForgeSystem`, el flag `--forge`, el modal
  de Forge en `App.tsx` y los imports/dependencias asociados. Verificado por
  análisis de imports (`use crate::...`) en ambas direcciones antes de mover
  nada: cero dependencia inversa de Forge hacia el resto del crate — el único
  acoplamiento real era el punto de integración en `main.rs`/`App.tsx`.
- **Consecuencias:** Positivo — el binario público de DIX Windows deja de
  compilar Forge (verificado: `grep` de "forge"/"cerebro" sobre el bundle
  `dist/` generado, cero coincidencias); Forge obtiene ciclo de compilación,
  pruebas y release independiente; queda despejado el camino para aplicar
  AGPL-3.0 solo al cliente público en un paso posterior; la separación de
  código coincide, sin haberlo buscado, con la frontera Local First/Producto
  ya fijada por el Principio 2 de la Directiva Fundacional (Forge usa Ollama,
  nunca `claude_gateway`). Negativo / pendiente — los releases ya publicados
  (v1.0.7–v1.0.11) siguen conteniendo Forge compilado; solo el primer release
  posterior a esta separación queda limpio. `apps/dix-forge` no tiene todavía
  pipeline de release propio (no es necesario mientras no se distribuya). La
  Tarea 3.2 (AGPL-3.0) queda de nuevo autorizada para continuar.
- **Documentos relacionados:** `apps/dix-forge/` (nuevo), `Cargo.toml` (raíz,
  nuevo), `docs/architecture/DIRECTIVA_FUNDACIONAL.md` (Principio 2),
  `docs/ORDEN_TRABAJO.md` (Tarea 3.1/3.2),
  `docs/engineering/BITACORA_DIXSYSTEM.md`.

---

## DEC-008 — DIX Windows licenciado como AGPL-3.0-only

- **Fecha:** 2026-07-03
- **Estado:** Aprobada
- **Contexto:** Con Forge separado (DEC-007), quedó despejado el impedimento
  que había detenido la Tarea 3.2 de ORDEN_TRABAJO.md. Al retomarla se
  encontró además que 3 archivos (`referral.rs`, `state.rs`, `benchmark.rs`)
  llevaban una cabecera restrictiva residual distinta de la detectada en el
  resto (sin la frase "Prohibida la reproducción", por eso no apareció en el
  primer barrido) — corregida en la misma pasada.
- **Problema:** ¿Cómo licenciar formalmente el cliente público DIX Windows
  como AGPL-3.0-only sin dejar cabeceras contradictorias, sin afectar a
  Forge (ya excluido) ni a `dix-proxy` (ya excluido), y sin introducir
  dependencias incompatibles?
- **Decisión:** `LICENSE` (texto oficial AGPL-3.0 de gnu.org) en la raíz del
  repositorio. `license = "AGPL-3.0-only"` en `apps/desktop-tauri/src-tauri/
  Cargo.toml` (antes `LicenseRef-Proprietary`) y en `apps/desktop-tauri/
  dix-cli/Cargo.toml` (antes sin campo). `"license": "AGPL-3.0-only"` en
  `apps/desktop-tauri/package.json`. Cabecera `SPDX-License-Identifier:
  AGPL-3.0-only` + `Copyright © 2026 DixSystem` en los 39 archivos fuente
  propios (`.rs`/`.ts`/`.tsx`) de `apps/desktop-tauri` y `dix-cli`,
  sustituyendo toda cabecera restrictiva previa ("Todos los derechos
  reservados", "Prohibida la reproducción..."). Sin cabecera en lockfiles,
  assets, configuración mecánica (`tsconfig*.json`, `vite.config.ts`,
  `tauri.conf.json`) ni dependencias de terceros. `apps/dix-forge/` excluido
  por completo de este cambio — mantiene `LicenseRef-Proprietary` y ya está
  fuera del repositorio público (`.gitignore`, DEC-007).
- **Revisión de dependencias:** todas las dependencias de
  `apps/desktop-tauri` (Rust: tauri, serde, reqwest, tokio, dirs, keyring,
  chrono, thiserror, uuid, sha2, winreg, windows — todas MIT/Apache-2.0
  dual; JS: React, Vite, TypeScript, ESLint, paquetes `@tauri-apps/*` — todas
  MIT) son compatibles con AGPL-3.0. Ninguna dependencia GPL-incompatible.
  No se añadió ninguna dependencia nueva en esta tarea.
- **Consecuencias:** Positivo — DIX Windows queda formalmente licenciado,
  coherente con lo que el repositorio `dixsystem/Dix` ya distribuye
  públicamente; cierra la Tarea 3.2 de ORDEN_TRABAJO.md. Negativo /
  pendiente — los releases ya publicados (v1.0.7–v1.0.11) no llevan la nueva
  licencia; solo el próximo release la incluye. Quedan pendientes las
  Tareas 3.3 (BYOK) y 3.4 (README de lanzamiento) de ORDEN_TRABAJO.md.
- **Documentos relacionados:** `LICENSE` (nuevo, raíz), `docs/ORDEN_TRABAJO.md`
  (Tarea 3.2), `DEC-007`, `docs/engineering/BITACORA_DIXSYSTEM.md`.

---

## DEC-009 — BYOK expuesto en UI (Tarea 3.3)

- **Fecha:** 2026-07-03
- **Estado:** Aprobada
- **Contexto:** Al reconstruir el estado real de BYOK se encontró que el
  backend ya existía casi completo y bien diseñado en `memory.rs`
  (`save_api_key`/`get_api_key_from_store`/`clear_api_key`, con llavero del
  sistema operativo, fallback y migración desde texto plano) y
  `claude_gateway.rs` (si hay clave propia, llamada directa a Anthropic sin
  pasar por `dix-proxy`) — nadie lo había expuesto a la interfaz.
- **Decisión:** 3 comandos Tauri nuevos en `main.rs` (`byok_save_key`,
  `byok_clear_key`, `byok_status` — este último nunca devuelve la clave, solo
  si existe una) que reexponen la lógica ya existente sin modificarla.
  Componente `ByokSettings.tsx` (input, Guardar, Borrar, indicador de
  estado), enlazado desde `App.tsx`.
- **Consecuencias:** Positivo — BYOK completo con el mínimo cambio posible,
  reutilizando una implementación de seguridad ya correcta en vez de
  duplicarla. Negativo / pendiente — ninguno detectado.
- **Documentos relacionados:** `apps/desktop-tauri/src/components/
  ByokSettings.tsx`, `docs/ORDEN_TRABAJO.md` (Tarea 3.3), `DEC-008`.

---

## DEC-010 — README honesto y cierre de la Fase 3 (open-core)

- **Fecha:** 2026-07-03
- **Estado:** Aprobada
- **Decisión:** `README.md` reescrito: cubre Windows y Linux (antes solo
  Linux), explica licencia AGPL-3.0-only, separación de `dix-proxy`/Forge,
  BYOK, límites reales, y retira claims no verificables ("primera AppIA del
  mundo", promesas de mejora universal). Con esto quedan cerradas las cuatro
  tareas de la Fase 3 de `ORDEN_TRABAJO.md` (corte público/privado, licencia,
  BYOK, README).
- **Consecuencias:** Positivo — el repositorio público queda coherente de
  principio a fin: código, licencia y documentación dicen lo mismo.
  Pendiente — GIF de demo real (placeholder en el README).
- **Documentos relacionados:** `README.md`, `docs/ORDEN_TRABAJO.md` (Fase 3),
  `DEC-007`, `DEC-008`, `DEC-009`.
