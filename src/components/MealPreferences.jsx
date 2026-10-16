import React, { useState } from "react";
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
  ChevronDown,
} from "lucide-react-native";
import { useCookAI } from "../context/CookAIContext";
import { useTheme } from "../context/ThemeContext";
import { animateLayout } from "../utils/layoutMotion";
import { translateCount } from "../i18n";
import { RADIUS } from "../theme/tokens";

// Vector icons instead of emoji for every CONTROL on this screen (emoji are
// drawn differently by Apple and Google and never matched the app's icon
// language; they stay on the detected-ingredient chips, where they are
// content picked by the scan). Deliberately quiet: flat neutral chips and one
// loud thing, the solid emerald of whatever is selected. An earlier pass gave
// every option its own pastel disc, which read as a rainbow of arbitrary
// colours, and a still earlier one used big bordered tiles — both busier than
// five short questions deserve.
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

const EMERALD = "#10B981";

function cardStyle(isDark, colors) {
  return {
    backgroundColor: isDark ? colors.card : "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: isDark ? colors.cardBorder : "#E5E7EB",
    padding: 14,
  };
}

function usePalette() {
  const { colors, isDark } = useTheme();
  return {
    idleBg: isDark ? colors.inputBg : "#F3F5F8",
    idleInk: isDark ? colors.textPrimary : "#1E293B",
    idleIcon: isDark ? colors.textSecondary : "#64748B",
    muted: colors.textSecondary,
    isDark,
    colors,
  };
}

// Flat chip: neutral fill, no border, icon + label. Selected = solid emerald
// with white icon and label (the same width in both states, so nothing shifts).
function ChoiceChip({ Icon, label, selected, onPress }) {
  const p = usePalette();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, { backgroundColor: selected ? EMERALD : p.idleBg }]}
    >
      <Icon size={15} color={selected ? "#FFFFFF" : p.idleIcon} strokeWidth={2.4} />
      <Text
        numberOfLines={1}
        style={[styles.chipLabel, { color: selected ? "#FFFFFF" : p.idleInk }]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// One rounded bar split into equal segments (hunger level). A single control
// instead of three separate bordered tiles.
function Segmented({ options, value, onChange, t }) {
  const p = usePalette();
  return (
    <View style={[styles.segmented, { backgroundColor: p.idleBg }]}>
      {options.map((o) => {
        const selected = value === o.id;
        const Icon = o.Icon;
        return (
          <TouchableOpacity
            key={o.id}
            onPress={() => onChange(o.id)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && { backgroundColor: EMERALD }]}
          >
            <Icon size={16} color={selected ? "#FFFFFF" : p.idleIcon} strokeWidth={2.4} />
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[styles.segmentLabel, { color: selected ? "#FFFFFF" : p.idleInk }]}
            >
              {t(o.labelKey)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function SectionLabel({ children, noMargin = false }) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        styles.groupLabel,
        { color: colors.textSecondary },
        noMargin && { marginBottom: 0 },
      ]}
    >
      {children}
    </Text>
  );
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
  const palette = usePalette();
  const [moreOpen, setMoreOpen] = useState(
    () => cravingTags.length > 0 || !!excludeThisBatch
  );
  const activeMore = cravingTags.length + (excludeThisBatch ? 1 : 0);

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

      {/* One card. Meal type, servings and hunger are the three questions that
          matter every time; cravings and the one-off exclusion are optional,
          so they sit behind "More options" (opened automatically when
          something in them is already set). Cravings are free and reset on
          restart ("what do I want right now"), deliberately apart from the
          persisted Custom Diet on Profile. */}
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
          <SectionLabel noMargin>{t("mealPrefs.servings")}</SectionLabel>
          <View style={styles.stepper}>
            <TouchableOpacity
              onPress={() => setServings(Math.max(1, servings - 1))}
              activeOpacity={0.85}
              style={[styles.stepBtn, { backgroundColor: palette.idleBg }]}
              accessibilityLabel={t("a11y.decreaseServings")}
            >
              <Minus size={15} color={colors.textPrimary} strokeWidth={2.6} />
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
              style={[styles.stepBtn, { backgroundColor: palette.idleBg }]}
              accessibilityLabel={t("a11y.increaseServings")}
            >
              <Plus size={15} color={colors.textPrimary} strokeWidth={2.6} />
            </TouchableOpacity>
          </View>
        </View>

        <Divider />

        <SectionLabel>{t("profile.hungerLevel")}</SectionLabel>
        <Segmented
          options={HUNGER_OPTIONS}
          value={hungerLevel}
          onChange={setHungerLevel}
          t={t}
        />

        <Divider />

        <TouchableOpacity
          onPress={() => {
            animateLayout();
            setMoreOpen((v) => !v);
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ expanded: moreOpen }}
          style={styles.moreRow}
        >
          <Text style={[styles.moreLabel, { color: colors.textPrimary }]}>
            {t("mealPrefs.moreOptions")}
          </Text>
          <View style={styles.moreRight}>
            {!moreOpen && activeMore > 0 ? (
              <View style={styles.moreBadge}>
                <Text style={styles.moreBadgeText}>{activeMore}</Text>
              </View>
            ) : null}
            <ChevronDown
              size={18}
              color={colors.textSecondary}
              strokeWidth={2.4}
              style={{ transform: [{ rotate: moreOpen ? "180deg" : "0deg" }] }}
            />
          </View>
        </TouchableOpacity>

        {moreOpen ? (
          <View style={{ marginTop: 14 }}>
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
        ) : null}
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
  // Quiet small-caps labels: the options below them are the content, the
  // labels only name the group.
  groupLabel: {
    fontWeight: "700",
    fontSize: 11.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
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
    gap: 7,
    paddingHorizontal: 13,
    height: 38,
    borderRadius: RADIUS.pill,
  },
  chipLabel: {
    fontSize: 13.5,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  segmented: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    height: 40,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 6,
    overflow: "hidden",
  },
  segmentLabel: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  moreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 28,
  },
  moreLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  moreRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  moreBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: EMERALD,
    alignItems: "center",
    justifyContent: "center",
  },
  moreBadgeText: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "800",
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
  // Neutral chip, not a primary-button fill — a -/+ stepper is a minor
  // adjustment and must not compete with "Generate AI Recipes".
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.control,
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
