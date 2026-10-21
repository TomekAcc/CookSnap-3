import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { classifyPantryItemLocal, translateIngredientNames } from "../services/geminiVision";
import { STORAGE_KEYS } from "../storage/keys";
import { arrayCodec } from "../storage/codecs";
import { appendFeedbackLog } from "../storage/feedbackLog";
import { usePersistedState } from "../hooks/usePersistedState";
import { mergeUniqueIngredients, normalizePantryName } from "../utils/ingredients";
import { log } from "../utils/log";
import { useModalState } from "./ModalContext";
import { useLanguage } from "./LanguageContext";

const InventoryContext = createContext(null);

/**
 * What the user has: the fridge ingredients (from scans and manual adds) and the pantry
 * staples. Also owns the "the sample scan is showing" flag, because that is what keeps
 * the onboarding sample list from ever being saved over the user's real ingredients.
 */
export function InventoryProvider({ children }) {
  const { setAddIngredientOpen } = useModalState();
  const { recipeLanguageId, recipeLanguageName, recipeLanguageHydrated } = useLanguage();
  // True while the onboarding sample scan is on screen. Its photo is a bundled
  // asset whose path changes between updates and its list is not the user's
  // fridge, so neither is ever written to storage (see shouldPersist below).
  const scanIsDemoRef = useRef(false);
  const [ingredients, setIngredients, ingredientsHydrated] = usePersistedState(STORAGE_KEYS.ingredients, {
    initial: [],
    codec: arrayCodec,
    shouldPersist: () => !scanIsDemoRef.current,
  });

  // Pantry starts empty: no seeded staples for a brand-new user.
  const [pantryItems, setPantryItems, pantryHydrated] = usePersistedState(STORAGE_KEYS.pantryItems, {
    initial: [],
    codec: arrayCodec,
  });

  // True while the onboarding sample fridge is on screen (see completeDemoScan).
  // Its photo and list are never persisted, and a real scan replaces them.
  const [scanIsDemo, setScanIsDemo] = useState(false);
  const markScanDemo = useCallback((on) => {
    scanIsDemoRef.current = on;
    setScanIsDemo(on);
  }, []);

  // Removing a vision-detected ingredient (as opposed to one the user typed
  // in themselves via AddIngredientModal) is the user telling us the scan
  // got it wrong — the same "wasn't actually there" signal
  // docs/IMPLEMENTATION_ROADMAP.md #7 asks for, without adding a second tap
  // target next to the X button that already does this.
  const removeIngredient = useCallback((id) => {
    setIngredients((prev) => {
      const removed = prev.find((i) => i.id === id);
      if (removed?.source === "scan") {
        appendFeedbackLog({ type: "scanIngredientFlagged", name: removed.name });
      }
      return prev.filter((i) => i.id !== id);
    });
  }, [setIngredients]);

  const addIngredient = useCallback((item) => {
    setIngredients((prev) =>
      mergeUniqueIngredients(prev, [{ ...item, source: "manual" }])
    );
    setAddIngredientOpen(false);
  }, [setAddIngredientOpen, setIngredients]);

  /** Merge new vision items — append only, never overwrite; de-dupe by name. */
  const appendIngredients = useCallback((newItems) => {
    const incoming = Array.isArray(newItems) ? newItems : [];
    if (!incoming.length) return;
    setIngredients((prev) =>
      mergeUniqueIngredients(prev, incoming.map((i) => ({ ...i, source: "scan" })))
    );
  }, [setIngredients]);

  const togglePantryItem = useCallback((id) => {
    setPantryItems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, inStock: !p.inStock } : p))
    );
  }, [setPantryItems]);

  const addPantryItem = useCallback((rawNameOrItem) => {
    const item =
      typeof rawNameOrItem === "string"
        ? classifyPantryItemLocal(rawNameOrItem)
        : rawNameOrItem;
    if (!item?.name) return null;

    setPantryItems((prev) => {
      const existing = prev.find(
        (p) => normalizePantryName(p.name) === normalizePantryName(item.name)
      );
      if (existing) {
        return prev.map((p) =>
          p.id === existing.id ? { ...p, inStock: true } : p
        );
      }
      return [{ ...item, inStock: true }, ...prev];
    });
    return item;
  }, [setPantryItems]);

  const removePantryItem = useCallback((id) => {
    if (!id) return;
    setPantryItems((prev) => prev.filter((item) => item.id !== id));
  }, [setPantryItems]);

  // Lets the user correct a recipe ingredient the generator just assumed
  // (salt/pepper/cooking oil — see BASIC_STAPLES in geminiRecipes.js)
  // without leaving the recipe screen: one atomic update that either flips
  // an existing Pantry entry to out-of-stock or creates one already marked
  // that way, rather than addPantryItem (always forces inStock: true) +
  // togglePantryItem (needs the real stored id, which addPantryItem's
  // return value doesn't reliably have for an already-existing item — its
  // id comes from a fresh classifyPantryItemLocal() call, not the matched
  // entry). Two separate calls would also leave a render in between where
  // the item still reads as in-stock.
  const markPantryItemOutOfStock = useCallback((rawName) => {
    const name = String(rawName || "").trim();
    if (!name) return;
    setPantryItems((prev) => {
      const existing = prev.find(
        (p) => normalizePantryName(p.name) === normalizePantryName(name)
      );
      if (existing) {
        return prev.map((p) =>
          p.id === existing.id ? { ...p, inStock: false } : p
        );
      }
      const classified = classifyPantryItemLocal(name);
      if (!classified?.name) return prev;
      return [{ ...classified, inStock: false }, ...prev];
    });
  }, [setPantryItems]);

  const clearPantry = useCallback(() => {
    setPantryItems([]);
  }, [setPantryItems]);

  /**
   * Append ingredient names to the Shopping List.
   * The list is derived from out-of-stock pantry items, so each name is either
   * marked out-of-stock (existing staple) or added as a new out-of-stock item.
   * Names already on the list are skipped. Returns how many were added.
   */
  const addToShoppingList = useCallback(
    (names = []) => {
      // One entry per pantry name: "Flour" and "flour " are the same item, and
      // must not become two rows when a recipe lists both.
      const byKey = new Map();
      for (const raw of Array.isArray(names) ? names : []) {
        const name = String(raw || "").trim();
        if (name && !byKey.has(normalizePantryName(name))) byKey.set(normalizePantryName(name), name);
      }
      const clean = [...byKey.values()];
      if (clean.length === 0) return 0;

      // Plan changes against current state so the count is reliable —
      // setState updaters may run deferred, so counting inside one is unsafe.
      const markOutOfStock = [];
      const newItems = [];
      for (const name of clean) {
        const existing = pantryItems.find(
          (p) => normalizePantryName(p.name) === normalizePantryName(name)
        );
        if (existing) {
          // Already out of stock → already on the list, skip
          if (existing.inStock) markOutOfStock.push(existing.id);
        } else {
          const item = classifyPantryItemLocal(name);
          if (item?.name) newItems.push({ ...item, inStock: false });
        }
      }

      if (markOutOfStock.length > 0 || newItems.length > 0) {
        setPantryItems((prev) => [
          ...newItems,
          ...prev.map((p) =>
            markOutOfStock.includes(p.id) ? { ...p, inStock: false } : p
          ),
        ]);
      }
      return markOutOfStock.length + newItems.length;
    },
    [pantryItems, setPantryItems]
  );

  const mergePantryScanResults = useCallback((detected = []) => {
    if (!Array.isArray(detected) || detected.length === 0) return 0;
    setPantryItems((prev) => {
      const next = [...prev];
      for (const item of detected) {
        if (!item?.name) continue;
        const idx = next.findIndex(
          (p) => normalizePantryName(p.name) === normalizePantryName(item.name)
        );
        if (idx >= 0) {
          // Also refresh the icon from this fresh detection — same
          // reasoning as the fridge scan's Smart Append: a rescan
          // re-photographs the same item, so its new icon self-heals
          // anything stored with a worse icon from an earlier scan.
          const freshIcon =
            (typeof item.icon === "string" && item.icon.trim()) ||
            (typeof item.emoji === "string" && item.emoji.trim());
          next[idx] = {
            ...next[idx],
            inStock: true,
            ...(freshIcon ? { icon: freshIcon, emoji: freshIcon } : null),
          };
        } else {
          next.unshift({ ...item, inStock: true });
        }
      }
      return next;
    });
    return detected.length;
  }, [setPantryItems]);

  // Auto-translates already-scanned fridge/pantry item names when the
  // language actually changes (not on first mount/hydration) — these are
  // free-text AI-detected names with no translation-key system of their
  // own, unlike the rest of the UI driven by t(), so switching the app
  // language alone doesn't touch them; without this they'd silently stay
  // in whatever language they were first scanned in forever. Fire-and-
  // forget: never blocks the switch itself, and any failure just leaves
  // the names as they were.
  const inventoryLangTrackerRef = useRef(null);
  useEffect(() => {
    if (!recipeLanguageHydrated || !ingredientsHydrated || !pantryHydrated) return;
    if (inventoryLangTrackerRef.current === null) {
      // First render after everything's hydrated — this already IS the
      // language the current inventory was captured in (or close enough);
      // just record it, don't fire a translate pass on mount.
      inventoryLangTrackerRef.current = recipeLanguageId;
      return;
    }
    if (inventoryLangTrackerRef.current === recipeLanguageId) return;
    inventoryLangTrackerRef.current = recipeLanguageId;

    let cancelled = false;
    (async () => {
      if (ingredients.length > 0) {
        try {
          const translated = await translateIngredientNames(ingredients, recipeLanguageName);
          if (!cancelled) setIngredients(translated);
        } catch (err) {
          log.warn("[Cook AI] Fridge inventory auto-translate failed:", err?.message);
        }
      }
      if (pantryItems.length > 0) {
        try {
          const translated = await translateIngredientNames(pantryItems, recipeLanguageName);
          if (!cancelled) setPantryItems(translated);
        } catch (err) {
          log.warn("[Cook AI] Pantry auto-translate failed:", err?.message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately keyed only on the language + hydration flags — ingredients/
    // pantryItems are read from the closure at switch time, not tracked as
    // triggers, so this never re-fires just because the inventory itself changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeLanguageId, recipeLanguageHydrated, ingredientsHydrated, pantryHydrated, recipeLanguageName]);
  const value = useMemo(
    () => ({
      ingredients,
      scannedIngredients: ingredients,
      setIngredients,
      removeIngredient,
      addIngredient,
      appendIngredients,
      pantryItems,
      togglePantryItem,
      addPantryItem,
      removePantryItem,
      markPantryItemOutOfStock,
      clearPantry,
      addToShoppingList,
      mergePantryScanResults,
      scanIsDemo,
      markScanDemo,
      scanIsDemoRef,
    }),
    [ingredients, setIngredients, removeIngredient, addIngredient, appendIngredients, pantryItems, togglePantryItem, addPantryItem, removePantryItem, markPantryItemOutOfStock, clearPantry, addToShoppingList, mergePantryScanResults, scanIsDemo, markScanDemo, scanIsDemoRef]
  );

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error("useInventory must be used within InventoryProvider");
  return ctx;
}
