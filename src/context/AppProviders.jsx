import React from "react";
import { NavigationProvider } from "./NavigationContext";
import { OnboardingProvider } from "./OnboardingContext";
import { LanguageProvider } from "./LanguageContext";
import { EntitlementsProvider } from "./EntitlementsContext";
import { PreferencesProvider } from "./PreferencesContext";
import { LibraryProvider } from "./LibraryContext";
import { InventoryProvider } from "./InventoryContext";
import { RecipesProvider } from "./RecipesContext";
import { ScanProvider } from "./ScanContext";

/**
 * Every provider, outermost first. Each domain only depends on the ones above it:
 * navigation / onboarding flags / language, then entitlements (PRO + limits), preferences,
 * library (saved recipes), inventory (ingredients + pantry), recipes (generation) and scan.
 */
export function AppProviders({ children }) {
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
