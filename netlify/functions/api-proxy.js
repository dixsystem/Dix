// Proxy transparente dixsystem.com/api/* -> dix-proxy.dixsystem.workers.dev/*
// Objetivo: que el nombre del worker interno no aparezca en ningún artefacto
// público (landing, binarios). El navegador solo ve dixsystem.com/api/*.
const UPSTREAM = "https://dix-proxy.dixsystem.workers.dev";
const FUNCTION_PREFIX = "/.netlify/functions/api-proxy";
const REWRITE_PREFIX = "/api";

exports.handler = async (event) => {
  // Vía rewrite (netlify.toml [[redirects]] status=200), event.path llega
  // como la URL pública original ("/api/subscribe"), no como la ruta interna
  // de la función. Hay que quitar el prefijo que corresponda en cada caso.
  const suffix = event.path.startsWith(FUNCTION_PREFIX)
    ? event.path.slice(FUNCTION_PREFIX.length)
    : event.path.startsWith(REWRITE_PREFIX)
    ? event.path.slice(REWRITE_PREFIX.length)
    : event.path;

  const qs = event.queryStringParameters
    ? new URLSearchParams(event.queryStringParameters).toString()
    : "";
  const target = `${UPSTREAM}${suffix}${qs ? `?${qs}` : ""}`;

  const forwardHeaders = {
    "content-type": event.headers["content-type"] || "application/json",
  };
  if (event.headers["x-device-id"]) forwardHeaders["X-Device-Id"] = event.headers["x-device-id"];
  if (event.headers["x-license-key"]) forwardHeaders["X-License-Key"] = event.headers["x-license-key"];

  let upstreamResp;
  try {
    upstreamResp = await fetch(target, {
      method: event.httpMethod,
      headers: forwardHeaders,
      body: ["GET", "HEAD"].includes(event.httpMethod) ? undefined : event.body,
    });
  } catch (err) {
    return {
      statusCode: 502,
      headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "https://dixsystem.com" },
      body: JSON.stringify({ error: "upstream_unreachable" }),
    };
  }

  const body = await upstreamResp.text();
  return {
    statusCode: upstreamResp.status,
    headers: {
      "content-type": upstreamResp.headers.get("content-type") || "application/json",
      // Mismo origen en producción (dixsystem.com sirve landing y esta función),
      // pero se deja explícito por si se llama desde otro subdominio.
      "Access-Control-Allow-Origin": "https://dixsystem.com",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, x-device-id, x-license-key",
    },
    body,
  };
};
