import React, { createContext, useCallback, useContext, useMemo, useRef } from "react";
import * as Localization from "expo-localization";
import { DEFAULT_LANGUAGE_ID, LANGUAGE_OPTIONS, getLanguageById, matchDeviceLanguage } from "../data/languageOptions";
import { translate } from "../i18n";
import { STORAGE_KEYS } from "../storage/keys";
import { textCodec } from "../storage/codecs";
import { usePersistedState } from "../hooks/usePersistedState";

// Language-only context. Anything that reads the translator re-renders when
// the language changes and not on any other state change in the app — which is
// why leaf components (rows, cards, buttons) read this and not a bigger one.
const LanguageContext = createContext(null);

/** The one language setting: drives both the UI text (t) and the language recipes are written in. */
export function LanguageProvider({ children }) {
  // Recipe output language — persisted the same way as unitSystem. Drives
  // both the language Gemini writes recipe titles/ingredients/steps in
  // (task #28) AND the app's own UI chrome text via `t()` below — the two
  // were deliberately unified into one setting rather than kept separate.
  //
  // First launch (nothing persisted yet) auto-detects from the device's
  // own language setting via expo-localization rather than defaulting to
  // English outright — matches the device's preferred language against
  // LANGUAGE_OPTIONS, falling back to English only when the device
  // language isn't one we support. Still fully overridable in Settings,
  // and whatever the user picks there always wins from then on.
  const [recipeLanguageId, setRecipeLanguageIdState, recipeLanguageHydrated] = usePersistedState(
    STORAGE_KEYS.recipeLanguage,
    {
      initial: DEFAULT_LANGUAGE_ID,
      codec: textCodec((raw) => LANGUAGE_OPTIONS.some((l) => l.id === raw)),
      fallback: () => matchDeviceLanguage(Localization.getLocales?.()?.[0]?.languageCode),
    }
  );

  const setRecipeLanguageId = useCallback((next) => {
    setRecipeLanguageIdState(
      LANGUAGE_OPTIONS.some((l) => l.id === next) ? next : DEFAULT_LANGUAGE_ID
    );
  }, [setRecipeLanguageIdState]);

  // English name (e.g. "Polish") threaded into every Gemini prompt — the
  // model is instructed in English regardless of which language the
  // recipe text itself should come back in.
  const recipeLanguageName = useMemo(
    () => getLanguageById(recipeLanguageId).englishName,
    [recipeLanguageId]
  );

  // `t()` — the SAME recipeLanguageId now drives both recipe generation
  // AND app UI text, deliberately not a second separate setting. Changing
  // it in Settings re-renders every consumer instantly (ordinary React
  // context propagation — no restart needed), since every translated
  // string is looked up live through this function rather than cached.
  const t = useCallback(
    (key, vars) => translate(recipeLanguageId, key, vars),
    [recipeLanguageId]
  );
  // Always the newest translator, for callbacks that outlive the render that
  // created them (the onboarding sample names are looked up a moment after the
  // language may have just been changed on that same screen).
  const tLatestRef = useRef(t);
  tLatestRef.current = t;
  const value = useMemo(
    () => ({
      t,
      tLatestRef,
      recipeLanguageId,
      recipeLanguageName,
      setRecipeLanguageId,
      recipeLanguageHydrated,
    }),
    [t, tLatestRef, recipeLanguageId, recipeLanguageName, setRecipeLanguageId, recipeLanguageHydrated]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

/** Alias for components that only need `t`. */
export const useTranslation = useLanguage;
