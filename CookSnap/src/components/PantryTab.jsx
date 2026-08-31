import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
} from "react-native";
import {
  Zap,
  Check,
  Plus,
  Search,
  X,
  Sparkles,
  RefreshCw,
  ShoppingCart,
  Package,
  PackageOpen,
  Trash2,
} from "lucide-react-native";
import { useCookAI } from "../context/CookAIContext";
import { useModalState } from "../context/ModalContext";
import { useTheme } from "../context/ThemeContext";
import { PANTRY_CATEGORIES, PANTRY_STAPLES } from "../data/recipes";
import StandardSmoothModal from "./StandardSmoothModal";
import SwipeToDeleteRow from "./SwipeToDeleteRow";
import PillTag from "./PillTag";
import ShoppingListModal from "./ShoppingListModal";
import PantryScannerHero from "./PantryScannerHero";
import ErrorBoundary from "./ErrorBoundary";
import IconBadge from "./IconBadge";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// PANTRY_CATEGORIES' own values stay English (they're also the actual
// matching key against each pantry item's stored `category`, set by the
// classifier in imageUtils.js) — this maps them to a display-only
// translation key, same language-independent-data pattern as dishType.
const CATEGORY_LABEL_KEYS = {
  All: "pantryCategory.all",
  "Spices & Herbs": "pantryCategory.spicesHerbs",
  "Oils & Sauces": "pantryCategory.oilsSauces",
  "Grains & Baking": "pantryCategory.grainsBaking",
  Condiments: "pantryCategory.condiments",
};

export default function PantryTab() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    pantryItems,
    togglePantryItem,
    addPantryItem,
    removePantryItem,
    clearPantry,
    showToast,
    t,
  } = useCookAI();
  const { setLocalSheetOpen } = useModalState();

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  // LOCAL visibility only — never write activeModalId on open. Routing these
  // through CookAIContext re-rendered every App-level modal in the same frame
  // the native Modal presents, which locked the JS thread.
  const [showAddModal, setShowAddModal] = useState(false);
  const [showShoppingModal, setShowShoppingModal] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [isAIAnalyzing, setIsAIAnalyzing] = useState(false);
  // Which pantry row (if any) currently has its swipe-to-delete action
  // revealed. Only one row stays open at a time, like iOS Mail.
  const [openSwipeId, setOpenSwipeId] = useState(null);

  const filteredItems = useMemo(() => {
    return (pantryItems || []).filter((item) => {
      const cat = item.category === "Condiments & Jars" ? "Condiments" : item.category;
      const matchesCategory =
        selectedCategory === "All" || cat === selectedCategory;
      const matchesSearch = String(item.name || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [pantryItems, selectedCategory, searchQuery]);

  const inStockItems = filteredItems.filter((item) => item.inStock);
  const outOfStockItems = filteredItems.filter((item) => !item.inStock);
  // Shopping list uses ALL out-of-stock staples (not category-filtered)
  const shoppingListItems = useMemo(
    () => (pantryItems || []).filter((item) => !item.inStock),
    [pantryItems]
  );

  // Header-flatten cosmetic — safe now that Header itself delays reacting to
  // isAnyModalOpen (see Header.jsx), so this write can never land in the
  // same commit as one of these local sheets mounting. The scan camera used
  // to be tracked here too, but it never actually called setLocalSheetOpen
  // itself on open (only this reset-to-false guard referenced it) — now
  // that the camera lives entirely inside PantryScannerHero, matching how
  // FridgeScannerHero's own camera modal also doesn't coordinate with this
  // flag, there's nothing behavior-changing about dropping it here.
  useEffect(() => {
    if (!(showShoppingModal || showAddModal)) {
      setLocalSheetOpen(false);
    }
  }, [showShoppingModal, showAddModal, setLocalSheetOpen]);

  const handleOpenShoppingList = useCallback(() => {
    setLocalSheetOpen(true);
    setShowShoppingModal(true);
  }, [setLocalSheetOpen]);

  const handleCloseShoppingList = useCallback(() => {
    setShowShoppingModal(false);
  }, []);

  const handleOpenAddModal = useCallback(() => {
    setLocalSheetOpen(true);
    setShowAddModal(true);
  }, [setLocalSheetOpen]);

  const handleRestockItem = useCallback(
    (item) => {
      if (item?.id) togglePantryItem(item.id);
    },
    [togglePantryItem]
  );

  const handleRemoveItem = useCallback(
    (item) => {
      if (!item?.id) return;
      removePantryItem(item.id);
      showToast?.(t("pantry.removedItem", { name: item.name }), "success");
    },
    [removePantryItem, showToast]
  );

  // Confirmed real feedback, from a live tester: after not opening the app
  // for a while they no longer trusted what the pantry list said was in
  // stock, and had no way to wipe it and start fresh short of removing
  // every item one swipe at a time. Alert.alert's destructive-style button
  // is the standard RN confirm-before-wipe pattern; nothing like it existed
  // in this codebase yet (the only prior Alert.alert usage was a plain
  // informational one in HelpFeedbackModal).
  const handleClearPantry = useCallback(() => {
    Alert.alert(
      t("pantry.clearAllConfirmTitle"),
      t("pantry.clearAllConfirmMessage"),
      [
        { text: t("pantry.clearAllCancel"), style: "cancel" },
        {
          text: t("pantry.clearAllConfirmAction"),
          style: "destructive",
          onPress: () => {
            clearPantry();
            showToast?.(t("pantry.clearedAll"), "success");
          },
        },
      ]
    );
  }, [clearPantry, showToast, t]);

  const handleAddCustomItem = async () => {
    const trimmed = newItemName.trim();
    if (!trimmed) return;
    setIsAIAnalyzing(true);
    try {
      await new Promise((r) => setTimeout(r, 450));
      addPantryItem(trimmed);
      setNewItemName("");
      setShowAddModal(false);
      showToast?.(t("pantry.addedItem", { name: trimmed }), "success");
    } finally {
      setIsAIAnalyzing(false);
    }
  };

  return (
    <>
      <ScrollView
        className="flex-1"
        style={{ backgroundColor: colors.bg }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: insets.bottom + 120,
        }}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => setOpenSwipeId(null)}
      >
        {/* Header — margin rhythm matches SavedScreen's "Saved Recipes"
            header exactly (title row marginBottom 8, subtitle marginBottom
            24 doubling as the gap before the next block). */}
        <View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <IconBadge tone="emerald" isDark={isDark} style={{ marginRight: 8 }}>
                <Zap size={18} color="#059669" />
              </IconBadge>
              <Text
                style={{
                  color: colors.textPrimary,
                  // Bold (700), not ExtraBold — matches the same change on
                  // Profile/Saved/Settings' titles, for a more visible "i" dot.
                  fontWeight: "700",
                  fontSize: 24,
                  letterSpacing: -0.4,
                }}
              >
                {t("pantry.title")}
              </Text>
            </View>
            {/* Same chip treatment as the Settings gear on Profile (bordered
                circle on colors.card) so this reads as tappable the same
                way that established header action does — muted icon color
                keeps it low-prominence since this is a destructive reset,
                not a primary action. Only shown once there's something to
                clear. */}
            {pantryItems.length > 0 && (
              <TouchableOpacity
                onPress={handleClearPantry}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={t("pantry.clearAllButton")}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Trash2 size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 13,
              fontWeight: "500",
              marginBottom: 24,
              lineHeight: 18,
            }}
          >
            {t("pantry.subtitle")}
          </Text>
        </View>

        {/* Scan hero — owns the camera trigger, gallery pick, and the
            photo/laser-sweep/step-progress choreography, matching Fridge's
            scanner experience (see PantryScannerHero.jsx). It does NOT also
            render a detected-items list itself: that's the In Stock / Out
            of Stock sections below, already fed by the same scan result. */}
        <PantryScannerHero onManualAdd={handleOpenAddModal} />

        {/* Search */}
        <View
          className="mb-3"
          style={{ position: "relative", justifyContent: "center" }}
        >
          <TextInput
            placeholder={t("pantry.searchPlaceholder")}
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              borderRadius: 16,
              fontSize: 12,
              color: colors.textPrimary,
              paddingLeft: 40,
              paddingRight: 40,
              paddingVertical: 10,
            }}
          />
          <View style={{ position: "absolute", left: 14 }}>
            <Search size={15} color={colors.textSecondary} />
          </View>
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={{ position: "absolute", right: 14 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={14} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Category pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 14 }}
        >
          {PANTRY_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <PillTag
                key={cat}
                label={t(CATEGORY_LABEL_KEYS[cat] || "pantryCategory.all")}
                selected={isActive}
                onPress={() => setSelectedCategory(cat)}
              />
            );
          })}
        </ScrollView>

        {/* Shopping List shortcut — the ONE entry point into it now. A
            second, more prominent copy of this same CTA used to also
            render at the bottom of the Out of Stock list — same data, same
            modal, just duplicated, which read as "the same thing twice"
            rather than two different things. Removed that one and kept
            this one: it lives above both sections, so it stays reachable
            in one tap even when a long In Stock list would otherwise push
            a bottom-of-list version far down the scroll. */}
        {shoppingListItems.length > 0 && (
          <Pressable
            key="shopping-list-shortcut"
            onPress={() => handleOpenShoppingList()}
            style={{
              backgroundColor: isDark ? "rgba(245,158,11,0.08)" : "#FFFBEB",
              marginTop: 2,
              marginBottom: 20,
              borderRadius: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderWidth: 1,
              borderColor: isDark ? "rgba(245,158,11,0.3)" : "#FDE68A",
              paddingVertical: 14,
              paddingHorizontal: 16,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 12 }}>
              <ShoppingCart size={20} color="#F59E0B" />
              {/* Two lines, not one — the count alone ("2 items needed")
                  never actually named the feature, so this only read as
                  "shopping list" to someone who already knew that's what it
                  was. Explicit "Shopping List" title now, same two-line
                  title/subtitle shape as every other named CTA on this
                  screen. */}
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text
                  style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 14 }}
                  numberOfLines={1}
                >
                  {t("pantry.shoppingListTitle")}
                </Text>
                <Text
                  style={{ color: colors.textSecondary, fontWeight: "500", fontSize: 12, marginTop: 1 }}
                  numberOfLines={1}
                >
                  {t(
                    shoppingListItems.length === 1
                      ? "pantry.itemsNeededOne"
                      : "pantry.itemsNeededOther",
                    { count: shoppingListItems.length }
                  )}
                </Text>
              </View>
            </View>
            <View
              style={{
                backgroundColor: "#F59E0B",
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: "#0F172A", fontWeight: "900", fontSize: 12, letterSpacing: 0.3 }}>
                {t("pantry.viewList")}
              </Text>
            </View>
          </Pressable>
        )}

        {/* In Stock */}
        <View style={{ marginBottom: 22 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 4,
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontWeight: "800",
                fontSize: 13,
                letterSpacing: -0.1,
              }}
            >
              {t("pantry.inStockCount", { count: inStockItems.length })}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 11,
                fontWeight: "600",
              }}
            >
              {t("pantry.tapToMarkOut")}
            </Text>
          </View>

          {inStockItems.length === 0 ? (
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 24,
                paddingVertical: 40,
                paddingHorizontal: 28,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.cardBorder,
                alignItems: "center",
              }}
            >
              {/* Page-level empty-state scale, shared with Saved Recipes and
                  the recipe feed: 88 chip / radius 28 / 36 glyph / 20-700--0.4
                  title. This was 80/28/34 with an 18--0.3 title, and the
                  "All clear" state further down was 72/24/30 with 17--0.3 —
                  three near-but-unequal sizes for the same kind of state,
                  two of them inside this one file. */}
              <View
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 28,
                  backgroundColor: colors.inputBg || "#F5F5F7",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                <Package
                  size={36}
                  color={colors.textTertiary || "#86868B"}
                  strokeWidth={2}
                />
              </View>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontWeight: "700",
                  fontSize: 20,
                  letterSpacing: -0.4,
                  textAlign: "center",
                }}
              >
                {t("pantry.nothingInStock")}
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontWeight: "400",
                  fontSize: 15,
                  textAlign: "center",
                  marginTop: 8,
                  lineHeight: 22,
                }}
              >
                {t("pantry.nothingInStockDesc")}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {inStockItems.map((item) => (
                <SwipeToDeleteRow
                  key={item.id}
                  isOpen={openSwipeId === item.id}
                  onOpenChange={(open) => setOpenSwipeId(open ? item.id : null)}
                  onDelete={() => handleRemoveItem(item)}
                >
                  <View
                    style={{
                      backgroundColor: isDark ? colors.card : "#FFFFFF",
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: isDark ? colors.cardBorder : "#F1F5F9",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => togglePantryItem(item.id)}
                      activeOpacity={0.85}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        flex: 1,
                        paddingRight: 12,
                        minWidth: 0,
                        gap: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 14,
                          backgroundColor: isDark ? colors.inputBg : "#F8FAFC",
                          borderWidth: 1,
                          borderColor: isDark ? colors.cardBorder : "#F1F5F9",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Text style={{ fontSize: 26, lineHeight: 30 }} allowFontScaling={false}>
                          {item.emoji}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0, justifyContent: "center" }}>
                        <Text
                          style={{
                            fontWeight: "800",
                            color: colors.textPrimary,
                            fontSize: 15,
                            lineHeight: 19,
                            letterSpacing: -0.2,
                          }}
                          numberOfLines={2}
                        >
                          {item.name}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => togglePantryItem(item.id)}
                      activeOpacity={0.85}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 9,
                        backgroundColor: isDark ? colors.inputBg : "#FFFFFF",
                        borderWidth: 1.5,
                        borderColor: isDark ? colors.cardBorder : "#CBD5E1",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Check size={14} color="#0F172A" strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                </SwipeToDeleteRow>
              ))}
            </View>
          )}
        </View>

        {/* Out of Stock + Shopping List */}
        <View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 4,
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                color: colors.textSecondary,
                fontWeight: "800",
                fontSize: 13,
                letterSpacing: -0.1,
              }}
            >
              {t("pantry.outOfStockCount", { count: outOfStockItems.length })}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 11,
                fontWeight: "600",
              }}
            >
              {t("pantry.tapToRestock")}
            </Text>
          </View>

          {outOfStockItems.length === 0 ? (
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 24,
                paddingVertical: 36,
                paddingHorizontal: 28,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.cardBorder,
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              {/* Same page-level empty-state scale as "Nothing in stock"
                  above — these two are siblings on one screen and were
                  rendering at different sizes (72/24/30 + 17/14 here vs
                  80/28/34 + 18/15 there). */}
              <View
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 28,
                  backgroundColor: colors.inputBg || "#F5F5F7",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                <PackageOpen
                  size={36}
                  color={colors.textTertiary || "#86868B"}
                  strokeWidth={2}
                />
              </View>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 20,
                  fontWeight: "700",
                  letterSpacing: -0.4,
                  textAlign: "center",
                }}
              >
                {t("pantry.allClear")}
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 15,
                  fontWeight: "400",
                  textAlign: "center",
                  marginTop: 8,
                  lineHeight: 22,
                }}
              >
                {t("pantry.allClearDesc")}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {outOfStockItems.map((item) => (
                <SwipeToDeleteRow
                  key={item.id}
                  isOpen={openSwipeId === item.id}
                  onOpenChange={(open) => setOpenSwipeId(open ? item.id : null)}
                  onDelete={() => handleRemoveItem(item)}
                >
                  <View
                    style={{
                      // Opaque, not a translucent rgba tint — this row sits
                      // directly in front of SwipeToDeleteRow's always-mounted
                      // red delete background, and a low-alpha fill let that
                      // red layer bleed through as an unwanted glow behind the
                      // Restock button in dark mode (confirmed via screenshot:
                      // identical row was clean in light mode, where the
                      // opaque #FFFBEB fully hid it).
                      backgroundColor: isDark ? "#3A2E1B" : "#FFFBEB",
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: isDark ? "rgba(245,158,11,0.3)" : "#FDE68A",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => togglePantryItem(item.id)}
                      activeOpacity={0.85}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        flex: 1,
                        paddingRight: 12,
                        minWidth: 0,
                        gap: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 14,
                          backgroundColor: isDark ? colors.inputBg : "#F8FAFC",
                          borderWidth: 1,
                          borderColor: isDark ? colors.cardBorder : "#F1F5F9",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          opacity: 0.7,
                        }}
                      >
                        <Text style={{ fontSize: 26, lineHeight: 30 }} allowFontScaling={false}>
                          {item.emoji}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0, justifyContent: "center" }}>
                        <Text
                          style={{
                            fontWeight: "800",
                            color: colors.textSecondary,
                            fontSize: 15,
                            lineHeight: 19,
                            letterSpacing: -0.2,
                            textDecorationLine: "line-through",
                          }}
                          numberOfLines={2}
                        >
                          {item.name}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => togglePantryItem(item.id)}
                      activeOpacity={0.85}
                      style={{
                        backgroundColor: "#F59E0B",
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 13,
                        flexDirection: "row",
                        alignItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Plus size={14} color="#0F172A" />
                      <Text
                        style={{
                          color: "#0F172A",
                          fontSize: 12,
                          fontWeight: "800",
                          marginLeft: 4,
                          letterSpacing: 0.3,
                          textTransform: "uppercase",
                        }}
                      >
                        {t("pantry.restock")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </SwipeToDeleteRow>
              ))}
            </View>
          )}

        </View>
      </ScrollView>

      <ErrorBoundary>
        <ShoppingListModal
          visible={showShoppingModal}
          onClose={handleCloseShoppingList}
          items={shoppingListItems}
          onRestockItem={handleRestockItem}
        />
      </ErrorBoundary>

      {/* Add Item Modal — StandardSmoothModal stays mounted for native exit slide */}
      <StandardSmoothModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={t("pantry.addStapleTitle")}
        type="bottom-sheet"
      >
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 12,
            lineHeight: 18,
            marginBottom: 12,
          }}
        >
          {t("pantry.addStapleDesc")}
        </Text>

        <TextInput
          placeholder={t("pantry.ingredientNamePlaceholder")}
          placeholderTextColor={colors.textSecondary}
          value={newItemName}
          onChangeText={setNewItemName}
          autoFocus={showAddModal}
          style={{
            backgroundColor: colors.inputBg,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: 14,
            fontWeight: "700",
            color: colors.textPrimary,
            marginBottom: 12,
          }}
        />

        <TouchableOpacity
          onPress={handleAddCustomItem}
          disabled={!newItemName.trim() || isAIAnalyzing}
          activeOpacity={0.9}
          style={{
            backgroundColor: isDark ? colors.textPrimary : "#0F172A",
            paddingVertical: 14,
            borderRadius: 16,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            opacity: !newItemName.trim() || isAIAnalyzing ? 0.6 : 1,
          }}
        >
          {isAIAnalyzing ? (
            <>
              <RefreshCw size={18} color="#F59E0B" />
              <Text
                style={{
                  color: isDark ? "#020617" : "#FFFFFF",
                  fontWeight: "800",
                  fontSize: 12,
                  marginLeft: 8,
                }}
              >
                {t("pantry.analyzing")}
              </Text>
            </>
          ) : (
            <>
              <Sparkles size={18} color="#F59E0B" />
              <Text
                style={{
                  color: isDark ? "#020617" : "#FFFFFF",
                  fontWeight: "800",
                  fontSize: 12,
                  marginLeft: 8,
                }}
              >
                {t("pantry.analyzeAndAdd")}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Recognition over recall — tapping a familiar staple beats typing
            it from scratch every time. Same pattern already used in
            AddIngredientModal (fridge side): dim the ones already in the
            pantry, tap-to-add instantly for the rest, modal stays open so
            several can be added in one pass. */}
        <Text
          style={{
            color: colors.textSecondary,
            fontWeight: "500",
            fontSize: 12,
            marginTop: 16,
            marginBottom: 10,
          }}
        >
          {t("pantry.commonStaplesHint")}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {PANTRY_STAPLES.map((item) => {
            const alreadyAdded = pantryItems.some(
              (p) => p.name?.trim().toLowerCase() === item.name.toLowerCase()
            );
            return (
              <PillTag
                key={item.id}
                emoji={item.emoji || "🛒"}
                label={item.name}
                onPress={
                  alreadyAdded ? undefined : () => addPantryItem(item.name)
                }
                style={alreadyAdded ? { opacity: 0.45 } : null}
              />
            );
          })}
        </View>
      </StandardSmoothModal>
    </>
  );
}
