import { useTabScroll } from "../hooks/useTabScroll";
import React, { memo, useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import {
  Check,
  Plus,
  Search,
  X,
  Sparkles,
  ShoppingCart,
  ChevronRight,
  Package,
  PackageOpen,
  Trash2,
} from "../icons";
import { useCookAI, useTranslation } from "../context/CookAIContext";
import { classifyPantryItemWithGemini, prettyPantryName } from "../services/geminiVision";
import { useModalState } from "../context/ModalContext";
import { useTheme } from "../context/ThemeContext";
import { PANTRY_CATEGORIES, PANTRY_STAPLES } from "../data/recipes";
import StandardSmoothModal from "./StandardSmoothModal";
import SwipeToDeleteRow from "./SwipeToDeleteRow";
import PillTag from "./PillTag";
import ShoppingListModal from "./ShoppingListModal";
import PantryScannerHero from "./PantryScannerHero";
import ErrorBoundary from "./ErrorBoundary";
import Header from "./Header";
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

// The two pantry row types are memoized with stable props: before, a toast, a
// search keystroke or toggling ONE item re-rendered every row (80 rows ≈ 80
// full JSX trees per keystroke). Now only the row whose `item` changed renders.
const InStockRow = memo(function InStockRow({ item, isOpen, setOpenSwipeId, onToggle, onRemove }) {
  const { colors, isDark } = useTheme();
  return (
    <SwipeToDeleteRow
      isOpen={isOpen}
      onOpenChange={(open) => setOpenSwipeId(open ? item.id : null)}
      onDelete={() => onRemove(item)}
      borderRadius={16}
    >
      <View
        style={{
          backgroundColor: isDark ? colors.card : "#FFFFFF",
          borderRadius: 16,
          borderWidth: 1,
          borderColor: isDark ? colors.cardBorder : "#F1F5F9",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 7,
          paddingHorizontal: 14,
        }}
      >
        <TouchableOpacity
          onPress={() => onToggle(item.id)}
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
              width: 42,
              height: 42,
              borderRadius: 12,
              backgroundColor: isDark ? colors.inputBg : "#F8FAFC",
              borderWidth: 1,
              borderColor: isDark ? colors.cardBorder : "#F1F5F9",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Text style={{ fontSize: 22, lineHeight: 26 }} allowFontScaling={false}>
              {item.emoji}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0, justifyContent: "center" }}>
            <Text
              style={{
                fontWeight: "700",
                color: colors.textPrimary,
                fontSize: 15,
                lineHeight: 19,
                letterSpacing: -0.2,
              }}
              numberOfLines={2}
            >
              {prettyPantryName(item.name)}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onToggle(item.id)}
          activeOpacity={0.85}
          style={{
            width: 28,
            height: 28,
            borderRadius: 9,
            backgroundColor: "#10B981",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Check size={15} color="#FFFFFF" strokeWidth={3} />
        </TouchableOpacity>
      </View>
    </SwipeToDeleteRow>
  );
});

const OutOfStockRow = memo(function OutOfStockRow({ item, isOpen, setOpenSwipeId, onToggle, onRemove }) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  return (
    <SwipeToDeleteRow
      isOpen={isOpen}
      onOpenChange={(open) => setOpenSwipeId(open ? item.id : null)}
      onDelete={() => onRemove(item)}
      borderRadius={16}
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
          onPress={() => onToggle(item.id)}
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
              width: 42,
              height: 42,
              borderRadius: 12,
              backgroundColor: isDark ? colors.inputBg : "#F8FAFC",
              borderWidth: 1,
              borderColor: isDark ? colors.cardBorder : "#F1F5F9",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              opacity: 0.7,
            }}
          >
            <Text style={{ fontSize: 22, lineHeight: 26 }} allowFontScaling={false}>
              {item.emoji}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0, justifyContent: "center" }}>
            <Text
              style={{
                fontWeight: "700",
                color: colors.textSecondary,
                fontSize: 15,
                lineHeight: 19,
                letterSpacing: -0.2,
                textDecorationLine: "line-through",
              }}
              numberOfLines={2}
            >
              {prettyPantryName(item.name)}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onToggle(item.id)}
          activeOpacity={0.85}
          style={{
            backgroundColor: isDark ? "#064E3B" : "#ECFDF5",
            paddingHorizontal: 12,
            paddingVertical: 9,
            borderRadius: 12,
            flexDirection: "row",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <Plus size={14} color={isDark ? "#34D399" : "#047857"} strokeWidth={2.6} />
          <Text
            style={{
              color: isDark ? "#34D399" : "#047857",
              fontSize: 12,
              fontWeight: "700",
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
  );
});

export default function PantryTab() {
  const tabScroll = useTabScroll("pantry");
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    pantryItems,
    togglePantryItem,
    addPantryItem,
    removePantryItem,
    clearPantry,
    showToast,
    setActiveTab,
    registerRecipeGenerationAttempt,
    generateRecipes,
    ingredients,
    t,
  } = useCookAI();
  const { setLocalSheetOpen, setProModalOpen } = useModalState();

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  // LOCAL visibility only — never write activeModalId on open. Routing these
  // through CookAIContext re-rendered every App-level modal in the same frame
  // the native Modal presents, which locked the JS thread.
  const [showAddModal, setShowAddModal] = useState(false);
  const [showShoppingModal, setShowShoppingModal] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  // Which pantry row (if any) currently has its swipe-to-delete action
  // revealed. Only one row stays open at a time, like iOS Mail.
  const [openSwipeId, setOpenSwipeId] = useState(null);
  const [isClassifying, setIsClassifying] = useState(false);

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

  // Confirmed real feedback: the "Generuj przepisy" button used to only
  // switch to the Scanner tab, leaving the user to tap "Generate" a
  // second time once they got there — the button's own label promised an
  // action it didn't actually perform. Same gating as ScannerScreen's own
  // generate button (free-tier check first, paywall on denial), then
  // switches tabs to show the freshly generated recipes — one tap now
  // actually does what it says.
  const handleGenerateFromPantry = useCallback(() => {
    if (!registerRecipeGenerationAttempt?.()) {
      setProModalOpen(true);
      return;
    }
    generateRecipes?.();
    setActiveTab("scanner");
  }, [registerRecipeGenerationAttempt, generateRecipes, setActiveTab, setProModalOpen]);

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
    [removePantryItem, showToast, t]
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

  // One tiny AI call picks the category and emoji for what was typed (in any
  // language). Never blocks for long and falls back to the local guess, so
  // adding always works — see classifyPantryItemWithGemini.
  const handleAddCustomItem = async () => {
    const trimmed = newItemName.trim();
    if (!trimmed || isClassifying) return;
    setIsClassifying(true);
    try {
      const item = await classifyPantryItemWithGemini(trimmed);
      if (!item) return;
      addPantryItem(item);
      setNewItemName("");
      setShowAddModal(false);
      showToast?.(t("pantry.addedItem", { name: item.name }), "success");
    } finally {
      setIsClassifying(false);
    }
  };

  // Suggestions in the user's language, skipping what is already in the
  // pantry (checked against the localized AND the English name, so items added
  // before this was localized are still recognised). As items are added the
  // next ones in the catalog move up, so the list adapts instead of showing the
  // same dimmed chips forever.
  const stapleSuggestions = useMemo(() => {
    const have = new Set(
      (pantryItems || []).map((p) => String(p.name || "").trim().toLowerCase())
    );
    return PANTRY_STAPLES.map((item) => ({ ...item, label: t(`pantryStaple.${item.id}`) }))
      .filter(
        (item) =>
          !have.has(item.label.toLowerCase()) && !have.has(item.name.toLowerCase())
      )
      .slice(0, 10);
  }, [pantryItems, t]);

  const handleAddStaple = (item) => {
    addPantryItem({
      id: `pantry-staple-${item.id}-${Date.now()}`,
      name: item.label,
      emoji: item.emoji,
      icon: item.emoji,
      category: item.category,
      role: "Essential pantry staple for recipes",
      inStock: true,
    });
  };

  // Something to cook with: an in-stock pantry item or a scanned fridge item.
  const canGenerate =
    (pantryItems || []).some((item) => item.inStock) ||
    (Array.isArray(ingredients) && ingredients.length > 0);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={tabScroll.setRef}
        onScroll={tabScroll.onScroll}
        onContentSizeChange={tabScroll.onContentSizeChange}
        style={{ flex: 1, backgroundColor: colors.bg }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 156,
        }}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={tabScroll.scrollEventThrottle}
        onScrollBeginDrag={() => {
          tabScroll.onScrollBeginDrag();
          setOpenSwipeId(null);
        }}
      >
        <Header />

        {/* Content wrapper — consistent 16px gap after Header (golden middle) */}
        <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
          {/* Header — margin rhythm matches SavedScreen's "Saved Recipes"
            header exactly (title row marginBottom 8, subtitle marginBottom
            24 doubling as the gap before the next block). */}
        <View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  // Bold (700), not ExtraBold — matches the same change on
                  // Profile/Saved/Settings' titles, for a more visible "i" dot.
                  fontWeight: "700",
                  fontSize: 28,
                  letterSpacing: -0.5,
                }}
              >
                {t("pantry.title")}
              </Text>
            </View>
          </View>
        </View>

        {/* Scan hero — owns the camera trigger, gallery pick, and the
            photo/laser-sweep/step-progress choreography, matching Fridge's
            scanner experience (see PantryScannerHero.jsx). It does NOT also
            render a detected-items list itself: that's the In Stock / Out
            of Stock sections below, already fed by the same scan result. */}
        <PantryScannerHero />

        {/* Search */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <View style={{ flex: 1, position: "relative", justifyContent: "center" }}>
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
              // Room for the clear (x) only while there is text; otherwise the
              // placeholder gets the space (German "Vorratskammer durchsuchen").
              paddingRight: searchQuery.length > 0 ? 40 : 12,
              paddingVertical: 0,
              height: 42,
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
          <TouchableOpacity
            onPress={handleOpenAddModal}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.addPantryStaple")}
            style={{
              height: 42,
              paddingHorizontal: 14,
              borderRadius: 16,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.cardBorder,
            }}
          >
            <Plus size={16} color="#059669" strokeWidth={2.6} />
            <Text
              numberOfLines={1}
              style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600", marginLeft: 5 }}
            >
              {t("scanner.add")}
            </Text>
          </TouchableOpacity>
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
            accessibilityRole="button"
            style={{
              backgroundColor: colors.card,
              marginTop: 2,
              marginBottom: 18,
              borderRadius: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              paddingVertical: 13,
              paddingHorizontal: 14,
            }}
          >
            <ShoppingCart size={18} color="#059669" />
            <Text style={{ flex: 1 }} numberOfLines={1}>
              <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 14 }}>
                {t("pantry.shoppingListTitle")}
              </Text>
              <Text style={{ color: colors.textSecondary, fontWeight: "500", fontSize: 13 }}>
                {"  ·  "}
                {t(
                  shoppingListItems.length === 1
                    ? "pantry.itemsNeededOne"
                    : "pantry.itemsNeededOther",
                  { count: shoppingListItems.length }
                )}
              </Text>
            </Text>
            <ChevronRight size={18} color={colors.textSecondary} />
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
                fontWeight: "700",
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
            <View style={{ gap: 8 }}>
              {inStockItems.map((item) => (
                <InStockRow
                  key={item.id}
                  item={item}
                  isOpen={openSwipeId === item.id}
                  setOpenSwipeId={setOpenSwipeId}
                  onToggle={togglePantryItem}
                  onRemove={handleRemoveItem}
                />
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
                fontWeight: "700",
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
            <View style={{ gap: 8 }}>
              {outOfStockItems.map((item) => (
                <OutOfStockRow
                  key={item.id}
                  item={item}
                  isOpen={openSwipeId === item.id}
                  setOpenSwipeId={setOpenSwipeId}
                  onToggle={togglePantryItem}
                  onRemove={handleRemoveItem}
                />
              ))}
            </View>
          )}

          {/* Destructive reset lives here, at the very end of the list: far from
              the title and the scan controls where a stray tap could reach it,
              visually quiet, and still behind a confirm dialog. */}
          {pantryItems.length > 0 && (
            <TouchableOpacity
              onPress={handleClearPantry}
              activeOpacity={0.7}
              accessibilityRole="button"
              style={{
                marginTop: 28,
                paddingVertical: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Trash2 size={14} color={isDark ? "#F87171" : "#DC2626"} />
              <Text style={{ color: isDark ? "#F87171" : "#DC2626", fontSize: 13, fontWeight: "600" }}>
                {t("pantry.clearAllButton")}
              </Text>
            </TouchableOpacity>
          )}

        </View>
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
        scrollProps={{
          keyboardShouldPersistTaps: "handled",
          contentContainerStyle: { paddingBottom: 8 },
        }}
      >
        {/* Name field and button share one row so the sheet stays short enough
            to sit above the keyboard without scrolling (the field used to be
            pushed under the title). Same emerald as every primary action. */}
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <TextInput
            placeholder={t("pantry.ingredientNamePlaceholder")}
            placeholderTextColor={colors.textSecondary}
            value={newItemName}
            onChangeText={setNewItemName}
            autoFocus={showAddModal}
            returnKeyType="done"
            onSubmitEditing={handleAddCustomItem}
            style={{
              flex: 1,
              minWidth: 0,
              height: 48,
              backgroundColor: colors.inputBg,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 0,
              fontSize: 15,
              fontWeight: "600",
              color: colors.textPrimary,
            }}
          />
          <TouchableOpacity
            onPress={handleAddCustomItem}
            disabled={!newItemName.trim() || isClassifying}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={{
              height: 48,
              paddingHorizontal: 16,
              flexShrink: 0,
              borderRadius: 14,
              backgroundColor: "#059669",
              alignItems: "center",
              justifyContent: "center",
              opacity: newItemName.trim() ? 1 : 0.45,
            }}
          >
            {isClassifying ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
                {t("scanner.add")}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Recognition over recall — tap a familiar staple instead of typing it.
            The sheet stays open so several can be added in one pass. */}
        {stapleSuggestions.length > 0 ? (
          <>
            <Text
              style={{
                color: colors.textSecondary,
                fontWeight: "500",
                fontSize: 12,
                marginTop: 18,
                marginBottom: 10,
              }}
            >
              {t("pantry.commonStaplesHint")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {stapleSuggestions.map((item) => (
                <PillTag
                  key={item.id}
                  emoji={item.emoji}
                  label={item.label}
                  onPress={() => handleAddStaple(item)}
                />
              ))}
            </View>
          </>
        ) : null}
      </StandardSmoothModal>

      {/* One primary action per tab: the same floating green button as the
          Scanner's Generate, replacing the old "Ready to cook?" card that
          took ~75 px of list space and competed with Scan Pantry. */}
      {canGenerate ? (
        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: Math.max(insets.bottom, 8) + 56 + 10,
          }}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            onPress={handleGenerateFromPantry}
            activeOpacity={0.9}
            accessibilityRole="button"
            style={{
              width: "100%",
              backgroundColor: "#059669",
              paddingVertical: 17,
              borderRadius: 18,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Sparkles size={16} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 17, letterSpacing: -0.3 }} numberOfLines={1}>
              {t("pantry.generateCtaBtn")}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
