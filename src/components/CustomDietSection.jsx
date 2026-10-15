import React from "react";
import { View, Text, TouchableOpacity, TextInput } from "react-native";
import { Crown, Lock } from "lucide-react-native";
import { useCookAI } from "../context/CookAIContext";
import { useModalState } from "../context/ModalContext";
import { useTheme } from "../context/ThemeContext";

/**
 * Custom Diet (PRO) — free-text "always avoid" / "prefer more of" lists.
 * Lives on Profile, next to the diet switches it extends; it used to sit in
 * Settings, which meant diet preferences were split across two screens.
 */
export default function CustomDietSection() {
  const {
    t,
    isPro,
    customDietAvoid,
    setCustomDietAvoid,
    customDietPrefer,
    setCustomDietPrefer,
  } = useCookAI();
  const { setProModalOpen } = useModalState();
  const { colors, isDark } = useTheme();

  // Custom Diet — PRO only. Two free-text lists rather than an
  // open-ended "describe your diet" field: "always avoid" plugs
  // into the same code-level keyword safety net the 9 preset diets
  // use (see getDietViolation in geminiRecipes.js) since it's a
  // literal ingredient name, not a philosophy an LLM has to
  // interpret — a free-text diet description couldn't get that
  // same enforcement, and prompt wording alone was already proven
  // unreliable for hard constraints (see buildDietaryGuardrail's
  // comment). "Prefer more of" is a softer nudge with no such
  // enforcement, since failing to lean into a liked ingredient
  // isn't a safety issue the way an allergy is.
  return (
    <View style={{ marginBottom: 14 }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: "800",
          color: colors.textPrimary,
          marginBottom: 8,
          letterSpacing: -0.2,
        }}
      >
        {t("settings.customDiet")}
      </Text>

      {!isPro ? (
        <TouchableOpacity
          onPress={() => setProModalOpen(true)}
          activeOpacity={0.85}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: isDark ? "rgba(245,158,11,0.14)" : "#FFFBEB",
            borderWidth: 1,
            borderColor: isDark ? "rgba(245,158,11,0.35)" : "#FDE68A",
            borderRadius: 16,
            paddingVertical: 10,
            paddingHorizontal: 14,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: "rgba(245,158,11,0.16)",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Crown size={16} color="#F59E0B" fill="#FDE68A" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "800",
                color: isDark ? "#FCD34D" : "#78350F",
              }}
            >
              {t("settings.customDietTitle")}
            </Text>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "600",
                color: isDark ? "#FBBF24" : "#92400E",
                marginTop: 1,
              }}
              numberOfLines={2}
            >
              {t("settings.customDietProDesc")}
            </Text>
          </View>
          <Lock size={16} color="#B45309" />
        </TouchableOpacity>
      ) : (
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 18,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            gap: 14,
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "800",
                color: colors.textPrimary,
                marginBottom: 4,
              }}
            >
              {t("settings.customDietAvoidLabel")}
            </Text>
            <TextInput
              value={customDietAvoid}
              onChangeText={setCustomDietAvoid}
              placeholder={t("settings.customDietAvoidPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              style={{
                backgroundColor: colors.inputBg,
                borderWidth: 1,
                borderColor: colors.cardBorder,
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 11,
                fontSize: 14,
                fontWeight: "500",
                color: colors.textPrimary,
              }}
              returnKeyType="done"
            />
            <Text
              style={{
                fontSize: 11,
                color: colors.textSecondary,
                marginTop: 5,
                lineHeight: 15,
              }}
            >
              {t("settings.customDietAvoidHint")}
            </Text>
          </View>

          <View>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "800",
                color: colors.textPrimary,
                marginBottom: 4,
              }}
            >
              {t("settings.customDietPreferLabel")}
            </Text>
            <TextInput
              value={customDietPrefer}
              onChangeText={setCustomDietPrefer}
              placeholder={t("settings.customDietPreferPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              style={{
                backgroundColor: colors.inputBg,
                borderWidth: 1,
                borderColor: colors.cardBorder,
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 11,
                fontSize: 14,
                fontWeight: "500",
                color: colors.textPrimary,
              }}
              returnKeyType="done"
            />
            <Text
              style={{
                fontSize: 11,
                color: colors.textSecondary,
                marginTop: 5,
                lineHeight: 15,
              }}
            >
              {t("settings.customDietPreferHint")}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
