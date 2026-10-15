import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
} from "react-native";
import {
  Sparkles,
  Utensils,
  Croissant,
  Sandwich,
  Moon,
  CakeSlice,
  Feather,
  CookingPot,
  Soup,
  Waves,
  Flame,
  Candy,
  Beef,
  Leaf,
  Minus,
  Plus,
} from "lucide-react-native";
import { useCookAI } from "../context/CookAIContext";
import { useTheme } from "../context/ThemeContext";
import { translateCount } from "../i18n";
import { RADIUS, GREEN } from "../theme/tokens";

// Vector icons instead of emoji for every CONTROL on this screen. Emoji are
// drawn differently by Apple and Google and never matched the app's icon
// language; they stay only where they are content (the detected-ingredient
// chips, where the scan picks the emoji for the real item).
const MEAL_CATEGORIES = [
  { id: "all", labelKey: "mealType.all", Icon: Utensils },
  { id: "breakfast", labelKey: "mealType.breakfast", Icon: Croissant },
  { id: "lunch", labelKey: "mealType.lunch", Icon: Sandwich },
  { id: "dinner", labelKey: "mealType.dinner", Icon: Moon },
  { id: "dessert", labelKey: "mealType.dessert", Icon: CakeSlice },
];

const HUNGER_OPTIONS = [
  { id: "light", labelKey: "hunger.light", Icon: Feather },
  { id: "normal", labelKey: "hunger.normal", Icon: Utensils },
  { id: "hungry", labelKey: "mealPrefs.hungerHearty", Icon: CookingPot },
];

// ids here must match CRAVING_PROMPT_TEXT in CookAIContext.jsx — that's
// where these get translated into the actual prompt phrasing.
const CRAVING_TAGS = [
  { id: "salty", labelKey: "mealPrefs.cravingSalty", Icon: Waves },
  { id: "spicy", labelKey: "mealPrefs.cravingSpicy", Icon: Flame },
  { id: "sweet", labelKey: "mealPrefs.cravingSweet", Icon: Candy },
  { id: "savory", labelKey: "mealPrefs.cravingSavory", Icon: Beef },
  { id: "light", labelKey: "mealPrefs.cravingLight", Icon: Leaf },
  { id: "comfort", labelKey: "mealPrefs.cravingComfort", Icon: Soup },
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

// One "selected" language for every choice on this screen: pale emerald fill,
// emerald border, emerald label and icon. Unselected keeps a transparent 2px
// border so selecting never nudges anything by a pixel.
function useChoiceColors() {
  const { colors, isDark } = useTheme();
  return {
    selectedBg: isDark ? colors.accentGreenSoft : "rgba(236, 253, 245, 0.9)",
    selectedBorder: isDark ? colors.accentGreen : GREEN.primary,
    selectedInk: isDark ? "#6EE7B7" : "#047857",
    idleBg: isDark ? colors.inputBg : "#F8FAFC",
    idleInk: isDark ? colors.textPrimary : "#1E293B",
    idleIcon: isDark ? colors.textSecondary : "#64748B",
  };
}

function ChoiceChip({ Icon, label, selected, onPress }) {
  const c = useChoiceColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? c.selectedBg : c.idleBg,
          borderColor: selected ? c.selectedBorder : "transparent",
        },
      ]}
    >
      <Icon size={16} color={selected ? c.selectedInk : c.idleIcon} strokeWidth={2.2} />
      <Text
        numberOfLines={1}
        style={[styles.chipLabel, { color: selected ? c.selectedInk : c.idleInk }]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SectionLabel({ children }) {
  const { colors } = useTheme();
  return <Text style={[styles.groupLabel, { color: colors.textPrimary }]}>{children}</Text>;
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />;
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
  const choice = useChoiceColors();

  return (
    <View style={styles.root}>
      <View style={{ paddingHorizontal: 4 }}>
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

      {/* One card, five labelled groups. This used to be five separate cards
          with five different treatments (and headings on only two of them),
          which read as unrelated widgets. The craving tags are free and
          reset on restart ("what do I want right now"), deliberately apart
          from the persisted Custom Diet on Profile. */}
      <View style={card}>
        <SectionLabel>{t("mealPrefs.mealTypeTitle")}</SectionLabel>
        <View style={styles.wrapRow}>
          {MEAL_CATEGORIES.map((cat) => (
            <ChoiceChip
              key={cat.id}
              Icon={cat.Icon}
              label={t(cat.labelKey)}
              selected={mealType === cat.id}
              onPress={() => setMealType(cat.id)}
            />
          ))}
        </View>

        <Divider />

        <View style={styles.servingsRow}>
          <SectionLabel>{t("mealPrefs.servings")}</SectionLabel>
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
              <Minus size={16} color={colors.textPrimary} strokeWidth={2.6} />
            </TouchableOpacity>

            <View style={styles.servingsCenter}>
              <Text style={[styles.servingsNumber, { color: colors.textPrimary }]}>
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
              <Plus size={16} color={colors.textPrimary} strokeWidth={2.6} />
            </TouchableOpacity>
          </View>
        </View>

        <Divider />

        <SectionLabel>{t("profile.hungerLevel")}</SectionLabel>
        <View style={styles.hungerRow}>
          {HUNGER_OPTIONS.map((item) => {
            const selected = hungerLevel === item.id;
            const Icon = item.Icon;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => setHungerLevel(item.id)}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.hungerTile,
                  {
                    backgroundColor: selected ? choice.selectedBg : choice.idleBg,
                    borderColor: selected ? choice.selectedBorder : "transparent",
                  },
                ]}
              >
                <Icon
                  size={22}
                  color={selected ? choice.selectedInk : choice.idleIcon}
                  strokeWidth={2}
                />
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[
                    styles.hungerLabel,
                    { color: selected ? choice.selectedInk : choice.idleInk },
                  ]}
                >
                  {t(item.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Divider />

        <SectionLabel>{t("mealPrefs.cravingTitle")}</SectionLabel>
        <View style={styles.wrapRow}>
          {CRAVING_TAGS.map((tag) => (
            <ChoiceChip
              key={tag.id}
              Icon={tag.Icon}
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
            style={[styles.excludeInput, { color: colors.textPrimary }]}
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
  sectionTitle: {
    fontWeight: "800",
    fontSize: 18,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  groupLabel: {
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: -0.1,
    marginBottom: 10,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 14,
  },
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
    borderWidth: 2,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  excludeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  excludeInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    paddingVertical: 2,
  },
  servingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontWeight: "700",
    fontSize: 14,
  },
  cardSub: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 1,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  // Neutral chip, not the near-black primary-button fill this used to be —
  // a -/+ stepper is a minor adjustment and must not compete with the
  // actual primary action ("Generate AI Recipes").
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  servingsCenter: {
    minWidth: 64,
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
  // Compact tiles: icon over label. They were square 96px tiles with a 36px
  // emoji — a lot of padding for three choices. A translated label longer
  // than the tile is wide ends in an ellipsis instead of spilling into the
  // next tile (overflow hidden is the hard guarantee).
  hungerTile: {
    flex: 1,
    minHeight: 68,
    borderRadius: RADIUS.tile,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
    overflow: "hidden",
  },
  hungerLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: -0.1,
    lineHeight: 15,
    width: "100%",
    minWidth: 0,
    textAlign: "center",
  },
  staplesCard: {
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
});
