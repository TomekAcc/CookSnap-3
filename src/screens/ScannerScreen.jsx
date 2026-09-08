import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Sparkles, RefreshCw, X } from "lucide-react-native";
import Header from "../components/Header";
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
    setActiveTab,
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
  // First-generation pantry prompt — shown once after the first successful
  // recipe generation, dismissed by tapping "Go to Pantry" or the dismiss
  // button. Confirmed user feedback: people scan the fridge, get recipes,
  // and never realise the Pantry tab exists. This prompt appears right after
  // the first recipe generation, right where they're already looking.
  const [showPantryCta, setShowPantryCta] = useState(false);
  const [pantryCtaDismissed, setPantryCtaDismissed] = useState(false);
  useEffect(() => {
    if (hasGeneratedOnce && !pantryCtaDismissed) {
      setShowPantryCta(true);
    }
  }, [hasGeneratedOnce, pantryCtaDismissed]);

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
        <Header />
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

        {showPantryCta ? (
          <View
            style={[
              styles.pantryCta,
              {
                backgroundColor: colors.card || "#FFFFFF",
                borderColor: colors.cardBorder || "#E5E7EB",
              },
            ]}
          >
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.pantryCtaTitle, { color: colors.textPrimary }]}>
                {t("scanner.pantryCtaTitle")}
              </Text>
              <Text style={[styles.pantryCtaBody, { color: colors.textSecondary }]}>
                {t("scanner.pantryCtaBody")}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setActiveTab("pantry");
                setShowPantryCta(false);
              }}
              activeOpacity={0.85}
              style={styles.pantryCtaBtn}
            >
              <Text style={styles.pantryCtaBtnText}>{t("scanner.pantryCtaBtn")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setPantryCtaDismissed(true);
                setShowPantryCta(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={t("a11y.dismiss")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.pantryCtaDismiss}
            >
              <X size={14} color="#94A3B8" strokeWidth={2.5} />
            </TouchableOpacity>
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
    // Emerald, not navy — matches "Take Photo" in FridgeScannerHero now
    // too, so this screen has one consistent primary-action color instead
    // of navy and the app's actual brand green both reading as "primary."
    backgroundColor: "#059669",
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
  //
  // First-generation pantry prompt — appears once after the first recipe
  // generation, invites the user to add pantry staples. Dismissible.
  pantryCta: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 34,
    marginHorizontal: 20,
    marginTop: 14,
  },
  pantryCtaTitle: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  pantryCtaBody: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },
  pantryCtaBtn: {
    backgroundColor: "#059669",
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  pantryCtaBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  pantryCtaDismiss: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
});
