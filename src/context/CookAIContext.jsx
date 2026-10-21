import React, { useMemo } from "react";
import { showToast, hideToast } from "../utils/toast";
import { NavigationProvider, useNavigation } from "./NavigationContext";
import { OnboardingProvider, useOnboarding } from "./OnboardingContext";
import { LanguageProvider, useLanguage, useTranslation } from "./LanguageContext";
import { EntitlementsProvider, useEntitlements } from "./EntitlementsContext";
import { PreferencesProvider, usePreferences } from "./PreferencesContext";
import { LibraryProvider, useLibrary } from "./LibraryContext";
import { InventoryProvider, useInventory } from "./InventoryContext";
import { RecipesProvider, useRecipes } from "./RecipesContext";
import { ScanProvider, useScan } from "./ScanContext";

/**
 * Every provider, outermost first. Each domain only depends on the ones above it:
 * navigation / onboarding flags / language, then entitlements (PRO + limits), preferences,
 * library (saved recipes), inventory (ingredients + pantry), recipes (generation) and scan.
 */
export function CookAIProvider({ children }) {
  return (
    <NavigationProvider>
      <OnboardingProvider>
        <LanguageProvider>
          <EntitlementsProvider>
            <PreferencesProvider>
              <LibraryProvider>
                <InventoryProvider>
                  <RecipesProvider>
                    <ScanProvider>{children}</ScanProvider>
                  </RecipesProvider>
                </InventoryProvider>
              </LibraryProvider>
            </PreferencesProvider>
          </EntitlementsProvider>
        </LanguageProvider>
      </OnboardingProvider>
    </NavigationProvider>
  );
}

export { useTranslation };

/**
 * TEMPORARY: every domain merged into one object, as the old single context was. Reading
 * this re-renders on any change anywhere — migrate to the domain hooks (useLanguage,
 * useInventory, useScan, ...) and delete this.
 */
export function useCookAI() {
  const navigation = useNavigation();
  const onboarding = useOnboarding();
  const language = useLanguage();
  const entitlements = useEntitlements();
  const preferences = usePreferences();
  const library = useLibrary();
  const inventory = useInventory();
  const recipes = useRecipes();
  const scan = useScan();
  return useMemo(
    () => ({
      ...navigation, ...onboarding, ...language, ...entitlements, ...preferences,
      ...library, ...inventory, ...recipes, ...scan, showToast, hideToast,
    }),
    [navigation, onboarding, language, entitlements, preferences, library, inventory, recipes, scan]
  );
}
