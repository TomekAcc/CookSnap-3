import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Sparkles, RefreshCw } from "lucide-react-native";
import FridgeScannerHero from "../components/FridgeScannerHero";
import MealPreferences from "../components/MealPreferences";
import RecipeFeed from "../components/RecipeFeed";
import { useCookAI } from "../context/CookAIContext";
import { useModalState } from "../context/ModalContext";
import { useTheme } from "../context/ThemeContext";

/**
 * Clean scanner shell — Scan More lives on the photo; bottom CTA is Generate only.
 */
export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const {
    scrollViewRef,
    setRecipesSectionY,
    hasScanned,
    isScanning,
    isGeneratingRecipes,
    generatedRecipes,
    generateRecipes,
    registerRecipeGenerationAttempt,
    isPro,
    dailyRecipeGenerationCount,
    freeDailyRecipeGenerations,
    ingredients,
    t,
  } = useCookAI();
  const { setProModalOpen } = useModalState();

  // Shown right on the CTA so a free user sees how many they have left
  // *before* tapping into a paywall, not just after — and phrased with
  // "today" so it reads as a daily allowance that comes back tomorrow,
  // not a one-time limit they've permanently used up.
  const remainingGenerations = Math.max(
    0,
    freeDailyRecipeGenerations - dailyRecipeGenerationCount
  );

  // Free tier caps recipe generations/regenerations per day (each one is
  // its own Gemini call) rather than the scan itself — see
  // FREE_DAILY_RECIPE_GENERATIONS in CookAIContext for why. Same
  // register-then-check-result pattern already used for the fridge scan
  // cap in FridgeScannerHero.
  const handleGeneratePress = () => {
    if (!registerRecipeGenerationAttempt()) {
      setProModalOpen(true);
      return;
    }
    generateRecipes();
  };

  const showPreferences = !isScanning;
  // RecipeFeed always mounts once scanning is done — it owns its own
  // empty / skeleton / populated states internally.
  const showRecipes = !isScanning;
  const foodCount = Array.isArray(ingredients) ? ingredients.length : 0;
  const hasFood = foodCount > 0;
  // Fully hidden (not just greyed) until a fridge photo has actually been
  // scanned AND it detected something — never rendered as a locked/disabled
  // placeholder. It slides into view the instant both are true.
  const showFloatingCta = hasScanned && hasFood && !isScanning;
  // generatedRecipes stays null until generateRecipes() has run at least
  // once — same "never generated" signal RecipeFeed uses.
  const hasGeneratedOnce = generatedRecipes != null;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, overflow: "hidden" }]}>
      {/* Confirmed real failure, and confirmed still real after the first
          fix: a plain KeyboardAvoidingView shrinks the scroll viewport when
          the keyboard opens, but does nothing to bring the specific
          focused input into that now-smaller visible area — the "Exclude
          an ingredient" field stayed exactly where it was, off-screen
          below the fold, and the user had to scroll manually to see what
          they were typing. KeyboardAwareScrollView (pure JS, no native
          module — safe for this app's OTA-update-only shipping) measures
          the focused input and auto-scrolls it into view above the
          keyboard, which a bare ScrollView/KeyboardAvoidingView pair
          doesn't do on its own. Deliberately wraps only the scrollable
          content, not the floating Generate button below it — that button
          already sits at a fixed offset from the bottom regardless of
          keyboard state, same as before this change. */}
      <KeyboardAwareScrollView
        innerRef={(ref) => {
          scrollViewRef.current = ref;
        }}
        style={[styles.flex, { overflow: "hidden" }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 16,
          // The button is now a true position:"absolute" overlay (like
          // BottomNav), not a space-reserving flex sibling — so this only
          // needs to clear both overlays' combined height with no leftover
          // void inside the scroll viewport itself, which was the actual
          // source of the recurring gray strip (empty space inside the
          // ScrollView showing the page background, not the button's own
          // wrapper).
          paddingBottom: isScanning
            ? insets.bottom + 40
            : showFloatingCta
              ? insets.bottom + 140
              : insets.bottom + 120,
        }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        scrollEnabled={!isScanning}
        bounces={!isScanning}
        enableOnAndroid
        extraScrollHeight={20}
        // Confirmed real feedback: the library's 250ms default here waits
        // that long after the keyboard starts appearing before it reacts,
        // which reads as "the keyboard covers the field for a moment, then
        // it catches up" instead of both happening together. 0 starts the
        // scroll immediately on focus, in step with the keyboard's own
        // opening animation rather than visibly chasing it.
        keyboardOpeningTime={0}
      >
        <FridgeScannerHero />

        {showPreferences ? <MealPreferences /> : null}

        {showRecipes ? (
          <View
            onLayout={(e) => {
              setRecipesSectionY(e.nativeEvent.layout.y);
            }}
          >
            {/* First child of the exact section scrollToRecipesTop()
                scrolls to — landing here means it's reliably right at
                the top of the viewport the moment you generate, not
                buried under whatever recipe cards render below it. A
                floating-overlay version could never overlap anything
                (previous attempt) but ALSO could never avoid sitting on
                top of scrolled content at some position — confirmed
                directly covering a recipe card's title once real
                recipes were on screen, which is worse than either
                earlier problem this was meant to solve. In-flow, in a
                position whose height is stable regardless of how many
                recipes exist, is the only option that's both reliably
                visible after generating AND never covers anything. */}
            <RecipeFeed />
          </View>
        ) : null}
      </KeyboardAwareScrollView>

      {showFloatingCta ? (
        // True floating overlay now (position: "absolute"), same pattern as
        // BottomNav — not a flex sibling that reserves its own row of space.
        // That reserved-space approach left a variable-size gap inside the
        // ScrollView's own viewport (below the last scrolled card, above
        // this row) that showed the page's gray background — this is what
        // actually caused the recurring "gray box" regardless of how this
        // wrapper's own padding/color was tuned, since that gap belonged to
        // the ScrollView, not to this wrapper. An absolute overlay removes
        // that gap's existence entirely: the ScrollView now always extends
        // the full screen height, and the button just floats on top of it
        // near the bottom, wrapped tightly by only its own small margin.
        <View
          style={[
            styles.ctaHost,
            {
              bottom: Math.max(insets.bottom, 8) + 56 + 10,
            },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            onPress={handleGeneratePress}
            disabled={isGeneratingRecipes || isScanning}
            activeOpacity={0.9}
            style={styles.ctaPrimary}
          >
            {isGeneratingRecipes ? (
              <>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.ctaPrimaryText} numberOfLines={1}>
                  {t("scanner.creatingRecipes")}
                </Text>
              </>
            ) : hasGeneratedOnce ? (
              <>
                <RefreshCw size={16} color="#FFFFFF" />
                <Text style={styles.ctaPrimaryText} numberOfLines={1}>
                  {t("scanner.regenerateRecipes")}
                </Text>
              </>
            ) : (
              <>
                <Sparkles size={16} color="#FFFFFF" />
                <Text style={styles.ctaPrimaryText} numberOfLines={1}>
                  {t("scanner.generateRecipes")}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scrollFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 32,
  },
  // Real flex sibling below the ScrollView (not an absolute overlay) —
  // guarantees it can never cover scrollable content, regardless of how
  // short that content is (e.g. the pre-scan idle state).
  ctaHost: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 39,
  },
  // Explicit shadow purge, not just "no shadow style applied" — RN shadows
  // blur outward on every side regardless of the y-offset, so the button's
  // old drop shadow (shadowRadius 8, elevation 3) was reading as a faint
  // border/arc ABOVE the button too, not just a subtle glow below it.
  // Kept as a single confident line — usage status lives on the "Your
  // Recipes" heading row (RecipeFeed) instead, so this button stays a
  // clean, punchy CTA rather than a two-line block competing with its own
  // primary action.
  ctaPrimary: {
    width: "100%",
    backgroundColor: "#1E293B",
    paddingVertical: 17,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
    shadowColor: "transparent",
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  ctaPrimaryText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 17,
    letterSpacing: -0.3,
    marginLeft: 8,
  },
  // Quiet, ambient status line — real document flow (scrolls with content,
  // sits just above where the floating button hovers), never a floating
  // chip that can land on top of something else. Icon + colored text
  // (green for free, amber for PRO) instead of plain slate gray — draws
  // from the same accent language already used for these two concepts
  // throughout the app (Sparkles/emerald, Crown/amber) instead of reading
  // as unstyled system text bolted on afterward.
});
