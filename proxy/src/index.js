// Gemini proxy for the Cook AI app. The app calls this instead of Google, so the Gemini API key
// lives only here (as the GEMINI_API_KEY secret) and never ships inside the app.
//
//   POST /v1beta/models/<model>:generateContent   same path and body the app used to send to Google
//   GET  /health
//
// Every request must carry an X-Device-Id header (a random id the app creates once per install),
// pass the body rules in policy.js, and fit within the per-device and global daily limits.

import { Limiter } from "./limiter.js";
import {
  ALLOWED_MODELS,
  MAX_BODY_BYTES,
  isValidDeviceId,
  modelFromPath,
  validateBody,
} from "./policy.js";

export { Limiter };

const DEFAULT_UPSTREAM = "https://generativelanguage.googleapis.com/v1beta";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Device-Id",
  "Access-Control-Max-Age": "86400",
};

// Same envelope Google uses, so the app's existing error handling reads it unchanged.
function fail(status, message, code) {
  return Response.json({ error: { code: status, message, status: code } }, { status, headers: CORS });
}

const utcDay = (now) => now.toISOString().slice(0, 10);

/** Handles one request. `deps` lets tests inject the upstream fetch and the clock. */
export async function handle(request, env, deps = {}) {
  const upstreamFetch = deps.fetch || fetch;
  const now = deps.now ? deps.now() : new Date();
  const url = new URL(request.url);

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (url.pathname === "/health" && request.method === "GET") {
    return Response.json({ ok: true }, { headers: CORS });
  }

  const model = modelFromPath(url.pathname);
  if (!model) return fail(404, "Not found", "NOT_FOUND");
  if (request.method !== "POST") return fail(405, "Method not allowed", "METHOD_NOT_ALLOWED");

  if (env.PROXY_DISABLED === "1") return fail(503, "Temporarily unavailable", "UNAVAILABLE");
  if (!env.GEMINI_API_KEY) return fail(500, "Proxy is not configured", "INTERNAL");

  if (!ALLOWED_MODELS.includes(model)) return fail(400, `Model not allowed: ${model}`, "INVALID_ARGUMENT");

  const device = request.headers.get("X-Device-Id");
  if (!isValidDeviceId(device)) return fail(400, "Missing or invalid X-Device-Id", "INVALID_ARGUMENT");

  const declared = Number(request.headers.get("Content-Length"));
  if (declared > MAX_BODY_BYTES) return fail(413, "Request too large", "INVALID_ARGUMENT");
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return fail(413, "Request too large", "INVALID_ARGUMENT");
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return fail(400, "Body is not valid JSON", "INVALID_ARGUMENT");
  }
  const problem = validateBody(body);
  if (problem) return fail(400, problem, "INVALID_ARGUMENT");

  const limiter = env.LIMITER.get(env.LIMITER.idFromName("main"));
  const verdict = await (
    await limiter.fetch("https://limiter/hit", {
      method: "POST",
      body: JSON.stringify({
        device,
        day: utcDay(now),
        deviceLimit: Number(env.DEVICE_DAILY_LIMIT) || 300,
        globalLimit: Number(env.GLOBAL_DAILY_LIMIT) || 2000,
      }),
    })
  ).json();
  if (!verdict.ok) {
    const message = verdict.reason === "global" ? "The service is busy today. Try again tomorrow." : "Daily limit reached on this device.";
    return fail(429, message, "RESOURCE_EXHAUSTED");
  }

  const upstream = await upstreamFetch(`${env.UPSTREAM_BASE || DEFAULT_UPSTREAM}/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify(body),
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json", ...CORS },
  });
}

export default {
  fetch: (request, env) => handle(request, env),
};
