import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Trash2 } from "lucide-react-native";
import { useCookAI } from "../context/CookAIContext";

const DELETE_WIDTH = 76;
const OPEN_X = -DELETE_WIDTH;
const SNAP_MS = 220;

/**
 * iOS Mail–style swipe-to-delete. Built on core RN PanResponder + Animated
 * (no react-native-gesture-handler) — this app has no GestureHandlerRootView
 * wired up, and every native-gesture-adjacent change this session has been
 * high-risk against the Modal stack, so this stays JS-only.
 */
export default function SwipeToDeleteRow({
  children,
  onDelete,
  isOpen,
  onOpenChange,
  disabled,
  borderRadius = 20,
}) {
  const { t } = useCookAI();
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpenRef = useRef(false);
  // The real, measured position at gesture start — NOT an assumption from
  // the open/closed boolean. Reading `isOpenRef` as the drag base caused a
  // visible snap/jump whenever the previous snap animation hadn't fully
  // settled yet (e.g. a quick re-swipe), because the assumed base (0 or
  // OPEN_X) could be a few pixels off from where the row actually was.
  const dragBaseRef = useRef(0);

  const snapTo = (toValue) => {
    Animated.timing(translateX, {
      toValue,
      duration: SNAP_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    isOpenRef.current = !!isOpen;
    snapTo(isOpen ? OPEN_X : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const panResponder = useRef(
    PanResponder.create({
      // Deliberately conservative — this lives inside a vertically
      // scrolling list, and a PanResponder here competes with the
      // ScrollView's own responder for every touch. A low/loose threshold
      // caused both to intermittently "win," reading as jitter/vertical
      // jumps mid-swipe. Requiring a clearer horizontal intent before
      // claiming the gesture avoids most of that fight.
      onMoveShouldSetPanResponder: (_, g) =>
        !disabled &&
        Math.abs(g.dx) > 10 &&
        Math.abs(g.dx) > Math.abs(g.dy) * 2.2,
      onPanResponderGrant: () => {
        translateX.stopAnimation((value) => {
          dragBaseRef.current = value;
        });
      },
      onPanResponderMove: (_, g) => {
        const next = Math.max(
          OPEN_X - 12,
          Math.min(0, dragBaseRef.current + g.dx)
        );
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const projected = dragBaseRef.current + g.dx;
        // Fast flick counts even if it didn't cross the halfway mark yet.
        const isFastFlick = Math.abs(g.vx) > 0.6;
        const shouldOpen = isFastFlick
          ? g.vx < 0 || projected < OPEN_X / 4
          : projected < OPEN_X / 2;
        isOpenRef.current = shouldOpen;
        onOpenChange?.(shouldOpen);
        snapTo(shouldOpen ? OPEN_X : 0);
      },
      // Once we've legitimately claimed a horizontal swipe (past the strict
      // dx/dy threshold above), hold onto it until release — returning true
      // here let the parent ScrollView yank the gesture away mid-drag,
      // which is exactly what read as "pulls back and snaps to the right"
      // before the finger even lifted.
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {
        snapTo(isOpenRef.current ? OPEN_X : 0);
      },
    })
  ).current;

  const handleDelete = () => {
    isOpenRef.current = false;
    onOpenChange?.(false);
    onDelete?.();
  };

  return (
    <View style={styles.wrap}>
      <View
        style={[styles.deleteBg, { borderRadius }]}
        pointerEvents={isOpen ? "auto" : "none"}
      >
        <TouchableOpacity
          onPress={handleDelete}
          activeOpacity={0.85}
          style={styles.deleteBtn}
          accessibilityLabel={t("a11y.deleteItem")}
          accessibilityRole="button"
        >
          <Trash2 size={20} color="#FFFFFF" strokeWidth={2} />
        </TouchableOpacity>
      </View>
      <Animated.View
        {...panResponder.panHandlers}
        style={{ transform: [{ translateX }] }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
  },
  deleteBg: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: DELETE_WIDTH,
    overflow: "hidden",
    backgroundColor: "#EF4444",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  deleteBtn: {
    width: DELETE_WIDTH,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
});
