import React from "react";
import { renderHook, waitFor } from "@testing-library/react-native";
import { ModalProvider, useModalState } from "../src/context/ModalContext";
import { AppProviders } from "../src/context/AppProviders";
import { useNavigation } from "../src/context/NavigationContext";
import { useOnboarding } from "../src/context/OnboardingContext";
import { useLanguage } from "../src/context/LanguageContext";
import { useEntitlements } from "../src/context/EntitlementsContext";
import { usePreferences } from "../src/context/PreferencesContext";
import { useLibrary } from "../src/context/LibraryContext";
import { useInventory } from "../src/context/InventoryContext";
import { useRecipes } from "../src/context/RecipesContext";
import { useScan } from "../src/context/ScanContext";

/**
 * Mounts the real provider tree (with AsyncStorage mocked by jest.setup.js) and returns every
 * domain's value under its own name: result.current.{nav, onboarding, language, ent, prefs, lib,
 * inv, rec, scan, modal}. Resolves once persisted state has loaded.
 */
export async function renderApp() {
  const wrapper = ({ children }) => (
    <ModalProvider>
      <AppProviders>{children}</AppProviders>
    </ModalProvider>
  );
  const utils = renderHook(
    () => ({
      nav: useNavigation(),
      onboarding: useOnboarding(),
      language: useLanguage(),
      ent: useEntitlements(),
      prefs: usePreferences(),
      lib: useLibrary(),
      inv: useInventory(),
      rec: useRecipes(),
      scan: useScan(),
      modal: useModalState(),
    }),
    { wrapper }
  );
  await waitFor(() => {
    const c = utils.result.current;
    expect(c.language.recipeLanguageHydrated && c.onboarding.onboardingHydrated && c.lib.savedHydrated).toBe(true);
  });
  return utils;
}
