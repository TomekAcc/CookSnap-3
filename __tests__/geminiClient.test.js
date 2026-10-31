import {
  VISION_MODELS,
  RECIPE_MODELS,
  EDITOR_MODEL,
  buildGenerationConfig,
  extractText,
  generateContent,
  parseModelJson,
  resolveApiKey,
} from "../src/services/geminiClient";

// These suites cover the direct-to-Google path, so the proxy must not be configured, whatever the shell
// (or CI) running them has set. The proxy path has its own file, geminiProxy.test.js.
const savedProxyUrl = process.env.EXPO_PUBLIC_GEMINI_PROXY_URL;
beforeEach(() => {
  delete process.env.EXPO_PUBLIC_GEMINI_PROXY_URL;
});
afterEach(() => {
  if (savedProxyUrl === undefined) delete process.env.EXPO_PUBLIC_GEMINI_PROXY_URL;
  else process.env.EXPO_PUBLIC_GEMINI_PROXY_URL = savedProxyUrl;
});

describe("resolveApiKey", () => {
  const KEYS = ["EXPO_PUBLIC_GEMINI_API_KEY", "GEMINI_API_KEY"];
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("prefers an explicit key, then the public env var, then the plain one", () => {
    process.env.EXPO_PUBLIC_GEMINI_API_KEY = "public";
    process.env.GEMINI_API_KEY = "plain";
    expect(resolveApiKey("explicit")).toBe("explicit");
    expect(resolveApiKey()).toBe("public");
    delete process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    expect(resolveApiKey()).toBe("plain");
  });

  it("strips whitespace and quotes that sneak in from .env files", () => {
    process.env.EXPO_PUBLIC_GEMINI_API_KEY = '  "abc123"\n';
    expect(resolveApiKey()).toBe("abc123");
  });

  it("returns an empty string when nothing is configured", () => {
    delete process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    expect(resolveApiKey()).toBe("");
  });
});

describe("model lists", () => {
  it("are short, non-empty and made of gemini models", () => {
    for (const list of [VISION_MODELS, RECIPE_MODELS, [EDITOR_MODEL]]) {
      expect(list.length).toBeGreaterThan(0);
      expect(list.length).toBeLessThanOrEqual(3);
      expect(list.every((m) => m.startsWith("gemini-"))).toBe(true);
    }
  });
});

describe("buildGenerationConfig", () => {
  it("asks for JSON and keeps the caller's settings", () => {
    expect(buildGenerationConfig("gemini-flash-lite-latest", { temperature: 0.2, topP: 1 })).toEqual({
      responseMimeType: "application/json",
      temperature: 0.2,
      topP: 1,
    });
  });

  it("turns thinking off only on models that accept thinkingConfig (it is an HTTP 400 elsewhere)", () => {
    expect(buildGenerationConfig("gemini-flash-lite-latest")).not.toHaveProperty("thinkingConfig");
    expect(buildGenerationConfig("gemini-flash-latest").thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(buildGenerationConfig("gemini-3.7-flash").thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(buildGenerationConfig("gemini-flash-latest", {}, 128).thinkingConfig).toEqual({ thinkingBudget: 128 });
  });

  it("never sends thinkingConfig to the models the app actually falls back to", () => {
    expect(buildGenerationConfig(VISION_MODELS[VISION_MODELS.length - 1])).not.toHaveProperty("thinkingConfig");
  });
});

describe("reply parsing", () => {
  it("extracts the first candidate's text, or '' when absent", () => {
    expect(extractText({ candidates: [{ content: { parts: [{ text: "hi" }] } }] })).toBe("hi");
    expect(extractText({})).toBe("");
    expect(extractText(null)).toBe("");
  });

  it("parses JSON with or without markdown fences", () => {
    expect(parseModelJson('[{"a":1}]')).toEqual([{ a: 1 }]);
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseModelJson('```\n[1,2]\n```')).toEqual([1, 2]);
  });

  it("throws on invalid JSON so callers can fall back", () => {
    expect(() => parseModelJson("not json")).toThrow();
    expect(() => parseModelJson("")).toThrow();
  });
});

describe("generateContent", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.useRealTimers();
  });

  const okResponse = (data) => ({ ok: true, status: 200, json: async () => data, text: async () => "" });

  it("posts to the model's endpoint with the key in a header, never in the URL", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      okResponse({ candidates: [{ content: { parts: [{ text: "[]" }] } }] })
    );
    const result = await generateContent({
      apiKey: "SECRET",
      model: "gemini-flash-latest",
      body: { contents: [] },
      timeoutMs: 1000,
    });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent");
    expect(url).not.toContain("SECRET");
    expect(init.method).toBe("POST");
    expect(init.headers["x-goog-api-key"]).toBe("SECRET");
    expect(JSON.parse(init.body)).toEqual({ contents: [] });
    expect(result).toMatchObject({ ok: true, status: 200, text: "[]" });
  });

  it("resolves (does not throw) on HTTP errors and returns the body text", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "rate limited",
    });
    await expect(
      generateContent({ apiKey: "k", model: "m", body: {}, timeoutMs: 1000 })
    ).resolves.toEqual({ ok: false, status: 429, errorText: "rate limited" });
  });

  it("falls back to an empty errorText when the error body cannot be read", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => {
        throw new Error("boom");
      },
    });
    const result = await generateContent({ apiKey: "k", model: "m", body: {}, timeoutMs: 1000 });
    expect(result.errorText).toBe("");
  });

  it("aborts at the deadline even if the connection stalls while reading the body", async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn((url, init) =>
      Promise.resolve({
        ok: true,
        status: 200,
        // A body that never arrives, until the request is aborted.
        json: () =>
          new Promise((_, reject) => {
            init.signal.addEventListener("abort", () => {
              const err = new Error("Aborted");
              err.name = "AbortError";
              reject(err);
            });
          }),
      })
    );
    const pending = generateContent({ apiKey: "k", model: "m", body: {}, timeoutMs: 5000 });
    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await jest.advanceTimersByTimeAsync(5001);
    await assertion;
  });

  it("propagates network failures as rejections", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network request failed"));
    await expect(
      generateContent({ apiKey: "k", model: "m", body: {}, timeoutMs: 1000 })
    ).rejects.toThrow("Network request failed");
  });
});
