# HERRAMIENTAS_EXTERNAS.md — Herramientas Externas del Entorno de Desarrollo de DixSystem

> Este documento clasifica las herramientas externas (no fabricadas por DixSystem)
> que se usan durante el desarrollo del ecosistema, y fija la regla arquitectónica
> que gobierna cómo se integran. No define arquitectura de producto — eso vive en
> `DIRECTIVA_FUNDACIONAL.md`. Este documento vive en `docs/architecture/` porque su
> contenido es una regla arquitectónica (cómo se acopla el ecosistema a terceros),
> no una decisión de alcance o prioridad (eso sería `ORDEN_TRABAJO.md`).

---

## Principio arquitectónico general

**DixSystem no se acopla directamente a herramientas externas de desarrollo.**

Toda herramienta externa (automatización de navegador, testing, CI, generación de
vídeo, etc.) se trata como una **implementación intercambiable** detrás de una
abstracción propia de DixSystem, nunca como una dependencia estructural invocada
directamente desde el código o los procesos del ecosistema. Las herramientas
cambian; la abstracción que las envuelve, no — mismo principio que la Regla Final
de `DIRECTIVA_FUNDACIONAL.md` ("las herramientas cambiarán... lo único que debe
permanecer es la arquitectura").

Esto es distinto de la política de IA (Local First, H1 de RFC-001): esta regla
gobierna herramientas de automatización/desarrollo, no modelos de lenguaje.

---

## Browser Automation & Visual Validation Tools

**Clasificación:** Herramienta externa de desarrollo / *Browser Automation Adapter*.

**Qué NO es:** no es AppIA, no es System Forge, no es Nexus, no es Knowledge Core,
no es parte del producto final que se vende a un usuario. Es una herramienta
auxiliar conectada al entorno de desarrollo de DixSystem.

### Función dentro de DixSystem

- Dar capacidad visual a Claude Code durante el desarrollo.
- Permitir navegación web controlada.
- Probar interfaces locales.
- Inspeccionar DOM y CSS.
- Realizar capturas de pantalla.
- Validar flujos de usuario.
- Automatizar pruebas visuales.
- Ayudar en auditorías UX/UI.
- Verificar páginas generadas por DIX Forge o futuras AppIAs.

### Regla arquitectónica

DixSystem no debe depender directamente de GStack (ni de ningún motor de
automatización concreto). Debe existir una abstracción propia —
`BrowserAutomationProvider` o `VisualValidationAdapter` — donde GStack sea solo
una implementación posible entre varias intercambiables:

- GStack
- Playwright
- Puppeteer
- Selenium
- Chromium headless
- Chromium headed

Ninguna de estas herramientas debe convertirse en un requisito estructural del
ecosistema. Si GStack deja de mantenerse, deja de ser adecuado, o aparece una
alternativa mejor, el cambio debe limitarse a sustituir la implementación detrás
del adaptador — sin tocar el resto del ecosistema.

### Estado de implementación actual (2026-07-01)

Hoy GStack se invoca de forma directa (Skill tool / CLI compilado `$B`) como
herramienta de desarrollo, sin capa `BrowserAutomationProvider` todavía — es uso
directo de una herramienta de terceros durante el desarrollo, no una integración
de producto ni un acoplamiento en tiempo de ejecución de ninguna AppIA. Construir
la abstracción formal ahora sería complejidad sin necesidad real todavía (mismo
principio de creación perezosa ya aprobado para documentación de gestión en H2 de
RFC-001). El adaptador se construye **solo cuando exista una necesidad real
demostrable** — por ejemplo, si DIX Forge o una AppIA necesitan automatización de
navegador como parte de su propio comportamiento en producción, no solo como
herramienta de desarrollo.

### Uso recomendado hoy

GStack puede usarse ahora como herramienta de desarrollo para:

- verificar dixsystem.com,
- probar DIX Forge,
- revisar interfaces Tauri/web,
- validar formularios,
- hacer capturas,
- detectar errores visuales,
- documentar incidencias (bug reports con evidencia visual).

---

## Historial de versiones

- **v1.0 (2026-07-01)** — Primera versión. Clasifica GStack Browser como
  herramienta externa de desarrollo, no como componente nuclear de la
  arquitectura. Fija la regla de no-acoplamiento directo y el patrón adaptador
  (`BrowserAutomationProvider` / `VisualValidationAdapter`) para cualquier
  herramienta de automatización de navegador futura. Decisión directa de Alonso
  (CEO); ver DEC-002 en `docs/engineering/DECISIONES.md`.
