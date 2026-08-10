import React, { createContext, useContext, useMemo, useState, useCallback } from "react";
import { Recipe } from "@/types";
import { generateRecipes } from "@/services/recipeService";
import { usePantry } from "./PantryContext";

interface RecipeContextValue {
  recipes: Recipe[];
  isGenerating: boolean;
  error: string | null;
  refreshRecipes: () => Promise<void>;
}

const RecipeContext = createContext<RecipeContextValue | undefined>(undefined);

export function RecipeProvider({ children }: { children: React.ReactNode }) {
  const { ingredients } = usePantry();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshRecipes = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const result = await generateRecipes(ingredients);
      setRecipes(result);
    } catch (e) {
      setError("Couldn't generate recipes right now. Try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [ingredients]);

  const value = useMemo(
    () => ({ recipes, isGenerating, error, refreshRecipes }),
    [recipes, isGenerating, error, refreshRecipes]
  );

  return <RecipeContext.Provider value={value}>{children}</RecipeContext.Provider>;
}

export function useRecipes() {
  const ctx = useContext(RecipeContext);
  if (!ctx) throw new Error("useRecipes must be used within a RecipeProvider");
  return ctx;
}
