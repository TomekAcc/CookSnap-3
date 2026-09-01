import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  StyleSheet,
} from "react-native";
import { Sparkles, Utensils, Flame } from "lucide-react-native";
import { useCookAI } from "../context/CookAIContext";
import { useTheme } from "../context/ThemeContext";
import PillTag from "./PillTag";
import IconBadge from "./IconBadge";
import { translateCount } from "../i18n";
import { RADIUS, GREEN, emojiLine } from "../theme/tokens";

const MEAL_CATEGORIES = [
  { id: "all", labelKey: "mealType.all", icon: "🍽️" },
  { id: "breakfast", labelKey: "mealType.breakfast", icon: "🥐" },
  { id: "lunch", labelKey: "mealType.lunch", icon: "🥗" },
  { id: "dinner", labelKey: "mealType.dinner", icon: "🌙" },
  { id: "dessert", labelKey: "mealType.dessert", icon: "🍰" },
];

const HUNGER_OPTIONS = [
  { id: "light", labelKey: "hunger.light", icon: "🥗" },
  { id: "normal", labelKey: "hunger.normal", icon: "🍝" },
  { id: "hungry", labelKey: "mealPrefs.hungerHearty", icon: "🥘" },
];

// ids here must match CRAVING_PROMPT_TEXT in CookAIContext.jsx — that's
// where these get translated into the actual prompt phrasing.
const CRAVING_TAGS = [
  { id: "salty", labelKey: "mealPrefs.cravingSalty", emoji: "🧂" },
  { id: "spicy", labelKey: "mealPrefs.cravingSpicy", emoji: "🌶️" },
  { id: "sweet", labelKey: "mealPrefs.cravingSweet", emoji: "🍯" },
  { id: "savory", labelKey: "mealPrefs.cravingSavory", emoji: "🔥" },
  { id: "light", labelKey: "mealPrefs.cravingLight", emoji: "🍃" },
  { id: "comfort", labelKey: "mealPrefs.cravingComfort", emoji: "🍲" },
];

function cardStyle(isDark, colors) {
  return {
    backgroundColor: isDark ? colors.card : "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: isDark ? colors.cardBorder : "#E5E7EB",
    padding: 14,
  };
}

/**
 * Meal Preferences — meal-type pills, a servings stepper, hunger
 * tiles and craving tags. All three selectable groups share one
 * "selected" language: pale green fill, green border, green label.
 */
export default function MealPreferences() {
  const {
    mealType,
    setMealType,
    servings,
    setServings,
    hungerLevel,
    setHungerLevel,
    cravingTags,
    toggleCravingTag,
    excludeThisBatch,
    setExcludeThisBatch,
    includePantryStaples,
    setIncludePantryStaples,
    t,
    recipeLanguageId,
  } = useCookAI();
  const { colors, isDark } = useTheme();
  const card = cardStyle(isDark, colors);

  return (
    <View style={styles.root}>
      {/* Icon-badge + title, same pairing every other screen header in the
          app uses (Profile, Pantry, Saved, Settings) — this component's
          three section titles used to be the one spot left as bare text. */}
      <View style={styles.sectionHeaderRow}>
        <IconBadge tone="emerald" isDark={isDark} style={{ marginRight: 8 }}>
          <Utensils size={18} color={isDark ? "#34D399" : "#059669"} />
        </IconBadge>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {t("mealPrefs.title")}
        </Text>
      </View>

      {/* Include Pantry Staples — sits first, directly under the detected
          ingredients grid, so every input that affects recipe generation is
          grouped together before the meal-type / servings / hunger tuning.
          Confirmed real failure, not a hypothetical: this used to be a
          plain View with only the Switch itself interactive — tapping the
          label text did nothing. Whole row is now the touch target, same
          fix as the Settings dietary rows; pointerEvents="none" on the
          Switch stops a direct tap on it from double-toggling via bubbling. */}
      <TouchableOpacity
        onPress={() => setIncludePantryStaples((prev) => !prev)}
        activeOpacity={0.7}
        style={[card, styles.staplesCard]}
      >
        {/* The amber badge that used to sit here is gone. Amber means
            PRO/premium everywhere else in this app, so spending it on a
            pantry toggle actively misled; and it was one of only two rows
            on this screen carrying a badge at all, which made the device
            read as arbitrary rather than structural. */}
        <View style={styles.servingsLeft}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              {t("mealPrefs.includeStaples")}
            </Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
              {t("mealPrefs.staplesDesc")}
            </Text>
          </View>
        </View>

        <Switch
          value={includePantryStaples}
          onValueChange={setIncludePantryStaples}
          pointerEvents="none"
          trackColor={{
            false: "#E5E7EB",
            true: "#10B981",
          }}
          thumbColor="#FFFFFF"
        />
      </TouchableOpacity>

      {/* Larger meal-type pills */}
      <View style={card}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
        >
          {MEAL_CATEGORIES.map((cat) => {
            const selected = mealType === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setMealType(cat.id)}
                activeOpacity={0.85}
                style={[
                  styles.mealPill,
                  selected
                    ? {
                        // Static rgba(236,253,245,0.9) — a near-opaque pale
                        // mint — read as a glaring bright patch on a pure
                        // black dark-mode canvas. accentGreenSoft/accentGreen
                        // are the same muted-dark-emerald-bg + crisp-border
                        // tokens ThemeContext already defines for exactly
                        // this "selected" treatment in dark mode.
                        backgroundColor: isDark
                          ? colors.accentGreenSoft
                          : "rgba(236, 253, 245, 0.9)",
                        borderColor: isDark ? colors.accentGreen : "#10B981",
                        borderWidth: 2,
                      }
                    : {
                        // Soft fill + transparent border, identical to the
                        // hunger tiles below, so both groups say "selected"
                        // the same way. Width stays 2 in both states: this
                        // was 1 unselected vs 2 selected, which nudged the
                        // pill a pixel on every tap — the same shift already
                        // reported and fixed once in PillTag, still living
                        // in this hand-rolled copy of it.
                        backgroundColor: isDark ? colors.inputBg : "#F8FAFC",
                        borderColor: "transparent",
                        borderWidth: 2,
                      },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={styles.mealPillEmoji}>{cat.icon}</Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.mealPillLabel,
                    {
                      color: selected
                        ? isDark
                          ? "#6EE7B7"
                          : "#047857"
                        : isDark
                          ? colors.textPrimary
                          : "#1E293B",
                    },
                  ]}
                >
                  {t(cat.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={[card, styles.servingsCard]}>
        {/* Indigo badge removed for the same reason — indigo appears
            nowhere else in the app, so it carried no meaning at all. */}
        <View style={styles.servingsLeft}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              {t("mealPrefs.servings")}
            </Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
              {t("mealPrefs.servingsDesc")}
            </Text>
          </View>
        </View>

        <View style={styles.stepper}>
          <TouchableOpacity
            onPress={() => setServings(Math.max(1, servings - 1))}
            activeOpacity={0.85}
            style={[
              styles.stepBtn,
              {
                backgroundColor: isDark ? colors.inputBg : "#F1F5F9",
                borderColor: colors.cardBorder,
              },
            ]}
            accessibilityLabel={t("a11y.decreaseServings")}
          >
            <Text style={[styles.stepBtnText, { color: colors.textPrimary }]}>−</Text>
          </TouchableOpacity>

          <View style={styles.servingsCenter}>
            <Text
              style={[styles.servingsNumber, { color: colors.textPrimary }]}
            >
              {servings}
            </Text>
            <Text style={styles.servingsUnit}>
              {servings === 1
                ? t("mealPrefs.personUnit")
                : translateCount(recipeLanguageId, servings, {
                    few: "mealPrefs.peopleUnitFew",
                    many: "mealPrefs.peopleUnitMany",
                    fallback: "mealPrefs.peopleUnit",
                  })}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setServings(Math.min(12, servings + 1))}
            activeOpacity={0.85}
            style={[
              styles.stepBtn,
              {
                backgroundColor: isDark ? colors.inputBg : "#F1F5F9",
                borderColor: colors.cardBorder,
              },
            ]}
            accessibilityLabel={t("a11y.increaseServings")}
          >
            <Text style={[styles.stepBtnText, { color: colors.textPrimary }]}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Hunger — squarish tiles, large emojis, emerald selected. Header
          lives outside the card in its own row wrapper — exactly like
          "Meal Preferences" above — so both section titles sit at the
          identical horizontal position instead of "Hunger Level"
          inheriting the card's own 14px inner padding. */}
      <View style={styles.sectionHeaderRow}>
        <IconBadge tone="emerald" isDark={isDark} style={{ marginRight: 8 }}>
          <Flame size={18} color={isDark ? "#34D399" : "#059669"} />
        </IconBadge>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {t("profile.hungerLevel")}
        </Text>
      </View>
      <View style={card}>
        <View style={styles.hungerRow}>
          {HUNGER_OPTIONS.map((item) => {
            const selected = hungerLevel === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => setHungerLevel(item.id)}
                activeOpacity={0.88}
                style={[
                  styles.hungerTile,
                  // Unselected tiles are a soft fill with a TRANSPARENT
                  // border rather than a visible outline: these already sit
                  // inside a bordered card, so outlining each one made a box
                  // inside a box. Border width stays 2 in both states — the
                  // exact 1-vs-2 mismatch that used to shift pills sideways
                  // on selection elsewhere in this app.
                  selected
                    ? {
                        backgroundColor: isDark
                          ? colors.accentGreenSoft
                          : "rgba(236, 253, 245, 0.9)",
                        borderColor: isDark ? colors.accentGreen : GREEN.primary,
                        borderWidth: 2,
                      }
                    : {
                        backgroundColor: isDark ? colors.inputBg : "#F8FAFC",
                        borderColor: "transparent",
                        borderWidth: 2,
                      },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={styles.hungerEmoji} allowFontScaling={false}>
                  {item.icon}
                </Text>
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[
                    styles.hungerLabel,
                    {
                      color: selected
                        ? isDark
                          ? "#6EE7B7"
                          : "#047857"
                        : isDark
                          ? colors.textPrimary
                          : "#334155",
                    },
                  ]}
                >
                  {t(item.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Craving quick-tags + one-off batch exclusion — real feedback from
          a live tester: no way to nudge a generation toward a mood
          ("something salty", "bold and savory") or drop one ingredient
          just for this batch without it being a whole standing diet rule.
          Deliberately separate from Custom Diet (Settings, PRO, persisted,
          hard-enforced allergy-grade exclusions) — this is free for
          everyone and resets when the app restarts, since it's "what do I
          want right now," not a standing preference. Multi-select, same
          as Dietary Restrictions, since wanting both "spicy" and "comfort
          food" at once is entirely reasonable. */}
      <View style={styles.sectionHeaderRow}>
        <IconBadge tone="emerald" isDark={isDark} style={{ marginRight: 8 }}>
          <Sparkles size={18} color={isDark ? "#34D399" : "#059669"} />
        </IconBadge>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {t("mealPrefs.cravingTitle")}
        </Text>
      </View>
      <View style={card}>
        <View style={styles.cravingRow}>
          {CRAVING_TAGS.map((tag) => (
            <PillTag
              key={tag.id}
              emoji={tag.emoji}
              label={t(tag.labelKey)}
              selected={cravingTags.includes(tag.id)}
              onPress={() => toggleCravingTag(tag.id)}
            />
          ))}
        </View>

        <View style={[styles.excludeRow, { borderTopColor: colors.cardBorder }]}>
          <Sparkles size={14} color={isDark ? colors.textSecondary : "#94A3B8"} />
          <TextInput
            value={excludeThisBatch}
            onChangeText={setExcludeThisBatch}
            placeholder={t("mealPrefs.excludeThisBatchPlaceholder")}
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.excludeInput,
              { color: colors.textPrimary },
            ]}
            returnKeyType="done"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    gap: 14,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontWeight: "800",
    fontSize: 18,
    letterSpacing: -0.3,
  },
  pillsRow: {
    gap: 8,
    paddingRight: 4,
    alignItems: "center",
  },
  cravingRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  excludeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  excludeInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    paddingVertical: 2,
  },
  mealPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 2,
  },
  // 18, matching PillTag's emoji. These two pill rows sit two blocks apart
  // on the same screen and were 22 vs 15 — the same decorative food emoji
  // at noticeably different sizes.
  mealPillEmoji: {
    fontSize: 18,
    lineHeight: emojiLine(18),
    marginRight: 8,
  },
  mealPillLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  servingsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  servingsLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
    gap: 10,
    minWidth: 0,
  },
  cardTitle: {
    fontWeight: "700",
    fontSize: 14,
  },
  cardSub: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  // Neutral chip, not the near-black primary-button fill this used to be.
  // A −/+ stepper is a minor adjustment; spending the app's loudest colour
  // on it put two heavy dark blocks directly above the actual primary
  // action ("Generate AI Recipes") and made them compete. Colour comes in
  // inline at the call site so it can be theme-aware.
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: {
    fontWeight: "700",
    fontSize: 18,
    lineHeight: 20,
  },
  servingsCenter: {
    minWidth: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  servingsNumber: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  servingsUnit: {
    fontSize: 10,
    fontWeight: "500",
    color: "#6B7280",
    letterSpacing: 0.6,
    marginTop: 1,
  },
  hungerRow: {
    flexDirection: "row",
    gap: 8,
  },
  hungerTile: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 96,
    borderRadius: RADIUS.tile,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    // Same "text can bleed past its own box on web" issue fixed in
    // BottomNav — a translated hunger-level word longer than the tile is
    // wide must never spill into the gap toward the next tile. This is the
    // hard guarantee; hungerLabel's own numberOfLines/width:100% below is
    // what lets it end in "…" instead of just getting clipped at the edge.
    overflow: "hidden",
  },
  hungerEmoji: {
    fontSize: 42,
    lineHeight: emojiLine(42),
    marginBottom: 6,
  },
  hungerLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: -0.1,
    width: "100%",
    minWidth: 0,
    textAlign: "center",
  },
  staplesCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
