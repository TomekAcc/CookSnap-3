import React from "react";
import { Animated, Text, TouchableOpacity, View } from "react-native";
import { Camera, Image as ImageIcon } from "../../icons";
import ScanTile from "./ScanTile";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useOnboarding } from "../../context/OnboardingContext";
import { EMERALD, WHITE } from "../../theme/palette";

/** Idle state: "Take Photo" / "From Gallery" call to action, with the one-time first-scan hint glow. */
export default function FridgeIdleCard({
  firstScanHintPulse,
  handleOpenCamera,
  handlePickFromGallery,
}) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const { firstScanHintShown, markFirstScanHintShown } = useOnboarding();
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 22,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        alignItems: "center",
      }}
    >
      {/* The hero icon is also a "Take Photo" button, with a scanner line that sweeps across it every few seconds. */}
      <ScanTile
        label={t("scanner.takePhoto")}
        onPress={() => {
          markFirstScanHintShown();
          handleOpenCamera();
        }}
      />
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
                backgroundColor: EMERALD[700],
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
              backgroundColor: EMERALD[700],
              borderRadius: 13,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
            }}
          >
            <Camera size={16} color={WHITE} />
            <Text
              style={{
                color: WHITE,
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
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.outline,
            borderRadius: 13,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
          }}
        >
          <ImageIcon size={15} color={colors.greenStrong} />
          <Text
            style={{
              color: colors.ink,
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
    </View>
  );
}
