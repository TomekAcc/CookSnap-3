import React from "react";
import { View } from "react-native";

// A small cluster of soft dots scattered around an empty-state icon chip —
// the low-risk version of "custom illustrated empty states": no new
// pictorial illustration to get wrong, just enough motion/life that a dead
// end (no saved recipes, no scan history yet) doesn't read as a bare
// default-library icon. Meant to sit as an absolutely-positioned sibling
// inside a `position: "relative"` chip; negative offsets are intentional —
// chips here don't set overflow: "hidden", so the dots drift past the
// chip's edge instead of stopping at it.
const DOTS = [
  { size: 9, top: -5, right: -3, opacity: 0.9 },
  { size: 6, bottom: 4, left: -7, opacity: 0.55 },
  { size: 5, top: 8, right: -12, opacity: 0.4 },
];

export default function EmptyStateSparkle({ color }) {
  return (
    <>
      {DOTS.map((dot, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{
            position: "absolute",
            width: dot.size,
            height: dot.size,
            borderRadius: dot.size / 2,
            backgroundColor: color,
            opacity: dot.opacity,
            top: dot.top,
            bottom: dot.bottom,
            left: dot.left,
            right: dot.right,
          }}
        />
      ))}
    </>
  );
}
