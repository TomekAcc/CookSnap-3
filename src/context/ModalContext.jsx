import React, { createContext, useContext, useState, useMemo, useCallback, useRef } from "react";
import { stampRecipeEmojis } from "../utils/imageUtils";

const ModalContext = createContext(null);

/**
 * ── Centralized Modal Manager ─────────────────────────────────────────
 * Registry of every named overlay in the app. Exactly one can be active
 * at a time: opening one atomically replaces the previous, so two native
 * Modals can never race present/dismiss events (the iOS deadlock), and
 * Header suppression keys off a single boolean.
 */
export const MODAL = Object.freeze({
  addIngredient: "addIngredient",
  pro: "pro",
  scanHistory: "scanHistory",
  mealPlanner: "mealPlanner",
  help: "help",
  shoppingList: "shoppingList",
  pantryAdd: "pantryAdd",
  pantryScan: "pantryScan",
  scanMore: "scanMore",
});

function enrichRecipe(recipe) {
  try {
    const [stamped] = stampRecipeEmojis([recipe].filter(Boolean));
    return stamped || recipe;
  } catch (err) {
    console.warn("[Cook AI] enrichRecipe (modal) failed:", err?.message);
    return recipe;
  }
}

/**
 * Modal open/close state, deliberately isolated from CookAIContext.
 *
 * Every modal trigger used to write into CookAIContext's single giant
 * memoized value, which re-renders every useCookAI() consumer app-wide
 * (every tab, every screen) in the same commit a native <Modal> tries to
 * present. Direct on-device testing confirmed that collision — not the
 * Modal component itself — was what silently broke presentation: the exact
 * same modal worked when its open flag lived in plain local state, and
 * broke the instant it touched CookAIContext, regardless of timing.
 * Keeping modal state in its own context means opening one only re-renders
 * the handful of components that actually read this context, not the
 * whole app.
 */
export function ModalProvider({ children }) {
  const [activeModalId, setActiveModalId] = useState(null);
  /** Lives in context so an unmounting overlay can't cancel a pending timeout. */
  const modalHandoffTimerRef = useRef(null);

  const openModal = useCallback((name) => {
    if (modalHandoffTimerRef.current) {
      clearTimeout(modalHandoffTimerRef.current);
      modalHandoffTimerRef.current = null;
    }
    // Atomic: one modal slot only — never stack / never loop
    setActiveModalId(name || null);
  }, []);

  const closeModal = useCallback(() => {
    if (modalHandoffTimerRef.current) {
      clearTimeout(modalHandoffTimerRef.current);
      modalHandoffTimerRef.current = null;
    }
    setActiveModalId(null);
  }, []);

  /** Alias matching master-prompt naming */
  const setActiveModal = openModal;

  // Boolean setters bound to one modal each. Closing only releases its own
  // slot, so a stale onClose can never dismiss a different, newer modal.
  const modalSetters = useMemo(() => {
    const bind = (name) => (open) =>
      setActiveModalId((prev) => {
        const next = typeof open === "function" ? open(prev === name) : open;
        if (next) return name;
        return prev === name ? null : prev;
      });
    return {
      setAddIngredientOpen: bind(MODAL.addIngredient),
      setProModalOpen: bind(MODAL.pro),
      setScanHistoryOpen: bind(MODAL.scanHistory),
      setMealPlannerOpen: bind(MODAL.mealPlanner),
      setHelpModalOpen: bind(MODAL.help),
      setShoppingListOpen: bind(MODAL.shoppingList),
      setPantryAddOpen: bind(MODAL.pantryAdd),
      setPantryScanOpen: bind(MODAL.pantryScan),
      setScanMoreOpen: bind(MODAL.scanMore),
    };
  }, []);
  const {
    setAddIngredientOpen,
    setProModalOpen,
    setScanHistoryOpen,
    setMealPlannerOpen,
    setHelpModalOpen,
    setShoppingListOpen,
    setPantryAddOpen,
    setPantryScanOpen,
    setScanMoreOpen,
  } = modalSetters;

  const addIngredientOpen = activeModalId === MODAL.addIngredient;
  const proModalOpen = activeModalId === MODAL.pro;
  const scanHistoryOpen = activeModalId === MODAL.scanHistory;
  const mealPlannerOpen = activeModalId === MODAL.mealPlanner;
  const helpModalOpen = activeModalId === MODAL.help;
  const scanMoreOpen = activeModalId === MODAL.scanMore;
  const shoppingListOpen = activeModalId === MODAL.shoppingList;
  const pantryAddOpen = activeModalId === MODAL.pantryAdd;
  const pantryScanOpen = activeModalId === MODAL.pantryScan;

  const [selectedRecipe, setSelectedRecipeState] = useState(null);

  // Stamp dish-matched emoji badge metadata before opening the detail modal.
  const setSelectedRecipe = useCallback((recipe) => {
    if (!recipe) {
      setSelectedRecipeState(null);
      return;
    }
    try {
      // Close any named modal first so two native Modals never race
      setActiveModalId(null);
      setSelectedRecipeState(enrichRecipe(recipe));
    } catch (err) {
      console.warn("[Cook AI] setSelectedRecipe failed:", err?.message);
      setSelectedRecipeState(recipe);
    }
  }, []);

  /** Pantry / local sheets — prefer begin/endSheetOverlay for ref-counted dim state. */
  const [localSheetOpen, setLocalSheetOpen] = useState(false);
  const overlayDepthRef = useRef(0);
  const [overlayDepth, setOverlayDepth] = useState(0);

  const beginSheetOverlay = useCallback(() => {
    overlayDepthRef.current += 1;
    setOverlayDepth(overlayDepthRef.current);
  }, []);

  const endSheetOverlay = useCallback(() => {
    overlayDepthRef.current = Math.max(0, overlayDepthRef.current - 1);
    setOverlayDepth(overlayDepthRef.current);
  }, []);

  /**
   * Global modal presence flag — Header shadow absolute suppression keys off this.
   */
  const isSheetOverlayActive =
    activeModalId !== null ||
    overlayDepth > 0 ||
    localSheetOpen ||
    !!selectedRecipe;

  /** @deprecated Prefer isAnyModalOpen */
  const isModalOpen = isSheetOverlayActive;
  const isAnyModalOpen = isSheetOverlayActive;

  const value = useMemo(
    () => ({
      activeModalId,
      /** @deprecated Prefer activeModalId */
      activeModal: activeModalId,
      openModal,
      setActiveModal,
      closeModal,
      addIngredientOpen,
      setAddIngredientOpen,
      proModalOpen,
      setProModalOpen,
      scanHistoryOpen,
      setScanHistoryOpen,
      mealPlannerOpen,
      setMealPlannerOpen,
      helpModalOpen,
      setHelpModalOpen,
      scanMoreOpen,
      setScanMoreOpen,
      shoppingListOpen,
      setShoppingListOpen,
      pantryAddOpen,
      setPantryAddOpen,
      pantryScanOpen,
      setPantryScanOpen,
      selectedRecipe,
      setSelectedRecipe,
      localSheetOpen,
      setLocalSheetOpen,
      beginSheetOverlay,
      endSheetOverlay,
      isSheetOverlayActive,
      isModalOpen,
      isAnyModalOpen,
    }),
    [
      activeModalId,
      openModal,
      closeModal,
      addIngredientOpen,
      setAddIngredientOpen,
      proModalOpen,
      setProModalOpen,
      scanHistoryOpen,
      setScanHistoryOpen,
      mealPlannerOpen,
      setMealPlannerOpen,
      helpModalOpen,
      setHelpModalOpen,
      scanMoreOpen,
      setScanMoreOpen,
      shoppingListOpen,
      setShoppingListOpen,
      pantryAddOpen,
      setPantryAddOpen,
      pantryScanOpen,
      setPantryScanOpen,
      selectedRecipe,
      setSelectedRecipe,
      localSheetOpen,
      setLocalSheetOpen,
      beginSheetOverlay,
      endSheetOverlay,
      isSheetOverlayActive,
      isModalOpen,
      isAnyModalOpen,
    ]
  );

  return (
    <ModalContext.Provider value={value}>{children}</ModalContext.Provider>
  );
}

export function useModalState() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModalState must be used within ModalProvider");
  return ctx;
}
