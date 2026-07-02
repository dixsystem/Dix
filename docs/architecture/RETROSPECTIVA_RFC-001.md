# Retrospectiva Arquitectónica del RFC-001

**Estado:** APROBADA por el Consejo de Arquitectura (CEO + Director Técnico) el
2026-07-02.
**Naturaleza:** Documento de aprendizaje del ecosistema. No modifica la Directiva
Fundacional ni ningún otro documento oficial — registra principios, patrones y
decisiones de gobernanza derivados de analizar el proceso completo del RFC-001.
**Alcance analizado:** los 11 hallazgos del RFC-001 (H1, H2, H3, M1, M2, M3, M4,
M5, L1, L2, L3), cerrado el 2026-07-02.

---

## 1. Principios descubiertos

No estaban escritos al empezar el RFC-001 — emergieron del propio proceso de
resolver los 11 hallazgos:

- **Especificidad sobre generalidad.** Cuando existe un test concreto ya aprobado
  para una pregunta (CASO A/B de M1 para "nuevo subsistema", los tres niveles de
  H3 para "quién decide"), ese test prevalece sobre cualquier criterio general
  posterior. Formalizado en la cláusula de precedencia de L3, pero ya operaba
  implícitamente desde M3.
- **El código deja de ser fuente y pasa a ser implementación.** Nombrado
  explícitamente en M5 (Estándar DixSystem), pero es el mismo principio que ya
  operaba en H1 (BYOK como alternativa, `dix-proxy` como implementación) y M3
  (Bitácora como registro, no como definición del gate).
- **Toda ambigüedad transversal se resuelve una vez, no N veces.** L3 nace de
  detectar que "importante", "riesgo elevado" y "confianza suficiente" son la
  misma enfermedad en tres sitios distintos. Se generalizó a un bloque común, el
  mismo movimiento que M4 aplicó a las listas de roles.
- **Una decisión de gobernanza debe autoaplicarse su propio test.** M1 se
  verificó contra sí mismo (persistir el shadow log), M3 se verificó contra sí
  mismo (¿el Evento de Gobernanza activa M1?), M5 se verificó contra sí mismo
  (¿el Motor de Validación activa M1?). El test se ejecutó sobre el caso que lo
  originó, cada vez, no solo se declaró.

## 2. Patrones recurrentes

1. **Ritmo de cuatro tiempos**, casi idéntico en los 11 hallazgos: contrapropuesta
   del Arquitecto del Ecosistema → auditoría del Director Técnico (2-4 puntos
   concretos) → respuesta del Consejo cerrando cada punto → auditoría final
   confirmando.
2. **Creación perezosa aplicada como reflejo, no como excepción.** Desde H2 en
   adelante, cada propuesta nueva (Evento de Gobernanza en M3, Taxonomía en M4,
   Estándar en tres niveles en M5, Heurísticos en L3) se auditó primero por el
   riesgo de generar un documento nuevo, y en los cuatro casos se resolvió
   reutilizando un contenedor ya existente.
3. **Pendientes de redacción registrados, nunca bloqueantes.** H2 (diagrama), M2
   ("embrión real"), M3 (esquema a Gobernanza), M5 (Nivel 2 a Gobernanza), L3
   (contenedor) — cinco veces se cerró la decisión sustantiva y se aparcó el
   ajuste de texto, en vez de detener el cierre del hallazgo.
4. **Dependencias hacia adelante, explícitas y luego verificadas.** H1 y L1
   registraron pendientes hacia L3; ambos se citaron por nombre al cerrar L3 y se
   verificó uno por uno que quedaban satisfechos.
5. **Vigilancia activa de colisión semántica.** Detectada y evitada al menos tres
   veces: doble conteo en el primer borrador de M1 ("dominio funcional" /
   "responsabilidad arquitectónica"); reutilización de "Estratégica/Operativa"
   con otro significado en el razonamiento exploratorio de L2; solapamiento entre
   los criterios de L3 y el CASO B de M1.

## 3. Decisiones especialmente acertadas

- **La partición Infraestructura de Fabricación / Infraestructura de Producto
  (H1).** Resolvió la contradicción fundacional del ecosistema sin negar la
  realidad del negocio ni vaciar el principio de contenido. Vocabulario
  reutilizado directamente por H2.
- **El test CASO A / CASO B de M1.** La decisión con más apalancamiento del RFC —
  se convirtió en el mecanismo de verificación por defecto de M2, M3, M4 y M5.
- **Tratar "alcance del cambio" como propiedad emergente en vez de heurístico
  autónomo (L3).** Evitó una circularidad real: incluir en la lista de
  heurísticos el propio término que la lista debía calibrar.
- **La cláusula de precedencia de L3.** Convierte una lista de ejemplos
  ilustrativos en algo seguro de convivir con tests estrictos en el mismo
  documento, sin que compitan entre sí.

## 4. Mejoras metodológicas observadas durante el proceso

- Evolución de deliberación asíncrona (H1-H3, relay manual completo) a un
  experimento de **Consejo de Arquitectura distribuido** en L2 (Director Técnico
  conectado en vivo a la conversación de ChatGPT vía automatización de
  navegador) — funcionó, validado por el humano después, no durante.
- Ese mismo canal automatizado falló en L3 (bloqueo anti-bot de Cloudflare en
  chatgpt.com). El proceso no forzó ni intentó evadir la protección — volvió al
  relay manual sin perder rigor. La automatización del canal es un medio, no un
  requisito del método.
- El propio RFC-001 se aplicó a sí mismo la disciplina de "verificación cruzada
  contra todo lo anterior" en los 11 hallazgos sin excepción.

## 5. Lecciones aprendidas

- Un calificador vago detectado en un sitio casi nunca está solo — vale la pena
  buscarlo en el resto del documento antes de parchear el primer caso encontrado.
- Cualquier test binario nuevo necesita probarse explícitamente contra el caso
  concreto que lo motivó antes de aprobarse.
- La automatización de un canal de deliberación entre IAs es frágil frente a
  protecciones anti-bot de terceros — no es una garantía permanente.
- Diferir el ajuste de redacción de un principio ya decidido (en vez de bloquear
  el cierre del hallazgo) permitió cerrar 11 hallazgos en dos días sin sacrificar
  rigor.

## 6. Ajustes del Consejo de Arquitectura a esta retrospectiva (2026-07-02)

Con estos cinco ajustes, la retrospectiva queda **APROBADA**:

1. **Principio de Especificidad — no elevado todavía a la Directiva Fundacional.**
   Se incorporará inicialmente a `GOBERNANZA_INGENIERIA.md` (pendiente de
   redacción, junto con el resto de ajustes de esa Sección — ver DEC-004). Solo
   podrá proponerse como principio constitucional cuando haya demostrado su
   utilidad durante varios RFC futuros.
2. **Glosario de términos reservados → Taxonomía Oficial del Ecosistema.**
   Evolucionará para proteger el vocabulario arquitectónico y evitar colisiones
   semánticas entre documentos futuros. Decisión registrada; no se redacta
   todavía.
3. **Metodología del RFC-001 renombrada oficialmente: "Proceso Oficial de
   Deliberación Arquitectónica de DixSystem".** Pasa a ser el procedimiento por
   defecto para futuros RFC de arquitectura y gobernanza (el ritmo de cuatro
   tiempos + verificación cruzada + pendientes no bloqueantes descrito en las
   secciones 2 y 4 de este documento).
4. **Jurisprudencia Arquitectónica — registrada como idea futura, sin
   implementación.** Los RFC importantes podrán generar precedentes reutilizables
   por futuros Consejos de Arquitectura. No se crea documento para ello todavía.
5. **Checklist Único de Redacción para la Directiva Fundacional v1.2** — pendiente
   de preparación y validación del Consejo antes de comenzar la redacción de la
   v1.2 (ver documento/mensaje separado).

---

**Nota de aprobación:** Retrospectiva aprobada por el Consejo de Arquitectura (CEO
+ Director Técnico) el 2026-07-02, como documento de aprendizaje del ecosistema.
No modifica la Directiva Fundacional (sigue en v1.1) ni `GOBERNANZA_INGENIERIA.md`
(sigue en borrador). El siguiente paso es preparar y validar el Checklist Único de
Redacción antes de iniciar la redacción de la Directiva Fundacional v1.2.
