# DixKontrol — Threat Model

**Estado:** Diseño previo a implementación. Ningún componente de control activo de
DixKontrol debe construirse hasta que este documento esté aprobado y las
tareas #18/#19 (permisos en tiempo real / privacidad colectiva) estén
resueltas.

## Qué es DixKontrol

Un daemon en segundo plano para power users/gamers que, a diferencia de DIX
(análisis puntual, bajo demanda), vive siempre encendido y puede reaccionar a
cambios de contexto (qué aplicación está en foco) para ajustar parámetros del
sistema.

## Activos a proteger

- Integridad del sistema operativo del usuario (que no deje de arrancar, que
  no pierda datos).
- Credenciales/privilegios de administrador (pkexec/sudo) — no deben quedar
  expuestos a un demonio que corre constantemente.
- Privacidad: qué aplicaciones usa el usuario y cuándo (esto es telemetría
  sensible incluso si nunca sale del dispositivo).
- Confianza del usuario: un daemon que actúa solo, sin que el usuario lo
  vea, es el escenario de mayor riesgo reputacional de todo el catálogo DIX.

## Atacantes / escenarios de riesgo considerados

1. **Proceso local malicioso o comprometido** que intenta usar DixKontrol
   como vector para escalar privilegios (igual que el TOCTOU ya corregido en
   DIX base — ver tarea #9).
2. **Bug propio de DixKontrol** que aplique un cambio incorrecto de forma
   repetida sin que el usuario lo note, por estar "siempre encendido" (a
   diferencia de DIX, que solo actúa cuando el usuario lo pide
   explícitamente).
3. **Fatiga de permisos**: si DixKontrol pidiera confirmación de
   administrador cada vez que detecta un cambio de contexto, el usuario
   acabaría aprobando sin leer — esto es justamente el problema de diseño
   que la tarea #18 debe resolver ANTES de escribir código de control activo.
4. **Telemetría de uso de apps** filtrándose o siendo más identificable de lo
   que parece (ver tarea #19 / hallazgo ya documentado sobre Atlas).

## No-objetivos (lo que DixKontrol NUNCA debe hacer)

- Nunca ejecutar texto/scripts generados libremente — reutiliza el mismo
  `command_engine` (catálogo cerrado y validado) que ya protege a DIX base.
  Ver `apps/desktop-tauri/src-tauri/src/command_engine.rs`.
- Nunca pedir o cachear credenciales de administrador para uso repetido sin
  confirmación — cada elevación de privilegios sigue las reglas de DIX base.
- Nunca enviar fuera del dispositivo qué aplicaciones usa el usuario, ni
  agregado ni en crudo, sin opt-in explícito y revisión de privacidad
  separada (tarea #19).
- Nunca aplicar cambios "silenciosos" sin deshacer disponible — reutiliza el
  mismo journal transaccional (`journal.rs`) que ya existe.

## Modo por defecto: solo lectura

La primera versión de DixKontrol que se construya **no debe tener capacidad
de escritura activada por defecto**. Su primer valor de producto real es
observar y mostrar contexto (qué aplicación está en foco, qué recursos usa),
no actuar. La capacidad de aplicar cambios se activa explícitamente por el
usuario, por niveles de riesgo (Seguro / Moderado / Avanzado), y solo
después de que las tareas #18 y #19 tengan una decisión de diseño tomada.

## Tarea #18 — Decisión: permisos sin fatiga de UAC/pkexec

Tres niveles de riesgo, igual que ya se nombraban en este documento, con
una regla de elevación distinta cada uno:

- **Seguro** (nivel por defecto y único activado al instalar): DixKontrol
  solo observa (`read_foreground_context` y equivalentes). Cero llamadas a
  pkexec/sudo. Cero prompts. El usuario puede usar este nivel indefinidamente
  sin ver una sola ventana de permisos.
- **Moderado** (opt-in explícito, un toggle, no un wizard): los cambios que
  aplica son reversibles y de bajo impacto (los mismos del catálogo
  `command_engine` que ya usa DIX base — gobernador de CPU, prioridades de
  proceso, etc.). La elevación de privilegios se pide **una vez por sesión
  del daemon**, no una vez por cambio: el wrapper ya elevado (mismo patrón
  que DIX base, sin cachear la contraseña) queda vivo mientras el daemon
  corre y aplica los cambios moderados que vayan surgiendo dentro de esa
  sesión. Si el usuario cierra sesión o reinicia el daemon, se vuelve a
  pedir. Esto evita el escenario de fatiga (un prompt por cada cambio de
  foco de ventana) sin cachear credenciales indefinidamente.
- **Avanzado** (opt-in explícito y por separado del Moderado, con
  advertencia explícita de qué implica): cambios de mayor impacto del
  catálogo. Aquí sí se pide confirmación por cambio concreto — no por
  elevación de permisos del sistema operativo, sino una confirmación dentro
  de la propia UI de DixKontrol ("¿aplicar X ahora?"), registrada en el
  journal transaccional como cualquier otra operación de DIX.

Regla dura: subir de nivel (Seguro→Moderado→Avanzado) requiere una acción
explícita del usuario en cada paso — nunca un nivel se activa solo porque
el anterior ya estaba activo, y nunca hay un cuarto nivel "confía siempre".

## Tarea #19 — Decisión: privacidad de la telemetría de apps en uso

Se aplica exactamente la misma disciplina que ya rige DIX Atlas
(`policy.rs::atlas_privacy_rules`), extendida al nuevo dato sensible que
introduce DixKontrol (qué app está en foco):

- El nombre de la app en foco (`ForegroundContext.app_name`) **nunca sale
  del dispositivo**, en ningún nivel de riesgo, por defecto. No hay
  telemetría agregada de DixKontrol en esta fase — no existe el código de
  red para enviarla.
- Si en el futuro se construye una vista agregada (p.ej. "cuánto tiempo en
  Gaming vs Productividad esta semana"), debe ser:
  - 100% local (cálculo y almacenamiento en el propio dispositivo) salvo
    opt-in explícito y separado, igual que Atlas.
  - Si alguna vez se envía algo a un servidor (telemetría colectiva
    opcional), solo categorías de una whitelist cerrada (p.ej.
    `Gaming`/`Navegador`/`Desarrollo`/`Ofimática`), nunca el nombre real de
    la app ni el título de la ventana — validado en Rust antes de cualquier
    llamada de red, mismo patrón que `atlas_payload_is_safe`.
  - Nunca se guarda un historial cronológico identificable (timestamps +
    app) más allá de lo necesario para el cálculo en curso; se descarta tras
    agregarlo.

## Criterio de salida de este documento

Este threat model se considera "aprobado para empezar a programar control
activo" cuando:
- [x] Tarea #18 (diseño de permisos sin fatiga de UAC/pkexec) tiene una
      decisión escrita — ver sección arriba (2026-06-22).
- [x] Tarea #19 (privacidad de telemetría de apps en uso) tiene una decisión
      escrita — ver sección arriba (2026-06-22).
- [x] El esqueleto de solo lectura lleva una prueba real sin incidentes —
      `read_foreground_context` (X11 vía `xprop`) y el nivel **Moderado**
      completo (sesión `pkexec` persistente, aplicar `vm.swappiness`,
      verificar, revertir) se ejecutaron contra el sistema real de Alonso
      el 2026-06-22: 1→10→1, journal y rollback reales, sin incidentes. Ver
      `dixkontrol.rs::tests::moderate_real_roundtrip_swappiness`.

**Nivel Moderado: implementado y probado en backend** (sesión pkexec
persistente + catálogo limitado a operaciones reversibles + rollback
automático — ver `dixkontrol.rs`). Falta todavía: UI de frontend para
activar/aplicar/desactivar Moderado (no existe, solo hay comandos Tauri sin
interfaz), y uso sostenido en una sesión real de uso diario (la prueba hecha
es un roundtrip puntual, no horas de daemon corriendo con cambios de
contexto reales).

El nivel **Avanzado** (confirmación por cambio concreto dentro de la UI)
sigue sin implementar — sigue bloqueado hasta que el Moderado tenga uso real
sostenido y, si aplica, ajustes derivados de ese uso.
