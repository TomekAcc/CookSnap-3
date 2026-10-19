import React, { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ShoppingListModal from "./ShoppingListModal";
import { useCookAI } from "../context/CookAIContext";
import { MODAL, useModalState } from "../context/ModalContext";
import { EXIT_DURATION_MS } from "../utils/bottomSheet";
import { classifyPantryItemLocal } from "../services/geminiVision";
import { PLANNER_STORAGE_KEY, weeklyShoppingItemsFor } from "../utils/weeklyShopping";

const HANDOFF_MS = EXIT_DURATION_MS + 40;

/**
 * "What to buy this week": the shopping list built from the saved weekly plan
 * (the Meal Planner persists it). Opened from the planner through the shared
 * modal slot, so it survives the planner unmounting; closing it brings the
 * planner back. Ticking an item as bought puts it into the pantry (in stock).
 */
export default function WeeklyShoppingModal() {
  const { pantryItems, scannedIngredients, addPantryItem, t } = useCookAI();
  const { shoppingListOpen, setShoppingListOpen, openModalAfter } = useModalState();
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    if (!shoppingListOpen) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PLANNER_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        if (!cancelled) setPlan(parsed && typeof parsed === "object" ? parsed : {});
      } catch {
        if (!cancelled) setPlan({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shoppingListOpen]);

  const items = useMemo(
    () =>
      weeklyShoppingItemsFor({
        plan: plan || {},
        pantryItems,
        scannedIngredients,
        t,
        emojiFor: (name) => classifyPantryItemLocal(name)?.emoji,
      }),
    [plan, pantryItems, scannedIngredients, t]
  );

  const handleClose = () => {
    setShoppingListOpen(false);
    openModalAfter(MODAL.mealPlanner, HANDOFF_MS);
  };

  const handleBought = (item) => {
    const base = classifyPantryItemLocal(item.name);
    if (base) addPantryItem?.({ ...base, name: item.name });
  };

  return (
    <ShoppingListModal
      // Wait for the saved plan so the sheet never flashes "your list is clear".
      visible={!!shoppingListOpen && plan !== null}
      onClose={handleClose}
      items={items}
      onRestockItem={handleBought}
    />
  );
}
