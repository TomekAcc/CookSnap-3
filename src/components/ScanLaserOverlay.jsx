import React, { useEffect } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";

const LASER_TOP = 14;
const TRAIL_HEIGHT = 120;
const SWEEP_MS = 2000;
const HOLD_MS = 400;
const BRACKET_SIZE = 26;
const BRACKET_INSET = 16;

/**
 * Scan animation — UI-thread only (Reanimated).
 *
 * A one-way pass, top to bottom, that reads as progress rather than busywork:
 * a soft emerald trail behind a thin beam, with the part of the photo not yet
 * passed lightly tinted so the image looks like it is being "developed" as the
 * beam moves down. Four viewfinder corners frame the photo and breathe slowly.
 * Nothing here pretends to detect individual items — the AI answers all at once.
 */
export default function ScanLaserOverlay({
  active = false,
  travelDistance = 280,
}) {
  const progress = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(progress);
      cancelAnimation(breathe);
      progress.value = 0;
      breathe.value = 0;
      return undefined;
    }

    progress.value = 0;
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.cubic) }),
        withTiming(1, { duration: HOLD_MS }),
        withTiming(0, { duration: 0 })
      ),
      -1,
      false
    );
    breathe.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );

    return () => {
      cancelAnimation(progress);
      cancelAnimation(breathe);
    };
  }, [active, progress, breathe]);

  // Runs past the bottom edge (+40) so the beam and the tint below it leave the
  // photo completely at the end of the pass; otherwise a strip of tint stayed
  // at the bottom and vanished abruptly when the next pass began.
  const travel = Math.max(travelDistance, 80) + 40;

  // Fades the beam and trail in at the top and out at the bottom so the jump
  // back to the start is never seen.
  const beamStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.05, 0.86, 0.98], [0, 1, 1, 0]),
    transform: [{ translateY: progress.value * travel }],
  }));
  const trailStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.12, 0.86, 0.98], [0, 1, 1, 0]),
    transform: [{ translateY: progress.value * travel - TRAIL_HEIGHT + 3 }],
  }));
  // Tint over everything below the beam; it rides down with it, so the part
  // already passed is clear.
  const tintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.08, 1], [0, 1, 1]),
    transform: [{ translateY: progress.value * travel }],
  }));
  const bracketStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + breathe.value * 0.45,
  }));

  if (!active) return null;

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.tint, { top: LASER_TOP + 3 }, tintStyle]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.trail, { top: LASER_TOP }, trailStyle]}
      >
        <LinearGradient
          colors={["rgba(16,185,129,0)", "rgba(16,185,129,0.10)", "rgba(16,185,129,0.34)"]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.beam, { top: LASER_TOP }, beamStyle]}
      >
        <LinearGradient
          colors={["#6EE7B7", "#10B981", "#34D399", "#10B981", "#6EE7B7"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.frame, bracketStyle]}>
        <View style={[styles.bracket, styles.topLeft]} />
        <View style={[styles.bracket, styles.topRight]} />
        <View style={[styles.bracket, styles.bottomLeft]} />
        <View style={[styles.bracket, styles.bottomRight]} />
      </Animated.View>
    </>
  );
}

const BRACKET_COLOR = "rgba(255,255,255,0.92)";

const styles = StyleSheet.create({
  tint: {
    position: "absolute",
    left: 0,
    right: 0,
    // Long enough to cover the photo from the beam to the bottom at any point
    // of the pass; the photo container clips the overflow.
    height: 2000,
    backgroundColor: "rgba(15, 23, 42, 0.26)",
    zIndex: 9,
  },
  trail: {
    position: "absolute",
    left: 0,
    right: 0,
    height: TRAIL_HEIGHT,
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
  frame: { zIndex: 12 },
  bracket: {
    position: "absolute",
    width: BRACKET_SIZE,
    height: BRACKET_SIZE,
    borderColor: BRACKET_COLOR,
  },
  topLeft: {
    top: BRACKET_INSET,
    left: BRACKET_INSET,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: BRACKET_INSET,
    right: BRACKET_INSET,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: BRACKET_INSET,
    left: BRACKET_INSET,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: BRACKET_INSET,
    right: BRACKET_INSET,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },
});
