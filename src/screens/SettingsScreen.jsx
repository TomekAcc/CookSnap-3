import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Settings,
  Sun,
  Moon,
  Ruler,
  Thermometer,
  Scale,
  Refrigerator,
  Package,
  Check,
  ChevronRight,
  ChevronLeft,
  Crown,
  Lock,
} from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useCookAI } from "../context/CookAIContext";
import { useModalState } from "../context/ModalContext";
import { FULL_DIETARY_OPTIONS } from "../data/dietaryOptions";
import { LANGUAGE_OPTIONS, getLanguageById } from "../data/languageOptions";
import IconBadge from "../components/IconBadge";
import StandardModal from "../components/StandardModal";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { theme, toggleTheme, isDark, colors } = useTheme();
  const {
    dietaryRestrictions,
    toggleDietaryRestriction,
    customDietAvoid,
    setCustomDietAvoid,
    customDietPrefer,
    setCustomDietPrefer,
    unitSystem,
    setUnitSystem,
    ingredientPriority,
    setIngredientPriority,
    recipeLanguageId,
    setRecipeLanguageId,
    isPro,
    activatePro,
    deactivatePro,
    resetOnboarding,
    setActiveTab,
    settingsDoneHintShown,
    markSettingsDoneHintShown,
    t,
  } = useCookAI();
  const { setProModalOpen } = useModalState();
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [unitsPickerOpen, setUnitsPickerOpen] = useState(false);
  const selectedLanguage = getLanguageById(recipeLanguageId);

  // Real feedback: the "Done" button only earns its keep on someone's
  // very first visit — after that they already know Settings has a way
  // out via the header's back arrow, and the button just adds noise on
  // every later visit. Captured once via the lazy initializer (not read
  // live) so THIS visit still shows it even once markSettingsDoneHintShown
  // flips the underlying flag true a moment later.
  const [showDoneHint] = useState(() => !settingsDoneHintShown);
  useEffect(() => {
    if (showDoneHint) markSettingsDoneHintShown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — matches the Pantry &amp; Staples / Saved Recipes standard
            exactly: IconBadge, 24/800/-0.4 title, 13/500 subtitle with the
            same margin rhythm (title row marginBottom 8, subtitle
            marginBottom 24 doubling as the gap before the next block).
            Confirmed real failure, reported by a first-time tester: Settings
            is not one of BottomNav's 4 real tabs (it's only reached via the
            menu drawer or Profile's gear icon), so once here, none of the
            bottom tabs read as "active" and nothing on this screen itself
            hints how to leave — a genuine dead end for anyone who doesn't
            already know to just tap a different tab. This back button gives
            an explicit, obvious way out, landing on Profile (the primary
            entry point) regardless of which of the two ways in was used. */}
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <TouchableOpacity
              onPress={() => setActiveTab("profile")}
              activeOpacity={0.7}
              accessibilityLabel={t("a11y.backFromSettings")}
              accessibilityRole="button"
              style={{
                width: 44,
                height: 44,
                borderRadius: 16,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.cardBorder,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 10,
              }}
            >
              <ChevronLeft size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <IconBadge tone="emerald" isDark={isDark} style={{ marginRight: 8 }}>
              <Settings size={18} color={isDark ? "#34D399" : "#059669"} />
            </IconBadge>
            <Text
              style={{
                fontSize: 24,
                // Bold (700), not ExtraBold — matches the same change on
                // Profile/Pantry/Saved's titles, for a more visible "i" dot.
                fontWeight: "700",
                letterSpacing: -0.4,
                color: colors.textPrimary,
                flexShrink: 1,
              }}
              numberOfLines={1}
            >
              {t("settings.title")}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "500",
              color: colors.textSecondary,
              marginBottom: 24,
              lineHeight: 18,
            }}
          >
            {t("settings.subtitle")}
          </Text>
        </View>

        {/* Dietary Restrictions */}
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
            {t("settings.dietaryRestrictions")}
          </Text>

          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 18,
              padding: 6,
              borderWidth: 1,
              borderColor: colors.cardBorder,
            }}
          >
            {FULL_DIETARY_OPTIONS.map((item, index) => {
              const isEnabled = !!dietaryRestrictions[item.id];
              const isLast = index === FULL_DIETARY_OPTIONS.length - 1;

              return (
                // Confirmed real failure, not a hypothetical: this used to
                // be a plain View with only the Switch itself interactive —
                // tapping the label text (which looks exactly as tappable
                // as the theme/units buttons elsewhere on this screen) did
                // nothing at all. The whole row is now the touch target,
                // same as the theme/units rows; the Switch's own
                // onValueChange stays as a second path for anyone who taps
                // precisely on it, and pointerEvents="none" keeps that tap
                // from also bubbling up and double-toggling the row.
                <TouchableOpacity
                  key={item.id}
                  onPress={() => toggleDietaryRestriction(item.id)}
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
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      flex: 1,
                      paddingRight: 8,
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{item.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "800",
                          color: colors.textPrimary,
                        }}
                      >
                        {t(`diet.${item.id}.name`)}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: colors.textSecondary,
                          marginTop: 2,
                        }}
                      >
                        {t(`diet.${item.id}.desc`)}
                      </Text>
                    </View>
                  </View>

                  <Switch
                    value={isEnabled}
                    onValueChange={() => toggleDietaryRestriction(item.id)}
                    pointerEvents="none"
                    trackColor={{
                      false: isDark ? "#334155" : "#E2E8F0",
                      true: "#10B981",
                    }}
                    thumbColor="#FFFFFF"
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Custom Diet — PRO only. Two free-text lists rather than an
            open-ended "describe your diet" field: "always avoid" plugs
            into the same code-level keyword safety net the 9 preset diets
            use (see getDietViolation in geminiRecipes.js) since it's a
            literal ingredient name, not a philosophy an LLM has to
            interpret — a free-text diet description couldn't get that
            same enforcement, and prompt wording alone was already proven
            unreliable for hard constraints (see buildDietaryGuardrail's
            comment). "Prefer more of" is a softer nudge with no such
            enforcement, since failing to lean into a liked ingredient
            isn't a safety issue the way an allergy is. */}
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

        {/* App Theme */}
        <View style={{ marginBottom: 14 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "800",
              color: colors.textPrimary,
              marginBottom: 8,
            }}
          >
            {t("settings.appTheme")}
          </Text>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={() => toggleTheme("light")}
              activeOpacity={0.88}
              style={{
                flex: 1,
                paddingVertical: 12,
                paddingHorizontal: 10,
                borderRadius: 16,
                backgroundColor: colors.card,
                borderWidth: 2,
                borderColor: theme === "light" ? "#10B981" : colors.cardBorder,
                alignItems: "center",
                gap: 4,
                // Guaranteed clip — see BottomNav.jsx's comment on why a
                // long translated word needs this AND numberOfLines, not
                // just one or the other, to never bleed into the sibling
                // button.
                overflow: "hidden",
              }}
            >
              <Sun
                size={20}
                color={theme === "light" ? "#10B981" : colors.textSecondary}
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
                  color:
                    theme === "light" ? "#10B981" : colors.textPrimary,
                }}
              >
                {t("settings.light")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => toggleTheme("dark")}
              activeOpacity={0.88}
              style={{
                flex: 1,
                paddingVertical: 12,
                paddingHorizontal: 10,
                borderRadius: 16,
                backgroundColor: colors.card,
                borderWidth: 2,
                borderColor: theme === "dark" ? "#10B981" : colors.cardBorder,
                alignItems: "center",
                gap: 4,
                overflow: "hidden",
              }}
            >
              <Moon
                size={20}
                color={theme === "dark" ? "#34D399" : colors.textSecondary}
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
                  color:
                    theme === "dark" ? "#34D399" : colors.textPrimary,
                }}
              >
                {t("settings.dark")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Measurement Units — confirmed real feedback: this and Recipe
            Language are the two choices onboarding already asks for, and
            re-showing this one as the same full always-expanded picker
            made Settings read as "redo the setup wizard" instead of "here
            is what you already chose." Recipe Language avoids exactly
            this by collapsing to a summary row once a value is set; this
            now matches that same pattern instead of being the odd one
            out on the same screen. AI recipes are always generated in
            exactly ONE system (never both at once — see geminiRecipes.js
            UNIT SYSTEM rule), so this still directly controls what future
            generated recipes look like. */}
        <View style={{ marginBottom: 14 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "800",
              color: colors.textPrimary,
              marginBottom: 8,
            }}
          >
            {t("settings.measurementUnits")}
          </Text>

          <TouchableOpacity
            onPress={() => setUnitsPickerOpen(true)}
            activeOpacity={0.7}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: colors.card,
              borderRadius: 18,
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderWidth: 1,
              borderColor: colors.cardBorder,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {unitSystem === "us" ? (
                <Ruler size={18} color={colors.textSecondary} />
              ) : (
                <Thermometer size={18} color={colors.textSecondary} />
              )}
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "800",
                  color: colors.textPrimary,
                }}
              >
                {unitSystem === "us" ? t("settings.usUnits") : t("settings.metricUnits")}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Ingredient Source Priority — real feedback from a live tester:
            no way to tell the AI whether to lean on fresh fridge items or
            long-lasting pantry staples. Same 3-way segmented-picker shape
            as the Hunger Level tiles, since "balanced" is a genuine third
            option here, not just a placeholder default. Soft steering
            only (see geminiRecipes.js) — this changes the ingredient MIX
            a recipe leans on, never what's allowed to appear at all. */}
        <View style={{ marginBottom: 14 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "800",
              color: colors.textPrimary,
              marginBottom: 8,
            }}
          >
            {t("settings.ingredientPriority")}
          </Text>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={() => setIngredientPriority("balanced")}
              activeOpacity={0.88}
              style={{
                flex: 1,
                paddingVertical: 12,
                paddingHorizontal: 6,
                borderRadius: 16,
                backgroundColor: colors.card,
                borderWidth: 2,
                borderColor:
                  ingredientPriority === "balanced" ? "#10B981" : colors.cardBorder,
                alignItems: "center",
                gap: 4,
                overflow: "hidden",
              }}
            >
              <Scale
                size={20}
                color={
                  ingredientPriority === "balanced" ? "#10B981" : colors.textSecondary
                }
              />
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  textAlign: "center",
                  width: "100%",
                  minWidth: 0,
                  color:
                    ingredientPriority === "balanced" ? "#10B981" : colors.textPrimary,
                }}
              >
                {t("settings.priorityBalanced")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setIngredientPriority("fridge")}
              activeOpacity={0.88}
              style={{
                flex: 1,
                paddingVertical: 12,
                paddingHorizontal: 6,
                borderRadius: 16,
                backgroundColor: colors.card,
                borderWidth: 2,
                borderColor:
                  ingredientPriority === "fridge" ? "#10B981" : colors.cardBorder,
                alignItems: "center",
                gap: 4,
                overflow: "hidden",
              }}
            >
              <Refrigerator
                size={20}
                color={
                  ingredientPriority === "fridge" ? "#34D399" : colors.textSecondary
                }
              />
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  textAlign: "center",
                  width: "100%",
                  minWidth: 0,
                  color:
                    ingredientPriority === "fridge" ? "#34D399" : colors.textPrimary,
                }}
              >
                {t("settings.priorityFridge")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setIngredientPriority("pantry")}
              activeOpacity={0.88}
              style={{
                flex: 1,
                paddingVertical: 12,
                paddingHorizontal: 6,
                borderRadius: 16,
                backgroundColor: colors.card,
                borderWidth: 2,
                borderColor:
                  ingredientPriority === "pantry" ? "#10B981" : colors.cardBorder,
                alignItems: "center",
                gap: 4,
                overflow: "hidden",
              }}
            >
              <Package
                size={20}
                color={
                  ingredientPriority === "pantry" ? "#10B981" : colors.textSecondary
                }
              />
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  textAlign: "center",
                  width: "100%",
                  minWidth: 0,
                  color:
                    ingredientPriority === "pantry" ? "#10B981" : colors.textPrimary,
                }}
              >
                {t("settings.priorityPantry")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recipe Language — collapsed to a single summary row (was all
            31 languages inline, which made this one section as long as
            the rest of Settings combined). Tapping opens a picker sheet
            with the full list instead. Only controls the language Gemini
            writes recipes in; the app's own screens, buttons, and labels
            stay English regardless. */}
        <View style={{ marginBottom: 14 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "800",
              color: colors.textPrimary,
              marginBottom: 8,
            }}
          >
            {t("settings.recipeLanguage")}
          </Text>

          <TouchableOpacity
            onPress={() => setLanguagePickerOpen(true)}
            activeOpacity={0.7}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: colors.card,
              borderRadius: 18,
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderWidth: 1,
              borderColor: colors.cardBorder,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ fontSize: 20 }}>{selectedLanguage.flag}</Text>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "800",
                  color: colors.textPrimary,
                }}
              >
                {selectedLanguage.name}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* No real payment processor is wired up yet (see the PRO
            entitlement note in CookAIContext) — activating PRO from the
            paywall was previously one-way with no way back to reviewing
            the free tier short of clearing app storage. Labeled plainly as
            a testing switch, not real subscription management, so it never
            reads as a "cancel subscription" control once payments exist. */}
        <View style={{ marginBottom: 14 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "800",
              color: colors.textPrimary,
              marginBottom: 8,
            }}
          >
            {t("settings.testingSectionTitle")}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: colors.card,
              borderRadius: 18,
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderWidth: 1,
              borderColor: colors.cardBorder,
            }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "800",
                  color: colors.textPrimary,
                }}
              >
                {t("settings.proTestingToggle")}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "500",
                  color: colors.textSecondary,
                  marginTop: 2,
                }}
              >
                {t("settings.proTestingToggleDesc")}
              </Text>
            </View>
            <Switch
              value={isPro}
              onValueChange={(next) => (next ? activatePro() : deactivatePro())}
              trackColor={{ false: colors.cardBorder, true: "#10B981" }}
              thumbColor="#FFFFFF"
            />
          </View>

          <TouchableOpacity
            onPress={resetOnboarding}
            activeOpacity={0.7}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: colors.card,
              borderRadius: 18,
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              marginTop: 10,
            }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "800",
                  color: colors.textPrimary,
                }}
              >
                {t("settings.replayOnboardingToggle")}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "500",
                  color: colors.textSecondary,
                  marginTop: 2,
                }}
              >
                {t("settings.replayOnboardingToggleDesc")}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Sticky "Done" CTA — confirmed real failure from live user testing:
          testers who reached Settings via Profile's gear icon, after
          adjusting things here, didn't know what to do next. The only way
          out was the small chevron icon up in the header, easy to miss
          once attention is on the content below, and it only returns to
          Profile rather than anywhere the app is actually used. This
          reuses the exact bottom sticky-button pattern onboarding already
          teaches with "Get Started", and — since this screen is also
          reachable before ever touching the scanner — closes the loop by
          landing directly on it instead of back on Profile. Shown only on
          someone's first-ever visit (see showDoneHint above) — by any
          later visit they already know the header's chevron gets them
          out, and the button is just noise then.

          A true floating overlay (position: "absolute"), not a flex
          sibling bar with its own background — matches ScannerScreen's
          floating "Generate Recipes" CTA exactly (same ctaHost/ctaPrimary
          shape), rather than sitting inside an opaque colors.bg strip
          that read as a second layer stacked over the content behind it.
          Same explicit shadow purge ScannerScreen's own CTA already
          needed for the identical reason (see its comment): RN adds a
          default drop shadow to a backgroundColor+borderRadius button on
          iOS, which blurs outward on every side — not just below — so it
          shows as a faint gray arc ABOVE the button too, not a shadow
          "under" it the way it looks in isolation. */}
      {showDoneHint ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: Math.max(insets.bottom, 8) + 56 + 10,
            paddingHorizontal: 20,
            zIndex: 39,
          }}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            onPress={() => setActiveTab("scanner")}
            activeOpacity={0.88}
            style={{
              backgroundColor: "#10B981",
              borderRadius: 18,
              paddingVertical: 16,
              alignItems: "center",
              borderWidth: 0,
              elevation: 0,
              shadowOpacity: 0,
              shadowColor: "transparent",
              shadowRadius: 0,
              shadowOffset: { width: 0, height: 0 },
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 16 }}>
              {t("settings.done")}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <StandardModal
        visible={languagePickerOpen}
        onClose={() => setLanguagePickerOpen(false)}
        maxHeight="80%"
        // Default drag-to-dismiss zone (110px) overlapped this modal's
        // compact grab-handle + title, reaching into the first language
        // row below — its higher z-index absorbed light taps there before
        // they could reach the row's own TouchableOpacity, so switching to
        // one of the first few languages needed an unusually firm press.
        // Shrunk to stop right after the title, same fix RecipeDetailModal
        // already applies for the same reason (see its own dragZoneHeight).
        dragZoneHeight={64}
        contentStyle={{
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
        }}
      >
        <View
          style={{
            width: 40,
            height: 4.5,
            borderRadius: 3,
            alignSelf: "center",
            marginVertical: 6,
            backgroundColor: colors.sheetHandle || colors.cardBorder,
          }}
        />
        <Text
          style={{
            fontSize: 18,
            fontWeight: "800",
            color: colors.textPrimary,
            paddingHorizontal: 20,
            marginBottom: 12,
          }}
        >
          {t("settings.recipeLanguage")}
        </Text>
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ paddingHorizontal: 20 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          <View
            style={{
              backgroundColor: colors.bg,
              borderRadius: 18,
              padding: 6,
              borderWidth: 1,
              borderColor: colors.cardBorder,
            }}
          >
            {LANGUAGE_OPTIONS.map((lang, index) => {
              const isSelected = recipeLanguageId === lang.id;
              const isLast = index === LANGUAGE_OPTIONS.length - 1;

              return (
                <TouchableOpacity
                  key={lang.id}
                  onPress={() => {
                    // Close first, THEN apply the language change one
                    // frame later — recipeLanguageId feeds every t() call
                    // in the app, so setting it re-renders the entire
                    // tree; doing that synchronously with the close
                    // blocked the sheet's own exit animation from
                    // starting, reading as a stutter/freeze right as you
                    // tap.
                    setLanguagePickerOpen(false);
                    requestAnimationFrame(() => {
                      setRecipeLanguageId(lang.id);
                    });
                  }}
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
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
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
        </ScrollView>
      </StandardModal>

      <StandardModal
        visible={unitsPickerOpen}
        onClose={() => setUnitsPickerOpen(false)}
        maxHeight="50%"
        dragZoneHeight={64}
        contentStyle={{
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
        }}
      >
        <View
          style={{
            width: 40,
            height: 4.5,
            borderRadius: 3,
            alignSelf: "center",
            marginVertical: 6,
            backgroundColor: colors.sheetHandle || colors.cardBorder,
          }}
        />
        <Text
          style={{
            fontSize: 18,
            fontWeight: "800",
            color: colors.textPrimary,
            paddingHorizontal: 20,
            marginBottom: 12,
          }}
        >
          {t("settings.measurementUnits")}
        </Text>
        <View
          style={{
            marginHorizontal: 20,
            marginBottom: insets.bottom + 24,
            backgroundColor: colors.bg,
            borderRadius: 18,
            padding: 6,
            borderWidth: 1,
            borderColor: colors.cardBorder,
          }}
        >
          {[
            { id: "us", labelKey: "settings.usUnits", Icon: Ruler },
            { id: "metric", labelKey: "settings.metricUnits", Icon: Thermometer },
          ].map((option, index) => {
            const isSelected = unitSystem === option.id;
            const Icon = option.Icon;
            return (
              <TouchableOpacity
                key={option.id}
                onPress={() => {
                  setUnitsPickerOpen(false);
                  requestAnimationFrame(() => {
                    setUnitSystem(option.id);
                  });
                }}
                activeOpacity={0.7}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                  borderBottomWidth: index === 0 ? 1 : 0,
                  borderBottomColor: colors.cardBorder,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Icon size={20} color={colors.textSecondary} />
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "800",
                      color: colors.textPrimary,
                    }}
                  >
                    {t(option.labelKey)}
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
      </StandardModal>
    </View>
  );
}
