import { sendFeedback } from "../src/services/feedback";
import { resetDeviceIdCache } from "../src/services/geminiClient";
import { setFeedbackPrefill, takeFeedbackPrefill } from "../src/utils/feedbackPrefill";

const PROXY = "https://proxy.example.dev";
let original;
beforeEach(() => {
  original = process.env.EXPO_PUBLIC_GEMINI_PROXY_URL;
  process.env.EXPO_PUBLIC_GEMINI_PROXY_URL = PROXY;
  resetDeviceIdCache();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
});
afterEach(() => {
  if (original === undefined) delete process.env.EXPO_PUBLIC_GEMINI_PROXY_URL;
  else process.env.EXPO_PUBLIC_GEMINI_PROXY_URL = original;
});

describe("sendFeedback", () => {
  it("posts the message to our own server with the device id, and nothing else personal", async () => {
    await sendFeedback({ kind: "recipe", message: "Too salty", contact: "a@b.c", recipeTitle: "Soup", language: "en" });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe(`${PROXY}/feedback`);
    expect(init.method).toBe("POST");
    expect(init.headers["X-Device-Id"]).toMatch(/^[0-9a-f]{32}$/);
    const body = JSON.parse(init.body);
    expect(Object.keys(body).sort()).toEqual(["appVersion", "contact", "kind", "language", "message", "platform", "recipeTitle"]);
    expect(body).toMatchObject({ kind: "recipe", message: "Too salty", contact: "a@b.c", recipeTitle: "Soup" });
  });

  it("throws when the server refuses, so the caller keeps the text", async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 429 });
    await expect(sendFeedback({ kind: "bug", message: "x" })).rejects.toThrow("429");
  });

  it("throws when there is no server configured", async () => {
    delete process.env.EXPO_PUBLIC_GEMINI_PROXY_URL;
    await expect(sendFeedback({ kind: "bug", message: "x" })).rejects.toThrow("not configured");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("feedback prefill", () => {
  it("is handed over once", () => {
    setFeedbackPrefill({ kind: "recipe", recipeTitle: "Soup" });
    expect(takeFeedbackPrefill()).toEqual({ kind: "recipe", recipeTitle: "Soup" });
    expect(takeFeedbackPrefill()).toBeNull();
  });
});

describe("feedback outbox", () => {
  const { queueFeedback, flushFeedbackOutbox } = require("../src/services/feedbackOutbox");
  const AsyncStorage = require("@react-native-async-storage/async-storage");
  const sent = () => global.fetch.mock.calls.map(([, init]) => JSON.parse(init.body));

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("sends a queued message, with its id, and empties the outbox", async () => {
    const id = await queueFeedback({ kind: "bug", message: "hello" });
    expect(await flushFeedbackOutbox()).toEqual([]);
    expect(sent()).toHaveLength(1);
    expect(sent()[0]).toMatchObject({ id, kind: "bug", message: "hello" });
    expect(sent()[0].queuedAt).toBeUndefined();
  });

  it("keeps the message when there is no connection, and sends it on the next try", async () => {
    global.fetch.mockRejectedValueOnce(new Error("Network request failed"));
    const id = await queueFeedback({ kind: "idea", message: "later" });
    expect(await flushFeedbackOutbox()).toEqual([id]);
    expect(await flushFeedbackOutbox()).toEqual([]);
    expect(sent().map((m) => m.id)).toEqual([id, id]);
  });

  it("keeps the message when the server is busy or down, but drops one the server says is invalid", async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 503 });
    const a = await queueFeedback({ kind: "bug", message: "a" });
    expect(await flushFeedbackOutbox()).toEqual([a]);
    global.fetch.mockResolvedValueOnce({ ok: false, status: 400 });
    expect(await flushFeedbackOutbox()).toEqual([]);
  });

  it("stops at the first failure and keeps order", async () => {
    const a = await queueFeedback({ kind: "bug", message: "a" });
    const b = await queueFeedback({ kind: "bug", message: "b" });
    global.fetch.mockResolvedValueOnce({ ok: false, status: 429 });
    expect(await flushFeedbackOutbox()).toEqual([a, b]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("forgets messages older than 30 days and keeps at most 20", async () => {
    const old = Date.now() - 31 * 24 * 3600 * 1000;
    await queueFeedback({ kind: "bug", message: "old" }, old);
    for (let i = 0; i < 22; i++) await queueFeedback({ kind: "bug", message: `m${i}` });
    global.fetch.mockResolvedValue({ ok: false, status: 503 });
    const waiting = await flushFeedbackOutbox();
    expect(waiting).toHaveLength(20);
  });

  it("does not lose a message added while a send is in progress", async () => {
    const a = await queueFeedback({ kind: "bug", message: "a" });
    let release;
    global.fetch.mockImplementationOnce(() => new Promise((r) => (release = () => r({ ok: true, status: 200 }))));
    const flushing = flushFeedbackOutbox();
    const queuing = queueFeedback({ kind: "bug", message: "b" });
    await new Promise((r) => setTimeout(r, 20));
    release();
    await flushing;
    const b = await queuing;
    expect(await flushFeedbackOutbox()).toEqual([]);
    expect(sent().map((m) => m.message)).toEqual(["a", "b"]);
    expect(b).not.toBe(a);
  });
});
