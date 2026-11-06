import React, { createContext, useCallback, useContext, useMemo } from "react";
import { STORAGE_KEYS } from "../storage/keys";
import { booleanCodec } from "../storage/codecs";
import { usePersistedState } from "../hooks/usePersistedState";
import { useFreeTierCap } from "../hooks/useFreeTierCap";
import {
  FREE_DAILY_FRIDGE_SCANS,
  FREE_DAILY_PANTRY_SCANS,
  FREE_DAILY_RECIPE_GENERATIONS,
  PRO_DAILY_FRIDGE_SCANS,
  PRO_DAILY_PANTRY_SCANS,
  PRO_DAILY_RECIPE_GENERATIONS,
  PRO_DAILY_RECIPE_MODIFICATIONS,
} from "../constants/limits";

const EntitlementsContext = createContext(null);

/** Whether the user is PRO, and the free tier's daily limits. */
export function EntitlementsProvider({ children }) {
  // ─── PRO entitlement (LOCAL MOCK — no real payment processor wired up) ───
  // `isPro` here is a locally-persisted flag flipped by activatePro(), which
  // ProSubscriptionModal's "Start Free Trial" button calls directly. There
  // is no RevenueCat / StoreKit / Play Billing integration — hooking up a
  // real payment SDK requires App Store Connect product IDs and API
  // credentials that live outside this codebase. activatePro() is the exact
  // spot a real `Purchases.purchasePackage(...)` call would replace this.
  const [isPro, setIsPro, proHydrated] = usePersistedState(STORAGE_KEYS.isPro, {
    initial: false,
    codec: booleanCodec,
  });

  /** Mock trial activation — see the PRO entitlement note above. */
  const activatePro = useCallback(() => {
    setIsPro(true);
  }, [setIsPro]);

  /**
   * Testing-only reset — there's no real subscription to cancel yet (see
   * the PRO entitlement note above), so once a device flips isPro on via
   * activatePro() there was previously no way back to reviewing the free
   * tier short of clearing app storage entirely. Exposed via a clearly
   * "testing" toggle in Settings, not framed as real subscription
   * management.
   */
  const deactivatePro = useCallback(() => {
    setIsPro(false);
  }, [setIsPro]);

  // ─── Daily free-tier caps (fridge scans, pantry scans, recipe generations) ───
  // Each is `limit` uses per local day for free users, unlimited for PRO — see
  // useFreeTierCap. register*() is called right before the action: it returns
  // false (and does not count) when the cap is already hit, and the caller shows
  // the paywall instead of proceeding.
  //
  // Pantry scans deliberately share the fridge scans' limit: both hit
  // gemini-3.7-flash, the pricier vision model. They used to be free and
  // unlimited by product direction; that was reversed after confirming it left
  // the most expensive call in the app reachable with no cap and no PRO gate at
  // all — a real, unbounded cost exposure, not just a monetization gap.
  // Generations count the initial "Generate AI Recipes" and every "Regenerate"
  // tap equally — see FREE_DAILY_RECIPE_GENERATIONS for why this is the cap
  // that actually matters.
  const fridgeScanCap = useFreeTierCap(STORAGE_KEYS.dailyFridgeScans, FREE_DAILY_FRIDGE_SCANS, isPro, PRO_DAILY_FRIDGE_SCANS, STORAGE_KEYS.freeSampleFridgeScans);
  const pantryScanCap = useFreeTierCap(STORAGE_KEYS.dailyPantryScans, FREE_DAILY_PANTRY_SCANS, isPro, PRO_DAILY_PANTRY_SCANS, STORAGE_KEYS.freeSamplePantryScans);
  const generationCap = useFreeTierCap(
    STORAGE_KEYS.dailyRecipeGenerations,
    FREE_DAILY_RECIPE_GENERATIONS,
    isPro,
    PRO_DAILY_RECIPE_GENERATIONS,
    STORAGE_KEYS.freeSampleRecipeGenerations
  );
  // "Modify with AI" is a PRO feature, so a free user never gets to use it: only the PRO limit applies.
  const modifyCap = useFreeTierCap(STORAGE_KEYS.dailyRecipeModifications, 0, isPro, PRO_DAILY_RECIPE_MODIFICATIONS);
  const dailyFridgeScanCount = fridgeScanCap.count;
  const canScanFridge = fridgeScanCap.canUse;
  const registerFridgeScanAttempt = fridgeScanCap.register;
  const dailyPantryScanCount = pantryScanCap.count;
  const canScanPantry = pantryScanCap.canUse;
  const registerPantryScanAttempt = pantryScanCap.register;
  const dailyRecipeGenerationCount = generationCap.count;
  const canGenerateRecipes = generationCap.canUse;
  const registerRecipeGenerationAttempt = generationCap.register;
  const registerRecipeModifyAttempt = modifyCap.register;
  const value = useMemo(
    () => ({
      isPro,
      proHydrated,
      activatePro,
      deactivatePro,
      dailyFridgeScanCount,
      freeDailyFridgeScans: FREE_DAILY_FRIDGE_SCANS,
      canScanFridge,
      registerFridgeScanAttempt,
      dailyPantryScanCount,
      freeDailyPantryScans: FREE_DAILY_PANTRY_SCANS,
      canScanPantry,
      registerPantryScanAttempt,
      dailyRecipeGenerationCount,
      freeDailyRecipeGenerations: FREE_DAILY_RECIPE_GENERATIONS,
      // The limit that applies to this person today: the free one, or the larger PRO one.
      dailyRecipeGenerationLimit: generationCap.limit,
      // True while the person is on the one-time free sample (not PRO): the counts above are totals since install.
      onFreeSample: generationCap.isSample,
      canGenerateRecipes,
      registerRecipeGenerationAttempt,
      registerRecipeModifyAttempt,
    }),
    [isPro, proHydrated, activatePro, deactivatePro, dailyFridgeScanCount, canScanFridge, registerFridgeScanAttempt, dailyPantryScanCount, canScanPantry, registerPantryScanAttempt, dailyRecipeGenerationCount, canGenerateRecipes, registerRecipeGenerationAttempt, registerRecipeModifyAttempt, generationCap.limit, generationCap.isSample]
  );

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function useEntitlements() {
  const ctx = useContext(EntitlementsContext);
  if (!ctx) throw new Error("useEntitlements must be used within EntitlementsProvider");
  return ctx;
}
