import { disclaimerUrl, legalLinksLive, privacyPolicyUrl, termsUrl } from "../src/constants/legal";

const KEYS = ["EXPO_PUBLIC_LEGAL_LIVE", "EXPO_PUBLIC_LEGAL_BASE_URL", "EXPO_PUBLIC_GEMINI_PROXY_URL"];
const saved = {};
beforeEach(() => KEYS.forEach((k) => { saved[k] = process.env[k]; delete process.env[k]; }));
afterEach(() => KEYS.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]))));

describe("legal links", () => {
  test("hidden unless explicitly switched on", () => {
    process.env.EXPO_PUBLIC_GEMINI_PROXY_URL = "https://p.example";
    expect(legalLinksLive()).toBe(false);
    process.env.EXPO_PUBLIC_LEGAL_LIVE = "0";
    expect(legalLinksLive()).toBe(false);
    process.env.EXPO_PUBLIC_LEGAL_LIVE = "1";
    expect(legalLinksLive()).toBe(true);
  });

  test("hidden when there is no server to point at", () => {
    process.env.EXPO_PUBLIC_LEGAL_LIVE = "1";
    expect(legalLinksLive()).toBe(false);
  });

  test("Polish gets /pl pages, everything else the English ones", () => {
    process.env.EXPO_PUBLIC_GEMINI_PROXY_URL = "https://p.example";
    expect(privacyPolicyUrl("pl")).toBe("https://p.example/pl/privacy");
    expect(termsUrl("pl")).toBe("https://p.example/pl/terms");
    expect(disclaimerUrl("pl")).toBe("https://p.example/pl/disclaimer");
    expect(privacyPolicyUrl("en")).toBe("https://p.example/privacy");
    expect(termsUrl("de")).toBe("https://p.example/terms");
    expect(disclaimerUrl("en")).toBe("https://p.example/disclaimer");
  });

  test("the base address can be replaced without touching the code", () => {
    process.env.EXPO_PUBLIC_GEMINI_PROXY_URL = "https://p.example";
    process.env.EXPO_PUBLIC_LEGAL_BASE_URL = "https://cooksnap.app/legal/";
    process.env.EXPO_PUBLIC_LEGAL_LIVE = "1";
    expect(legalLinksLive()).toBe(true);
    expect(termsUrl("pl")).toBe("https://cooksnap.app/legal/pl/terms");
  });
});
