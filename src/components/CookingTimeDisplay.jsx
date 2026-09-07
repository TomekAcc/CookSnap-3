import React from "react";
import { View, Text } from "react-native";
import { Clock } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useCookAI } from "../context/CookAIContext";
import { formatTimeLabel, sumTimeLabel, hasRealMinutes } from "../utils/timeFormat";

export default function CookingTimeDisplay({
  prepTime,
  cookTime,
  totalTime,
  variant = "card",
}) {
  const { colors } = useTheme();
  const { t } = useCookAI();
  const minUnit = t("cookingTime.minUnit");

  const prepLabel = formatTimeLabel(prepTime, minUnit);
  const cookLabel = formatTimeLabel(cookTime, minUnit);
  // hasRealMinutes, not plain truthiness: normalizeRecipe stamps a literal
  // "—" in for a missing totalTime, and that dash is a truthy string — so
  // this branch used to render the dash instead of falling through to the
  // prep+cook sum it already knows how to compute.
  const totalLabel = hasRealMinutes(totalTime)
    ? formatTimeLabel(totalTime, minUnit)
    : sumTimeLabel(prepTime, cookTime, minUnit);

  if (variant === "compact") {
    return (
      <View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Clock size={14} color="#64748B" />
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 12,
              fontWeight: "700",
            }}
          >
            {totalLabel}
          </Text>
        </View>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 12,
            fontWeight: "700",
            marginTop: 2,
          }}
        >
          {t("cookingTime.prepCookCompact", { prep: prepLabel, cook: cookLabel })}
        </Text>
      </View>
    );
  }

  if (variant === "detail") {
    return (
      <View
        style={{
          backgroundColor: colors.inputBg,
          borderRadius: 16,
          padding: 12,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: colors.cardBorder,
        }}
      >
        <Text
          style={{
            color: colors.textPrimary,
            fontWeight: "800",
            fontSize: 14,
            marginBottom: 6,
          }}
        >
          ⏱️ {totalLabel}
        </Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 11,
              fontWeight: "700",
            }}
          >
            {t("cookingTime.prep", { prep: prepLabel })}
          </Text>
          <Text style={{ color: colors.cardBorder }}>·</Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 11,
              fontWeight: "700",
            }}
          >
            {t("cookingTime.cook", { cook: cookLabel })}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: 8 }}>
      <Text
        style={{
          color: colors.textPrimary,
          fontSize: 12,
          fontWeight: "700",
          marginBottom: 4,
        }}
      >
        ⏱️ {totalLabel}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View
          style={{
            backgroundColor: colors.inputBg,
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
        >
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              fontWeight: "600",
            }}
          >
            {t("cookingTime.prep", { prep: prepLabel })}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: colors.inputBg,
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
        >
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              fontWeight: "600",
            }}
          >
            {t("cookingTime.cook", { cook: cookLabel })}
          </Text>
        </View>
      </View>
    </View>
  );
}
