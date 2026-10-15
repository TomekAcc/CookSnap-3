import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, Ruler, Thermometer, ChefHat, ChevronRight } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useCookAI } from "../context/CookAIContext";
import { LANGUAGE_OPTIONS, DEFAULT_LANGUAGE_ID, getLanguageById } from "../data/languageOptions";
import { translate } from "../i18n";

/**
 * First-launch gate — shown once, before the main app shell ever mounts
 * (see App.jsx's RootGate). Lets a brand-new user confirm the language and
 * measurement units up front instead of discovering them buried in
 * Settings later. Both selections here write straight into CookAIContext
 * (same `recipeLanguageId` / `unitSystem` state Settings itself edits), so
 * there's no separate onboarding-only state to keep in sync.
 *
 * One page, not two: an earlier version of this screen briefly split
 * language and units into separate steps, after a tester found the
 * original single page overwhelming (all 31 languages listed inline).
 * That collapse-the-language-list fix (below) turned out to be the real
 * solution on its own — once language defaults to a single summary row,
 * there's too little content left to justify a whole extra step, and a
 * live screenshot from that two-step version showed both steps reading as
 * sparse/empty rather than focused. Recombined once the actual cause
 * (the long inline list, not "too many things on one page") was fixed.
 *
 * Deliberately defaults the highlighted language to English rather than
 * CookAIContext's device-auto-detected `recipeLanguageId` — that value
 * updates asynchronously after an AsyncStorage read resolves, which raced
 * against this screen's own text and produced a real bug: the checkbox
 * showing "English" selected while the surrounding title/button had
 * already flipped to the device's detected language (e.g. German) via
 * `t()`. Using a local `translate()` call keyed off `selectedLanguage`
 * (never the context's `t()`) means this screen's own text and the
 * highlighted row are always driven by the exact same value, and picking
 * a different language in the list updates the title/subtitle/button
 * instantly, live, before the user ever taps Get Started.
 */
export default function OnboardingScreen({ onContinue }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const {
    setRecipeLanguageId,
    unitSystem,
    setUnitSystem,
    recipeLanguageId,
    recipeLanguageHydrated,
  } = useCookAI();

  const [selectedLanguage, setSelectedLanguage] = useState(DEFAULT_LANGUAGE_ID);
  const [selectedUnits, setSelectedUnits] = useState(unitSystem);
  const t = (key, vars) => translate(selectedLanguage, key, vars);

  // Collapsed by default to a single summary row for the detected/current
  // language — the full 31-language list only appears once the user
  // explicitly asks to change it, instead of always dominating the screen.
  const [showAllLanguages, setShowAllLanguages] = useState(false);

  // Once the device-auto-detected language finishes hydrating from
  // AsyncStorage, adopt it as the pre-highlighted choice — a Spanish-
  // device user should see this very first screen in Spanish, not have
  // the auto-detect feature go to waste on the one screen where a first
  // impression matters most. Guarded by `userPickedRef` so this can never
  // clobber an explicit tap once the user has actually chosen — and it
  // only fires once hydration resolves (not on every recipeLanguageId
  // change), so it can't fight a user's selection on a later render.
  const userPickedRef = useRef(false);
  useEffect(() => {
    if (recipeLanguageHydrated && !userPickedRef.current) {
      setSelectedLanguage(recipeLanguageId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeLanguageHydrated]);

  const handleSelectLanguage = (id) => {
    userPickedRef.current = true;
    setSelectedLanguage(id);
    // Collapses back to the summary row showing the new pick — picking a
    // language is "done" the moment you tap one, no need to keep the full
    // list open after that.
    setShowAllLanguages(false);
  };

  const handleGetStarted = () => {
    setRecipeLanguageId(selectedLanguage);
    setUnitSystem(selectedUnits);
    onContinue();
  };

  const selectedLanguageOption = getLanguageById(selectedLanguage);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 32,
          paddingHorizontal: 20,
          paddingBottom: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: "center", marginBottom: 28 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 24,
              backgroundColor: isDark ? "rgba(16,185,129,0.16)" : "#ECFDF5",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <ChefHat size={30} color={isDark ? "#34D399" : "#059669"} />
          </View>
          <Text
            style={{
              fontSize: 24,
              fontWeight: "800",
              letterSpacing: -0.4,
              color: colors.textPrimary,
              textAlign: "center",
            }}
          >
            {t("onboarding.welcomeTitle")}
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "500",
              color: colors.textSecondary,
              marginTop: 6,
              textAlign: "center",
            }}
          >
            {t("onboarding.welcomeSubtitle")}
          </Text>
        </View>

        <Text
          style={{
            fontSize: 13,
            fontWeight: "800",
            color: colors.textPrimary,
            marginBottom: 8,
          }}
        >
          {t("onboarding.chooseLanguage")}
        </Text>

        {/* Collapsed by default: just the detected/current language as a
            single summary row, with an explicit "Change" action — the
            full 31-language list (below) only appears once asked for,
            instead of dominating the screen. */}
        {!showAllLanguages ? (
          <TouchableOpacity
            onPress={() => setShowAllLanguages(true)}
            activeOpacity={0.7}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: colors.card,
              borderRadius: 18,
              paddingVertical: 16,
              paddingHorizontal: 16,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              marginBottom: 24,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ fontSize: 24 }}>{selectedLanguageOption.flag}</Text>
              <Text
                style={{ fontSize: 16, fontWeight: "800", color: colors.textPrimary }}
              >
                {selectedLanguageOption.name}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#10B981" }}>
                {t("onboarding.changeLanguage")}
              </Text>
              <ChevronRight size={16} color="#10B981" />
            </View>
          </TouchableOpacity>
        ) : (
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 18,
              padding: 6,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              marginBottom: 24,
            }}
          >
            {LANGUAGE_OPTIONS.map((lang, index) => {
              const isSelected = selectedLanguage === lang.id;
              const isLast = index === LANGUAGE_OPTIONS.length - 1;
              return (
                <TouchableOpacity
                  key={lang.id}
                  onPress={() => handleSelectLanguage(lang.id)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 14,
                    paddingHorizontal: 12,
                    borderBottomWidth: isLast ? 0 : 1,
                    borderBottomColor: colors.cardBorder,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Text style={{ fontSize: 20 }}>{lang.flag}</Text>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "800",
                        color: colors.textPrimary,
                      }}
                    >
                      {lang.name}
                    </Text>
                  </View>
                  {isSelected ? (
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: "#10B981",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Check size={14} color="#FFFFFF" strokeWidth={2.5} />
                    </View>
                  ) : (
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 1.5,
                        borderColor: colors.cardBorder,
                      }}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text
          style={{
            fontSize: 13,
            fontWeight: "800",
            color: colors.textPrimary,
            marginBottom: 8,
          }}
        >
          {t("onboarding.chooseUnits")}
        </Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          <TouchableOpacity
            onPress={() => setSelectedUnits("us")}
            activeOpacity={0.88}
            style={{
              flex: 1,
              paddingVertical: 14,
              paddingHorizontal: 10,
              borderRadius: 16,
              backgroundColor: colors.card,
              borderWidth: 2,
              borderColor: selectedUnits === "us" ? "#10B981" : colors.cardBorder,
              alignItems: "center",
              gap: 4,
              overflow: "hidden",
            }}
          >
            <Ruler size={20} color={selectedUnits === "us" ? "#10B981" : colors.textSecondary} />
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                fontSize: 12,
                fontWeight: "800",
                textAlign: "center",
                width: "100%",
                minWidth: 0,
                color: selectedUnits === "us" ? "#10B981" : colors.textPrimary,
              }}
            >
              {t("settings.usUnits")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSelectedUnits("metric")}
            activeOpacity={0.88}
            style={{
              flex: 1,
              paddingVertical: 14,
              paddingHorizontal: 10,
              borderRadius: 16,
              backgroundColor: colors.card,
              borderWidth: 2,
              borderColor: selectedUnits === "metric" ? "#10B981" : colors.cardBorder,
              alignItems: "center",
              gap: 4,
              overflow: "hidden",
            }}
          >
            <Thermometer
              size={20}
              color={selectedUnits === "metric" ? "#34D399" : colors.textSecondary}
            />
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                fontSize: 12,
                fontWeight: "800",
                textAlign: "center",
                width: "100%",
                minWidth: 0,
                color: selectedUnits === "metric" ? "#34D399" : colors.textPrimary,
              }}
            >
              {t("settings.metricUnits")}
            </Text>
          </TouchableOpacity>
        </View>

        <Text
          style={{
            fontSize: 12,
            fontWeight: "500",
            color: colors.textSecondary,
            textAlign: "center",
            lineHeight: 17,
            marginTop: 10,
            paddingHorizontal: 8,
          }}
        >
          {t("onboarding.unitsCaption")}
        </Text>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: insets.bottom + 16,
          borderTopWidth: 1,
          borderTopColor: colors.cardBorder,
          backgroundColor: colors.bg,
        }}
      >
        <TouchableOpacity
          onPress={handleGetStarted}
          activeOpacity={0.88}
          style={{
            backgroundColor: "#10B981",
            borderRadius: 18,
            paddingVertical: 16,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 16 }}>
            {t("onboarding.getStarted")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
