import React, { createContext, useCallback, useContext, useMemo } from "react";
import { STORAGE_KEYS } from "../storage/keys";
import { flagCodec } from "../storage/codecs";
import { usePersistedState } from "../hooks/usePersistedState";

const OnboardingContext = createContext(null);

/** One-time flags: the first-launch onboarding gate and the two "first visit" hints. */
export function OnboardingProvider({ children }) {
  // First-launch onboarding gate — App.jsx shows a language + units picker
  // instead of the main shell until this flips true. `onboardingHydrated`
  // is what App.jsx actually waits on before deciding what to render — an
  // existing user must never see the gate flash while AsyncStorage is
  // still being read, so the gate stays hidden (nothing renders yet)
  // until hydration resolves either way.
  const [onboardingComplete, setOnboardingCompleteState, onboardingHydrated] = usePersistedState(
    STORAGE_KEYS.onboardingComplete,
    { initial: false, codec: flagCodec }
  );

  const completeOnboarding = useCallback(() => {
    setOnboardingCompleteState(true);
  }, [setOnboardingCompleteState]);

  // Confirmed real feedback: Settings' sticky "Done" button only earns its
  // keep the very first time someone lands there — by any later visit,
  // they've already learned the screen has a way out and the extra button
  // just adds noise. SettingsScreen reads this flag once per mount (via
  // its own lazy useState initializer, not live) so it still shows for
  // that first visit even though this flips true the moment it mounts.
  const [settingsDoneHintShown, setSettingsDoneHintShownState] = usePersistedState(
    STORAGE_KEYS.settingsDoneHintShown,
    { initial: false, codec: flagCodec }
  );

  const markSettingsDoneHintShown = useCallback(() => {
    setSettingsDoneHintShownState(true);
  }, [setSettingsDoneHintShownState]);

  // Confirmed real feedback: a first-time user landing on the idle Scanner
  // screen right after onboarding didn't register that this is where you
  // scan — same one-time-hint pattern as Settings' "Done" button above.
  // Shown once, dismissed the moment the user actually taps either scan
  // action (handled in FridgeScannerHero, not here), never shown again.
  const [firstScanHintShown, setFirstScanHintShownState] = usePersistedState(
    STORAGE_KEYS.firstScanHintShown,
    { initial: false, codec: flagCodec }
  );

  const markFirstScanHintShown = useCallback(() => {
    setFirstScanHintShownState(true);
  }, [setFirstScanHintShownState]);

  // Testing-only escape hatch (Settings > Testing) — replays the
  // first-launch onboarding flow (language/units + the PRO intro screen)
  // without needing to uninstall/reinstall the app to clear AsyncStorage.
  const resetOnboarding = useCallback(() => {
    // Replaying onboarding is meant to simulate a genuine first-time user end
    // to end — that includes Settings' one-time "Done" hint and the Scanner's
    // first-scan hint, not just the onboarding screens themselves. Each flag
    // deletes its own storage key when it goes false.
    setOnboardingCompleteState(false);
    setSettingsDoneHintShownState(false);
    setFirstScanHintShownState(false);
  }, [setOnboardingCompleteState, setSettingsDoneHintShownState, setFirstScanHintShownState]);
  const value = useMemo(
    () => ({
      onboardingComplete,
      onboardingHydrated,
      completeOnboarding,
      resetOnboarding,
      settingsDoneHintShown,
      markSettingsDoneHintShown,
      firstScanHintShown,
      markFirstScanHintShown,
    }),
    [onboardingComplete, onboardingHydrated, completeOnboarding, resetOnboarding, settingsDoneHintShown, markSettingsDoneHintShown, firstScanHintShown, markFirstScanHintShown]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
