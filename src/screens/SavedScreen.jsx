import { useTabScroll } from "../hooks/useTabScroll";
import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Heart } from "lucide-react-native";
import EmptyStateSparkle from "../components/EmptyStateSparkle";
import Header from "../components/Header";
import { useCookAI } from "../context/CookAIContext";
import { useModalState } from "../context/ModalContext";
import { useTheme } from "../context/ThemeContext";
import RecipeCard from "../components/RecipeCard";
import SwipeToDeleteRow from "../components/SwipeToDeleteRow";
import { RADIUS } from "../theme/tokens";

// Meal types worth filtering by, in the order they appear in a day. Only the
// ones with a translation and at least one saved recipe become chips.
const FILTERABLE_MEALS = ["breakfast", "lunch", "dinner", "dessert"];

export default function SavedScreen() {
  const tabScroll = useTabScroll("saved");
  const insets = useSafeAreaInsets();
  const { savedRecipes, toggleSaveRecipe, t } = useCookAI();
  const { setSelectedRecipe } = useModalState();
  const { colors, isDark } = useTheme();
  const [openSwipeId, setOpenSwipeId] = useState(null);
  const [mealFilter, setMealFilter] = useState("all");

  const mealChips = useMemo(() => {
    const present = FILTERABLE_MEALS.filter((m) =>
      savedRecipes.some((r) => String(r?.category || "").toLowerCase() === m)
    );
    // A single category (or none) filters nothing — no chips then.
    return present.length >= 2 ? present : [];
  }, [savedRecipes]);
  // The chosen meal type can vanish when its last recipe is deleted.
  const activeFilter = mealChips.includes(mealFilter) ? mealFilter : "all";
  const visibleRecipes =
    activeFilter === "all"
      ? savedRecipes
      : savedRecipes.filter(
          (r) => String(r?.category || "").toLowerCase() === activeFilter
        );

  return (
    <ScrollView
      ref={tabScroll.setRef}
      onScroll={tabScroll.onScroll}
      onContentSizeChange={tabScroll.onContentSizeChange}
      onScrollBeginDrag={tabScroll.onScrollBeginDrag}
      scrollEventThrottle={tabScroll.scrollEventThrottle}
      style={{ flex: 1, backgroundColor: colors.bg }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingBottom: insets.bottom + 120,
        // flexGrow lets the empty state below claim the leftover height and
        // center itself in it, instead of hugging the header and leaving a
        // tall dead gap above the tab bar.
        flexGrow: 1,
      }}
    >
      <Header />
      <View style={{ paddingHorizontal: 20, paddingTop: 4, flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: mealChips.length ? 16 : 20,
          }}
        >
          <Text
            style={{
              color: colors.textPrimary,
              // Bold (700), not ExtraBold — matches the same change on
              // Profile/Pantry/Settings' titles, for a more visible "i" dot.
              fontWeight: "700",
              fontSize: 28,
              letterSpacing: -0.5,
            }}
          >
            {t("menu.savedRecipes")}
          </Text>
          {savedRecipes.length > 0 ? (
            <View
              style={[
                styles.countPill,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 13 }}>
                {savedRecipes.length}
              </Text>
            </View>
          ) : null}
        </View>

        {savedRecipes.length === 0 ? (
          // Deliberately NOT a card. A card frames a thing, and an empty
          // state is the absence of one — boxing it drew a bordered outline
          // around nothing and read as a recipe card that had failed to
          // load, sitting exactly where real recipe cards sit.
          <View style={styles.empty}>
            {/* colors.card, NOT colors.inputBg: in the light theme inputBg
                and bg are both #F5F5F7, so once this stopped sitting on a
                white card the chip became exactly the page colour and the
                heart floated unanchored. card contrasts in both themes. */}
            <View
              style={[
                styles.emptyIcon,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              <Heart
                size={36}
                color={colors.textTertiary || "#86868B"}
                strokeWidth={2}
              />
              <EmptyStateSparkle color={colors.danger || "#FF3B30"} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {t("saved.emptyTitle")}
            </Text>
            <Text
              style={[styles.emptyBody, { color: colors.textSecondary }]}
            >
              {t("saved.emptyBody")}
            </Text>
          </View>
        ) : (
          <>
            {mealChips.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipScroll}
                contentContainerStyle={styles.chipRow}
              >
                {["all", ...mealChips].map((id) => {
                  const selected = activeFilter === id;
                  return (
                    <TouchableOpacity
                      key={id}
                      onPress={() => setMealFilter(id)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={[
                        styles.chip,
                        selected
                          ? { backgroundColor: "#059669", borderColor: "#059669" }
                          : { backgroundColor: colors.card, borderColor: colors.cardBorder },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: selected ? "#FFFFFF" : colors.textPrimary,
                        }}
                      >
                        {t(`mealType.${id}`)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}
            {/* Compact rows that swipe left to delete (same as Pantry and the
                planner) instead of a heart that is always filled on this tab.
                The spacing lives on the wrapper so the red delete layer
                doesn't stretch over the gap between rows. */}
            {visibleRecipes.map((recipe) => (
              <View key={recipe.id} style={styles.rowGap}>
                <SwipeToDeleteRow
                  isOpen={openSwipeId === recipe.id}
                  onOpenChange={(open) => setOpenSwipeId(open ? recipe.id : null)}
                  onDelete={() => toggleSaveRecipe(recipe)}
                  borderRadius={RADIUS.card}
                >
                  <RecipeCard
                    compact
                    recipe={recipe}
                    isFavorite
                    onSelect={(r) => {
                      setOpenSwipeId(null);
                      setSelectedRecipe(r);
                    }}
                  />
                </SwipeToDeleteRow>
              </View>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  countPill: {
    marginLeft: 10,
    minWidth: 28,
    height: 28,
    paddingHorizontal: 9,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipScroll: { marginHorizontal: -20, marginBottom: 16, flexGrow: 0 },
  chipRow: { paddingHorizontal: 20, gap: 8 },
  chip: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rowGap: { marginBottom: 12 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    // Nudge up from true center: the header sits above this block, so dead
    // centering the remaining space reads as sitting slightly low.
    paddingBottom: 48,
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
    maxWidth: 300,
  },
});
