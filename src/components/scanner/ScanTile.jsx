import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Camera } from "../../icons";
import { useTheme } from "../../context/ThemeContext";
import { EMERALD } from "../../theme/palette";

const SIZE = 56;
const SWEEP_MS = 1100;
const PAUSE_MS = 3600;

/**
 * The round-cornered icon on the scan card. Every few seconds a thin scanner line sweeps down it, the same
 * motion the app plays during a real scan, so the first thing on screen hints at what happens next. The tile is
 * also a button: it opens the camera like "Take Photo". With "reduce motion" on, it stays still.
 */
export default function ScanTile({ onPress, label }) {
  const { colors, isDark } = useTheme();
  const sweep = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(null); // null until the system answers

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => alive && setReduceMotion(!!on))
      .catch(() => alive && setReduceMotion(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion !== false) return undefined;
    sweep.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(PAUSE_MS),
        Animated.timing(sweep, { toValue: 1, duration: SWEEP_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, sweep]);

  const fill = (
    <View style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" }}>
      <Camera size={24} color={isDark ? EMERALD[400] : colors.greenStrong} />
      {reduceMotion === false ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 6,
            right: 6,
            top: 0,
            height: 2.5,
            borderRadius: 2,
            backgroundColor: isDark ? EMERALD[400] : EMERALD[600],
            opacity: sweep.interpolate({ inputRange: [0, 0.12, 0.88, 1], outputRange: [0, 0.9, 0.9, 0] }),
            transform: [{ translateY: sweep.interpolate({ inputRange: [0, 1], outputRange: [6, SIZE - 8] }) }],
          }}
        />
      ) : null}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ marginBottom: 12, opacity: pressed ? 0.8 : 1 })}
      hitSlop={6}
    >
      {isDark ? (
        <View
          style={{
            width: SIZE,
            height: SIZE,
            borderRadius: 17,
            overflow: "hidden",
            backgroundColor: EMERALD[900],
            borderWidth: 1,
            borderColor: EMERALD[800],
          }}
        >
          {fill}
        </View>
      ) : (
        // Shadow on a plain outer view: the gradient clips its children, and a clip would also cut the shadow off.
        <View
          style={{
            width: SIZE,
            height: SIZE,
            borderRadius: 17,
            shadowColor: EMERALD[600],
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 5,
            elevation: 3,
          }}
        >
          <LinearGradient
            colors={[EMERALD[100], EMERALD[200]]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={{ width: SIZE, height: SIZE, borderRadius: 17, overflow: "hidden" }}
          >
            {fill}
          </LinearGradient>
        </View>
      )}
    </Pressable>
  );
}
