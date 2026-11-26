import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handle } from "../src/index.js";
import { LEGAL_PAGES } from "../src/legal-pages.js";
import { makeEnv } from "./helpers.js";

const get = (path, env = makeEnv()) => handle(new Request(`https://proxy.test${path}`), env, {});

describe("legal pages", () => {
  for (const [path, needle] of [
    ["/privacy", /Privacy Policy/],
    ["/terms", /Terms of Service/],
    ["/disclaimer", /Health and Food Disclaimer/],
    ["/support", /cooksnap\.support@gmail\.com/],
    ["/pl/privacy", /Polityka prywatności/],
    ["/pl/terms", /Regulamin/],
    ["/pl/disclaimer", /Ostrzeżenia zdrowotne i żywnościowe/],
    ["/pl/support", /cooksnap\.support@gmail\.com/],
  ]) {
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
    assert.match(LEGAL_PAGES["pl/privacy"], /<table>/);
  });

  it("every page names the controller and has no placeholder or draft left", () => {
    for (const [name, html] of Object.entries(LEGAL_PAGES)) {
      assert.ok(!/\[[A-Z]{3,}[^\]]*\]/.test(html), `${name} has a placeholder`);
      assert.ok(!/DRAFT|Wersja robocza/.test(html), `${name} is marked as draft`);
      if (!name.endsWith("support")) assert.match(html, /Horacego Safrina 18, 91-177 Łódź/);
    }
  });

  it("the Polish pages are Polish and link to each other, the English ones to theirs", () => {
    assert.match(LEGAL_PAGES["pl/terms"], /<html lang="pl">/);
    assert.match(LEGAL_PAGES["pl/terms"], /href="\/pl\/privacy"/);
    assert.match(LEGAL_PAGES.terms, /<html lang="en">/);
    assert.match(LEGAL_PAGES.terms, /href="\/pl\/terms"/);
  });
});
