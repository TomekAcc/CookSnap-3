import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { DS } from "../utils/designSystem";
import { useTheme } from "../context/ThemeContext";
import StandardModal from "./StandardModal";

/**
 * StandardSmoothModal — themed chrome on top of StandardModal.
 * Fluid backdrop fade + slide, in both directions.
 * Never early-returns null on `!visible` — StandardModal (and OverlayHost,
 * one level up) own presence via useModalPresence, staying mounted through
 * the exit animation. Returning null here on close would unmount it early
 * and skip that animation entirely.
 */
export default function StandardSmoothModal({
  visible = false,
  onClose,
  children,
  title,
  subtitle = null,
  headerLeft = null,
  type = "bottom-sheet",
  footer = null,
  scroll = true,
  scrollProps = null,
  maxHeight,
  dragZoneHeight,
}) {
  const { colors } = useTheme();
  const handleClose = typeof onClose === "function" ? onClose : () => {};
  const isBottom = type !== "center";
  const isVisible = !!visible;

  // The invisible drag-to-dismiss zone (StandardModal) needs to end exactly
  // where the grab handle + header row do, or it silently swallows taps on
  // whatever's rendered right below them (confirmed directly: MealPlanner's
  // Auto-Fill Week banner ate taps meant for its own button because a
  // hand-picked `dragZoneHeight` didn't quite match this header's real
  // rendered height for that modal's actual title/subtitle text). Measuring
  // the real height here — instead of trusting every caller to hand-guess a
  // pixel value for its own title/subtitle length — fixes the whole class
  // of bug once, for every modal built on this component, regardless of
  // text length, line-wrapping, locale, or font-scale settings. Falls back
  // to the caller's `dragZoneHeight` (or StandardModal's own default) only
  // for the brief instant before the first layout pass resolves.
  const [measuredHeaderHeight, setMeasuredHeaderHeight] = useState(null);
  const effectiveDragZoneHeight =
    measuredHeaderHeight != null ? measuredHeaderHeight : dragZoneHeight;

  return (
    <StandardModal
      visible={isVisible}
      onClose={handleClose}
      type={type}
      maxHeight={maxHeight}
      dragZoneHeight={effectiveDragZoneHeight}
    >
      <View onLayout={(e) => setMeasuredHeaderHeight(e.nativeEvent.layout.height)}>
        {isBottom ? (
          <View
            style={[
              styles.grabHandle,
              { backgroundColor: colors.sheetHandle || colors.cardBorder },
            ]}
          />
        ) : null}

        <View
          style={[styles.headerRow, { borderBottomColor: colors.cardBorder }]}
        >
          <View style={styles.titleGroup}>
            {headerLeft ? (
              <View style={styles.headerLeftSlot}>{headerLeft}</View>
            ) : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              {typeof title === "string" ? (
                <Text
                  style={[styles.titleText, { color: colors.textPrimary }]}
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
                    style={[
                      styles.subtitleText,
                      { color: colors.textSecondary },
                    ]}
                    numberOfLines={2}
                  >
                    {subtitle}
                  </Text>
                ) : (
                  subtitle
                )
              ) : null}
            </View>
          </View>
        </View>
      </View>

      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          {...(scrollProps || {})}
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}

      {footer}
    </StandardModal>
  );
}

const styles = StyleSheet.create({
  grabHandle: {
    width: 40,
    height: 4.5,
    borderRadius: 3,
    alignSelf: "center",
    marginVertical: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: DS.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 6,
  },
  titleGroup: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  headerLeftSlot: {
    flexShrink: 0,
    marginRight: DS.spacing.sm,
  },
  titleText: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: "#0F172A",
  },
  // 13/500 to match the screen headers (Pantry & Staples, Saved Recipes,
  // Settings, Profile). titleText above is already byte-identical to those
  // headers' title — 24/800/-0.4 — so the subtitle sitting at 14/400 made
  // one half of an otherwise shared title+subtitle pair a size larger and a
  // weight lighter. Most visible on the Shopping List sheet, which opens
  // over the Pantry header and puts the two subtitles on screen together.
  subtitleText: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
    lineHeight: 18,
    color: "#64748B",
  },
  scrollContent: {
    paddingTop: 4,
    paddingBottom: 48,
  },
});
