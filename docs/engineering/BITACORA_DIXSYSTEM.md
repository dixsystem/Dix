# BITÁCORA_DIXSYSTEM.md — Historia Cronológica de DixSystem

> Este documento responde a una única pregunta: **"¿Qué ocurrió?"**
>
> No almacena conversaciones ni chats. Almacena conocimiento de ingeniería sintetizado:
> qué se hizo, qué se decidió, qué se aprendió. Nunca se borran entradas anteriores. Si
> la sesión continúa el mismo día, se actualiza la entrada de ese día. Orden
> cronológico siempre, entradas más recientes al final del documento.

**Formato de cada entrada:**

```
## AAAA-MM-DD

**Estado general del proyecto:**
**Trabajo realizado:**
**Implementaciones:**
**Decisiones arquitectónicas:**
**Problemas encontrados:**
**Soluciones aplicadas:**
**Auditorías realizadas:**
**Lecciones aprendidas:**
**Cambios de visión:**
**Ideas futuras:**
**Pendientes:**
**Próximo objetivo:**
**Observaciones del Director Técnico:**
**Observaciones Arquitectónicas:**
**Conclusión del día:**
```

---

## 2026-07-01

**Estado general del proyecto:** DIX Forge en desarrollo activo (Prompt Factory,
Knowledge Core, Context Engine, Biblioteca LLM ya existen en código con tests
pasando). El producto vendible (DIX Windows) sigue en Fase 0/1 de
`docs/ORDEN_TRABAJO.md`, sin venta confirmada todavía. En paralelo, Alonso decidió
formalizar la gobernanza del ecosistema DixSystem con una Directiva Fundacional.

**Trabajo realizado:** Alonso redactó la propuesta v1.0 de la "Directiva
Fundacional" (arquitectura oficial de DixSystem: NEXUS → Knowledge Core → ... →
AppIAs, Constitución de 11 principios, roles fijos por nombre de modelo, Prompt
Score/Confidence Score como métricas cualitativas). Pidió auditoría crítica como
Director Técnico, no aprobación automática.

**Implementaciones:**
- `docs/architecture/DIRECTIVA_FUNDACIONAL.md` — v1.1, redactada tras la primera
  auditoría, incorporando jerarquía documental con `ORDEN_TRABAJO.md`, degradando
  Experience Core / Mentor Engine / Model Router a "Visión Futura", eliminando
  nombres de modelo concretos de la Constitución (sustituidos por roles funcionales),
  dejando Prompt Score / Confidence Score como principios (fórmula solo en código),
  y añadiendo reversibilidad arquitectónica, patrimonio del conocimiento,
  procedimiento de enmienda y congelación de expansión.
- `docs/architecture/RFC-001_DIRECTIVA_PENDIENTES.md` — 11 hallazgos de la auditoría
  adversarial de la v1.1, tratados como ADR (problema / impacto / opciones /
  ventajas / inconvenientes / recomendación técnica / decisión pendiente). Ninguno
  resuelto todavía.
- `docs/engineering/DECISIONES.md` y `docs/engineering/BITACORA_DIXSYSTEM.md` (este
  documento) — Sistema Oficial de Memoria de Ingeniería, aprobado por Alonso.

**Decisiones arquitectónicas:**
- DEC-001: adopción del Sistema de Bitácora y Registro de Decisiones (ver
  `DECISIONES.md`).
- Ninguna decisión de la Directiva Fundacional está aprobada todavía de forma
  definitiva — v1.1 queda pendiente de que se resuelvan los hallazgos H1-H3 (y
  medios/bajos) del RFC-001 antes de redactar v1.2.

**Problemas encontrados:**
- v1.0 tenía 6 riesgos de escalabilidad/mantenibilidad/gobernanza (sin jerarquía
  con ORDEN_TRABAJO, arquitectura sobre-especificada sin código real detrás,
  nombres de modelo incrustados en un documento permanente, Prompt/Confidence Score
  sin mecanismo pese a existir ya una implementación funcional, Experience Core
  declarado oficial sin código, sin procedimiento de enmienda).
- v1.1, tras auditoría adversarial "RFC final", reveló 11 hallazgos nuevos: 3 altos
  (H1: Local First universal contradice la arquitectura real de DIX, que usa Claude
  vía proxy como backend estructural del tier de pago; H2: la Jerarquía Documental,
  aplicada literalmente, deslegitima el desarrollo activo de DIX Forge porque
  `ORDEN_TRABAJO.md` no lo menciona en ninguna línea; H3: el Procedimiento de
  Enmienda basado en evidencia puede chocar con la autoridad de "decisión final" de
  Alonso), 5 medios y 3 bajos (ver RFC-001 para detalle completo).

**Soluciones aplicadas:** Ninguna todavía — Alonso decidió explícitamente resolver
las decisiones arquitectónicas del RFC-001 una por una antes de redactar la v1.2 de
la Directiva. "Nuestro objetivo no es terminar rápido. Nuestro objetivo es que
dentro de diez años sigamos estando de acuerdo con estas decisiones."

**Auditorías realizadas:**
- Auditoría inicial de la v1.0 (rol Director Técnico) — 6 riesgos, documento
  rechazado en su forma original.
- Auditoría adversarial de la v1.1 (nivel "RFC final", objetivo explícito: romper
  el documento, no defenderlo) — 11 hallazgos catalogados en RFC-001.

**Lecciones aprendidas:**
- Un documento de gobernanza debe auditarse contra el código y los documentos de
  producto reales (`ORDEN_TRABAJO.md`, `biblioteca_llm.rs`, `prompt_factory/mod.rs`),
  no solo contra su propia coherencia interna — varios de los hallazgos más graves
  (H1, H2) solo aparecieron al contrastar la Directiva con la arquitectura real y
  con el otro documento de mayor jerarquía.
- Los principios que fijan "el qué" y dejan "el cómo" al código (Prompt Score,
  Confidence Score) envejecen mejor que los que intentan definir una fórmula en
  prosa — patrón ya validado en v1.1 y recomendado de nuevo para el "estándar
  DixSystem" (M5, pendiente).

**Cambios de visión:** Ninguno sobre la Misión/Visión/Principio Rector — se
mantienen intactos desde v1.0. Los cambios de la v1.1 son de alcance y precisión de
cláusulas, no de filosofía de fondo.

**Ideas futuras:** Ver "Arquitectura Objetivo" en `DIRECTIVA_FUNDACIONAL.md`
(Experience Core, Mentor Engine, Model Router) — explícitamente no vinculantes hasta
validación comercial de DIX Windows.

**Pendientes:** Resolver H2, H3 y M1-M5 del RFC-001 antes de redactar la v1.2 de la
Directiva Fundacional. L1-L3 pueden diferirse si se decide explícitamente.

**Próximo objetivo:** Resolver H2 en el mismo formato de Consejo de Arquitectura
(exportación íntegra del ADR → deliberación → auditoría crítica de contrapropuestas →
decisión consensuada), y después H3.

**Actualización — Consejo de Arquitectura (mismo día):** Se constituyó formalmente el
Consejo de Arquitectura (Alonso = CEO/decisión final, Claude Code = Director Técnico,
ChatGPT = Arquitecto del Ecosistema) para deliberar el RFC-001 hallazgo por hallazgo,
empezando por H1. El Arquitecto del Ecosistema propuso sustituir la separación
Forge/AppIAs por Infraestructura/Productos. Auditoría crítica del Director Técnico:
la idea de fondo (exención por rol arquitectónico, no por nombre de herramienta) es
una mejora real y duradera, pero la redacción original dejaba sin clasificar
`dix-proxy` y DIX Atlas, pudiendo reintroducir la contradicción de H1 en vez de
resolverla. El Consejo aprobó una versión fusionada que divide "Infraestructura" en
dos niveles explícitos — **Infraestructura de Fabricación** (Forge, Knowledge Core,
Context Engine, Biblioteca LLM, Prompt Factory: Local First estricto) e
**Infraestructura de Producto** (proxies/workers que sirven tráfico en vivo, p. ej.
`dix-proxy`, DIX Atlas: pueden usar modelos premium bajo condiciones de accountability
explícitas — justificable, medible con método concreto, reemplazable, nunca oculta) —
y subordina explícitamente el nuevo principio "mejor solución posible" a Local First
dentro de la Infraestructura de Producto. **H1 queda RESUELTO** en
`docs/architecture/RFC-001_DIRECTIVA_PENDIENTES.md`, con el texto listo para
incorporarse a la v1.2 de la Directiva. H2 y H3 siguen abiertos.

**Actualización — H2 resuelto (mismo día):** El Consejo de Arquitectura deliberó H2
(Jerarquía Documental vs. legitimidad de Forge). El Arquitecto del Ecosistema propuso
sustituir la excepción puntual de Forge por una jerarquía documental oficial de cinco
niveles (Visión → Directiva Fundacional → ORDEN_TRABAJO → Roadmaps → Sprints), donde
cada sistema estratégico (Forge, Nexus, DIX, Atlas) tiene su propio Roadmap. Auditoría
del Director Técnico: la idea generaliza mejor que la excepción puntual, pero dejó
tres preguntas abiertas (nivel de ORDEN_TRABAJO, granularidad de Atlas, identidad de
Nexus) que solo Alonso podía responder. El CEO respondió: Nexus es su proyecto
personal, hoy no integrado en DixSystem (debe pasar de "Arquitectura Vigente" a
"Arquitectura Objetivo" en la Directiva); ORDEN_TRABAJO no se divide, funciona como el
Roadmap de DIX; Atlas permanece dentro de ORDEN_TRABAJO mientras no tenga evolución
independiente; se aprueba un principio de creación perezosa de documentación de
gestión. El Arquitecto propuso además una cláusula de legitimidad temporal para
sistemas sin Roadmap propio (como Forge hoy), anclada en gobernanza institucional
(Directiva + decisiones del Consejo) en vez de en el criterio de una persona
concreta. Verificación cruzada sin incompatibilidades. **H2 queda RESUELTO.**
Pendiente para la v1.2: reestructurar el diagrama de "Arquitectura Vigente" para que
no arranque en NEXUS.

**Actualización — Gobernanza de Ingeniería (mismo día):** A petición del CEO se
redactó `docs/engineering/GOBERNANZA_INGENIERIA.md` v1.0 (BORRADOR, no oficial): 10
secciones definiendo propósito, principios, Consejo de Arquitectura, proceso oficial
de decisión, documentos oficiales, reglas de gobernanza, niveles de decisión, calidad
de las decisiones, evolución y relación con la Directiva. Las Secciones 7 y 9 quedaron
marcadas explícitamente como provisionales por depender de H3, todavía abierto en ese
momento. El CEO decidió no aprobarlo hasta cerrar H3 y volver a auditar completo —
mismo rigor aplicado a H1/H2.

**Actualización — H3 resuelto (mismo día):** El Consejo deliberó H3 (Procedimiento de
Enmienda vs. autoridad de "decisión final" del CEO). El Arquitecto del Ecosistema
propuso, sobre la Opción 2 (enmiendas estructurales vs. de rumbo), un modelo de tres
niveles: **Decisiones Constitucionales** (principios/arquitectura/gobernanza —
evidencia + Consejo + CEO), **Decisiones Estratégicas** (prioridades/alcance/
Roadmaps/planificación — responsabilidad del CEO, no requieren modificar la
Constitución) y **Decisiones Operativas** (implementación técnica — responsabilidad
del Director Técnico). Auditoría del Director Técnico: mejora real sobre la Opción 2,
cierra de paso la Sección 7 de Gobernanza, pero dejaba una rendija — "Decisiones
Estratégicas" podían, en teoría, contradecir una decisión constitucional ya aprobada
(p. ej. la Congelación de Expansión) sin pasar por enmienda. Se cerró con una cláusula
de coherencia explícita. Verificación cruzada contra H1, H2, M1-M5 y L1-L3 sin
incompatibilidades bloqueantes. **H3 queda RESUELTO.** Con esto, los tres hallazgos de
severidad ALTA del RFC-001 están cerrados; quedan pendientes M1-M5 (medios) y L1-L3
(bajos) antes de poder redactar la v1.2 y volver a auditar Gobernanza.

**Observaciones del Director Técnico:** El proceso que Alonso está aplicando a la
Directiva (auditar, no aprobar por autoridad; romper antes de aceptar; separar
decisión de implementación en un RFC) es exactamente el mismo rigor que ya se aplica
al código de Prompt Factory (feature flags, modo shadow, rollout por fases). Es
coherente extender ese mismo nivel de exigencia a los documentos que gobiernan el
propio proceso de ingeniería.

**Observaciones Arquitectónicas:** La tensión más importante detectada hasta ahora
(H2) no es un defecto de redacción sino una señal real: DIX Forge se está
construyendo sin encaje formal en el sistema único de prioridades (`ORDEN_TRABAJO.md`).
Resolver H2 no es solo corregir un texto — es decidir si Forge necesita su propio
espacio de prioridad reconocido o si debe permanecer deliberadamente fuera de ese
sistema.

**Actualización — Clasificación de GStack Browser (mismo día):** Tras instalar y
verificar GStack (framework de automatización de navegador) como herramienta de QA
visual para Claude Code, Alonso pidió fijar su lugar en la arquitectura antes de que
su uso se normalizara sin clasificación explícita. Se creó
`docs/architecture/HERRAMIENTAS_EXTERNAS.md` v1.0, con la sección "Browser
Automation & Visual Validation Tools": GStack queda clasificado como Herramienta
externa de desarrollo / Browser Automation Adapter — no AppIA, no System Forge, no
Nexus, no Knowledge Core, no parte del producto final. Se fija la regla de que
DixSystem no debe acoplarse directamente a GStack; cualquier integración futura
debe pasar por una abstracción propia (`BrowserAutomationProvider` /
`VisualValidationAdapter`), de la que GStack, Playwright, Puppeteer, Selenium o
Chromium headless/headed serían implementaciones intercambiables. Registrado como
**DEC-002** en `DECISIONES.md`. No toca `DIRECTIVA_FUNDACIONAL.md` (sigue congelada
hasta cerrar RFC-001) ni crea un nuevo subsistema — es una regla operativa sobre
herramientas de desarrollo, sin conflicto con la Congelación de Expansión.

**Actualización — M1 resuelto (mismo día):** Se retomó el RFC-001 en M1 ("grandes
subsistemas" sin umbral objetivo). Alonso, tras revisión del Arquitecto del
Ecosistema conforme a la Opción 1, propuso sustituir el umbral técnico por "impacto
arquitectónico" (2 de 6 criterios). Auditoría del Director Técnico detectó tres
problemas: dos criterios solapados ("dominio funcional" / "responsabilidad
arquitectónica"), tres criterios vagos sin heurístico (mismo patrón que L3, abierto),
y una incompatibilidad concreta con M2 — el propio ejemplo de "persistir el shadow
log" activaba el umbral propuesto, clasificándolo como subsistema nuevo cuando M2
necesita justo lo contrario. Alonso refinó la propuesta: colapsó los dos criterios
solapados en uno solo ("nueva capacidad arquitectónica independiente", con
heurístico propio: ciclo de vida propio, evolución independiente, gobernanza propia,
o misión distinta) y añadió dos notas — la primera generaliza la excepción del
shadow log a cualquier persistencia de información adicional de un sistema
existente; la segunda aclara que "Browser Validation System" (hipotético subsistema
interno) no debe confundirse con GStack Browser (herramienta externa, DEC-002).
Auditoría final: los tres problemas quedan resueltos, sin incompatibilidades nuevas.
**M1 queda RESUELTO** con la regla CASO A (nueva capacidad arquitectónica
independiente) / CASO B (2 de 3 criterios técnicos: módulo top-level, esquema
persistido, API pública), lista para incorporarse a la Congelación de Expansión de
la v1.2. Quedan pendientes M2-M5 y L1-L3 antes de redactar esa versión.

**Actualización — M2 resuelto (mismo día):** Se retomó el RFC-001 en M2 (Principio 3
incumplido por congelación de su único mecanismo). Alonso, tras revisión del
Arquitecto del Ecosistema conforme a la Opción 1, propuso reforzar la justificación
conceptual distinguiendo dos niveles: **Nivel 1** (captura y persistencia de
experiencia — el Shadow Log) y **Nivel 2** (procesamiento, síntesis y aprendizaje —
Experience Core en sí). La Congelación de Expansión impide el Nivel 2, no el Nivel 1.
Auditoría del Director Técnico: la distinción es correcta y consecuencia directa de
M1 (persistir el shadow log no activa CASO A ni CASO B). Se detectó un hallazgo no
bloqueante: `DIRECTIVA_FUNDACIONAL.md` v1.1 llama al shadow log "embrión real" de
Experience Core, identificándolo con el propio Experience Core, mientras que la
nueva distinción dice lo contrario — no es contradicción irreconciliable, es
exactamente la ambigüedad que M2 resuelve, pero requiere reescribir esa frase en la
v1.2 (registrado como pendiente, mismo tratamiento que el pendiente ya abierto en
H2 sobre el diagrama de Arquitectura Vigente). **M2 queda RESUELTO**, con Nivel
1/Nivel 2 y la condición de que toda extensión de Nivel 1 siga superando el test de
M1. Con esto, quedan resueltos H1, H2, H3, M1 y M2; pendientes M3-M5 y L1-L3.

**Actualización — M3 resuelto (mismo día):** Se retomó el RFC-001 en M3 (gate de
"validación comercial de DIX Windows" sin dueño ni registro auditable). El Consejo,
tras revisión del Arquitecto del Ecosistema conforme a la Opción 1, propuso
reforzar el mecanismo con un **Evento de Gobernanza**: todo evento que modifique el
estado estratégico del ecosistema queda registrado mediante un expediente auditable
de ocho campos (identificador, tipo, fecha, evidencia objetiva, verificador,
decisión del Consejo, consecuencias, documentos afectados). Auditoría del Director
Técnico detectó cuatro puntos a aclarar: riesgo de crear un documento nuevo no
contemplado en `GOBERNANZA_INGENIERIA.md`, autocomprobación bajo M1, el sub-problema
de "ventas caen a cero tras la primera venta" sin resolver explícitamente, y el rol
de "verificador" sin asignación por defecto. El Consejo respondió a los cuatro:
el expediente vive como entradas estructuradas dentro de `BITACORA_DIXSYSTEM.md` (no
documento nuevo, mismo patrón que DEC-001 ya usó para lecciones aprendidas); no
constituye nuevo subsistema bajo M1 (verificado explícitamente: sin ciclo de vida
propio, sin gobernanza separada, misma misión, sin módulo/esquema/API en código);
el umbral tras la primera venta queda deliberadamente diferido hasta evidencia real
del negocio; el "verificador" es por defecto el Director Técnico (sin crear rol ni
asiento nuevo), con deliberación del Consejo y aprobación final del CEO. **M3 queda
RESUELTO.** Pendiente registrado (no bloqueante): incorporar el esquema de Evento
de Gobernanza a `GOBERNANZA_INGENIERIA.md` cuando se actualice tras cerrar el
RFC-001 completo. Con esto, quedan resueltos H1, H2, H3, M1, M2 y M3; pendientes
M4-M5 y L1-L3.

**Actualización — M4 resuelto (mismo día):** Se retomó el RFC-001 en M4
(inconsistencia entre las dos listas de roles/especialidades — Marketing aparecía en
la lista de Model Router pero no en Roles Funcionales). El Consejo, tras revisión
del Arquitecto del Ecosistema conforme a la Opción 1, propuso ir más allá de
unificar dos listas: establecer una **Taxonomía Oficial de Especialidades**, única
fuente oficial de qué especialidades existen en DixSystem. Auditoría del Director
Técnico detectó dos puntos: riesgo de crear un documento nuevo no contemplado en
`GOBERNANZA_INGENIERIA.md` (mismo riesgo que en M3), y riesgo de que fusionar las
listas sin distinción de estado borrara la diferencia Vigente/Objetivo que H2 ya
estableció (Model Router, con su especialidad Marketing, sigue congelado). El
Consejo respondió: la Taxonomía vive dentro de la Directiva Fundacional (sección
Roles Funcionales y Responsabilidades, no documento nuevo); BibliotecaLLM sigue
siendo el único lugar de asignación de modelos; se incorpora un estado
arquitectónico documental por especialidad — Vigente, Planificada, Experimental,
Retirada — sin implicar implementación ni tocar la Congelación de Expansión.
Auditoría final: sin incompatibilidades, ambos puntos resueltos de forma coherente
con H2 y M1. **M4 queda RESUELTO.** Con esto quedan resueltos H1, H2, H3, M1, M2, M3
y M4; pendientes M5 y L1-L3.

**Actualización — M5 resuelto, cierre de hallazgos MEDIA (mismo día):** Se retomó
el RFC-001 en M5 ("Estándar DixSystem" del Principio 4 sin definir). El Consejo,
tras revisión del Arquitecto del Ecosistema, propuso un modelo de tres niveles:
Nivel 1 (Directiva — establece la existencia del estándar como requisito
obligatorio), Nivel 2 (Gobernanza — define el procedimiento de evolución y
aprobación por el Consejo), Nivel 3 (Motor de Validación DixSystem — implementa
técnicamente los criterios vigentes; el código deja de ser la fuente y pasa a ser
la implementación). Auditoría del Director Técnico detectó dos puntos: (1) sin
especificar dónde vive el contenido concreto de los criterios, la distinción
fuente/implementación es solo semántica; (2) riesgo real de que el Motor de
Validación cruzara el umbral de M1 y quedara congelado hasta la venta de DIX
Windows, dejando a M5 sin mecanismo operativo. El Consejo resolvió el Punto 2: el
Motor de Validación se define oficialmente como extensión de Prompt Factory (no
módulo nuevo) — verificado explícitamente que no activa CASO A ni CASO B de M1, y
que la validación técnica ya convivía con Prompt Factory (`reglas_dixsystem()` ya
está en `prompt_factory/mod.rs`). El Punto 1 se cerró reutilizando infraestructura
ya existente: cada cambio futuro al estándar sigue el proceso de Nivel 2 y queda
registrado como entrada vigente en `DECISIONES.md`, sin crear ningún documento
nuevo. **M5 queda RESUELTO — con esto, los cinco hallazgos ALTOS y MEDIOS del
RFC-001 (H1, H2, H3, M1, M2, M3, M4, M5) están cerrados.** Quedan pendientes
únicamente L1, L2 y L3 (severidad baja), y la redacción formal de la v1.2 de la
Directiva junto con la actualización de `GOBERNANZA_INGENIERIA.md`.

**Actualización — L1 resuelto, inicio de hallazgos BAJOS (mismo día):** Alonso
decidió no diferir los hallazgos de severidad baja — "no queremos acelerar el
cierre del RFC-001... no reduciremos el nivel de rigor por tratarse de hallazgos de
severidad baja". Se retomó en L1 (metodología de 8 pasos aplicada sin excepción,
en tensión con la Regla 80/20). El Consejo, tras revisión del Arquitecto del
Ecosistema, propuso que el flujo de 8 pasos permanezca universal e invariable
(ninguna fase se salta nunca), pero que la **profundidad** de cada fase sea
proporcional al alcance del cambio — un typo recorre las 8 fases de forma casi
inmediata, una modificación arquitectónica las recorre en profundidad completa.
Auditoría del Director Técnico: es una formalización de la Opción 2 ya prevista en
el ADR, que resuelve su propio inconveniente anotado (dejar de ser "indistinguible
de no tener la regla") al nombrar el principio explícitamente. Punto de atención no
bloqueante registrado: "alcance del cambio" sigue siendo un juicio cualitativo,
misma familia de calificador que L3 existe para anclar — queda como dependencia
hacia adelante para cuando se resuelva L3, sin bloquear L1. **L1 queda RESUELTO.**

**Actualización — Consejo de Arquitectura distribuido y L2 resuelto (mismo día):**
Alonso propuso un experimento inédito: conectar a Claude Code (Director Técnico) en
vivo, vía automatización de navegador (GStack), con la conversación real de ChatGPT
donde reside el Arquitecto del Ecosistema — en vez de que Alonso siguiera relayando
manualmente los mensajes entre ambos. Claude Code exportó el ADR L2 dentro de esa
conversación, ChatGPT propuso reforzar la Opción 1 delimitando explícitamente el
Principio 12 (Reversibilidad) al ámbito arquitectónico, distinto del ámbito de
negocio gobernado por ORDEN_TRABAJO. Claude Code auditó la propuesta en directo:
sin conflicto con H1 (ejes distintos), pero detectó que el razonamiento exploratorio
de ChatGPT reutilizaba "Estratégica" y "Operativa" (ya definidas en H3 con otro
significado) para una posible taxonomía futura de dominios de decisión — riesgo de
colisión semántica. ChatGPT aceptó la observación íntegramente y retiró esa
nomenclatura provisional, dejando anotado que un futuro "Mapa de Dominios de
Decisión" deberá usar términos propios. La conclusión volvió al Consejo (Alonso),
quien la validó formalmente. **L2 queda RESUELTO.** Primer experimento exitoso de
deliberación técnica directa entre dos IAs con roles distintos sobre la misma
gobernanza, con el Consejo humano validando el resultado antes de documentarlo —
sin que ninguna de las dos IAs intentara "convencer" a la otra por encima del
argumento técnico.

**Conclusión del día:** Se estableció el Sistema Oficial de Memoria de Ingeniería de
DixSystem. La Directiva Fundacional sigue en v1.1, no aprobada. De los 11 hallazgos
de RFC-001, quedan resueltos H1, H2, H3, M1, M2, M3, M4, M5, L1 y L2; pendiente
únicamente L3 antes de redactar la v1.2. No se ha tocado código de producto ni de
Forge en esta sesión — todo el trabajo fue de gobernanza y documentación, incluida
la clasificación de GStack Browser como herramienta externa (DEC-002) y el primer
experimento de Consejo de Arquitectura distribuido.

---

## 2026-07-02

**Estado general del proyecto:** Continuación directa de la sesión anterior. Único
pendiente del RFC-001 era L3 (calificadores vagos sin heurístico mínimo).

**Trabajo realizado:** Se intentó automatizar la deliberación con el Arquitecto del
Ecosistema (ChatGPT) vía GStack Browser en modo headless — bloqueado por el reto
anti-bot de Cloudflare en chatgpt.com ("Verify you are human"), confirmado con
captura de pantalla. Se descartó también el modo headed (SIGSEGV de sandbox, ya
documentado en sesiones previas). Se continuó con relay manual entre Alonso, el
Arquitecto del Ecosistema y el Director Técnico, usando un Chromium real (proceso
`/snap/bin/chromium`) abierto en chatgpt.com para que Alonso operara la conversación
del lado de ChatGPT.

**Decisiones arquitectónicas:** Se cerró **L3 — RESUELTO**. Se sustituyeron los
ejemplos independientes por sección (propuesta original de la Opción 1) por un
único bloque de **Heurísticos Arquitectónicos** con siete criterios ilustrativos
(impacto multi-sistema, datos persistidos, reversibilidad limitada, impacto
económico real, interfaces públicas, principios/gobernanza, existencia de
alternativa funcional razonablemente viable) y una **cláusula de precedencia**: los
tests específicos ya aprobados (Test Estructural de M1, niveles de decisión de H3)
prevalecen sobre el bloque general. El séptimo criterio cierra un pendiente
heredado de H1 ("reemplazable cuando sea razonablemente posible"). "Alcance del
cambio" (dependencia pendiente desde L1) se resolvió como propiedad emergente del
resto de criterios, no como heurístico autónomo — evita la circularidad de incluir
dentro de la lista el propio término que la lista debía calibrar.

**Auditorías realizadas:** Dos rondas de auditoría del Director Técnico sobre la
propuesta del Consejo/Arquitecto del Ecosistema. Primera ronda: detectó contenedor
físico sin especificar, ausencia de cláusula de precedencia frente a M1/H3, y el
pendiente sin cerrar de H1. Segunda ronda (final): confirmó que las tres
correcciones eran válidas, verificó ausencia de doble conteo entre criterios 6 y 7,
y confirmó que todas las dependencias hacia L3 registradas en el resto del
documento (H1, L1) quedaban cerradas. Sin incompatibilidades bloqueantes con
H1-H3, M1-M5 o L1-L2.

**Con esto, los once hallazgos del RFC-001 (H1, H2, H3, M1, M2, M3, M4, M5, L1, L2,
L3) quedan RESUELTOS. El Consejo de Arquitectura declaró oficialmente cerrado el
RFC-001** y autorizó el inicio de la redacción de la Directiva Fundacional v1.2.

**Pendientes:** Redacción formal de la Directiva Fundacional v1.2, incorporando
todas las decisiones aprobadas en `RFC-001_DIRECTIVA_PENDIENTES.md` y resolviendo
los cinco ajustes de redacción registrados como no bloqueantes (diagrama de
Arquitectura Vigente sin Nexus — H2; frase "embrión real" de Experience Core — M2;
esquema de Evento de Gobernanza en `GOBERNANZA_INGENIERIA.md` — M3; procedimiento de
evolución del Estándar DixSystem en `GOBERNANZA_INGENIERIA.md` — M5; contenedor
físico del bloque de Heurísticos Arquitectónicos — L3). Antes de adquirir carácter
oficial, la v1.2 deberá superar auditoría técnica, revisión del Arquitecto del
Ecosistema, verificación cruzada y aprobación final del Consejo de Arquitectura.

**Próximo objetivo:** Redactar la Directiva Fundacional v1.2.

**Actualización — Retrospectiva Arquitectónica del RFC-001 (mismo día):** Antes de
redactar la v1.2, Alonso pidió analizar el proceso completo del RFC-001 (no el
contenido, el propio método) para extraer principios descubiertos, patrones
recurrentes, decisiones acertadas, mejoras metodológicas y lecciones aprendidas.
El Director Técnico entregó la retrospectiva completa; el Consejo la aprobó con
cinco ajustes: el Principio de Especificidad se incorporará primero a
`GOBERNANZA_INGENIERIA.md` (no a la Directiva, hasta demostrar utilidad en varios
RFC); el glosario de términos reservados evoluciona hacia una futura Taxonomía
Oficial del Ecosistema (registrada, sin redactar); la metodología del RFC-001 se
nombra oficialmente **Proceso Oficial de Deliberación Arquitectónica de
DixSystem**, procedimiento por defecto para futuros RFC; se registra la idea
futura de **Jurisprudencia Arquitectónica** (RFC importantes como precedentes
reutilizables), sin implementación; y se autoriza preparar un Checklist Único de
Redacción para la v1.2. Documentada en `docs/architecture/RETROSPECTIVA_RFC-001.md`
y `DEC-004`. **Directiva Fundacional sigue sin tocarse — sigue en v1.1.**

**Actualización — Redacción, validación y aprobación de la Directiva Fundacional
v1.2 (mismo día):** Con el Checklist Único de Redacción aprobado (19 ítems: 14
para la Directiva, 5 para Gobernanza), se redactó la v1.2 como **reescritura
completa**, no un parche — cada sección revisada de principio a fin, terminología
unificada, redundancias eliminadas (roles duplicados entre secciones, listas de
especialidades repetidas), nuevas secciones propias (Heurísticos Arquitectónicos,
Niveles de Decisión) para dar contenedor físico a decisiones que antes vivían
dispersas. Pasó después por un proceso de validación independiente de cuatro
fases: **(1) Auditoría Técnica adversarial** del Director Técnico — 11 hallazgos
de coherencia/ensamblaje (contradicción textual sobre quién asigna modelos a
roles, Arquitectura Vigente que excluía la Infraestructura de Producto, términos
usados antes de definirse, entre otros); 6 corregidos de inmediato por ser puro
ensamblaje, 5 diferidos por tocar responsabilidades o gobernanza y devueltos al
Consejo. **(2) Revisión del Arquitecto del Ecosistema** — coherencia filosófica,
consistencia arquitectónica, escalabilidad a "decenas de AppIAs/varios Consejos",
atemporalidad; encontró un hallazgo severo — la Directiva nombraba "Claude Code"
como Director Técnico permanente, violando su propia regla de no incrustar
nombres de producto en un documento constitucional (el mismo motivo por el que
v1.0 fue rechazada en su día). El Consejo aprobó la corrección y la generalizó en
un principio: los documentos constitucionales usan roles, nunca personas,
productos o tecnologías, salvo al narrar hechos históricos — aplicado también a
"Alonso". **(3) Verificación Cruzada Final** contra RFC-001, `DECISIONES.md`,
`BITACORA_DIXSYSTEM.md` y `GOBERNANZA_INGENIERIA.md` — cinco incompatibilidades
encontradas, las cinco exclusivas de `GOBERNANZA_INGENIERIA.md` (todavía borrador,
con secciones desactualizadas desde antes de que H3 cerrara), ninguna bloqueante
para la Directiva. **(4) Deliberación final del Consejo** — Director Técnico y
Arquitecto del Ecosistema confirmaron, cada uno por separado, que elegirían esta
v1.2 sin cambiar ninguna decisión arquitectónica si empezaran DixSystem desde
cero. El Consejo declaró concluido el proceso de ingeniería por unanimidad.

**El CEO emitió la Resolución Fundacional RES-001**
(`docs/architecture/RES-001_RESOLUCION_FUNDACIONAL.md`, ver también `DEC-005`):
aprueba oficialmente la Directiva Fundacional v1.2, declara la pérdida de vigencia
de la v1.1, pone en vigor la v1.2 de forma inmediata, y la declara formalmente
**Constitución oficial de DixSystem** — la primera en la historia del ecosistema.
Autoriza el inicio de la auditoría de `GOBERNANZA_INGENIERIA.md` como siguiente
fase de madurez, usando las cinco incompatibilidades detectadas como punto de
partida. **Con esta resolución, el RFC-001 queda oficialmente concluido en todas
sus fases.**

**Actualización — Auditoría integral de GOBERNANZA_INGENIERIA.md y RES-002 (mismo
día):** Autorizada por RES-001 como siguiente fase de madurez, se auditó
`GOBERNANZA_INGENIERIA.md` con la misma metodología de quince pasos usada para la
Directiva. Se identificaron quince hallazgos — 2 Críticos (Sección 7 con modelo de
decisión plano previo a H3, contradecía operativamente los Niveles de Decisión ya
vigentes; Sección 6 definía "decisión aprobada" con una vía de tres pasos que
omitía la revisión del Arquitecto y la deliberación del Consejo), 5 Altos (nombres
de persona/producto en el Consejo, Sección 3; duplicidad de principios
constitucionales, Sección 2; orden de la verificación cruzada desalineado con la
práctica real, Sección 4; inventario documental incompleto sin Retrospectiva ni
Resolución, Sección 5; calificador vago "cambio menor" sin conectar con los
Heurísticos Arquitectónicos, Sección 6), 5 Medios (expansión del Consejo definida
en el documento equivocado; contenido prometido en M3/M5/DEC-004 nunca
incorporado; Sección 9 con marca "provisional" obsoleta y sin el mismo rigor de
enmienda que la Directiva; Sección 6 sin mencionar DECISIONES.md como registro;
ausencia de proceso para el caso de rechazo de una propuesta) y 3 Bajos/Observación
(Nexus listado indebidamente como sistema estratégico integrado; notación
"RFC/ADR" de la Directiva sin aclarar frente a la distinción RFC≠ADR de
Gobernanza; criticidad real de Memory subestimada por su clasificación formal).

Los quince se resolvieron sin excepciones, uno por uno, con el ciclo completo:
ADR exportado íntegro, auditoría independiente del Arquitecto del Ecosistema,
verificación del Director Técnico, deliberación del Consejo, aplicación, y
verificación cruzada específica antes de cerrar cada hallazgo. En dos ocasiones
el Arquitecto del Ecosistema corrigió su propia auditoría tras una objeción del
Director Técnico (Hallazgo 1: composición del Consejo; Hallazgo 14: alcance de
la opción aprobada) — el proceso demostró su propia capacidad de autocorrección
antes de cerrar. El Consejo rechazó explícitamente reducir el rigor para los
hallazgos de severidad baja, pese al coste creciente de la sesión.

Con la deliberación final del Consejo declarando concluida la auditoría, el CEO
emitió la **Resolución Ejecutiva RES-002**
(`docs/architecture/RES-002_RESOLUCION_GOBERNANZA.md`, ver también `DEC-006`):
aprueba `GOBERNANZA_INGENIERIA.md` v1.1 (versión incrementada desde v1.0), la
declara **segundo pilar oficial de la gobernanza de DixSystem**, complementaria
a la Directiva Fundacional v1.2.

**Conclusión del día:** RFC-001 cerrado, Retrospectiva aprobada, Directiva
Fundacional v1.2 redactada, auditada, revisada, verificada, deliberada y
aprobada como primera Constitución oficial de DixSystem (RES-001); a
continuación, `GOBERNANZA_INGENIERIA.md` sometida a una auditoría integral de
quince hallazgos y aprobada como segundo pilar oficial (RES-002) — todo en la
misma sesión continua. DixSystem cuenta ahora con sus dos pilares de
gobernanza oficiales y mutuamente verificados.

**Actualización — retorno a ORDEN_TRABAJO.md y separación de DIX Forge (mismo
día):** Con la gobernanza cerrada, se retomó el desarrollo de producto.
Reconstruido el estado real de ORDEN_TRABAJO.md contra el repositorio (el
documento estaba muy desactualizado: Fases 0-2 completas desde hace días,
releases reales v1.0.7-v1.0.11 ya publicados, funcionalidad no documentada
—referidos, DixKontrol— ya en producción). Determinado por evidencia que la
siguiente tarea real era la 3.2 (licencia AGPL-3.0), no la 0.1 que sugería el
documento sin actualizar.

Al analizar el impacto de aplicar AGPL-3.0 se detectó un problema real: el
código de DIX Forge vivía en el mismo crate/binario que el cliente DIX
Windows, sin separación de compilación (solo un flag `--forge` en runtime) —
aplicar AGPL habría obligado a entregar también el código fuente de Forge.
Se detuvo el trabajo, se expuso el análisis, y el Consejo (Alonso) autorizó
separar Forge en un workspace Cargo de tres miembros antes de tocar la
licencia (`DEC-007`).

Ejecutada la separación: verificado por análisis de imports que Forge no
tenía ninguna dependencia inversa hacia el resto del crate (solo un punto de
integración en `main.rs`/`App.tsx`); movidos los 14 módulos de Forge y su
frontend a `apps/dix-forge/` (nuevo binario `dix-forge`, licencia propietaria
propia); limpiado `apps/desktop-tauri` de toda referencia a Forge (comandos,
inicialización, flag, modal, dependencia `sqlx`). Verificación final: los
tres miembros del workspace compilan (`cargo check --workspace` limpio salvo
dos warnings preexistentes sin relación con este cambio), ambos frontends
compilan de forma independiente, y el bundle `dist/` de DIX Windows no
contiene ya ninguna referencia a Forge/Cerebro. CI (`release.yml`,
`build-windows.yml`) ya apuntaba exclusivamente a `apps/desktop-tauri`, sin
cambios necesarios.

**Pendiente:** Tarea 3.2 (AGPL-3.0) queda de nuevo autorizada — ahora sin el
impedimento detectado. Los releases v1.0.7–v1.0.11 ya publicados siguen
conteniendo Forge compilado; solo el primer release posterior a esta
separación queda limpio.

**Actualización — Tarea 3.2 completada, DIX Windows licenciado AGPL-3.0-only
(2026-07-03):** Antes de tocar la licencia se detectó y corrigió un riesgo
real: `apps/dix-forge/` había quedado *staged* en git tras la separación
anterior, apuntando al mismo remoto público `dixsystem/Dix` — se habría
publicado el código fuente de Forge en el próximo push. Añadido a
`.gitignore` y retirado del índice (`git rm --cached`) sin tocar el disco.

Con eso resuelto: `LICENSE` (texto oficial AGPL-3.0) en la raíz; licencia
actualizada en los `Cargo.toml` de `desktop-tauri` y `dix-cli` y en
`package.json`; cabecera `SPDX-License-Identifier: AGPL-3.0-only` en los 39
archivos fuente propios, sustituyendo la cabecera restrictiva anterior
("Prohibida la reproducción..."). Encontrados y corregidos 3 archivos con
una variante de cabecera distinta que el primer barrido no detectó. Revisión
de dependencias: todas MIT/Apache-2.0, sin incompatibilidad con AGPL-3.0, sin
dependencias nuevas. Forge (`apps/dix-forge/`) queda completamente al margen
— proprietario, ya fuera del repo público. Verificación final: `cargo check
--workspace` limpio, `npm run build` del cliente limpio, bundle `dist/` sin
rastro de Forge. Documentado en `DEC-008`.

**Cierre de seguridad de la Tarea 3.2:** se encontró `apps/dix-forge/`
staged en git (heredado de la separación anterior) — corregido con
`.gitignore` + `git rm --cached`. Se encontró y corrigió
`com.dixsystems.dix.metainfo.xml` declarando `LicenseRef-Proprietary` pese a
estar empaquetado en el `.deb` público — cambiado a `AGPL-3.0-only`. Añadido
`target/` raíz a `.gitignore` (faltaba tras introducir el workspace).
Eliminados los `target/` locales obsoletos (contenían cadenas de Forge de un
build previo a la separación, sin relación con el repositorio).

**Tarea 3.3 — BYOK completado (mismo día):** El backend de BYOK ya existía,
completo y bien diseñado (`memory.rs`: llavero del sistema, sin texto plano
salvo fallback; `claude_gateway.rs`: llamada directa a Anthropic con clave
propia, nunca a través de `dix-proxy`) — solo faltaba exponerlo. Añadidos 3
comandos Tauri (`byok_save_key`, `byok_clear_key`, `byok_status`) y un
componente de UI (`ByokSettings.tsx`) enlazado desde `App.tsx`. Sin tocar
Forge ni `dix-proxy`. Build limpio (`cargo check --workspace`, `npm run
build`), bundle sin Forge. Documentado en `DEC-009`.

**Tarea 3.4 — README y cierre de Fase 3 (mismo día):** `README.md`
reescrito para Windows+Linux, licencia AGPL-3.0-only, separación de
`dix-proxy`/Forge, BYOK, límites reales, sin claims no verificables.
`rg` final sin coincidencias problemáticas. Solo documentación — sin
necesidad de build. `ORDEN_TRABAJO.md` actualizado (Tarea 3.4 y Fase 3
completas). `DEC-010`. **Con esto se cierra la Fase 3 completa de
ORDEN_TRABAJO.md (3.1 corte público/privado, 3.2 AGPL-3.0, 3.3 BYOK, 3.4
README) — DIX Windows es, de principio a fin, código, licencia y
documentación coherentes.**

**Fase 3 publicada y checklist global auditado (2026-07-03):** commit
`9539e2a` ("chore: complete Phase 3 public release alignment") empujado a
`main` en `github.com/dixsystem/Dix`. Auditoría posterior del checklist
global de aceptación de `ORDEN_TRABAJO.md` (13 ítems) detectó una
inconsistencia real: el system prompt de la rama `#[cfg(target_os =
"windows")]` en `main.rs` no usaba `obfstr!`, a diferencia de la rama Linux
— el binario Windows distribuido habría expuesto el prompt en texto plano
ante `strings`. Corregido en el commit `278229f` ("fix: obfuscate Windows
system prompt consistently"), también empujado a `main`.

**Estado del checklist global tras `278229f`: no cerrado completamente.**
Superado en revisión estática solo para los puntos verificables sin
ejecución real. Pendientes de validación funcional (requieren hardware,
red o entorno reales, no auditables desde código estático):

- Ítem 4 — Aplicar → Deshacer con `sysctl` real
- Ítem 5 — Respuestas del Worker (400/403/429, JSON válido)
- Ítem 6 — `activation_limit` en licencia atada a hardware
- Ítem 9 — Benchmark reproducible ±3%
- Ítem 13 — `.deb` instalando limpio en entorno sin dev

Ítems 7, 8 y 10 quedan en CUMPLE PARCIALMENTE: la parte verificable en
código está confirmada, su comportamiento en ejecución real no se ha
probado.

Confirmaciones estáticas de esta auditoría: `obfstr!` corregido en la rama
Windows de `main.rs`; "La primera AppIA del Mundo" eliminado de todos los
metadatos distribuibles (`Cargo.toml`, `com.dixsystems.dix.metainfo.xml`,
`tauri.conf.json`, `README.md`); Forge ausente de `dist/assets/*.js`;
`dix-proxy` y `apps/dix-forge/` ausentes de `git ls-files`; AGPL-3.0-only
coherente en `LICENSE`, ambos `Cargo.toml` de `desktop-tauri`/`dix-cli`,
`package.json` y `com.dixsystems.dix.metainfo.xml`; BYOK documentado, con
la ruta BYOK de `claude_gateway.rs` llamando directo a Anthropic — la única
referencia a `dix-proxy.dixsystem.workers.dev` en ese archivo pertenece
exclusivamente al camino de fallback sin clave propia (modo demo).

**Seguridad local del remoto git (tarea aparte, sin relación con el
producto):** se detectó un token de GitHub incrustado en texto plano en
`git remote -v`. SSH probado primero (clave `id_ed25519.pub` existente) y
descartado por fallar la autenticación (`Permission denied (publickey)`),
sin generar claves nuevas ni tocar `~/.ssh`. Resuelto con `origin` en HTTPS
limpio (`https://github.com/dixsystem/Dix.git`) y `credential.helper`
configurado como `cache --timeout=28800` (sin Git Credential Manager
instalado; se descartó `store` por guardar credenciales en texto plano).
Sin cambios en el repositorio derivados de esta tarea — es configuración
local de git, no código ni documentación versionada.

## 2026-07-03

## Validación funcional del checklist global — estado consolidado

Continuación de la auditoría estática cerrada el día anterior (commits
`9539e2a`, `278229f`, `4fa089f`): se ejecutó validación funcional real
(ejecución en vivo, no solo lectura de código) sobre los ítems del
checklist global de `ORDEN_TRABAJO.md` que requerían hardware, red o
entorno reales.

**Clasificación global: B. LISTO PARA RELEASE CON ADVERTENCIAS.**

Justificación:
- No hay bloqueo crítico confirmado en el cliente público.
- El claim visible "LA PRIMERA APPIA DEL MUNDO" fue corregido en la UI y
  commiteado localmente: `69f7731 fix: remove unverifiable AppIA claim from UI`.
- Sigue pendiente de push junto con: `4fa089f docs: record Phase 3 acceptance audit status`.
- El checklist global **NO** queda cerrado completamente.
- Persisten ítems sin cierre funcional completo y otros con cumplimiento parcial.

**Estado por ítem:**

- **Ítem 4 — Aplicar → Deshacer con `sysctl` real:** NO VERIFICABLE SIN
  EJECUCIÓN CON SUDO. Entorno sin autenticación privilegiada interactiva.
  Análisis estático favorable: `pkexec`, snapshot previo, rollback con
  valores reales y journal.

- **Ítem 5 — Worker 400/403/429 y JSON válido:** CUMPLE PARCIALMENTE. 400 y
  403 devuelven códigos correctos, pero body en texto plano, no JSON. 429
  queda NO VERIFICABLE sin licencia de test/rate limit controlado.
  Hallazgo real: `dix-proxy` usa `new Response("texto plano")` en algunas
  ramas 400/403; `errorJson()` solo cubre algunas ramas.

- **Ítem 6 — `activation_limit` atado a hardware:** NO VERIFICABLE SIN
  LICENCIA DE TEST. Hallazgo por código: posible discrepancia entre
  `instance_name` de activación y `X-Device-Id` usado en
  `claude_gateway`. Hallazgo adicional: en Linux, hardware-binding puede
  ser débil si depende solo del modelo de CPU.

- **Ítem 7 — CSP activa:** CUMPLE PARCIALMENTE. CSP configurada y
  embebida en binario, app arranca sin errores/violaciones visibles, pero
  falta verificación interactiva completa por limitaciones Wayland/herramientas.

- **Ítem 8 — Hardware real detectado:** CUMPLE. Verificado campo a campo
  contra `lscpu`, `lspci`, `uname` y `/etc/os-release`.

- **Ítem 9 — Benchmark reproducible ±3%:** CUMPLE PARCIALMENTE. CPU
  cumple ±0.18%. RAM no cumple ~11.65%. Disco no cumple ~11.74%. Causa
  probable: CPU/RAM/disco ejecutan en paralelo con `tokio::join!`,
  generando competencia real.

- **Ítem 10 — Telemetría off = cero datos salientes:** CUMPLE. Probado
  con proceso real y config aislada, cero conexiones salientes durante
  arranque/idle con telemetría off.

- **Ítem 13 — `.deb` instalando limpio en entorno sin dev:** NO
  VERIFICABLE SIN ENTORNO LIMPIO. Subresultados: paquete generado
  CUMPLE; dependencias sin toolchain dev CUMPLE; estructura del paquete
  CUMPLE; `ldd` sin dependencias rotas críticas PARCIAL; instalación real
  en Docker/VM limpia no verificable porque Docker/Podman no están
  disponibles y no se usó sudo.

**Pendientes recomendados, sin crear Fase 4:**
- Corregir respuestas JSON en ramas 400/403 de `dix-proxy`.
- Probar `activation_limit` con licencia Lemon Squeezy de test.
- Revisar discrepancia `instance_name` / `X-Device-Id`.
- Decidir si benchmark CPU/RAM/disco debe ejecutarse en serie o si se
  acepta la varianza actual.
- Probar `.deb` en Docker/VM limpia cuando haya entorno.
- Repetir Ítem 4 con sudo/pkexec interactivo real.
- Subir manualmente los commits pendientes cuando se resuelva
  autenticación GitHub.

## Fix producción dix-proxy — Ítem 5 checklist global

Se corrigió el hallazgo del Ítem 5: las ramas 400/403 de `handleMessages`
en `dix-proxy` devolvían texto plano en vez de JSON. El cambio usa
`errorJson()` (ya existente en el propio archivo, usado antes solo para
429/402) para devolver `Content-Type: application/json`, body JSON
válido, y estructura `{"error":{"type":...,"message":...}}`.

**No se cambiaron:** códigos HTTP, lógica de licencia, rate limit,
Lemon Squeezy, CORS, rutas, KV namespaces, cliente DIX Windows, Forge,
gobernanza.

**Version ID del deploy:** `dc753df3-4e3d-468c-805e-9f545c7d9fdb`.

**Verificación:**
- Preflight completado (carpeta real, diff confirmado a las 3 ramas,
  `wrangler.toml`/rate limit/Lemon Squeezy/CORS confirmados sin tocar).
- Prueba local con `wrangler dev`: 3/3 casos correctos.
- `wrangler deploy` exitoso.
- Producción verificada contra
  `https://dix-proxy.dixsystem.workers.dev/v1/messages`, casos:
  1. 400 — JSON inválido
  2. 400 — falta auth
  3. 403 — licencia inválida sintética
- Resultado en producción: status HTTP correcto, `Content-Type:
  application/json`, JSON válido, sin HTML, sin stack traces, sin texto
  plano roto.
- Verificación repetida después del deploy: 3/3 casos siguen correctos.
- No se repitió el deploy en la reverificación porque no había cambios
  nuevos de código.

**Impacto sobre el checklist:** Ítem 5 mejora — 400/403 quedan
corregidos y verificados en producción; 429 sigue pendiente de prueba
controlada de rate limit con licencia de test. **Estado actualizado del
Ítem 5: CUMPLE PARCIALMENTE**, con 400/403 ya corregidos; 429 pendiente.

## Ítem 9 — Benchmark reproducible corregido

El benchmark principal/release fue cambiado de ejecución paralela a
ejecución secuencial CPU → RAM → disco. Motivo: la ejecución paralela
con `tokio::join!` generaba contención interna real (CPU saturando los
núcleos mientras RAM/disco competían por ancho de banda e I/O), y hacía
que RAM y disco variaran ~11–12% entre corridas idénticas, fuera del
criterio ±3%.

**Resultado tras serializar** (misma metodología: 1 warmup + 5 pasadas
medidas):
- CPU: desviación máxima ~0.153%
- RAM: desviación máxima ~0.524%
- Disco: desviación máxima ~1.210%

Las tres categorías quedan dentro de ±3%. **Ítem 9 pasa de CUMPLE
PARCIALMENTE a CUMPLE.**

**Trade-off aceptado:** los valores históricos de benchmark paralelo no
son comparables directamente con los nuevos valores seriales (el disco,
en particular, sube de ~520-600k IOPS a ~1.3M IOPS al no competir ya por
CPU) — es un cambio de metodología de medición, no una mejora real de
hardware.

**Commit publicado:** `2564fb9 fix: serialize benchmark execution for
reproducibility`. `main` local y `origin/main` están alineadas en
`2564fb9`.

## Alineación main/origin tras commit equivalente MCP

Se detectó divergencia local/remota tras publicar la entrada de bitácora
del benchmark vía MCP/API: `main` quedó "delante 1 / detrás 1" de
`origin/main`.

- **Commit local duplicado:** `7f163f3 docs: record benchmark
  reproducibility fix`.
- **Commit remoto publicado:** `6e5a258 docs: record benchmark
  reproducibility fix`.

Investigación (`git log --left-right`, `git diff HEAD..origin/main`,
`git show -s --format=...`) confirmó que ambos commits tenían:
- mismo padre: `2564fb9`;
- mismo tree hash: `f64af9548fb323fc22aa06f247f52506ce3979b7`;
- diff completo vacío entre `HEAD` y `origin/main`;
- diferencia solo en metadatos de commit (autor `DixSystem` vs
  `dixsystem`, timestamp), sin diferencia real de contenido — mismo
  patrón ya visto antes con `8013724`→`2564fb9`.

Con esa evidencia y confirmación explícita del usuario, se ejecutó `git
reset --hard origin/main`.

**Resultado:**
- HEAD local quedó en `6e5a258`.
- `main` quedó alineada con `origin/main`, sin ahead/behind.
- Sin cambios tracked pendientes.
- Sin commit nuevo, sin push.
- `remote` limpio, sin token.
- Los archivos sin trackear `landing/appia-experimental.html` y
  `landing/index.html.bak` permanecieron intactos.

## Decisión sobre landing/appia-experimental.html

Se investigaron los dos archivos locales de landing sin trackear:
`landing/appia-experimental.html` y `landing/index.html.bak`. Ambos
quedaron añadidos a `.gitignore` en el commit `7736192 chore: ignore
local landing drafts`.

`landing/index.html.bak` se considera un backup manual superado de
`landing/index.html` — mismo copy anterior, sin contenido único.
`landing/appia-experimental.html` se considera un borrador/prototipo
de visión AppIA/DixSystem, no basura — define bien la categoría
"AppIA" y los cinco principios (Understand→Analyze→Decide→Act→Adapt),
con tono más disciplinado que la propia landing actual.

**Decisión actual: B. conservar local, ignorada.** No se publica, no
se fusiona con `landing/index.html`, no se incorpora al repo público,
no se borra, no se convierte todavía en página `/appia`, `/vision` ni
`/about`.

**Contexto de negocio confirmado por el CEO:** DIX Windows/Linux sigue
siendo el producto principal y foco inmediato. DIXBOT y DixBodyForm
son proyectos reales del ecosistema DixSystem, pero no están en el
mismo grado de madurez que DIX Windows/Linux. No deben presentarse
ahora como roadmap público, promesa comercial, fecha, "Next" o
"Future". DixBodyForm implica datos sensibles de salud, nutrición,
entrenamiento, sueño y suplementos, por lo que no debe exponerse
prematuramente como promesa pública.

**Idea salvable para el futuro:** una página prudente tipo `/appia`,
`/vision` o `/about`, pero solo cuando DIX Windows/Linux tenga mayor
validación comercial, limitada a: definición de AppIA; principios de
DixSystem; local-first/privacy-first; calidad y seguridad; sin
productos futuros concretos; sin fechas; sin claims absolutos; sin
datos sensibles de salud; sin roadmap público prematuro.

## Publicación del fix de release workflow

Se publicó correctamente el commit `c2b9a9a fix: remove unverifiable
AppIA claim from release workflow`, que modifica únicamente
`.github/workflows/release.yml`.

**Objetivo del cambio:** eliminar del release body el claim no
verificable "**La primera AppIA del Mundo** — optimiza tu PC con IA
real en segundos." **Copy vigente:** "DIX — Optimizador de sistema
para Windows y Linux, con IA real."

**Verificación posterior al push:**
- HEAD local = `c2b9a9a`, `origin/main` = `c2b9a9a`.
- `main` alineada con `origin/main`, sin ahead/behind.
- `git status --short` vacío.
- `git diff HEAD..origin/main --stat` y diff completo vacíos.
- `remote` limpio, sin token.
- Sin tag creado, sin release creada, sin commit adicional.

**Verificación de claims:** sin coincidencias de "primera AppIA", "La
primera AppIA", "The world's first AppIA", "world's first", "first
AppIA" ni "AppIA del Mundo" en `.github/workflows/release.yml` ni en
`.github/workflows`.

**Nota:** el workflow de release ya no publicará el claim prohibido si
se corta un tag nuevo.
