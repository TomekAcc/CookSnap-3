import { useTabScroll } from "../hooks/useTabScroll";
import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Crown,
  Settings as SettingsIcon,
  CalendarRange,
  History,
  MessageCircleQuestion,
  ChevronRight,
  ChevronDown,
  Check,
} from "../icons";
import { useModalState } from "../context/ModalContext";
import { useTheme } from "../context/ThemeContext";
import DietList from "../components/DietList";
import CustomDietSection from "../components/CustomDietSection";
import Header from "../components/Header";
import { breakLigatures } from "../utils/textLigatures";
import { useEntitlements } from "../context/EntitlementsContext";
import { useInventory } from "../context/InventoryContext";
import { useLanguage } from "../context/LanguageContext";
import { useLibrary } from "../context/LibraryContext";
import { useNavigation } from "../context/NavigationContext";
import { usePreferences } from "../context/PreferencesContext";
import { FULL_DIETARY_OPTIONS } from "../data/dietaryOptions";
import { useScan } from "../context/ScanContext";
import { APPLE, EMERALD, WHITE } from "../theme/palette";

/** One accent for every action: the same soft green circle the diet rows use, instead of a colour per row. */
function ActionIcon({ Icon, size, colors }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.greenWash,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon size={Math.round(size * 0.5)} color={colors.greenStrong} />
    </View>
  );
}

export default function ProfileScreen() {
  const tabScroll = useTabScroll("profile");
  const insets = useSafeAreaInsets();
  const { setActiveTab } = useNavigation();
  const { isPro, dailyRecipeGenerationCount, freeDailyRecipeGenerations } = useEntitlements();
  const { savedCount } = useLibrary();
  const { pantryItems } = useInventory();
  const { scanHistory } = useScan();
  const { t } = useLanguage();
  const { setProModalOpen, setMealPlannerOpen, setScanHistoryOpen, setHelpModalOpen } =
    useModalState();
  const { colors } = useTheme();
  const { dietaryRestrictions } = usePreferences();
  const [dietOpen, setDietOpen] = React.useState(false);
  const activeDiets = FULL_DIETARY_OPTIONS.filter((item) => dietaryRestrictions[item.id]);
  const dietSummary = activeDiets.length
    ? activeDiets.map((item) => t(`diet.${item.id}.name`)).join(", ")
    : t("profile.dietNone");

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
    { id: "planner", labelKey: "menu.mealPlanner", Icon: CalendarRange, onPress: () => setMealPlannerOpen(true) },
    { id: "history", labelKey: "menu.scanHistory", Icon: History, onPress: () => setScanHistoryOpen(true) },
    { id: "help", labelKey: "menu.helpFeedback", Icon: MessageCircleQuestion, onPress: () => setHelpModalOpen(true) },
  ];

  // The numbers count what the person has. Pantry counts what is in stock: an
  // out-of-stock item is on the shopping list, not in the kitchen.
  const STATS = [
    { id: "saved", labelKey: "profile.statSavedRecipes", value: savedCount },
    {
      id: "pantry",
      labelKey: "profile.statPantryItems",
      value: pantryItems.filter((item) => item.inStock).length,
    },
    { id: "scans", labelKey: "profile.statTotalScans", value: scanHistory.length },
  ];

  // Real usage beats a generic pitch — a free user who's actually hit
  // their daily cap sees exactly how close they are, not the same static
  // line as someone who's never opened the app. isPro users (and anyone
  // who hasn't generated recipes yet today) keep the original generic
  // copy. Keyed off recipe generations, not scans — regenerating for new
  // suggestions is the action people actually repeat in a session, and the
  // one the free cap is meant to meter (see FREE_DAILY_RECIPE_GENERATIONS
  // in EntitlementsContext).
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
      ref={tabScroll.setRef}
      onScroll={tabScroll.onScroll}
      onContentSizeChange={tabScroll.onContentSizeChange}
      onScrollBeginDrag={tabScroll.onScrollBeginDrag}
      scrollEventThrottle={tabScroll.scrollEventThrottle}
      style={{ flex: 1, backgroundColor: colors.bg }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingBottom: insets.bottom + 120,
      }}
    >
      {/* Settings lives in the brand row beside PRO (Profile is a tab, so it is always one tap away); the title row
          below stays clean and the two controls no longer stack on top of each other. */}
      <Header
        trailing={
          <TouchableOpacity
            onPress={() => setActiveTab("settings")}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.openSettings")}
            hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SettingsIcon size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        }
      />
      <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
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
              marginBottom: 20,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontWeight: "700",
                  fontSize: 28,
                  letterSpacing: -0.5,
                }}
              >
                {breakLigatures(t("profile.title"))}
              </Text>
            </View>

          </View>
        </View>

        <View style={{ marginBottom: 24 }}>
        {/* Real usage, not filler — same "personalize with actual numbers"
            principle already used for the PRO banner above. Three columns
            of genuinely new info (nothing restated from Diet Preferences),
            same big-number-over-small-caps-label language as the recipe
            macro row, so it reads as part of the same design system rather
            than a bolted-on card. */}
        <Text
          style={{
            color: colors.textPrimary,
            fontWeight: "700",
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
            overflow: "hidden",
          }}
        >
          {/* Plain figures, not buttons: Saved and Pantry are tabs one tap away and Scan History is in Quick Actions
              right below, so tappable cards only duplicated navigation and needed arrows to explain themselves. */}
          {STATS.map((stat, index) => (
            <React.Fragment key={stat.id}>
              {index > 0 ? (
                <View style={{ width: 1, backgroundColor: colors.cardBorder, marginVertical: 14 }} />
              ) : null}
              <View
                accessible
                accessibilityRole="summary"
                accessibilityLabel={`${t(stat.labelKey)}: ${stat.value}`}
                style={{ flex: 1, alignItems: "center", paddingVertical: 18 }}
              >
                <Text style={{ color: colors.greenStrong, fontWeight: "800", fontSize: 26, lineHeight: 32 }}>
                  {stat.value}
                </Text>
                {/* The label may take two lines; the numbers stay on one line because every column is top-aligned, and
                    the card is only as tall as its tallest label (no empty strip under one-line labels). */}
                <Text
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  style={{
                    color: colors.textSecondary,
                    fontWeight: "700",
                    fontSize: 11,
                    lineHeight: 14,
                    marginTop: 4,
                    paddingHorizontal: 4,
                    textAlign: "center",
                  }}
                >
                  {t(stat.labelKey)}
                </Text>
              </View>
            </React.Fragment>
          ))}
        </View>
        </View>

        {isPro ? (
          // A paying subscriber was seeing this exact same "Upgrade to PRO /
          // 7-day free trial available" pitch on their own Profile forever —
          // this banner used to render unconditionally regardless of isPro.
          // Swapped for a status confirmation instead of hiding it outright,
          // since disappearing entirely reads as "did my purchase not work?"
          // Same warm amber identity as the paywall and the upsell card: amber
          // wash on the normal card surface, solid crown disc with a small
          // green "active" tick. Not tappable on purpose — it used to open the
          // buy sheet for someone who already owns PRO; a manage-subscription
          // action belongs here once real billing exists.
          <View
            accessibilityRole="summary"
            style={{
              backgroundColor: colors.card,
              borderColor: "rgba(255,159,10,0.35)",
              borderWidth: 1,
              borderRadius: 24,
              padding: 18,
              marginBottom: 24,
              flexDirection: "row",
              alignItems: "center",
              overflow: "hidden",
            }}
          >
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(255,159,10,0.16)", "rgba(255,159,10,0.04)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.accentAmber,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: APPLE.orange,
                  shadowOpacity: 0.35,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                }}
              >
                <Crown size={24} color={WHITE} fill={WHITE} />
              </View>
              <View
                style={{
                  position: "absolute",
                  right: -3,
                  bottom: -3,
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: EMERALD[500],
                  borderWidth: 2,
                  borderColor: colors.card,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Check size={11} color={WHITE} strokeWidth={3.5} />
              </View>
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontWeight: "700",
                  fontSize: 17,
                  letterSpacing: -0.3,
                }}
              >
                {t("profile.proActiveTitle")}
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  fontWeight: "500",
                  lineHeight: 18,
                  marginTop: 2,
                }}
              >
                {t("profile.proActiveSubtitle")}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Free users' upsell: right under the numbers, above the shortcuts, so it is seen without scrolling past a
            long diet list. Same amber identity as the PRO-active card, the recipe-list card and the paywall. */}
        {!isPro ? (
          <TouchableOpacity
            onPress={() => setProModalOpen(true)}
            activeOpacity={0.9}
            accessibilityRole="button"
            style={{
              backgroundColor: colors.card,
              borderColor: "rgba(255,159,10,0.35)",
              borderWidth: 1,
              borderRadius: 24,
              padding: 16,
              marginBottom: 24,
              flexDirection: "row",
              alignItems: "center",
              overflow: "hidden",
            }}
          >
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(255,159,10,0.16)", "rgba(255,159,10,0.04)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.accentAmber,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Crown size={22} color={WHITE} fill={WHITE} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontWeight: "700",
                  fontSize: 16,
                  letterSpacing: -0.2,
                }}
              >
                {t("profile.upgradeToPro")}
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  fontWeight: "500",
                  lineHeight: 18,
                  marginTop: 2,
                }}
              >
                {proBannerSubtitle}
              </Text>
            </View>
            <ChevronRight size={20} color={colors.accentAmber} strokeWidth={2.6} />
          </TouchableOpacity>
        ) : null}

        <View style={{ marginBottom: 24 }}>
        {/* Real shortcuts, not more chrome — see QUICK_ACTIONS above for
            why these four specifically. */}
        <Text
          style={{
            color: colors.textPrimary,
            fontWeight: "700",
            fontSize: 13,
            letterSpacing: -0.1,
            marginBottom: 12,
          }}
        >
          {t("profile.quickActions")}
        </Text>
        {/* One grouped list: three identical rows, dividers inset from both sides. */}
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
              accessibilityRole="button"
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16 }}
            >
              <ActionIcon Icon={action.Icon} size={36} colors={colors} />
              <Text style={{ flex: 1, color: colors.textPrimary, fontWeight: "600", fontSize: 15, marginLeft: 12 }}>
                {t(action.labelKey)}
              </Text>
              <ChevronRight size={18} color={colors.textTertiary || colors.textSecondary} />
              {idx < QUICK_ACTIONS.length - 1 ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: 64,
                    right: 16,
                    bottom: 0,
                    height: 1,
                    backgroundColor: colors.cardBorder,
                  }}
                />
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
        </View>

        {/* Diets: one tap away, but folded by default. Nine switches used to be the first thing on this screen and
            pushed the numbers, the upgrade card and the shortcuts below the fold. The closed card names what is on,
            so the person sees their setup without opening it. */}
        <Text
          style={{
            color: colors.textPrimary,
            fontWeight: "700",
            fontSize: 13,
            letterSpacing: -0.1,
            marginBottom: 12,
          }}
        >
          {t("profile.dietPreferences")}
        </Text>
        <TouchableOpacity
          onPress={() => setDietOpen((open) => !open)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ expanded: dietOpen }}
          accessibilityLabel={`${t("profile.dietPreferences")}: ${dietSummary}`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.card,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            paddingVertical: 14,
            paddingHorizontal: 16,
            marginBottom: 0,
          }}
        >
          <Text
            numberOfLines={2}
            style={{
              flex: 1,
              color: activeDiets.length ? colors.textPrimary : colors.textSecondary,
              fontWeight: "600",
              fontSize: 15,
              marginRight: 12,
            }}
          >
            {dietSummary}
          </Text>
          <ChevronDown
            size={18}
            color={colors.textSecondary}
            style={{ transform: [{ rotate: dietOpen ? "180deg" : "0deg" }] }}
          />
        </TouchableOpacity>
        {/* Shown whether the card is open or not: the switches are a convenience, never an allergen guarantee. */}
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 12,
            lineHeight: 17,
            fontWeight: "500",
            marginTop: 10,
            marginBottom: dietOpen ? 12 : 4,
            paddingHorizontal: 4,
          }}
        >
          {t("profile.dietDisclaimer")}
        </Text>
        {dietOpen ? (
          <>
            <View style={{ marginBottom: 18 }}>
              <DietList showDescriptions={false} />
            </View>
            <View style={{ marginBottom: 18 }}>
              <CustomDietSection />
            </View>
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}
