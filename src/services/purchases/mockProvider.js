import { getItem, setItem } from "../../storage/storage";
import { STORAGE_KEYS } from "../../storage/keys";
import { FALLBACK_PRICES } from "./catalog";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const DAY = 24 * 60 * 60 * 1000;

/**
 * The stand-in for the stores while there is no App Store / Play Console / RevenueCat setup (Expo Go, development,
 * testing builds). It behaves like a provider, including a short wait and a remembered "subscription", so the whole
 * paywall flow can be tried. It never charges anyone, so it must never grant PRO in a build people download:
 * `allowFreeActivation` is false there, and a purchase answers "unavailable" instead.
 */
export function createMockProvider({ delayMs = 700, now = () => Date.now(), allowFreeActivation = true } = {}) {
  const read = async () => {
    try {
      const sub = JSON.parse((await getItem(STORAGE_KEYS.mockSubscription)) || "null");
      return sub && typeof sub.expiresAt === "number" ? sub : null;
    } catch {
      return null;
    }
  };
  return {
    kind: "mock",
    isReal: false,
    async init() {},
    async getOfferings() {
      return FALLBACK_PRICES;
    },
    async getStatus() {
      const sub = await read();
      return { isPro: !!sub && sub.expiresAt > now() };
    },
    async purchase(planId) {
      if (!allowFreeActivation) return { status: "unavailable" };
      await sleep(delayMs);
      const length = planId === "annual" ? 365 * DAY : 30 * DAY;
      await setItem(STORAGE_KEYS.mockSubscription, JSON.stringify({ planId, startedAt: now(), expiresAt: now() + length }));
      return { status: "success" };
    },
    async restore() {
      if (!allowFreeActivation) return { status: "unavailable" };
      await sleep(delayMs / 2);
      const sub = await read();
      return sub && sub.expiresAt > now() ? { status: "restored" } : { status: "none" };
    },
  };
}
