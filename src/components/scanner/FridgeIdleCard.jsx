import React from "react";
import { Animated, Text, TouchableOpacity, View } from "react-native";
import { Camera, Image as ImageIcon } from "../../icons";
import { LinearGradient } from "expo-linear-gradient";
import PrivacyNote from "../PrivacyNote";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useOnboarding } from "../../context/OnboardingContext";
import { useScan } from "../../context/ScanContext";

/** Idle state: "Take Photo" / "From Gallery" call to action, with the one-time first-scan hint glow. */
export default function FridgeIdleCard({
  firstScanHintPulse,
  handleOpenCamera,
  handlePickFromGallery,
}) {
  const { t } = useLanguage();
  const { colors, isDark } = useTheme();
  const { firstScanHintShown, markFirstScanHintShown } = useOnboarding();
  const { scanHistory } = useScan();
  return (
    <View
      style={{
        backgroundColor: isDark ? colors.card : "#FFFFFF",
        borderRadius: 22,
        padding: 20,
        borderWidth: 1,
        borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
        alignItems: "center",
      }}
    >
      {/* Same pastel-emerald tone every icon badge in the app uses
          (Profile, Pantry, Saved headers, IconBadge's own palette) —
          this was a flat navy/gray box with an amber-on-dark-mode
          accent that didn't match anything else on screen, reading
          as an unstyled placeholder next to the colorful icons in
          the cards right below it. Kept at 64px (not IconBadge's
          standard 44px) since this is the hero of the whole screen,
          not a small nav-row badge.

          Light mode uses a subtle gradient fill (matches the
          approved mockup exactly) instead of a flat tint — that
          gradient plus a tighter, closer-hugging shadow is what
          reads as a deliberately elevated card; the first pass's
          flat fill + wide, diffuse shadow read more like an
          unintentional haze than a real shadow. Dark mode keeps a
          flat fill (the light gradient's colors don't translate —
          they'd either wash out or muddy against a dark card). */}
      {isDark ? (
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            backgroundColor: "#064E3B",
            borderWidth: 1,
            borderColor: "#065F46",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
            shadowColor: "#059669",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.18,
            shadowRadius: 6,
            elevation: 3,
          }}
        >
          <Camera size={22} color="#34D399" />
        </View>
      ) : (
        // Split into two views on purpose: LinearGradient needs
        // overflow:"hidden" to clip its fill to the rounded corners,
        // but a shadow on that same view gets clipped away by that
        // same overflow:"hidden" — it's drawn outside the view's
        // bounds, which is exactly what overflow:hidden cuts off.
        // Confirmed real failure on-device: the gradient showed, the
        // shadow silently didn't. The shadow now lives on this outer
        // plain View (no overflow set, so nothing clips it); the
        // LinearGradient inside only owns the fill + clipping.
        //
        // Opacity dropped hard from the first pass (0.3 → 0.12) —
        // that one still read as a diffuse green "glow"/halo even
        // after the clipping fix, not a real shadow. Reason: RN's
        // shadow has no CSS "spread" property, so the mockup's
        // negative-spread box-shadow (which is what tightened it in
        // the browser) has no direct equivalent here — the same
        // nominal opacity/blur numbers spread out much further on
        // real iOS than in Chromium. This app's own proven card
        // shadow (designSystem.js DS.shadow.card) sits at just
        // 0.04–0.06 opacity; landing near there (with a bit more for
        // the emerald tint to still read at all) is what actually
        // keeps this looking like elevation instead of a glow.
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            marginBottom: 12,
            shadowColor: "#059669",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 5,
            elevation: 3,
          }}
        >
          <LinearGradient
            colors={["#D1FAE5", "#A7F3D0"]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Camera size={22} color="#059669" />
          </LinearGradient>
        </View>
      )}
      <Text
        style={{
          color: colors.textPrimary,
          fontWeight: "700",
          fontSize: 21,
          textAlign: "center",
          marginBottom: 6,
          letterSpacing: -0.5,
        }}
      >
        {t("scanner.title")}
      </Text>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 14,
          fontWeight: "400",
          textAlign: "center",
          lineHeight: 19,
          marginBottom: 18,
          paddingHorizontal: 8,
        }}
      >
        {t("scanner.subtitle")}
      </Text>

      <View style={{ flexDirection: "row", width: "100%", gap: 10 }}>
        {/* Emerald, not navy — "Generate AI Recipes" right after a
            scan is the same color now too (see ScannerScreen's
            ctaPrimary), so there's one consistent "this is the
            primary action" color across the whole scan flow instead
            of navy and the app's actual brand green both claiming
            that role on the same screen. */}
        <View style={{ flex: 1.15 }}>
          {/* One-time glow halo — see the firstScanHintPulse effect
              above for why. Sits behind the button (negative inset,
              lower in paint order), pulses opacity + scale together
              so it reads as a soft breathing highlight rather than a
              hard outline. pointerEvents none so it never steals the
              tap. */}
          {!firstScanHintShown && (
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: -6,
                bottom: -6,
                left: -6,
                right: -6,
                borderRadius: 19,
                backgroundColor: "#059669",
                opacity: firstScanHintPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.35],
                }),
                transform: [
                  {
                    scale: firstScanHintPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.94, 1.06],
                    }),
                  },
                ],
              }}
            />
          )}
          <TouchableOpacity
            onPress={() => {
              markFirstScanHintShown();
              handleOpenCamera();
            }}
            activeOpacity={0.9}
            style={{
              height: 46,
              backgroundColor: "#059669",
              borderRadius: 13,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
            }}
          >
            <Camera size={16} color="#FFFFFF" />
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 15,
                fontWeight: "600",
                marginLeft: 8,
              }}
              numberOfLines={1}
            >
              {t("scanner.takePhoto")}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => {
            markFirstScanHintShown();
            handlePickFromGallery();
          }}
          activeOpacity={0.9}
          style={{
            flex: 1,
            height: 46,
            backgroundColor: isDark ? colors.card : "#FFFFFF",
            borderWidth: 1,
            borderColor: isDark ? colors.cardBorder : "#E2E8F0",
            borderRadius: 13,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
          }}
        >
          <ImageIcon size={15} color="#059669" />
          <Text
            style={{
              color: isDark ? colors.textPrimary : "#0F172A",
              fontSize: 15,
              fontWeight: "600",
              marginLeft: 8,
            }}
            numberOfLines={1}
          >
            {t("scanner.fromGallery")}
          </Text>
        </TouchableOpacity>
      </View>
      {(scanHistory || []).length === 0 ? <PrivacyNote /> : null}
    </View>
  );
}
