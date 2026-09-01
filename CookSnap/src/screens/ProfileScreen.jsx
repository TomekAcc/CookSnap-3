import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  UserRound,
  Crown,
  Settings as SettingsIcon,
  CalendarRange,
  History,
  MessageCircleQuestion,
  ChevronRight,
} from "lucide-react-native";
import { useCookAI } from "../context/CookAIContext";
import { useModalState } from "../context/ModalContext";
import { useTheme } from "../context/ThemeContext";
import { FULL_DIETARY_OPTIONS } from "../data/dietaryOptions";
import PillTag from "../components/PillTag";
import IconBadge from "../components/IconBadge";
import { breakLigatures } from "../utils/textLigatures";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const {
    dietaryRestrictions,
    toggleDietaryRestriction,
    setActiveTab,
    isPro,
    dailyRecipeGenerationCount,
    freeDailyRecipeGenerations,
    savedCount,
    pantryItems,
    scanHistory,
    t,
  } = useCookAI();
  const { setProModalOpen, setMealPlannerOpen, setScanHistoryOpen, setHelpModalOpen } =
    useModalState();
  const { colors, isDark } = useTheme();

  // Meal Planner / Scan History / Help were previously reachable only
  // through the hamburger drawer — the same "buried" problem Settings had
  // before it got a direct entry point here (see the Settings button
  // below). Surfacing them as one row of real shortcuts, not a second copy
  // of the drawer, doubles as the thing this screen was missing: something
  // to actually do, not just look at.
  //
  // The hamburger drawer itself is gone now (see Header.jsx) — every one of
  // its six rows already had a home: Settings has its own button above, PRO
  // has the banner above, and Meal Planner/Scan History/Help are the three
  // below. Saved Recipes used to be a fourth row here too, but "Saved" is
  // one of BottomNav's four real tabs — that row was just a shortcut to a
  // shortcut, one tap away regardless, so it was cut rather than kept as
  // redundant chrome.
  const QUICK_ACTIONS = [
    {
      id: "planner",
      labelKey: "menu.mealPlanner",
      Icon: CalendarRange,
      color: "#059669",
      onPress: () => setMealPlannerOpen(true),
    },
    {
      id: "history",
      labelKey: "menu.scanHistory",
      Icon: History,
      color: "#D97706",
      onPress: () => setScanHistoryOpen(true),
    },
    {
      id: "help",
      labelKey: "menu.helpFeedback",
      Icon: MessageCircleQuestion,
      color: "#0284C7",
      onPress: () => setHelpModalOpen(true),
    },
  ];

  // Real usage beats a generic pitch — a free user who's actually hit
  // their daily cap sees exactly how close they are, not the same static
  // line as someone who's never opened the app. isPro users (and anyone
  // who hasn't generated recipes yet today) keep the original generic
  // copy. Keyed off recipe generations, not scans — regenerating for new
  // suggestions is the action people actually repeat in a session, and the
  // one the free cap is meant to meter (see FREE_DAILY_RECIPE_GENERATIONS
  // in CookAIContext).
  const proBannerSubtitle =
    !isPro && dailyRecipeGenerationCount >= freeDailyRecipeGenerations
      ? t("profile.generationsUsedUp", { count: freeDailyRecipeGenerations })
      : !isPro && dailyRecipeGenerationCount > 0
        ? t("profile.generationsUsedPartial", {
            used: dailyRecipeGenerationCount,
            count: freeDailyRecipeGenerations,
          })
        : t("profile.trialAvailable");

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingBottom: insets.bottom + 120,
      }}
    >
      <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
        {/* Header — margin rhythm matches Pantry/Settings exactly (title row
            marginBottom 8, subtitle a full-width sibling below it with
            marginBottom 24, flush left with the icon badge instead of
            indented under the title) — this used to nest the subtitle
            inside the title's own column, which pushed it in from the
            left edge and threw off the vertical rhythm compared to every
            other tab's header. */}
        <View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {/* Same pastel IconBadge every other tab's header icon uses
                  (Pantry, Saved) — Profile's plain gray circle was the one
                  header on its own, out of step with the rest of the app.
                  Glyph 18 / marginRight 8 to match those tabs exactly: this
                  was 20/12, so the badge still read visibly larger and set
                  further from its title than every other header.
                  UserRound, not User: User's body is a flat-sided trapezoid
                  under a small circle, which at 18px reads as an eye (circle
                  "pupil" inside a surrounding curve) rather than a person.
                  UserRound's body is one continuous dome arc under a larger
                  head — the standard shape for a small round avatar glyph. */}
              <IconBadge tone="emerald" isDark={isDark} style={{ marginRight: 8 }}>
                <UserRound size={18} color="#059669" />
              </IconBadge>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontWeight: "700",
                  fontSize: 24,
                  letterSpacing: -0.4,
                }}
              >
                {breakLigatures(t("profile.title"))}
              </Text>
            </View>

            {/* Primary Settings entry point — Profile is a bottom tab (always
                one tap away) while Settings used to only be reachable via the
                hamburger drawer, buried alongside Scan History/Help/PRO. That
                mismatch was the actual source of "not intuitive" — Settings
                belongs where a user would naturally look for it. */}
            <TouchableOpacity
              onPress={() => setActiveTab("settings")}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={t("a11y.openSettings")}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.cardBorder,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <SettingsIcon size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text
            style={{
              color: colors.textSecondary,
              fontWeight: "500",
              fontSize: 13,
              marginBottom: 24,
              lineHeight: 18,
            }}
          >
            {t("profile.subtitle")}
          </Text>
        </View>

        {isPro ? (
          // A paying subscriber was seeing this exact same "Upgrade to PRO /
          // 7-day free trial available" pitch on their own Profile forever —
          // this banner used to render unconditionally regardless of isPro.
          // Swapped for a status confirmation instead of hiding it outright,
          // since disappearing entirely reads as "did my purchase not work?"
          <TouchableOpacity
            onPress={() => setProModalOpen(true)}
            style={{
              backgroundColor: "#1E293B",
              borderRadius: 24,
              padding: 20,
              marginBottom: 24,
              flexDirection: "row",
              alignItems: "center",
            }}
            activeOpacity={0.85}
          >
            <Crown size={28} color="#F59E0B" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: "#FFFFFF", fontWeight: "900", fontSize: 16 }}>
                {t("profile.proActiveTitle")}
              </Text>
              <Text
                style={{
                  color: "rgba(255, 255, 255, 0.6)",
                  fontSize: 14,
                  fontWeight: "500",
                }}
              >
                {t("profile.proActiveSubtitle")}
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => setProModalOpen(true)}
            style={{
              backgroundColor: "#F59E0B",
              borderRadius: 24,
              padding: 20,
              marginBottom: 24,
              flexDirection: "row",
              alignItems: "center",
            }}
            activeOpacity={0.85}
          >
            <Crown size={28} color="#0F172A" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text
                style={{ color: "#0F172A", fontWeight: "900", fontSize: 16 }}
              >
                {t("profile.upgradeToPro")}
              </Text>
              <Text
                style={{
                  color: "rgba(15, 23, 42, 0.7)",
                  fontSize: 14,
                  fontWeight: "500",
                }}
              >
                {proBannerSubtitle}
              </Text>
            </View>
            <Text style={{ color: "#0F172A", fontWeight: "900", fontSize: 14 }}>
              →
            </Text>
          </TouchableOpacity>
        )}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          {/* 13/800/-0.1 is the section-heading standard already shared by
              Settings ("Dietary Restrictions", "App Theme") and Pantry
              ("In Stock", "Out of Stock"). Profile's three headings were the
              only 16/900 ones in the app, so its sections read a full step
              louder than the identical sections on those screens. */}
          <Text
            style={{
              color: colors.textPrimary,
              fontWeight: "800",
              fontSize: 13,
              letterSpacing: -0.1,
            }}
          >
            {t("profile.dietPreferences")}
          </Text>
          <TouchableOpacity onPress={() => setActiveTab("settings")}>
            <Text
              style={{
                color: "#10B981",
                fontWeight: "700",
                fontSize: 12,
              }}
            >
              {t("profile.manageAll")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Directly tappable — a quick-toggle shortcut on top of Settings'
            full switch list (via "Manage all" above), not a replacement
            for it: Settings stays the place with descriptions and the
            Custom Diet section, this is just "flip one thing without
            leaving Profile." Same toggleDietaryRestriction both screens
            already share, so there's only ever one source of truth
            regardless of which control was tapped. Selected fill uses the
            app's standard green (not PillTag's default dark navy) so it
            doesn't visually echo the PRO banner directly above. */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 24,
          }}
        >
          {FULL_DIETARY_OPTIONS.map((diet) => {
            const isActive = !!dietaryRestrictions[diet.id];
            return (
              <PillTag
                key={diet.id}
                emoji={diet.icon}
                label={t(`diet.${diet.id}.name`)}
                selected={isActive}
                onPress={() => toggleDietaryRestriction(diet.id)}
              />
            );
          })}
        </View>

        {/* Real usage, not filler — same "personalize with actual numbers"
            principle already used for the PRO banner above. Three columns
            of genuinely new info (nothing restated from Diet Preferences),
            same big-number-over-small-caps-label language as the recipe
            macro row, so it reads as part of the same design system rather
            than a bolted-on card. */}
        <Text
          style={{
            color: colors.textPrimary,
            fontWeight: "800",
            fontSize: 13,
            letterSpacing: -0.1,
            marginBottom: 12,
          }}
        >
          {t("profile.statsTitle")}
        </Text>
        <View
          style={{
            flexDirection: "row",
            backgroundColor: colors.card,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            paddingVertical: 20,
          }}
        >
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ color: "#059669", fontWeight: "900", fontSize: 22 }}>
              {savedCount}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontWeight: "700",
                fontSize: 11,
                marginTop: 4,
                textAlign: "center",
              }}
            >
              {t("profile.statSavedRecipes")}
            </Text>
          </View>
          <View
            style={{
              width: 1,
              backgroundColor: colors.cardBorder,
              marginVertical: 2,
            }}
          />
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ color: "#D97706", fontWeight: "900", fontSize: 22 }}>
              {pantryItems.length}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontWeight: "700",
                fontSize: 11,
                marginTop: 4,
                textAlign: "center",
              }}
            >
              {t("profile.statPantryItems")}
            </Text>
          </View>
          <View
            style={{
              width: 1,
              backgroundColor: colors.cardBorder,
              marginVertical: 2,
            }}
          />
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ color: "#0284C7", fontWeight: "900", fontSize: 22 }}>
              {scanHistory.length}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontWeight: "700",
                fontSize: 11,
                marginTop: 4,
                textAlign: "center",
              }}
            >
              {t("profile.statTotalScans")}
            </Text>
          </View>
        </View>

        {/* Real shortcuts, not more chrome — see QUICK_ACTIONS above for
            why these four specifically. */}
        <Text
          style={{
            color: colors.textPrimary,
            fontWeight: "800",
            fontSize: 13,
            letterSpacing: -0.1,
            marginTop: 24,
            marginBottom: 12,
          }}
        >
          {t("profile.quickActions")}
        </Text>
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            overflow: "hidden",
          }}
        >
          {QUICK_ACTIONS.map((action, idx) => (
            <TouchableOpacity
              key={action.id}
              onPress={action.onPress}
              activeOpacity={0.7}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
                borderBottomWidth: idx < QUICK_ACTIONS.length - 1 ? 1 : 0,
                borderBottomColor: colors.cardBorder,
              }}
            >
              <action.Icon size={20} color={action.color} />
              <Text
                style={{
                  flex: 1,
                  color: colors.textPrimary,
                  fontWeight: "600",
                  fontSize: 14,
                  marginLeft: 12,
                }}
              >
                {t(action.labelKey)}
              </Text>
              <ChevronRight size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
