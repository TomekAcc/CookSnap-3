import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Heart, ChevronRight } from "lucide-react-native";
import {
  getDishEmojiAndColor,
  resolveCategoryBadgeColors,
} from "../utils/imageUtils";
import { useTheme } from "../context/ThemeContext";
import { useCookAI } from "../context/CookAIContext";
import { cookTimeLabel } from "../utils/timeFormat";
import { TYPE, WEIGHT, RADIUS, SPACE, ICON, emojiLine } from "../theme/tokens";

// Explicit iOS/Android shadow so the card reads as elevated even if the
// NativeWind `shadow-sm` utility doesn't fully translate on a given platform.
const CARD_SHADOW = Platform.select({
  ios: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  android: { elevation: 1 },
});

/**
 * Recipe card — one row: dish tile, title, a single meta line, and a rail
 * carrying the heart and a chevron. The whole card is the tap target.
 *
 * This replaced a version carrying eight elements (tile, title, clock
 * icon, total time, a prep/cook line, a green info pill, a green button,
 * heart) — including two green pills stacked on each other, one a label
 * and one a button, which is what made it read as chaotic. What went:
 *   · the prep/cook line — it restated the total time directly above it,
 *     and the real breakdown is already inside the recipe
 *   · the "uses N fridge items" pill — every card in a batch shows the
 *     same number, so as a badge it shouted without helping you choose;
 *     it survives as quiet text
 *   · the "View Recipe" button — the chevron carries it now, the way a
 *     native list row does, and the card was always tappable anyway
 *
 * Sizes, shape, spacing and icon stroke all come from theme/tokens.js
 * rather than being picked here — that's the point of the token file.
 * Local emoji only — never Image / network.
 */
export default function RecipeCard({
  recipe,
  isFavorite = false,
  onToggleFavorite,
  onSelect,
}) {
  const { colors, isDark } = useTheme();
  const { t } = useCookAI();

  const safeRecipe = recipe && typeof recipe === "object" ? recipe : null;
  if (!safeRecipe) return null;

  const dish = getDishEmojiAndColor(safeRecipe.title || "", safeRecipe.dishType);
  const badge = resolveCategoryBadgeColors(dish, isDark);
  const emoji = dish.emoji || "🥘";

  const matchCount =
    safeRecipe.matchCount ||
    (Array.isArray(safeRecipe.ingredientsList)
      ? safeRecipe.ingredientsList.length
      : Array.isArray(safeRecipe.ingredients)
        ? safeRecipe.ingredients.length
        : 3);

  return (
    <TouchableOpacity
      onPress={() => onSelect?.(safeRecipe)}
      activeOpacity={0.9}
      style={[
        styles.card,
        CARD_SHADOW,
        { backgroundColor: colors.card, borderColor: colors.cardBorder },
      ]}
      accessibilityRole="button"
      accessibilityLabel={t("a11y.viewRecipeNamed", { title: safeRecipe.title })}
    >
      {/* Both themes take their colour from resolveCategoryBadgeColors now.
          It used to be a NativeWind class in light and an inline style in
          dark — exactly the kind of split that lets two themes drift apart
          without anyone noticing. */}
      <View
        style={[
          styles.tile,
          {
            backgroundColor: badge.backgroundColor,
            borderColor: badge.borderColor,
          },
        ]}
      >
        <Text style={styles.tileEmoji} allowFontScaling={false}>
          {emoji}
        </Text>
      </View>

      <View style={styles.body}>
        {/* Confirmed real failure: a title containing one word too wide to
            fit even a full line (e.g. a long compound ingredient name)
            can't wrap normally — RN truncates it mid-word right where it
            ran out of room on line 1, leaving line 2 sitting empty. That
            reads as broken layout, not "long title." adjustsFontSizeToFit
            lets the title shrink slightly instead, so it actually fills
            both lines rather than dead-ending early. */}
        <Text
          style={[styles.title, { color: colors.textPrimary }]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {safeRecipe.title}
        </Text>

        {/* One line, with a hierarchy inside it: the time is the fact you
            scan for, so it carries the weight and the full ink; the fridge
            match trails behind it lighter. Both halves at the same weight
            is what read as messy. */}
        <Text
          style={[styles.meta, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          <Text style={[styles.metaStrong, { color: colors.textPrimary }]}>
            {cookTimeLabel(safeRecipe, t("cookingTime.minUnit"))}
          </Text>
          <Text style={{ color: colors.textTertiary || "#CBD5E1" }}>
            {"  ·  "}
          </Text>
          {t("recipeCard.usesFridgeItems", { count: matchCount })}
        </Text>
      </View>

      <View style={styles.rail}>
        <TouchableOpacity
          onPress={() => onToggleFavorite?.(safeRecipe.id)}
          // Confirmed real complaint: a uniform 12pt hitSlop on all sides
          // reached past the 8pt gap into where the chevron sits, so
          // aiming at "go to recipe" could land on "toggle favorite"
          // instead. Generous on the three sides with nothing next to
          // them; tight on the side facing the chevron.
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 4 }}
          activeOpacity={0.85}
          style={[
            styles.heart,
            isFavorite
              ? {
                  backgroundColor: isDark ? "#4C0519" : colors.dangerSoft || "#FFECEA",
                  borderColor: isDark ? "#881337" : "#FFC4C0",
                }
              : {
                  backgroundColor: isDark ? colors.inputBg : "#F8FAFC",
                  borderColor: colors.cardBorder,
                },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            isFavorite ? t("a11y.removeFromFavorites") : t("a11y.addToFavorites")
          }
        >
          <Heart
            size={ICON.md}
            color={isFavorite ? "#FF3B30" : "#94A3B8"}
            fill={isFavorite ? "#FF3B30" : "none"}
            strokeWidth={ICON.stroke}
          />
        </TouchableOpacity>

        {/* Decorative: the card itself is the button, so this must not be
            its own tap target competing with the heart beside it. */}
        <ChevronRight
          size={ICON.md}
          color={colors.textTertiary || "#CBD5E1"}
          strokeWidth={ICON.stroke}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md + 2,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: SPACE.lg,
    marginBottom: SPACE.lg,
  },
  tile: {
    width: 76,
    height: 76,
    borderRadius: RADIUS.tile,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tileEmoji: {
    fontSize: 40,
    lineHeight: emojiLine(40),
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: TYPE.title,
    fontWeight: WEIGHT.bold,
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  meta: {
    fontSize: TYPE.small,
    fontWeight: WEIGHT.medium,
    marginTop: 7,
    lineHeight: 18,
  },
  metaStrong: {
    fontWeight: WEIGHT.bold,
  },
  rail: {
    flexDirection: "row",
    alignItems: "center",
    // Widened from SPACE.sm (8) — paired with the heart's now-asymmetric
    // hitSlop above, so there's real breathing room between "toggle
    // favorite" and "go to recipe" instead of the two nearly touching.
    gap: SPACE.md,
    flexShrink: 0,
  },
  heart: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
