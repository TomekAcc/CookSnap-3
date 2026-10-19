import React, { useState, useRef } from "react";
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
  Waves,
  Flame,
  Candy,
  Beef,
  Leaf,
  Soup,
  Minus,
  Plus,
  ChevronDown,
  ChevronRight,
  Check,
} from "lucide-react-native";
import { useCookAI } from "../context/CookAIContext";
import { useTheme } from "../context/ThemeContext";
import { translateCount } from "../i18n";
import StandardSmoothModal from "./StandardSmoothModal";

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
    padding: 18,
    // Soft lift so the cards read as separate surfaces on the grey page.
    shadowColor: "#0F172A",
    shadowOpacity: isDark ? 0 : 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 0,
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

// Multi-select cravings as an equal 2-column grid (3 rows for the 6 tags):
// every cell the same size, flush with both edges. One icon style (lucide,
// same size and stroke) in front of each label; selected = solid emerald.
function CravingGrid({ tags, selectedIds, onToggle, t }) {
  const p = usePalette();
  const rows = [];
  for (let i = 0; i < tags.length; i += 2) rows.push(tags.slice(i, i + 2));
  return (
    <View style={{ gap: 10 }}>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: "row", gap: 10 }}>
          {row.map((tag) => {
            const selected = selectedIds.includes(tag.id);
            const Icon = tag.Icon;
            return (
              <TouchableOpacity
                key={tag.id}
                onPress={() => onToggle(tag.id)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.cell, { backgroundColor: selected ? EMERALD : p.idleBg }]}
              >
                <Icon size={18} color={selected ? "#FFFFFF" : p.muted} strokeWidth={2.2} />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  style={[
                    styles.cellLabel,
                    { color: selected ? "#FFFFFF" : p.idleInk, fontWeight: selected ? "700" : "600" },
                  ]}
                >
                  {t(tag.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
          {row.length < 2 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

// Servings unit stored in capitals ("PEOPLE"): shown as a normal word, except
// German, whose nouns keep a capital.
function softCase(text, lang) {
  const lower = String(text || "").toLowerCase();
  return lang === "de" ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
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

function Divider({ tight = false }) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.divider, tight && { marginVertical: 16 }, { backgroundColor: colors.cardBorder }]}
    />
  );
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

  // One interaction model for everything: a compact bar (meal type, servings,
  // hunger level) whose values each open a small picker sheet, plus one "More
  // options" row that opens a second sheet (pantry switch, cravings, one-off
  // exclusion). The old open/close accordion with segmented bars is gone: it
  // meant two different ways to set the same thing, and cravings sat two
  // levels deep (arrow, then "More options").
  const [picker, setPicker] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const lastPickerRef = useRef("meal");
  if (picker) lastPickerRef.current = picker;

  const unitText = softCase(
    servings === 1
      ? t("mealPrefs.personUnit")
      : translateCount(recipeLanguageId, servings, {
          few: "mealPrefs.peopleUnitFew",
          many: "mealPrefs.peopleUnitMany",
          fallback: "mealPrefs.peopleUnit",
        }),
    recipeLanguageId
  );
  const mealLabel = t((MEAL_CATEGORIES.find((o) => o.id === mealType) || MEAL_CATEGORIES[0]).labelKey);
  const hungerLabel = t((HUNGER_OPTIONS.find((o) => o.id === hungerLevel) || HUNGER_OPTIONS[1]).labelKey);
  const summaryFields = [
    { kind: "meal", label: t("mealPrefs.mealTypeTitle"), value: mealLabel },
    { kind: "servings", label: t("mealPrefs.servings"), value: `${servings} ${unitText}` },
    { kind: "hunger", label: t("profile.hungerLevel"), value: hungerLabel },
  ];
  const pickerKind = picker || lastPickerRef.current;
  const pickerTitle =
    pickerKind === "meal"
      ? t("mealPrefs.mealTypeTitle")
      : pickerKind === "servings"
      ? t("mealPrefs.servings")
      : t("profile.hungerLevel");
  const pickerOptions = pickerKind === "meal" ? MEAL_CATEGORIES : HUNGER_OPTIONS;

  // What the "More options" row shows when something is set, so a hidden choice
  // is never forgotten: cravings, a one-off exclusion, pantry switched off.
  const moreParts = [];
  if (!includePantryStaples) moreParts.push(t("mealPrefs.pantryOff"));
  if (cravingTags.length > 0) {
    moreParts.push(
      cravingTags
        .map((id) => CRAVING_TAGS.find((tag) => tag.id === id))
        .filter(Boolean)
        .map((tag) => t(tag.labelKey))
        .join(", ")
    );
  }
  if (excludeThisBatch) moreParts.push(`− ${excludeThisBatch}`);

  return (
    <View style={styles.root}>
      <View>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {t("mealPrefs.title")}
        </Text>
      </View>

      <View style={[card, styles.summaryCard]}>
        {summaryFields.map((f, i) => (
          <TouchableOpacity
            key={f.kind}
            onPress={() => setPicker(f.kind)}
            activeOpacity={0.7}
            accessibilityRole="button"
            style={[
              styles.summaryCol,
              i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.cardBorder },
            ]}
          >
            <Text
              style={[styles.summaryLabel, { color: colors.textSecondary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {f.label}
            </Text>
            <View style={styles.summaryValueRow}>
              <Text
                style={[styles.summaryValue, { color: colors.textPrimary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {f.value}
              </Text>
              <ChevronDown size={12} color={colors.textSecondary} strokeWidth={2.6} />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        onPress={() => setMoreOpen(true)}
        activeOpacity={0.75}
        accessibilityRole="button"
        style={[card, styles.moreCard]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.moreLabel, { color: colors.textPrimary }]}>
            {t("mealPrefs.moreOptions")}
          </Text>
          {moreParts.length > 0 ? (
            <Text style={[styles.moreSummary, { color: colors.textSecondary }]} numberOfLines={1}>
              {moreParts.join("  ·  ")}
            </Text>
          ) : null}
        </View>
        <ChevronRight size={18} color={colors.textSecondary} strokeWidth={2.4} />
      </TouchableOpacity>

      {/* Picker for the bar: one small sheet per field. */}
      <StandardSmoothModal
        visible={!!picker}
        onClose={() => setPicker(null)}
        title={pickerTitle}
        type="bottom-sheet"
        scroll={false}
        dragAnywhere
      >
        <View style={{ paddingBottom: 4 }}>
          {pickerKind === "servings" ? (
            <View style={{ alignItems: "center", paddingTop: 4 }}>
              <View style={styles.bigStepper}>
                <TouchableOpacity
                  onPress={() => setServings(Math.max(1, servings - 1))}
                  disabled={servings <= 1}
                  activeOpacity={0.85}
                  accessibilityLabel={t("a11y.decreaseServings")}
                  style={[styles.bigStepBtn, { backgroundColor: palette.idleBg, opacity: servings <= 1 ? 0.4 : 1 }]}
                >
                  <Minus size={22} color={colors.textPrimary} strokeWidth={2.6} />
                </TouchableOpacity>
                <View style={{ alignItems: "center", minWidth: 96 }}>
                  <Text style={[styles.bigNumber, { color: colors.textPrimary }]}>{servings}</Text>
                  <Text style={[styles.bigUnit, { color: colors.textSecondary }]}>{unitText}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setServings(Math.min(12, servings + 1))}
                  disabled={servings >= 12}
                  activeOpacity={0.85}
                  accessibilityLabel={t("a11y.increaseServings")}
                  style={[styles.bigStepBtn, { backgroundColor: palette.idleBg, opacity: servings >= 12 ? 0.4 : 1 }]}
                >
                  <Plus size={22} color={colors.textPrimary} strokeWidth={2.6} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => setPicker(null)}
                activeOpacity={0.85}
                accessibilityRole="button"
                style={styles.doneBtn}
              >
                <Text style={styles.doneText}>{t("settings.done")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            pickerOptions.map((o, i) => {
              const selected = (pickerKind === "meal" ? mealType : hungerLevel) === o.id;
              return (
                <TouchableOpacity
                  key={o.id}
                  onPress={() => {
                    if (pickerKind === "meal") setMealType(o.id);
                    else setHungerLevel(o.id);
                    setPicker(null);
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.optionRow,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.cardBorder },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: selected ? "#059669" : colors.textPrimary, fontWeight: selected ? "800" : "600" },
                    ]}
                  >
                    {t(o.labelKey)}
                  </Text>
                  {selected ? <Check size={20} color="#059669" strokeWidth={3} /> : null}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </StandardSmoothModal>

      {/* "More options": pantry switch, cravings, one-off exclusion. */}
      <StandardSmoothModal
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        title={t("mealPrefs.moreOptions")}
        type="bottom-sheet"
        compactBottom
        // Short sheet: the default 48 px of padding inside the scroll area, on
        // top of the sheet's own home-bar padding, left a big empty band under
        // "Done".
        scrollProps={{
          keyboardShouldPersistTaps: "handled",
          contentContainerStyle: { paddingBottom: 0 },
        }}
      >
        <TouchableOpacity
          onPress={() => setIncludePantryStaples((prev) => !prev)}
          activeOpacity={0.7}
          accessibilityRole="switch"
          accessibilityState={{ checked: includePantryStaples }}
          style={[styles.staplesRow, { paddingTop: 10 }]}
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

        <Divider tight />

        <SectionLabel>{t("mealPrefs.cravingTitle")}</SectionLabel>
        <CravingGrid
          tags={CRAVING_TAGS}
          selectedIds={cravingTags}
          onToggle={toggleCravingTag}
          t={t}
        />

        <View style={[styles.excludeBox, { backgroundColor: palette.idleBg }]}>
          <Sparkles size={14} color={isDark ? colors.textSecondary : "#94A3B8"} />
          <TextInput
            value={excludeThisBatch}
            onChangeText={setExcludeThisBatch}
            placeholder={t("mealPrefs.excludeThisBatchPlaceholder")}
            placeholderTextColor={colors.textSecondary}
            style={[styles.excludeInput, { color: colors.textPrimary }]}
            returnKeyType="done"
            onSubmitEditing={() => setMoreOpen(false)}
          />
        </View>

        <TouchableOpacity
          onPress={() => setMoreOpen(false)}
          activeOpacity={0.85}
          accessibilityRole="button"
          style={[styles.doneBtn, { marginTop: 18 }]}
        >
          <Text style={styles.doneText}>{t("settings.done")}</Text>
        </TouchableOpacity>
      </StandardSmoothModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 20,
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
  summaryCard: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  moreCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  moreSummary: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 3,
  },
  excludeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 14,
  },
  summaryCol: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    gap: 4,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  summaryValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  summaryValue: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  optionText: {
    fontSize: 16,
  },
  bigStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  bigStepBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  bigNumber: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  bigUnit: {
    fontSize: 13,
    fontWeight: "600",
  },
  doneBtn: {
    alignSelf: "stretch",
    height: 48,
    borderRadius: 14,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  cell: {
    flex: 1,
    minWidth: 0,
    height: 50,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
  },
  cellLabel: {
    flexShrink: 1,
    fontSize: 14,
    letterSpacing: -0.1,
  },
  moreLabel: {
    fontSize: 15,
    fontWeight: "700",
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
});
