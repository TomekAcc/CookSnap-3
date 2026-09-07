import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { X } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { GREEN, emojiLine } from "../theme/tokens";

/**
 * Uniform ingredient / filter pill.
 *
 * Selected state is the app's ONE selected language: pale green fill,
 * green border, green label — identical to the meal-type pills and hunger
 * tiles in MealPreferences, so every selectable control in the app says
 * "chosen" the same way.
 *
 * There used to be a `selectedColor` prop for this. It defaulted to a
 * near-black fill, which is the app's PRIMARY BUTTON colour — so a
 * selected filter looked like something to press. Profile's diet pills
 * passed green to escape that while the craving tags didn't, which meant
 * one component rendered "selected" two different ways on two screens.
 * Removing the prop removes the ability to drift.
 */
export default function PillTag({
  emoji,
  label,
  onPress,
  onRemove,
  selected = false,
  style,
  labelStyle,
}) {
  const { colors, isDark } = useTheme();

  const bg = selected
    ? isDark
      ? colors.accentGreenSoft
      : GREEN.soft
    : isDark
      ? colors.inputBg
      : "#F8FAFC";
  const border = selected
    ? isDark
      ? colors.accentGreen
      : GREEN.primary
    : "transparent";
  const textColor = selected
    ? isDark
      ? GREEN.darkInk
      : GREEN.ink
    : isDark
      ? colors.textPrimary
      : "#1E293B";
  const mutedIcon = selected
    ? textColor
    : isDark
      ? colors.textSecondary
      : "#64748B";

  const content = (
    <>
      {emoji ? (
        <Text style={styles.emoji} allowFontScaling={false}>
          {emoji}
        </Text>
      ) : null}
      {label ? (
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            { color: textColor, marginLeft: emoji ? 5 : 0 },
            labelStyle,
          ]}
        >
          {label}
        </Text>
      ) : null}
      {onRemove ? (
        <TouchableOpacity
          onPress={onRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.remove}
          accessibilityLabel={label ? `Remove ${label}` : "Remove"}
        >
          <X size={12} color={mutedIcon} strokeWidth={2.5} />
        </TouchableOpacity>
      ) : null}
    </>
  );

  const pillStyle = [
    styles.pill,
    {
      backgroundColor: bg,
      borderColor: border,
      // Confirmed real feedback: this used to be 0 when selected, 1
      // otherwise — a 1px-per-side box-size change on every tap, which
      // shifted every later pill in a wrapped row (e.g. selecting "Spicy"
      // visibly nudged "Sweet" toward it). borderColor alone already goes
      // fully transparent when selected, so fixing the width at a
      // constant 1 keeps every pill's box size identical whether it's
      // selected or not — nothing to reflow.
      borderWidth: 1,
    },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={pillStyle}
        accessibilityRole="button"
        accessibilityState={{ selected }}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={pillStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: "100%",
  },
  // 18, matching MealPreferences' meal-type pills — these render as two
  // pill rows on the same screen and were 15 vs 22.
  emoji: {
    fontSize: 18,
    lineHeight: emojiLine(18),
  },
  // Matches MealPreferences' own hand-rolled meal-type pills (mealPillLabel:
  // fontWeight "600") — same 13px/-0.1 letterSpacing already, but this was
  // 500 while that one is 600, a real (if small) weight mismatch between
  // two rows of pills sitting right on top of each other on the same
  // screen. This is the shared component (6 screens), so the fix applies
  // everywhere pills render, not just the craving tags it was reported on.
  label: {
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
    letterSpacing: -0.1,
  },
  remove: {
    marginLeft: 5,
    padding: 1,
  },
});
