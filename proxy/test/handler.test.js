import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handle } from "../src/index.js";
import { DEVICE, PATH, fakeUpstream, goodBody, makeEnv, request } from "./helpers.js";

const NOW = () => new Date("2026-10-22T10:00:00Z");
const run = (req, env = makeEnv(), upstream = fakeUpstream()) => handle(req, env, { fetch: upstream.fetch, now: NOW });

describe("forwarding", () => {
  it("adds the secret key, forwards the body and returns Google's reply untouched", async () => {
    const upstream = fakeUpstream({ candidates: [{ content: { parts: [{ text: '["milk"]' }] } }] });
    const res = await run(request(PATH), makeEnv(), upstream);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { candidates: [{ content: { parts: [{ text: '["milk"]' }] } }] });
    assert.equal(upstream.calls.length, 1);
    const { url, init } = upstream.calls[0];
    assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent");
    assert.equal(init.headers["x-goog-api-key"], "REAL-SECRET-KEY");
    assert.deepEqual(JSON.parse(init.body), goodBody());
  });

  it("passes Google's errors through with their status", async () => {
    const upstream = fakeUpstream({ error: { code: 503, message: "overloaded" } }, 503);
    const res = await run(request(PATH), makeEnv(), upstream);
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error.message, "overloaded");
  });

  it("never exposes the key in a response", async () => {
    for (const res of [await run(request(PATH)), await run(request(PATH, { headers: { "X-Device-Id": "bad" } })), await run(request("/nope"))]) {
      assert.ok(!(await res.text()).includes("REAL-SECRET-KEY"));
      assert.ok(![...res.headers.values()].some((v) => v.includes("REAL-SECRET-KEY")));
    }
  });

  it("answers CORS preflight and health checks without touching Google", async () => {
    const upstream = fakeUpstream();
    const pre = await run(new Request("https://proxy.test" + PATH, { method: "OPTIONS" }), makeEnv(), upstream);
    assert.equal(pre.status, 204);
    const health = await run(new Request("https://proxy.test/health"), makeEnv(), upstream);
    assert.deepEqual(await health.json(), { ok: true });
    assert.equal(upstream.calls.length, 0);
  });
});

describe("refusals (nothing reaches Google)", () => {
  const refused = async (req, status, env) => {
    const upstream = fakeUpstream();
    const res = await run(req, env, upstream);
    assert.equal(res.status, status);
    assert.equal(upstream.calls.length, 0);
    return res.json();
  };

  it("unknown paths and methods", async () => {
    await refused(request("/v1beta/models/gemini-flash-latest:streamGenerateContent"), 404);
    await refused(request("/v1beta/models"), 404);
    await refused(request(PATH, { method: "GET" }), 405);
  });

  it("models outside the allowlist", async () => {
    const body = await refused(request("/v1beta/models/gemini-3-pro:generateContent"), 400);
    assert.match(body.error.message, /Model not allowed/);
  });

  it("a missing or malformed device id", async () => {
    await refused(request(PATH, { headers: { "X-Device-Id": "" } }), 400);
    await refused(request(PATH, { headers: { "X-Device-Id": "too short" } }), 400);
  });

  it("bad JSON and disallowed bodies", async () => {
    await refused(request(PATH, { body: "{not json" }), 400);
    await refused(request(PATH, { body: { ...goodBody(), tools: [{ googleSearch: {} }] } }), 400);
  });

  it("oversized bodies", async () => {
    const big = { contents: [{ parts: [{ text: "x".repeat(5 * 1024 * 1024) }] }] };
    await refused(request(PATH, { body: big }), 413);
  });

  it("when the proxy is switched off or has no key", async () => {
    await refused(request(PATH), 503, makeEnv({ PROXY_DISABLED: "1" }));
    await refused(request(PATH), 500, makeEnv({ GEMINI_API_KEY: "" }));
  });
});

describe("daily limits", () => {
  it("each device gets its own allowance, in the Google error envelope", async () => {
    const env = makeEnv(); // 3 per device, 5 overall
    const upstream = fakeUpstream();
    for (let i = 0; i < 3; i++) assert.equal((await run(request(PATH), env, upstream)).status, 200);
    const blocked = await run(request(PATH), env, upstream);
    assert.equal(blocked.status, 429);
    const body = await blocked.json();
    assert.equal(body.error.status, "RESOURCE_EXHAUSTED");
    assert.match(body.error.message, /device/);
    assert.equal(upstream.calls.length, 3);

    const other = "fedcba9876543210fedcba9876543210";
    assert.equal((await run(request(PATH, { headers: { "X-Device-Id": other } }), env, upstream)).status, 200);
  });

  it("an app-wide cap stops everyone once reached", async () => {
    const env = makeEnv(); // 5 overall
    const upstream = fakeUpstream();
    const ids = ["a".repeat(16), "b".repeat(16)];
    let ok = 0;
    for (let i = 0; i < 8; i++) {
      const res = await run(request(PATH, { headers: { "X-Device-Id": ids[i % 2] } }), env, upstream);
      if (res.status === 200) ok++;
      else assert.match((await res.json()).error.message, /busy today/);
    }
    assert.equal(ok, 5);
    assert.equal(upstream.calls.length, 5);
  });

  it("rejected requests do not use up the allowance", async () => {
    const env = makeEnv();
    for (let i = 0; i < 10; i++) await run(request(PATH, { body: { nope: 1 } }), env);
    for (let i = 0; i < 3; i++) assert.equal((await run(request(PATH), env)).status, 200);
  });

  it("allowances reset on the next UTC day", async () => {
    const env = makeEnv();
    const upstream = fakeUpstream();
    for (let i = 0; i < 3; i++) await run(request(PATH), env, upstream);
    assert.equal((await run(request(PATH), env, upstream)).status, 429);
    const tomorrow = await handle(request(PATH), env, { fetch: upstream.fetch, now: () => new Date("2026-10-23T00:00:01Z") });
    assert.equal(tomorrow.status, 200);
  });

  it("device id is what counts, not the connection", async () => {
    const env = makeEnv();
    for (let i = 0; i < 3; i++) await run(request(PATH, { headers: { "X-Device-Id": DEVICE, "CF-Connecting-IP": `1.2.3.${i}` } }), env);
    assert.equal((await run(request(PATH), env)).status, 429);
  });
});
