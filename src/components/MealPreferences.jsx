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
// Each choice gets its own soft hue (tinted disc behind the icon) so the card
// isn't a wall of identical grey chips. Hues are pastel tints in light mode and
// the same colours at low alpha in dark mode; the selected state is the one
// loud thing on the card (solid emerald), so what you picked is obvious.
const HUES = {
  slate: { rgb: "100,116,139", ink: "#475569", inkDark: "#94A3B8" },
  amber: { rgb: "245,158,11", ink: "#D97706", inkDark: "#FBBF24" },
  orange: { rgb: "249,115,22", ink: "#EA580C", inkDark: "#FB923C" },
  violet: { rgb: "139,92,246", ink: "#7C3AED", inkDark: "#A78BFA" },
  pink: { rgb: "236,72,153", ink: "#DB2777", inkDark: "#F472B6" },
  green: { rgb: "16,185,129", ink: "#059669", inkDark: "#34D399" },
  sky: { rgb: "14,165,233", ink: "#0284C7", inkDark: "#38BDF8" },
  red: { rgb: "239,68,68", ink: "#DC2626", inkDark: "#F87171" },
};

const MEAL_CATEGORIES = [
  { id: "all", labelKey: "mealType.all", Icon: Utensils, hue: "slate" },
  { id: "breakfast", labelKey: "mealType.breakfast", Icon: Croissant, hue: "amber" },
  { id: "lunch", labelKey: "mealType.lunch", Icon: Sandwich, hue: "orange" },
  { id: "dinner", labelKey: "mealType.dinner", Icon: Moon, hue: "violet" },
  { id: "dessert", labelKey: "mealType.dessert", Icon: CakeSlice, hue: "pink" },
];

// `level` drives the little fill meter under each tile (1-3 bars).
const HUNGER_OPTIONS = [
  { id: "light", labelKey: "hunger.light", Icon: Feather, hue: "green", level: 1 },
  { id: "normal", labelKey: "hunger.normal", Icon: Utensils, hue: "amber", level: 2 },
  { id: "hungry", labelKey: "mealPrefs.hungerHearty", Icon: CookingPot, hue: "orange", level: 3 },
];

// ids here must match CRAVING_PROMPT_TEXT in CookAIContext.jsx — that's
// where these get translated into the actual prompt phrasing.
const CRAVING_TAGS = [
  { id: "salty", labelKey: "mealPrefs.cravingSalty", Icon: Waves, hue: "sky" },
  { id: "spicy", labelKey: "mealPrefs.cravingSpicy", Icon: Flame, hue: "red" },
  { id: "sweet", labelKey: "mealPrefs.cravingSweet", Icon: Candy, hue: "pink" },
  { id: "savory", labelKey: "mealPrefs.cravingSavory", Icon: Beef, hue: "amber" },
  { id: "light", labelKey: "mealPrefs.cravingLight", Icon: Leaf, hue: "green" },
  { id: "comfort", labelKey: "mealPrefs.cravingComfort", Icon: Soup, hue: "orange" },
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

// Round tinted disc behind an icon. `onSolid` is the selected-chip variant:
// translucent white disc with a white icon on the solid emerald fill.
function IconDisc({ Icon, hue, size = 26, onSolid = false }) {
  const { isDark } = useTheme();
  const h = HUES[hue] || HUES.slate;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: onSolid ? "rgba(255,255,255,0.24)" : `rgba(${h.rgb},${isDark ? 0.2 : 0.14})`,
      }}
    >
      <Icon
        size={Math.round(size * 0.58)}
        color={onSolid ? "#FFFFFF" : isDark ? h.inkDark : h.ink}
        strokeWidth={2.3}
      />
    </View>
  );
}

function useChoiceColors() {
  const { colors, isDark } = useTheme();
  return {
    selectedBg: isDark ? colors.accentGreenSoft : "rgba(236, 253, 245, 0.9)",
    selectedBorder: isDark ? colors.accentGreen : GREEN.primary,
    selectedInk: isDark ? "#6EE7B7" : "#047857",
    idleBg: isDark ? colors.inputBg : "#F8FAFC",
    idleBorder: isDark ? colors.cardBorder : "#EDF0F4",
    idleInk: isDark ? colors.textPrimary : "#1E293B",
  };
}

// Selected = solid emerald with white label/icon. Unselected keeps a 1.5px
// border (transparent-ish) at the same width, so selecting never nudges
// anything by a pixel.
function ChoiceChip({ Icon, hue, label, selected, onPress }) {
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
          backgroundColor: selected ? "#10B981" : c.idleBg,
          borderColor: selected ? "#10B981" : c.idleBorder,
        },
      ]}
    >
      <IconDisc Icon={Icon} hue={hue} size={26} onSolid={selected} />
      <Text
        numberOfLines={1}
        style={[styles.chipLabel, { color: selected ? "#FFFFFF" : c.idleInk }]}
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
              hue={cat.hue}
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
                <IconDisc Icon={Icon} hue={item.hue} size={38} />
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
                {/* 1-3 bars: how much food, at a glance. */}
                <View style={styles.meter}>
                  {[1, 2, 3].map((n) => {
                    const h = HUES[item.hue];
                    return (
                      <View
                        key={n}
                        style={{
                          width: 16,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor:
                            n <= item.level
                              ? isDark
                                ? h.inkDark
                                : h.ink
                              : isDark
                                ? "rgba(148,163,184,0.25)"
                                : "#E2E8F0",
                        }}
                      />
                    );
                  })}
                </View>
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
              hue={tag.hue}
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
    paddingLeft: 7,
    paddingRight: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
  },
  chipLabel: {
    fontSize: 13.5,
    fontWeight: "700",
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
    minHeight: 104,
    borderRadius: RADIUS.tile,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    paddingHorizontal: 6,
    overflow: "hidden",
  },
  meter: {
    flexDirection: "row",
    gap: 3,
    marginTop: 1,
  },
  hungerLabel: {
    fontSize: 12.5,
    fontWeight: "700",
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
