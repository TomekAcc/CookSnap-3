import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidDeviceId, modelFromPath, validateBody } from "../src/policy.js";
import { goodBody } from "./helpers.js";

describe("modelFromPath", () => {
  it("extracts the model from a generateContent path", () => {
    assert.equal(modelFromPath("/v1beta/models/gemini-flash-latest:generateContent"), "gemini-flash-latest");
    assert.equal(modelFromPath("/v1beta/models/gemini-3.7-flash:generateContent"), "gemini-3.7-flash");
  });
  it("rejects anything else", () => {
    for (const path of ["/", "/v1beta/models", "/v1beta/models/x:streamGenerateContent", "/v1/models/x:generateContent", "/v1beta/models/a/b:generateContent", "/v1beta/models/x:generateContent/extra"]) {
      assert.equal(modelFromPath(path), null, path);
    }
  });
});

describe("isValidDeviceId", () => {
  it("accepts 16-64 letters, digits and dashes", () => {
    assert.equal(isValidDeviceId("0123456789abcdef"), true);
    assert.equal(isValidDeviceId("a1b2c3d4-e5f6-4789-a0b1-c2d3e4f5a6b7"), true);
  });
  it("rejects missing, short, long and odd characters", () => {
    for (const bad of [null, undefined, "", "short", "x".repeat(65), "has space 0123456789", "semi;colon0123456789", 12345678901234567]) {
      assert.equal(isValidDeviceId(bad), false, String(bad));
    }
  });
});

describe("validateBody", () => {
  it("accepts what the app sends", () => {
    assert.equal(validateBody(goodBody()), null);
    assert.equal(
      validateBody({
        systemInstruction: { parts: [{ text: "be brief" }] },
        contents: [{ role: "user", parts: [{ text: "x" }, { inlineData: { mimeType: "image/jpeg", data: "AAAA" } }] }],
        generationConfig: { temperature: 0, topP: 0.9, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
      }),
      null
    );
  });

  it("rejects fields the app never uses (tools, safety overrides, cached content)", () => {
    for (const extra of [{ tools: [{ googleSearch: {} }] }, { safetySettings: [] }, { cachedContent: "x" }, { toolConfig: {} }]) {
      assert.match(validateBody({ ...goodBody(), ...extra }), /not allowed/);
    }
  });

  it("rejects non-objects and missing contents", () => {
    for (const bad of [null, [], "x", 1]) assert.ok(validateBody(bad));
    assert.ok(validateBody({}));
    assert.ok(validateBody({ contents: [] }));
  });

  it("limits the shape of parts", () => {
    assert.ok(validateBody({ contents: [{ parts: [{ fileData: { fileUri: "gs://x" } }] }] }));
    assert.ok(validateBody({ contents: [{ parts: [{ text: "a", extra: 1 }] }] }));
    assert.ok(validateBody({ contents: [{ parts: [{ inlineData: { mimeType: "video/mp4", data: "AA" } }] }] }));
    assert.ok(validateBody({ contents: [{ parts: [{ inlineData: { mimeType: "image/jpeg", data: "AA", extra: 1 } }] }] }));
    assert.ok(validateBody({ contents: [{ role: "system", parts: [{ text: "x" }] }] }));
    assert.ok(validateBody({ contents: [{ parts: [] }] }));
  });

  it("caps the number of images", () => {
    const image = { inlineData: { mimeType: "image/jpeg", data: "AA" } };
    assert.equal(validateBody({ contents: [{ parts: Array(8).fill(image) }] }), null);
    assert.match(validateBody({ contents: [{ parts: Array(9).fill(image) }] }), /too many images/);
  });

  it("caps output size and thinking so a request can't be made expensive", () => {
    const withConfig = (generationConfig) => ({ ...goodBody(), generationConfig });
    assert.equal(validateBody(withConfig({ maxOutputTokens: 8000 })), null);
    assert.ok(validateBody(withConfig({ maxOutputTokens: 1000000 })));
    assert.ok(validateBody(withConfig({ maxOutputTokens: 0 })));
    assert.equal(validateBody(withConfig({ thinkingConfig: { thinkingBudget: 2048 } })), null);
    assert.ok(validateBody(withConfig({ thinkingConfig: { thinkingBudget: 100000 } })));
    assert.ok(validateBody(withConfig({ thinkingConfig: { includeThoughts: true } })));
    assert.ok(validateBody(withConfig({ candidateCount: 8 })));
    assert.ok(validateBody(withConfig({ responseModalities: ["IMAGE"] })));
  });
});
