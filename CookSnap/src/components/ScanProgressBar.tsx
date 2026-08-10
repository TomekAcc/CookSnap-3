import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";

/**
 * Subtle indeterminate progress indicator — a short glowing segment that
 * sweeps left to right and loops. Sits at the bottom edge of the scanning
 * photo card instead of a text overlay.
 */
export function ScanProgressBar() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, []);

  const segmentStyle = useAnimatedStyle(() => {
    const translateX = interpolate(progress.value, [0, 1], [-80, 380]);
    return { transform: [{ translateX }] };
  });

  return (
    <View className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 overflow-hidden">
      <Animated.View
        style={[{ width: 80, height: 4, borderRadius: 2 }, segmentStyle]}
        className="bg-accent-mint"
      />
    </View>
  );
}
