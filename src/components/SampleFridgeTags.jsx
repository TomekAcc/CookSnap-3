import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SAMPLE_FRIDGE_ITEMS, SAMPLE_FRIDGE_TAGS } from "../constants/sampleFridge";
import { EMERALD, SLATE, WHITE } from "../theme/palette";

// Wide enough for the longest label so the pill can be centred on its item.
const BOX_WIDTH = 140;
const PILL_HEIGHT = 24;
const DOT = 8;
const GAP = 3;

const START_DELAY_MS = 450;
const SWEEP_MS = 1700;
const LINE_HEIGHT = 84;

/**
 * "What the AI would find", pinned onto the onboarding fridge illustration: a scan line sweeps
 * down the picture and each label pops in as the line reaches its item, so the first screen
 * shows the product working and not just a fridge. Plays once per `playKey` (the screen bumps it
 * when the picture is tapped). With the system's "reduce motion" setting on, the labels are just
 * there and nothing sweeps.
 *
 * Rendered inside the same clipped card as the image and positioned from the image's own size,
 * so everything moves and scales with it. The sample pantry picture reuses it with its own `tags`,
 * `getLabel` and `getIcon` (and `imageLeft`/`imageWidth` when it is wider than the card); it is
 * mounted with a different `key` per picture, since the reveal values are created once.
 */
export default function SampleFridgeTags({
  t,
  cardWidth,
  cardHeight,
  imageHeight,
  imageTop,
  imageWidth = cardWidth,
  imageLeft = 0,
  playKey = 0,
  tags = SAMPLE_FRIDGE_TAGS,
  getLabel = (id) => t(`sampleFridge.${id}`),
  getIcon = (id) => SAMPLE_FRIDGE_ITEMS.find((item) => item.id === id)?.icon,
}) {
  const [reduceMotion, setReduceMotion] = useState(null); // null until the system answers
  const sweep = useRef(new Animated.Value(0)).current;
  const reveals = useRef(tags.map(() => new Animated.Value(0))).current;

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
    if (reduceMotion === null) return undefined;
    sweep.setValue(0);
    if (reduceMotion) {
      reveals.forEach((value) => value.setValue(1));
      return undefined;
    }
    reveals.forEach((value) => value.setValue(0));
    const animations = [
      Animated.sequence([
        Animated.delay(START_DELAY_MS),
        Animated.timing(sweep, { toValue: 1, duration: SWEEP_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ];
    tags.forEach((tag, i) => {
      // The label appears when the line's leading edge reaches the item.
      const reached = Math.min(1, Math.max(0, (imageTop + tag.y * imageHeight) / cardHeight));
      animations.push(
        Animated.sequence([
          Animated.delay(START_DELAY_MS + reached * SWEEP_MS),
          Animated.spring(reveals[i], { toValue: 1, friction: 7, tension: 110, useNativeDriver: true }),
        ])
      );
    });
    const run = Animated.parallel(animations);
    run.start();
    return () => run.stop();
  }, [playKey, reduceMotion, cardHeight, imageHeight, imageTop, sweep, reveals, tags]);

  const lineY = sweep.interpolate({ inputRange: [0, 1], outputRange: [-LINE_HEIGHT, cardHeight - LINE_HEIGHT] });
  const lineOpacity = sweep.interpolate({ inputRange: [0, 0.04, 0.94, 1], outputRange: [0, 1, 1, 0] });

  return (
    <>
      {tags.map(({ id, x, y }, i) => {
        const icon = getIcon(id);
        const reveal = reveals[i];
        return (
          <Animated.View
            key={id}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              position: "absolute",
              width: BOX_WIDTH,
              left: imageLeft + x * imageWidth - BOX_WIDTH / 2,
              top: imageTop + y * imageHeight - PILL_HEIGHT - GAP - DOT,
              alignItems: "center",
              opacity: reveal,
              transform: [
                { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
                { scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
              ],
            }}
          >
            <View
              style={{
                height: PILL_HEIGHT,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 9,
                borderRadius: 999,
                backgroundColor: "rgba(255, 255, 255, 0.96)",
                borderWidth: 1,
                borderColor: EMERALD[200],
              }}
            >
              {icon ? <Text style={{ fontSize: 12 }}>{icon}</Text> : null}
              <Text style={{ fontSize: 11.5, fontWeight: "700", color: SLATE[900] }} numberOfLines={1}>
                {getLabel(id)}
              </Text>
            </View>
            <View
              style={{
                width: DOT,
                height: DOT,
                marginTop: GAP,
                borderRadius: DOT / 2,
                backgroundColor: EMERALD[500],
                borderWidth: 1.5,
                borderColor: WHITE,
              }}
            />
          </Animated.View>
        );
      })}

      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: LINE_HEIGHT,
          opacity: lineOpacity,
          transform: [{ translateY: lineY }],
        }}
      >
        <LinearGradient
          colors={["rgba(16, 185, 129, 0)", "rgba(16, 185, 129, 0.30)"]}
          style={{ flex: 1 }}
        />
        <View
          style={{
            height: 3,
            backgroundColor: EMERALD[400],
            shadowColor: EMERALD[500],
            shadowOpacity: 0.9,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
      </Animated.View>
    </>
  );
}
