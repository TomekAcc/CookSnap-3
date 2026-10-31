import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateContent, getDeviceId, resetDeviceIdCache, resolveApiKey } from "../src/services/geminiClient";

// With EXPO_PUBLIC_GEMINI_PROXY_URL set, the app talks to the proxy: no key in the request,
// a per-install device id instead.

const PROXY = "https://cook-ai-proxy.example.workers.dev";
const ok = (data) => ({ ok: true, status: 200, json: async () => data, text: async () => "" });
const realFetch = global.fetch;

beforeEach(async () => {
  await AsyncStorage.clear();
  resetDeviceIdCache();
  process.env.EXPO_PUBLIC_GEMINI_PROXY_URL = PROXY;
  process.env.EXPO_PUBLIC_GEMINI_API_KEY = "SHOULD-NEVER-BE-SENT";
  global.fetch = jest.fn().mockResolvedValue(ok({ candidates: [{ content: { parts: [{ text: "[]" }] } }] }));
});
afterEach(() => {
  delete process.env.EXPO_PUBLIC_GEMINI_PROXY_URL;
  delete process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  global.fetch = realFetch;
});

describe("proxy mode", () => {
  it("sends the request to the proxy with a device id and no key anywhere", async () => {
    const result = await generateContent({ apiKey: resolveApiKey(), model: "gemini-flash-latest", body: { contents: [] }, timeoutMs: 1000 });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe(`${PROXY}/v1beta/models/gemini-flash-latest:generateContent`);
    expect(init.method).toBe("POST");
    expect(init.headers["X-Device-Id"]).toMatch(/^[a-f0-9]{32}$/);
    const everything = JSON.stringify([url, init]);
    expect(everything).not.toContain("SHOULD-NEVER-BE-SENT");
    expect(everything).not.toContain("via-proxy");
    expect(init.headers["x-goog-api-key"]).toBeUndefined();
    expect(result).toMatchObject({ ok: true, text: "[]" });
  });

  it("tolerates a trailing slash on the configured URL", async () => {
    process.env.EXPO_PUBLIC_GEMINI_PROXY_URL = `${PROXY}///`;
    await generateContent({ apiKey: "x", model: "m", body: {}, timeoutMs: 1000 });
    expect(global.fetch.mock.calls[0][0]).toBe(`${PROXY}/v1beta/models/m:generateContent`);
  });

  it("callers still see a configured key, so Gemini features stay enabled without one in the app", () => {
    delete process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    expect(resolveApiKey()).toBeTruthy();
  });

  it("without a proxy URL it goes straight to Google with the key header, as before", async () => {
    delete process.env.EXPO_PUBLIC_GEMINI_PROXY_URL;
    await generateContent({ apiKey: "REAL", model: "m", body: {}, timeoutMs: 1000 });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/m:generateContent");
    expect(init.headers["x-goog-api-key"]).toBe("REAL");
    expect(init.headers["X-Device-Id"]).toBeUndefined();
  });
});

describe("device id", () => {
  it("is created once and reused across calls and restarts", async () => {
    const first = await getDeviceId();
    expect(first).toMatch(/^[a-f0-9]{32}$/);
    expect(await getDeviceId()).toBe(first);
    resetDeviceIdCache(); // simulates a fresh app start
    expect(await getDeviceId()).toBe(first);
    expect(await AsyncStorage.getItem("cookai:deviceId:v1")).toBe(first);
  });

  it("replaces a corrupt stored value", async () => {
    await AsyncStorage.setItem("cookai:deviceId:v1", "bad value!");
    const id = await getDeviceId();
    expect(id).toMatch(/^[a-f0-9]{32}$/);
    expect(await AsyncStorage.getItem("cookai:deviceId:v1")).toBe(id);
  });

  it("differs between installs", async () => {
    const a = await getDeviceId();
    await AsyncStorage.clear();
    resetDeviceIdCache();
    expect(await getDeviceId()).not.toBe(a);
  });
});
