# Auditoría gstack — mi-optimizador-ia (DIX core)

Metodología: gstack `/plan-eng-review` (arquitectura) + `/cso` (seguridad OWASP/STRIDE) + `/review` (bugs de producción), aplicada manualmente sobre el código actual (incluye el diff sin commitear: benchmark.rs, cache.rs, claude_gateway.rs, executor.rs, main.rs, memory.rs, policy.rs, scanner.rs, state.rs, startup.rs nuevo, winutil.rs nuevo, App.tsx).

Disclaimer estándar de `/cso`: esta auditoría asistida por IA no sustituye una auditoría de seguridad profesional. Es un primer filtro, no la única línea de defensa.

---

## Finding 1 — CRÍTICO (confianza: 9/10, VERIFIED) — Windows ejecuta scripts elevados sin pasar por `validate_script_windows`

**Archivos:** `src-tauri/src/executor.rs:439-453` (`run_script_windows`) y `src-tauri/src/executor.rs:682-704` (`execute_rollback_windows`), comparado con `src-tauri/src/main.rs:283-292`.

**Código que lo motiva:**

`main.rs:283-292` valida el script en el momento de **generarlo**:
```rust
#[cfg(target_os = "windows")]
let violations = policy::validate_script_windows(&script);
if !violations.is_empty() { return Err(...); }
Ok(GeneratedScript { script, maintenance_script })
```

Pero `executor.rs:439-453`, que es quien realmente **ejecuta** el script como Administrador (`elevate_and_run`), no llama a `policy::validate_script_windows` en ningún punto:
```rust
fn run_script_windows(content: &str, pre_scan: &SystemScan) -> Result<String, String> {
    let clean = strip_fences(content);
    let ts = epoch_secs();
    save_rollback(pre_scan, ts)?;
    let script_path = temp_dir.join(format!("dix_{}.ps1", ts));
    fs::write(&script_path, &clean)...
    let result = elevate_and_run(&script_path, Duration::from_secs(300));
    ...
}
```
Compárese con la versión Linux equivalente, `run_script_linux` (`executor.rs:167-168`), que SÍ valida en el punto de ejecución:
```rust
fn run_script_linux(content: &str, pre_scan: &SystemScan) -> Result<String, String> {
    let violations = policy::validate_script(content);
    if !violations.is_empty() { return Err(...); }
    ...
```
El mismo patrón se repite en rollback: `execute_rollback_linux` (`executor.rs:645`) valida con `policy::validate_script(&content)` antes de ejecutar; `execute_rollback_windows` (`executor.rs:682-704`) no valida nada.

**Por qué importa:** el comando Tauri `execute_script` (`main.rs:304-326`) acepta `script_content: String` por IPC y lo pasa directo a `executor::run_script`. La única razón por la que hoy esto es "seguro" es que el frontend (`App.tsx`) siempre manda el mismo string que `generate_optimization_script` ya validó. Pero la validación y la ejecución son dos pasos desacoplados sin garantía estructural entre ellos (clásico TOCTOU a través de un límite de IPC):
- Cualquier futuro cambio en el frontend (p.ej. permitir editar el script antes de aplicar, una función que hoy no existe pero que es una petición de producto natural) ejecutaría PowerShell elevado sin red de seguridad.
- El propio `execute_rollback_windows` ejecuta contenido leído de disco (`rollbacks_dir()`) sin re-validar — si un proceso con permisos de escritura en `%APPDATA%\dix\rollbacks\` (no requiere admin) modifica un fichero de rollback, ese contenido se ejecuta elevado sin pasar por ningún filtro.
- Rompe la invariante que la propia memoria del proyecto documenta como "garantizada": que todo script que toca el sistema pasa por `policy::validate_script_windows` antes de ejecutarse. Eso es cierto solo en el camino de generación, no en el de ejecución.

**Exploit scenario:** un proceso de baja integridad en la máquina del usuario (malware, otra app, o un futuro bug del propio DIX) escribe directamente al fichero temporal `%TEMP%\dix_<ts>.ps1` en la ventana entre que `run_script_windows` lo escribe y `elevate_and_run` lo ejecuta vía `Start-Process -Verb RunAs`, o más simple: llama al comando Tauri `execute_script` directamente vía IPC con un `script_content` arbitrario (si algún día hay una superficie XSS en el webview, o si se añade una función de edición del script). El resultado se ejecuta con privilegios de Administrador sin que `validate_script_windows` lo vea nunca.

**Recomendación:** añadir `let violations = crate::policy::validate_script_windows(content); if !violations.is_empty() { return Err(...) }` al principio de `run_script_windows` y de `execute_rollback_windows`, exactamente como ya existe en sus equivalentes Linux. Es una corrección de 6-8 líneas, sin riesgo de regresión (los scripts deterministas + IA ya pasan limpios por este validador en `main.rs`, así que añadir la misma comprobación en `executor.rs` es puramente defensa en profundidad).

---

## Finding 2 — MEDIO (confianza: 7/10) — `validate_script_windows` es una lista negra de substrings, trivialmente evadible

**Archivo:** `src-tauri/src/policy.rs:23-76`.

El validador busca substrings literales en minúsculas (`lower.contains("c:\\windows")`, etc.). Cualquier indirección rompe la detección: PowerShell permite construir las mismas rutas/comandos por concatenación de variables (`$p='C:\Wind'+'ows'; Remove-Item $p -Recurse -Force`), por variables de entorno (`$env:SystemRoot`), o por separar el comando en líneas que individualmente no contienen el patrón completo. A diferencia de Linux (`validate_script`, con 50+ tests de regresión cubriendo ofuscación común), Windows no tiene ningún equivalente de `GPU_IMMUTABLE`, `NUMA_BALANCING` ni protección contra `schtasks`/`reg add ...Run` (persistencia), `Invoke-WebRequest | iex` (descarga + ejecución), ni `Set-ExecutionPolicy Unrestricted`.

**Mitigante real:** el origen del script es Claude (no un atacante adversarial activo), así que el riesgo principal no es "la IA decide atacar" sino "inyección de prompt a través de los datos del scan" (ver Finding 3) combinada con un validador que no detecta variantes ofuscadas.

**Recomendación:** no es necesario un sandbox completo, pero sí ampliar la lista negra con los patrones de persistencia/descarga+ejecución más comunes (`schtasks`, `reg add.*\\Run`, `iex`, `Invoke-Expression`, `DownloadString`, `Set-ExecutionPolicy`) y considerar normalizar el script (resolver concatenaciones de strings literales simples) antes de evaluar los patrones, igual que ya se hace bien en Linux.

---

## Finding 3 — MEDIO (confianza: 6/10) — Datos del scan se interpolan sin neutralizar en el prompt a Claude

**Archivo:** `src-tauri/src/main.rs:230-233`.

```rust
let user = format!(
    "Genera el script bash para estas optimizaciones:\n{}\nResumen del sistema:\n{}",
    optimizations_json, scan_json
);
```

`scan_json` incluye campos como `distro_id`, `gpu_model`, `cpu_model` (`scanner.rs`), que en Linux se leen de `/etc/os-release`, `lspci`, `/proc/cpuinfo` — ficheros que, en la inmensa mayoría de máquinas, el usuario no controla, pero que técnicamente son texto del sistema operativo, no una constante. Si alguna de esas cadenas contuviera una inyección de prompt diseñada para hacer que Claude emita una línea de comando distinta a la esperada, esa línea pasaría por `validate_script` (Linux, que sí tiene buena cobertura) o `validate_script_windows` (Windows, cobertura más débil, ver Finding 2). El riesgo real es bajo (vector de ataque poco práctico: requeriría comprometer previamente algo que escribe esos ficheros), pero la separación entre "datos" y "comandos" en el prompt es ad-hoc (concatenación de string), no estructurada.

**Recomendación:** no es bloqueante dado el bajo riesgo práctico, pero documentarlo como límite conocido de la frontera de confianza LLM, y considerar a futuro validar/sanear `scan_json` antes de interpolarlo (p.ej. rechazar valores que contengan saltos de línea inesperados o secuencias `\`\`\``).

---

## Finding 4 — BAJO (confianza: 8/10, informativo) — `App.tsx` y `main.rs` han crecido mucho sin descomponerse

`App.tsx` tiene 2369 líneas (era ~1935 antes del diff actual) y `main.rs` 1436 líneas (antes ~900). Ambos siguen siendo un único componente/módulo monolítico que mezcla estado de UI, lógica de negocio (cálculo de scores, fusión de benchmarks) y comandos Tauri. No es un bug, pero es deuda técnica que ya está en la zona donde el "olfato de complejidad" de ingeniería (más de 8 archivos o lógica difícil de aislar) empieza a doler para testear y revisar diffs.

**Recomendación:** no urgente. Cuando se toque la siguiente feature grande, separar `main.rs` en módulos por dominio (ya existen `scanner`, `executor`, `policy`, etc. — falta hacer lo mismo con los ~15 comandos Tauri que hoy viven todos en `main.rs`) y extraer de `App.tsx` los cálculos puros (`computeScoreFromBenchmarks`, `mergeBenchmarks`, `kernelScoreFromScan`) a un módulo separado con sus propios tests (hoy esa lógica de negocio crítica para la honestidad del "Verificado ✓" vive dentro del componente React y no tiene tests unitarios, a diferencia de la lógica Rust que sí los tiene).

---

## Veredicto general

El proyecto cumple razonablemente bien su propia filosofía "determinista, no humo" en el lado Linux: catálogo determinista + `validate_script` con 78 tests + reglas inviolables verificadas. El lado Windows es donde el diff reciente metió la mayoría de fixes (cuelgues de WMI, timeouts, etc.) y ahí es donde queda la grieta real: **la validación de seguridad se escribió y se conecta en el punto de generación del script, pero no en el punto de ejecución**, rompiendo la simetría que sí existe en Linux. Es un fix concreto y pequeño (Finding 1), no un problema de diseño de fondo — el validador existe, tiene tests, simplemente no se invoca en el lugar correcto en dos funciones.
