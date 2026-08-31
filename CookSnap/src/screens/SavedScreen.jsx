import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bookmark, Heart } from "lucide-react-native";
import EmptyStateSparkle from "../components/EmptyStateSparkle";
import { useCookAI } from "../context/CookAIContext";
import { useModalState } from "../context/ModalContext";
import { useTheme } from "../context/ThemeContext";
import {
  getDishEmojiAndColor,
  resolveCategoryBadgeColors,
} from "../utils/imageUtils";
import CookingTimeDisplay from "../components/CookingTimeDisplay";
import { TYPE, WEIGHT } from "../theme/tokens";
import IconBadge from "../components/IconBadge";
import { DS } from "../utils/designSystem";

function SavedRecipeThumb({ dishTitle, dishType }) {
  const { isDark } = useTheme();
  const style = getDishEmojiAndColor(dishTitle, dishType);
  const badge = resolveCategoryBadgeColors(style, isDark);

  return (
    <View
      style={{
        width: 64,
        height: 64,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: badge.backgroundColor,
        borderWidth: 1,
        borderColor: badge.borderColor || "#F1F5F9",
      }}
    >
      <Text style={{ fontSize: 36, lineHeight: 40 }} allowFontScaling={false}>
        {style.emoji || "🥘"}
      </Text>
    </View>
  );
}

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const { savedRecipes, toggleSaveRecipe, t } = useCookAI();
  const { setSelectedRecipe } = useModalState();
  const { colors, isDark } = useTheme();

  return (
    <ScrollView
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
      <View style={{ paddingHorizontal: 20, paddingTop: 20, flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <IconBadge tone="emerald" isDark={isDark} style={{ marginRight: 8 }}>
            <Bookmark size={18} color="#059669" />
          </IconBadge>
          <Text
            style={{
              color: colors.textPrimary,
              // Bold (700), not ExtraBold — matches the same change on
              // Profile/Pantry/Settings' titles, for a more visible "i" dot.
              fontWeight: "700",
              fontSize: 24,
              letterSpacing: -0.4,
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
          savedRecipes.map((recipe) => (
            <TouchableOpacity
              key={recipe.id}
              onPress={() => setSelectedRecipe(recipe)}
              activeOpacity={0.9}
              style={[
                styles.card,
                DS.shadow.card,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              <SavedRecipeThumb dishTitle={recipe.title} dishType={recipe.dishType} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: TYPE.title,
                    fontWeight: WEIGHT.bold,
                    color: colors.textPrimary,
                    lineHeight: 22,
                    letterSpacing: -0.3,
                  }}
                  numberOfLines={2}
                >
                  {recipe.title}
                </Text>
                <View style={{ marginTop: 8 }}>
                  <CookingTimeDisplay
                    prepTime={recipe.prepTime}
                    cookTime={recipe.cookTime}
                    totalTime={recipe.totalTime}
                    variant="compact"
                  />
                </View>
              </View>
              <TouchableOpacity
                onPress={() => toggleSaveRecipe(recipe)}
                hitSlop={12}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.dangerSoft || "#FFECEA",
                }}
              >
                <Heart size={18} color="#FF3B30" fill="#FF3B30" />
              </TouchableOpacity>
            </TouchableOpacity>
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
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 20,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
});
