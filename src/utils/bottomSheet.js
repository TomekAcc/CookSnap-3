import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SCREEN_WIDTH = Dimensions.get("window").width;

export const BACKDROP_COLOR = "rgba(15, 23, 42, 0.58)";
export const BACKDROP_FADE_MS = 250;

export const BACKDROP_SHADOW_KILL = Object.freeze({
  elevation: 0,
  shadowOpacity: 0,
  shadowColor: "transparent",
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  borderWidth: 0,
  borderColor: "transparent",
  margin: 0,
  padding: 0,
});

export function sheetBottomPadding(insetsBottom = 0) {
  return Math.max(insetsBottom + 12, 20);
}

// The exit animation itself (backdrop fade-out, sheet slide-down) runs for
// EXIT_ANIM_MS. The Modal must stay mounted noticeably LONGER than that —
// confirmed by direct timing traces that the animation's own useEffect
// doesn't fire until ~30-40ms after `animate` flips false (ordinary React
// effect-scheduling lag), so a bare match between the two durations tore
// the Modal down before the animation reached its last few frames
// (Animated's own callback reported finished=false, cut off at ~0.2%).
export const EXIT_ANIM_MS = 260;
export const EXIT_DURATION_MS = EXIT_ANIM_MS + 90;
const ENTER_DELAY_MS = 32;

/**
 * One presence hook driving every modal's full lifecycle — mount, entrance,
 * exit, unmount. Two things had to be true at once and used to fight each
 * other: (1) opening a modal always coincides with a state write that
 * recomputes shared context and re-renders several consumers at once —
 * flipping the native Modal `visible` true in that same commit collided
 * with iOS's own presentation transition and left it presented-but-blank
 * (confirmed by direct on-device testing), so entry needs a short delay
 * before anything mounts; (2) whatever renders the modal was unmounting it
 * the INSTANT `visible` went false, giving exit animations zero time to
 * play before the native Modal (and the component driving it) was torn
 * down — so exit needs to stay mounted a bit longer, not less.
 *
 * `present`  — whether to keep the thing mounted at all (native Modal's own
 *              `visible`, or an outer conditional-render gate). True from
 *              enterDelayMs after `visible` flips true, until exitDurationMs
 *              after `visible` flips false.
 * `animate`  — the target for backdrop opacity / sheet position. Same true
 *              moment as `present`, but flips false THE INSTANT `visible`
 *              does, so the exit animation starts right away while
 *              `present` keeps things mounted long enough for it to finish.
 */
export function useModalPresence(
  visible,
  { enterDelayMs = ENTER_DELAY_MS, exitDurationMs = EXIT_DURATION_MS } = {}
) {
  const [present, setPresent] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (visible) {
      const id = setTimeout(() => {
        setPresent(true);
        setAnimate(true);
      }, enterDelayMs);
      return () => clearTimeout(id);
    }
    setAnimate(false);
    const id = setTimeout(() => setPresent(false), exitDurationMs);
    return () => clearTimeout(id);
  }, [visible, enterDelayMs, exitDurationMs]);

  return { present, animate };
}

/**
 * GPU backdrop fade — animates both in AND out (no snap either direction).
 * Drive with the `animate` value from useModalPresence, not raw visibility.
 */
export function useBackdropFade(animate) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    try {
      // useNativeDriver: false — this opacity only ever drives a plain
      // Animated.View's style, so the JS-thread driver is plenty, and it
      // sidesteps any native-driver linking issue that could otherwise
      // silently break the animation (and everything after it).
      Animated.timing(backdropOpacity, {
        toValue: animate ? 1 : 0,
        duration: animate ? BACKDROP_FADE_MS : EXIT_ANIM_MS,
        useNativeDriver: false,
      }).start();
    } catch (err) {
      console.warn("[useBackdropFade] animation failed, snapping:", err?.message);
      backdropOpacity.setValue(animate ? 1 : 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate]);

  return backdropOpacity;
}

/**
 * Same idea as useSheetSlideIn, but horizontal — for side drawers (the
 * hamburger menu). Animates both in AND out; drive with `animate` from
 * useModalPresence, not raw visibility.
 */
export function useDrawerSlideIn(animate) {
  const translateX = useRef(new Animated.Value(-SCREEN_WIDTH)).current;

  useEffect(() => {
    try {
      Animated.timing(translateX, {
        toValue: animate ? 0 : -SCREEN_WIDTH,
        duration: animate ? 300 : EXIT_ANIM_MS,
        easing: animate ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } catch (err) {
      console.warn("[useDrawerSlideIn] animation failed, snapping:", err?.message);
      translateX.setValue(animate ? 0 : -SCREEN_WIDTH);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate]);

  return translateX;
}

/**
 * Soft fade backdrop for every modal/drawer dim overlay — one flat dim
 * color that fades in via opacity, uniformly across the whole screen at
 * once. (A top-to-bottom gradient was tried here first, but reads as the
 * dim "rising" from the bottom in sync with the sheet's own slide-in —
 * a flat fade is what actually looks like a single, all-at-once dim.)
 * Pass theme `colors.backdrop` via backgroundColor.
 */
export function FadingBackdrop({
  opacity,
  onPress,
  backgroundColor = BACKDROP_COLOR,
}) {
  return (
    <Animated.View
      style={[
        styles.staticBackdrop,
        BACKDROP_SHADOW_KILL,
        { opacity, backgroundColor },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />
    </Animated.View>
  );
}

export function SheetGrabHandle({ dark = false }) {
  return (
    <View style={[styles.grabHandle, dark && styles.grabHandleDark]} />
  );
}

/**
 * GOLDEN universal bottom sheet — identical chrome across all modals.
 *
 * CRITICAL: Do NOT return null when !visible.
 * Native Modal handles show/hide so exit slide animates instead of snapping.
 */
export function BottomSheetFrame({
  visible = false,
  onClose,
  children,
  dark = false,
  sheetStyle,
  showGrabHandle = true,
  maxHeight = "78%",
  backdropColor,
}) {
  const insets = useSafeAreaInsets();
  const handleClose = typeof onClose === "function" ? onClose : () => {};
  const backdropOpacity = useBackdropFade(!!visible);

  return (
    <Modal
      visible={!!visible}
      transparent={true}
      animationType="slide"
      statusBarTranslucent={true}
      hardwareAccelerated={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalRoot}>
        <FadingBackdrop
          opacity={backdropOpacity}
          onPress={handleClose}
          backgroundColor={
            backdropColor || (dark ? "rgba(2, 6, 23, 0.72)" : BACKDROP_COLOR)
          }
        />

        <View
          style={[
            dark ? styles.sheetCardDark : styles.sheetCard,
            {
              paddingBottom: Math.max((insets?.bottom || 0) + 12, 20),
              maxHeight,
            },
            sheetStyle,
          ]}
        >
          {showGrabHandle ? <SheetGrabHandle dark={dark} /> : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  staticBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 6,
    maxHeight: "78%",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      android: { elevation: 16 },
    }),
  },
  sheetCardDark: {
    backgroundColor: "#0F172A",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 6,
    maxHeight: "78%",
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.22,
        shadowRadius: 20,
      },
      android: { elevation: 16 },
    }),
  },
  grabHandle: {
    width: 40,
    height: 4.5,
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    alignSelf: "center",
    marginVertical: 8,
  },
  grabHandleDark: {
    backgroundColor: "#334155",
  },
});

/** @deprecated */
export const BOTTOM_SHEET_MODAL_PROPS = {
  transparent: true,
  animationType: "slide",
  statusBarTranslucent: true,
  hardwareAccelerated: true,
};
export const BOTTOM_SHEET_BACKDROP = styles.modalRoot;
export const BOTTOM_SHEET_CARD_LIGHT = styles.sheetCard;
export const BOTTOM_SHEET_CARD_DARK = styles.sheetCardDark;
