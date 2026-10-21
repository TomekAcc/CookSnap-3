import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Image,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Asset } from "expo-asset";
import {
  Check,
  Ruler,
  Thermometer,
  ChefHat,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Globe,
} from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { useCookAI } from "../context/CookAIContext";
import { LANGUAGE_OPTIONS, DEFAULT_LANGUAGE_ID, getLanguageById } from "../data/languageOptions";
import { translate } from "../i18n";
import { SAMPLE_FRIDGE_IMAGE, sampleFridgeSize } from "../constants/sampleFridge";

const GREEN = "#059669";

// The sample card takes the height the screen has left after the header, the
// language row and the buttons (about 440pt), so a tall phone shows more of the
// fridge instead of an empty band. The image is shown at full width and
// shifted up a little rather than centred, which keeps the top shelf (the
// milk, cheese and eggs) in view and cuts the bottom drawers instead.
function sampleCardLayout() {
  const { width, height } = Dimensions.get("window");
  const cardWidth = width - 40;
  const cardHeight = Math.max(220, Math.min(360, height - 440));
  const size = sampleFridgeSize();
  const imageHeight = size ? (cardWidth * size.height) / size.width : (cardWidth * 4) / 3;
  const overflow = Math.max(0, imageHeight - cardHeight);
  return { cardHeight, imageHeight, imageTop: -Math.round(overflow * 0.12) };
}

/**
 * First-launch gate — shown once, before the main app shell ever mounts
 * (see App.jsx's RootGate).
 *
 * Value first, settings second. This screen used to open by asking for a
 * language and measurement units, which is work a new user does before they
 * have seen anything the app does (and many installs happen away from the
 * kitchen, so "scan your fridge" can't be tried on the spot). Now it shows a
 * sample fridge and offers to scan it: the real scan animation, then the real
 * recipe generation, with no photo needed. Language and units start from the
 * device's own settings and sit in one collapsed row that opens inline.
 *
 * Both choices still write into CookAIContext (the same `recipeLanguageId` /
 * `unitSystem` Settings edits) — there's no separate onboarding-only state.
 *
 * The highlighted language deliberately starts as English rather than the
 * context's device-detected `recipeLanguageId` and adopts the detected one
 * once hydration resolves (guarded by `userPickedRef`): that value arrives
 * asynchronously, and reading it directly raced against this screen's own
 * text. Text here comes from a local `translate()` keyed off
 * `selectedLanguage` (never the context's `t()`), so the highlighted row and
 * the surrounding copy always follow the same value.
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
    completeDemoScan,
  } = useCookAI();

  const [selectedLanguage, setSelectedLanguage] = useState(DEFAULT_LANGUAGE_ID);
  // null until the user taps a units button; until then the device-detected
  // `unitSystem` from the context is what is shown and what is kept.
  const [pickedUnits, setPickedUnits] = useState(null);
  const effectiveUnits = pickedUnits || unitSystem;
  const t = (key, vars) => translate(selectedLanguage, key, vars);

  // Language & units live in one collapsed row; the full 31-language list is
  // a second level inside it, opened only on request.
  const [showSettings, setShowSettings] = useState(false);
  const [showAllLanguages, setShowAllLanguages] = useState(false);
  const [starting, setStarting] = useState(false);
  const sampleCard = useRef(sampleCardLayout()).current;
  const scrollRef = useRef(null);

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
    setShowAllLanguages(false);
  };

  const applySettings = () => {
    setRecipeLanguageId(selectedLanguage);
    if (pickedUnits) setUnitSystem(pickedUnits);
  };

  const handleOwnFridge = () => {
    if (starting) return;
    setStarting(true);
    applySettings();
    onContinue();
  };

  const handleTrySample = async () => {
    if (starting) return;
    setStarting(true);
    applySettings();
    try {
      // A local file URI for the bundled illustration (expo-asset resolves it
      // for dev, production and over-the-air updates alike).
      const asset = Asset.fromModule(SAMPLE_FRIDGE_IMAGE);
      if (!asset.localUri) await asset.downloadAsync();
      const uri = asset.localUri || asset.uri;
      if (uri) completeDemoScan(uri);
    } catch (err) {
      // The sample is a nicety: if it can't start, just open the app.
      console.warn("[Cook AI] sample scan could not start:", err?.message);
    }
    onContinue();
  };

  const selectedLanguageOption = getLanguageById(selectedLanguage);
  // "Metric (g, °C)" → "g, °C": the units themselves are what the summary needs,
  // and the long translated name ("Метрические", "Metryczne") only truncated.
  const unitsFull = t(effectiveUnits === "metric" ? "settings.metricUnits" : "settings.usUnits");
  const unitsLabel = (unitsFull.match(/[(（]([^)）]+)[)）]/)?.[1] || unitsFull).trim();
  const green = isDark ? "#34D399" : GREEN;

  const unitButton = (id, Icon, label) => {
    const selected = effectiveUnits === id;
    return (
      <TouchableOpacity
        key={id}
        onPress={() => setPickedUnits(id)}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        style={{
          flex: 1,
          paddingVertical: 14,
          paddingHorizontal: 10,
          borderRadius: 16,
          backgroundColor: colors.card,
          borderWidth: 2,
          borderColor: selected ? GREEN : colors.cardBorder,
          alignItems: "center",
          gap: 4,
          overflow: "hidden",
        }}
      >
        <Icon size={20} color={selected ? green : colors.textSecondary} />
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{
            fontSize: 12,
            fontWeight: "700",
            textAlign: "center",
            width: "100%",
            minWidth: 0,
            color: selected ? green : colors.textPrimary,
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingTop: insets.top + 28,
          paddingHorizontal: 20,
          paddingBottom: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: "center", marginBottom: 22 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 20,
              backgroundColor: isDark ? "rgba(16,185,129,0.16)" : "#ECFDF5",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 14,
            }}
          >
            <ChefHat size={28} color={green} />
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
              fontSize: 15,
              fontWeight: "500",
              lineHeight: 21,
              color: colors.textSecondary,
              marginTop: 8,
              textAlign: "center",
              maxWidth: 320,
            }}
          >
            {t("onboarding.valueSubtitle")}
          </Text>
        </View>

        {/* The sample fridge (see sampleCardLayout for how it is cropped). */}
        <View
          style={{
            height: sampleCard.cardHeight,
            borderRadius: 24,
            overflow: "hidden",
            backgroundColor: "#E6EDF2",
            borderWidth: 1,
            borderColor: colors.cardBorder,
            marginBottom: 16,
          }}
        >
          <Image
            source={SAMPLE_FRIDGE_IMAGE}
            style={{
              position: "absolute",
              left: 0,
              top: sampleCard.imageTop,
              width: "100%",
              height: sampleCard.imageHeight,
            }}
            resizeMode="cover"
            accessibilityLabel={t("onboarding.sampleLabel")}
          />
          <View
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              backgroundColor: "rgba(255,255,255,0.94)",
              borderRadius: 999,
              paddingHorizontal: 11,
              paddingVertical: 5,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#0F172A" }}>
              {t("onboarding.sampleLabel")}
            </Text>
          </View>
        </View>

        {/* Language & units — one quiet row, open on request. */}
        <TouchableOpacity
          onPress={() => {
            const opening = !showSettings;
            setShowSettings(opening);
            // The panel opens below the fold; bring it into view.
            if (opening) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
          }}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityState={{ expanded: showSettings }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.card,
            borderRadius: 18,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            gap: 12,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#F1F5F9",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Globe size={18} color={colors.textSecondary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary }}>
              {t("onboarding.settingsTitle")}
            </Text>
            <Text
              numberOfLines={1}
              style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginTop: 1 }}
            >
              {selectedLanguageOption.flag} {selectedLanguageOption.name} · {unitsLabel}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: green }}>
              {t("onboarding.changeLanguage")}
            </Text>
            {showSettings ? (
              <ChevronDown size={16} color={green} />
            ) : (
              <ChevronRight size={16} color={green} />
            )}
          </View>
        </TouchableOpacity>

        {showSettings ? (
          <View style={{ marginTop: 14 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: colors.textPrimary,
                marginBottom: 8,
              }}
            >
              {t("onboarding.chooseLanguage")}
            </Text>

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
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  marginBottom: 18,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Text style={{ fontSize: 22 }}>{selectedLanguageOption.flag}</Text>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
                    {selectedLanguageOption.name}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: green }}>
                    {t("onboarding.changeLanguage")}
                  </Text>
                  <ChevronRight size={16} color={green} />
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
                  marginBottom: 18,
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
                        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>
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
                fontWeight: "700",
                color: colors.textPrimary,
                marginBottom: 8,
              }}
            >
              {t("onboarding.chooseUnits")}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {unitButton("us", Ruler, t("settings.usUnits"))}
              {unitButton("metric", Thermometer, t("settings.metricUnits"))}
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
          </View>
        ) : null}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 10,
          paddingBottom: insets.bottom + 10,
          backgroundColor: colors.bg,
        }}
      >
        <TouchableOpacity
          onPress={handleTrySample}
          activeOpacity={0.88}
          disabled={starting}
          accessibilityRole="button"
          style={{
            backgroundColor: GREEN,
            borderRadius: 18,
            paddingVertical: 16,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
          }}
        >
          <Sparkles size={18} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 17, flexShrink: 1 }}>
            {t("onboarding.trySample")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleOwnFridge}
          activeOpacity={0.7}
          disabled={starting}
          accessibilityRole="button"
          style={{ paddingVertical: 14, alignItems: "center" }}
        >
          <Text style={{ color: green, fontWeight: "700", fontSize: 15 }}>
            {t("onboarding.skipSample")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
