# 🏛️ DIXSYSTEM — GOBERNANZA DE INGENIERÍA
## Versión 1.1
### Estado: VIGENTE — aprobada por Resolución Ejecutiva RES-002 (2026-07-02). Segundo pilar oficial de la gobernanza de DixSystem, complementario a la Directiva Fundacional v1.2.

---

## 1. Propósito

**Qué es:** el conjunto de reglas y procesos mediante los cuales DixSystem toma,
audita, aprueba y registra sus decisiones de ingeniería.

**Por qué existe:** porque las decisiones arquitectónicas importantes no deben
depender de la memoria de una persona, de la improvisación, ni de la autoridad de
quien las propone — deben poder explicarse, auditarse y revisarse dentro de diez años
igual que hoy.

**Qué problemas resuelve:** decisiones no trazables, contradicciones entre
documentos que nadie detecta a tiempo, pérdida de contexto entre sesiones de trabajo,
y aprobación de cambios por autoridad en vez de por evidencia.

---

## 2. Principios

- **Evidencia antes que opinión.** Ninguna decisión importante se basa solo en
  intuición.
- **Calidad antes que velocidad.** Terminar rápido no es el objetivo; terminar
  correctamente sí.
- **Decisiones trazables.** Toda decisión debe poder rastrearse hasta su origen,
  su discusión y su aprobación.
- **Conocimiento acumulativo.** Lo aprendido no se pierde entre sesiones ni entre
  personas.
- **Mejora continua.** La gobernanza misma se audita y se corrige con el tiempo.
- **Especificidad sobre generalidad** (Principio de Especificidad — DEC-004,
  2026-07-02). Cuando existe un procedimiento o test específico ya aprobado para
  una pregunta concreta, ese procedimiento prevalece sobre cualquier criterio
  general aplicable al mismo caso. No es todavía un principio constitucional —
  vive aquí hasta demostrar su utilidad durante varios RFC futuros, momento en el
  que podrá proponerse su elevación a la Directiva Fundacional.

Los principios constitucionales del ecosistema (incluida la complejidad como algo
que debe ganarse, y la arquitectura como paso previo a la implementación) están
definidos exclusivamente en la Directiva Fundacional — ver CONSTITUCIÓN DE
DIXSYSTEM. Esta sección no los redefine ni los resume: describe únicamente los
principios propios del proceso de gobernanza, sin equivalente en la Directiva.

---

## 3. Consejo de Arquitectura

- **CEO:** decisión final. Fija prioridad de negocio. Aprueba o rechaza
  cualquier propuesta antes de que se considere oficial.
- **Director Técnico:** audita críticamente cada propuesta y protege
  la coherencia arquitectónica del ecosistema. Su función es encontrar problemas, no
  evitarlos — no aprueba por autoridad propia.
- **Arquitecto del Ecosistema:** propone visión, alternativas y
  contrapropuestas, y vela por la coherencia estratégica de largo plazo.

La composición del Consejo de Arquitectura es materia constitucional — ver
RESPONSABILIDADES en la Directiva Fundacional. Esta Gobernanza no la define ni
anticipa su evolución; describe únicamente cómo opera el Consejo una vez
establecido.

---

## 4. Proceso oficial de decisión

```
Idea
  ↓
RFC
  ↓
Auditoría del Director Técnico
  ↓
Revisión del Arquitecto del Ecosistema
  ↓
Verificación cruzada previa
  ↓
Deliberación
  ↓
Consenso
  ↓
Aprobación del CEO
  ↓
Actualización del ADR
  ↓
Implementación
  ↓
Verificación cruzada posterior
```

La verificación cruzada cumple dos funciones distintas en este proceso: la
**previa** valida que la propuesta no contradiga el resto del ecosistema antes de
que el Consejo delibere; la **posterior** confirma, tras aplicar la decisión, que
el problema queda resuelto sin incompatibilidades nuevas. Este es el procedimiento
realmente aplicado durante el cierre completo del RFC-001, la aprobación de la
Directiva Fundacional v1.2 (RES-001) y la presente auditoría de esta Gobernanza —
no una aspiración. Ningún paso se salta: una idea no se implementa sin pasar antes
por auditoría, verificación previa, deliberación y aprobación explícita del CEO;
ninguna decisión se da por cerrada sin la verificación posterior a su aplicación.

---

## 5. Documentos oficiales

| Documento | Finalidad |
|---|---|
| **Visión** | Define el propósito de DixSystem. Vive como preámbulo de la Directiva Fundacional — no es un archivo aparte. |
| **Directiva Fundacional** | Principios de ingeniería y arquitectura. Cambia poco y solo tras un RFC completo. |
| **ORDEN_TRABAJO** | Prioridades de negocio y roadmap de DIX (el producto). |
| **Roadmaps** | Uno por sistema estratégico (Forge, Atlas, etc.), creados solo cuando ese sistema tiene actividad independiente real que lo justifique — nunca por adelantado. |
| **RFC** | Contenedor de una o varias preguntas arquitectónicas abiertas que necesitan deliberación. |
| **ADR** | Registro individual de una decisión dentro de un RFC: problema, impacto, opciones, decisión. |
| **Retrospectiva** | Documento de aprendizaje del ecosistema — analiza el proceso seguido en un RFC ya cerrado (principios descubiertos, patrones, lecciones), sin modificar ningún documento oficial por sí misma. Se produce cuando el RFC lo justifica, no en cada cierre. |
| **Resolución** | Acto ejecutivo del CEO que formaliza la entrada en vigor de una Decisión Constitucional de máximo alcance (p. ej. la aprobación de una versión de la Directiva Fundacional). Identificador propio (RES-XXX), registrado en `DECISIONES.md` y `BITACORA_DIXSYSTEM.md`. |
| **Bitácora** | Historia cronológica del proyecto — "¿qué ocurrió?". Las lecciones aprendidas son un campo de cada entrada, no un documento aparte. |
| **Decisiones** | Registro de decisiones actualmente vigentes — "¿qué sigue siendo válido?". |
| **Memory** | Memoria persistente del asistente entre sesiones. No es un documento del repositorio; es infraestructura de continuidad, no de gobernanza formal — "no formal" indica que queda fuera del sistema oficial de gobernanza documental, no que sea poco crítica: sostuvo la continuidad real del cierre del RFC-001, la Directiva Fundacional v1.2 y esta misma auditoría a lo largo de varias sesiones. Las decisiones oficiales, aprobadas o no, siempre residen en los documentos del repositorio — nunca dependen de Memory como fuente de verdad. |

**Relación entre ellos:** Visión y Directiva se piensan pocas veces y cambian poco.
ORDEN_TRABAJO y los Roadmaps cambian con el ritmo del negocio. RFC y ADR son el
mecanismo para producir una decisión nueva. Bitácora y Decisiones son el registro de
lo ya decidido. Ninguno sustituye a otro.

Cuando la Directiva Fundacional usa la notación abreviada "RFC/ADR" (ver
PROCEDIMIENTO DE ENMIENDA), es una simplificación documental de alto nivel propia
de un documento constitucional — no implica que RFC y ADR sean el mismo artefacto.
Esta Gobernanza describe el procedimiento operativo completo y mantiene la
distinción: un RFC agrupa uno o varios ADR (p. ej. RFC-001 agrupó los ADR de H1 a
L3; esta misma auditoría de Gobernanza es un único RFC con los ADR de los
Hallazgos 1 a 15).

### Evento de Gobernanza

Mecanismo de certificación para eventos que modifiquen el estado estratégico del
ecosistema (p. ej. la validación comercial de DIX Windows — ver CONGELACIÓN DE
EXPANSIÓN de la Directiva Fundacional). No es un documento independiente: es una
entrada estructurada dentro de `BITACORA_DIXSYSTEM.md`, con, como mínimo, estos
ocho campos: identificador único, tipo de evento, fecha, evidencia objetiva,
verificador, decisión del Consejo, consecuencias sobre la gobernanza, documentos
afectados.

El verificador por defecto es el Director Técnico (verifica existencia y
autenticidad de la evidencia objetiva); el Consejo delibera sobre esa evidencia;
la aprobación final corresponde al CEO. No crea ningún rol ni asiento nuevo.
Registrar Eventos de Gobernanza en la Bitácora es una mejora del sistema de
memoria ya existente — no constituye un nuevo subsistema (ver CONGELACIÓN DE
EXPANSIÓN).

---

## 6. Reglas de gobernanza

- **Un RFC nace** cuando una auditoría, una duda arquitectónica o una contradicción
  detectada requiere deliberación. Si un cambio concreto amerita ese trámite se
  interpreta con los Heurísticos Arquitectónicos de la Directiva Fundacional (ver
  HEURÍSTICOS ARQUITECTÓNICOS) — única fuente de interpretación; esta Gobernanza no
  define un criterio paralelo. Si la experiencia futura demuestra la necesidad de
  un matiz adicional, se incorpora a los propios Heurísticos, no a un mecanismo
  aparte.
- **Un ADR se crea** dentro de un RFC, uno por pregunta o hallazgo, con el formato:
  problema, impacto, opciones, ventajas/inconvenientes, recomendación, decisión.
- **Un ADR cierra en uno de cuatro estados**: Propuesto (en deliberación),
  Aprobado, Rechazado o Diferido. El rechazo no es un procedimiento distinto — es
  un estado del mismo ciclo de vida, y se registra con el mismo rigor que una
  aprobación: motivo del rechazo, quién auditó, quién decidió, y la entrada
  correspondiente en la Bitácora (precedente: la Directiva Fundacional v1.0,
  rechazada tras auditoría técnica del Director Técnico y registrada en su propio
  Historial de versiones).
- **Una Directiva se modifica** solo cuando su RFC correspondiente cierra por
  completo (todos los hallazgos altos y medios resueltos) — nunca hallazgo a
  hallazgo.
- **Una decisión se aprueba** siguiendo el procedimiento oficial definido en la
  Sección 7 (Niveles de decisión — aplicación operativa), según el nivel que le
  corresponda. Esta regla no repite ese procedimiento — remite a él.
- **Los cambios se registran** según el nivel de decisión y el destino que fija la
  Sección 7 (Niveles de decisión — aplicación operativa). Esta regla no repite ese
  mapeo — remite a él.
- **Las lecciones aprendidas se documentan** como campo de la entrada
  correspondiente de la Bitácora — no se crea un documento nuevo para esto.
- **El Estándar DixSystem evoluciona** siguiendo el proceso oficial de decisión ya
  establecido en esta Gobernanza (RFC/ADR, auditoría del Director Técnico,
  deliberación del Consejo, aprobación del CEO). Cada cambio de criterio queda
  registrado como entrada vigente en `DECISIONES.md` — sin crear ningún documento
  nuevo (ver Principio 4, Nivel 2, de la Directiva Fundacional).

---

## 7. Niveles de decisión — aplicación operativa

Los tres niveles de decisión — **Constitucional**, **Estratégica** y
**Operativa** — están definidos exclusivamente en la Directiva Fundacional (ver
sección NIVELES DE DECISIÓN). Esta sección no los redefine: describe cómo se
ejecutan, verifican y documentan en la práctica.

**Decisión Constitucional** (afecta a principios, arquitectura del ecosistema o
a esta misma Gobernanza):
- Se tramita como RFC/ADR completo: problema, impacto, opciones,
  ventajas/inconvenientes, recomendación técnica, decisión.
- Pasa por: auditoría del Director Técnico → revisión del Arquitecto del
  Ecosistema → verificación cruzada → deliberación del Consejo de Arquitectura →
  aprobación del CEO.
- Se registra en el ADR correspondiente, en `DECISIONES.md` y en la entrada del
  día de `BITACORA_DIXSYSTEM.md`.
- Solo una Decisión Constitucional puede modificar la Directiva Fundacional o
  esta Gobernanza.

**Decisión Estratégica** (prioridades, alcance, Roadmaps, planificación,
objetivos de negocio):
- Responsabilidad del CEO. No requiere el ciclo completo de RFC/ADR ni
  aprobación del Consejo.
- Debe ser coherente con las decisiones constitucionales vigentes — si entra en
  conflicto con una de ellas, requiere primero una enmienda constitucional antes
  de ejecutarse.
- Se registra en `DECISIONES.md` o `BITACORA_DIXSYSTEM.md`, según su alcance.

**Decisión Operativa** (implementación técnica):
- Responsabilidad del Director Técnico. No requiere deliberación del Consejo ni
  aprobación del CEO.
- Debe respetar las decisiones constitucionales y estratégicas vigentes.
- Se registra en la entrada del día de `BITACORA_DIXSYSTEM.md` cuando su
  resultado sea relevante para la trazabilidad del ecosistema.

**Casos ambiguos:** si no es evidente a qué nivel pertenece una decisión, el
Director Técnico la clasifica en primera instancia; ante duda razonable entre
dos niveles, se trata como el nivel superior de los dos hasta que la práctica
demuestre lo contrario.

---

## 8. Calidad de las decisiones

Toda decisión importante deberá:

- **Ser argumentada** — con problema e impacto explícitos, no solo una conclusión.
- **Ser auditable** — alguien ajeno debe poder revisar el razonamiento después.
- **Ser reversible cuando sea posible** — y declararse explícitamente cuando no lo
  sea.
- **Tener trazabilidad** — quién la propuso, quién la auditó, quién la aprobó.
- **Tener justificación técnica** — no basta con "porque sí" ni con autoridad.
- **Quedar registrada** — en el ADR correspondiente y en la Bitácora.

---

## 9. Evolución

La Gobernanza forma parte del ecosistema y puede mejorar con evidencia — auditorías,
resultados reales, lecciones aprendidas — igual que el software y que la Directiva
Fundacional. No debe modificarse por intuición sin registro, y no debe convertirse en
un documento rígido: si un proceso deja de servir, se audita y se corrige.

El nivel de rigor exigible a cada modificación de esta Gobernanza se determina con
el mismo modelo de tres niveles definido en la Directiva Fundacional (ver Sección 7
de este documento y NIVELES DE DECISIÓN de la Directiva) — no existe un sistema de
enmienda propio y distinto. Un cambio en la composición o autoridad de un órgano
constitucional (p. ej. el Consejo de Arquitectura) es Constitucional y exige el
ciclo completo; un ajuste operativo de esta Gobernanza que no toque principios ni
autoridad puede ser Operativo. La clasificación inicial nunca es definitiva por sí
sola — queda sujeta al mismo ciclo de auditoría, revisión y verificación cruzada
que gobierna cualquier otra decisión del ecosistema.

---

## 10. Relación con la Directiva Fundacional

La **Directiva** define los principios: qué arquitectura es válida, qué se cree,
qué se prioriza.

La **Gobernanza** (este documento) define el proceso: quién decide, cómo se delibera,
cómo se registra.

Son complementarios y no deben duplicarse. Si un principio arquitectónico aparece en
este documento, es un error de redacción — debe vivir solo en la Directiva. Si un
detalle de proceso aparece en la Directiva, debería vivir aquí.

---

## Historial de versiones

- **v1.0** — Propuesta inicial, redactada a partir de la práctica ya usada en la
  resolución de H1 y H2 del RFC-001. Pendiente de auditoría del Director Técnico,
  revisión del Consejo de Arquitectura y aprobación final del CEO. Las Secciones 7 y
  9 quedan explícitamente marcadas como provisionales hasta que H3 cierre.
- **v1.1** — Auditoría integral tras la aprobación de la Directiva Fundacional v1.2
  (RES-001). Quince hallazgos (2 Críticos, 5 Altos, 5 Medios, 3 Bajos/Observación),
  cada uno resuelto con el ciclo completo (ADR, auditoría del Director Técnico,
  revisión del Arquitecto del Ecosistema, deliberación del Consejo, aplicación,
  verificación cruzada específica, cierre). Incorpora: eliminación de nombres de
  persona/producto en el Consejo de Arquitectura (Sección 3, alineado con T1/T4 de
  la Directiva); eliminación de principios duplicados de la Constitución (Sección
  2) e incorporación del Principio de Especificidad (DEC-004); representación de
  las dos verificaciones cruzadas reales, previa y posterior (Sección 4);
  reescritura de los Niveles de Decisión según el modelo de tres niveles de H3
  (Sección 7); Evento de Gobernanza (M3) y procedimiento de evolución del Estándar
  DixSystem (M5) incorporados; retirada de la marca "provisional" obsoleta y
  vínculo del rigor de enmienda al mismo modelo de tres niveles (Sección 9);
  inventario documental completo con Retrospectiva y Resolución (Sección 5);
  eliminación de duplicidad en el registro de decisiones y en el criterio de
  activación de un RFC, ambos remitidos a fuente única (Sección 6, Sección 7,
  Heurísticos Arquitectónicos); estado de rechazo incorporado al ciclo de vida del
  ADR; retirada de Nexus como ejemplo indebido y aclaración de la notación
  "RFC/ADR" y de la criticidad real de Memory (Sección 5). Ver
  `docs/architecture/RES-002_RESOLUCION_GOBERNANZA.md`. **Aprobada por el CEO
  mediante Resolución Ejecutiva RES-002 (2026-07-02) — segundo pilar oficial de la
  gobernanza de DixSystem. Estado: VIGENTE.**
