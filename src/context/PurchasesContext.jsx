import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { createProvider, subscriptionManagementUrl } from "../services/purchases";
import { FALLBACK_PRICES } from "../services/purchases/catalog";
import { useEntitlements } from "./EntitlementsContext";
import { log } from "../utils/log";

const PurchasesContext = createContext(null);

/**
 * Buying, restoring and keeping PRO in step with the store. The provider (RevenueCat in a real build, a stand-in in
 * Expo Go) is chosen once; this context turns its answers into `isPro` and tells the paywall what to show. Logic only,
 * no UI (so the providers can be used in tests without the animation libraries).
 */
export function PurchasesProvider({ children, provider: injected }) {
  const { isPro, proHydrated, activatePro, deactivatePro } = useEntitlements();
  const provider = useMemo(() => injected || createProvider(), [injected]);
  const [offerings, setOfferings] = useState(FALLBACK_PRICES);
  const [busy, setBusy] = useState(null); // "purchase" | "restore" | null
  const busyRef = useRef(null);
  // The provider must be configured once before anything else is asked of it.
  const readyRef = useRef(null);
  if (!readyRef.current || readyRef.current.provider !== provider) {
    readyRef.current = { provider, promise: Promise.resolve().then(() => provider.init()) };
  }
  const proRef = useRef(isPro);
  proRef.current = isPro;

  // Real provider: the store decides who is PRO, so a lapsed or cancelled subscription turns PRO off at the next check.
  const syncFromStore = useCallback(async () => {
    if (!provider.isReal) return;
    try {
      await readyRef.current.promise;
      const { isPro: active } = await provider.getStatus();
      if (active && !proRef.current) activatePro();
      if (!active && proRef.current) deactivatePro();
    } catch (err) {
      log.warn("[CookSnap] Could not read the subscription status:", err?.message);
    }
  }, [provider, activatePro, deactivatePro]);

  // Only once the saved PRO flag has been read, otherwise "the store says no" would race the flag still loading.
  useEffect(() => {
    if (proHydrated) syncFromStore();
  }, [proHydrated, syncFromStore]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await readyRef.current.promise;
        const prices = await provider.getOfferings();
        if (!cancelled) setOfferings(prices);
      } catch (err) {
        log.warn("[CookSnap] Payments are not available:", err?.message);
      }
    })();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") syncFromStore();
    });
    return () => {
      cancelled = true;
      sub?.remove?.();
    };
  }, [provider, syncFromStore]);

  const run = useCallback(
    async (kind, action, okStatuses) => {
      if (busyRef.current) return { status: "busy" };
      busyRef.current = kind;
      setBusy(kind);
      try {
        const result = await action();
        if (okStatuses.includes(result.status)) activatePro();
        return result;
      } catch (err) {
        log.warn(`[CookSnap] ${kind} failed:`, err?.message);
        return { status: "error", message: err?.message };
      } finally {
        busyRef.current = null;
        setBusy(null);
      }
    },
    [activatePro]
  );

  const purchase = useCallback((planId) => run("purchase", () => provider.purchase(planId), ["success"]), [run, provider]);
  const restore = useCallback(() => run("restore", () => provider.restore(), ["restored"]), [run, provider]);

  const value = useMemo(
    () => ({ offerings, busy, isRealStore: !!provider.isReal, purchase, restore, manageUrl: provider.isReal ? subscriptionManagementUrl() : "" }),
    [offerings, busy, provider, purchase, restore]
  );
  return <PurchasesContext.Provider value={value}>{children}</PurchasesContext.Provider>;
}

export function usePurchases() {
  const ctx = useContext(PurchasesContext);
  if (!ctx) throw new Error("usePurchases must be used inside PurchasesProvider");
  return ctx;
}
