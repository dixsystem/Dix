# RFC-001 — Decisiones Arquitectónicas Pendientes de la Directiva Fundacional

**Estado:** CERRADO (2026-07-02) — los 11 hallazgos (H1-H3, M1-M5, L1-L3) tienen
decisión aprobada por el Consejo de Arquitectura. Autorizada la redacción de la
Directiva Fundacional v1.2.
**Origen:** Auditoría adversarial de la Directiva Fundacional v1.1 (rol: Director Técnico).
**Regla del proceso:** ninguna sección de la Directiva Fundacional se modifica hasta que
el hallazgo correspondiente tenga una decisión marcada como **APROBADA** en este
documento. La v1.2 de la Directiva se redactará solo cuando todos los hallazgos H
(altos) y M (medios) tengan decisión, o se acuerde explícitamente diferir alguno.

Cada hallazgo se trata como un ADR independiente: problema, impacto, opciones,
ventajas, inconvenientes, recomendación técnica y decisión pendiente. La
recomendación técnica es una opinión de partida, no una decisión — la decisión la
toma Alonso.

---

## Índice

- [H1 — Local First vs. arquitectura real de DIX](#h1)
- [H2 — Jerarquía Documental vs. legitimidad de DIX Forge](#h2)
- [H3 — Procedimiento de Enmienda vs. autoridad final de Alonso](#h3)
- [M1 — "Nuevos grandes subsistemas" sin umbral objetivo](#m1)
- [M2 — Principio 3 incumplido por congelación de su único mecanismo](#m2)
- [M3 — Gate de "validación comercial" sin dueño ni registro](#m3)
- [M4 — Inconsistencia entre listas de roles/especialidades](#m4)
- [M5 — "Estándar DixSystem" (Principio 4) sin definir](#m5)
- [L1 — Metodología Oficial de 8 pasos aplicada sin excepción](#l1)
- [L2 — Alcance de Reversibilidad (Principio 12) sin acotar](#l2)
- [L3 — Calificadores vagos repetidos sin heurístico mínimo](#l3)

---

<a name="h1"></a>
## H1 — "Local First" aplicado a "toda AppIA" contradice la arquitectura real de DIX

**Severidad:** ALTA
**Estado:** RESUELTO por el Consejo de Arquitectura (CEO + Director Técnico +
Arquitecto del Ecosistema) el 2026-07-01. Ver **Decisión aprobada** al final de este
ADR. Pasa a formar parte de la propuesta de Directiva v1.2, pendiente de aprobación
definitiva hasta que se cierre el RFC-001 completo.

**Problema:**
El Principio 2 declara Local First vinculante para "toda IA, Forge o AppIA". Pero DIX
(la AppIA insignia, la que paga las facturas) usa Anthropic/Claude como backend
estructural por defecto en el tier de pago (`dix-proxy` en `ORDEN_TRABAJO.md`, Fase 1),
con BYOK como alternativa solo en el tier gratuito (Fase 3, Tarea 3.3). Leído
literalmente, el producto que genera ingresos incumple la Constitución desde el día uno.

**Impacto:**
Si no se resuelve, cualquier auditoría futura (humana o de IA) concluirá que la
Directiva es retórica sin correspondencia con la realidad, lo que erosiona su autoridad
sobre el resto de principios. También puede llevar a un agente a "corregir" DIX hacia
local-only de forma dañina para el negocio, malinterpretando el principio como orden
literal de ejecución.

**Opciones posibles:**

1. **Acotar Local First al plano de fabricación (DIX Forge)**, no al de las AppIAs ya
   publicadas. La Directiva regularía cómo se *construye* software (preferir modelos
   locales para tareas internas de construcción/auditoría), no qué IA usa el producto
   final en producción.
2. **Mantener Local First universal** y reclasificar la arquitectura de DIX (Claude vía
   proxy) como una excepción documentada y permanente, justificada por el modelo de
   negocio.
3. **Redefinir "estructural"** de forma más precisa: una dependencia es "estructural" si
   no existe alternativa funcional sin ella. Como BYOK existe, Claude vía proxy no sería
   "estructural" en sentido estricto — sería el camino por defecto pero no el único.

**Ventajas / Inconvenientes de cada opción:**

- *Opción 1:* Ventaja: resuelve la contradicción de raíz, sin tocar nada del código o el
  negocio. Inconveniente: exige mantener dos políticas de IA distintas (una para Forge,
  otra para AppIAs), lo que añade una capa de indirección conceptual.
- *Opción 2:* Ventaja: mantiene el principio universal como aspiración. Inconveniente:
  una "excepción permanente" al principio más citado de la Constitución debilita su
  peso simbólico — si la excepción es el caso más importante del ecosistema, el
  principio deja de ser creíble como regla general.
- *Opción 3:* Ventaja: no requiere reescribir la arquitectura de responsabilidades,
  solo precisar una palabra. Inconveniente: es una solución semántica, no estructural;
  no resuelve el problema de fondo (Claude sigue siendo el camino por defecto para todo
  usuario de pago) y puede leerse como maquillaje de la contradicción más que como
  solución.

**Recomendación técnica:** Opción 1. Es la única que resuelve la contradicción sin
negar la realidad del negocio ni degradar el principio a papel mojado. DIX Forge
(interno, fabricación) y las AppIAs publicadas (producto, cara al usuario) son capas
distintas del ecosistema con necesidades distintas; tratarlas con una sola política de
IA es la raíz del problema.

---

**Contrapropuesta del Consejo de Arquitectura (Arquitecto del Ecosistema):**
Sustituir la separación Forge/AppIAs por una separación conceptual más duradera:
Infraestructura del Ecosistema vs. Productos del Ecosistema — porque "Forge" es una
implementación concreta que puede cambiar de nombre, dividirse o desaparecer, mientras
que "Infraestructura" es un concepto arquitectónico estable. Redacción propuesta: *"La
infraestructura de DixSystem seguirá el principio Local First. Los productos
fabricados por el ecosistema podrán utilizar modelos locales, modelos premium o
arquitecturas híbridas cuando ello mejore objetivamente el resultado para el usuario,
siempre respetando los principios de independencia, trazabilidad y aprendizaje del
ecosistema."* Añade el principio *"El objetivo de DixSystem no es demostrar que las
IAs locales son mejores. El objetivo de DixSystem es construir la mejor solución
posible para cada problema"* y la restricción de que toda dependencia de un modelo
premium debe ser explícita, justificable, medible, reemplazable cuando sea
razonablemente posible, y nunca obligatoria para el funcionamiento interno de la
infraestructura.

**Auditoría de la contrapropuesta (Director Técnico):** Mejora real sobre la Opción 1
original en dos ejes: (a) exime por rol arquitectónico en vez de por nombre de
herramienta concreta, más resistente al paso del tiempo; (b) añade condiciones de
accountability (explícita/justificable/medible/reemplazable/nunca obligatoria) que la
Opción 1 no tenía. Pero deja un vacío crítico: no clasifica dónde cae `dix-proxy` (el
worker que sostiene la key de Anthropic para todo el tier de pago) ni DIX Atlas. Bajo
una lectura natural, ambos son "infraestructura" — y si lo son, la nueva redacción
obligaría a `dix-proxy` a seguir Local First, reintroduciendo (y potencialmente
agravando) exactamente la contradicción que originó H1. Además introduce el
calificador "objetivamente" sin heurístico (mismo patrón de vaguedad ya señalado en
L3) y no subordina explícitamente el nuevo principio "mejor solución posible" a Local
First, dejando abierta la posibilidad de que ese principio, leído en aislamiento,
compita con Local First en vez de operar dentro de sus límites. Contrapropuesta
rechazada en su forma literal; idea de fondo aceptada.

**Decisión aprobada (Consejo de Arquitectura — CEO + Director Técnico + Arquitecto
del Ecosistema, 2026-07-01):**

Se aprueba una versión fusionada que conserva las dos mejoras de la contrapropuesta y
cierra su vacío de clasificación, dividiendo "Infraestructura" en dos niveles
explícitos:

> **Infraestructura de Fabricación** (DIX Forge, Knowledge Core, Context Engine,
> Biblioteca LLM, Prompt Factory, y cualquier herramienta interna de construcción o
> auditoría de software): sigue el principio Local First de forma estricta.
>
> **Infraestructura de Producto** (proxies, workers y backends que sirven tráfico en
> vivo a usuarios de un producto ya publicado — p. ej. `dix-proxy`, el backend de DIX
> Atlas): no está sujeta a Local First estricto. Puede usar modelos locales, premium o
> arquitecturas híbridas cuando mejore el resultado para el usuario, siempre bajo
> estas condiciones: la dependencia debe ser explícita, justificable, medible con un
> método concreto (benchmark, coste o resultado de usuario documentado — nunca
> "objetivamente" sin definir), reemplazable cuando sea razonablemente posible, y
> nunca oculta.
>
> El principio "el objetivo de DixSystem es construir la mejor solución posible para
> cada problema" aplica únicamente dentro de la Infraestructura de Producto, como
> criterio de decisión **subordinado** a Local First — nunca como principio que
> compita con él dentro de la Infraestructura de Fabricación.

Este texto queda listo para incorporarse a la Constitución de la Directiva
Fundacional v1.2 (sustituyendo/ampliando el Principio 2), pendiente de que se cierre
el RFC-001 completo antes de redactar esa versión.

**Verificación de compatibilidad cruzada (Director Técnico, 2026-07-01):** Antes de
cerrar H1 se comprobó la decisión contra el resto de hallazgos abiertos.

- *H2:* Sin contradicción — "Infraestructura de Fabricación" (acuñado aquí) coincide
  con el conjunto que la Opción 1 de H2 propone eximir; H2 debería reutilizar este
  mismo término al resolverse. Además aclara que "Infraestructura de Producto"
  (`dix-proxy`, DIX Atlas) ya está cubierta por `ORDEN_TRABAJO.md` — el vacío de H2
  aplica solo a la Infraestructura de Fabricación.
- *H3:* Sin contradicción — el propio proceso de auditoría y consenso usado para
  cerrar H1 es un ejemplo en vivo de la "enmienda estructural con evidencia" que la
  Opción 2 de H3 recomienda.
- *M1:* Sin contradicción; watch-item — satisfacer el criterio "medible" de
  Infraestructura de Producto debe hacerse con documentación ligera (DECISIONES.md /
  Bitácora), no construyendo un nuevo subsistema mientras dure la congelación.
- *M2:* Sin contradicción; watch-item — "resultado de usuario documentado" no
  presupone que exista Experience Core; puede satisfacerse citando DECISIONES.md /
  Bitácora mientras Experience Core siga en Visión Futura.
- *M3, M5, L1:* Sin relación, sin conflicto.
- *M4:* Ver nota de H2 — mismo riesgo de nomenclatura duplicada, prevenido.
- *L2:* Sin conflicto — la resolución de H1 es, en sí misma, una decisión
  completamente reversible (texto de ADR, no toca código ni negocio).
- *L3:* **Hallazgo real, no bloqueante.** El texto consensuado elimina
  "objetivamente" pero conserva, heredada de la propuesta original, la frase
  "reemplazable cuando sea razonablemente posible" — mismo patrón de calificador
  vago que señala L3. No bloquea el cierre de H1; queda anotado como ajuste
  pendiente para cuando se resuelva L3.

**Conclusión:** ninguna incompatibilidad bloqueante con H2, H3, M1-M5 o L1-L3.

**Decisión pendiente:** Ninguna — **RESUELTO**. Pendiente únicamente la redacción
formal de la v1.2, que no se hará hasta cerrar H2, H3 y los hallazgos M/L.

**Nota de aprobación:** Decisión aprobada por el Consejo de Arquitectura (CEO +
Director Técnico + Arquitecto del Ecosistema) el 2026-07-01, verificada contra el
resto del RFC-001 sin incompatibilidades bloqueantes. Queda pendiente únicamente de
la aprobación final de la Directiva Fundacional v1.2, que se redactará cuando se
cierre el RFC-001 completo.

---

<a name="h2"></a>
## H2 — La Jerarquía Documental deslegitima, por su propia letra, el trabajo activo de DIX Forge

**Severidad:** ALTA
**Estado:** RESUELTO por el Consejo de Arquitectura (CEO + Director Técnico +
Arquitecto del Ecosistema) el 2026-07-01. Ver **Decisión aprobada** al final de este
ADR. Pasa a formar parte de la propuesta de Directiva v1.2, pendiente de aprobación
definitiva hasta que se cierre el RFC-001 completo.

**Problema:**
La Jerarquía Documental de la v1.1 dice: *"Ninguna sección de esta Directiva puede
usarse para justificar trabajo que no esté priorizado en ORDEN_TRABAJO."* Verificado:
`ORDEN_TRABAJO.md` no menciona Forge, Prompt Factory, Knowledge Core, Biblioteca LLM ni
Context Engine en ninguna línea. Sin embargo, la mayor parte del contenido de la
Directiva gobierna precisamente ese trabajo, que está en desarrollo activo ahora mismo.

**Impacto:**
Contradicción estructural: el documento invalida, por su propia regla, la legitimidad
de lo que más extensamente regula. Sin resolver, cualquier disputa futura sobre "¿debe
seguir construyéndose Forge ahora?" no tiene respuesta consistente en el propio texto,
y decisiones de priorización quedan sin ancla documental verificable.

**Opciones posibles:**

1. **Excepción explícita en la Jerarquía Documental** para "herramientas internas de
   meta-desarrollo (DIX Forge) que no forman parte del producto DIX vendible y no
   requieren estar priorizadas en ORDEN_TRABAJO", con su propio criterio de prioridad
   definido en la Directiva o en un documento hermano.
2. **Incorporar a Forge dentro de ORDEN_TRABAJO** como una fase o anexo propio (p. ej.
   "Fase F — DIX Forge"), con sus propios criterios de aceptación, para que quede
   dentro del mismo sistema de prioridades que gobierna todo lo demás.
3. **Pausar el desarrollo activo de Forge** hasta que se resuelva su encaje formal,
   tratando la contradicción como una señal de que el trabajo no debería avanzar sin
   autorización explícita en el documento de mayor jerarquía.

**Ventajas / Inconvenientes de cada opción:**

- *Opción 1:* Ventaja: resuelve la contradicción rápido y reconoce la realidad de que
  Forge es una iniciativa de naturaleza distinta (meta-herramienta, no producto).
  Inconveniente: crea una "zona gris" fuera del sistema de prioridades único, con riesgo
  de que Forge crezca sin el mismo escrutinio de recursos que el producto vendible.
- *Opción 2:* Ventaja: un solo sistema de prioridades para todo, sin excepciones;
  fuerza a decidir explícitamente cuánto esfuerzo relativo merece Forge frente al
  producto. Inconveniente: mezcla dos naturalezas de trabajo distintas (producto
  vendible vs. herramienta interna) en un documento pensado para lo primero; puede
  hacer más rígido el roadmap de Forge de lo necesario.
- *Opción 3:* Ventaja: máxima coherencia formal inmediata. Inconveniente: alto coste de
  oportunidad — detiene trabajo ya en marcha y testeado (Prompt Factory con tests
  pasando) por un problema de encaje documental, no de calidad técnica. Es la opción
  más segura en el papel y la más costosa en la práctica.

**Recomendación técnica (original):** Opción 1, con revisión periódica. Forge es de
naturaleza distinta al producto: es la fábrica, no lo que se vende. Forzarlo dentro de
ORDEN_TRABAJO (Opción 2) puede generar más fricción de la que resuelve; pausarlo
(Opción 3) desperdicia trabajo ya validado sin motivo técnico. La excepción debe ser
explícita y con su propio criterio de prioridad, no un vacío legal.

---

**Opción 4 (contrapropuesta del Arquitecto del Ecosistema, tras auditoría del Director
Técnico):** Sustituir la excepción puntual para Forge por una jerarquía documental
oficial de cinco niveles:

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

Cada nivel gobierna un ámbito distinto: Visión define el propósito; la Directiva
define principios de ingeniería y arquitectura; ORDEN_TRABAJO define prioridades de
negocio; cada sistema estratégico (Forge, Nexus, DIX, Atlas, etc.) dispone de su
propio Roadmap; los Sprints ejecutan el trabajo. Forge deja de ser una excepción y
pasa a ser un sistema estratégico más, gobernado por su propio Roadmap. ORDEN_TRABAJO
no deja de ser válido — pasa a gobernar únicamente las prioridades comerciales y de
producto, no la evolución interna de cada sistema. La Directiva no autoriza trabajo;
ORDEN_TRABAJO no define arquitectura; los Roadmaps no cambian la estrategia.

**Ventaja:** generaliza la solución en vez de parchear un caso concreto — cualquier
sistema estratégico futuro (no solo Forge) queda cubierto sin necesidad de una nueva
excepción cada vez. Es coherente con la Jerarquía Documental ya aprobada en v1.1 (que
ya distingue principios de alcance/secuencia) y escala mejor al horizonte de diez
años que la Opción 1.

**Inconvenientes / preguntas abiertas detectadas en la auditoría (sin resolver
todavía, requieren decisión del Consejo, no de Claude Code unilateralmente):**

- *Nivel de ORDEN_TRABAJO sin resolver:* el diagrama lo sitúa por encima de los
  Roadmaps, como asignador de prioridad entre sistemas. Pero su contenido actual
  (tareas técnicas detalladas de un único producto, DIX) es exactamente lo que la
  propia propuesta describe como un "Roadmap", no un nivel superior. Tomar el
  diagrama literalmente exigiría partir ORDEN_TRABAJO en dos documentos — una
  restructuración no reconocida explícitamente por la propuesta. Recomendación del
  Director Técnico: no subir de nivel a ORDEN_TRABAJO; tratarlo como el Roadmap del
  sistema "DIX", al mismo nivel que un futuro `ROADMAP_FORGE.md`. La función de
  "prioridad entre sistemas" que el diagrama le atribuye ya la cubre la Congelación
  de Expansión (v1.1, ya aprobada), sin necesidad de duplicarla.
- *Granularidad de Atlas sin resolver:* hoy Atlas es la Tarea 2.3 dentro de
  `ORDEN_TRABAJO.md`, no un documento propio. Si pasa a tener Roadmap propio, requiere
  migrar contenido fuera de ORDEN_TRABAJO; si no, no debería figurar en la lista de
  sistemas con Roadmap propio. Pendiente de decisión explícita.
- *Identidad de "Nexus" sin resolver:* no está claro si el "Nexus" de este diagrama es
  el mismo proyecto personal "NEXUS — Sistema Cognitivo Personal" de Alonso o un
  concepto arquitectónico distinto que solo comparte nombre. Solo Alonso puede
  aclararlo.
- *Riesgo de burocracia prematura (menor):* crear un Roadmap por cada sistema
  estratégico debe hacerse con proporcionalidad — Forge lo justifica hoy; Nexus/Atlas
  quizá no todavía. Recomendación: creación perezosa, solo cuando el sistema tenga
  actividad independiente real.

**Recomendación técnica (Director Técnico) sobre la Opción 4:** Supera técnicamente a
la Opción 1 como enfoque — se incorpora como opción viable — pero no puede
considerarse cerrada hasta que el Consejo resuelva las tres preguntas abiertas
señaladas arriba (nivel de ORDEN_TRABAJO, granularidad de Atlas, identidad de Nexus).

---

**Respuestas del CEO a las preguntas abiertas (2026-07-01):**

1. *Nexus:* Es el mismo proyecto personal de Alonso (sistema cognitivo personal).
   No es un concepto distinto. En la visión de largo plazo podrá evolucionar hasta
   convertirse en el núcleo cognitivo de DixSystem, pero hoy sigue siendo el mismo
   proyecto, separado y no integrado en el repositorio de DixSystem.
2. *ORDEN_TRABAJO:* No se divide por ahora. Hoy funciona realmente como el Roadmap de
   DIX. Se revisará una separación cuando existan varios sistemas con actividad propia
   y prioridades independientes (Forge, Atlas, Nexus, etc.).
3. *Atlas:* No necesita Roadmap independiente todavía. Mientras forme parte del
   desarrollo de DIX permanece dentro de ORDEN_TRABAJO. Solo tendrá Roadmap propio
   cuando adquiera una evolución independiente del resto del producto.
4. *Principio general — creación perezosa:* Aprobado. No se crearán nuevos Roadmaps,
   RFCs ni documentos estructurales hasta que exista una necesidad real demostrable.
   "La complejidad documental también debe ganarse."

**Cláusula de legitimidad temporal (propuesta del Arquitecto del Ecosistema, tras
auditoría del Director Técnico):** para evitar que la legitimidad interina de un
sistema dependa del criterio de una persona concreta, se sustituye por gobernanza
institucional:

> "Todo sistema estratégico que todavía no disponga de un Roadmap propio se regirá
> temporalmente por: la Directiva Fundacional, las decisiones aprobadas por el Consejo
> de Arquitectura, y las prioridades establecidas por el Roadmap del sistema del que
> dependa, **si dicho Roadmap existe**. La ausencia de un Roadmap propio no implica
> ausencia de legitimidad. Solo significa que dicho sistema aún no ha alcanzado el
> grado de independencia necesario para requerir una planificación específica."

**Nota de auditoría (Director Técnico):** la condicionalidad del tercer ancla, que en
la primera versión de esta cláusula quedaba implícita (requería una nota
interpretativa aparte), ahora está escrita directamente en el texto normativo ("si
dicho Roadmap existe"). Para Forge, que hoy no depende de ningún sistema con Roadmap
propio, ese ancla simplemente no aplica y su legitimidad descansa en los otros dos
(Directiva + decisiones del Consejo — el proceso seguido en este RFC). Sin necesidad
de nota aparte: el propio texto ya lo cubre.

**Decisión aprobada (Consejo de Arquitectura — CEO + Director Técnico + Arquitecto
del Ecosistema, 2026-07-01):**

Se adopta la Opción 4 (jerarquía documental de cinco niveles) con las siguientes
precisiones acordadas:

> `VISIÓN → DIRECTIVA FUNDACIONAL → ORDEN_TRABAJO → ROADMAPS → SPRINTS`
>
> Visión y Directiva permanecen en el mismo documento (Misión/Visión como preámbulo de
> la Directiva Fundacional; no se crea un archivo separado). ORDEN_TRABAJO no se
> divide ni sube de nivel: es, en la práctica, el Roadmap del sistema "DIX", al mismo
> nivel que un futuro Roadmap de Forge — no un asignador de prioridad superior a los
> Roadmaps (esa función ya la cubre la Congelación de Expansión, ya aprobada en v1.1).
> Atlas permanece dentro de ORDEN_TRABAJO mientras no adquiera evolución independiente
> del resto de DIX. Nexus es el proyecto personal de Alonso, hoy no integrado en el
> repositorio ni en el ecosistema DixSystem; por tanto **deja de figurar en la
> "Arquitectura Vigente" de la Directiva y pasa a "Arquitectura Objetivo / Visión
> Futura"** hasta su integración efectiva (nota de redacción para v1.2: el diagrama de
> Arquitectura Vigente debe reestructurarse para no arrancar en NEXUS).
>
> Se aprueba el principio de **creación perezosa de documentación de gestión**: no se
> crean nuevos Roadmaps, RFCs ni documentos estructurales hasta que exista necesidad
> real demostrable ("la complejidad documental también debe ganarse").
>
> Todo sistema estratégico sin Roadmap propio (Forge, hoy) se rige temporalmente por
> la cláusula de legitimidad temporal transcrita arriba — nunca por el criterio de una
> persona concreta.

Este texto queda listo para incorporarse a la Constitución/Jerarquía Documental de la
Directiva Fundacional v1.2, pendiente de que se cierre el RFC-001 completo antes de
redactar esa versión.

**Verificación de compatibilidad cruzada (Director Técnico, 2026-07-01):** sin
conflicto con H1 (ejes distintos: política de IA vs. gobernanza documental) — de
hecho "Infraestructura de Fabricación" (H1) y "sistema estratégico Forge" (H2)
describen el mismo conjunto, con nomenclatura ya alineada. Sin conflicto con M1 /
Congelación de Expansión: la cláusula gobierna sistemas ya activos, no autoriza crear
ninguno nuevo. Sin conflicto con L3: el texto no introduce calificadores vagos que
un agente pueda usar para autoeximirse — la autoridad para crear nuevos documentos
queda expresamente en manos de Alonso ("propongo", "solicito"), no delegada a
criterio de agente. Sin relación con M2, M3, M4, M5, L1, L2.

**Conclusión:** ninguna incompatibilidad bloqueante detectada.

**Decisión pendiente:** Ninguna — **RESUELTO**. Pendiente únicamente la redacción
formal de la v1.2, que no se hará hasta cerrar H3 y los hallazgos M/L.

**Nota de aprobación:** Decisión aprobada por el Consejo de Arquitectura (CEO +
Director Técnico + Arquitecto del Ecosistema) el 2026-07-01, verificada contra el
resto del RFC-001 sin incompatibilidades bloqueantes. Queda pendiente únicamente de
la aprobación final de la Directiva Fundacional v1.2, que se redactará cuando se
cierre el RFC-001 completo.

---

<a name="h3"></a>
## H3 — El Procedimiento de Enmienda puede chocar con la autoridad de "decisión final" de Alonso

**Severidad:** ALTA
**Estado:** RESUELTO por el Consejo de Arquitectura (CEO + Director Técnico +
Arquitecto del Ecosistema) el 2026-07-01. Ver **Decisión aprobada** al final de este
ADR. Pasa a formar parte de la propuesta de Directiva v1.2, pendiente de aprobación
definitiva hasta que se cierre el RFC-001 completo.

**Problema:**
Responsabilidades otorga a Alonso "decisión final". El Procedimiento de Enmienda exige
evidencia técnica (Experience Core, auditorías, métricas, resultados, lecciones
aprendidas) y prohíbe cambios "únicamente por intuición". No existe una vía para que
Alonso cambie de rumbo por decisión ejecutiva sin ese ciclo de evidencia.

**Impacto:**
Un documento de gobernanza no puede atarle las manos a la única autoridad que reconoce
como final sin generar una de dos consecuencias: (a) fricción real la primera vez que
Alonso necesite decidir rápido, o (b) que el procedimiento se ignore en la práctica —
lo cual es peor que no tenerlo, porque enseña que la Directiva es opcional cuando
estorba.

**Opciones posibles:**

1. **Vía de enmienda ejecutiva de emergencia:** Alonso puede invocarla sin evidencia
   previa, pero la excepción debe quedar registrada explícitamente en el historial de
   versiones (qué se cambió, por qué, sin evidencia formal) — como excepción, no como
   precedente.
2. **Dos niveles de enmienda:** enmiendas "estructurales" (cambian principios,
   requieren evidencia y auditoría) vs. enmiendas "de rumbo" (cambian prioridades o
   alcance dentro de lo ya aprobado, decisión unilateral de Alonso sin ciclo formal).
3. **Mantener el procedimiento estricto para todos, incluido Alonso**, aceptando que la
   evidencia previa es precisamente lo que protege al ecosistema de decisiones
   apresuradas — incluidas las del propio fundador.

**Ventajas / Inconvenientes de cada opción:**

- *Opción 1:* Ventaja: resuelve la tensión sin debilitar el procedimiento para el resto
  de casos; dice la verdad sobre cómo funcionará en la práctica. Inconveniente: si se
  usa con frecuencia, la "excepción" se convierte en la norma real y el procedimiento
  de evidencia pierde sentido.
- *Opción 2:* Ventaja: distingue con precisión qué requiere rigor (principios,
  arquitectura) de qué es prerrogativa normal de dirección (prioridades, alcance).
  Inconveniente: requiere definir con claridad la frontera entre "estructural" y "de
  rumbo", lo cual puede ser tan ambiguo como los calificadores ya señalados en L3.
- *Opción 3:* Ventaja: máxima disciplina, cero excepciones que erosionen el precedente.
  Inconveniente: no resuelve el problema real — Alonso, como fundador, tomará
  decisiones rápidas de todos modos; negarlo en el documento no lo evita, solo hace que
  ocurra fuera del proceso documentado.

**Recomendación técnica:** Opción 2. Distinguir enmiendas estructurales (a los
principios/arquitectura, requieren evidencia) de enmiendas de rumbo (prioridad,
alcance, secuencia — prerrogativa normal de dirección) refleja mejor cómo funciona
cualquier organización real, y evita tanto la parálisis por evidencia como la erosión
del procedimiento por uso excesivo de una "vía de emergencia".

---

**Contrapropuesta del Consejo de Arquitectura (Arquitecto del Ecosistema, sobre la
Opción 2):** en vez de dos niveles (estructural / de rumbo), definir tres niveles de
decisión:

1. **Decisiones Constitucionales** — afectan a los principios fundamentales, la
   arquitectura del ecosistema y la gobernanza. Requieren evidencia, deliberación del
   Consejo de Arquitectura y aprobación del CEO.
2. **Decisiones Estratégicas** — dirección del proyecto: prioridades, alcance,
   Roadmaps, planificación y objetivos de negocio. Responsabilidad del CEO. No
   requieren modificar la Constitución.
3. **Decisiones Operativas** — implementación técnica. Responsabilidad del Director
   Técnico. Siempre respetando las decisiones constitucionales y estratégicas.

**Auditoría de la contrapropuesta (Director Técnico):** mejora real sobre la Opción 2
— añade el nivel Operativo que la Opción 2 no cubría, cerrando de paso la Sección 7
(Niveles de decisión) de `GOBERNANZA_INGENIERIA.md`, que dependía exactamente de esto.
Confirma en retrospectiva que H1 y H2 se tramitaron correctamente (modificaban
principios/arquitectura → Decisión Constitucional). Vacío detectado: "Decisiones
Estratégicas... no requieren modificar la Constitución" no exige que sean
*coherentes* con ella — dejaba abierta la posibilidad de que una decisión estratégica
(p. ej. "priorizamos Model Router ya") contradijera una decisión constitucional ya
aprobada (la Congelación de Expansión) sin pasar por enmienda. Contrapropuesta
aceptada; vacío cerrado con la cláusula de coherencia siguiente.

**Decisión aprobada (Consejo de Arquitectura — CEO + Director Técnico + Arquitecto
del Ecosistema, 2026-07-01):**

Se adoptan los tres niveles de decisión, con la cláusula de coherencia añadida:

> **Decisiones Constitucionales** — afectan a los principios fundamentales, la
> arquitectura del ecosistema y la gobernanza. Requieren evidencia, deliberación del
> Consejo de Arquitectura y aprobación del CEO.
>
> **Decisiones Estratégicas** — dirección del proyecto: prioridades, alcance,
> Roadmaps, planificación y objetivos de negocio. Responsabilidad del CEO. No
> requieren modificar la Constitución, **pero deben ser coherentes con las
> decisiones constitucionales vigentes. Si una decisión estratégica entra en
> conflicto con una decisión constitucional ya aprobada (por ejemplo, la
> Congelación de Expansión), no basta con invocarla como estratégica: se requiere
> primero una enmienda constitucional que la modifique, siguiendo el proceso
> completo (evidencia + Consejo + CEO).**
>
> **Decisiones Operativas** — implementación técnica. Responsabilidad del Director
> Técnico. Siempre respetando las decisiones constitucionales y estratégicas.

Este texto queda listo para incorporarse a la Directiva Fundacional v1.2 (Procedimiento
de Enmienda) y a la Sección 7 de `GOBERNANZA_INGENIERIA.md` (hoy provisional),
pendiente de que se cierre el RFC-001 completo antes de redactar esa versión y de
auditar la Gobernanza.

**Verificación de compatibilidad cruzada (Director Técnico, 2026-07-01):**

- *H1:* Sin conflicto — fue una Decisión Constitucional (modificó Principio 2),
  correctamente tramitada con el proceso completo.
- *H2:* Sin conflicto — también Decisión Constitucional (modificó la Jerarquía
  Documental). La creación de Roadmaps por sistema (cuando corresponda) encaja como
  Decisión Estratégica, consistente con esta clasificación.
- *M1:* Sin conflicto; refuerzo — la cláusula de coherencia da un mecanismo concreto
  para hacer valer la Congelación de Expansión frente a decisiones estratégicas que
  intenten esquivarla, lo que hace aún más necesario cerrar el umbral objetivo de M1
  (pendiente).
- *M2:* Sin relación, sin conflicto.
- *M3:* Sin conflicto — el gate de "validación comercial" sigue exactamente igual de
  indefinido que antes; H3 no lo toca, sigue pendiente tal cual.
- *M4, M5:* Sin relación, sin conflicto.
- *L1:* Sin conflicto; sinergia — el nivel "Decisión Operativa" da una vía natural
  para que cambios triviales no pasen por el ritual completo de 8 pasos, resolviendo
  de facto la tensión de L1. L1 queda formalmente abierto hasta que se decida
  explícitamente, pero con el camino ya allanado.
- *L2:* Sin conflicto — la propia resolución de H3 es una decisión reversible (texto
  de ADR, no toca código ni negocio).
- *L3:* Sin instancia nueva — "coherentes con las decisiones constitucionales
  vigentes" está anclado a un test concreto (contradice o no una cláusula
  constitucional ya aprobada, verificable), no es un calificador abierto sin
  heurístico.

**Conclusión:** ninguna incompatibilidad bloqueante con H1, H2, M1-M5 o L1-L3.

**Decisión pendiente:** Ninguna — **RESUELTO**. Pendiente únicamente la redacción
formal de la v1.2, que no se hará hasta cerrar los hallazgos M y (si se decide
abordarlos) los L.

**Nota de aprobación:** Decisión aprobada por el Consejo de Arquitectura (CEO +
Director Técnico + Arquitecto del Ecosistema) el 2026-07-01, verificada contra el
resto del RFC-001 sin incompatibilidades bloqueantes. Queda pendiente únicamente de
la aprobación final de la Directiva Fundacional v1.2, que se redactará cuando se
cierre el RFC-001 completo.

---

<a name="m1"></a>
## M1 — "Nuevos grandes subsistemas" sin umbral objetivo

**Severidad:** MEDIA

**Problema:**
La Congelación de Expansión prohíbe "nuevos grandes subsistemas" sin definir el
umbral que separa una mejora incremental (permitida) de un subsistema nuevo
(congelado). Ejemplo concreto y ya vigente: persistir `PromptShadowLog` en SQLite en
vez de `eprintln!` — ¿es mejorar Prompt Factory o iniciar Experience Core?

**Impacto:**
Disputas de interpretación recurrentes en cada mejora cercana al límite; sin criterio
objetivo, la congelación se aplicará de forma arbitraria o se ignorará por ambigüedad,
vaciándola de efecto práctico.

**Opciones posibles:**

1. **Umbral estructural objetivo:** subsistema nuevo = nuevo módulo top-level + nuevo
   esquema persistido + nueva superficie pública de API. Cualquier cambio por debajo de
   ese umbral es "mejora".
2. **Lista blanca explícita** de qué se considera mejora permitida (p. ej. "persistir
   logs ya existentes", "añadir un modelo a BibliotecaLLM", "ajustar EstrategiaPrompt")
   frente a lista negra de qué requiere desbloqueo.
3. **Dejarlo a criterio caso por caso de Alonso**, sin regla objetiva, resuelto por
   consulta directa cuando surja la duda.

**Ventajas / Inconvenientes:**

- *Opción 1:* Ventaja: aplicable sin consulta humana en la mayoría de casos, reduce
  fricción día a día. Inconveniente: cualquier regla objetiva tendrá casos límite mal
  clasificados (falsos positivos/negativos).
- *Opción 2:* Ventaja: máxima claridad para los casos ya previstos. Inconveniente:
  necesita mantenimiento — cada nuevo tipo de cambio no listado genera la misma duda
  que se quería evitar.
- *Opción 3:* Ventaja: cero trabajo de definición ahora. Inconveniente: reintroduce la
  ambigüedad original; en la práctica generará las mismas disputas que motivaron este
  hallazgo.

**Recomendación técnica:** Opción 1, complementada con 2-3 ejemplos de la Opción 2 como
ilustración (no como lista exhaustiva). Un criterio estructural es más duradero que una
lista blanca, que envejece mal.

---

**Contrapropuesta del Consejo de Arquitectura (Alonso, tras revisión del Arquitecto del
Ecosistema conforme a la Opción 1):** sustituir el umbral puramente técnico por el
concepto de **impacto arquitectónico**. Un cambio se considera nuevo subsistema cuando
introduce al menos dos de seis elementos: nuevo módulo top-level, nuevo esquema
persistido, nueva API pública, nuevo dominio funcional, nueva responsabilidad
arquitectónica, nuevo flujo de datos independiente. Se acompaña de ejemplos
ilustrativos no exhaustivos — mejoras (persistir un shadow log, añadir un modelo a
BibliotecaLLM, ampliar PromptFactory, optimizar ContextEngine, mejorar una estrategia
existente) y subsistemas nuevos (Security Forge, Compliance Forge, Mentor Engine,
Browser Validation System, o cualquier componente con nueva responsabilidad
arquitectónica independiente).

**Auditoría de la contrapropuesta (Director Técnico):** detecta tres problemas. (1)
"Nuevo dominio funcional" y "nueva responsabilidad arquitectónica" se solapan —
prácticamente cualquier cambio que active uno activa el otro, por lo que el umbral "2
de 6" puede satisfacerse con una sola señal real contada dos veces. (2) Tres de los
seis criterios ("dominio funcional", "responsabilidad arquitectónica", en menor medida
"flujo de datos independiente") son calificadores vagos sin heurístico — mismo patrón
que L3 (todavía abierto) señala como riesgo transversal, y reintroduce dentro de M1 la
ambigüedad que M1 existe para eliminar. (3) Incompatibilidad concreta con M2: probado
contra el propio ejemplo de "persistir el shadow log", el cambio activa 2 de 6
(esquema persistido + flujo de datos independiente), clasificándolo como subsistema
nuevo — exactamente lo contrario de lo que M2 necesita para resolverse. Se señala
además, sin ser contradicción, que "Browser Validation System" requiere aclaración
frente a la clasificación de GStack Browser como herramienta externa (DEC-002).
Recomendación: no rechazar el concepto de impacto arquitectónico, pero no incorporarlo
sin resolver los tres puntos.

**Refinamiento final (Alonso):** elimina "nuevo dominio funcional" y "nueva
responsabilidad arquitectónica", sustituyéndolos por un único concepto: **nueva
capacidad arquitectónica independiente**, con heurístico propio — existe una nueva
capacidad cuando el componente introduce un ciclo de vida propio, puede evolucionar
independientemente, requiere gobernanza propia, o cumple una misión distinta del
sistema existente. La regla de decisión queda:

> Un cambio se considera nuevo subsistema cuando:
>
> **A)** Introduce una nueva capacidad arquitectónica independiente (según el
> heurístico anterior).
>
> o
>
> **B)** Cumple dos de estos tres criterios: nuevo módulo top-level, nuevo esquema
> persistido, nueva API pública.

Con dos notas aclaratorias:

> 1. Persistir información adicional de un sistema existente (no solo el caso del
>    Shadow Log) no constituye por sí misma una nueva capacidad arquitectónica.
> 2. "Browser Validation System" hace referencia exclusivamente a un futuro
>    subsistema interno de DixSystem. No debe confundirse con herramientas externas
>    como GStack Browser, clasificadas como herramientas auxiliares de desarrollo
>    (ver `docs/architecture/HERRAMIENTAS_EXTERNAS.md`, DEC-002).

**Auditoría del refinamiento final (Director Técnico):** los tres problemas quedan
resueltos. (1) Al colapsar los dos criterios solapados en uno solo, desaparece el
doble conteo de una misma señal. (2) El heurístico de CASO A es más verificable que
los términos anteriores — "requiere gobernanza propia" conecta directamente con el
concepto ya aprobado en H2 (sistema estratégico con Roadmap propio), dando coherencia
entre hallazgos en vez de un concepto aislado; el margen de juicio que queda es el
mismo que acepta cualquier criterio cualitativo bien anclado por ejemplos, patrón
consistente con lo que L3 recomendará cuando se resuelva. (3) Probado explícitamente
contra "persistir el shadow log": no cumple ninguno de los cuatro sub-criterios de A
(sin ciclo de vida propio, sin evolución independiente, sin gobernanza propia, misma
misión) y solo 1 de 3 en B (esquema persistido, sin módulo nuevo, sin API nueva) — no
se activa ninguno de los dos casos, y la Nota 1 lo generaliza explícitamente más allá
del caso concreto. Probado contra el resto de ejemplos: PromptFactory/BibliotecaLLM/
ContextEngine/estrategia no activan ni A ni B (mejoras); Security Forge/Compliance
Forge/Mentor Engine activan A con claridad (ciclo de vida propio, gobernanza propia y
misión distinta). La Nota 2 cierra formalmente, dentro del propio ADR, la aclaración
entre "Browser Validation System" (hipotético subsistema interno) y GStack Browser
(herramienta externa, DEC-002), sin conflicto con `HERRAMIENTAS_EXTERNAS.md`.

**Decisión aprobada (Consejo de Arquitectura — CEO + Director Técnico, con revisión
previa del Arquitecto del Ecosistema, 2026-07-01):**

> Un cambio se considera **nuevo subsistema** (sujeto a la Congelación de Expansión)
> cuando cumple al menos una de estas dos condiciones:
>
> **CASO A — Nueva capacidad arquitectónica independiente.** Existe una nueva
> capacidad cuando el componente introduce un ciclo de vida propio, puede evolucionar
> independientemente, requiere gobernanza propia, o cumple una misión distinta del
> sistema existente.
>
> **CASO B — Impacto técnico estructural.** Cumple al menos dos de estos tres
> criterios: nuevo módulo top-level, nuevo esquema persistido, nueva API pública.
>
> **Notas aclaratorias:**
>
> 1. Persistir información adicional de un sistema existente (no solo el caso del
>    Shadow Log) no constituye por sí misma una nueva capacidad arquitectónica.
> 2. "Browser Validation System" hace referencia exclusivamente a un futuro
>    subsistema interno de DixSystem — no debe confundirse con herramientas externas
>    como GStack Browser, clasificadas como herramientas auxiliares de desarrollo.
>
> **Ejemplos ilustrativos, no exhaustivos:**
>
> - *Mejoras evolutivas:* persistir un shadow log, añadir un modelo a BibliotecaLLM,
>   ampliar PromptFactory, optimizar ContextEngine, mejorar una estrategia existente.
> - *Nuevos subsistemas:* Security Forge, Compliance Forge, Mentor Engine, Browser
>   Validation System (subsistema interno), o cualquier componente que introduzca una
>   nueva capacidad arquitectónica independiente.

Este texto queda listo para incorporarse a la Congelación de Expansión de la
Directiva Fundacional v1.2, pendiente de que se cierre el RFC-001 completo antes de
redactar esa versión.

**Verificación de compatibilidad cruzada (Director Técnico, 2026-07-01):**

- *H1:* Sin relación, sin conflicto — ejes distintos (política de IA vs. umbral de
  subsistema).
- *H2:* Refuerzo, sin conflicto — "requiere gobernanza propia" (CASO A) reutiliza el
  concepto de sistema estratégico con Roadmap propio ya aprobado en H2, en vez de
  introducir uno nuevo.
- *H3:* Sin conflicto — clasificar un cambio como "nuevo subsistema" bajo esta regla
  activa la Congelación de Expansión, que es una decisión ya Constitucional; no
  cambia el nivel de decisión que corresponde a M1 en sí (Operativa: aplicar el
  criterio ya aprobado).
- *M2:* Resuelto como consecuencia directa — "persistir el shadow log" no activa ni
  CASO A ni CASO B, y la Nota 1 lo generaliza. M2 puede resolverse ahora en la
  dirección que su propia Opción 1 recomendaba.
- *M3, M4, M5:* Sin relación, sin conflicto.
- *L1, L2:* Sin relación, sin conflicto.
- *L3:* Sin instancia nueva bloqueante — CASO A sigue siendo un test cualitativo,
  pero acompañado de ejemplos ilustrativos no exhaustivos, mismo patrón que L3
  recomendará al resolverse. No bloquea el cierre de M1.

**Conclusión:** ninguna incompatibilidad bloqueante con H1, H2, H3, M2-M5 o L1-L3.

**Decisión pendiente:** Ninguna — **RESUELTO**. Pendiente únicamente la redacción
formal de la v1.2, que no se hará hasta cerrar M2-M5 y los hallazgos L (si se decide
abordarlos).

**Nota de aprobación:** Decisión aprobada por el Consejo de Arquitectura (CEO +
Director Técnico, con revisión del Arquitecto del Ecosistema) el 2026-07-01,
verificada contra el resto del RFC-001 sin incompatibilidades bloqueantes. Queda
pendiente únicamente de la aprobación final de la Directiva Fundacional v1.2, que se
redactará cuando se cierre el RFC-001 completo.

---

<a name="m2"></a>
## M2 — El Principio 3 es un mandato activo que hoy se incumple, cuyo único mecanismo pleno está congelado

**Severidad:** MEDIA (agravada si M1 no se resuelve)

**Problema:**
Principio 3 ("toda experiencia útil se convierte en conocimiento permanente") es
Constitución vinculante, no visión futura. Hoy el único mecanismo existente
(`PromptShadowLog`) no persiste — va a stderr y se pierde. El camino para persistirlo
(Experience Core) está clasificado como Visión Futura y sujeto a congelación.

**Impacto:**
Un principio activo que se sabe incumplido desde su aprobación erosiona la autoridad
del resto del documento — la Directiva estaría exigiendo algo que ella misma impide
cumplir.

**Opciones posibles:**

1. **Aclarar que persistir el shadow log actual cuenta como "mejora de lo existente"**
   (no como iniciar Experience Core), permitiéndolo durante la congelación — resuelve
   este hallazgo como consecuencia directa de resolver M1 en esa dirección.
2. **Reformular el Principio 3 como aspiracional** ("el ecosistema debe tender a...")
   hasta que Experience Core exista formalmente, quitándole fuerza normativa inmediata.
3. **Excepción explícita en la Congelación de Expansión** para "extensiones mínimas de
   persistencia de mecanismos ya existentes", sin esperar a resolver M1 de forma
   general.

**Ventajas / Inconvenientes:**

- *Opción 1:* Ventaja: resuelve dos hallazgos con una sola decisión (M1 y M2), mínima
  fricción. Inconveniente: depende de que M1 se resuelva en la dirección compatible;
  si M1 se resuelve distinto, este hallazgo queda abierto de nuevo.
- *Opción 2:* Ventaja: honesto sobre el estado actual, sin prometer lo que no se
  cumple. Inconveniente: debilita un principio que en el fondo es razonable y
  deseable — degradarlo puede leerse como retroceder en ambición sin necesidad.
- *Opción 3:* Ventaja: resuelve el caso concreto sin esperar a resolver M1 en general.
  Inconveniente: introduce una excepción puntual más en un documento que ya tiene
  varias, aumentando la superficie de casos especiales a recordar.

**Recomendación técnica:** Opción 1, condicionada a que M1 se resuelva con un umbral
que permita persistencia incremental de mecanismos existentes. Evita duplicar trabajo
de definición.

---

**Contrapropuesta del Consejo de Arquitectura (Alonso, tras revisión del Arquitecto
del Ecosistema conforme a la Opción 1):** reforzar la justificación conceptual
distinguiendo dos niveles dentro del camino hacia el aprendizaje del ecosistema. El
Shadow Log no constituye un Experience Core — su función es únicamente capturar y
persistir experiencia ya generada por sistemas existentes. Experience Core será un
subsistema futuro cuya misión es transformar esa experiencia en patrones, lecciones
aprendidas, conocimiento reutilizable y mejoras arquitectónicas. Se distinguen:

> **Nivel 1** — Captura y persistencia de experiencia.
> **Nivel 2** — Procesamiento, síntesis y aprendizaje.

La Congelación de Expansión impide crear el Nivel 2 antes de tiempo. No impide
mejorar los mecanismos existentes de captura y persistencia del Nivel 1. El
Principio 3 permanece plenamente vigente; lo único que cambia es la etapa de
madurez del ecosistema.

**Auditoría de la contrapropuesta (Director Técnico):** la distinción es correcta y
necesaria, y consecuencia directa de M1 ya resuelto — persistir el shadow log
(Nivel 1) no activa CASO A (sin ciclo de vida propio, sin evolución independiente,
sin gobernanza propia, misma misión que ya tenía en `eprintln!`) ni CASO B (solo 1
de 3: esquema persistido), coherente con la Nota 1 de M1. Se detecta un hallazgo no
bloqueante: `DIRECTIVA_FUNDACIONAL.md` v1.1 (ya vigente) llama al shadow log
"embrión real" de Experience Core y dice que "el camino natural es extender ese
embrión" — literalmente identificándolo con Experience Core, mientras que la
distinción Nivel 1/Nivel 2 dice lo contrario (el shadow log no es Experience Core,
es Nivel 1, un componente distinto de Nivel 2). No es una contradicción
irreconciliable — es precisamente la ambigüedad que M2 existe para resolver — pero
requiere que, al redactar la v1.2, esa frase se reescriba para reflejar la
distinción (el "embrión" alimenta a Experience Core, no es Experience Core mismo).
Se registra como pendiente de redacción para v1.2, no como bloqueo, mismo
tratamiento que el pendiente ya registrado en H2 (diagrama de Arquitectura
Vigente). Watch-item adicional, no bloqueante: la distinción Nivel 1/Nivel 2 es
interpretativa, no un test operativo nuevo — el test que decide si algo cruza la
línea sigue siendo el de M1 (CASO A/B); cualquier futura extensión de "captura"
debe seguir superándolo, para que "es solo Nivel 1" no se use como excusa para
colar sin auditoría algo con misión, ciclo de vida o gobernanza propios.

**Decisión aprobada (Consejo de Arquitectura — CEO + Director Técnico, con revisión
previa del Arquitecto del Ecosistema, 2026-07-01):**

> El Principio 3 permanece plenamente vigente. Se distinguen dos niveles dentro del
> camino hacia el aprendizaje del ecosistema:
>
> **Nivel 1 — Captura y persistencia de experiencia.** Recoger y almacenar de forma
> duradera la experiencia ya generada por mecanismos existentes (p. ej. persistir
> `PromptShadowLog` en SQLite en vez de `eprintln!`). No introduce una nueva
> capacidad arquitectónica independiente (M1, CASO A/Nota 1) — es mejora de lo
> existente, permitida durante la Congelación de Expansión.
>
> **Nivel 2 — Procesamiento, síntesis y aprendizaje.** Transformar la experiencia
> capturada en patrones, lecciones aprendidas, conocimiento reutilizable y mejoras
> arquitectónicas. Esto es Experience Core en sí, clasificado como Arquitectura
> Objetivo/Visión Futura, sujeto a la Congelación de Expansión.
>
> La Congelación de Expansión impide construir el Nivel 2 antes de la validación
> comercial de DIX Windows. No impide mejorar los mecanismos de Nivel 1 ya
> existentes. Toda extensión de Nivel 1 debe seguir superando el test de M1 (CASO
> A/B) para confirmar que no cruza hacia un nuevo subsistema disfrazado de "mejora
> de captura".

Este texto queda listo para incorporarse al Principio 3 / sección Experience Core
de la Directiva Fundacional v1.2, pendiente de que se cierre el RFC-001 completo
antes de redactar esa versión.

**Pendiente para v1.2 (registrado, no bloqueante):** reescribir la frase de la
sección Experience Core que llama al shadow log "embrión real" de Experience Core,
para reflejar que el embrión es Nivel 1 (captura), no Experience Core en sí
(Nivel 2) — mismo tratamiento que el pendiente ya abierto en H2 sobre el diagrama
de Arquitectura Vigente.

**Verificación de compatibilidad cruzada (Director Técnico, 2026-07-01):**

- *H1:* Sin relación, sin conflicto.
- *H2:* Sin conflicto — el pendiente de redacción de v1.2 se suma al ya existente
  (reestructurar diagrama de Arquitectura Vigente), sin contradicción entre ambos.
- *H3:* Sin conflicto — esta es una Decisión Operativa (aplicar principios ya
  aprobados), no Constitucional.
- *M1:* Sin conflicto — consecuencia directa, ya verificado explícitamente arriba.
- *M3, M4, M5:* Sin relación, sin conflicto.
- *L1, L2:* Sin relación, sin conflicto.
- *L3:* Sin instancia nueva bloqueante — Nivel 1/Nivel 2 son conceptualmente más
  concretos que los calificadores que L3 señala (verbos técnicos distintos:
  almacenar vs. derivar patrones), y quedan además respaldados por el test
  objetivo de M1.

**Conclusión:** ninguna incompatibilidad bloqueante con H1, H2, H3, M1, M3-M5 o
L1-L3. Un hallazgo textual no bloqueante registrado como pendiente para v1.2.

**Decisión pendiente:** Ninguna — **RESUELTO**. Pendiente únicamente la redacción
formal de la v1.2 (incluyendo el ajuste de texto señalado arriba), que no se hará
hasta cerrar M3-M5 y los hallazgos L (si se decide abordarlos).

**Nota de aprobación:** Decisión aprobada por el Consejo de Arquitectura (CEO +
Director Técnico, con revisión del Arquitecto del Ecosistema) el 2026-07-01,
verificada contra el resto del RFC-001 sin incompatibilidades bloqueantes. Queda
pendiente únicamente de la aprobación final de la Directiva Fundacional v1.2, que
se redactará cuando se cierre el RFC-001 completo.

---

<a name="m3"></a>
## M3 — Gate de "validación comercial de DIX Windows" sin dueño ni registro auditable

**Severidad:** MEDIA

**Problema:**
La Congelación de Expansión se levanta con "primera venta confirmada", sin definir
quién certifica el hecho, dónde se registra, ni qué ocurre si tras esa primera venta
las ventas caen a cero.

**Impacto:**
Gate subjetivo y no verificable; alguien podría considerarlo cumplido sin evidencia
trazable, vaciando de contenido la congelación.

**Opciones posibles:**

1. **Atar el desbloqueo a un artefacto verificable** de ORDEN_TRABAJO (p. ej. un hito
   marcado y fechado en el checklist de aceptación global, o un registro de venta con
   fecha), no a una afirmación informal.
2. **Definir un umbral cuantitativo** (p. ej. N ventas en M días) en vez de "primera
   venta", para evitar que un evento aislado desbloquee expansión permanente.
3. **Dejarlo como está**, confiando en que Alonso y Claude Code lo verificarán de
   buena fe cuando llegue el momento, sin mecanismo formal.

**Ventajas / Inconvenientes:**

- *Opción 1:* Ventaja: trazabilidad clara, cero ambigüedad sobre si el gate se cumplió.
  Inconveniente: requiere mantener ese artefacto actualizado y accesible.
- *Opción 2:* Ventaja: evita que un solo evento aislado (una venta puntual, quizá de
  prueba) desbloquee subsistemas grandes de forma permanente. Inconveniente: añade
  fricción y retrasa el desbloqueo si el negocio va lento, pudiendo frustrar el impulso
  cuando la primera venta sí sea señal suficiente.
- *Opción 3:* Ventaja: ninguna carga adicional ahora. Inconveniente: reproduce
  exactamente el problema detectado.

**Recomendación técnica:** Opción 1 como mínimo indispensable; Opción 2 es deseable
pero puede posponerse hasta que exista telemetría de ventas real que permita fijar un
umbral con sentido.

---

**Contrapropuesta del Consejo de Arquitectura (tras revisión del Arquitecto del
Ecosistema conforme a la Opción 1):** reforzar el mecanismo más allá de un artefacto
verificable puntual. La validación comercial se materializa como un **Evento de
Gobernanza**: todo evento que modifique el estado estratégico del ecosistema queda
registrado mediante un expediente auditable con, como mínimo, identificador único,
tipo de evento, fecha, evidencia objetiva, verificador, decisión del Consejo,
consecuencias sobre la gobernanza y documentos afectados. La primera venta
confirmada de DIX Windows constituirá el primer Evento de Gobernanza de este tipo.
No se fija todavía un umbral cuantitativo — el Consejo podrá redefinir el criterio
de validación comercial cuando exista evidencia suficiente del negocio real.

**Auditoría de la contrapropuesta (Director Técnico):** mejora real sobre la Opción
1 — generaliza un mecanismo de trazabilidad más allá de la venta concreta, y
responde directamente a "quién certifica" y "dónde se registra". Detecta cuatro
puntos que requieren aclaración antes de incorporarse: (1) riesgo de que el
"expediente" se convierta en un documento nuevo no contemplado en la lista cerrada
de `GOBERNANZA_INGENIERIA.md` Sección 5, violando la creación perezosa ya aprobada
en H2 — existe precedente directo en DEC-001 (lecciones aprendidas como campo de
Bitácora, no documento aparte) que debería reutilizarse aquí. (2) Autocomprobación
bajo M1: el propio mecanismo, si queda como disciplina documental, no activa CASO A
ni CASO B — pero si se implementara como software (registro con workflow forzado
por código) sí debería pasar el test de M1 en ese momento. (3) El sub-problema
original de M3 sobre qué ocurre si tras la primera venta las ventas caen a cero
queda sin resolver explícitamente en la propuesta — debe documentarse como
diferido, no silenciado. (4) El campo "verificador" no especifica quién lo ocupa
por defecto, con riesgo de leerse como un cuarto asiento del Consejo no
contemplado en la Gobernanza.

**Respuesta del Consejo a los cuatro puntos:**

1. El expediente de un Evento de Gobernanza no vive como documento independiente —
   vive dentro de `BITACORA_DIXSYSTEM.md` como entradas estructuradas. No se crea
   ningún documento adicional.
2. Registrar un Evento de Gobernanza dentro de la Bitácora no constituye un nuevo
   subsistema — es una mejora del sistema de memoria ya existente. No activa los
   criterios de M1 ni requiere desbloquear la Congelación de Expansión.
3. La situación de primera venta seguida de ausencia de ventas no queda resuelta
   todavía. Este ADR define únicamente el mecanismo de certificación y registro del
   evento; la definición de un posible umbral comercial (ventas recurrentes,
   ingresos, telemetría u otros indicadores) queda diferida deliberadamente hasta
   que exista evidencia suficiente del negocio real.
4. El campo "Verificador" no representa un nuevo miembro del Consejo. Por defecto
   lo ejerce el Director Técnico, que verifica la existencia y autenticidad de la
   evidencia objetiva; después el Consejo delibera sobre esa evidencia; la
   aprobación final sigue correspondiendo al CEO conforme a la Gobernanza de
   Ingeniería.

**Auditoría final (Director Técnico):** los cuatro puntos quedan resueltos de forma
consistente con el resto del sistema de gobernanza. (1) Reutiliza exactamente el
patrón ya aprobado en DEC-001/H2. (2) Aplica correctamente el test de M1 sobre sí
mismo, con conclusión verificada: sin ciclo de vida propio, sin gobernanza separada,
misma misión que Bitácora ya tiene, sin módulo/esquema/API nuevos en código — CASO A
y CASO B no se activan. (3) Cierra el hallazgo pendiente de forma explícita en vez
de dejarlo implícito. (4) Coherente con la estructura de tres niveles ya aprobada en
H3 (Director Técnico audita, Consejo delibera, CEO aprueba), sin crear un cuarto
asiento. Observación no bloqueante: el mecanismo es general (no exclusivo de la
venta de DIX Windows) — aplica hacia adelante a futuros eventos estratégicos, sin
requerir reformatear retroactivamente H1-M2.

**Decisión aprobada (Consejo de Arquitectura — CEO + Director Técnico, con revisión
previa del Arquitecto del Ecosistema, 2026-07-01):**

> La validación comercial de DIX Windows (y cualquier evento futuro que modifique el
> estado estratégico del ecosistema) se certifica mediante un **Evento de
> Gobernanza**: una entrada estructurada dentro de `BITACORA_DIXSYSTEM.md` — no un
> documento independiente — con, como mínimo, estos campos: identificador único,
> tipo de evento, fecha, evidencia objetiva, verificador, decisión del Consejo,
> consecuencias sobre la gobernanza, documentos afectados.
>
> El **verificador** por defecto es el Director Técnico (verifica existencia y
> autenticidad de la evidencia objetiva); el Consejo delibera sobre esa evidencia;
> la aprobación final corresponde al CEO. No se crea ningún rol ni asiento nuevo.
>
> Registrar Eventos de Gobernanza en la Bitácora es una mejora del sistema de
> memoria ya existente (DEC-001), no un nuevo subsistema — no activa los criterios
> de M1 ni requiere desbloquear la Congelación de Expansión.
>
> La primera venta confirmada de DIX Windows constituye el primer Evento de
> Gobernanza de este tipo. **No se fija todavía un umbral cuantitativo** (Opción 2
> de este ADR queda deliberadamente diferida): qué ocurre si tras esa primera venta
> las ventas caen a cero es una pregunta abierta que el Consejo resolverá cuando
> exista evidencia suficiente del negocio real.

Este texto queda listo para incorporarse a la Congelación de Expansión / Gate de
validación comercial de la Directiva Fundacional v1.2, y al esquema de Bitácora de
`GOBERNANZA_INGENIERIA.md`, pendiente de que se cierre el RFC-001 completo antes de
redactar esas versiones.

**Pendiente para v1.2 / Gobernanza (registrado, no bloqueante):** incorporar la
definición de "Evento de Gobernanza" (esquema de ocho campos, vive en Bitácora) a
`GOBERNANZA_INGENIERIA.md` cuando se actualice tras el cierre completo del RFC-001.

**Verificación de compatibilidad cruzada (Director Técnico, 2026-07-01):**

- *H1:* Sin relación, sin conflicto.
- *H2:* Refuerzo — reutiliza el patrón de creación perezosa y el precedente de
  DEC-001 (lecciones aprendidas como campo de Bitácora), sin introducir una nueva
  categoría documental.
- *H3:* Sin conflicto — el rol de "verificador" (Director Técnico) es coherente con
  el proceso ya aprobado (auditoría del Director Técnico → deliberación del Consejo
  → aprobación del CEO); esta decisión es Operativa/Estratégica, no toca el
  criterio Constitucional de cuándo se levanta la Congelación.
- *M1:* Sin conflicto — verificado explícitamente que el propio mecanismo no activa
  CASO A ni CASO B mientras permanezca como disciplina documental.
- *M2:* Sin relación, sin conflicto.
- *M4, M5:* Sin relación, sin conflicto.
- *L1, L2:* Sin relación, sin conflicto.
- *L3:* Sin instancia nueva — los ocho campos del expediente son etiquetas
  estructurales de un registro, no calificadores de decisión sujetos al mismo
  riesgo de vaguedad que L3 señala.

**Conclusión:** ninguna incompatibilidad bloqueante con H1, H2, H3, M1, M2, M4, M5 o
L1-L3.

**Decisión pendiente:** Ninguna — **RESUELTO**. Pendiente únicamente la redacción
formal de la v1.2 y la actualización de `GOBERNANZA_INGENIERIA.md` (incluyendo el
esquema de Evento de Gobernanza), que no se hará hasta cerrar M4-M5 y los hallazgos
L (si se decide abordarlos).

**Nota de aprobación:** Decisión aprobada por el Consejo de Arquitectura (CEO +
Director Técnico, con revisión del Arquitecto del Ecosistema) el 2026-07-01,
verificada contra el resto del RFC-001 sin incompatibilidades bloqueantes. Queda
pendiente únicamente de la aprobación final de la Directiva Fundacional v1.2 y de
`GOBERNANZA_INGENIERIA.md`, que se redactarán cuando se cierre el RFC-001 completo.

---

<a name="m4"></a>
## M4 — Inconsistencia entre las dos listas de roles/especialidades

**Severidad:** BAJA-MEDIA

**Problema:**
La lista de especialidades de "Model Router" (Arquitectura Objetivo) incluye
**Marketing**. La lista de "Roles Funcionales" (Responsabilidades) la omite. Mismo
concepto, dos enumeraciones distintas en el mismo documento.

**Impacto:**
Menor, pero es el tipo de discrepancia que se amplía con el tiempo si no se unifica:
futuras ediciones actualizarán una lista y no la otra.

**Opciones posibles:**

1. **Lista única canónica de roles**, referenciada desde ambas secciones (una la
   define, la otra enlaza).
2. **Mantener dos listas con propósitos distintos** explícitamente declarados: una para
   "roles operativos actuales" y otra para "especialidades que Model Router podría
   enrutar en el futuro", aceptando que no tienen por qué coincidir 1:1.

**Ventajas / Inconvenientes:**

- *Opción 1:* Ventaja: elimina la discrepancia de raíz, mantenimiento más simple.
  Inconveniente: ninguno relevante.
- *Opción 2:* Ventaja: reconoce que "roles de hoy" y "especialidades futuras de Model
  Router" son conceptualmente distintos. Inconveniente: requiere dejar muy claro por
  qué difieren, o parecerá el mismo error sin corregir.

**Recomendación técnica:** Opción 1. Es una inconsistencia menor sin justificación
conceptual real detrás — unificar es más simple que mantener dos taxonomías.

---

**Contrapropuesta del Consejo de Arquitectura (tras revisión del Arquitecto del
Ecosistema conforme a la Opción 1):** ir más allá de unificar dos listas — establecer
una **Taxonomía Oficial de Especialidades** del ecosistema, única fuente oficial para
definir qué especialidades funcionales existen en DixSystem. Las demás secciones de
la Directiva (incluida "Especialidades de Model Router") referencian esta taxonomía
en vez de mantener enumeraciones independientes. La incorporación futura de nuevas
especialidades solo requiere modificar la taxonomía.

**Auditoría de la contrapropuesta (Director Técnico):** mejora real sobre la Opción 1
— resuelve la causa raíz (dos enumeraciones que pueden divergir), no solo el síntoma
puntual (Marketing ausente en una). Detecta dos puntos a aclarar: (1) la propuesta no
especifica el contenedor físico de la taxonomía — riesgo de crear un documento nuevo
no contemplado en `GOBERNANZA_INGENIERIA.md` Sección 5 (mismo riesgo ya señalado en
M3), cuando ya existe el contenedor natural: la sección "Roles Funcionales y
Responsabilidades" de `DIRECTIVA_FUNDACIONAL.md`. (2) fusionar ambas listas sin
distinción de estado borraría la diferencia Vigente/Objetivo que H2 ya estableció
para la arquitectura general — Model Router está congelado y sus especialidades
(p. ej. Marketing) no tienen hoy modelo asignado; una lista plana sin estado
reintroduciría esa ambigüedad con otro nombre. Recomendación: la Taxonomía debe vivir
dentro de la Directiva (no documento nuevo) y cada entrada debe llevar un campo de
estado.

**Respuesta del Consejo a los dos puntos:**

1. La Taxonomía no será un documento independiente — forma parte de la Directiva
   Fundacional, única fuente oficial de qué especialidades existen. La Biblioteca LLM
   sigue siendo el único documento que asigna modelos concretos a esas especialidades.
   El Model Router utiliza ambas piezas de información sin duplicarlas. Cada
   documento mantiene una responsabilidad única.
2. Se incorpora un estado arquitectónico por especialidad, con fines documentales
   (no operativos): **Vigente**, **Planificada**, **Experimental**, **Retirada**.
   Indica únicamente el grado de madurez arquitectónica — no implica implementación
   ni asignación de modelos, no modifica la Congelación de Expansión, no constituye
   un nuevo subsistema.

**Auditoría final (Director Técnico):** ambos puntos quedan resueltos. (1) Reutiliza
el contenedor ya existente y reafirma, sin modificarla, la regla ya vigente de que
BibliotecaLLM es el único lugar de asignación de modelos — cada documento con
responsabilidad única, coherente con la creación perezosa de H2. (2) Los cuatro
estados son etiquetas documentales sin ciclo de vida propio, sin gobernanza separada,
sin módulo/esquema/API en código — no activan CASO A ni CASO B de M1. Son además una
taxonomía paralela a la ya existente de Arquitectura Vigente/Objetivo a nivel de
componente, sin solaparse con ella (opera a nivel de especialidad, no de sistema).
Observación no bloqueante, sin necesitar ajuste de texto ahora: el procedimiento para
cambiar el estado de una especialidad (p. ej. Experimental → Vigente) no queda
definido aquí — se resolverá de forma natural cuando se cierre L1 (metodología
aplicada a cambios menores); no bloquea el cierre de M4.

**Decisión aprobada (Consejo de Arquitectura — CEO + Director Técnico, con revisión
previa del Arquitecto del Ecosistema, 2026-07-01):**

> Se establece una **Taxonomía Oficial de Especialidades**, parte de la sección
> "Roles Funcionales y Responsabilidades" de la Directiva Fundacional — única fuente
> oficial de qué especialidades funcionales existen en DixSystem. No se crea ningún
> documento nuevo.
>
> Cada especialidad de la Taxonomía lleva un **estado arquitectónico** documental:
> **Vigente** (activa hoy), **Planificada** (prevista, sin implementación todavía —
> p. ej. Marketing, a la espera de Model Router), **Experimental** o **Retirada**.
> El estado no implica implementación ni asignación de modelos, no modifica la
> Congelación de Expansión y no constituye un nuevo subsistema.
>
> La Biblioteca LLM sigue siendo el único documento que asigna modelos concretos a
> cada especialidad de la Taxonomía. El Model Router, cuando exista, utilizará
> ambas piezas de información (qué especialidades hay, qué modelo ejecuta cada una)
> sin duplicarlas. Toda sección de la Directiva que hoy enumere especialidades
> (incluida "Especialidades de Model Router") pasa a referenciar la Taxonomía en
> vez de mantener su propia lista.

Este texto queda listo para incorporarse a la sección "Roles Funcionales y
Responsabilidades" de la Directiva Fundacional v1.2, pendiente de que se cierre el
RFC-001 completo antes de redactar esa versión.

**Verificación de compatibilidad cruzada (Director Técnico, 2026-07-01):**

- *H1:* Sin relación, sin conflicto.
- *H2:* Refuerzo — mismo principio de responsabilidad única por documento y
  creación perezosa ya aprobados; la distinción Vigente/Planificada/Experimental/
  Retirada opera en paralelo a Arquitectura Vigente/Objetivo sin solaparse.
- *H3:* Sin conflicto — modificar la sección de Roles Funcionales es Decisión
  Constitucional, tramitada correctamente por el Consejo completo.
- *M1:* Sin conflicto — verificado explícitamente que la Taxonomía y sus estados no
  activan CASO A ni CASO B.
- *M2, M3:* Sin relación, sin conflicto.
- *M5:* Sin relación, sin conflicto.
- *L1:* Observación de seguimiento, no bloqueante — el procedimiento de cambio de
  estado de una especialidad quedará más claro cuando L1 se resuelva.
- *L2, L3:* Sin relación, sin conflicto.

**Conclusión:** ninguna incompatibilidad bloqueante con H1, H2, H3, M1, M2, M3, M5 o
L1-L3.

**Decisión pendiente:** Ninguna — **RESUELTO**. Pendiente únicamente la redacción
formal de la v1.2, que no se hará hasta cerrar M5 y los hallazgos L (si se decide
abordarlos).

**Nota de aprobación:** Decisión aprobada por el Consejo de Arquitectura (CEO +
Director Técnico, con revisión del Arquitecto del Ecosistema) el 2026-07-01,
verificada contra el resto del RFC-001 sin incompatibilidades bloqueantes. Queda
pendiente únicamente de la aprobación final de la Directiva Fundacional v1.2, que se
redactará cuando se cierre el RFC-001 completo.

---

<a name="m5"></a>
## M5 — "Estándar DixSystem" (Principio 4) sin definir

**Severidad:** MEDIA

**Problema:**
"Nunca publicar una AppIA que no cumpla el estándar DixSystem" — ese estándar no se
define en ningún lugar del documento (arrastrado sin resolver desde v1.0).

**Impacto:**
Regla inaplicable en la práctica: no hay contra qué verificarla, cualquiera puede
alegar cumplimiento o incumplimiento sin criterio objetivo.

**Opciones posibles:**

1. **Definir un checklist mínimo** de "estándar DixSystem" en un anexo de la Directiva
   o en un documento hermano (p. ej. tests pasando, sin secretos hardcodeados, sin
   `.unwrap()` en producción, documentación mínima, etc. — parte de esto ya vive en
   `reglas_dixsystem()` en el código).
2. **Referenciar el código existente** (`reglas_dixsystem()` en
   `prompt_factory/mod.rs`) como la fuente viva del estándar, evitando duplicar la
   definición en dos lugares.
3. **Reformular el principio como aspiracional** sin checklist formal, aceptando que
   "estándar DixSystem" es una guía de calidad, no un gate verificable.

**Ventajas / Inconvenientes:**

- *Opción 1:* Ventaja: hace el principio verificable de verdad. Inconveniente: crea un
  documento más que mantener sincronizado con el código.
- *Opción 2:* Ventaja: una sola fuente de verdad (el código), coherente con el patrón ya
  usado para Prompt Score y Confidence Score en la v1.1. Inconveniente: el estándar
  queda disperso en código en vez de ser legible como documento de referencia.
- *Opción 3:* Ventaja: cero esfuerzo de mantenimiento. Inconveniente: el principio 4
  queda tan vacío como está hoy.

**Recomendación técnica:** Opción 2, coherente con la decisión ya tomada en v1.1 para
Prompt Score/Confidence Score (el documento fija el principio, el código fija el
mecanismo). Evita crear una tercera fuente de verdad.

---

**Contrapropuesta del Consejo de Arquitectura (tras revisión del Arquitecto del
Ecosistema):** el Estándar DixSystem no debe residir exclusivamente en el código ni
exclusivamente en la documentación. Se separa en tres niveles: **Nivel 1** — la
Directiva Fundacional establece la existencia del Estándar DixSystem como requisito
obligatorio para toda AppIA publicada. **Nivel 2** — la Gobernanza de Ingeniería
define el procedimiento mediante el cual dicho estándar evoluciona y es aprobado por
el Consejo. **Nivel 3** — el Motor de Validación DixSystem implementa técnicamente
los criterios vigentes mediante código. El código deja de ser la fuente del
estándar y pasa a ser su implementación.

**Auditoría de la contrapropuesta (Director Técnico):** el modelo de tres niveles es
correcto y coherente con el patrón de responsabilidad única ya usado en M3 y M4.
Detecta dos puntos: (1) si el código "deja de ser la fuente", no queda especificado
dónde vive entonces el contenido concreto de los criterios vigentes — sin esa pieza,
la distinción es solo semántica. (2) Riesgo real, no de redacción: aplicado el test
de M1, el "Motor de Validación DixSystem" podría constituir un subsistema nuevo
(módulo separado + esquema de criterios versionado + API propia), quedando sujeto a
la Congelación de Expansión hasta la venta confirmada de DIX Windows — dejando a M5
sin mecanismo operativo mientras tanto. Requiere que el Consejo aclare si el Motor
es extensión de Prompt Factory o módulo nuevo.

**Respuesta del Consejo al Punto 2:** el Motor de Validación DixSystem no
constituye un nuevo módulo del ecosistema — se define oficialmente como una
extensión de Prompt Factory, responsable de implementar técnicamente los criterios
vigentes del Estándar DixSystem. Por tanto no constituye un nuevo subsistema, no
activa los criterios de M1, no vulnera la Congelación de Expansión, no requiere
nueva gobernanza (reutiliza el proceso ya existente del Consejo) y hereda el ciclo
de vida de Prompt Factory. Queda además aclarada la diferencia con Prompt
Score/Confidence Score: estos son mecanismos internos de calidad; el Estándar
DixSystem es un requisito oficial de publicación de AppIAs — de ahí que mantenga
tres niveles en vez de los dos que bastan para Prompt Score/Confidence Score.

**Auditoría final (Director Técnico):** el Punto 2 queda verificado, no solo
declarado. Aplicando el test de M1 explícitamente: CASO A no se activa (hereda
ciclo de vida de Prompt Factory, sin gobernanza separada, misión de verificación ya
convivía hoy con Prompt Factory — `reglas_dixsystem()` ya vive dentro de
`prompt_factory/mod.rs`, no es una reclasificación conveniente sino formalizar
dónde el código ya está); CASO B no se activa (crece dentro de un módulo existente,
sin esquema de almacenamiento nuevo, sin API de subsistema nuevo). Doblemente
confirmado por la propia Congelación de Expansión, que ya exime explícitamente a
Prompt Factory. El Punto 1 se resuelve con infraestructura ya existente, sin
inventar nada nuevo: cada cambio futuro al Estándar DixSystem sigue el
procedimiento del Nivel 2 (RFC/ADR, aprobación del Consejo) y queda registrado como
entrada en `DECISIONES.md` — la fuente del contenido concreto es el registro de
decisiones ya aprobado por el Consejo; el Motor de Validación (Prompt Factory)
implementa lo que la entrada vigente de `DECISIONES.md` establece en cada momento.
Mismo patrón de reutilización ya aplicado en M3 y M4 — cero documentos nuevos.

**Decisión aprobada (Consejo de Arquitectura — CEO + Director Técnico, con revisión
previa del Arquitecto del Ecosistema, 2026-07-01):**

> El Estándar DixSystem se estructura en tres niveles, cada uno con responsabilidad
> única:
>
> **Nivel 1 — Principio (Directiva Fundacional).** Establece la existencia del
> Estándar DixSystem como requisito obligatorio para toda AppIA publicada
> (Principio 4).
>
> **Nivel 2 — Proceso (Gobernanza de Ingeniería).** Define el procedimiento
> mediante el cual el estándar evoluciona: cambios a sus criterios siguen el
> proceso oficial de decisión ya establecido (RFC/ADR, auditoría del Director
> Técnico, deliberación del Consejo, aprobación del CEO) y quedan registrados como
> entrada vigente en `DECISIONES.md` — sin crear ningún documento nuevo.
>
> **Nivel 3 — Ejecución técnica (Motor de Validación DixSystem, extensión de
> Prompt Factory).** Implementa en código los criterios vigentes según la última
> entrada aprobada en `DECISIONES.md`. El código deja de ser la fuente del
> estándar y pasa a ser su implementación. No constituye un subsistema nuevo, no
> activa los criterios de M1, no vulnera la Congelación de Expansión, no requiere
> nueva gobernanza y hereda el ciclo de vida de Prompt Factory.

Este texto queda listo para incorporarse al Principio 4 de la Directiva Fundacional
v1.2 y a la Sección 5/6 de `GOBERNANZA_INGENIERIA.md` (procedimiento de evolución
del estándar), pendiente de que se cierre el RFC-001 completo antes de redactar
esas versiones.

**Pendiente para Gobernanza (registrado, no bloqueante):** incorporar el
procedimiento de evolución del Estándar DixSystem (Nivel 2) a
`GOBERNANZA_INGENIERIA.md` cuando se actualice tras el cierre completo del
RFC-001 — se suma al pendiente ya registrado en M3 (esquema de Evento de
Gobernanza).

**Verificación de compatibilidad cruzada (Director Técnico, 2026-07-01):**

- *H1:* Sin relación, sin conflicto.
- *H2:* Refuerzo — reutiliza Directiva + Gobernanza + Decisiones + Prompt Factory,
  cero documentos nuevos, mismo principio de creación perezosa y responsabilidad
  única ya aplicado en M3/M4.
- *H3:* Sin conflicto — cambios de criterio del estándar son Decisión
  Constitucional/Estratégica (vía Consejo); cambios técnicos del Motor que no
  alteren criterios son Decisión Operativa (Director Técnico).
- *M1:* Sin conflicto — verificado explícitamente que el Motor de Validación, como
  extensión de Prompt Factory, no activa CASO A ni CASO B.
- *M2, M3, M4:* Sin relación, sin conflicto (M3 comparte el mismo patrón de
  pendiente para Gobernanza).
- *L1, L2, L3:* Sin relación, sin conflicto.

**Conclusión:** ninguna incompatibilidad bloqueante con H1, H2, H3, M1-M4 o L1-L3.

**Decisión pendiente:** Ninguna — **RESUELTO**. Con esto quedan resueltos los cinco
hallazgos de severidad ALTA y MEDIA del RFC-001 (H1, H2, H3, M1, M2, M3, M4, M5).
Pendiente únicamente la redacción formal de la v1.2 y la actualización de
`GOBERNANZA_INGENIERIA.md`, y decidir si se abordan los hallazgos L1-L3 (bajos)
antes de redactar esas versiones.

**Nota de aprobación:** Decisión aprobada por el Consejo de Arquitectura (CEO +
Director Técnico, con revisión del Arquitecto del Ecosistema) el 2026-07-01,
verificada contra el resto del RFC-001 sin incompatibilidades bloqueantes. Queda
pendiente únicamente de la aprobación final de la Directiva Fundacional v1.2 y de
`GOBERNANZA_INGENIERIA.md`, que se redactarán cuando se cierre el RFC-001 completo.

---

<a name="l1"></a>
## L1 — Metodología Oficial de 8 pasos aplicada sin excepción a cualquier cambio

**Severidad:** BAJA

**Problema:**
"Nunca alterar este flujo" (Comprender→Diseñar→Implementar→Compilar→Probar→
Auditar→Aprender→Commit) se aplica sin excepción, incluso a un typo o un comentario.
Tensiona con la Regla 80/20 y "la complejidad debe ganarse".

**Impacto:**
Riesgo de parálisis ritual en cambios triviales; en la práctica probablemente se
ignore para esos casos, lo que enseña que la regla es negociable de facto.

**Opciones posibles:**

1. **Acotar el flujo obligatorio** a "cambios de arquitectura o funcionalidad
   significativos", dejando cambios triviales (typos, comentarios, formateo) exentos.
2. **Mantenerlo universal** pero interpretar los pasos como escalables en esfuerzo (un
   typo pasa por los 8 pasos en segundos, no en horas), sin excepción formal.

**Ventajas / Inconvenientes:**

- *Opción 1:* Ventaja: coherente con 80/20, evita ritual innecesario. Inconveniente:
  "significativo" es otro calificador vago (ver L3) que habría que acotar.
- *Opción 2:* Ventaja: no introduce excepciones ni nuevos calificadores. Inconveniente:
  en la práctica es indistinguible de no tener la regla para cambios triviales.

**Recomendación técnica:** Opción 1, aceptando que "significativo" necesitará el mismo
tipo de heurístico mínimo propuesto en L3.

---

**Contrapropuesta del Consejo de Arquitectura (tras revisión del Arquitecto del
Ecosistema):** el problema no es la existencia del flujo, sino asumir que todas las
fases deben ejecutarse siempre con la misma profundidad. El flujo oficial
(Comprender→Diseñar→Implementar→Compilar→Probar→Auditar→Aprender→Commit) permanece
universal e invariable — ningún cambio se salta ninguna fase. Lo que se adapta es
el nivel de profundidad requerido en cada fase, proporcional al alcance del
cambio: un typo resuelve varias etapas de forma prácticamente inmediata; una
modificación arquitectónica exige un desarrollo completo de todas ellas. No se
introducen excepciones, no aparecen nuevos calificadores, no se debilita la
metodología.

**Auditoría de la contrapropuesta (Director Técnico):** es, en esencia, una
formalización de la Opción 2 ya listada en este ADR (profundidad escalable, sin
excepción formal), pero resuelve el inconveniente que esa opción tenía anotado
("en la práctica es indistinguible de no tener la regla"): al convertir
"profundidad proporcional al alcance" en un principio explícito y nombrado, deja de
ser una interpretación informal y pasa a ser una regla verificable en sí misma
(¿se recorrieron las 8 fases, aunque sea mínimamente? sí/no). Satisface la letra de
"nunca alterar este flujo" sin caer en el ritual desproporcionado que motivó L1.
Punto de atención no bloqueante: pese a afirmar que "no aparecen nuevos
calificadores", "alcance del cambio" cumple en la práctica la misma función que
"cambio significativo" habría cumplido en la Opción 1 — sigue exigiendo juicio
cualitativo. No invalida la propuesta (preservar el flujo íntegro es una mejora
real independientemente de esto), pero queda registrado como dependencia hacia
adelante: cuando se resuelva L3, sus heurísticos deberían aplicarse también para
calibrar qué cuenta como "alcance" en L1.

**Decisión aprobada (Consejo de Arquitectura — CEO + Director Técnico, con revisión
previa del Arquitecto del Ecosistema, 2026-07-01):**

> El flujo oficial de 8 pasos (Comprender→Diseñar→Implementar→Compilar→Probar→
> Auditar→Aprender→Commit) permanece universal e invariable para todo cambio, sin
> excepciones ni fases omitidas. La **profundidad** de ejecución de cada fase es
> proporcional al alcance del cambio: un typo o un ajuste trivial recorre las ocho
> fases de forma prácticamente inmediata; una modificación arquitectónica exige
> desarrollo completo de cada una. El flujo no se debilita ni se excepciona — se
> calibra en esfuerzo, nunca en presencia de fases.

Este texto queda listo para incorporarse a la sección "Metodología Oficial" de la
Directiva Fundacional v1.2, pendiente de que se cierre el RFC-001 completo antes de
redactar esa versión.

**Verificación de compatibilidad cruzada (Director Técnico, 2026-07-01):**

- *H1, H2, H3, M1-M5:* Sin relación, sin conflicto.
- *Regla 80/20 y "la complejidad debe ganarse" (ya vigentes):* Refuerzo, sin
  conflicto — la profundidad proporcional resuelve la tensión que el propio
  "Impacto" de L1 señalaba, en vez de crearla.
- *L2:* Sin relación, sin conflicto.
- *L3:* Sin instancia bloqueante — "alcance del cambio" es un calificador que se
  beneficiará de los heurísticos de L3 cuando se resuelva; registrado como
  dependencia hacia adelante, no bloquea el cierre de L1.

**Conclusión:** ninguna incompatibilidad bloqueante con H1, H2, H3, M1-M5 o L2-L3.

**Decisión pendiente:** Ninguna — **RESUELTO**.

**Nota de aprobación:** Decisión aprobada por el Consejo de Arquitectura (CEO +
Director Técnico, con revisión del Arquitecto del Ecosistema) el 2026-07-01,
verificada contra el resto del RFC-001 sin incompatibilidades bloqueantes. Queda
pendiente únicamente de la aprobación final de la Directiva Fundacional v1.2, que
se redactará cuando se cierre el RFC-001 completo.

---

<a name="l2"></a>
## L2 — Alcance de Reversibilidad (Principio 12) sin acotar

**Severidad:** BAJA

**Problema:**
ORDEN_TRABAJO Fase 3 asume conscientemente una decisión irreversible ("una vez
público, no hay vuelta atrás"). El Principio 12 no aclara si aplica solo al plano
arquitectónico/técnico de la Directiva o también a decisiones de producto/negocio ya
resueltas en ORDEN_TRABAJO.

**Impacto:**
Un agente podría invocar el Principio 12 para objetar o bloquear una decisión de
negocio ya tomada conscientemente como irreversible, generando fricción innecesaria.

**Opciones posibles:**

1. **Acotar explícitamente el Principio 12** a decisiones arquitectónicas/técnicas
   dentro del dominio de la Directiva, dejando las decisiones de producto/negocio bajo
   ORDEN_TRABAJO (coherente con la Jerarquía Documental).
2. **Dejarlo sin acotar**, confiando en que la Jerarquía Documental ya resuelve
   implícitamente cualquier conflicto (ORDEN_TRABAJO prevalece).

**Ventajas / Inconvenientes:**

- *Opción 1:* Ventaja: cierra el hueco de forma explícita, sin depender de una
  inferencia indirecta desde la Jerarquía Documental. Inconveniente: ninguno relevante.
- *Opción 2:* Ventaja: no añade texto. Inconveniente: deja la resolución del conflicto
  implícita, exactamente el tipo de ambigüedad que esta auditoría busca eliminar.

**Recomendación técnica:** Opción 1. Es una aclaración de una línea con beneficio claro
y sin coste.

---

**Nota de proceso:** este hallazgo se deliberó mediante un experimento de **Consejo de
Arquitectura distribuido** — Alonso conectó a Claude Code (Director Técnico) en vivo,
vía automatización de navegador (GStack, con sesión real de ChatGPT), con la
conversación de ChatGPT donde reside el Arquitecto del Ecosistema. Claude Code exportó
el ADR, recibió y auditó la contrapropuesta de ChatGPT, señaló un hallazgo, ChatGPT lo
aceptó, y el resultado volvió al Consejo (Alonso) para su validación final antes de
documentarse aquí — mismo rigor y mismos pasos que en las rondas anteriores, con la
diferencia de que la deliberación técnica ocurrió directamente entre las dos IAs.

**Contrapropuesta del Consejo de Arquitectura (Arquitecto del Ecosistema, tras
auditoría del Director Técnico sobre la Opción 1):** reforzar la Opción 1 explicando
por qué el Principio 12 se delimita, no solo declarándolo. El Principio de
Reversibilidad pertenece exclusivamente al ámbito arquitectónico y técnico gobernado
por la Directiva Fundacional — favorece decisiones que puedan revisarse, evolucionarse
o revertirse cuando exista evidencia suficiente. No resulta aplicable a decisiones
comerciales o de negocio adoptadas deliberadamente dentro de ORDEN_TRABAJO u otros
documentos estratégicos, que pueden ser conscientemente irreversibles cuando la
estrategia de producto lo requiera. Esto no es una excepción al Principio 12 —es una
delimitación explícita de su ámbito. Se acompaña de ejemplos ilustrativos: Arquitectura
(estructura del ecosistema, responsabilidades, módulos, gobernanza, patrones,
interfaces) frente a Negocio (lanzamiento público, cambio de marca, apertura comercial,
publicación de una AppIA, licenciamiento, estrategia comercial).

**Auditoría de la contrapropuesta (Director Técnico):** la propuesta final es correcta
y coherente — refuerza H2 (Jerarquía Documental) sin contradecirla. Verificado
explícitamente contra H1: sin solapamiento real pese a la similitud superficial — H1
clasifica infraestructura según política de IA (Fabricación/Producto); esta propuesta
clasifica decisiones según necesidad de reversibilidad (Arquitectura/Negocio); ejes
distintos, compatibles. Hallazgo no bloqueante detectado en el razonamiento
exploratorio (no en la propuesta final): se mencionaba una posible taxonomía futura
"Arquitectónica → Estratégica → Operativa → Comercial" que reutilizaba literalmente
"Estratégica" y "Operativa", ya definidas en H3 con significado distinto (ahí
clasifican quién tiene autoridad para aprobar una decisión, no a qué dominio
pertenece). Riesgo de colisión semántica si se formalizara así en el futuro.

**Respuesta del Arquitecto del Ecosistema:** acepta íntegramente la observación,
retira esa nomenclatura provisional. Cuando se diseñe en el futuro un "Mapa de
Dominios de Decisión" (idea explícitamente diferida, no se implementa ahora), deberá
usar terminología propia y diferenciada de Constitucional/Estratégica/Operativa
(H3), para no sembrar ambigüedad futura. Mantiene únicamente la propuesta final para
L2, sin incompatibilidades adicionales.

**Decisión aprobada (Consejo de Arquitectura — CEO + Director Técnico, con
deliberación en vivo del Arquitecto del Ecosistema, 2026-07-01):**

> El Principio de Reversibilidad pertenece exclusivamente al ámbito arquitectónico y
> técnico gobernado por la Directiva Fundacional. Su finalidad es favorecer decisiones
> que puedan revisarse, evolucionarse o revertirse cuando exista evidencia suficiente.
> No resulta aplicable a decisiones comerciales o de negocio adoptadas deliberadamente
> dentro de ORDEN_TRABAJO u otros documentos estratégicos. Las decisiones de negocio
> podrán ser conscientemente irreversibles cuando así lo requiera la estrategia del
> producto. Esta delimitación no constituye una excepción al Principio de
> Reversibilidad — constituye una definición explícita de su ámbito de aplicación.
>
> **Ejemplos ilustrativos, no exhaustivos:**
>
> - *Arquitectura (sujeta a Reversibilidad):* estructura del ecosistema,
>   responsabilidades, módulos, gobernanza, patrones, interfaces.
> - *Negocio (puede ser deliberadamente irreversible):* lanzamiento público, cambio de
>   marca, apertura comercial, publicación de una AppIA, licenciamiento, estrategia
>   comercial.
>
> **Nota registrada para el futuro:** si se crea un "Mapa de Dominios de Decisión",
> deberá utilizar terminología propia, diferenciada de Constitucional/Estratégica/
> Operativa (H3), para evitar colisión semántica.

Este texto queda listo para incorporarse al Principio 12 de la Directiva Fundacional
v1.2, pendiente de que se cierre el RFC-001 completo antes de redactar esa versión.

**Verificación de compatibilidad cruzada (Director Técnico, 2026-07-01):**

- *H1:* Sin conflicto — verificado explícitamente que los dos ejes de clasificación
  (infraestructura/política de IA vs. decisión/reversibilidad) no se solapan.
- *H2:* Refuerzo — reafirma que la Directiva gobierna arquitectura y ORDEN_TRABAJO
  gobierna negocio, sin modificar la Jerarquía Documental.
- *H3:* Refuerzo — la nota registrada protege explícitamente los nombres
  Constitucional/Estratégica/Operativa de una futura colisión semántica.
- *M1-M5:* Sin relación, sin conflicto.
- *L1:* Sin relación, sin conflicto.
- *L3:* Sin instancia bloqueante — los dominios (Arquitectura/Negocio) quedan
  anclados con ejemplos ilustrativos, mismo patrón ya usado en el resto del RFC-001.

**Conclusión:** ninguna incompatibilidad bloqueante con H1, H2, H3, M1-M5, L1 o L3.

**Decisión pendiente:** Ninguna — **RESUELTO**.

**Nota de aprobación:** Decisión aprobada por el Consejo de Arquitectura (CEO +
Director Técnico) el 2026-07-01, tras deliberación técnica en vivo con el Arquitecto
del Ecosistema (primer experimento de Consejo de Arquitectura distribuido), verificada
sin incompatibilidades bloqueantes. Queda pendiente únicamente de la aprobación final
de la Directiva Fundacional v1.2, que se redactará cuando se cierre el RFC-001
completo.

---

<a name="l3"></a>
## L3 — Calificadores vagos repetidos sin heurístico mínimo

**Severidad:** BAJA (transversal)

**Problema:**
"Importante", "confianza suficiente/insuficiente", "riesgo elevado" aparecen en tres
secciones (Confidence Score, Reversibilidad, Política de IA) sin ejemplo ni umbral,
ni siquiera cualitativo.

**Impacto:**
Abre la puerta a que cualquier agente decida unilateralmente que algo "no era
importante" y se salte la salvaguarda correspondiente — el mismo patrón de vaguedad
gameable en tres lugares distintos.

**Opciones posibles:**

1. **Añadir 2-3 heurísticos de ejemplo comunes** a las tres secciones (afecta a más de
   un módulo, toca esquema persistido, no reversible en menos de un día, tiene coste
   económico real), sin pretender ser exhaustivos.
2. **Dejarlo como principio deliberadamente abierto**, confiando en el criterio humano
   (Alonso / Claude Code) caso por caso, sin heurísticos escritos.

**Ventajas / Inconvenientes:**

- *Opción 1:* Ventaja: reduce la posibilidad de que un agente se autoexima de la
  salvaguarda por conveniencia. Inconveniente: los ejemplos pueden quedarse cortos o
  desactualizarse.
- *Opción 2:* Ventaja: máxima flexibilidad, cero mantenimiento. Inconveniente: es
  precisamente la ambigüedad que motivó este hallazgo — no lo resuelve, lo perpetúa.

**Recomendación técnica:** Opción 1. Ejemplos no exhaustivos son mejor que ningún
criterio; reducen el riesgo de gaming sin convertir el principio en burocracia rígida.

---

**Nota de proceso:** este hallazgo se auditó mediante relay manual entre Alonso, el
Arquitecto del Ecosistema (ChatGPT, vía Chromium) y el Director Técnico (Claude Code)
— tras confirmarse que la automatización de navegador (GStack) queda bloqueada por el
reto anti-bot de Cloudflare en chatgpt.com.

**Contrapropuesta del Consejo de Arquitectura (tras auditoría del Arquitecto del
Ecosistema sobre la Opción 1):** en lugar de añadir ejemplos independientes a cada una
de las tres secciones, incorporar un único **bloque común de Heurísticos
Arquitectónicos** que sirva para interpretar todos los calificadores cualitativos de
la Directiva Fundacional. Los heurísticos no constituyen reglas automáticas — son
criterios comunes de interpretación, de carácter ilustrativo y no exhaustivo, que
orientan el juicio del lector sin sustituir la deliberación técnica. Propuesta inicial
de seis criterios: impacto sobre más de un sistema; modificación de datos persistidos;
reversibilidad limitada; impacto económico real; modificación de interfaces públicas;
alteración de principios o gobernanza.

**Auditoría de la contrapropuesta (Director Técnico):** mejora real sobre la Opción 1
original — evita que tres listas de ejemplos independientes diverjan con el tiempo
(mismo problema de fondo que M4 resolvió para las listas de especialidades). Detecta
tres puntos antes de incorporarla: (1) no se especifica el contenedor físico del
bloque, mismo riesgo ya señalado en M3 y M4 de crear un documento nuevo no
contemplado en `GOBERNANZA_INGENIERIA.md` Sección 5. (2) Falta una cláusula de
precedencia: dos de los seis criterios solapan literalmente con tests ya resueltos y
cerrados (modificación de datos persistidos / interfaces públicas ↔ CASO B de M1;
alteración de principios o gobernanza ↔ Decisiones Constitucionales de H3) — sin esa
cláusula, un lector podría interpretar el bloque general como sustituto de esos tests
específicos. (3) El propio H1, al cerrarse, registró explícitamente como pendiente
para L3 la frase "reemplazable cuando sea razonablemente posible" — ninguno de los
seis criterios cubre la sustituibilidad de una dependencia, dejando ese pendiente sin
heurístico que lo ancle.

**Respuesta del Consejo a los tres puntos (tras nueva revisión del Arquitecto del
Ecosistema):**

1. Se elimina "alcance del cambio" (el calificador que L1 dejó pendiente) de
   cualquier intento de incluirlo como heurístico autónomo — el Arquitecto del
   Ecosistema señaló que hacerlo sería circular, ya que es precisamente el término
   que los heurísticos deben ayudar a calibrar. "Alcance del cambio" pasa a tratarse
   como propiedad emergente del resto de criterios (cuantos más active un cambio,
   mayor su alcance), no como un criterio independiente.
2. Se incorpora una **cláusula de precedencia**: los Heurísticos Arquitectónicos
   constituyen criterios generales de interpretación; cuando exista un procedimiento
   específico ya aprobado para un ámbito determinado (el Test Estructural de M1, la
   clasificación de decisiones de H3), dicho procedimiento prevalece sobre los
   heurísticos generales.
3. Se incorpora un **séptimo criterio ilustrativo**: existencia de una alternativa
   funcional razonablemente viable que permita sustituir la solución actual sin
   alterar los principios fundamentales del ecosistema. Cierra el pendiente heredado
   de H1.

**Auditoría final (Director Técnico):** los tres puntos quedan resueltos. (1)
Correcto — resuelve la dependencia de L1 sin la circularidad que se habría
introducido incluyendo "alcance del cambio" dentro de la propia lista que lo
calibra. (2) Cierra exactamente el riesgo de solapamiento detectado, con los dos
casos reales (M1, H3) nombrados explícitamente. (3) El séptimo criterio cierra el
pendiente literal de H1; verificado que no introduce un defecto nuevo (el bloque
completo ya se define como criterios de interpretación, no reglas automáticas —
exigir precisión cuantitativa solo al séptimo criterio sería un estándar que ninguno
de los otros seis cumple) ni duplica el criterio 6 (evalúan propiedades distintas: si
la decisión altera principios, frente a si existe alternativa que los preserve).
Verificado que todas las dependencias hacia L3 registradas en el resto del RFC-001
(H1, L1) quedan cerradas; el resto de hallazgos (H2, H3, M1-M5, L2) no tenían
dependencia pendiente, solo confirmaciones de consistencia ya satisfechas.

**Decisión aprobada (Consejo de Arquitectura — CEO + Director Técnico, con revisión
del Arquitecto del Ecosistema, 2026-07-02):**

> Se incorpora a la Directiva Fundacional un bloque único de **Heurísticos
> Arquitectónicos**, criterios comunes para interpretar los calificadores
> cualitativos utilizados en Confidence Score, Reversibilidad y Política de IA. Los
> heurísticos no constituyen reglas automáticas — son criterios de interpretación,
> de carácter ilustrativo y no exhaustivo, que orientan el juicio del lector sin
> sustituir la deliberación técnica.
>
> **Criterios ilustrativos:**
> - Impacto sobre más de un sistema.
> - Modificación de datos persistidos.
> - Reversibilidad limitada.
> - Impacto económico real.
> - Modificación de interfaces públicas.
> - Alteración de principios o gobernanza.
> - Existencia de una alternativa funcional razonablemente viable que permita
>   sustituir la solución actual sin alterar los principios fundamentales del
>   ecosistema.
>
> **Cláusula de precedencia:** cuando exista un procedimiento específico ya
> aprobado para un ámbito determinado (p. ej. el Test Estructural de M1 para "nuevo
> subsistema", la clasificación de Decisiones Constitucionales/Estratégicas/
> Operativas de H3), dicho procedimiento prevalece sobre los heurísticos generales
> de este bloque.

Este texto queda listo para incorporarse a Confidence Score, Reversibilidad y
Política de IA de la Directiva Fundacional v1.2.

**Pendiente para v1.2 (registrado, no bloqueante):** especificar el contenedor
físico del bloque de Heurísticos Arquitectónicos dentro de la propia Directiva
Fundacional (sin crear documento nuevo, coherente con la creación perezosa ya
aprobada en H2), referenciado desde las tres secciones que hoy usan calificadores
sin heurístico. Se suma a los pendientes ya registrados en H2 (diagrama de
Arquitectura Vigente), M2 ("embrión real"), M3 (esquema de Evento de Gobernanza) y
M5 (procedimiento de evolución del Estándar DixSystem).

**Verificación de compatibilidad cruzada (Director Técnico, 2026-07-02):**

- *H1:* Resuelto — el séptimo criterio cierra el pendiente registrado explícitamente
  al cerrar H1.
- *H2:* Sin conflicto — el pendiente de contenedor se suma al ya abierto, mismo
  tratamiento; la cláusula de precedencia no crea documento nuevo.
- *H3:* Refuerzo, sin conflicto — la cláusula de precedencia protege explícitamente
  la clasificación de niveles de decisión de H3 frente a una lectura competidora del
  bloque general.
- *M1:* Refuerzo, sin conflicto — la cláusula de precedencia protege explícitamente
  el Test Estructural (CASO A/B) frente a una lectura competidora del bloque
  general.
- *M2:* Sin relación, sin conflicto.
- *M3, M4, M5:* Sin relación, sin conflicto — mismo patrón de pendiente-para-
  Gobernanza que ya usan M3 y M5.
- *L1:* Resuelto — "alcance del cambio" queda cerrado como propiedad emergente de
  los siete criterios, sin necesidad de heurístico propio.
- *L2:* Sin conflicto — los dominios Arquitectura/Negocio ya estaban anclados con
  ejemplos ilustrativos, mismo patrón que este bloque generaliza.

**Conclusión:** ninguna incompatibilidad bloqueante con H1-H3, M1-M5 o L1-L2. Con
esto quedan resueltos los once hallazgos del RFC-001.

**Decisión pendiente:** Ninguna — **RESUELTO**.

**Nota de aprobación:** Decisión aprobada por el Consejo de Arquitectura (CEO +
Director Técnico, con revisión del Arquitecto del Ecosistema) el 2026-07-02,
verificada contra el resto del RFC-001 sin incompatibilidades bloqueantes. Con la
resolución de L3 se declara oficialmente **cerrado el RFC-001**. Queda autorizada la
redacción de la Directiva Fundacional v1.2, que deberá superar auditoría técnica,
revisión del Arquitecto del Ecosistema, verificación cruzada y aprobación final del
Consejo de Arquitectura antes de adquirir carácter oficial.

---

## Resumen de estado

| # | Hallazgo | Severidad | Decisión |
|---|----------|-----------|----------|
| H1 | Local First vs. arquitectura real de DIX | ALTA | **Resuelto (2026-07-01)** |
| H2 | Jerarquía Documental vs. legitimidad de Forge | ALTA | **Resuelto (2026-07-01)** |
| H3 | Procedimiento de Enmienda vs. autoridad de Alonso | ALTA | **Resuelto (2026-07-01)** |
| M1 | "Grandes subsistemas" sin umbral | MEDIA | **Resuelto (2026-07-01)** |
| M2 | Principio 3 incumplido por congelación | MEDIA | **Resuelto (2026-07-01)** |
| M3 | Gate de validación comercial sin dueño | MEDIA | **Resuelto (2026-07-01)** |
| M4 | Listas de roles inconsistentes | BAJA-MEDIA | **Resuelto (2026-07-01)** |
| M5 | "Estándar DixSystem" sin definir | MEDIA | **Resuelto (2026-07-01)** |
| L1 | Metodología de 8 pasos sin excepción | BAJA | **Resuelto (2026-07-01)** |
| L2 | Alcance de Reversibilidad sin acotar | BAJA | **Resuelto (2026-07-01)** |
| L3 | Calificadores vagos sin heurístico | BAJA | **Resuelto (2026-07-02)** |

## Cierre del RFC-001

**RFC-001 — CERRADO (2026-07-02).** Los once hallazgos (H1-H3, M1-M5, L1-L3) tienen
decisión aprobada por el Consejo de Arquitectura (CEO + Director Técnico, con
revisión del Arquitecto del Ecosistema en la mayoría de rondas).

Pendientes de redacción registrados para v1.2 (no bloqueantes, no afectan al cierre
del RFC-001):

- H2 — reestructurar el diagrama de Arquitectura Vigente (Nexus deja de figurar ahí).
- M2 — reescribir la frase que llama al shadow log "embrión real" de Experience Core.
- M3 — incorporar el esquema de Evento de Gobernanza (ocho campos) a
  `GOBERNANZA_INGENIERIA.md`.
- M5 — incorporar el procedimiento de evolución del Estándar DixSystem (Nivel 2) a
  `GOBERNANZA_INGENIERIA.md`.
- L3 — especificar el contenedor físico del bloque de Heurísticos Arquitectónicos
  dentro de la Directiva Fundacional.

Queda autorizada la redacción de la **Directiva Fundacional v1.2**, incorporando
todas las decisiones aprobadas en este documento y resolviendo los pendientes de
redacción listados arriba. Antes de adquirir carácter oficial, la v1.2 deberá
superar: auditoría técnica (Director Técnico), revisión del Arquitecto del
Ecosistema, verificación cruzada, y aprobación final del Consejo de Arquitectura.
