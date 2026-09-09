import React from "react";
import {
  TouchableOpacity,
  StyleSheet,
  Platform,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";

/** Apple HIG-friendly tap target (visual 38pt, hit area expanded). */
const BTN_SIZE = 38;
const ICON_SIZE = 20;

/**
 * Notch-safe dismiss control for camera overlays and photo cards.
 * @param {boolean} isFullScreen — camera / edge-to-edge: use safe-area top
 */
export default function PerfectCloseButton({
  onPress,
  isFullScreen = false,
  accessibilityLabel = "Close",
  /** "right" (default) or "left" — corner placement on the photo card */
  corner = "right",
  style,
}) {
  const insets = useSafeAreaInsets();

  const dynamicTop = isFullScreen
    ? Math.max(insets.top + 10, 18)
    : 14;
  const edgeInset = isFullScreen
    ? Math.max(
        (corner === "left" ? insets.left : insets.right) + 10,
        16
      )
    : 14;

  const cornerStyle =
    corner === "left"
      ? { top: dynamicTop, left: edgeInset }
      : { top: dynamicTop, right: edgeInset };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      delayPressIn={0}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={[
        styles.closeBtnBase,
        cornerStyle,
        style,
      ]}
    >
      <View pointerEvents="none">
        <X size={ICON_SIZE} color="#0F172A" strokeWidth={2.5} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  closeBtnBase: {
    position: "absolute",
    width: BTN_SIZE,
    height: BTN_SIZE,
    minWidth: BTN_SIZE,
    minHeight: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    elevation: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
});
