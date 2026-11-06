import React, { createContext, useCallback, useContext, useMemo } from "react";
import { RECIPES, FALLBACK_RECIPES } from "../data/recipes";
import { STORAGE_KEYS } from "../storage/keys";
import { arrayCodec } from "../storage/codecs";
import { usePersistedState } from "../hooks/usePersistedState";
import { enrichRecipes, safeStorageRead } from "../utils/recipeLists";

const LibraryContext = createContext(null);

/**
 * Saved recipes and favorites. `savedRecipes` carries the dish emoji badges; `savedRecipesRaw`
 * is the stored list, for code that must not depend on the badges.
 */
export function LibraryProvider({ children }) {
  // Favorites id list — dish #1 liked by default (🤍 → ❤️)
  const [favorites, setFavorites, favoritesHydrated] = usePersistedState(STORAGE_KEYS.favorites, {
    initial: [1],
    codec: arrayCodec,
  });
  // Seed Saved tab with recipe #1 so heart state matches favorites
  const [savedRecipes, setSavedRecipes, savedRecipesHydrated] = usePersistedState(STORAGE_KEYS.savedRecipes, {
    initial: () =>
      safeStorageRead(() => {
        const first = (RECIPES || FALLBACK_RECIPES || []).find(
          (r) => r && String(r.id) === "1"
        );
        return first ? enrichRecipes([first]) : [];
      }, []),
    codec: arrayCodec,
  });
  // Both lists load in the same batched read; the translation-on-language-change
  // effects below wait for this before they start watching.
  const savedHydrated = favoritesHydrated && savedRecipesHydrated;

  const toggleSaveRecipe = useCallback((recipe) => {
    if (!recipe || recipe.id == null) return;
    const idStr = String(recipe.id);

    setFavorites((prev) => {
      const has = (prev || []).some((id) => String(id) === idStr);
      return has
        ? (prev || []).filter((id) => String(id) !== idStr)
        : [...(prev || []), recipe.id];
    });

    setSavedRecipes((prev) => {
      try {
        const exists = prev.some((r) => String(r.id) === idStr);
        if (exists) return prev.filter((r) => String(r.id) !== idStr);
        const [enriched] = enrichRecipes([recipe]);
        return [...prev, enriched || recipe];
      } catch {
        return prev;
      }
    });
  }, [setFavorites, setSavedRecipes]);

  /** Toggle favorite by id — keeps favorites[] + savedRecipes in sync. */
  const toggleFavorite = useCallback((recipeId, source) => {
    if (recipeId == null) return;
    const idStr = String(recipeId);

    setFavorites((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return list.some((id) => String(id) === idStr)
        ? list.filter((id) => String(id) !== idStr)
        : [...list, recipeId];
    });

    setSavedRecipes((prev) => {
      try {
        const exists = prev.some((r) => String(r.id) === idStr);
        if (exists) return prev.filter((r) => String(r.id) !== idStr);

        const pool = [
          // The recipe being toggled, when the caller has it (a card on the recipe feed).
          ...(source ? [source] : []),
          ...(Array.isArray(RECIPES) ? RECIPES : []),
          ...(Array.isArray(FALLBACK_RECIPES) ? FALLBACK_RECIPES : []),
        ];
        const found = pool.find((r) => r && String(r.id) === idStr);
        if (!found) return prev;
        const [enriched] = enrichRecipes([found]);
        return [...prev, enriched || found];
      } catch {
        return prev;
      }
    });
  }, [setFavorites, setSavedRecipes]);

  // Re-stamp dish emoji badges on every render of the saved list.
  const savedRecipesWithImages = useMemo(() => {
    try {
      return enrichRecipes(savedRecipes);
    } catch {
      return Array.isArray(savedRecipes) ? savedRecipes : [];
    }
  }, [savedRecipes]);

  const isRecipeSaved = useCallback(
    (id) => {
      const idStr = String(id);
      if ((favorites || []).some((fav) => String(fav) === idStr)) return true;
      return savedRecipes.some((r) => String(r.id) === idStr);
    },
    [favorites, savedRecipes]
  );

  const savedCount = useMemo(() => {
    try {
      const fromFavorites = Array.isArray(favorites) ? favorites.length : 0;
      return Math.max(fromFavorites, Array.isArray(savedRecipes) ? savedRecipes.length : 0);
    } catch {
      return 0;
    }
  }, [favorites, savedRecipes]);

  /** Swap in an updated version of a saved recipe (matched by id) — after a translation or an AI edit. */
  const replaceSavedRecipe = useCallback(
    (updated) => {
      setSavedRecipes((prev) =>
        prev.map((r) => (String(r.id) === String(updated.id) ? updated : r))
      );
    },
    [setSavedRecipes]
  );

  const value = useMemo(
    () => ({
      favorites,
      savedRecipes: savedRecipesWithImages,
      savedRecipesRaw: savedRecipes,
      savedHydrated,
      savedCount,
      toggleFavorite,
      toggleSaveRecipe,
      isRecipeSaved,
      replaceSavedRecipe,
    }),
    [favorites, savedRecipesWithImages, savedRecipes, savedHydrated, savedCount, toggleFavorite, toggleSaveRecipe, isRecipeSaved, replaceSavedRecipe]
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}
