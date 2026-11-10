import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const NavigationContext = createContext(null);

/**
 * Which tab is showing, and the Scanner screen's scroll position bookkeeping
 * (used to scroll to the recipes when they appear).
 */
export function NavigationProvider({ children }) {
  const [activeTab, setActiveTab] = useState("scanner");
  const scrollViewRef = useRef(null);
  const recipesSectionYRef = useRef(0);
  const [recipesSectionY, setRecipesSectionY] = useState(0);

  const updateRecipesSectionY = useCallback((y) => {
    const next = typeof y === "number" && Number.isFinite(y) ? y : 0;
    recipesSectionYRef.current = next;
    setRecipesSectionY(next);
  }, []);

  /** Scroll so the recipes header sits just under the top edge (12px breathing room).
   *
   * Previously tried measureLayout() against a ref to the RecipeFeed
   * wrapper for a "can't go stale" measurement, but that throws
   * synchronously ("ref.measureLayout must be called with a ref to a
   * native component") on this View — confirmed by a live crash report —
   * rather than falling through to the failure callback, so there was no
   * safe way to catch it. Back to the plain onLayout-cached Y, which is
   * the version that was actually working. */
  const scrollToRecipesTop = useCallback(() => {
    const scroll = () => {
      const y = Math.max((recipesSectionYRef.current || 0) - 12, 0);
      scrollViewRef.current?.scrollTo?.({ y, animated: true });
    };
    // First pass after commit; second after recipe cards finish laying out.
    requestAnimationFrame(() => {
      setTimeout(scroll, 80);
      setTimeout(scroll, 280);
    });
  }, []);
  const value = useMemo(
    () => ({
      activeTab,
      setActiveTab,
      scrollViewRef,
      recipesSectionY,
      setRecipesSectionY: updateRecipesSectionY,
      scrollToRecipesTop,
    }),
    [activeTab, setActiveTab, scrollViewRef, recipesSectionY, updateRecipesSectionY, scrollToRecipesTop]
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error("useNavigation must be used within NavigationProvider");
  return ctx;
}
