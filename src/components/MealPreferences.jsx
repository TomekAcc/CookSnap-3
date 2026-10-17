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
  Minus,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react-native";
import { useCookAI } from "../context/CookAIContext";
import { useTheme } from "../context/ThemeContext";
import { animateLayout } from "../utils/layoutMotion";
import { RADIUS } from "../theme/tokens";

// Every option on this screen is text only, and every selected option looks
// the same: solid emerald with a white bold label. (A white "raised pill"
// selection was tried and read as no selection at all next to the green
// cravings tags; icons inside the cravings chips clashed with the plain
// segments above.) Meal type and hunger level are pick-ONE questions, so both
// are segmented bars; cravings can be several at once, so those are chips.
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
  { id: "salty", labelKey: "mealPrefs.cravingSalty" },
  { id: "spicy", labelKey: "mealPrefs.cravingSpicy" },
  { id: "sweet", labelKey: "mealPrefs.cravingSweet" },
  { id: "savory", labelKey: "mealPrefs.cravingSavory" },
  { id: "light", labelKey: "mealPrefs.cravingLight" },
  { id: "comfort", labelKey: "mealPrefs.cravingComfort" },
];

const EMERALD = "#10B981";

function cardStyle(isDark, colors) {
  return {
    backgroundColor: isDark ? colors.card : "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: isDark ? colors.cardBorder : "#E5E7EB",
    padding: 18,
  };
}

function usePalette() {
  const { colors, isDark } = useTheme();
  return {
    idleBg: isDark ? colors.inputBg : "#F3F5F8",
    idleInk: isDark ? colors.textPrimary : "#1E293B",
    muted: colors.textSecondary,
    isDark,
    colors,
  };
}

// Flat chip: neutral fill, no border, label only. Selected = solid emerald
// with white label (the same width in both states, so nothing shifts).
function ChoiceChip({ label, selected, onPress }) {
  const p = usePalette();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, { backgroundColor: selected ? EMERALD : p.idleBg }]}
    >
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
const CHAR_W = 6.3; // average glyph width of a 12px semibold label
const CELL_PAD = 4;
// On iOS/Android the label shrinks to 80% (adjustsFontSizeToFit) before it is
// cut, so a label may need up to ~12% less than its natural width.
const SHRINK_ALLOWANCE = 0.88;

// Every cell is the same width, so the bars line up on both edges and with
// each other (5 equal fifths for meal type, 3 equal thirds for hunger level
// and for the servings stepper). Where the longest label cannot fit its cell
// (German "Mittagessen", French "Petit-déjeuner", ...), the same choices go
// onto two full-width rows (3 + 2) instead of loose pills — still equal
// cells, still flush with both edges.
function Segmented({ options, value, onChange, t }) {
  const p = usePalette();
  const [width, setWidth] = useState(0);
  const labels = options.map((o) => t(o.labelKey));
  const n = options.length;
  const longest = labels.reduce((m, l) => Math.max(m, l.length), 0);
  const cellWidth = (width - 6 - (n - 1) * 3) / n;
  // Until measured, assume it fits (avoids a flash of two rows).
  const fits = width === 0 || longest * CHAR_W * SHRINK_ALLOWANCE + CELL_PAD <= cellWidth;
  const rows = fits
    ? [options.map((_, i) => i)]
    : n <= 2
    ? [options.map((_, i) => i)]
    : [
        options.slice(0, Math.ceil(n / 2)).map((_, i) => i),
        options.slice(Math.ceil(n / 2)).map((_, i) => i + Math.ceil(n / 2)),
      ];

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.segmented, { backgroundColor: p.idleBg }]}
    >
      {rows.map((row, ri) => (
        <View key={ri} style={styles.segmentRow}>
          {row.map((i) => {
            const o = options[i];
            const selected = value === o.id;
            return (
              <TouchableOpacity
                key={o.id}
                onPress={() => onChange(o.id)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.segment, selected && { backgroundColor: EMERALD }]}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  style={[
                    styles.segmentLabel,
                    { color: selected ? "#FFFFFF" : p.idleInk, fontWeight: selected ? "700" : "600" },
                  ]}
                >
                  {labels[i]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
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

        {/* Same structure as the two bars around it: label above, one full-width
            track, equal thirds. The number sits in the middle third, directly
            under the middle segment of the hunger bar. */}
        <SectionLabel>{t("mealPrefs.servings")}</SectionLabel>
        <View style={[styles.segmented, { backgroundColor: palette.idleBg }]}>
          <View style={styles.segmentRow}>
            <TouchableOpacity
              onPress={() => setServings(Math.max(1, servings - 1))}
              disabled={servings <= 1}
              activeOpacity={0.85}
              style={[
                styles.segment,
                { backgroundColor: isDark ? colors.card : "#FFFFFF", opacity: servings <= 1 ? 0.4 : 1 },
              ]}
              accessibilityLabel={t("a11y.decreaseServings")}
            >
              <Minus size={18} color={colors.textPrimary} strokeWidth={2.6} />
            </TouchableOpacity>

            <View style={styles.segment}>
              <Text style={[styles.servingsText, { color: colors.textPrimary }]} numberOfLines={1}>
                {servings}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setServings(Math.min(12, servings + 1))}
              disabled={servings >= 12}
              activeOpacity={0.85}
              style={[
                styles.segment,
                { backgroundColor: isDark ? colors.card : "#FFFFFF", opacity: servings >= 12 ? 0.4 : 1 },
              ]}
              accessibilityLabel={t("a11y.increaseServings")}
            >
              <Plus size={18} color={colors.textPrimary} strokeWidth={2.6} />
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

        {/* Pantry staples — whole row is the touch target (tapping the text used
            to do nothing); pointerEvents="none" on the Switch stops a direct tap
            from double-toggling via bubbling. No amber badge: amber means PRO. */}
        <TouchableOpacity
          onPress={() => setIncludePantryStaples((prev) => !prev)}
          activeOpacity={0.7}
          accessibilityRole="switch"
          accessibilityState={{ checked: includePantryStaples }}
          style={styles.staplesRow}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              {t("mealPrefs.includeStaples")}
            </Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
              {t("mealPrefs.staplesDesc")}
            </Text>
          </View>
          <Switch
            value={includePantryStaples}
            onValueChange={setIncludePantryStaples}
            pointerEvents="none"
            trackColor={{ false: "#E5E7EB", true: "#10B981" }}
            thumbColor="#FFFFFF"
          />
        </TouchableOpacity>

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
            {moreOpen ? (
              <ChevronUp size={18} color={colors.textSecondary} strokeWidth={2.4} />
            ) : (
              <ChevronDown size={18} color={colors.textSecondary} strokeWidth={2.4} />
            )}
          </View>
        </TouchableOpacity>

        {moreOpen ? (
          <View style={{ marginTop: 20 }}>
            <SectionLabel>{t("mealPrefs.cravingTitle")}</SectionLabel>
            <View style={styles.wrapRow}>
              {CRAVING_TAGS.map((tag) => (
                <ChoiceChip
                  key={tag.id}
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
    gap: 16,
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
    fontSize: 12,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 24,
  },
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
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
    borderRadius: 14,
    padding: 3,
    gap: 3,
  },
  segmentRow: {
    flexDirection: "row",
    gap: 3,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    height: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  segmentLabel: {
    flexShrink: 1,
    fontSize: 12,
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
  staplesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
  },
});
