import React from "react";
import { Text, View } from "react-native";
import { SAMPLE_FRIDGE_ITEMS, SAMPLE_FRIDGE_TAGS } from "../constants/sampleFridge";
import { EMERALD, SLATE, WHITE } from "../theme/palette";

// Wide enough for the longest label so the pill can be centred on its item.
const BOX_WIDTH = 140;
const PILL_HEIGHT = 24;
const DOT = 8;
const GAP = 3;

/**
 * "What the AI would find" labels pinned onto the onboarding fridge illustration, so the picture
 * shows the product's result and not just a fridge. Rendered inside the same clipped card as the
 * image and positioned from the image's own size, so the labels move and scale with it.
 */
export default function SampleFridgeTags({ t, cardWidth, imageHeight, imageTop }) {
  return SAMPLE_FRIDGE_TAGS.map(({ id, x, y }) => {
    const icon = SAMPLE_FRIDGE_ITEMS.find((item) => item.id === id)?.icon;
    return (
      <View
        key={id}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: "absolute",
          width: BOX_WIDTH,
          left: x * cardWidth - BOX_WIDTH / 2,
          top: imageTop + y * imageHeight - PILL_HEIGHT - GAP - DOT,
          alignItems: "center",
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
            {t(`sampleFridge.${id}`)}
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
      </View>
    );
  });
}
