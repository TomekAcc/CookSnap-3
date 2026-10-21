import React from "react";
import { View, Text, TouchableOpacity, TextInput } from "react-native";
import { Lock, SlidersHorizontal } from "../icons";
import { useModalState } from "../context/ModalContext";
import { useTheme } from "../context/ThemeContext";
import { useEntitlements } from "../context/EntitlementsContext";
import { useLanguage } from "../context/LanguageContext";
import { usePreferences } from "../context/PreferencesContext";

/**
 * Custom Diet (PRO) — free-text "always avoid" / "prefer more of" lists.
 * Lives on Profile, next to the diet switches it extends; it used to sit in
 * Settings, which meant diet preferences were split across two screens.
 */
export default function CustomDietSection() {
  const { t } = useLanguage();
  const { isPro } = useEntitlements();
  const {
    customDietAvoid,
    setCustomDietAvoid,
    customDietPrefer,
    setCustomDietPrefer,
  } = usePreferences();
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
          fontWeight: "700",
          color: colors.textPrimary,
          marginBottom: 8,
          letterSpacing: -0.2,
        }}
      >
        {t("settings.customDiet")}
      </Text>

      {!isPro ? (
        // Locked state: a neutral row like the diet rows above it, with a small
        // PRO tag. It used to be a full amber card ("Custom Diet (PRO)" + lock)
        // sitting directly above the real "Upgrade to PRO" card, so the screen
        // pitched PRO twice in a row. One amber block per screen now.
        <TouchableOpacity
          onPress={() => setProModalOpen(true)}
          activeOpacity={0.85}
          accessibilityRole="button"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            borderRadius: 18,
            paddingVertical: 12,
            paddingHorizontal: 14,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: isDark ? colors.inputBg : "#F3F5F8",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <SlidersHorizontal size={18} color={colors.textSecondary} strokeWidth={2.2} />
          </View>
          <Text
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 13.5,
              fontWeight: "600",
              lineHeight: 18,
              color: colors.textPrimary,
            }}
            numberOfLines={3}
          >
            {t("settings.customDietProDesc")}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
              backgroundColor: isDark ? "rgba(245,158,11,0.16)" : "#FEF3C7",
            }}
          >
            <Lock size={11} color={isDark ? "#FCD34D" : "#B45309"} strokeWidth={2.6} />
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 0.5,
                color: isDark ? "#FCD34D" : "#B45309",
              }}
            >
              PRO
            </Text>
          </View>
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
                fontWeight: "700",
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
                fontWeight: "700",
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
