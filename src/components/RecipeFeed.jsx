import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Crown, Sparkles, TriangleAlert } from "lucide-react-native";
import { useCookAI } from "../context/CookAIContext";
import { useModalState } from "../context/ModalContext";
import { useTheme } from "../context/ThemeContext";
import { translateCount } from "../i18n";
import RecipeCard from "./RecipeCard";
import ProBanner from "./ProBanner";
import EmptyStateSparkle from "./EmptyStateSparkle";
import { ICON } from "../theme/tokens";

export default function RecipeFeed({ onSelectRecipe } = {}) {
  const {
    visibleRecipes,
    isGeneratingRecipes,
    generatedRecipes,
    recipeGenerationFailed,
    favorites,
    toggleFavorite,
    isRecipeSaved,
    recipeLanguageId,
    isPro,
    dailyRecipeGenerationCount,
    freeDailyRecipeGenerations,
    t,
  } = useCookAI();
  const { setSelectedRecipe, setProModalOpen } = useModalState();
  const { colors } = useTheme();

  const recipes = (visibleRecipes || []).slice(0, 5);
  const remainingGenerations = Math.max(
    0,
    freeDailyRecipeGenerations - dailyRecipeGenerationCount
  );
  // generatedRecipes stays null until generateRecipes() has run at least
  // once — that's the signal for "never generated," not "recipes.length === 0."
  const hasNeverGenerated = generatedRecipes == null;

  const handleSelect = (recipe) => {
    if (onSelectRecipe) onSelectRecipe(recipe);
    else setSelectedRecipe(recipe);
  };

  const isFavorite = (id) => {
    if (Array.isArray(favorites)) {
      return favorites.some((favId) => String(favId) === String(id));
    }
    return isRecipeSaved(id);
  };

  // No placeholder before the first-ever generation — there's nothing to
  // show yet. Once a batch exists, though, regenerating must NOT tear this
  // whole section down: it stayed mounted through `isGeneratingRecipes`
  // before (returning null here), which meant the entire "Your Recipes"
  // section — header, cards, everything — vanished the instant Regenerate
  // was tapped and only popped back once the new batch landed. The old
  // `generatedRecipes` was never actually cleared in state during that
  // window, so keep rendering it: dim the existing cards to signal a
  // refresh is in progress, then let them update in place once the new
  // batch replaces `recipes` — no gap where the section disappears.
  if (hasNeverGenerated) {
    // Generation was attempted and failed, with nothing real to fall back
    // to — show an honest notice instead of fake recipes or a silent
    // blank. No retry button here: the floating "Generate AI Recipes" CTA
    // (ScannerScreen) is already on screen and already wired to retry, so
    // a second one here would just be a confusing duplicate action.
    if (recipeGenerationFailed) {
      return (
        <View style={styles.root}>
          <View
            style={[
              styles.empty,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
              ]}
            >
              <TriangleAlert
                size={36}
                color={colors.danger || "#FF3B30"}
                strokeWidth={2}
              />
              <EmptyStateSparkle color={colors.danger || "#FF3B30"} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {t("recipeFeed.errorTitle")}
            </Text>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
              {t("recipeFeed.errorBody")}
            </Text>
          </View>
        </View>
      );
    }
    return null;
  }

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t("recipeFeed.title")}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {recipes.length === 1
              ? t("recipeFeed.subtitleOne", { count: recipes.length })
              : translateCount(recipeLanguageId, recipes.length, {
                  few: "recipeFeed.subtitleFew",
                  many: "recipeFeed.subtitleMany",
                  fallback: "recipeFeed.subtitleMany",
                })}
          </Text>
        </View>

        {/* The generations status used to be a centered line ABOVE this
            heading, in ScannerScreen. Two things were wrong with that: it
            was the only centered element on a page that's otherwise all
            left-aligned to the margin, so it read as floating rather than
            placed; and it announced a section's status before the heading
            that introduces the section. It belongs here — right-aligned on
            the heading's own row, which headerRow was already built for
            (space-between + gap, with nothing ever in the second slot).
            The amber/PRO colour stays: unlike the badges cut from the
            preferences screen, that one actually carries meaning. */}
        <View style={styles.usage}>
          {isPro ? (
            <Crown size={13} color="#D97706" strokeWidth={ICON.strokeSmall} />
          ) : (
            <Sparkles size={13} color="#059669" strokeWidth={ICON.strokeSmall} />
          )}
          <Text
            numberOfLines={2}
            style={[styles.usageCaption, isPro && styles.usageCaptionPro]}
          >
            {isPro
              ? t("scanner.unlimitedGenerations")
              : remainingGenerations > 0
                ? t("scanner.generationsLeftToday", {
                    count: remainingGenerations,
                    total: freeDailyRecipeGenerations,
                  })
                : t("scanner.generationsUsedUpToday")}
          </Text>
        </View>
      </View>

      <View
        style={[styles.list, isGeneratingRecipes && styles.listRegenerating]}
        pointerEvents={isGeneratingRecipes ? "none" : "auto"}
      >
        {recipes.map((recipe) => (
          <RecipeCard
            key={recipe.id || `recipe-${recipe.title}`}
            recipe={recipe}
            isFavorite={isFavorite(recipe.id)}
            onToggleFavorite={toggleFavorite}
            onSelect={handleSelect}
          />
        ))}
      </View>

      {/* ProBanner had no isPro check at all — it sold PRO to users who
          already have it, which is both wasted screen space and a real
          "this app doesn't know I paid" moment. Only place it renders. */}
      {!isPro ? (
        <ProBanner onOpenProModal={() => setProModalOpen(true)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 20,
    // A real section break: the preferences card now sits directly above
    // this, with nothing between them (the generations caption moved onto
    // the heading row below).
    marginTop: 20,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 18,
  },
  headerText: { flex: 1, minWidth: 0 },
  // Sits in headerRow's second slot, top-aligned so it lines up with the
  // title rather than centring against the two-line title+subtitle block.
  usage: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 1,
    maxWidth: "46%",
    marginTop: 3,
  },
  usageCaption: {
    color: "#059669",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  usageCaptionPro: {
    color: "#D97706",
  },
  // Matches the shared section-title treatment used by "Meal Preferences" /
  // "Hunger Level" in MealPreferences.jsx (fontSize 18 / weight 800), so the
  // hierarchy between section headers on this screen stays consistent.
  title: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 4,
    lineHeight: 18,
  },
  list: { marginTop: 4 },
  // Dims the existing cards during a regenerate pass instead of removing
  // them — the section stays put, it just visibly signals "updating."
  listRegenerating: { opacity: 0.45 },
  empty: {
    borderRadius: 24,
    paddingVertical: 48,
    paddingHorizontal: 32,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    position: "relative",
  },
  emptyTitle: {
    fontWeight: "700",
    fontSize: 20,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 15,
    fontWeight: "400",
    textAlign: "center",
    marginTop: 10,
    lineHeight: 22,
  },
});
