import React, { useEffect } from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

/**
 * GPU-accelerated radar sweep — driven entirely by a shared value animated
 * on the UI thread via reanimated, so it holds 60fps regardless of JS load.
 * Fills the width of its parent (the scanning card), not the window. Uses a
 * true sinusoidal easing curve for a smooth radar-like back-and-forth motion.
 */
export function ScanLaserOverlay({ height }: { height: number }) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withTiming(height, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [height]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", width: "100%", height, overflow: "hidden" }}
    >
      <Animated.View style={[{ position: "absolute", width: "100%", height: 120 }, animatedStyle]}>
        <LinearGradient
          colors={[
            "rgba(34,197,94,0)",
            "rgba(34,197,94,0.55)",
            "rgba(34,197,94,0.9)",
            "rgba(34,197,94,0.55)",
            "rgba(34,197,94,0)",
          ]}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}
