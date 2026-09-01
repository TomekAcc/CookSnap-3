import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Flame, Utensils, Heart, User } from "lucide-react-native";
import { useCookAI } from "../context/CookAIContext";
import { useModalState } from "../context/ModalContext";
import { useTheme } from "../context/ThemeContext";
import { animateLayout } from "../utils/layoutMotion";
import { breakLigatures } from "../utils/textLigatures";

// Same delayed-flatten pattern as Header.jsx: a live BlurView is one of the
// more GPU-expensive effects to keep compositing every frame, and this one
// sits directly behind every bottom-sheet modal's backdrop the whole time
// it's open — including for the full duration of any drag-to-dismiss
// gesture. It's already ~72% masked by the solid navBg overlay painted on
// top of it (below), so turning it off while a modal is open is visually
// unnoticeable but removes an ongoing compositing cost during every sheet
// drag. Delayed (not instant) to land in a separate commit from any Modal
// mount, same reasoning as Header's FLATTEN_DELAY_MS.
const FLATTEN_DELAY_MS = 120;

const TABS = [
  { id: "scanner", labelKey: "nav.scanner", icon: Flame },
  { id: "pantry", labelKey: "nav.pantry", icon: Utensils },
  { id: "saved", labelKey: "nav.saved", icon: Heart },
  { id: "profile", labelKey: "nav.profile", icon: User },
];

const ICON_SIZE = 22;
// Was iOS's default system blue (#007AFF) — never actually set to match
// the app's own brand color, just whatever renders when nothing else is
// specified. Every other "selected/active" state in the app already uses
// this same emerald (light/dark split matches the established convention
// used throughout, e.g. FridgeScannerHero, PantryTab: #10B981/#059669 in
// light mode, #34D399 in dark).
const ACTIVE = "#10B981";
const ACTIVE_DARK = "#34D399";
const INACTIVE = "#8E8E93";

export default function BottomNav() {
  const { activeTab, setActiveTab, isScanning, t } = useCookAI();
  const { isAnyModalOpen } = useModalState();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [flattened, setFlattened] = useState(false);
  useEffect(() => {
    if (isAnyModalOpen) {
      const id = setTimeout(() => setFlattened(true), FLATTEN_DELAY_MS);
      return () => clearTimeout(id);
    }
    setFlattened(false);
  }, [isAnyModalOpen]);

  if (isScanning) return null;

  const activeColor = isDark ? ACTIVE_DARK : ACTIVE;
  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          paddingBottom: bottomPad,
          borderTopColor: colors.navBorder,
        },
      ]}
    >
      {flattened ? null : (
        <BlurView
          intensity={80}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: flattened
              ? colors.card || colors.bg || "#FFFFFF"
              : colors.navBg || "rgba(255,255,255,0.72)",
          },
        ]}
      />

      <View style={styles.row}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => {
                if (tab.id === activeTab) return;
                animateLayout();
                setActiveTab(tab.id);
              }}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              style={styles.tab}
            >
              <Icon
                size={ICON_SIZE}
                color={isActive ? activeColor : INACTIVE}
                strokeWidth={isActive ? 2.4 : 1.8}
              />
              {/* The clipping guarantee lives on THIS plain View, not on the
                  Text's own numberOfLines/ellipsizeMode — on web, a Text
                  that's a column-flex child only shrinks to trigger its
                  ellipsis when something in the chain sets an explicit
                  min-width:0, and without it the browser lets long
                  translated words overflow straight past this tab's own
                  25%-wide column into the neighboring tab instead of
                  truncating (confirmed live: "leaving the actual tab").
                  overflow:"hidden" on a plain View is unconditionally
                  respected everywhere, so this wrapper is the actual
                  guarantee; numberOfLines+ellipsizeMode below just make the
                  cut end in "…" instead of a hard clip when it fires. */}
              <View style={{ width: "100%", overflow: "hidden", marginTop: 3 }}>
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={{
                    fontSize: 10,
                    lineHeight: 13,
                    letterSpacing: -0.1,
                    width: "100%",
                    minWidth: 0,
                    textAlign: "center",
                    // Constant weight — selection state is conveyed by color
                    // and icon stroke only. Toggling weight here changes
                    // glyph advance width, and since tab switches run
                    // through animateLayout(), that width change gets
                    // animated into a visible reflow "jump" instead of just
                    // recoloring in place.
                    fontWeight: "600",
                    color: isActive ? activeColor : INACTIVE,
                  }}
                >
                  {breakLigatures(t(tab.labelKey))}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8,
    // minHeight, not a hard height — a translated label longer than any
    // English tab name (some languages run noticeably longer per word)
    // must be able to grow this row rather than get squeezed/overlapped
    // against the icon above it inside a clipped fixed box. Combined with
    // the label's own numberOfLines={1} truncation below, this is the
    // "no matter the language" fix: it never collides, it just gracefully
    // grows or ellipsizes depending on how tight the specific word is.
    minHeight: 50,
    paddingVertical: 2,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    minWidth: 0,
    maxWidth: "25%",
  },
});
