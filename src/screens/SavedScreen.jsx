import { useTabScroll } from "../hooks/useTabScroll";
import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Heart } from "lucide-react-native";
import EmptyStateSparkle from "../components/EmptyStateSparkle";
import Header from "../components/Header";
import { useCookAI } from "../context/CookAIContext";
import { useModalState } from "../context/ModalContext";
import { useTheme } from "../context/ThemeContext";
import RecipeCard from "../components/RecipeCard";

export default function SavedScreen() {
  const tabScroll = useTabScroll("saved");
  const insets = useSafeAreaInsets();
  const { savedRecipes, toggleSaveRecipe, t } = useCookAI();
  const { setSelectedRecipe } = useModalState();
  const { colors, isDark } = useTheme();

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
      <View style={{ paddingHorizontal: 20, paddingTop: 16, flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
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
        </View>
        <Text
          style={{
            color: colors.textSecondary,
            fontWeight: "500",
            fontSize: 13,
            marginBottom: 24,
            lineHeight: 18,
          }}
        >
          {t("saved.subtitle")}
        </Text>

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
          // The same card as the recipe list on the Scanner, so the two
          // can't drift apart again (they used to be separate
          // implementations with different tiles, hearts, spacing and a
          // wrapping prep/cook line). Always favorited here; tapping the
          // heart un-saves.
          savedRecipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              isFavorite
              onToggleFavorite={() => toggleSaveRecipe(recipe)}
              onSelect={(r) => setSelectedRecipe(r)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
