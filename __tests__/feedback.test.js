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
