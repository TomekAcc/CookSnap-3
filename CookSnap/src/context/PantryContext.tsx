import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ingredient, ShoppingListItem, StockStatus } from "@/types";
import { PANTRY_STAPLES } from "@/constants/pantryStaples";

const STORAGE_KEY = "cooksnap.pantry.v1";

interface PantryContextValue {
  ingredients: Ingredient[];
  isLoaded: boolean;
  addScannedIngredients: (items: Ingredient[]) => void;
  toggleStock: (id: string) => void;
  setStock: (id: string, status: StockStatus) => void;
  removeIngredient: (id: string) => void;
  shoppingList: ShoppingListItem[];
}

const PantryContext = createContext<PantryContextValue | undefined>(undefined);

function seedStaples(): Ingredient[] {
  const now = Date.now();
  return PANTRY_STAPLES.map((staple, index) => ({
    ...staple,
    id: `staple-${index}`,
    addedAt: now,
  }));
}

export function PantryProvider({ children }: { children: React.ReactNode }) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setIngredients(JSON.parse(stored));
        } else {
          setIngredients(seedStaples());
        }
      } catch {
        setIngredients(seedStaples());
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ingredients)).catch(() => {});
    }
  }, [ingredients, isLoaded]);

  const addScannedIngredients = useCallback((items: Ingredient[]) => {
    setIngredients((prev) => {
      const existingNames = new Set(prev.map((i) => i.name.toLowerCase()));
      const fresh = items.filter((item) => !existingNames.has(item.name.toLowerCase()));
      return [...prev, ...fresh];
    });
  }, []);

  const toggleStock = useCallback((id: string) => {
    setIngredients((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status: item.status === "in_stock" ? "out_of_stock" : "in_stock" }
          : item
      )
    );
  }, []);

  const setStock = useCallback((id: string, status: StockStatus) => {
    setIngredients((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
  }, []);

  const removeIngredient = useCallback((id: string) => {
    setIngredients((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const shoppingList = useMemo<ShoppingListItem[]>(
    () =>
      ingredients
        .filter((item) => item.status === "out_of_stock")
        .map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          checked: false,
        })),
    [ingredients]
  );

  const value = useMemo(
    () => ({
      ingredients,
      isLoaded,
      addScannedIngredients,
      toggleStock,
      setStock,
      removeIngredient,
      shoppingList,
    }),
    [ingredients, isLoaded, addScannedIngredients, toggleStock, setStock, removeIngredient, shoppingList]
  );

  return <PantryContext.Provider value={value}>{children}</PantryContext.Provider>;
}

export function usePantry() {
  const ctx = useContext(PantryContext);
  if (!ctx) throw new Error("usePantry must be used within a PantryProvider");
  return ctx;
}
