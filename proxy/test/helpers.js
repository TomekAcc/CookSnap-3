import { Limiter } from "../src/limiter.js";
import { Inbox } from "../src/inbox.js";

/** In-memory stand-in for Durable Object storage. */
class FakeStorage {
  constructor() {
    this.map = new Map();
  }
  async get(key) {
    return this.map.get(key);
  }
  async put(entries, value) {
    if (typeof entries === "string") this.map.set(entries, value);
    else for (const [k, v] of Object.entries(entries)) this.map.set(k, v);
  }
  async list({ prefix }) {
    return new Map([...this.map].filter(([k]) => k.startsWith(prefix)));
  }
  async delete(keys) {
    for (const k of keys) this.map.delete(k);
  }
}

export const ADMIN = "a-long-random-admin-token-for-tests-1234567890";

export function makeEnv(overrides = {}) {
  const limiter = new Limiter({ storage: new FakeStorage() });
  const inbox = new Inbox({ storage: new FakeStorage() });
  return {
    GEMINI_API_KEY: "REAL-SECRET-KEY",
    DEVICE_DAILY_LIMIT: "3",
    GLOBAL_DAILY_LIMIT: "5",
    PROXY_DISABLED: "0",
    LIMITER: { idFromName: () => "main", get: () => ({ fetch: (url, init) => limiter.fetch(new Request(url, init)) }) },
    INBOX: { idFromName: () => "main", get: () => ({ fetch: (url, init) => inbox.fetch(new Request(url, init)) }) },
    ADMIN_TOKEN: ADMIN,
    FEEDBACK_DEVICE_DAILY_LIMIT: "2",
    FEEDBACK_GLOBAL_DAILY_LIMIT: "3",
    ...overrides,
  };
}

export const DEVICE = "0123456789abcdef0123456789abcdef";

export const goodBody = () => ({
  contents: [{ parts: [{ text: "hello" }] }],
  generationConfig: { temperature: 0.1, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
});

export function request(path, { method = "POST", body = goodBody(), headers = {} } = {}) {
  return new Request(`https://proxy.test${path}`, {
    method,
    headers: { "Content-Type": "application/json", "X-Device-Id": DEVICE, ...headers },
    body: method === "POST" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });
}

/** Records what the proxy sent upstream and answers like Gemini. */
export function fakeUpstream(reply = { candidates: [{ content: { parts: [{ text: "[]" }] } }] }, status = 200) {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(reply), { status, headers: { "Content-Type": "application/json" } });
  };
  return { fetch: fetchFn, calls };
}

export const PATH = "/v1beta/models/gemini-flash-latest:generateContent";

export const goodFeedback = () => ({
  kind: "bug",
  message: "The scan keeps spinning",
  contact: "me@example.com",
  appVersion: "1.0.0",
  platform: "ios",
  language: "en",
});
