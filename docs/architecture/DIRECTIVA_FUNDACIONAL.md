# 🏛️ DIXSYSTEM — DIRECTIVA FUNDACIONAL
## Constitución Oficial de DixSystem
### Versión 1.2
### Estado: VIGENTE — aprobada por Resolución Fundacional RES-001 (2026-07-02)

> Esta versión es una reescritura completa, no una actualización incremental de la
> v1.1 (que pierde vigencia con esta resolución). Incorpora, de forma nativa y no
> como parche, las decisiones aprobadas por el Consejo de Arquitectura al cerrar el
> RFC-001 (11 hallazgos: H1, H2, H3, M1-M5, L1-L3). Superó auditoría del Director
> Técnico, revisión del Arquitecto del Ecosistema, verificación cruzada y
> deliberación final del Consejo antes de su aprobación. Ver
> `docs/architecture/RFC-001_DIRECTIVA_PENDIENTES.md` (historial completo de las 11
> decisiones), `docs/architecture/RETROSPECTIVA_RFC-001.md` (principios y patrones
> extraídos del proceso) y `docs/architecture/RES-001_RESOLUCION_FUNDACIONAL.md`
> (resolución de aprobación).

---

# MISIÓN

DixSystem no existe para desarrollar software.

DixSystem existe para construir un ecosistema inteligente capaz de diseñar, fabricar,
auditar, mejorar y mantener software cada vez mejor gracias al conocimiento acumulado.

Todo lo que se construya deberá acercarnos a ese objetivo.

---

# VISIÓN

No estamos construyendo una aplicación.

No estamos construyendo un framework.

Estamos construyendo una organización digital.

Una organización formada por especialistas IA que colaboran para fabricar software con
calidad creciente.

Misión y Visión viven en este mismo documento, como preámbulo de la Directiva
Fundacional — no en un archivo separado.

---

# PRINCIPIO RECTOR

Toda decisión debe responder una única pregunta:

**"¿Hace más inteligente al ecosistema?"**

Si la respuesta es NO:

→ No se implementa.
→ Se documenta.
→ Va al roadmap.

Si la respuesta es SÍ:

→ Se implementa.

Este principio tiene prioridad sobre cualquier otra decisión técnica, salvo lo indicado
en la sección **JERARQUÍA DOCUMENTAL**.

---

# JERARQUÍA DOCUMENTAL

DixSystem se gobierna con una jerarquía de cinco niveles. Ningún nivel compite con
otro — cada uno manda en su dominio:

```
VISIÓN
  ↓
DIRECTIVA FUNDACIONAL
  ↓
ORDEN_TRABAJO
  ↓
ROADMAPS
  ↓
SPRINTS
```

- **Visión y Directiva** — este mismo documento. Define principios de ingeniería,
  arquitectura y gobernanza. No autoriza trabajo por sí sola.
- **`docs/ORDEN_TRABAJO.md`** — gobierna el alcance, las prioridades y la secuencia
  de desarrollo de DIX. Funciona, en la práctica, como el Roadmap del sistema
  "DIX" — no se divide ni sube de nivel por encima de los Roadmaps; esa función de
  prioridad entre sistemas ya la cubre la CONGELACIÓN DE EXPANSIÓN.
- **Roadmaps** — cada sistema estratégico del ecosistema (DIX, y en el futuro Forge,
  Atlas u otros cuando adquieran evolución independiente) dispone de su propio
  Roadmap cuando lo necesite.
- **Sprints** — ejecutan el trabajo definido por cada Roadmap.

Ninguna sección de esta Directiva puede usarse para justificar trabajo que no esté
priorizado en ORDEN_TRABAJO o en el Roadmap del sistema correspondiente, ni para
retrasar una tarea bloqueante en nombre de un principio arquitectónico.

**Creación perezosa de documentación de gestión.** No se crean nuevos Roadmaps, RFCs
ni documentos estructurales hasta que exista necesidad real demostrable. La
complejidad documental también debe ganarse.

**Legitimidad temporal.** Todo sistema estratégico que todavía no disponga de un
Roadmap propio (DIX Forge, hoy) se rige temporalmente por: esta Directiva, las
decisiones aprobadas por el Consejo de Arquitectura (ver RESPONSABILIDADES), y las
prioridades del Roadmap del sistema del que dependa, si dicho Roadmap existe. La
ausencia de un Roadmap propio no implica ausencia de legitimidad — solo significa
que el sistema aún no ha alcanzado el grado de independencia que exige una
planificación específica. Nunca se resuelve por el criterio de una persona concreta.

El criterio de "sistema estratégico" (necesita Roadmap propio) y el test estructural
de nuevo subsistema (ver CONGELACIÓN DE EXPANSIÓN) son independientes entre sí —
comparten vocabulario pero responden preguntas distintas; un componente puede
activar uno sin activar el otro.

Las fases de producto (Fase 0 → 1 → 2 → 3, definidas en ORDEN_TRABAJO) y las fases de
implementación interna de un módulo concreto (p. ej. Fase A/B/C/D del rollout de un
componente, definidas en su propio código) son taxonomías distintas y no deben
mezclarse. Cada módulo documenta sus propias fases donde vive su código.

---

# ARQUITECTURA VIGENTE (lo que existe hoy)

La arquitectura vigente refleja **únicamente** lo que ya existe en el repositorio o está
en implementación activa. No incluye aspiraciones futuras — esas viven en la sección
**ARQUITECTURA OBJETIVO**.

```
Knowledge Core         (existe — cerebro/knowledge_core)
  ↓
Context Engine         (existe — cerebro/context_engine)
  ↓
Biblioteca LLM          (existe — cerebro/biblioteca_llm.rs)
  ↓
Prompt Factory          (existe, en rollout por fases — cerebro/prompt_factory)
  ↓
System Forge (DIX Forge)
  ↓
AppIAs
  ↓
Usuarios
  ↓
Nuevo conocimiento
  ↓
Knowledge Core
```

No se crean nuevos niveles en la arquitectura vigente sin que exista antes código real
cumpliendo esa función. Un nombre en un diagrama no es un componente: un componente es
código que compila, tiene tests y está en uso o en rollout controlado (feature flag,
modo shadow, etc.).

Este diagrama cubre la Infraestructura de Fabricación. La Infraestructura de
Producto (p. ej. `dix-proxy`, DIX Atlas) se gobierna en POLÍTICA DE IA — no se
duplica aquí.

---

# ARQUITECTURA OBJETIVO / VISIÓN FUTURA

Estos componentes representan la dirección a largo plazo del ecosistema. **No son
obligatorios en el sistema actual, no bloquean nada, y no deben implementarse hasta que
se cumplan las condiciones de la sección CONGELACIÓN DE EXPANSIÓN.**

- **Nexus** — el proyecto personal del CEO (sistema cognitivo con LLM local sobre
  Ollama). Hoy no está integrado en el repositorio ni en el ecosistema DixSystem — es
  un proyecto separado. En la visión de largo plazo podrá evolucionar hasta
  convertirse en el núcleo cognitivo de DixSystem, pero mientras no se integre no
  forma parte de la Arquitectura Vigente.
- **Experience Core** — Nivel 2 del aprendizaje del ecosistema (ver Principio 3):
  transformará la experiencia ya capturada en patrones, lecciones aprendidas,
  conocimiento reutilizable y mejoras arquitectónicas. Se alimenta del **Nivel 1 —
  captura y persistencia de experiencia**, hoy materializado en un registro shadow de
  comparación entre prompts (`PromptShadowLog`), todavía no persistido. Ese registro
  es el primer eslabón de Nivel 1 — no una versión temprana de Experience Core.
  Mejorar el Nivel 1 (incluida su persistencia) está permitido dentro del alcance que
  ORDEN_TRABAJO ya prioriza, sin activar la Congelación de Expansión. Experience Core
  (Nivel 2) permanece congelado hasta que se cumplan esas condiciones.
- **Mentor Engine** — formalizará el proceso de consulta a IA premium como mentor
  puntual, con síntesis del conocimiento obtenido hacia la Biblioteca LLM.
- **Model Router** — decidirá qué IA ejecuta cada especialidad de la Taxonomía
  Oficial de Especialidades (ver ROLES FUNCIONALES Y RESPONSABILIDADES) cuando
  existan múltiples especialistas intercambiables por rol.

---

# CONSTITUCIÓN DE DIXSYSTEM

Toda IA, Forge o AppIA deberá respetar estos principios.

1. El ecosistema está por encima del proyecto.

2. **Local First, por capa.**
   La **Infraestructura de Fabricación** (DIX Forge, Knowledge Core, Context Engine,
   Biblioteca LLM, Prompt Factory, y cualquier herramienta interna de construcción o
   auditoría de software) sigue Local First de forma estricta: las IAs locales son el
   motor principal, las IAs premium son especialistas externos consultados
   puntualmente, nunca una dependencia estructural.
   La **Infraestructura de Producto** (proxies, workers y backends que sirven tráfico
   en vivo a usuarios de un producto ya publicado — p. ej. `dix-proxy`, el backend de
   DIX Atlas, ver `ORDEN_TRABAJO.md` Tarea 2.3) no está sujeta a Local First estricto
   — ver POLÍTICA DE IA para las
   condiciones bajo las que puede usar modelos premium.

3. Toda experiencia útil se convierte en conocimiento permanente (ver ARQUITECTURA
   OBJETIVO — Experience Core, para la distinción entre Nivel 1 y Nivel 2 de este
   principio).

4. **Estándar DixSystem, en tres niveles.**
   Nunca publicar una AppIA que no cumpla el Estándar DixSystem.
   **Nivel 1 — Principio** (aquí): existencia obligatoria del estándar como
   requisito de publicación.
   **Nivel 2 — Proceso** (`GOBERNANZA_INGENIERIA.md`, hoy borrador — este nivel no
   es exigible hasta su aprobación formal): procedimiento de evolución del
   estándar — cambios siguen el proceso descrito en NIVELES DE DECISIÓN y quedan
   registrados como entrada vigente en `DECISIONES.md`.
   **Nivel 3 — Ejecución técnica**: el Motor de Validación DixSystem, extensión de
   Prompt Factory (ver PROMPT FACTORY), implementa en código los criterios vigentes
   según la última entrada aprobada. El código es la implementación del estándar,
   no su fuente.

5. Buscar antes de crear.
   Reutilizar antes de programar.
   Consultar conocimiento antes de preguntar a una IA.

6. Cada fabricación debe mejorar DixSystem.

7. Pensar → Diseñar → Construir → Auditar → Aprender.

8. La complejidad debe ganarse.

9. Las IAs forman un equipo.
   No compiten.
   Se especializan.

10. Toda decisión debe fortalecer el núcleo.

11. Humildad técnica.
    Si la confianza es baja: consultar, aprender, mejorar.

12. **Reversibilidad arquitectónica, ámbito delimitado.**
    Aplica exclusivamente al ámbito arquitectónico y técnico gobernado por esta
    Directiva: favorece decisiones que puedan revisarse, evolucionarse o revertirse
    cuando exista evidencia suficiente. No aplica a decisiones comerciales o de
    negocio adoptadas deliberadamente en ORDEN_TRABAJO u otros documentos
    estratégicos — esas decisiones pueden ser conscientemente irreversibles cuando
    la estrategia de producto lo requiera. Esta delimitación no es una excepción al
    principio; es la definición de su ámbito.
    Ejemplos ilustrativos (ver HEURÍSTICOS ARQUITECTÓNICOS para el resto de
    calificadores de esta Directiva):
    - *Arquitectura (sujeta a este principio):* estructura del ecosistema,
      responsabilidades, módulos, gobernanza, patrones, interfaces.
    - *Negocio (puede ser deliberadamente irreversible):* lanzamiento público,
      cambio de marca, apertura comercial, publicación de una AppIA,
      licenciamiento, estrategia comercial.
    Si en el futuro se crea un Mapa de Dominios de Decisión, deberá usar
    terminología propia, distinta de Constitucional/Estratégica/Operativa (ver
    NIVELES DE DECISIÓN), para evitar colisión semántica.

13. **Patrimonio del conocimiento.**
    El conocimiento generado pertenece a DixSystem. Nunca a un modelo concreto, una
    API o un proveedor. La Biblioteca LLM y el Knowledge Core deben almacenar
    siempre conocimiento sintetizado e independiente del origen que lo produjo —
    nunca respuestas literales atribuibles a un proveedor específico.

---

# HEURÍSTICOS ARQUITECTÓNICOS

Esta Directiva usa calificadores cualitativos en varios principios y secciones —
"importante", "confianza suficiente", "riesgo elevado" (ver Principio 12,
POLÍTICA DE IA, CONFIDENCE SCORE, METODOLOGÍA OFICIAL). Este bloque es la única
fuente de interpretación para todos ellos — no se duplican ejemplos por sección.

Los heurísticos no constituyen reglas automáticas. Son criterios comunes de
interpretación, de carácter ilustrativo y no exhaustivo, que orientan el juicio del
lector sin sustituir la deliberación técnica.

**Criterios ilustrativos:**
- Impacto sobre más de un sistema.
- Modificación de datos persistidos.
- Reversibilidad limitada.
- Impacto económico real.
- Modificación de interfaces públicas.
- Alteración de principios o gobernanza.
- Existencia de una alternativa funcional razonablemente viable que permita
  sustituir la solución actual sin alterar los principios fundamentales del
  ecosistema.

**Cláusula de precedencia.** Cuando exista un procedimiento específico ya aprobado
para un ámbito determinado — el test estructural de nuevo subsistema (ver
CONGELACIÓN DE EXPANSIÓN) o la clasificación de niveles de decisión (ver NIVELES DE
DECISIÓN) — dicho procedimiento prevalece sobre estos heurísticos generales.

---

# DIX FORGE

DIX Forge es la primera System Forge de DixSystem, y forma parte de la
Infraestructura de Fabricación (ver Principio 2).

Su misión es fabricar AppIAs.

Todo cambio futuro deberá mejorar su capacidad para fabricar software, respetando la
CONGELACIÓN DE EXPANSIÓN definida más abajo.

Como sistema estratégico sin Roadmap propio todavía (ver JERARQUÍA DOCUMENTAL), se
rige temporalmente por esta Directiva y por las decisiones del Consejo de
Arquitectura.

---

# PROMPT FACTORY

Prompt Factory es el corazón cognitivo de DIX Forge.

No genera simples prompts.

Transforma intención humana en instrucciones óptimas para especialistas IA.

Responsabilidades:

- Comprender la intención.
- Consultar contexto.
- Consultar memoria.
- Consultar experiencia (cuando Experience Core exista).
- Generar prompts especializados.
- Medir calidad (ver **Prompt Score**).
- Aprender.

El **Motor de Validación DixSystem** (ver Principio 4, Nivel 3) es una extensión de
Prompt Factory: implementa en código los criterios vigentes del Estándar DixSystem.
No constituye un subsistema nuevo — hereda el ciclo de vida de Prompt Factory.

---

# KNOWLEDGE CORE

Knowledge Core almacena conocimiento.

No conversaciones.

No respuestas.

Conocimiento reutilizable.

---

# BIBLIOTECA LLM

La Biblioteca LLM es el patrimonio intelectual de DixSystem.

Nunca almacenará respuestas literales.

Siempre almacenará conocimiento sintetizado e independiente del modelo que lo originó.

**La Biblioteca LLM, no la Directiva, es el único lugar donde se asignan nombres
concretos de modelo a roles funcionales.** La Constitución habla de roles; la
configuración técnica habla de modelos.

---

# ROLES FUNCIONALES Y RESPONSABILIDADES

Esta Directiva habla solo de **roles funcionales**; qué modelo concreto ejecuta cada
rol es una decisión de configuración técnica, no constitucional (ver BIBLIOTECA
LLM).

## Taxonomía Oficial de Especialidades

Única fuente oficial de qué especialidades funcionales existen en DixSystem. Toda
sección de esta Directiva que enumere especialidades — incluido Model Router,
cuando exista — referencia esta taxonomía en vez de mantener su propia lista.

Cada especialidad lleva un **estado documental** — indica únicamente el grado de
madurez arquitectónica, no implica implementación ni asignación de modelos, y no
constituye un nuevo subsistema (ver CONGELACIÓN DE EXPANSIÓN):

| Especialidad | Responsabilidad | Estado |
|---|---|---|
| Arquitecto | Diseño de sistema, coherencia y evolución de la visión global | Vigente |
| Planificador | Descomposición de tareas, documentación, revisión de alcance | Vigente |
| Implementador | Escritura de código, compilación, ejecución | Vigente |
| Refactorizador | Mejora de código existente sin cambiar comportamiento | Vigente |
| Auditor | Revisión crítica, detección de riesgos, veredicto de calidad | Vigente |
| Documentador | Documentación técnica y de usuario | Vigente |
| Diseñador | Experiencia e interfaz | Vigente |
| Analista | Datos, métricas, resultados | Vigente |
| Marketing | Comunicación y posicionamiento | Planificada (a la espera de Model Router) |

Estados posibles: **Vigente** (activa hoy), **Planificada** (prevista, sin
implementación todavía), **Experimental**, **Retirada**.

Qué modelo local o premium ejecuta cada rol funcional en cada momento se define en
`BibliotecaLLM` (`cerebro/biblioteca_llm.rs`) — única fuente de verdad (ver
BIBLIOTECA LLM). Model Router, cuando exista, consulta y ejecuta ese mapeo; no lo
redefine. Ese mapeo puede cambiar sin que esta Directiva cambie.

Responsabilidades humanas y de dirección — ver RESPONSABILIDADES.

---

# POLÍTICA DE IA

Ver Principio 2 (Local First, por capa) para la partición entre Infraestructura de
Fabricación e Infraestructura de Producto. Esta sección detalla las condiciones que
rigen a la segunda.

**Infraestructura de Fabricación:** Local First estricto. Las IAs premium se
consultan puntualmente como especialistas externos. Nunca por comodidad. Nunca como
dependencia estructural.

**Infraestructura de Producto:** puede usar modelos locales, premium o
arquitecturas híbridas cuando mejore el resultado para el usuario — por ejemplo
ante criticidad alta, riesgo elevado, confianza insuficiente o auditoría importante
(ver HEURÍSTICOS ARQUITECTÓNICOS para interpretar estos calificadores) — bajo estas
condiciones. La dependencia debe ser:

- explícita,
- justificable,
- medible con un método concreto (benchmark, coste o resultado de usuario
  documentado),
- sustituible por una alternativa funcional razonablemente viable (ver
  HEURÍSTICOS ARQUITECTÓNICOS),
- nunca oculta.

Nunca por comodidad. Nunca como dependencia estructural oculta.

---

# CONFIDENCE SCORE

Toda decisión importante debe tener asociado un nivel de confianza.

Si la confianza es suficiente → continuar.
Si la confianza es insuficiente → escalar a un especialista IA o al CEO.

Qué cuenta como "suficiente" se interpreta con los HEURÍSTICOS ARQUITECTÓNICOS.

**Este documento fija el principio, no la fórmula.** El cálculo concreto del nivel de
confianza, sus umbrales y su persistencia viven exclusivamente en el código (hoy no
implementado; cuando se implemente, vivirá junto a Prompt Factory o Knowledge Core).

---

# PROMPT SCORE

Todo prompt fabricado por Prompt Factory debe poder medirse en calidad.

**Este documento fija el principio, no la fórmula.** La implementación real —
`calcular_score()` en `cerebro/prompt_factory/mod.rs` — es la referencia vigente y
puede evolucionar libremente sin necesidad de modificar esta Directiva, siempre que
siga midiendo la misma intención: riqueza de contexto, uso de memoria, ajuste de
longitud y especificidad de estrategia.

---

# REGLA 80/20

20% — Arquitectura, diseño, pensamiento.
80% — Construcción, tests, validación.

Nunca caer en parálisis por análisis.

---

# METODOLOGÍA OFICIAL

Todo cambio sigue este flujo, sin excepciones ni fases omitidas:

Comprender → Diseñar → Implementar → Compilar → Probar → Auditar → Aprender → Commit.

El flujo no se debilita ni se excepciona — se calibra en esfuerzo, nunca en presencia
de fases. La **profundidad** de ejecución de cada fase es proporcional al alcance del
cambio (ver HEURÍSTICOS ARQUITECTÓNICOS): un ajuste trivial recorre las ocho fases de
forma prácticamente inmediata; una modificación arquitectónica exige desarrollo
completo de cada una.

---

# CONGELACIÓN DE EXPANSIÓN

Hasta que se cumplan los objetivos establecidos en `docs/ORDEN_TRABAJO.md` —
incluyendo explícitamente la validación comercial de DIX Windows — no se inicia el
desarrollo de nuevos subsistemas.

## Qué cuenta como nuevo subsistema

Un cambio se considera **nuevo subsistema** cuando cumple al menos una de estas
condiciones:

**CASO A — Nueva capacidad arquitectónica independiente.** El componente introduce
un ciclo de vida propio, puede evolucionar independientemente, requiere gobernanza
propia, o cumple una misión distinta del sistema existente.

**CASO B — Impacto técnico estructural.** Cumple al menos dos de estos tres
criterios: nuevo módulo top-level, nuevo esquema persistido, nueva API pública.

**Notas:**
1. Persistir información adicional de un sistema existente no constituye por sí
   misma una nueva capacidad arquitectónica (ver ARQUITECTURA OBJETIVO, Experience
   Core Nivel 1).
2. "Browser Validation System" hace referencia exclusivamente a un futuro
   subsistema interno de DixSystem — no debe confundirse con herramientas externas
   como GStack Browser (ver `docs/architecture/HERRAMIENTAS_EXTERNAS.md`).

**Ejemplos ilustrativos, no exhaustivos:**
- *Mejoras evolutivas (no activan la congelación):* persistir un shadow log, añadir
  un modelo a Biblioteca LLM, ampliar Prompt Factory, optimizar Context Engine,
  mejorar una estrategia existente, registrar Eventos de Gobernanza en la Bitácora.
- *Nuevos subsistemas (sí activan la congelación):* Model Router, Mentor Engine,
  Security Forge, Compliance Forge, Browser Validation System, nuevas Forge
  adicionales a DIX Forge, o cualquier componente que introduzca una nueva
  capacidad arquitectónica independiente.

Esta congelación no impide seguir mejorando lo que ya existe (Knowledge Core,
Context Engine, Biblioteca LLM, Prompt Factory) dentro del alcance que ORDEN_TRABAJO
ya prioriza. Impide únicamente abrir nuevos subsistemas mientras el producto vendible
no ha validado su hipótesis comercial.

## Certificación de la validación comercial

La validación comercial de DIX Windows (y cualquier evento futuro que modifique el
estado estratégico del ecosistema) se certifica mediante un **Evento de
Gobernanza**: una entrada estructurada dentro de `BITACORA_DIXSYSTEM.md` — no un
documento independiente — con, como mínimo: identificador único, tipo de evento,
fecha, evidencia objetiva, verificador, decisión del Consejo, consecuencias sobre
la gobernanza, documentos afectados.

El verificador por defecto es el Director Técnico (verifica existencia y
autenticidad de la evidencia objetiva); el Consejo de Arquitectura delibera sobre
esa evidencia; la aprobación final corresponde al CEO.

La primera venta confirmada de DIX Windows constituye el primer Evento de
Gobernanza de este tipo. No se fija todavía un umbral cuantitativo sobre qué ocurre
si tras esa primera venta las ventas caen a cero — pregunta abierta que el Consejo
resolverá cuando exista evidencia suficiente del negocio real.

---

# NIVELES DE DECISIÓN

Toda decisión dentro de DixSystem pertenece a uno de tres niveles:

**Decisiones Constitucionales** — afectan a los principios fundamentales, la
arquitectura del ecosistema y la gobernanza. Requieren evidencia, deliberación del
Consejo de Arquitectura (ver RESPONSABILIDADES) y aprobación del CEO.

**Decisiones Estratégicas** — dirección del proyecto: prioridades, alcance,
Roadmaps, planificación y objetivos de negocio. Responsabilidad del CEO. No
requieren modificar esta Directiva, pero deben ser coherentes con las decisiones
constitucionales vigentes. Si una decisión estratégica entra en conflicto con una
decisión constitucional ya aprobada (por ejemplo, la Congelación de Expansión), no
basta con invocarla como estratégica: se requiere primero una enmienda
constitucional que la modifique, siguiendo el proceso completo (ver PROCEDIMIENTO
DE ENMIENDA).

**Decisiones Operativas** — implementación técnica. Responsabilidad del Director
Técnico. Siempre respetando las decisiones constitucionales y estratégicas.

Modificar esta Directiva es, por definición, una Decisión Constitucional.

---

# PROCEDIMIENTO DE ENMIENDA

Esta Directiva es un documento vivo, no un dogma. Modificarla es una Decisión
Constitucional (ver NIVELES DE DECISIÓN) — requiere evidencia y el proceso completo
del Consejo de Arquitectura, nunca intuición únicamente.

Evidencia técnica suficiente proviene de:

- Experience Core (cuando exista),
- auditorías técnicas,
- métricas reales de uso,
- resultados observados en producción,
- lecciones aprendidas documentadas.

Toda propuesta de enmienda debe:

1. Citar la evidencia concreta que la motiva.
2. Tramitarse como RFC/ADR — problema, impacto, opciones, ventajas, inconvenientes,
   recomendación técnica, decisión — siguiendo el **Proceso Oficial de Deliberación
   Arquitectónica de DixSystem** (ver `docs/architecture/RETROSPECTIVA_RFC-001.md`).
3. Pasar por auditoría crítica del Director Técnico antes de aprobarse.
4. Incrementar la versión del documento y dejar registro de qué cambió y por qué en
   el historial de versiones.

---

# RESPONSABILIDADES

## Consejo de Arquitectura

Cuerpo responsable de las Decisiones Constitucionales (ver NIVELES DE DECISIÓN).
Compuesto por:

- **CEO** — visión, dirección, aprobación final de toda Decisión Constitucional y
  Estratégica.
- **Director Técnico** — auditoría crítica, protector de la arquitectura,
  coordinador del desarrollo, responsable de las Decisiones Operativas.
  Verificador por defecto de todo Evento de Gobernanza (ver CONGELACIÓN DE
  EXPANSIÓN).
- **Arquitecto del Ecosistema** — revisión y contrapropuesta técnica externa sobre
  las decisiones del Consejo, antes de la aprobación final del CEO.

## Roles funcionales de implementación

Ver ROLES FUNCIONALES Y RESPONSABILIDADES para la Taxonomía Oficial de
Especialidades. La asignación de qué IA concreta ocupa cada rol es configuración
técnica, no constitucional, y puede cambiar sin nueva versión de esta Directiva.

---

# OBJETIVO FINAL

No queremos fabricar más software.

Queremos construir una organización capaz de fabricar software cada vez mejor.

Cada AppIA debe mejorar a todas las demás.

Cada error debe aumentar el conocimiento.

Cada decisión debe fortalecer el ecosistema.

---

# REGLA FINAL

Las herramientas cambiarán.

Los modelos evolucionarán.

Las APIs aparecerán y desaparecerán.

Lo único que debe permanecer es:

- la arquitectura,
- el conocimiento acumulado,
- la cultura de ingeniería,
- y la capacidad del ecosistema para aprender.

Si alguna decisión entra en conflicto con estos principios, deberán prevalecer siempre
estos principios — salvo lo indicado en la sección **JERARQUÍA DOCUMENTAL**, donde
ORDEN_TRABAJO prevalece sobre esta Directiva en materia de alcance y secuencia.

---

## Historial de versiones

- **v1.0** — Redactada como propuesta inicial. Rechazada tras auditoría técnica de
  Claude Code (Director Técnico) por: ausencia de jerarquía con ORDEN_TRABAJO,
  sobre-especificación de arquitectura no implementada, nombres de modelo concretos
  incrustados en un documento permanente, Prompt Score/Confidence Score redefinidos sin
  mecanismo pese a existir ya una implementación funcional, Experience Core declarado
  como capa oficial sin código, y ausencia de procedimiento de enmienda.
- **v1.1** — Incorpora jerarquía documental explícita, degrada Experience Core / Mentor
  Engine / Model Router a Visión Futura, elimina nombres de modelo de la Constitución en
  favor de roles funcionales, deja Prompt Score y Confidence Score como principios (la
  fórmula vive en código), añade reversibilidad arquitectónica, patrimonio del
  conocimiento, procedimiento de enmienda y congelación de expansión hasta validación
  comercial de DIX Windows. No llegó a aprobarse formalmente — quedó pendiente mientras
  se auditaba mediante el RFC-001.
- **v1.2** — Reescritura completa (no incremental) tras el cierre íntegro del RFC-001
  (11 hallazgos: H1, H2, H3, M1-M5, L1-L3, resueltos por el Consejo de Arquitectura
  entre 2026-07-01 y 2026-07-02). Incorpora de forma nativa: partición Infraestructura
  de Fabricación/Producto en Local First (H1); jerarquía documental de cinco niveles
  con creación perezosa y legitimidad temporal (H2); tres Niveles de Decisión con
  cláusula de coherencia (H3); test estructural de nuevo subsistema, CASO A/CASO B
  (M1); distinción Nivel 1/Nivel 2 del aprendizaje del ecosistema (M2); Evento de
  Gobernanza como mecanismo de certificación de la Congelación de Expansión (M3);
  Taxonomía Oficial de Especialidades con estado documental (M4); Estándar DixSystem
  en tres niveles (M5); profundidad proporcional al alcance en la Metodología Oficial
  (L1); delimitación de ámbito del Principio de Reversibilidad (L2); bloque de
  Heurísticos Arquitectónicos con cláusula de precedencia (L3). Nexus pasa de
  Arquitectura Vigente a Arquitectura Objetivo/Visión Futura. Ver
  `docs/architecture/RFC-001_DIRECTIVA_PENDIENTES.md` (historial completo de los 11
  ADR) y `docs/architecture/RETROSPECTIVA_RFC-001.md` (principios y patrones
  extraídos del proceso). Superó auditoría del Director Técnico, revisión del
  Arquitecto del Ecosistema, verificación cruzada y deliberación del Consejo de
  Arquitectura. **Aprobada por el CEO mediante Resolución Fundacional RES-001
  (2026-07-02) — primera Constitución oficial de DixSystem. Estado: VIGENTE.**
