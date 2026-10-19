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
 * `compact` is the Saved list's row: smaller tile, one meta line (time ·
 * calories — a saved recipe's "uses N fridge items" goes stale the moment the
 * fridge changes), no heart (everything here is saved, so it said nothing; the
 * row swipes to delete instead) and no outer margin (the swipe wrapper owns it).
 *
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
  compact = false,
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

  const calories = typeof safeRecipe.calories === "string" ? safeRecipe.calories.trim() : "";

  return (
    <TouchableOpacity
      onPress={() => onSelect?.(safeRecipe)}
      activeOpacity={0.9}
      style={[
        styles.card,
        compact && styles.cardCompact,
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
          compact && styles.tileCompact,
          {
            backgroundColor: badge.backgroundColor,
            borderColor: badge.borderColor,
          },
        ]}
      >
        <Text
          style={[styles.tileEmoji, compact && styles.tileEmojiCompact]}
          allowFontScaling={false}
        >
          {emoji}
        </Text>
      </View>

      <View style={styles.body}>
        <Text
          style={[
            styles.title,
            compact && styles.titleCompact,
            { color: colors.textPrimary },
          ]}
          // Usunięto limit numberOfLines oraz skalowanie
          // Tytuły ułożą się naturalnie, a ich zwięzłość zapewni prompt Gemini
        >
          {safeRecipe.title}
        </Text>

        {/* One line, with a hierarchy inside it: the time is the fact you
            scan for, so it carries the weight and the full ink; the fridge
            match trails behind it lighter. Both halves at the same weight
            is what read as messy. */}
        <Text
          style={[
            styles.meta,
            compact && styles.metaCompact,
            { color: colors.textSecondary },
          ]}
          numberOfLines={compact ? 1 : 2}
        >
          <Text style={[styles.metaStrong, { color: colors.textPrimary }]}>
            {cookTimeLabel(safeRecipe, t("cookingTime.minUnit"))}
          </Text>
          {compact ? (
            calories ? (
              <>
                <Text style={{ color: colors.textTertiary || "#CBD5E1" }}>
                  {"  ·  "}
                </Text>
                {calories}
              </>
            ) : null
          ) : (
            <>
              <Text style={{ color: colors.textTertiary || "#CBD5E1" }}>
                {"  ·  "}
              </Text>
              {t("recipeCard.usesFridgeItems", { count: matchCount })}
            </>
          )}
        </Text>
      </View>

      <View style={styles.rail}>
        {onToggleFavorite ? (
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
        ) : null}

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
    // 18 (was 16): the text block needs more air around it than the tile
    // and rail do, since a wrapped title plus a wrapped meta line is up to
    // four stacked lines.
    padding: SPACE.lg + 2,
    // 16px between cards. This was 32px (SPACE.xxxl) after an earlier "cards
    // blend together" complaint, but that fixed the wrong thing: the gap was
    // twice the card's own inner padding, so the list read as loose floating
    // islands and each screen showed fewer recipes. The cards are already
    // clearly separate surfaces (own background, border and radius), so a gap
    // equal to the inner padding keeps them distinct and groups them as one list.
    marginBottom: SPACE.lg + 2,
  },
  cardCompact: {
    padding: SPACE.md + 2,
    gap: SPACE.md,
    marginBottom: 0,
  },
  tileCompact: {
    width: 56,
    height: 56,
  },
  tileEmojiCompact: {
    fontSize: 30,
    lineHeight: emojiLine(30),
  },
  titleCompact: {
    fontSize: TYPE.body + 1,
    lineHeight: 21,
  },
  metaCompact: {
    marginTop: 2,
    lineHeight: 18,
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
    lineHeight: 25,
    letterSpacing: -0.3,
    // A few px of slack on the right. Reported on a real iPhone: "Omlet z
    // pesto i serem" drew its last letters past the text column and was
    // clipped ("...i sere"), leaving an empty second line — the native text
    // engine measured the line narrower than it rendered (tight negative
    // letter-spacing on a custom font). With slack the line breaks earlier
    // instead of overflowing.
    paddingRight: 6,
  },
  // Looser than the title's ratio on purpose: the meta line is small,
  // lighter text that often wraps onto a second line right under a
  // two-line title, and at 18 those three lines read as one cramped block.
  meta: {
    fontSize: TYPE.small,
    fontWeight: WEIGHT.medium,
    marginTop: SPACE.sm + 3,
    lineHeight: 20,
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
