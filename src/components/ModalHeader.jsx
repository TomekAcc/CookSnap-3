import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";

/** Canonical close control — same size / hit area in every modal. */
export const MODAL_CLOSE_SIZE = 36;
export const MODAL_CLOSE_ICON = 16;

/**
 * Standardized modal "X" — identical size, padding, and hitSlop everywhere.
 */
export function ModalCloseButton({
  onPress,
  dark = false,
  accessibilityLabel = "Close",
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.closeBtn, dark && styles.closeBtnDark]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <X size={MODAL_CLOSE_ICON} color={dark ? "#CBD5E1" : "#64748B"} />
    </TouchableOpacity>
  );
}

/**
 * Reusable modal header with automatic safe-area top inset.
 *
 * @param {'overlay'|'sheet'} variant
 * - overlay: full-screen drawers / edge-to-edge cards (Menu, Help) —
 *   paddingTop = insets.top + 8 so the X / title clear the notch.
 * - sheet: bottom sheets (Shopping, Pro, Scan History, …) —
 *   the sheet already sits below the status bar; uses a light base pad only,
 *   but still reads insets so we never hardcode notch margins.
 */
export default function ModalHeader({
  title,
  subtitle,
  icon = null,
  onClose,
  variant = "sheet",
  dark: darkProp,
  border = true,
  right = null,
  style,
  children,
}) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const dark = darkProp != null ? !!darkProp : isDark;
  const topInset = Math.max(insets?.top || 0, 0);

  // overlay → clear the notch; sheet → base pad (sheet body is already mid-screen)
  const paddingTop = variant === "overlay" ? topInset + 8 : 8;

  return (
    <View
      style={[
        styles.row,
        border && (dark ? styles.borderDark : styles.borderLight),
        { paddingTop },
        style,
      ]}
    >
      <View style={styles.titleGroup}>
        {icon ? <View style={styles.iconSlot}>{icon}</View> : null}
        <View style={styles.textCol}>
          {typeof title === "string" ? (
            <Text
              style={[styles.title, dark && styles.titleDark]}
              numberOfLines={2}
            >
              {title}
            </Text>
          ) : (
            title
          )}
          {subtitle ? (
            typeof subtitle === "string" ? (
              <Text
                style={[styles.subtitle, dark && styles.subtitleDark]}
                numberOfLines={2}
              >
                {subtitle}
              </Text>
            ) : (
              subtitle
            )
          ) : null}
          {children}
        </View>
      </View>

      {right != null ? (
        right
      ) : onClose ? (
        <ModalCloseButton
          onPress={onClose}
          dark={dark}
          accessibilityLabel={`Close ${typeof title === "string" ? title : "modal"}`}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
    marginBottom: 2,
    gap: 6,
  },
  borderLight: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F1F5F9",
  },
  borderDark: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148, 163, 184, 0.25)",
  },
  titleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  iconSlot: {
    flexShrink: 0,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  titleDark: {
    color: "#F8FAFC",
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 1,
  },
  subtitleDark: {
    color: "#94A3B8",
  },
  closeBtn: {
    width: MODAL_CLOSE_SIZE,
    height: MODAL_CLOSE_SIZE,
    minWidth: MODAL_CLOSE_SIZE,
    minHeight: MODAL_CLOSE_SIZE,
    borderRadius: MODAL_CLOSE_SIZE / 2,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  closeBtnDark: {
    backgroundColor: "#1E293B",
  },
});
