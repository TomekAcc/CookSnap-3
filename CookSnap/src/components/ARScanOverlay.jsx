import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, Animated, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

function TargetBox({ box, pulse }) {
  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.08],
  });
  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 1],
  });

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: box.top,
        left: box.left,
        width: box.size,
        height: box.size,
        opacity,
        transform: [{ scale }],
      }}
    >
      <View
        style={{
          flex: 1,
          borderWidth: 2,
          borderColor: "#10B981",
          borderRadius: 10,
        }}
      />
      {["topLeft", "topRight", "bottomLeft", "bottomRight"].map((corner) => (
        <View
          key={corner}
          style={{
            position: "absolute",
            width: 12,
            height: 12,
            borderColor: "#34D399",
            ...(corner === "topLeft" && {
              top: -2,
              left: -2,
              borderTopWidth: 3,
              borderLeftWidth: 3,
            }),
            ...(corner === "topRight" && {
              top: -2,
              right: -2,
              borderTopWidth: 3,
              borderRightWidth: 3,
            }),
            ...(corner === "bottomLeft" && {
              bottom: -2,
              left: -2,
              borderBottomWidth: 3,
              borderLeftWidth: 3,
            }),
            ...(corner === "bottomRight" && {
              bottom: -2,
              right: -2,
              borderBottomWidth: 3,
              borderRightWidth: 3,
            }),
          }}
        />
      ))}
      <View
        style={{
          position: "absolute",
          top: -20,
          left: -4,
          backgroundColor: "rgba(16,185,129,0.9)",
          borderRadius: 6,
          paddingHorizontal: 6,
          paddingVertical: 1.5,
        }}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "800" }}>
          Detecting...
        </Text>
      </View>
    </Animated.View>
  );
}

export default function ARScanOverlay({ height = 288 }) {
  const laserProgress = useRef(new Animated.Value(0)).current;

  const boxes = useMemo(() => {
    const count = 3;
    return Array.from({ length: count }, () => ({
      top: `${18 + Math.random() * 45}%`,
      left: `${10 + Math.random() * 55}%`,
      size: 46 + Math.random() * 26,
      delay: Math.random() * 900,
    }));
  }, []);

  const pulses = useMemo(
    () => boxes.map(() => new Animated.Value(0)),
    [boxes]
  );

  useEffect(() => {
    const laserLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(laserProgress, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(laserProgress, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    laserLoop.start();

    const pulseLoops = pulses.map((val, idx) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(boxes[idx].delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 650,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 650,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      )
    );
    pulseLoops.forEach((loop) => loop.start());

    return () => {
      laserLoop.stop();
      pulseLoops.forEach((loop) => loop.stop());
    };
  }, [pulses, boxes, laserProgress]);

  const translateY = laserProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [12, height - 24],
  });

  return (
    <View
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      pointerEvents="none"
    >
      {boxes.map((box, idx) => (
        <TargetBox key={idx} box={box} pulse={pulses[idx]} />
      ))}

      {/* Soft glow trail behind the laser beam */}
      <Animated.View
        style={{
          position: "absolute",
          left: 8,
          right: 8,
          height: 28,
          marginTop: -12,
          transform: [{ translateY }],
          opacity: 0.55,
        }}
      >
        <LinearGradient
          colors={[
            "transparent",
            "rgba(16,185,129,0.0)",
            "rgba(52,211,153,0.35)",
            "rgba(16,185,129,0.0)",
            "transparent",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ flex: 1, borderRadius: 14 }}
        />
      </Animated.View>

      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: 5,
          transform: [{ translateY }],
          shadowColor: "#34D399",
          shadowOpacity: 0.95,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 0 },
          elevation: 6,
        }}
      >
        <LinearGradient
          colors={[
            "transparent",
            "#6EE7B7",
            "#10B981",
            "#34D399",
            "#6EE7B7",
            "transparent",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ height: 5, width: "100%", borderRadius: 3 }}
        />
      </Animated.View>
    </View>
  );
}
