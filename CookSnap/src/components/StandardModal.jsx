import React, { useEffect, useRef } from "react";
import {
  Modal,
  View,
  StyleSheet,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
  Pressable,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { useCookAI } from "../context/CookAIContext";
import {
  BACKDROP_COLOR,
  BACKDROP_FADE_MS,
  BACKDROP_SHADOW_KILL,
  EXIT_ANIM_MS,
  useModalPresence,
} from "../utils/bottomSheet";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const ENTER_DURATION_MS = 300;

// How tall the invisible drag-to-dismiss zone is at the top of the sheet —
// generous on purpose so it easily covers the grab handle + header row
// (title/subtitle) of every StandardSmoothModal caller without needing to
// know each modal's exact header height. Callers with a taller header (or a
// tall maxHeight that pushes the grab handle up near the top of the screen,
// out of comfortable one-handed thumb reach) can pass a larger
// dragZoneHeight prop instead of raising this shared default.
const DRAG_ZONE_HEIGHT = 110;
// How far down you need to drag (or how fast you need to flick, in px/s)
// before it commits to closing instead of springing back. Forgiving on purpose.
const DISMISS_DISTANCE = 70;
const DISMISS_VELOCITY = 700;

/**
 * StandardModal — single source of truth for Cook AI overlays.
 *
 * Sheet position and backdrop opacity are driven entirely by Reanimated
 * shared values on the UI thread (worklets), not the classic `Animated` API.
 * The previous implementation combined a gesture-driven `Animated.Value`
 * with a separately-animated entrance/exit `Animated.Value` via
 * `Animated.add` + `interpolate` — a derived native graph that goes through
 * the JS bridge to construct, and was confirmed (by direct, repeated,
 * reproducible testing across every sheet in the app) to introduce a small
 * but real mid-drag stutter no amount of threshold/timing tuning removed.
 * Reanimated's worklets update the same single `translateY` shared value
 * directly on the UI thread whether the source is the entrance/exit timing
 * animation OR the live gesture — no bridge round trip, no derived-node
 * graph, and only ONE value to reason about instead of two summed together.
 *
 * - Native Modal `animationType="none"` for bottom sheets — the sheet slides
 *   itself in via the `translateY` shared value instead. The native "slide"
 *   animation translates the WHOLE modal content, backdrop included, up
 *   from off-screen, so the backdrop never actually covered the full
 *   screen: it arrived bottom-first alongside the sheet, showing as a hard
 *   edge partway up the screen mid-transition. Center modals keep native
 *   "fade", which doesn't have this problem (opacity has no direction to
 *   sweep).
 * - Synchronized backdrop opacity fade (no dim snap / pop)
 * - Zero elevation/shadow on backdrop + sheet (shadow purge)
 * - Stay mounted while `visible` flips false so exit slide can finish
 *   (callers must NOT `if (!visible) return null`)
 * - Bottom sheets can be pulled closed by dragging down from the grab
 *   handle / header area, via react-native-gesture-handler's modern
 *   Gesture.Pan() API paired with Reanimated worklets — fully UI-thread,
 *   no JS round trip per touch event.
 */
export default function StandardModal({
  visible = false,
  onClose,
  children,
  type = "bottom-sheet",
  maxHeight,
  contentStyle = null,
  dragZoneHeight = DRAG_ZONE_HEIGHT,
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useCookAI();
  const handleClose = typeof onClose === "function" ? onClose : () => {};
  const isBottom = type !== "center";
  const { present, animate } = useModalPresence(!!visible);

  const translateY = useSharedValue(isBottom ? SCREEN_HEIGHT : 0);
  const backdropOpacity = useSharedValue(0);

  // Guards against the entrance/exit effect below restarting the exit
  // animation a beat after a gesture-driven dismiss already started one on
  // this same shared value — handleClose() flips the parent's `visible`,
  // which round-trips back down as animate=false, and without this guard
  // that would fire a second, competing withTiming on the same value.
  const gestureDismissingRef = useRef(false);

  useEffect(() => {
    if (animate) {
      gestureDismissingRef.current = false;
      if (isBottom) {
        translateY.value = withTiming(0, {
          duration: ENTER_DURATION_MS,
          easing: Easing.out(Easing.cubic),
        });
      }
      backdropOpacity.value = withTiming(1, { duration: BACKDROP_FADE_MS });
    } else {
      if (gestureDismissingRef.current) return;
      if (isBottom) {
        translateY.value = withTiming(SCREEN_HEIGHT, {
          duration: EXIT_ANIM_MS,
          easing: Easing.in(Easing.cubic),
        });
      }
      backdropOpacity.value = withTiming(0, { duration: EXIT_ANIM_MS });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate]);

  const panGesture = Gesture.Pan()
    // Cut to the practical floor — the gesture recognizer needs *some*
    // confirmed downward movement before committing to "this is a drag"
    // (standard OS behavior), but every extra pixel here reads as a beat
    // of dead time before the sheet starts following the finger.
    .activeOffsetY([-1000, 1])
    // Wide horizontal tolerance — a one-handed reach up to a grab handle
    // naturally arcs sideways more than a straight-down pull, and a tight
    // tolerance can trip the gesture's own fail state mid-drag.
    .failOffsetX([-45, 45])
    .onUpdate((e) => {
      // A raw 1:1 bind here means any brief pause in the finger's own
      // motion (without lifting) reads as the SHEET itself freezing —
      // confirmed directly: the stall consistently lands exactly where the
      // finger stops, not at a fixed point in the drag. Chasing the touch
      // position with a fast, critically-damped spring instead means the
      // sheet still tracks essentially 1:1 during continuous motion (each
      // new target arrives well inside the spring's settle window), but a
      // hesitation in the hand now shows as a smooth, brief settle instead
      // of a hard stop. Cut to 60ms (from 100ms) — still enough to smooth
      // a pause, but shortens how long that settle tail stays visible.
      translateY.value = withSpring(Math.max(e.translationY, 0), {
        duration: 60,
        dampingRatio: 1,
      });
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        gestureDismissingRef.current = true;
        translateY.value = withTiming(SCREEN_HEIGHT, {
          duration: EXIT_ANIM_MS,
          easing: Easing.in(Easing.cubic),
        });
        backdropOpacity.value = withTiming(0, { duration: EXIT_ANIM_MS });
        runOnJS(handleClose)();
      } else {
        translateY.value = withSpring(0, { duration: 280, dampingRatio: 1 });
      }
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: isBottom ? [{ translateY: translateY.value }] : [],
  }));
  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return (
    <Modal
      visible={present}
      transparent
      animationType={isBottom ? "none" : "fade"}
      statusBarTranslucent
      hardwareAccelerated
      presentationStyle="overFullScreen"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, !isBottom && styles.centerContainer]}
      >
        <Animated.View
          style={[
            styles.backdrop,
            BACKDROP_SHADOW_KILL,
            { backgroundColor: colors.backdrop || BACKDROP_COLOR },
            backdropAnimatedStyle,
          ]}
          pointerEvents="box-none"
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.dismiss")}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            BACKDROP_SHADOW_KILL,
            isBottom ? styles.bottomSheet : styles.centerSheet,
            maxHeight != null ? { maxHeight } : null,
            {
              backgroundColor: colors.card || "#FFFFFF",
              borderColor: colors.cardBorder || "#F1F5F9",
              paddingBottom: isBottom
                ? Math.max((insets?.bottom || 0) + 16, 24)
                : 16,
            },
            sheetAnimatedStyle,
            contentStyle,
          ]}
        >
          {children}
          {isBottom ? (
            <GestureDetector gesture={panGesture}>
              <View
                style={[styles.dragZone, { height: dragZoneHeight }]}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
            </GestureDetector>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  centerContainer: {
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    zIndex: 20,
    paddingHorizontal: 20,
    paddingTop: 6,
    // Shadow purge — no iOS/Android elevation pop under dim
    elevation: 0,
    shadowOpacity: 0,
    shadowColor: "transparent",
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  bottomSheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: "75%",
    borderTopWidth: 1,
  },
  centerSheet: {
    borderRadius: 24,
    maxHeight: "78%",
    width: "100%",
    borderWidth: 1,
    ...Platform.select({
      ios: {},
      default: {},
    }),
  },
  dragZone: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: DRAG_ZONE_HEIGHT,
    zIndex: 30,
  },
});
