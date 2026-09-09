import React, { useEffect } from "react";
import { StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";

const LASER_TOP = 14;

/**
 * 60fps native laser sweep — UI-thread only (Reanimated).
 * Emerald beam + glow, matching the fresh-cooking accent palette.
 */
export default function ScanLaserOverlay({
  active = false,
  travelDistance = 280,
}) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(translateY);
      translateY.value = 0;
      return undefined;
    }

    const travel = Math.max(travelDistance, 80);
    translateY.value = 0;
    translateY.value = withRepeat(
      withTiming(travel, {
        duration: 1600,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );

    return () => {
      cancelAnimation(translateY);
    };
  }, [active, travelDistance, translateY]);

  const laserStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!active) return null;

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.glowBand, { top: LASER_TOP - 12 }, laserStyle]}
      >
        <LinearGradient
          colors={[
            "transparent",
            "rgba(16,185,129,0.35)",
            "rgba(16,185,129,0.12)",
            "transparent",
          ]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.beam, { top: LASER_TOP }, laserStyle]}
      >
        <LinearGradient
          colors={["#6EE7B7", "#10B981", "#34D399", "#10B981", "#6EE7B7"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  glowBand: {
    position: "absolute",
    left: 0,
    right: 0,
    width: "100%",
    height: 28,
    opacity: 0.95,
    zIndex: 10,
  },
  beam: {
    position: "absolute",
    left: 0,
    right: 0,
    width: "100%",
    height: 3.5,
    zIndex: 11,
    ...Platform.select({
      ios: {
        shadowColor: "#10B981",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 8,
      },
      android: {},
    }),
  },
});
