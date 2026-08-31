import "./global.css";
import React from "react";
import { View, StatusBar, LogBox, Animated } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { installGlobalFont } from "./src/utils/globalFont";
import { CookAIProvider, useCookAI } from "./src/context/CookAIContext";
import { ModalProvider, useModalState } from "./src/context/ModalContext";
import { useModalPresence } from "./src/utils/bottomSheet";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import ErrorBoundary from "./src/components/ErrorBoundary";
import Header from "./src/components/Header";
import BottomNav from "./src/components/BottomNav";
import AddIngredientModal from "./src/components/AddIngredientModal";
import ProSubscriptionModal from "./src/components/ProSubscriptionModal";
import RecipeDetailModal from "./src/components/RecipeDetailModal";
import ScanHistoryModal from "./src/components/ScanHistoryModal";
import MealPlannerModal from "./src/components/MealPlannerModal";
import HelpFeedbackModal from "./src/components/HelpFeedbackModal";
import Toast from "./src/components/Toast";
import ScannerScreen from "./src/screens/ScannerScreen";
import PantryTab from "./src/components/PantryTab";
import SavedScreen from "./src/screens/SavedScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import OnboardingProScreen from "./src/screens/OnboardingProScreen";

// Runs once, before the first Text renders — see globalFont.js for why this
// has to patch the JSX runtime rather than Text.render or createElement.
installGlobalFont();

try {
  LogBox.ignoreLogs([
    "Failed to load",
    "Image",
    "Network request failed",
    "Possible Unhandled Promise Rejection",
    "Unable to download",
  ]);
} catch {
  // LogBox may be unavailable in some builds — ignore.
}

function MainContent() {
  // Hooks must stay unconditional — never wrap useCookAI in try/catch.
  const { activeTab } = useCookAI();

  switch (activeTab) {
    case "pantry":
      return <PantryTab />;
    case "saved":
      return <SavedScreen />;
    case "profile":
      return <ProfileScreen />;
    case "settings":
      return <SettingsScreen />;
    default:
      return <ScannerScreen />;
  }
}

/**
 * Overlay host — sits beside the tab shell (does not remount MainContent).
 * Mount at most one native Modal tree at a time to avoid iOS multi-Modal crashes.
 *
 * Each flag is gated through useModalPresence's `present` rather than the
 * raw boolean, so a modal stays mounted for EXIT_DURATION_MS after closing
 * instead of being torn down the instant it closes — otherwise its own
 * exit animation (backdrop fade, sheet slide-down) never gets a chance to
 * play at all, since React destroys it before a single frame can render.
 */
function OverlayHost() {
  const {
    addIngredientOpen,
    proModalOpen,
    selectedRecipe,
    scanHistoryOpen,
    mealPlannerOpen,
    helpModalOpen,
  } = useModalState();

  const { present: addIngredientPresent } = useModalPresence(addIngredientOpen);
  const { present: proPresent } = useModalPresence(proModalOpen);
  const { present: recipePresent } = useModalPresence(!!selectedRecipe);
  const { present: scanHistoryPresent } = useModalPresence(scanHistoryOpen);
  const { present: mealPlannerPresent } = useModalPresence(mealPlannerOpen);
  const { present: helpPresent } = useModalPresence(helpModalOpen);

  return (
    <ErrorBoundary>
      {addIngredientPresent ? <AddIngredientModal /> : null}
      {proPresent ? <ProSubscriptionModal /> : null}
      {recipePresent ? (
        <ErrorBoundary>
          <RecipeDetailModal />
        </ErrorBoundary>
      ) : null}
      {scanHistoryPresent ? <ScanHistoryModal /> : null}
      {mealPlannerPresent ? <MealPlannerModal /> : null}
      {helpPresent ? <HelpFeedbackModal /> : null}
    </ErrorBoundary>
  );
}

function AppShell() {
  const { colors, isDark } = useTheme();

  return (
    <>
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.bg }}
        edges={["left", "right"]}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor="transparent"
          translucent
        />
        <Toast />
        <ErrorBoundary>
          <View
            style={{ zIndex: 10, backgroundColor: colors.bg }}
            collapsable={false}
          >
            <Header />
          </View>
        </ErrorBoundary>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <ErrorBoundary>
            <MainContent />
          </ErrorBoundary>
        </View>
        <ErrorBoundary>
          <BottomNav />
        </ErrorBoundary>
      </SafeAreaView>
      <OverlayHost />
    </>
  );
}

/**
 * Decides between the first-launch onboarding screens and the real app
 * shell. Nothing renders until `onboardingHydrated` — the AsyncStorage
 * read that decides which one to show — resolves, so an existing user
 * never sees onboarding flash on screen while that read is in flight.
 *
 * `proIntroShown` is local, ephemeral state (not persisted) — it only
 * needs to gate the single beat between the language/units step and
 * `completeOnboarding()` firing, so there's no need for its own storage
 * key. "Maybe later" and subscribing both call `finishOnboarding`, just
 * one of them also calls `activatePro()` first.
 */
function RootGate() {
  const {
    onboardingComplete,
    onboardingHydrated,
    completeOnboarding,
    recipeLanguageHydrated,
  } = useCookAI();
  const { colors } = useTheme();
  const [proIntroShown, setProIntroShown] = React.useState(false);
  const fadeAnim = React.useRef(new Animated.Value(1)).current;

  // The language/units screen is light-themed; the PRO intro right after
  // it (and the app shell beyond that) intentionally isn't — same dark
  // "PRO" chrome used everywhere else PRO shows up, kept deliberately
  // distinct from the rest of the app. That's a real, wanted contrast, so
  // the fix isn't matching the colors — it's not hard-cutting between
  // them. A quick fade-to-fade-in softens the jump without touching either
  // screen's own look.
  const crossfadeTo = (advance) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      advance();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });
  };

  if (!onboardingHydrated) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  let screen;
  if (!onboardingComplete) {
    screen = proIntroShown ? (
      <OnboardingProScreen onFinish={() => crossfadeTo(completeOnboarding)} />
    ) : (
      <OnboardingScreen onContinue={() => crossfadeTo(() => setProIntroShown(true))} />
    );
  } else if (!recipeLanguageHydrated) {
    // Confirmed real failure, reported by a first-time tester: a returning
    // user with e.g. Polish selected briefly saw the app shell's text in
    // English before recipeLanguageId's own AsyncStorage read resolved and
    // corrected it — recipeLanguageId starts at DEFAULT_LANGUAGE_ID
    // (English) synchronously and only becomes the real saved language
    // after that async read finishes (see CookAIContext.jsx). Holding the
    // shell back the same way onboardingHydrated already does above closes
    // that gap: nothing text-bearing mounts until the real language is
    // known, so there's no English frame to flash at all.
    screen = <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  } else {
    screen = <AppShell />;
  }

  return <Animated.View style={{ flex: 1, opacity: fadeAnim }}>{screen}</Animated.View>;
}

export default function App() {
  // Gate everything on the font load the same way RootGate already gates on
  // onboardingHydrated — nothing text-bearing should mount while
  // PlusJakartaSans_* is still in flight, or the very first frame renders
  // in the system font globalFont.js is meant to replace everywhere.
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: "#F5F5F7" }} />;
  }

  return (
    // Required at the true root for ANY react-native-gesture-handler
    // gesture to work at all — omitting this is the #1 cause of gestures
    // silently not firing.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <ErrorBoundary>
            <ThemeProvider>
              <ModalProvider>
                <CookAIProvider>
                  <RootGate />
                </CookAIProvider>
              </ModalProvider>
            </ThemeProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
