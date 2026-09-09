import React, { useEffect, useRef } from "react";
import { Animated, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCookAI } from "../context/CookAIContext";
import { useTheme } from "../context/ThemeContext";

// Light tinted card + colored border + colored text, matching the pattern
// already used everywhere else in the app (Pantry's "+ Add" button, the
// favorited-recipe state, selected preference tiles) — not the solid
// dark-navy fill this used to be. That fill predates the whole light/green
// redesign and never got touched, so it was the one surface left clashing
// with everything around it; it also never adapted to dark mode at all,
// same colors either way.
const VARIANT_STYLE = {
  success: {
    bgLight: "#ECFDF5",
    bgDark: "rgba(6, 78, 59, 0.94)",
    border: "#10B981",
    textLight: "#065F46",
    textDark: "#6EE7B7",
    icon: "✅",
  },
  error: {
    bgLight: "#FEF2F2",
    bgDark: "rgba(127, 29, 29, 0.94)",
    border: "#EF4444",
    textLight: "#991B1B",
    textDark: "#FCA5A5",
    icon: "⚠️",
  },
  info: {
    bgLight: "#FFFBEB",
    bgDark: "rgba(120, 53, 15, 0.94)",
    border: "#F59E0B",
    textLight: "#92400E",
    textDark: "#FCD34D",
    icon: "ℹ️",
  },
};

export default function Toast() {
  const { toast } = useCookAI();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (toast) {
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      opacity.setValue(0);
    }
  }, [toast, opacity]);

  if (!toast) return null;

  const style = VARIANT_STYLE[toast.type] || VARIANT_STYLE.info;

  return (
    <Animated.View
      style={{
        position: "absolute",
        // Sit below notch / Dynamic Island — never at y=0
        top: Math.max(insets.top, 12) + 8,
        left: 16,
        right: 16,
        zIndex: 999,
        opacity,
        backgroundColor: isDark ? style.bgDark : style.bgLight,
        borderColor: style.border,
        borderWidth: 1.5,
        borderRadius: 18,
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        shadowColor: "#0F172A",
        shadowOpacity: isDark ? 0.3 : 0.1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
      }}
    >
      <Text style={{ fontSize: 16, marginRight: 8 }}>{style.icon}</Text>
      <Text
        style={{
          color: isDark ? style.textDark : style.textLight,
          fontWeight: "700",
          fontSize: 13,
          flex: 1,
        }}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {toast.message}
      </Text>
    </Animated.View>
  );
}
