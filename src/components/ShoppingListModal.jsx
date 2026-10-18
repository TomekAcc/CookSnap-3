import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, Share } from "react-native";
import { Circle, Check, PackageCheck, Share2 } from "lucide-react-native";
import StandardSmoothModal from "./StandardSmoothModal";
import { prettyPantryName } from "../services/geminiVision";
import { DS } from "../utils/designSystem";
import { animateLayout } from "../utils/layoutMotion";
import { useTheme } from "../context/ThemeContext";
import { useCookAI } from "../context/CookAIContext";
import { emojiLine } from "../theme/tokens";

// How long the checked state (filled circle, strikethrough) holds before the
// row starts fading, and how long that fade takes. Tuned from tester
// feedback on the first version of this fix ("450ms then vanish" still read
// as "crossed, then gone" rather than "crossed, then gradually disappeared")
// — this keeps the immediate cross-out but stretches the actual exit into a
// real fade instead of a hard cut.
const CHECKED_HOLD_MS = 500;
const FADE_OUT_MS = 380;

const SLATE_300 = "#CBD5E1";

/**
 * Shopping List — one calm list card, emerald primary button.
 */
export default function ShoppingListModal({
  visible = false,
  onClose,
  items = [],
  onRestockItem,
}) {
  const { colors, isDark } = useTheme();
  const { t } = useCookAI();
  const handleClose = typeof onClose === "function" ? onClose : () => {};
  const safeItems = Array.isArray(items) ? items : [];

  // Confirmed real feedback, from a live tester: tapping a row called
  // onRestockItem immediately, which pulls the item out of `items` (it's
  // filtered by inStock one level up in PantryTab) on the very next
  // render — no checked state ever appeared, it just vanished. This holds
  // a brief "checked" visual (filled circle, struck-through name), then
  // fades the row out before it actually leaves the list, rather than
  // cutting straight from checked to gone.
  const [checkedIds, setCheckedIds] = useState({});
  const pendingTimersRef = useRef({});
  const opacityRef = useRef({});
  useEffect(() => {
    const timers = pendingTimersRef.current;
    return () => {
      Object.values(timers).forEach((id) => clearTimeout(id));
    };
  }, []);

  // Confirmed real failure, reported directly by a user: check an item off
  // (buy it), then later mark that same pantry item out of stock again —
  // the shopping list's header count updates correctly, but the row itself
  // never shows up, as if the list were frozen. Root cause: this component
  // never unmounts between opens (PantryTab always renders it, just toggles
  // `visible`), so checkedIds and opacityRef are keyed by item id and live
  // for the component's entire lifetime. The first check-off animates that
  // id's opacity all the way to 0 and leaves checkedIds[id] permanently
  // true — neither is ever reset. When the same id later re-enters the
  // list, handleItemPress's `if (checkedIds[itemId]) return` means tapping
  // it again does nothing, and getRowOpacity hands back the same
  // Animated.Value still parked at 0 from the previous cycle — a real row,
  // present in the DOM, genuinely invisible. Fixes it by treating a
  // newly-(re)appeared id as a clean slate: whenever an id shows up in
  // `items` that wasn't there on the previous render, clear its checked
  // flag and snap its opacity back to 1 before this render's paint.
  const prevIdsRef = useRef(new Set());
  useEffect(() => {
    const currentIds = new Set(
      safeItems.map((item, i) => item?.id || item?.name || `item-${i}`)
    );
    const newlyPresent = [...currentIds].filter((id) => !prevIdsRef.current.has(id));
    if (newlyPresent.length) {
      setCheckedIds((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const id of newlyPresent) {
          if (next[id]) {
            delete next[id];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      for (const id of newlyPresent) {
        opacityRef.current[id]?.setValue(1);
      }
    }
    prevIdsRef.current = currentIds;
    // safeItems is a fresh array/derived value every render (it's either the
    // `items` prop directly or the [] fallback) — depending on its elements'
    // identity via this join keeps the effect from re-running every render
    // for no reason while still catching every real add/remove.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeItems.map((item, i) => item?.id || item?.name || `item-${i}`).join("|")]);

  const getRowOpacity = (itemId) => {
    if (!opacityRef.current[itemId]) {
      opacityRef.current[itemId] = new Animated.Value(1);
    }
    return opacityRef.current[itemId];
  };

  // A shopping list is only useful in the shop: hand it to the system share
  // sheet (Messages, Notes, Reminders...) as a plain bulleted list.
  const handleShare = async () => {
    const lines = safeItems.map(
      (item) => `• ${prettyPantryName(item?.name) || t("shoppingList.itemFallback")}`
    );
    try {
      await Share.share({ message: `${t("pantry.shoppingListTitle")}\n\n${lines.join("\n")}` });
    } catch {
      // dismissed or unavailable: nothing to do
    }
  };

  const handleItemPress = (item) => {
    const itemId = item?.id || item?.name;
    if (!itemId || checkedIds[itemId]) return;
    setCheckedIds((prev) => ({ ...prev, [itemId]: true }));

    const opacity = getRowOpacity(itemId);
    // Quick dim the instant it's checked — reads as "acted on" alongside
    // the checkmark/strikethrough that appear in the same render.
    Animated.timing(opacity, {
      toValue: 0.55,
      duration: 120,
      useNativeDriver: true,
    }).start();

    pendingTimersRef.current[itemId] = setTimeout(() => {
      delete pendingTimersRef.current[itemId];
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_OUT_MS,
        useNativeDriver: true,
      }).start(() => {
        // Row is already invisible by the time it's actually removed from
        // the list, so the space it leaves behind collapses smoothly
        // instead of the list jumping.
        animateLayout();
        onRestockItem && onRestockItem(item);
      });
    }, CHECKED_HOLD_MS);
  };

  return (
    <StandardSmoothModal
      visible={!!visible}
      onClose={handleClose}
      title={t("pantry.shoppingListTitle")}
      subtitle={t(
        safeItems.length === 1 ? "pantry.itemsNeededOne" : "pantry.itemsNeededOther",
        { count: safeItems.length }
      )}
      type="bottom-sheet"
      footer={
        <TouchableOpacity
          onPress={handleClose}
          activeOpacity={0.85}
          style={styles.doneButton}
        >
          <Text style={styles.doneButtonText}>{t("shoppingList.doneShopping")}</Text>
        </TouchableOpacity>
      }
    >
      {safeItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View
            style={[
              styles.emptyIcon,
              {
                backgroundColor: colors.accentGreenSoft || "#ECFDF5",
                borderColor: colors.accentGreenBorder || "#D1FAE5",
              },
            ]}
          >
            <PackageCheck size={28} color={colors.accentGreen || "#10B981"} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            {t("shoppingList.listClear")}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {t("shoppingList.listClearDesc")}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.hintRow}>
            <Text style={[styles.hint, { color: colors.textSecondary }]} numberOfLines={2}>
              {t("shoppingList.tapHint")}
            </Text>
            <TouchableOpacity
              onPress={handleShare}
              activeOpacity={0.7}
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.shareBtn}
            >
              <Share2 size={15} color="#059669" strokeWidth={2.4} />
              <Text style={styles.shareText} numberOfLines={1}>
                {t("shoppingList.share")}
              </Text>
            </TouchableOpacity>
          </View>
          {/* One calm card with hairline dividers instead of a stack of
              bordered cards with boxed emoji: four items read as a list, not
              four buttons. */}
          <View
            style={[
              styles.listCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            {safeItems.map((item, index) => {
              const itemId = item?.id || item?.name || `item-${index}`;
              const isChecked = !!checkedIds[itemId];
              return (
                <Animated.View key={itemId} style={{ opacity: getRowOpacity(itemId) }}>
                  <TouchableOpacity
                    onPress={() => handleItemPress(item)}
                    activeOpacity={0.7}
                    disabled={isChecked}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isChecked }}
                    style={[
                      styles.itemRow,
                      index > 0 && {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: colors.cardBorder,
                      },
                    ]}
                  >
                    <Text style={styles.itemEmoji} allowFontScaling={false}>
                      {item?.emoji || "🫙"}
                    </Text>
                    <Text
                      style={[
                        styles.itemName,
                        { color: isChecked ? colors.textSecondary : colors.textPrimary },
                        isChecked && styles.itemNameChecked,
                      ]}
                    >
                      {prettyPantryName(item?.name) || t("shoppingList.itemFallback")}
                    </Text>
                    {isChecked ? (
                      <View
                        style={[
                          styles.checkCircleActive,
                          { backgroundColor: colors.accentGreen || "#10B981" },
                        ]}
                      >
                        <Check size={14} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    ) : (
                      <Circle
                        size={24}
                        color={isDark ? colors.textTertiary || SLATE_300 : SLATE_300}
                        strokeWidth={2}
                      />
                    )}
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        </>
      )}
    </StandardSmoothModal>
  );
}

const styles = StyleSheet.create({
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  hint: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(16,185,129,0.12)",
  },
  shareText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#059669",
  },
  listCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
  },
  itemEmoji: {
    fontSize: 26,
    lineHeight: emojiLine(26),
    width: 34,
    textAlign: "center",
    includeFontPadding: false,
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  itemNameChecked: {
    textDecorationLine: "line-through",
  },
  checkCircleActive: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  // Same emerald, height and type as every other full-width primary button.
  doneButton: {
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: DS.spacing.md,
    marginBottom: DS.spacing.xs,
    backgroundColor: "#059669",
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: "#FFFFFF",
  },
  emptyContainer: {
    paddingVertical: 20,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 6,
    textAlign: "center",
    lineHeight: 18,
  },
});
