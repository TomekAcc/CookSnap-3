import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Animated, PanResponder, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, AlertTriangle, Info, Crown } from "../icons";
import { useTheme } from "../context/ThemeContext";
import { toastStore } from "../utils/toastStore";
import { hideToast } from "../utils/toast";

// A solid card on the app's normal surface, with a small vector icon in a
// tinted disc carrying the variant colour. It used to be a see-through mint /
// red / amber box with a thick coloured outline and an emoji icon next to an
// emoji inside the message — the cards behind showed through it, and emoji
// glyphs are drawn differently by Apple and Google, unlike every other icon
// in the app. "pro" is the brand moment (trial started / PRO activated) and
// gets the amber crown instead of a generic check.
const VARIANTS = {
  success: { Icon: Check, color: "#059669", tint: "rgba(16,185,129,0.14)", fill: false },
  error: { Icon: AlertTriangle, color: "#DC2626", tint: "rgba(239,68,68,0.14)", fill: false },
  info: { Icon: Info, color: "#D97706", tint: "rgba(245,158,11,0.16)", fill: false },
  pro: { Icon: Crown, color: "#FF9F0A", tint: "rgba(255,159,10,0.16)", fill: true },
};

// Messages carry a leading emoji from the i18n layer ("🎉 Trial started…").
// The icon disc replaces it. Surrogate-pair match (Hermes-safe, same approach
// as ProSubscriptionModal) plus the BMP symbol block (✅ ⚠️ ℹ️).
function stripLeadingEmoji(text) {
  return String(text || "")
    .replace(/^(?:[\uD800-\uDBFF][\uDC00-\uDFFF]|[☀-➿])️?\s*/, "")
    .trim();
}

const HIDDEN_OFFSET = -28;

export default function Toast() {

  const toast = useSyncExternalStore(toastStore.subscribe, toastStore.get);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(HIDDEN_OFFSET)).current;
  // Keeps the last toast on screen while it animates out.
  const [shown, setShown] = useState(null);
  const hideRef = useRef(hideToast);
  hideRef.current = hideToast;

  useEffect(() => {
    if (toast) {
      setShown(toast);
      opacity.setValue(0);
      translateY.setValue(HIDDEN_OFFSET);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(translateY, {
          toValue: 0,
          friction: 9,
          tension: 70,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (shown) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, {
          toValue: HIDDEN_OFFSET,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setShown(null);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy < -6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_e, g) => {
        if (g.dy < -14 || g.vy < -0.4) hideRef.current?.();
      },
    })
  ).current;

  if (!shown) return null;

  const v = VARIANTS[shown.type] || VARIANTS.info;
  const Icon = v.Icon;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        position: "absolute",
        // Sit below notch / Dynamic Island — never at y=0
        top: Math.max(insets.top, 12) + 8,
        left: 16,
        right: 16,
        zIndex: 999,
        opacity,
        transform: [{ translateY }],
      }}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => hideToast?.()}
        style={{
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          borderWidth: 1,
          borderRadius: 18,
          paddingVertical: 12,
          paddingLeft: 12,
          paddingRight: 16,
          flexDirection: "row",
          alignItems: "center",
          shadowColor: "#0F172A",
          shadowOpacity: isDark ? 0.45 : 0.14,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: v.tint,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Icon size={17} color={v.color} fill={v.fill ? v.color : "none"} strokeWidth={2.6} />
        </View>
        <Text
          style={{
            color: colors.textPrimary,
            fontWeight: "700",
            fontSize: 14,
            lineHeight: 19,
            flex: 1,
          }}
          numberOfLines={3}
          ellipsizeMode="tail"
        >
          {stripLeadingEmoji(shown.message)}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
