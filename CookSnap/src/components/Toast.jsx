import React, { useEffect, useRef } from "react";
import { Animated, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCookAI } from "../context/CookAIContext";

const VARIANT_STYLE = {
  error: { bg: "#0F172A", border: "#EF4444", icon: "⚠️" },
  success: { bg: "#0F172A", border: "#10B981", icon: "✅" },
  info: { bg: "#0F172A", border: "#F59E0B", icon: "ℹ️" },
};

export default function Toast() {
  const { toast } = useCookAI();
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
        backgroundColor: style.bg,
        borderColor: style.border,
        borderWidth: 1.5,
        borderRadius: 18,
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      }}
    >
      <Text style={{ fontSize: 16, marginRight: 8 }}>{style.icon}</Text>
      <Text
        style={{ color: "white", fontWeight: "600", fontSize: 13, flex: 1 }}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {toast.message}
      </Text>
    </Animated.View>
  );
}
