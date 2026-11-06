import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handle } from "../src/index.js";
import { LEGAL_PAGES } from "../src/legal-pages.js";
import { makeEnv } from "./helpers.js";

const get = (path, env = makeEnv()) => handle(new Request(`https://proxy.test${path}`), env, {});

describe("legal pages", () => {
  for (const [path, needle] of [["/privacy", /Privacy Policy/], ["/terms", /Terms of Service/], ["/support", /cooksnap\.support@gmail\.com/]]) {
    it(`${path} is served as a page, with a strict policy and no secrets`, async () => {
      const res = await get(path);
      assert.equal(res.status, 200);
      assert.match(res.headers.get("Content-Type"), /text\/html/);
      assert.match(res.headers.get("Content-Security-Policy"), /default-src 'none'/);
      const body = await res.text();
      assert.match(body, needle);
      assert.ok(!body.includes("REAL-SECRET-KEY"));
    });
  }

  it("is only a GET page and does not answer for unknown names", async () => {
    assert.equal((await handle(new Request("https://proxy.test/privacy", { method: "POST" }), makeEnv(), {})).status, 404);
    assert.equal((await get("/constructor")).status, 404);
    assert.equal((await get("/toString")).status, 404);
  });

  it("generated pages carry no script and keep the policy table", () => {
    for (const html of Object.values(LEGAL_PAGES)) assert.ok(!/<script/i.test(html));
    assert.match(LEGAL_PAGES.privacy, /<table>/);
  });
});
