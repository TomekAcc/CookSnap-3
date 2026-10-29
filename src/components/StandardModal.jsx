import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
  Pressable,
  Text,
  Animated as RNAnimated,
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
import { useTranslation } from "../context/LanguageContext";
import {
  BACKDROP_COLOR,
  BACKDROP_SHADOW_KILL,
  EXIT_ANIM_MS,
  useBackdropFade,
  useModalPresence,
} from "../utils/bottomSheet";
import { SLATE, WHITE } from "../theme/palette";
import { SHOW_TESTING_TOOLS } from "../config/flags";

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
// A short drag-and-release must snap back, but a long one must not be needed
// either: closing takes a pull of 20% of the sheet's height, never less than
// 90 px and never more than 130 px (30% of a tall sheet was ~180 px, too far
// for a thumb), or a real flick (fast AND past a small minimum distance).
const DISMISS_MIN = 90;
const DISMISS_MAX = 130;
const DISMISS_FRACTION = 0.2;
const DISMISS_VELOCITY = 900;
const FLICK_MIN_DISTANCE = 30;

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
  // Confirmed real bug, not a hypothetical: this drag zone is a full-width
  // absolute overlay at zIndex 30, stacked as a LATER sibling of
  // `children` — so it paints (and captures every touch) on top of
  // anything children renders underneath it, no matter what zIndex that
  // content itself uses (a descendant can't out-stack a later sibling of
  // its own ancestor). RecipeDetailModal added a real close button inside
  // its header, which sits inside this zone, and every tap on it — even a
  // Playwright forced click that bypasses hit-testing entirely — was
  // silently swallowed by this View before React's onPress ever fired.
  // Carving out a right-edge strip lets that one control work without
  // touching drag-to-dismiss for the rest of the zone, or for any other
  // sheet that doesn't pass this prop (default 0 preserves old behavior
  // exactly).
  dragZoneRightInset = 0,
  // For short sheets with no scrolling content (pickers, steppers): the whole
  // sheet can be pulled down, not just the thin handle/header strip. A
  // dismiss drag that starts anywhere lower on the sheet used to do nothing,
  // which read as "unresponsive". Needs a few more px of downward travel to
  // activate than the header zone, so a tap on a button that wobbles by a
  // pixel still counts as a tap. Don't use with a ScrollView inside.
  dragAnywhere = false,
  // Smaller margin under the last button (home-bar inset + 4 instead of + 16)
  // for short sheets where that band read as wasted space.
  compactBottom = false,
  // For sheets whose content scrolls: a Reanimated shared boolean that the
  // sheet's owner keeps true while its scroll view is at the very top. When
  // provided, pulling down from ANYWHERE on the sheet moves the whole sheet
  // (with the finger) as long as the list is at the top; otherwise the list
  // scrolls as normal. The owner should set bounces={false} on that list.
  scrollTopSignal = null,
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const handleClose = typeof onClose === "function" ? onClose : () => {};
  const isBottom = type !== "center";
  const { present, animate } = useModalPresence(!!visible);

  const translateY = useSharedValue(isBottom ? SCREEN_HEIGHT : 0);
  // The dim behind the sheet is driven by RN's own Animated (JS driver), not by a Reanimated shared value:
  // on the phone the Reanimated opacity stayed at 0, which left no dim AND no tap target (iOS gives no
  // touches to a view that is fully transparent).
  const dimOpacity = useBackdropFade(animate);
  // Measured sheet height (for the proportional dismiss distance).
  const sheetHeight = useSharedValue(0);

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
    } else {
      if (gestureDismissingRef.current) return;
      if (isBottom) {
        translateY.value = withTiming(SCREEN_HEIGHT, {
          duration: EXIT_ANIM_MS,
          easing: Easing.in(Easing.cubic),
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate]);

  const buildPan = (activeDown, failX) => Gesture.Pan()
    // Cut to the practical floor — the gesture recognizer needs *some*
    // confirmed downward movement before committing to "this is a drag"
    // (standard OS behavior), but every extra pixel here reads as a beat
    // of dead time before the sheet starts following the finger.
    .activeOffsetY([-1000, activeDown])
    // Wide horizontal tolerance — a one-handed reach up to a grab handle
    // naturally arcs sideways more than a straight-down pull, and a tight
    // tolerance can trip the gesture's own fail state mid-drag.
    .failOffsetX([-failX, failX])
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
      const pulled = e.translationY;
      const pullNeeded = Math.min(DISMISS_MAX, Math.max(DISMISS_MIN, sheetHeight.value * DISMISS_FRACTION));
      if (
        pulled > pullNeeded ||
        (e.velocityY > DISMISS_VELOCITY && pulled > FLICK_MIN_DISTANCE)
      ) {
        gestureDismissingRef.current = true;
        translateY.value = withTiming(SCREEN_HEIGHT, {
          duration: EXIT_ANIM_MS,
          easing: Easing.in(Easing.cubic),
        });
        runOnJS(handleClose)();
      } else {
        translateY.value = withSpring(0, { duration: 280, dampingRatio: 1 });
      }
    });
  // TEMPORARY diagnostics (preview only): T = touches reaching the sheet container, P = Pressable taps on
  // the backdrop, G = gesture-handler taps on the backdrop. Remove once the "tap above the sheet does
  // not close it" report is understood.
  const [dbg, setDbg] = useState({ t: 0, p: 0, g: 0, y: 0, h: 0, dim: -1 });
  useEffect(() => {
    if (!SHOW_TESTING_TOOLS) return undefined;
    const id = dimOpacity.addListener(({ value }) => setDbg((d) => (Math.abs(d.dim - value) > 0.05 ? { ...d, dim: Math.round(value * 100) / 100 } : d)));
    return () => dimOpacity.removeListener(id);
  }, [dimOpacity]);
  const bump = (key) => {
    if (SHOW_TESTING_TOOLS) setDbg((d) => ({ ...d, [key]: d[key] + 1 }));
  };
  const closedAtRef = useRef(0);
  const closeFromBackdrop = (via) => {
    bump(via === "g" ? "g" : "p");
    const now = Date.now();
    if (now - closedAtRef.current < 400) return;
    closedAtRef.current = now;
    handleClose();
  };
  const backdropTap = Gesture.Tap()
    .maxDistance(12)
    .onEnd((_e, success) => {
      if (success) runOnJS(closeFromBackdrop)("g");
    });
  const panGesture = buildPan(1, 45);
  const panAnywhere = buildPan(8, 30);

  // Scroll-aware whole-sheet pan: stays inactive (so the list scrolls) until the
  // list is at the top AND the finger moves down; then it takes over.
  const touchStart = useSharedValue({ x: 0, y: 0 });
  // True once the pan has taken over. After that point NOTHING may cancel it:
  // a slow thumb drag drifts sideways well past the early "this is a scroll or
  // a horizontal swipe" thresholds, and cancelling mid-drag made the sheet
  // spring back while still being held.
  const panTookOver = useSharedValue(false);
  const panScrollAware = scrollTopSignal
    ? buildPan(1, 1000)
        .manualActivation(true)
        .onTouchesDown((e) => {
          "worklet";
          touchStart.value = { x: e.allTouches[0].absoluteX, y: e.allTouches[0].absoluteY };
          panTookOver.value = false;
        })
        .onTouchesMove((e, manager) => {
          "worklet";
          if (panTookOver.value) return;
          const dy = e.allTouches[0].absoluteY - touchStart.value.y;
          const dx = e.allTouches[0].absoluteX - touchStart.value.x;
          if (!scrollTopSignal.value || dy < -6 || (Math.abs(dx) > 14 && Math.abs(dx) > dy)) {
            manager.fail();
          } else if (dy > 8) {
            // translationY is counted from the moment the pan takes over, so the
            // sheet starts moving from there with no jump.
            panTookOver.value = true;
            manager.activate();
          }
        })
    : null;

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: isBottom ? [{ translateY: translateY.value }] : [],
  }));

  const sheetNode = (
    <Animated.View
      onLayout={(e) => {
        sheetHeight.value = e.nativeEvent.layout.height;
      }}
      style={[
        styles.sheet,
        BACKDROP_SHADOW_KILL,
        isBottom ? styles.bottomSheet : styles.centerSheet,
        maxHeight != null ? { maxHeight } : null,
        {
          backgroundColor: colors.card || WHITE,
          borderColor: colors.cardBorder || SLATE[100],
          paddingBottom: isBottom
            ? Math.max(
                (insets?.bottom || 0) + (compactBottom ? 4 : 16),
                compactBottom ? 16 : 24
              )
            : 16,
        },
        sheetAnimatedStyle,
        contentStyle,
      ]}
    >
      {children}
      {isBottom && !dragAnywhere ? (
        <GestureDetector gesture={panGesture}>
          <View
            style={[
              styles.dragZone,
              { height: dragZoneHeight, right: dragZoneRightInset },
            ]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </GestureDetector>
      ) : null}
    </Animated.View>
  );

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
        onLayout={SHOW_TESTING_TOOLS ? (e) => setDbg((d) => ({ ...d, h: Math.round(e.nativeEvent.layout.height) })) : undefined}
        onTouchStart={SHOW_TESTING_TOOLS ? (e) => setDbg((d) => ({ ...d, t: d.t + 1, y: Math.round(e.nativeEvent.pageY) })) : undefined}
      >
        {SHOW_TESTING_TOOLS ? (
          <View
            pointerEvents="none"
            style={{ position: "absolute", top: 54, left: 12, zIndex: 99, backgroundColor: "rgba(0,0,0,0.75)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}
          >
            <Text style={{ color: WHITE, fontSize: 12, fontWeight: "700" }}>{`d2  touch ${dbg.t}  press ${dbg.p}  gesture ${dbg.g}  y ${dbg.y}  box ${dbg.h}  dim ${dbg.dim}`}</Text>
          </View>
        ) : null}
        {/* Touch catcher: a plain view that is never transparent to the system, so it always gets the tap. */}
        <View style={styles.backdrop}>
          {/* Two routes to the same close: the Pressable (web, screen readers) and a gesture-handler tap,
              which is the same machinery that already carries the drag-to-dismiss inside this native
              Modal. closeFromBackdrop ignores the second call when both fire for one tap. */}
          <GestureDetector gesture={backdropTap}>
            <View style={StyleSheet.absoluteFill}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => closeFromBackdrop("p")}
                accessibilityRole="button"
                accessibilityLabel={t("a11y.dismiss")}
              />
            </View>
          </GestureDetector>
        </View>
        {/* The dim itself: its own layer above the catcher, letting every touch through. */}
        <RNAnimated.View
          pointerEvents="none"
          style={[
            styles.backdrop,
            BACKDROP_SHADOW_KILL,
            { backgroundColor: colors.backdrop || BACKDROP_COLOR, opacity: dimOpacity, pointerEvents: "none" },
          ]}
        />

        {/* Always wrapped for bottom sheets and switched on/off with .enabled():
            toggling the wrapper itself would remount the sheet's children
            (losing input focus) whenever a sheet starts or stops overflowing. */}
        {isBottom ? (
          <GestureDetector gesture={panScrollAware || panAnywhere.enabled(!!dragAnywhere)}>
            {sheetNode}
          </GestureDetector>
        ) : (
          sheetNode
        )}
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
    ...StyleSheet.absoluteFill,
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
