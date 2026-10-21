import React, { useState } from "react";
import { Animated, Text, View } from "react-native";
import { Zap } from "../../icons";
import { SCAN_STATUS_KEYS } from "../../constants/scanChoreography";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useScan } from "../../context/ScanContext";

/** "Vision Radar" panel shown while the AI works: rotating status line and the progress bar. */
export default function FridgeScanProgress({
  currentStepIdx,
  hasFood,
  iconPulse,
  progressBarAnim,
  radarOpacity,
  radarTranslate,
  stepOpacity,
  stepTranslate,
}) {
  const { t } = useLanguage();
  const { colors, isDark } = useTheme();
  const { scanningLabel } = useScan();
  const [barWidth, setBarWidth] = useState(0);
  return (
    <Animated.View
      style={{
        marginTop: 16,
        opacity: radarOpacity,
        transform: [{ translateY: radarTranslate }],
      }}
    >
      <View
        style={{
          gap: 14,
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          borderWidth: 1,
          borderRadius: 24,
          padding: 16,
        }}
      >
        {/* One status area instead of four statements of the same
            thing (pill on the photo, "Vision Radar" title, step box,
            percent). The line says what is happening in plain words;
            the bar carries no percent because the AI returns the whole
            result at once, so any number would be an estimate. */}
        <Animated.View
          style={{
            flexDirection: "row",
            alignItems: "center",
            opacity: stepOpacity,
            transform: [{ translateY: stepTranslate }],
          }}
        >
          <Animated.View
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              backgroundColor: isDark ? "#064E3B" : "#ECFDF5",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
              flexShrink: 0,
              transform: [{ scale: iconPulse }],
            }}
          >
            <Zap size={20} color="#059669" />
          </Animated.View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                color: colors.textPrimary,
                fontWeight: "700",
                fontSize: 16,
                letterSpacing: -0.2,
              }}
              numberOfLines={2}
            >
              {t(SCAN_STATUS_KEYS[currentStepIdx])}
            </Text>
            {/* Only when there is already a list to add to; on a first scan "adding new ingredients" is just noise. */}
            {scanningLabel && hasFood ? (
              <Text
                style={{
                  color: colors.textSecondary,
                  fontWeight: "500",
                  fontSize: 13,
                  marginTop: 2,
                }}
                numberOfLines={2}
              >
                {scanningLabel}
              </Text>
            ) : null}
          </View>
        </Animated.View>

        {/* Slides a full-width fill in with a native-driven transform
            instead of animating its width, which re-laid the card out
            on the JS thread every frame. */}
        <View
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
          style={{
            width: "100%",
            backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
            height: 8,
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          {barWidth > 0 ? (
            <Animated.View
              style={{
                width: barWidth,
                height: "100%",
                borderRadius: 999,
                backgroundColor: "#10B981",
                transform: [
                  {
                    translateX: progressBarAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-barWidth, 0],
                    }),
                  },
                ],
              }}
            />
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}
