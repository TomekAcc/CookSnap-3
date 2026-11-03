import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handle } from "../src/index.js";
import { ADMIN, DEVICE, goodFeedback, makeEnv, request } from "./helpers.js";

const NOW = () => new Date("2026-10-22T10:00:00Z");
const run = (req, env) => handle(req, env, { now: NOW });
const send = (body, env, headers) => run(request("/feedback", { body, headers }), env);
const admin = (path, { method = "GET", body, token = ADMIN } = {}) =>
  new Request(`https://proxy.test${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

describe("POST /feedback", () => {
  it("stores a good message and answers ok", async () => {
    const env = makeEnv();
    const res = await send(goodFeedback(), env);
    assert.equal(res.status, 200);
    const list = await (await run(admin("/admin/list"), env)).json();
    assert.equal(list.items.length, 1);
    assert.equal(list.items[0].message, "The scan keeps spinning");
    assert.equal(list.items[0].platform, "ios");
  });

  it("keeps only known fields and does not store the device id", async () => {
    const env = makeEnv();
    await send({ ...goodFeedback(), evil: "x".repeat(10), deviceId: DEVICE }, env);
    const item = (await (await run(admin("/admin/list"), env)).json()).items[0];
    assert.ok(!("evil" in item));
    assert.ok(!JSON.stringify(item).includes(DEVICE));
  });

  it("rejects bad bodies", async () => {
    for (const bad of [{}, { ...goodFeedback(), kind: "spam" }, { ...goodFeedback(), message: "   " }, { ...goodFeedback(), message: "x".repeat(2001) }, "not json"]) {
      const res = await send(bad, makeEnv());
      assert.equal(res.status, 400, JSON.stringify(bad).slice(0, 40));
    }
  });

  it("needs a valid device id", async () => {
    const res = await send(goodFeedback(), makeEnv(), { "X-Device-Id": "bad" });
    assert.equal(res.status, 400);
  });

  it("limits one phone per day, and everyone together", async () => {
    const env = makeEnv();
    assert.equal((await send(goodFeedback(), env)).status, 200);
    assert.equal((await send(goodFeedback(), env)).status, 200);
    assert.equal((await send(goodFeedback(), env)).status, 429);
    const other = { "X-Device-Id": "fedcba9876543210fedcba9876543210" };
    assert.equal((await send(goodFeedback(), env, other)).status, 200);
    const third = { "X-Device-Id": "11111111111111111111111111111111" };
    assert.equal((await send(goodFeedback(), env, third)).status, 429);
  });

  it("is refused for GET", async () => {
    const res = await run(new Request("https://proxy.test/feedback"), makeEnv());
    assert.equal(res.status, 405);
  });
});

describe("/admin", () => {
  it("does not exist without a long enough token", async () => {
    for (const token of [undefined, "short"]) {
      const env = makeEnv({ ADMIN_TOKEN: token });
      assert.equal((await run(admin("/admin", { token: null }), env)).status, 404);
      assert.equal((await run(admin("/admin/list", { token: "short" }), env)).status, 404);
    }
  });

  it("serves the page without a token, but the list needs it", async () => {
    const env = makeEnv();
    const page = await run(admin("/admin", { token: null }), env);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("Content-Security-Policy"), /default-src 'none'/);
    assert.equal((await run(admin("/admin/list", { token: null }), env)).status, 401);
    assert.equal((await run(admin("/admin/list", { token: "wrong" }), env)).status, 401);
    assert.equal((await run(admin("/admin/list"), env)).status, 200);
  });

  it("lists newest first and deletes one message", async () => {
    const env = makeEnv();
    await handle(request("/feedback", { body: { ...goodFeedback(), message: "first" } }), env, { now: () => new Date("2026-10-22T09:00:00Z") });
    await handle(request("/feedback", { body: { ...goodFeedback(), message: "second" } }), env, { now: () => new Date("2026-10-22T10:00:00Z") });
    const { items } = await (await run(admin("/admin/list"), env)).json();
    assert.deepEqual(items.map((i) => i.message), ["second", "first"]);
    const del = await run(admin("/admin/delete", { method: "POST", body: { id: items[0].id } }), env);
    assert.equal(del.status, 200);
    const after = await (await run(admin("/admin/list"), env)).json();
    assert.deepEqual(after.items.map((i) => i.message), ["first"]);
  });

  it("refuses to delete anything that is not a message", async () => {
    const res = await run(admin("/admin/delete", { method: "POST", body: { id: "lastDay" } }), makeEnv());
    assert.equal(res.status, 400);
  });

  it("drops messages older than 90 days when a new one arrives", async () => {
    const env = makeEnv();
    await handle(request("/feedback", { body: { ...goodFeedback(), message: "old" } }), env, { now: () => new Date("2026-06-01T10:00:00Z") });
    await handle(request("/feedback", { body: { ...goodFeedback(), message: "new" } }), env, { now: NOW });
    const { items } = await (await run(admin("/admin/list"), env)).json();
    assert.deepEqual(items.map((i) => i.message), ["new"]);
  });
});
