# ORDEN DE TRABAJO MAESTRA — DixSystem / PCOptimizer Pro (DIX)
## Especificación de implementación para Claude Code
**Versión 1.0 — Junio 2026 · Confidencial · Uso interno**

---

## 0. CÓMO USAR ESTE DOCUMENTO

Este documento es la **fuente única de verdad** para la implementación. Claude Code debe ejecutarlo en el orden indicado (Fase 0 → 1 → 2 → 3). Cada tarea tiene:

- **Archivos afectados**
- **Qué hacer** (con código exacto cuando ya existe, o especificación cuando hay que diseñarlo)
- **Criterio de aceptación** (cómo se sabe que está bien)
- **Verificación** (comando o test concreto)

**Regla de oro:** ninguna tarea se da por terminada sin pasar su criterio de aceptación. No se avanza a la siguiente fase sin completar la anterior.

### Reglas inviolables (aplican a TODO el documento)

1. `numa_balancing` nunca a `0`.
2. `vm.dirty_ratio` nunca por encima de `15`.
3. `transparent_hugepage` nunca `never`.
4. Nunca tocar GPU / nvidia en scripts generados.
5. Rutas absolutas siempre: `/usr/bin/pkexec`, `/sbin/sysctl`, `/bin/bash`, `/bin/echo`.
6. La API key de Anthropic vive **exclusivamente** en el proxy/servidor. Jamás en cliente, jamás con prefijo `VITE_`.
7. Stack fijo: Tauri v2 / Rust / React 19 / TypeScript. No migraciones ni dependencias nuevas fuera de las listadas aquí.
8. Edits quirúrgicos. No reescribir archivos enteros. No código especulativo.

### Estado de partida

- App funcional en Linux (Ubuntu 26.04). Loop scan → IA → script → aplicar operativo.
- Identidad visual lista (DIX, paleta).
- **Pendiente y bloqueante:** todo lo de Fase 0 y Fase 1.

### Identidad visual obligatoria

| Color | Hex | Uso |
|---|---|---|
| Naranja primario | `#FF6B00` | Botones, accents, DIX, títulos |
| Negro profundo | `#0d1117` | Fondo principal |
| Verde éxito | `#00FF88` | Scores, checkmarks |
| Gris oscuro | `#161b22` | Cards, paneles |
| Blanco | `#FFFFFF` | Texto sobre fondo oscuro |

---

# FASE 0 — BLINDAJE DE SEGURIDAD (BLOQUEANTE)

> Sin esto NO se vende el binario. Cierra las dos grietas mortales: API key expuesta y ejecución root sin validar.

## TAREA 0.1 — Eliminar la API key del cliente

**Archivos:** `.env`, `src/App.tsx`

**Qué hacer:**
- Eliminar `VITE_ANTHROPIC_KEY` de `.env` por completo.
- Eliminar de `App.tsx` la línea `const API_KEY = import.meta.env.VITE_ANTHROPIC_KEY ?? "";`
- La clave de Anthropic deja de existir en el cliente. Toda llamada pasa por el proxy (Tarea 0.5).

**Criterio de aceptación:** `grep -ri "VITE_ANTHROPIC\|ANTHROPIC_KEY\|sk-ant" src/ .env` no devuelve nada.

**Verificación:** tras `npm run tauri build`, ejecutar `strings src-tauri/target/release/pcoptimizer | grep -i "sk-ant"` → cero resultados.

---

## TAREA 0.2 — Dependencia `dirs` en Rust

**Archivo:** `src-tauri/Cargo.toml`

**Qué hacer:** añadir en `[dependencies]`:

```toml
dirs = "5"
```

**Criterio de aceptación:** `cargo check` compila sin error de dependencia faltante.

---

## TAREA 0.3 — Backend: proxy remoto + licencias + fingerprint

**Archivo:** `src-tauri/src/main.rs`

**Qué hacer:** eliminar `call_claude_native` por completo y añadir en su lugar:

```rust
// © 2026 DixSystem — Todos los derechos reservados.
use std::os::unix::fs::PermissionsExt;
use std::time::{SystemTime, UNIX_EPOCH};

const PROXY_URL: &str = "https://api.dixsystem.com/v1/analyze";

fn get_hw_fingerprint() -> String {
    let cpu = fs::read_to_string("/proc/cpuinfo").unwrap_or_default();
    let cpu_id = cpu.lines().find(|l| l.contains("model name")).unwrap_or("").to_string();
    let machine_id = fs::read_to_string("/etc/machine-id").unwrap_or_default().trim().to_string();
    format!("{}-{}", cpu_id, machine_id)
}

#[tauri::command]
async fn analyze_remote(license_key: String, scan: SystemScan, stage: String, extra: String) -> Result<ClaudeResult, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post(PROXY_URL)
        .json(&serde_json::json!({
            "license_key": license_key,
            "hw_id": get_hw_fingerprint(),
            "scan": scan,
            "stage": stage,
            "extra": extra
        }))
        .send().await.map_err(|e| format!("Error de red: {}", e))?;
    let status = resp.status();
    let body = resp.text().await.map_err(|e| format!("Error leyendo respuesta: {}", e))?;
    if !status.is_success() {
        return Err(format!("[Proxy {}] {}", status, &body[..body.len().min(200)]));
    }
    Ok(ClaudeResult { text: strip_markdown_fences(&body) })
}

#[tauri::command]
fn save_license(key: String) -> Result<(), String> {
    let dir = dirs::config_dir().ok_or("sin config dir")?.join("pcoptimizer");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::set_permissions(&dir, fs::Permissions::from_mode(0o700)).map_err(|e| e.to_string())?;
    let path = dir.join("license");
    fs::write(&path, key.trim()).map_err(|e| e.to_string())?;
    fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_license() -> Result<String, String> {
    let path = dirs::config_dir().ok_or("sin config dir")?.join("pcoptimizer/license");
    fs::read_to_string(path).map(|s| s.trim().to_string()).map_err(|_| "sin licencia".to_string())
}
```

**Criterio de aceptación:** `cargo check` compila. No queda ninguna referencia a `call_claude_native` ni a system prompts en `main.rs` (los prompts viven en el proxy).

**Verificación:** `grep -n "call_claude_native\|Eres un experto" src-tauri/src/main.rs` → cero resultados.

---

## TAREA 0.4 — Backend: validador estático + ejecución segura

**Archivo:** `src-tauri/src/main.rs`

**Qué hacer (A):** añadir el validador antes de `execute_optimization_script`:

```rust
const SYSCTL_WHITELIST: &[&str] = &[
    "vm.swappiness", "vm.vfs_cache_pressure", "vm.dirty_ratio",
    "vm.dirty_background_ratio", "vm.dirty_expire_centisecs",
    "net.ipv4.tcp_congestion_control", "net.core.rmem_max", "net.core.wmem_max",
    "net.core.netdev_max_backlog", "net.ipv4.tcp_fastopen",
    "kernel.sched_autogroup_enabled", "fs.file-max", "kernel.numa_balancing",
];

const SYS_WRITE_WHITELIST: &[&str] = &[
    "/sys/block/", "/sys/kernel/mm/transparent_hugepage/",
    "/sys/devices/system/cpu/",
];

const FORBIDDEN: &[&str] = &[
    "rm ", "dd ", "mkfs", "curl", "wget", "nc ", "ncat", "chmod", "chown",
    "useradd", "usermod", "passwd ", "ssh", "scp", "base64", "eval ",
    "$(", "`", "<<", "nvidia", "crontab", "/etc/", "systemctl",
];

fn validate_script(script: &str) -> Result<(), String> {
    for (n, raw) in script.lines().enumerate() {
        let line = raw.trim();
        let lower = line.to_lowercase();
        for f in FORBIDDEN {
            if lower.contains(f) {
                return Err(format!("Bloqueado línea {}: patrón '{}'", n + 1, f.trim()));
            }
        }
        if line.is_empty() || line.starts_with('#') { continue; }

        let allowed_start = line.starts_with("echo ")
            || line.starts_with("/bin/echo ")
            || line.starts_with("/sbin/sysctl -w ")
            || line.starts_with("/usr/sbin/fstrim")
            || line.starts_with("sleep ");
        if !allowed_start {
            return Err(format!("Bloqueado línea {}: comando no permitido: {}", n + 1, line));
        }

        if line.starts_with("/sbin/sysctl -w ") {
            let kv = line.trim_start_matches("/sbin/sysctl -w ")
                .trim_end_matches("|| true").trim();
            let mut p = kv.splitn(2, '=');
            let key = p.next().unwrap_or("").trim();
            let val = p.next().unwrap_or("").trim().trim_matches('"');
            if !SYSCTL_WHITELIST.contains(&key) {
                return Err(format!("sysctl no permitido: {}", key));
            }
            if key == "kernel.numa_balancing" && val == "0" {
                return Err("numa_balancing=0 prohibido".into());
            }
            if key == "vm.dirty_ratio" && val.parse::<u32>().unwrap_or(99) > 15 {
                return Err("dirty_ratio > 15 prohibido".into());
            }
        }

        if line.contains('>') {
            let target = line.split('>').nth(1).unwrap_or("")
                .trim().trim_end_matches("|| true").trim();
            if !SYS_WRITE_WHITELIST.iter().any(|p| target.starts_with(p)) {
                return Err(format!("Redirección no permitida: {}", target));
            }
            if target.starts_with("/sys/kernel/mm/transparent_hugepage/") && lower.contains("never") {
                return Err("hugepages=never prohibido".into());
            }
        }
    }
    Ok(())
}
```

**Qué hacer (B):** reemplazar `execute_optimization_script` completo:

```rust
#[tauri::command]
fn execute_optimization_script(script_content: String) -> Result<String, String> {
    let clean = script_content.trim()
        .trim_start_matches("```bash")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim().to_string();

    validate_script(&clean)?;

    let dir = dirs::config_dir().ok_or("sin config dir")?.join("pcoptimizer/run");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::set_permissions(&dir, fs::Permissions::from_mode(0o700)).map_err(|e| e.to_string())?;

    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
    let script_path = dir.join(format!("boost_{}.sh", nanos));

    fs::write(&script_path, &clean).map_err(|e| format!("No se pudo escribir: {}", e))?;
    fs::set_permissions(&script_path, fs::Permissions::from_mode(0o500)).map_err(|e| e.to_string())?;

    let output = Command::new("/usr/bin/pkexec")
        .args(["/bin/bash", script_path.to_str().ok_or("ruta inválida")?])
        .output().map_err(|e| format!("pkexec no disponible: {}", e))?;

    let _ = fs::remove_file(&script_path);

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(format!("Script falló: {}", String::from_utf8_lossy(&output.stderr)))
    }
}
```

**Criterio de aceptación:**
- Ya no se escribe en `/tmp` (ruta predecible). Se usa directorio privado del usuario `0700`, script `0500`, y se borra tras ejecutar.
- Todo script pasa por `validate_script` antes de tocar `pkexec`.

**Verificación:** test unitario que pase un script con `rm -rf /` y otro con `sysctl -w kernel.numa_balancing=0` → ambos deben devolver `Err`. Un script legítimo de solo `sysctl -w vm.swappiness=10` y `echo` → `Ok`.

---

## TAREA 0.5 — Proxy: Cloudflare Worker (el cerebro en el servidor)

**Archivo nuevo:** `dix-proxy/src/index.js`

**Qué hacer:** crear el worker. Aquí viven la API key, los system prompts y el control de coste/licencia.

```js
// © 2026 DixSystem — api.dixsystem.com/v1/analyze
const SYSTEM_ANALYSIS = `Eres un experto en optimización Linux. Respondes SOLO con JSON válido sin markdown.`;
const SYSTEM_SCRIPT = `Experto en bash/Linux. REGLAS ESTRICTAS: 1) SOLO bash puro. 2) Sin markdown. 3) Empieza con #!/bin/bash. 4) Sin funciones personalizadas. 5) echo directo para mensajes. 6) Un comando por línea. 7) || true en comandos que pueden fallar. 8) Sin heredocs. 9) Rutas absolutas /sbin/sysctl y /bin/echo. 10) NUNCA numa_balancing=0, NUNCA dirty_ratio>15, NUNCA hugepages never, NUNCA tocar GPU/nvidia. Máximo 50 líneas.`;

const buildAnalysisPrompt = (s) => `Analiza estos datos reales y genera plan de optimización.
DATOS: GOV=${s.cpu_governor} GPU_PWR=${s.gpu_power_state} SWAP=${s.swappiness} SCHED=${s.disk_scheduler} AUDIO=${s.audio_server} HP=${s.hugepages} NUMA=${s.numa_balancing}
HARDWARE: ${s.cpu_model}, ${s.gpu_model}, ${s.ram_gb}, NVMe, Ubuntu.
Responde ÚNICAMENTE JSON válido: {"analisis":"2 frases","score_actual":N,"score_optimizado":N,"optimizaciones":[{"id":"opt1","categoria":"GPU|CPU|RAM|Storage|Red|Sistema","titulo":"","descripcion":"","impacto":0,"riesgo":"bajo|medio|alto","mejora_estimada":"","aplicar":true,"comando_preview":"","tiempo_estimado":""}]}
8-10 optimizaciones reales. Si governor ya es performance no lo cambies. NUNCA numa_balancing=0, dirty_ratio>15, hugepages never, ni tocar GPU.`;

export default {
  async fetch(req, env) {
    if (req.method !== "POST") return new Response("405", { status: 405 });
    let body;
    try { body = await req.json(); } catch { return new Response("400", { status: 400 }); }
    const { license_key, hw_id, scan, stage, extra } = body;
    if (!license_key || !scan || !hw_id) return new Response("400", { status: 400 });

    // 1. Validar licencia (con caché — ver Tarea 1.3)
    const valid = await validateLicense(license_key, hw_id, env);
    if (!valid) return new Response("Licencia inválida", { status: 403 });

    // 2. Rate limit: 20 llamadas/día por licencia
    const day = new Date().toISOString().slice(0, 10);
    const rlKey = `rl:${license_key}:${day}`;
    const used = parseInt((await env.KV.get(rlKey)) || "0");
    if (used >= 20) return new Response("Límite diario alcanzado", { status: 429 });
    await env.KV.put(rlKey, String(used + 1), { expirationTtl: 90000 });

    // 3. Llamada a Claude — la key SOLO existe aquí
    const isScript = stage === "script";
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: isScript ? 1200 : 2000,
        system: isScript ? SYSTEM_SCRIPT : SYSTEM_ANALYSIS,
        messages: [{
          role: "user",
          content: isScript
            ? `Genera el script para ${scan.cpu_model}/${scan.gpu_model}/${scan.ram_gb} incluyendo: ${String(extra).slice(0, 500)}. Con mensajes de progreso.`
            : buildAnalysisPrompt(scan),
        }],
      }),
    });
    const data = await r.json();
    if (data.error) return new Response(data.error.message, { status: 502 });
    let text = data.content?.find((b) => b.type === "text")?.text || "";

    // 4. Validación de salida (ver Tarea 1.2) — solo en stage analysis
    if (!isScript) {
      text = await ensureValidJson(text, scan, env);
      if (!text) return new Response("IA devolvió JSON inválido", { status: 502 });
    }
    return new Response(text, { status: 200, headers: { "content-type": "text/plain" } });
  },
};
```

> Las funciones `validateLicense` y `ensureValidJson` se completan en Fase 1 (Tareas 1.2 y 1.3). En Fase 0 basta con un `validateLicense` que llame directamente a Lemon Squeezy y un `ensureValidJson` que solo intente `JSON.parse`.

**Deploy:**

```bash
npm create cloudflare@latest dix-proxy -- --type hello-world
# pegar index.js
npx wrangler kv namespace create KV          # copiar id a wrangler.toml: [[kv_namespaces]] binding="KV" id="..."
npx wrangler secret put ANTHROPIC_KEY
npx wrangler deploy
# Cloudflare dashboard: route api.dixsystem.com/v1/analyze → worker
```

**Criterio de aceptación:** `curl -X POST https://api.dixsystem.com/v1/analyze -d '{}'` devuelve `400`. Con licencia válida y scan real, devuelve JSON parseable.

---

## TAREA 0.6 — Frontend: migrar a proxy + UI de licencia

**Archivo:** `src/App.tsx`

**Qué hacer:**

```tsx
// ELIMINAR: const API_KEY = import.meta.env.VITE_ANTHROPIC_KEY ?? "";

// AÑADIR import useEffect y estado:
const [licenseKey, setLicenseKey] = useState("");
useEffect(() => {
  invoke<string>("load_license").then(setLicenseKey).catch(() => {});
}, []);

// EN handleStart — reemplazar las 2 llamadas call_claude_native:
const analysisRaw = await invoke<ClaudeResult>("analyze_remote", {
  licenseKey, scan: scanResult, stage: "analysis", extra: "",
});
const parsedAnalysis = safeParseJSON<AnalysisResult>(analysisRaw.text);
setAnalysis(parsedAnalysis);
const scriptRaw = await invoke<ClaudeResult>("analyze_remote", {
  licenseKey, scan: scanResult, stage: "script",
  extra: parsedAnalysis.optimizaciones.filter(o => o.aplicar).map(o => o.titulo).join(", "),
});
setScript(scriptRaw.text);

// AÑADIR en phase === "idle", encima del botón:
{!licenseKey && (
  <input
    placeholder="Clave de licencia"
    onBlur={e => { setLicenseKey(e.target.value); invoke("save_license", { key: e.target.value }); }}
    style={{ marginBottom: 16, padding: "8px 12px", borderRadius: 8, border: "1px solid #30363d", width: "100%", fontSize: 14, background: "#161b22", color: "#fff" }}
  />
)}
```

**Criterio de aceptación:** la app arranca, pide licencia si no hay, la guarda, y el flujo completo funciona contra el proxy.

---

## TAREA 0.7 — `invoke_handler` y rotación de key

**Archivo:** `src-tauri/src/main.rs` (handler) + acción manual

**Qué hacer:** en `main()`:

```rust
.invoke_handler(tauri::generate_handler![
    scan_system_real,
    analyze_remote,
    save_license,
    load_license,
    execute_optimization_script
])
```

**Acción manual (Alonso):** rotar la API key de Anthropic. La actual vivió en `.env` y bundles de dev → considerarla quemada. Generar nueva, ponerla solo en el secret del worker.

**Criterio de aceptación:** `cargo check` OK. La key vieja desactivada en consola de Anthropic.

---

# FASE 1 — PRE-LANZAMIENTO (BLOQUEANTE)

> Sin esto se lanza, pero con riesgo alto de soporte y de reputación.

## TAREA 1.1 — Snapshot + rollback real

**Archivos:** `src-tauri/src/main.rs`, `src/App.tsx`

**Qué hacer:**
1. **Antes** de aplicar, leer el valor actual de cada parámetro que el script va a tocar y guardarlo en `~/.config/pcoptimizer/snapshot.json` con timestamp.
2. Generar un `revert.sh` que restaure esos valores exactos (mismo validador que el script normal).
3. Comando `revert_last()` que ejecute el `revert.sh` vía pkexec.
4. En la UI: botón "Deshacer última optimización" visible en `phase === "done"`, y aviso "snapshot guardado" antes de aplicar.

**Especificación del snapshot:** parsear el script generado, extraer cada `sysctl -w clave=valor` y cada redirección a `/sys/...`, leer el valor vigente del sistema para cada uno, y construir el revert con esos valores previos.

**Criterio de aceptación:** aplicar una optimización, pulsar Deshacer, y verificar con `sysctl <clave>` que el valor vuelve al original. El `revert.sh` pasa `validate_script`.

**Verificación:** `cat /proc/sys/vm/swappiness` antes → aplicar → deshacer → mismo valor.

---

## TAREA 1.2 — Worker: garantizar JSON válido

**Archivo:** `dix-proxy/src/index.js`

**Qué hacer:** implementar `ensureValidJson`:

```js
async function ensureValidJson(text, scan, env) {
  const tryParse = (t) => {
    try { JSON.parse(t); return t; } catch {}
    const m = t.match(/\{[\s\S]*\}/);
    if (m) { try { JSON.parse(m[0]); return m[0]; } catch {} }
    return null;
  };
  let ok = tryParse(text);
  if (ok) return ok;
  // 1 reintento con temperatura baja
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5", max_tokens: 2000, temperature: 0,
      system: SYSTEM_ANALYSIS,
      messages: [{ role: "user", content: buildAnalysisPrompt(scan) }],
    }),
  });
  const d = await r.json();
  const t2 = d.content?.find((b) => b.type === "text")?.text || "";
  return tryParse(t2);
}
```

**Criterio de aceptación:** si Claude devuelve texto con prosa alrededor del JSON, el worker extrae y valida el JSON; si falla dos veces, devuelve 502 controlado (la app muestra error legible, no crashea).

---

## TAREA 1.3 — Worker: licencia atada a hardware + caché

**Archivo:** `dix-proxy/src/index.js`

**Qué hacer:** implementar `validateLicense` usando el endpoint de **activación** de Lemon Squeezy (ata la licencia a una instancia = `hw_id`) y cacheando en KV 15 min:

```js
async function validateLicense(key, hwId, env) {
  const cacheKey = `lic:${key}:${hwId}`;
  const cached = await env.KV.get(cacheKey);
  if (cached === "1") return true;
  if (cached === "0") return false;

  // Validar + activar instancia para este hw_id
  const r = await fetch("https://api.lemonsqueezy.com/v1/licenses/validate", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ license_key: key, instance_name: hwId }),
  });
  const d = await r.json();
  const valid = !!d.valid;
  // Activación de instancia si la licencia es válida y no está activada en este hw
  if (valid && d.license_key && d.license_key.activation_limit) {
    if (!d.instance || d.instance.name !== hwId) {
      await fetch("https://api.lemonsqueezy.com/v1/licenses/activate", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ license_key: key, instance_name: hwId }),
      });
    }
  }
  await env.KV.put(cacheKey, valid ? "1" : "0", { expirationTtl: 900 });
  return valid;
}
```

**Criterio de aceptación:** una misma key activada en una máquina, usada en otra distinta, debe respetar el `activation_limit` configurado en Lemon Squeezy. La validación cacheada no llama a Lemon Squeezy en cada análisis.

---

## TAREA 1.4 — Auto-updater firmado (o desactivado)

**Archivos:** `src-tauri/tauri.conf.json`, CI

**Qué hacer:**
- Si se activa `tauri-plugin-updater`: generar par de claves de firma de Tauri (`tauri signer generate`), poner la clave pública en `tauri.conf.json`, firmar cada release en CI, y firmar el `.deb` con GPG.
- Si NO se va a firmar todavía: **no incluir el updater**. Dejar actualización manual vía GitHub Releases.

**Criterio de aceptación:** o updater con firma verificable, o sin updater. Nunca updater sin firma.

---

## TAREA 1.5 — Detección real de hardware (des-hardcodear)

**Archivo:** `src-tauri/src/main.rs`

**Qué hacer:** añadir campos a `SystemScan` (`cpu_model`, `ram_gb`, `gpu_model`) y poblarlos en `scan_system_real`:

```rust
// Campos nuevos en struct SystemScan: cpu_model, ram_gb, gpu_model (String)

let cpu_model = fs::read_to_string("/proc/cpuinfo").unwrap_or_default()
    .lines().find(|l| l.starts_with("model name"))
    .and_then(|l| l.split(':').nth(1)).unwrap_or("unknown").trim().to_string();
let ram_gb = fs::read_to_string("/proc/meminfo").unwrap_or_default()
    .lines().find(|l| l.starts_with("MemTotal"))
    .and_then(|l| l.split_whitespace().nth(1))
    .and_then(|kb| kb.parse::<u64>().ok())
    .map(|kb| format!("{}GB", kb / 1024 / 1024)).unwrap_or("unknown".into());
let gpu_model = Command::new("/usr/bin/lspci").output().ok()
    .map(|o| String::from_utf8_lossy(&o.stdout).lines()
        .find(|l| l.contains("VGA") || l.contains("3D"))
        .and_then(|l| l.split(':').last()).unwrap_or("unknown").trim().to_string())
    .unwrap_or("unknown".into());
```

**Criterio de aceptación:** la app reporta el hardware real de la máquina donde corre, no "i5-12400 / RTX 3060" fijo. Probado en al menos una máquina distinta.

---

## TAREA 1.6 — CSP básica

**Archivo:** `src-tauri/tauri.conf.json`

**Qué hacer:** sustituir `"csp": null` por una CSP que solo permita el proxy:

```json
"csp": "default-src 'self'; connect-src 'self' https://api.dixsystem.com; style-src 'self' 'unsafe-inline'"
```

**Criterio de aceptación:** la app funciona con la CSP activa; ninguna petición a dominios no listados.

---

## TAREA 1.7 — Pasar los 500 stress tests por el validador

**Archivo nuevo:** `src-tauri/tests/validator.rs`

**Qué hacer:** cargar los 500 casos de stress (normales, edge, extremos, inyección, contradictorios) y pasarlos por `validate_script`. Clasificar: scripts legítimos que el validador rechaza (falsos positivos → ajustar whitelist) y scripts peligrosos que pasa (falsos negativos → ampliar FORBIDDEN).

**Criterio de aceptación:** 0 falsos negativos (ningún script peligroso pasa). Falsos positivos documentados y minimizados. Informe de resultados generado.

**Verificación:** `cargo test validator`.

---

# FASE 2 — LA HERRAMIENTA DEFINITIVA

> Lo que la separa de "un script con IA" y construye el moat incopiable.

## TAREA 2.1 — Benchmark real antes/después

**Archivos:** `src-tauri/src/main.rs`, `src/App.tsx`

**Qué hacer:**
1. Comando `run_benchmark()` que ejecute medidas reproducibles y rápidas (≈10-20s): CPU (sysbench si está, fallback a cálculo propio), I/O (fio o dd controlado en directorio temporal del usuario), latencia de memoria.
2. Flujo: benchmark **antes** de aplicar → aplicar → benchmark **después** → mostrar delta real ("CPU +14,8%, I/O -22% latencia en TU máquina").
3. El score 62→91 deja de ser estimado por IA: se muestra el medido. El estimado de IA queda como "proyección", el medido como "resultado real".

**Dependencias:** detectar `sysbench`/`fio`; si no están, ofrecer instalarlos o usar fallback nativo. No añadir como dependencia de build, son herramientas de sistema.

**Criterio de aceptación:** dos benchmarks consecutivos sin cambios dan resultados dentro de ±3% (reproducible). El delta mostrado tras aplicar es real, no inventado.

---

## TAREA 2.2 — Perfiles por contexto

**Archivos:** `src-tauri/src/main.rs`, `src/App.tsx`, `dix-proxy/src/index.js`

**Qué hacer:** perfiles seleccionables (Gaming, Streaming, Desarrollo, Servidor, Equilibrado). Cada perfil pasa un `profile` al proxy que ajusta el prompt para priorizar (ej. Gaming → latencia y CPU; Servidor → throughput y estabilidad). Guardar perfil aplicado en el snapshot.

**Criterio de aceptación:** cambiar de perfil produce planes de optimización distintos y coherentes con el contexto. UI con selector claro antes de escanear.

---

## TAREA 2.3 — DIX Atlas (telemetría colectiva opt-in)

**Archivos:** `dix-proxy/src/index.js`, backend de datos (KV/D1), `src/App.tsx`

**Qué hacer:**
1. **Opt-in explícito** en primer arranque: "¿Compartir datos anónimos de hardware y mejoras para mejorar las recomendaciones de todos?". Por defecto **desactivado**.
2. Si acepta: tras un benchmark, enviar al proxy `{hw_hash, perfil, config_aplicada, mejora_medida}` — **sin** identificadores personales, hw_id hasheado.
3. Endpoint `/v1/atlas/best` que, dado un `hw_hash`, devuelva la mejor config medida por usuarios con hardware equivalente.
4. La IA puede usar ese dato como contexto: "340 usuarios con tu CPU+GPU mejoraron de media X con esta config".

**Privacidad:** documento de qué se recoge y qué no, accesible desde la app. Nunca rutas, hostnames, ni datos identificables.

**Criterio de aceptación:** con telemetría off no sale ningún dato del PC (verificable desconectando red y revisando peticiones). Con on, los datos enviados no contienen nada identificable. El endpoint `best` mejora con el volumen de datos.

> **Moat:** este es el activo incopiable. Un fork del cliente nunca tendrá los datos. Vive 100% en servidor.

---

## TAREA 2.4 — `dix-cli` (servidores sin GUI)

**Archivo nuevo:** binario CLI en el mismo workspace Rust

**Qué hacer:** binario de línea de comandos que reutilice `scan_system_real`, `analyze_remote`, `validate_script` y `execute_optimization_script` sin la capa Tauri. Comandos: `dix scan`, `dix analyze --profile server`, `dix apply`, `dix revert`. Misma licencia y proxy.

**Criterio de aceptación:** funciona por SSH en un servidor headless. Abre la puerta a uso enterprise sin desarrollo de GUI adicional.

---

# FASE 3 — ESTRUCTURA OPEN-CORE (PREVIO A PUBLICAR REPO)

> Decisión irreversible: una vez público, no hay vuelta atrás. Revisar antes de `git push`.

## TAREA 3.1 — Corte de qué es abierto y qué no

**Acción de definición (Alonso + Claude Code documentan):**

**SÍ open source (repo público `dix`):**
- Todo el cliente Tauri (`src/`, `src-tauri/src/` excepto secretos), incluido el validador de scripts (la transparencia del validador es un argumento de confianza, no un riesgo).
- Detección de hardware, snapshot/rollback, benchmark, UI.

**JAMÁS open source (repo privado):**
- `dix-proxy/` completo (worker, system prompts, lógica de coste).
- DIX Atlas (endpoints, esquema de datos, lógica de agregación).
- Cualquier clave, secret o endpoint de gestión.

**Criterio de aceptación:** `.gitignore` del repo público excluye `dix-proxy/`, `.env`, secrets. Revisión manual de que ningún prompt ni endpoint sensible queda en el repo público.

---

## TAREA 3.2 — Licencia AGPL-3.0 + cabeceras

**Archivos:** `LICENSE`, cabeceras de `main.rs`, `lib.rs`, `App.tsx`, `main.tsx`

**Qué hacer:**
- `LICENSE` con texto AGPL-3.0 completo.
- Cabecera en cada fuente del cliente:

```
// © 2026 DixSystem — PCOptimizer Pro (DIX)
// Licenciado bajo AGPL-3.0. La primera AppIA del Mundo.
```

**Por qué AGPL y no MIT:** AGPL permite a la comunidad auditar y contribuir, pero obliga a quien lo use (incluido como servicio) a abrir su código. Bloquea que un competidor cierre y revenda tu trabajo. Es "amigable con la comunidad, hostil con el parásito".

**Criterio de aceptación:** todos los fuentes del cliente con cabecera; `LICENSE` presente; README explica el modelo open-core.

---

## TAREA 3.3 — Modo BYOK (Bring Your Own Key) para el tier gratuito

**Archivos:** `src/App.tsx`, `src-tauri/src/main.rs`

**Qué hacer:** en la versión open source, permitir que el usuario introduzca **su propia** API key de Anthropic (guardada local, igual patrón que la licencia, nunca en frontend bundle). Si hay BYOK, el cliente llama a Anthropic directamente con la key del usuario; si hay licencia DIX, usa el proxy. Coste para DixSystem en modo BYOK: cero.

**Criterio de aceptación:** un usuario sin licencia puede usar la app completa poniendo su propia key. Un usuario con licencia DIX usa el proxy y Atlas. Ambos caminos funcionan y están separados con claridad en la UI.

---

## TAREA 3.4 — README de lanzamiento + prueba social

**Archivo:** `README.md` (repo público)

**Qué hacer:** README con GIF del flujo, benchmarks reales medidos (Tarea 2.1), explicación del modelo open-core, instrucciones de build, y enlace a la versión Pro. Mensaje central: "código abierto y auditable, sin humo; el servicio Pro paga el servidor y los datos del Atlas".

**Criterio de aceptación:** un usuario técnico puede clonar, compilar y ejecutar en modo BYOK siguiendo solo el README.

---

# ORDEN DE EJECUCIÓN Y DEPENDENCIAS

```
FASE 0 (bloqueante, en orden):
  0.1 → 0.2 → 0.3 → 0.4 → 0.5 → 0.6 → 0.7

FASE 1 (bloqueante, tras Fase 0):
  1.5 (hardware real, lo necesita el proxy)  →  1.2, 1.3 (worker)  →  1.1 (rollback)  →  1.6, 1.4, 1.7

FASE 2 (tras Fase 1 estable):
  2.1 (benchmark)  →  2.2 (perfiles)  →  2.3 (Atlas)  →  2.4 (CLI)

FASE 3 (solo cuando se decida publicar):
  3.1 (corte) → 3.2 (licencia) → 3.3 (BYOK) → 3.4 (README)
```

**Hitos:**
- **Fin de Fase 0+1 = listo para primera venta** (Windows o Linux Pro).
- **Fin de Fase 2 = herramienta definitiva** con moat de datos.
- **Fin de Fase 3 = repo público** y estrategia open-core activa.

---

# CHECKLIST DE ACEPTACIÓN GLOBAL

Antes de considerar el proyecto listo para lanzar:

- [ ] `grep -ri "sk-ant\|VITE_ANTHROPIC" src/ .env` → vacío
- [ ] `strings` sobre el binario release → sin API key, sin system prompts
- [ ] `validate_script` con 500 stress tests → 0 falsos negativos
- [ ] Aplicar → Deshacer restaura valores originales (verificado con `sysctl`)
- [ ] Worker devuelve 400/403/429 correctamente y JSON válido garantizado
- [ ] Licencia atada a hardware respeta `activation_limit`
- [ ] App funciona con CSP activa
- [ ] Hardware detectado es el real de la máquina
- [ ] Benchmark reproducible ±3%
- [ ] Telemetría off = cero datos salen del PC
- [ ] Updater firmado o ausente (nunca sin firma)
- [ ] Repo público sin `dix-proxy/`, prompts ni secrets
- [ ] `npm run tauri build` produce `.deb` que instala limpio en sistema sin entorno de dev

---

# REGLAS QUE CLAUDE CODE NUNCA DEBE VIOLAR

1. API key de Anthropic solo en el worker. Jamás en cliente ni con prefijo `VITE_`.
2. Nunca `numa_balancing=0`, nunca `dirty_ratio>15`, nunca `hugepages=never`, nunca tocar GPU/nvidia.
3. Rutas absolutas siempre.
4. Todo script a root pasa por `validate_script` primero.
5. Nada se escribe en rutas predecibles tipo `/tmp` para ejecutar como root.
6. Edits quirúrgicos. No reescribir archivos enteros. No dependencias nuevas fuera de las listadas.
7. No publicar nada del repo privado en el público.
8. No avanzar de fase sin pasar los criterios de aceptación de la anterior.

---

*DixSystem — Junio 2026 · "La primera AppIA del Mundo"*
