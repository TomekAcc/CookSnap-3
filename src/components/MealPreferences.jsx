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
// Meal type and hunger level are pick-ONE questions, so both are segmented
// bars (not a row of pills next to a bar), and text only: the word already
// says it, an icon in front of it repeated it. Cravings can be several at
// once, so those stay chips.
const MEAL_CATEGORIES = [
  { id: "all", labelKey: "mealType.all" },
  { id: "breakfast", labelKey: "mealType.breakfast" },
  { id: "lunch", labelKey: "mealType.lunch" },
  { id: "dinner", labelKey: "mealType.dinner" },
  { id: "dessert", labelKey: "mealType.dessert" },
];

const HUNGER_OPTIONS = [
  { id: "light", labelKey: "hunger.light" },
  { id: "normal", labelKey: "hunger.normal" },
  { id: "hungry", labelKey: "mealPrefs.hungerHearty" },
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
      {Icon ? (
        <Icon size={15} color={selected ? "#FFFFFF" : p.idleIcon} strokeWidth={2.4} />
      ) : null}
      <Text
        numberOfLines={1}
        style={[styles.chipLabel, { color: selected ? "#FFFFFF" : p.idleInk }]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// One rounded bar of segments for a pick-one question. Segment width follows
// label length (equal segments cut "Wszystkie" to "Wszyst…" in Polish). When
// the labels cannot fit one row at all — German "Frühstück / Mittagessen /
// Abendessen", French "Petit-déjeuner", Portuguese, Turkish, Finnish — the
// same choices wrap as flat chips instead of being cut off. The fit test uses
// a per-character width estimate for the 12.5px bold label plus padding.
const CHAR_W = 6.6;
const SEGMENT_PAD = 16;

function Segmented({ options, value, onChange, t }) {
  const p = usePalette();
  const [width, setWidth] = useState(0);
  const labels = options.map((o) => t(o.labelKey));
  const needed = labels.reduce((sum, l) => sum + l.length * CHAR_W + SEGMENT_PAD, 0);
  // Until measured, assume it fits (avoids a flash of wrapped chips).
  const fits = width === 0 || needed <= width - 6;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {fits ? (
        <View style={[styles.segmented, { backgroundColor: p.idleBg }]}>
          {options.map((o, i) => {
            const selected = value === o.id;
            return (
              <TouchableOpacity
                key={o.id}
                onPress={() => onChange(o.id)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.segment,
                  { flex: Math.max(labels[i].length, 4) + 3 },
                  selected && { backgroundColor: EMERALD },
                ]}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  style={[
                    styles.segmentLabel,
                    { color: selected ? "#FFFFFF" : p.idleInk },
                  ]}
                >
                  {labels[i]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View style={styles.wrapRow}>
          {options.map((o, i) => (
            <ChoiceChip
              key={o.id}
              label={labels[i]}
              selected={value === o.id}
              onPress={() => onChange(o.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function SectionLabel({ children }) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        styles.groupLabel,
        { color: colors.textSecondary },
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
        <Segmented
          options={MEAL_CATEGORIES}
          value={mealType}
          onChange={setMealType}
          t={t}
        />

        <Divider />

        <SectionLabel>{t("mealPrefs.servings")}</SectionLabel>
        {/* Same shape as the segmented bars above and below (label on top, one
            40px rounded bar underneath) instead of a stepper hanging off the
            right edge with its own tiny caption: the - and + sit inside the
            bar as raised buttons and the count reads as one phrase. The unit
            strings are stored in capitals for the old small-caps caption; here
            they read as a normal lowercase word. */}
        <View style={[styles.servingsBar, { backgroundColor: palette.idleBg }]}>
          <TouchableOpacity
            onPress={() => setServings(Math.max(1, servings - 1))}
            disabled={servings <= 1}
            activeOpacity={0.85}
            style={[
              styles.servingsBtn,
              { backgroundColor: isDark ? colors.card : "#FFFFFF", opacity: servings <= 1 ? 0.4 : 1 },
            ]}
            accessibilityLabel={t("a11y.decreaseServings")}
          >
            <Minus size={16} color={colors.textPrimary} strokeWidth={2.6} />
          </TouchableOpacity>

          <Text style={styles.servingsText} numberOfLines={1}>
            <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 17 }}>
              {servings}
            </Text>
            <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>
              {"  "}
              {(servings === 1
                ? t("mealPrefs.personUnit")
                : translateCount(recipeLanguageId, servings, {
                    few: "mealPrefs.peopleUnitFew",
                    many: "mealPrefs.peopleUnitMany",
                    fallback: "mealPrefs.peopleUnit",
                  })
              ).toLowerCase()}
            </Text>
          </Text>

          <TouchableOpacity
            onPress={() => setServings(Math.min(12, servings + 1))}
            disabled={servings >= 12}
            activeOpacity={0.85}
            style={[
              styles.servingsBtn,
              { backgroundColor: isDark ? colors.card : "#FFFFFF", opacity: servings >= 12 ? 0.4 : 1 },
            ]}
            accessibilityLabel={t("a11y.increaseServings")}
          >
            <Plus size={16} color={colors.textPrimary} strokeWidth={2.6} />
          </TouchableOpacity>
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
    minWidth: 0,
    height: 40,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 4,
    overflow: "hidden",
  },
  segmentLabel: {
    flexShrink: 1,
    fontSize: 12.5,
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
  servingsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    padding: 3,
    height: 46,
  },
  servingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
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
  servingsText: {
    flex: 1,
    textAlign: "center",
    fontSize: 14,
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
