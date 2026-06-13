// © 2026 DixSystem — Todos los derechos reservados.
// Dix Proxy — api.dixsystem.com/v1/messages
// La API key de Anthropic SOLO existe como secret del worker (env.ANTHROPIC_KEY).

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEMO_LIMIT    = 1;   // análisis gratis por device_id
const RATE_LIMIT    = 20;  // análisis por licencia por día
const KV_TTL_LICENSE = 900;  // 15 min caché validación licencia
const KV_TTL_RATELIMIT = 90000; // ~25h (cubre el día natural)

export default {
  async fetch(req, env) {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // Leer body una sola vez
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response("Bad Request: body JSON inválido", { status: 400 });
    }

    const licenseKey = req.headers.get("X-License-Key");
    const deviceId   = req.headers.get("X-Device-Id");

    // ── Rama licencia ────────────────────────────────────────────────────────
    if (licenseKey) {
      const hwId = deviceId || "unknown";
      const licValid = await validateLicense(licenseKey, hwId, env);
      if (!licValid) {
        return new Response("Licencia inválida", { status: 403 });
      }

      // Rate limit: 20/día por licencia
      const day   = new Date().toISOString().slice(0, 10);
      const rlKey = `rl:${licenseKey}:${day}`;
      const used  = parseInt((await env.KV.get(rlKey)) || "0");
      if (used >= RATE_LIMIT) {
        return errorJson("rate_limit", "Límite diario de 20 análisis alcanzado", 429);
      }
      await env.KV.put(rlKey, String(used + 1), { expirationTtl: KV_TTL_RATELIMIT });

      return forwardToAnthropic(body, env);
    }

    // ── Rama demo ────────────────────────────────────────────────────────────
    if (deviceId) {
      const demoKey = `demo:${deviceId}`;
      const used    = parseInt((await env.KV.get(demoKey)) || "0");
      if (used >= DEMO_LIMIT) {
        return errorJson("demo_limit", "Has usado tu análisis gratuito. Activa tu licencia para continuar.", 402);
      }
      // Incrementar antes de llamar — evita race conditions en reintentos
      await env.KV.put(demoKey, String(used + 1));

      return forwardToAnthropic(body, env);
    }

    // Sin header de identificación
    return new Response("Bad Request: falta X-License-Key o X-Device-Id", { status: 400 });
  },
};

// ── Reenvía el body tal cual a Anthropic, devuelve su respuesta sin transformar
async function forwardToAnthropic(body, env) {
  const upstream = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type":       "application/json",
      "x-api-key":          env.ANTHROPIC_KEY,
      "anthropic-version":  "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  // Reenviar respuesta de Anthropic tal cual — status + body sin transformar
  const upstreamBody = await upstream.arrayBuffer();
  return new Response(upstreamBody, {
    status:  upstream.status,
    headers: { "content-type": "application/json" },
  });
}

// ── Valida licencia contra Lemon Squeezy y la ata al hw_id — caché KV 15 min
async function validateLicense(key, hwId, env) {
  const cacheKey = `lic:${key}:${hwId}`;
  const cached   = await env.KV.get(cacheKey);
  if (cached === "1") return true;
  if (cached === "0") return false;

  let valid = false;
  try {
    const r = await fetch("https://api.lemonsqueezy.com/v1/licenses/validate", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ license_key: key, instance_name: hwId }),
    });
    const d = await r.json();
    valid = !!d.valid;

    // Activar instancia para este hw_id si aún no está activada
    if (valid) {
      const alreadyActivated = d.instance && d.instance.name === hwId;
      if (!alreadyActivated) {
        await fetch("https://api.lemonsqueezy.com/v1/licenses/activate", {
          method: "POST",
          headers: { "Accept": "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ license_key: key, instance_name: hwId }),
        });
      }
    }
  } catch {
    // Error de red con LS → denegar por seguridad
    return false;
  }

  await env.KV.put(cacheKey, valid ? "1" : "0", { expirationTtl: KV_TTL_LICENSE });
  return valid;
}

// ── Helper: respuesta de error con el formato que espera el cliente Rust
function errorJson(type, message, status) {
  return new Response(
    JSON.stringify({ error: { type, message } }),
    { status, headers: { "content-type": "application/json" } }
  );
}
