import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { ShoppingCart, Circle, Check, PackageCheck } from "lucide-react-native";
import StandardSmoothModal from "./StandardSmoothModal";
import IconBadge from "./IconBadge";
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

// Primary-button fill used app-wide (Take Photo, Send Feedback, Scan CTA,
// Add — 17 call sites). This sheet's "Done Shopping" button was the only
// button anywhere on #0F172A, a visibly darker, bluer slate, so the app's
// most prominent full-width CTA didn't match any other primary button.
const SLATE_900 = "#1E293B";
const SLATE_300 = "#CBD5E1";

/**
 * Shopping List — slate CTA, clean check circles (no blue Buy chrome).
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

  const getRowOpacity = (itemId) => {
    if (!opacityRef.current[itemId]) {
      opacityRef.current[itemId] = new Animated.Value(1);
    }
    return opacityRef.current[itemId];
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
      headerLeft={
        <IconBadge tone="emerald" isDark={isDark}>
          <ShoppingCart size={18} color="#059669" />
        </IconBadge>
      }
      footer={
        <TouchableOpacity
          onPress={handleClose}
          activeOpacity={0.88}
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
        safeItems.map((item, index) => {
          const itemId = item?.id || item?.name || `item-${index}`;
          const isChecked = !!checkedIds[itemId];
          return (
            <Animated.View key={itemId} style={{ opacity: getRowOpacity(itemId) }}>
              <TouchableOpacity
                onPress={() => handleItemPress(item)}
                activeOpacity={0.8}
                disabled={isChecked}
                style={[
                  styles.itemRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.cardBorder,
                  },
                ]}
              >
                <View style={styles.itemLeftGroup}>
                  <View
                    style={[
                      styles.itemEmojiBox,
                      {
                        backgroundColor: isDark ? colors.inputBg : "#FFFFFF",
                        borderColor: isDark ? colors.cardBorder : "#E2E8F0",
                      },
                    ]}
                  >
                    <Text style={styles.itemEmoji} allowFontScaling={false}>
                      {item?.emoji || "🫙"}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.itemName,
                      { color: colors.textPrimary },
                      isChecked && styles.itemNameChecked,
                    ]}
                  >
                    {item?.name || t("shoppingList.itemFallback")}
                  </Text>
                </View>
                {isChecked ? (
                  <View
                    style={[
                      styles.checkCircleActive,
                      { backgroundColor: colors.accentGreen || "#10B981" },
                    ]}
                  >
                    <Check size={13} color="#FFFFFF" strokeWidth={2.5} />
                  </View>
                ) : (
                  <Circle
                    size={20}
                    color={isDark ? colors.textTertiary || SLATE_300 : SLATE_300}
                    strokeWidth={2}
                  />
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })
      )}
    </StandardSmoothModal>
  );
}

const styles = StyleSheet.create({
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 16,
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  itemLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    paddingRight: DS.spacing.sm,
  },
  itemEmojiBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  itemEmoji: {
    fontSize: 22,
    lineHeight: emojiLine(22),
    textAlign: "center",
    includeFontPadding: false,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "800",
    flexShrink: 1,
  },
  itemNameChecked: {
    textDecorationLine: "line-through",
  },
  checkCircleActive: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  doneButton: {
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: DS.spacing.md,
    marginBottom: DS.spacing.xs,
    backgroundColor: SLATE_900,
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.3,
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
