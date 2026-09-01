import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  TextInput,
  ActivityIndicator,
} from "react-native";
import {
  Clock,
  Flame,
  Sparkles,
  Heart,
  Check,
  Snowflake,
  Lock,
  Crown,
  ShoppingCart,
} from "lucide-react-native";
import { useCookAI } from "../context/CookAIContext";
import { useModalState } from "../context/ModalContext";
import { useTheme } from "../context/ThemeContext";
import {
  getDishEmojiAndColor,
  resolveCategoryBadgeColors,
  getIngredientEmoji,
  getIngredientStyle,
} from "../utils/imageUtils";
import StandardModal from "./StandardModal";
import { EXIT_DURATION_MS } from "../utils/bottomSheet";
import { DS } from "../utils/designSystem";
import { formatTimeLabel, cookTimeLabel } from "../utils/timeFormat";
import { emojiLine } from "../theme/tokens";

/** Hermes-safe emoji strip (no /u flag). */
function stripInlineEmojis(str) {
  return String(str || "")
    .replace(/(?:[\uD800-\uDBFF][\uDC00-\uDFFF])/g, "")
    .replace(/[\u2600-\u27BF]/g, "")
    .replace(/[\uFE0F\u200D]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Gemini's "ingredientsList" strings already end with a real, accurate
 * emoji per line ("120g M\u0105ka \uD83C\uDF3E") \u2014 language-independent since it's
 * chosen from the food itself, not guessed from the (possibly
 * non-English) name text. Pull that out before stripInlineEmojis
 * discards it, so the ingredient row can use the AI's real icon instead
 * of a local English-keyword re-guess that fails once the name isn't
 * English.
 */
function extractTrailingEmoji(str) {
  const match = String(str || "").match(
    /(?:[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF])(?:[\uFE0F\u200D](?:[\uD800-\uDBFF][\uDC00-\uDFFF])?)*\s*$/
  );
  return match ? match[0].trim() : null;
}

function cleanIngredientName(str) {
  if (!str) return "";
  let cleaned = stripInlineEmojis(
    typeof str === "string" ? str : str?.name || ""
  );
  if (!cleaned) return "";
  if (cleaned.toLowerCase().startsWith("slices ")) {
    cleaned = cleaned.replace(/^slices\s+/i, "") + " (slices)";
  }
  return cleaned;
}

// A plain-string ingredient (the normal case — Gemini's ingredientsList
// entries, e.g. "120g Mąka 🌾") already has its quantity baked into the
// name text itself, so this returns null rather than a fake "1 pcs" —
// that badge was previously always English AND always wrong (every
// ingredient showed "1 pcs" regardless of its real amount/unit). A real
// quantity badge is only meaningful for genuinely structured
// {amount, unit} objects (legacy/static fixtures).
function formatQtyFromItem(item) {
  if (!item || typeof item !== "object") return null;
  if (item.quantity) return String(item.quantity);
  if (item.qtyLabel) return String(item.qtyLabel);
  if (item.amount != null) {
    const u = item.unit ? ` ${item.unit}` : "";
    return `${item.amount}${u}`.trim() || null;
  }
  return null;
}

/**
 * Compact no-bloat recipe detail — sticky favorites CTA.
 * Wired to CookAIContext (mounted with no props).
 */
export default function RecipeDetailModal() {
  const {
    servings,
    toggleSaveRecipe,
    isRecipeSaved,
    isPro,
    modifyRecipe,
    ensureRecipeLanguage,
    recipeLanguageId,
    showToast,
    addToShoppingList,
    t,
  } = useCookAI();
  const { selectedRecipe, setSelectedRecipe, setProModalOpen } =
    useModalState();
  const { colors, isDark } = useTheme();

  const [checkedIngredients, setCheckedIngredients] = useState({});
  // Confirmed real failure: tapping "Add to Shopping List" DID add the
  // item (verified against AsyncStorage), but nothing on screen actually
  // said so persistently — the only signal was a toast at the very top of
  // the screen, far from this button, gone again in ~3s. This tracks
  // whether THIS recipe's upgrade tip has been added so the button itself
  // can show a lasting "Added" state instead of relying on the toast alone.
  const [upgradeAdded, setUpgradeAdded] = useState(false);
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [modifierOpen, setModifierOpen] = useState(false);
  const [modifierInstruction, setModifierInstruction] = useState("");
  const [isModifying, setIsModifying] = useState(false);
  const heartScaleAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef(null);
  const modifierYRef = useRef(0);

  // Keep showing the last recipe's data while closing (selectedRecipe goes
  // null immediately, but OverlayHost/useModalPresence keep this component
  // mounted through the exit animation — without this, the sheet would go
  // blank mid-slide-out instead of showing the recipe it's closing).
  const [displayRecipe, setDisplayRecipe] = useState(selectedRecipe);
  useEffect(() => {
    if (selectedRecipe) setDisplayRecipe(selectedRecipe);
  }, [selectedRecipe]);

  // A saved recipe left over from a previous language selection — translate
  // it in place so it never stays stuck in whatever language it was
  // generated in. Silent background swap: the recipe is fully viewable while
  // this is in flight, it just quietly updates once the translation lands.
  useEffect(() => {
    if (!selectedRecipe) return;
    if (!selectedRecipe.languageId || selectedRecipe.languageId === recipeLanguageId) {
      return;
    }
    let cancelled = false;
    ensureRecipeLanguage(selectedRecipe).then((updated) => {
      if (!cancelled && updated) setDisplayRecipe(updated);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedRecipe, recipeLanguageId, ensureRecipeLanguage]);

  const recipe = displayRecipe;
  const visible = !!selectedRecipe;
  const isFavorite = recipe ? !!isRecipeSaved?.(recipe.id) : false;

  useEffect(() => {
    setCheckedIngredients({});
    setActiveStepIdx(0);
    setModifierOpen(false);
    setModifierInstruction("");
    setUpgradeAdded(false);
  }, [recipe?.id]);

  // The input autoFocuses the instant this opens, so the keyboard rises
  // immediately — without this the modifier card can end up mostly hidden
  // under the keyboard inside the sheet's keyboard-shrunk viewport. Two
  // passes (post-commit, then post-keyboard-animation) mirrors the same
  // scroll-after-layout pattern CookAIContext uses for scrollToRecipesTop.
  useEffect(() => {
    if (!modifierOpen) return;
    const scroll = () => {
      scrollRef.current?.scrollTo?.({
        y: Math.max(modifierYRef.current - 12, 0),
        animated: true,
      });
    };
    const raf = requestAnimationFrame(() => {
      setTimeout(scroll, 80);
      setTimeout(scroll, 320);
    });
    return () => cancelAnimationFrame(raf);
  }, [modifierOpen]);

  const handleModifyRecipe = async () => {
    const instruction = modifierInstruction.trim();
    if (!instruction || isModifying || !recipe) return;
    setIsModifying(true);
    try {
      const updated = await modifyRecipe(recipe, instruction);
      setDisplayRecipe(updated);
      setModifierOpen(false);
      setModifierInstruction("");
      showToast?.(t("recipeDetail.recipeUpdated"), "success");
    } catch (err) {
      showToast?.(
        err?.message || t("recipeDetail.modifyFailed"),
        "error"
      );
    } finally {
      setIsModifying(false);
    }
  };

  const onClose = () => setSelectedRecipe?.(null);
  const onToggleFavorite = () => {
    // Heart Pop — identical physics to RecipeCard. No haptics.
    Animated.sequence([
      Animated.timing(heartScaleAnim, {
        toValue: 1.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(heartScaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
    if (recipe) toggleSaveRecipe?.(recipe);
  };
  // Same close-first-then-delay handoff MealPlannerModal uses for this
  // exact reason — a bare setProModalOpen(true) while this sheet's own
  // native Modal is still visible tries to mount a second native Modal
  // mid-transition, which is the proven-on-device iOS multi-Modal freeze
  // this app has already had to fix more than once.
  const onOpenProModal = () => {
    onClose();
    setTimeout(() => setProModalOpen?.(true), EXIT_DURATION_MS + 40);
  };

  const dishStyle = getDishEmojiAndColor(recipe?.title, recipe?.dishType);
  const badgeColors = resolveCategoryBadgeColors(dishStyle, isDark);
  const dishEmoji = dishStyle?.emoji || "🥘";
  const rawIngredients = Array.isArray(recipe?.ingredientsList)
    ? recipe.ingredientsList
    : Array.isArray(recipe?.ingredients)
      ? recipe.ingredients
      : [];
  const steps = Array.isArray(recipe?.steps)
    ? recipe.steps
    : Array.isArray(recipe?.instructions)
      ? recipe.instructions
      : [];

  const toggleIngredientCheck = (idx) => {
    setCheckedIngredients((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const checkedCount = Object.values(checkedIngredients).filter(Boolean).length;

  const handleAddUpgradeIngredient = () => {
    if (!recipe?.upgradeIngredient || upgradeAdded) return;
    addToShoppingList?.([recipe.upgradeIngredient]);
    setUpgradeAdded(true);
    showToast?.(
      t("recipeDetail.upgradeTipAdded", { ingredient: recipe.upgradeIngredient }),
      "success"
    );
  };

  const isNoCook =
    !recipe?.cookTime ||
    recipe.cookTime === "0 min" ||
    recipe.cookTime === "0m" ||
    recipe.cookTime === "0" ||
    recipe.cookTime === 0;

  const minUnit = t("cookingTime.minUnit");
  const timeLabel = cookTimeLabel(recipe, minUnit);

  return (
    <StandardModal
      visible={visible}
      onClose={onClose}
      type="bottom-sheet"
      // Taller than the app-wide 75% bottom-sheet default on purpose —
      // this modal's content (stats grid, ingredients, instructions) is
      // heavier than a typical sheet, so it gets more of the screen to
      // show title/stats/ingredients without needing to scroll right away.
      maxHeight="92%"
      // At 92% tall, the grab handle sits close to the top of the screen —
      // a stretch for a one-handed thumb. Widen the drag-to-dismiss zone
      // well past the shared default so it's reachable without needing to
      // reach all the way up; stops short of the stats grid's own PRO
      // MACROS touchable so that tap target still works normally.
      dragZoneHeight={185}
      contentStyle={{
        backgroundColor: colors.card,
        borderColor: colors.cardBorder,
      }}
    >
      {/* Standard iOS grabber sizing/color (~36x5, translucent gray) —
          same shared style every other sheet in the app uses. An earlier
          version of this bumped it to 52x6 solid textTertiary to fix a
          real tester not realizing this no-close-X modal was draggable,
          but a second tester flagged the bigger/darker bar as looking
          out of place next to every other sheet's handle, not native
          iOS. Reverted to the shared style for consistency; if
          discoverability turns out to still be a problem, that's better
          solved with an explicit hint than by making one sheet's handle
          look different from the rest. */}
      <View
        style={[
          styles.grabHandle,
          { backgroundColor: colors.sheetHandle || colors.cardBorder },
        ]}
      />

      {/* Header — pastel emoji tile matches the same dish category color
          as its RecipeCard thumbnail on the feed, via resolveCategoryBadgeColors.
          No close button — dismiss is grab-handle drag or backdrop tap only. */}
      <View
        style={[styles.headerBar, { borderBottomColor: colors.cardBorder }]}
      >
        <View
          style={[
            styles.dishBadge,
            { backgroundColor: badgeColors.backgroundColor },
          ]}
        >
          <Text style={styles.dishBadgeEmoji} allowFontScaling={false}>
            {dishEmoji}
          </Text>
        </View>

        <View style={styles.headerTitles}>
          <Text
            style={[styles.recipeTitle, { color: colors.textPrimary }]}
            numberOfLines={2}
          >
            {recipe?.title || t("recipeDetail.fallbackTitle")}
          </Text>
          {/* Real icon component instead of an inline "⏱️" glyph — emoji
              metrics vary by platform/font and were clipping at the top
              against this row's tight line height. */}
          <View style={styles.recipeSubtitleRow}>
            <Clock size={12} color={colors.textSecondary} strokeWidth={2.5} />
            <Text
              style={[styles.recipeSubtitle, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {timeLabel}
              {"  ·  "}
              {recipe?.servings ||
                t(
                  servings === 1
                    ? "recipeDetail.servesOne"
                    : "recipeDetail.servesOther",
                  { count: servings }
                )}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollFlex}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Redesigned from 7 separately-bordered boxes (4 stat cards + 3
            macro cards) down to one borderless row of plain columns with
            thin dividers — the box-per-datum treatment was the actual
            source of the "chaotic, not minimalistic" feedback, not the
            spacing between boxes (already tightened once; wasn't enough).
            No background fill, no per-item border — just typography,
            icons, and hairline rules, closer to how a premium recipe app
            (NYT Cooking, Apple Health summary rows) presents a meta strip. */}
        <View
          style={[styles.metaHairline, { backgroundColor: colors.cardBorder }]}
        />
        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaValueEmerald}>
              {formatTimeLabel(recipe?.prepTime, minUnit, `5 ${minUnit}`)}
            </Text>
            <View style={styles.metaLabelRow}>
              <Clock size={11} color="#059669" strokeWidth={2.5} />
              <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                {t("recipeDetail.prepLabel")}
              </Text>
            </View>
          </View>

          <View style={[styles.metaDivider, { backgroundColor: colors.cardBorder }]} />

          <View style={styles.metaCol}>
            <Text style={isNoCook ? styles.metaValueIndigo : styles.metaValueAmber}>
              {isNoCook ? t("recipeDetail.noCook") : formatTimeLabel(recipe?.cookTime, minUnit)}
            </Text>
            <View style={styles.metaLabelRow}>
              {isNoCook ? (
                <Snowflake size={11} color="#4F46E5" strokeWidth={2.5} />
              ) : (
                <Flame size={11} color="#F59E0B" strokeWidth={2.5} />
              )}
              <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                {isNoCook ? t("recipeDetail.coldLabel") : t("recipeDetail.cookLabel")}
              </Text>
            </View>
          </View>

          <View style={[styles.metaDivider, { backgroundColor: colors.cardBorder }]} />

          <TouchableOpacity
            onPress={!isPro ? onOpenProModal : undefined}
            activeOpacity={0.7}
            style={styles.metaCol}
          >
            {!isPro ? (
              <>
                <Text style={styles.metaValuePro}>{t("menu.proBadge")}</Text>
                <View style={styles.metaLabelRow}>
                  <Lock size={10} color="#B45309" strokeWidth={2.5} />
                  <Text style={[styles.metaLabel, { color: "#B45309" }]}>
                    {t("recipeDetail.unlockLabel")}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.metaValueDark, { color: colors.textPrimary }]}>
                  {recipe?.calories || t("recipeDetail.caloriesFallback")}
                </Text>
                <View style={styles.metaLabelRow}>
                  <Sparkles size={11} color="#D97706" strokeWidth={2.5} />
                  <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                    {t("recipeDetail.caloriesLabel")}
                  </Text>
                </View>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Servings deliberately NOT repeated here — the header subtitle
            ("15 min · Serves 2 people") already states it; a "2 PEOPLE"
            column below was pure duplication, and the user caught it
            directly ("the two people is too much... if it's at the top
            already"). Down to 3 columns: Prep, Cook, Calories — each one
            genuinely new information, nothing restated. */}

        {/* Macros — same borderless column treatment, one thin rule above
            to separate from the row above. Only renders when the AI
            actually estimated these fields (never fabricated), and only
            per-macro if present. */}
        {isPro && (recipe?.protein || recipe?.carbs || recipe?.fat) ? (
          <>
            <View
              style={[styles.metaHairline, { backgroundColor: colors.cardBorder }]}
            />
            <View style={styles.metaRow}>
              {recipe?.protein ? (
                <View style={styles.metaCol}>
                  <Text style={[styles.metaValueMacro, { color: "#E11D48" }]}>
                    {recipe.protein}
                  </Text>
                  <Text
                    style={[
                      styles.metaLabel,
                      { color: isDark ? "#FDA4AF" : "#BE123C" },
                    ]}
                  >
                    {t("recipeDetail.proteinLabel")}
                  </Text>
                </View>
              ) : null}
              {recipe?.carbs ? (
                <View style={styles.metaCol}>
                  <Text style={[styles.metaValueMacro, { color: "#D97706" }]}>
                    {recipe.carbs}
                  </Text>
                  <Text
                    style={[
                      styles.metaLabel,
                      { color: isDark ? "#FCD34D" : "#B45309" },
                    ]}
                  >
                    {t("recipeDetail.carbsLabel")}
                  </Text>
                </View>
              ) : null}
              {recipe?.fat ? (
                <View style={styles.metaCol}>
                  <Text style={[styles.metaValueMacro, { color: "#0284C7" }]}>
                    {recipe.fat}
                  </Text>
                  <Text
                    style={[
                      styles.metaLabel,
                      { color: isDark ? "#7DD3FC" : "#0369A1" },
                    ]}
                  >
                    {t("recipeDetail.fatLabel")}
                  </Text>
                </View>
              ) : null}
            </View>
          </>
        ) : null}
        <View
          style={[styles.metaHairline, { backgroundColor: colors.cardBorder }]}
        />

        <View
          style={styles.modifierSection}
          onLayout={(e) => {
            modifierYRef.current = e.nativeEvent.layout.y;
          }}
        >
          {!isPro ? (
            <TouchableOpacity
              onPress={onOpenProModal}
              activeOpacity={0.85}
              style={[
                styles.modifierLockedRow,
                {
                  backgroundColor: isDark ? "rgba(245,158,11,0.14)" : "#FFFBEB",
                  borderColor: isDark ? "rgba(245,158,11,0.35)" : "#FDE68A",
                },
              ]}
            >
              <View style={styles.modifierIconBox}>
                <Crown size={16} color="#F59E0B" fill="#FDE68A" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[
                    styles.modifierLockedTitle,
                    { color: isDark ? "#FCD34D" : "#78350F" },
                  ]}
                >
                  {t("recipeDetail.modifyWithAI")}
                </Text>
                <Text
                  style={[
                    styles.modifierLockedSubtitle,
                    { color: isDark ? "#FBBF24" : "#92400E" },
                  ]}
                  numberOfLines={2}
                >
                  {t("recipeDetail.modifyProDesc")}
                </Text>
              </View>
              <Lock size={16} color="#B45309" />
            </TouchableOpacity>
          ) : modifierOpen ? (
            <View
              style={[
                styles.modifierOpenCard,
                {
                  backgroundColor: isDark ? colors.inputBg : "#FFFBEB",
                  borderColor: "#FBBF24",
                },
              ]}
            >
              <View style={styles.modifierOpenHeader}>
                <Sparkles size={15} color="#D97706" />
                <Text
                  style={[
                    styles.modifierOpenTitle,
                    { color: isDark ? "#FCD34D" : "#92400E" },
                  ]}
                >
                  {t("recipeDetail.modifyWithAI")}
                </Text>
              </View>
              <TextInput
                value={modifierInstruction}
                onChangeText={setModifierInstruction}
                placeholder={t("recipeDetail.modifyPlaceholder")}
                placeholderTextColor={colors.textSecondary}
                editable={!isModifying}
                autoFocus
                style={[
                  styles.modifierInput,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.cardBorder,
                    color: colors.textPrimary,
                  },
                ]}
                returnKeyType="send"
                onSubmitEditing={handleModifyRecipe}
              />
              <View style={styles.modifierBtnRow}>
                <TouchableOpacity
                  onPress={() => {
                    setModifierOpen(false);
                    setModifierInstruction("");
                  }}
                  disabled={isModifying}
                  activeOpacity={0.8}
                  style={[
                    styles.modifierCancelBtn,
                    isDark ? { backgroundColor: "rgba(245,158,11,0.14)" } : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.modifierCancelText,
                      { color: isDark ? "#FCD34D" : "#78350F" },
                    ]}
                  >
                    {t("recipeDetail.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleModifyRecipe}
                  disabled={isModifying || !modifierInstruction.trim()}
                  activeOpacity={0.85}
                  style={[
                    styles.modifierSendBtn,
                    { opacity: isModifying || !modifierInstruction.trim() ? 0.6 : 1 },
                  ]}
                >
                  {isModifying ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modifierSendText}>{t("recipeDetail.apply")}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setModifierOpen(true)}
              activeOpacity={0.85}
              style={[
                styles.modifierRow,
                {
                  backgroundColor: isDark ? colors.inputBg : "#FFFBEB",
                  borderColor: "#FDE68A",
                },
              ]}
            >
              <Sparkles size={16} color={isDark ? "#FBBF24" : "#D97706"} />
              <Text
                style={[
                  styles.modifierRowText,
                  { color: isDark ? "#FBBF24" : "#D97706" },
                ]}
              >
                {t("recipeDetail.modifyWithAI")}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {t("recipeDetail.ingredientsTitle")}
            </Text>
            {/* Starts as the discovery hint so a first-time viewer knows the
                rows are tappable; switches to a live "3 of 6 checked" count
                the moment they check the first one, since at that point the
                progress number is more useful than the instruction that got
                them there. Turns accent green once everything's checked, a
                small "you're done" signal while shopping/prepping. */}
            {checkedCount > 0 ? (
              <Text
                style={[
                  styles.sectionHint,
                  {
                    color:
                      checkedCount === rawIngredients.length
                        ? colors.accentGreen || "#10B981"
                        : colors.textSecondary,
                  },
                ]}
              >
                {t("recipeDetail.ingredientsChecked", {
                  checked: checkedCount,
                  total: rawIngredients.length,
                })}
              </Text>
            ) : (
              <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
                {t("recipeDetail.tapToCheckOff")}
              </Text>
            )}
          </View>

          <View style={styles.listStack}>
            {rawIngredients.map((item, idx) => {
              const isChecked = !!checkedIngredients[idx];
              const rawName = typeof item === "object" ? item?.name : item;
              const cleanedTitle = cleanIngredientName(rawName);
              const itemEmoji =
                extractTrailingEmoji(rawName) ||
                getIngredientStyle(cleanedTitle).emoji ||
                getIngredientEmoji(cleanedTitle) ||
                "🛒";
              const itemQty = formatQtyFromItem(item);

              return (
                <TouchableOpacity
                  key={`ing-${idx}`}
                  onPress={() => toggleIngredientCheck(idx)}
                  activeOpacity={0.8}
                  hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                  style={[
                    styles.ingredientRow,
                    {
                      ...styles.ingredientUnchecked,
                      backgroundColor: isDark ? colors.card : "#FFFFFF",
                      borderColor: isDark ? colors.cardBorder : "#E2E8F0",
                      opacity: isChecked ? 0.55 : 1,
                    },
                  ]}
                >
                  <View style={styles.ingredientLeft}>
                    {/* Bare emoji, no tile behind it. A pastel chip here
                        took the DISH's colour, so every row down the list
                        repeated the identical square — same shape, same
                        fill, no per-ingredient meaning. That's repetition
                        rather than structure, so the ingredient reads
                        better on its own. */}
                    <Text style={styles.ingredientEmoji}>{itemEmoji}</Text>
                    <Text
                      style={[
                        styles.ingredientName,
                        { color: colors.textPrimary },
                        isChecked && styles.ingredientNameChecked,
                      ]}
                      numberOfLines={2}
                    >
                      {cleanedTitle || t("recipeDetail.ingredientFallback")}
                    </Text>
                  </View>

                  <View style={styles.ingredientRight}>
                    {itemQty ? (
                      <Text style={styles.ingredientQty}>{itemQty}</Text>
                    ) : null}
                    <View
                      style={[
                        styles.checkCircle,
                        isChecked
                          ? styles.checkCircleActive
                          : {
                              ...styles.checkCircleInactive,
                              backgroundColor: colors.card,
                              borderColor: colors.cardBorder,
                            },
                      ]}
                    >
                      {isChecked ? (
                        <Check size={14} color="#FFFFFF" strokeWidth={2.5} />
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Optional, rare — only rendered when the model set both
              upgradeIngredient/upgradeNote (see geminiRecipes.js). This
              recipe's own ingredientsList/steps NEVER include anything the
              user doesn't actually have; this is a clearly separate,
              purely informational aside about what a next-level version
              would need, with a one-tap way to add just that one item to
              the Shopping List for next time. */}
          {recipe?.upgradeIngredient ? (
            <View
              style={[
                styles.upgradeTipCard,
                {
                  backgroundColor: isDark ? "rgba(16,185,129,0.10)" : "#ECFDF5",
                  borderColor: isDark ? "rgba(16,185,129,0.28)" : "#D1FAE5",
                },
              ]}
            >
              <View style={styles.upgradeTipHeaderRow}>
                <Sparkles size={16} color={isDark ? "#34D399" : "#059669"} />
                <Text
                  style={[
                    styles.upgradeTipLabel,
                    { color: isDark ? "#34D399" : "#047857" },
                  ]}
                >
                  {t("recipeDetail.upgradeTipLabel", {
                    ingredient: recipe.upgradeIngredient,
                  })}
                </Text>
              </View>
              <Text
                style={[styles.upgradeTipNote, { color: colors.textSecondary }]}
              >
                {recipe.upgradeNote}
              </Text>
              <TouchableOpacity
                onPress={handleAddUpgradeIngredient}
                activeOpacity={0.8}
                disabled={upgradeAdded}
                style={[
                  styles.upgradeTipButton,
                  upgradeAdded
                    ? {
                        backgroundColor: "transparent",
                        borderWidth: 1,
                        borderColor: isDark ? "#065F46" : "#A7F3D0",
                      }
                    : { backgroundColor: isDark ? "#065F46" : "#059669" },
                ]}
              >
                {upgradeAdded ? (
                  <Check size={14} color={isDark ? "#34D399" : "#059669"} strokeWidth={2.5} />
                ) : (
                  <ShoppingCart size={14} color="#FFFFFF" />
                )}
                <Text
                  style={[
                    styles.upgradeTipButtonText,
                    upgradeAdded && { color: isDark ? "#34D399" : "#059669" },
                  ]}
                >
                  {upgradeAdded
                    ? t("recipeDetail.upgradeTipAddedButton")
                    : t("recipeDetail.upgradeTipAdd")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={[styles.sectionContainer, styles.instructionsSection]}>
          <Text
            style={[
              styles.sectionTitle,
              styles.sectionTitleSolo,
              { color: colors.textPrimary },
            ]}
          >
            {t("recipeDetail.instructionsTitle")}
          </Text>
          <View style={styles.listStack}>
            {steps.map((step, idx) => {
              const isActive = activeStepIdx === idx;
              const stepText =
                typeof step === "object"
                  ? step?.text || step?.instruction || ""
                  : String(step || "");

              return (
                <TouchableOpacity
                  key={`step-${idx}`}
                  onPress={() => setActiveStepIdx(idx)}
                  activeOpacity={0.8}
                  style={[
                    styles.stepCard,
                    isActive
                      ? {
                          ...styles.stepCardActive,
                          backgroundColor: isDark ? colors.inputBg : "#F8FAFC",
                          borderColor: isDark ? colors.textSecondary : "#CBD5E1",
                        }
                      : {
                          ...styles.stepCardInactive,
                          backgroundColor: colors.card,
                          borderColor: colors.cardBorder,
                        },
                  ]}
                >
                  <View
                    style={[
                      styles.stepBadge,
                      isActive ? styles.stepBadgeActive : styles.stepBadgeInactive,
                    ]}
                  >
                    <Text style={styles.stepBadgeText}>{idx + 1}</Text>
                  </View>
                  <Text
                    style={[
                      styles.stepText,
                      { color: colors.textPrimary },
                      isActive && styles.stepTextActive,
                    ]}
                  >
                    {stepText}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.stickyFooter,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.cardBorder,
          },
        ]}
      >
        <TouchableOpacity
          onPress={onToggleFavorite}
          activeOpacity={0.8}
          style={[
            styles.favoriteButton,
            isFavorite
              ? styles.favoriteActive
              : [
                  styles.favoriteInactive,
                  {
                    backgroundColor: isDark ? "#064E3B" : "#ECFDF5",
                    borderWidth: 1.5,
                    borderColor: isDark ? "#059669" : "#D1FAE5",
                  },
                ],
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            isFavorite ? t("a11y.removeFromFavorites") : t("a11y.saveToFavorites")
          }
        >
          <Animated.View style={{ transform: [{ scale: heartScaleAnim }] }}>
            <Heart
              size={16}
              color={isFavorite ? "#FFFFFF" : isDark ? "#34D399" : "#059669"}
              fill={isFavorite ? "#FFFFFF" : "transparent"}
            />
          </Animated.View>
          <Text
            style={[
              styles.favoriteButtonText,
              !isFavorite && { color: isDark ? "#34D399" : "#059669" },
            ]}
          >
            {isFavorite
              ? t("recipeDetail.recipeSavedFooter")
              : t("recipeDetail.saveToFavoritesFooter")}
          </Text>
        </TouchableOpacity>
      </View>
    </StandardModal>
  );
}

const styles = StyleSheet.create({
  // Matches the shared handle size every other sheet uses — see the
  // comment above where this is rendered.
  grabHandle: {
    width: 40,
    height: 4.5,
    borderRadius: 3,
    alignSelf: "center",
    marginVertical: 8,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 14,
    marginBottom: 8,
    gap: 12,
  },
  // Exactly matches RecipeCard's emoji tile (72x72, rounded-2xl) so the
  // modal header reads as a seamless continuation of the card you tapped —
  // no border, just the clean pastel fill (a static border read as an
  // extra outer box wrapped around the thumbnail).
  dishBadge: {
    width: 72,
    height: 72,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "visible",
  },
  dishBadgeEmoji: {
    fontSize: 40,
    lineHeight: emojiLine(40),
    textAlign: "center",
  },
  headerTitles: { flex: 1, minWidth: 0 },
  recipeTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 23,
    letterSpacing: -0.3,
  },
  recipeSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
  },
  recipeSubtitle: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 15,
  },
  scrollFlex: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingTop: 18,
    paddingBottom: 32,
  },
  // Borderless meta strip — replaced 7 separately-bordered boxes (4 stat
  // cards + 3 macro cards) with plain columns + hairline dividers. The
  // per-item box chrome was the actual source of "chaotic, not
  // minimalistic" feedback; a prior pass that only tightened spacing
  // between the same boxes didn't resolve it.
  metaHairline: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 10,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaCol: {
    flex: 1,
    alignItems: "center",
  },
  metaDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
  },
  metaLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  metaLabel: {
    color: "#94A3B8",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginLeft: 3,
  },
  metaValueEmerald: { color: "#059669", fontSize: 18, fontWeight: "800" },
  metaValueAmber: { color: "#D97706", fontSize: 18, fontWeight: "800" },
  metaValueIndigo: { color: "#4F46E5", fontSize: 15, fontWeight: "800" },
  metaValueDark: { fontSize: 18, fontWeight: "800" },
  metaValuePro: { color: "#B45309", fontSize: 15, fontWeight: "900" },
  metaValueMacro: { fontSize: 16, fontWeight: "800" },
  modifierSection: { marginTop: 0 },
  modifierLockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  modifierIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(245,158,11,0.16)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  modifierLockedTitle: { fontSize: 13, fontWeight: "800", color: "#78350F" },
  modifierLockedSubtitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#92400E",
    marginTop: 1,
  },
  modifierRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 11,
  },
  modifierRowText: { fontSize: 13, fontWeight: "800", color: "#D97706" },
  modifierOpenCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 12,
  },
  modifierOpenHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  modifierOpenTitle: { fontSize: 13, fontWeight: "800", color: "#92400E" },
  modifierInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: "600",
    minHeight: 44,
  },
  modifierBtnRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  modifierCancelBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(120,53,15,0.08)",
  },
  modifierCancelText: { fontSize: 12, fontWeight: "800", color: "#78350F" },
  modifierSendBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D97706",
  },
  modifierSendText: { fontSize: 12, fontWeight: "800", color: "#FFFFFF" },
  sectionContainer: { marginTop: 10 },
  /** Cooking Area — airy gap after Ingredients */
  instructionsSection: { marginTop: 24 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: DS.spacing.md,
  },
  sectionTitle: {
    ...DS.typography.sectionTitle,
    letterSpacing: -0.2,
  },
  sectionTitleSolo: {
    marginBottom: DS.spacing.md,
  },
  sectionHint: {
    ...DS.typography.hint,
  },
  listStack: { gap: 12 },
  upgradeTipCard: {
    marginTop: 14,
    borderRadius: DS.borderRadius.md,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  upgradeTipHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  upgradeTipLabel: {
    fontSize: 13,
    fontWeight: "800",
    flexShrink: 1,
  },
  upgradeTipNote: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  upgradeTipButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginTop: 2,
  },
  upgradeTipButtonText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "700",
  },
  ingredientRow: {
    borderRadius: DS.borderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
  },
  ingredientUnchecked: {
    backgroundColor: DS.colors.surface,
    borderColor: DS.colors.border,
  },
  ingredientChecked: {
    backgroundColor: "#ECFDF5",
    borderColor: "#D1FAE5",
  },
  ingredientLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 6,
    minWidth: 0,
  },
  ingredientEmoji: { fontSize: 19, lineHeight: emojiLine(19), marginRight: 12 },
  ingredientName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
    flex: 1,
  },
  ingredientNameChecked: {
    color: "#94A3B8",
    textDecorationLine: "line-through",
  },
  ingredientRight: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },
  ingredientQty: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginRight: 8,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  checkCircleInactive: {
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
  },
  checkCircleActive: {
    borderColor: "#10B981",
    backgroundColor: "#10B981",
  },
  stepCard: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    minHeight: 64,
  },
  stepCardInactive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
  },
  stepCardActive: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FBBF24",
    borderWidth: 1.5,
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    marginRight: 12,
    flexShrink: 0,
  },
  stepBadgeInactive: { backgroundColor: "#1E293B" },
  // Previously identical to stepBadgeInactive — the numbered badge never
  // actually changed with the step, so tapping through steps while cooking
  // only moved the card's border/background, not the number you're tracking
  // against. Ties to the same amber already used for stepCardActive so the
  // "this one's selected" language is consistent card-to-badge.
  stepBadgeActive: { backgroundColor: "#D97706" },
  stepBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  stepText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
    lineHeight: 28,
    flex: 1,
    flexShrink: 1,
  },
  // No color override here on purpose — the inline {color: colors.textPrimary}
  // already applied to the base stepText is theme-correct; overriding it with
  // DS.colors.ink (a static near-black) made the active step's text
  // unreadable in dark mode. Bold weight + the amber active background
  // already convey the "selected" state without needing a color change too.
  stepTextActive: {
    fontWeight: "700",
  },
  stickyFooter: {
    borderTopWidth: 1,
    borderTopColor: DS.colors.borderSoft,
    paddingTop: DS.spacing.md,
    paddingBottom: DS.spacing.sm,
    backgroundColor: DS.colors.surface,
  },
  favoriteButton: {
    paddingVertical: 20,
    borderRadius: DS.borderRadius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  // Base only — the actual colors are applied inline above (isDark-aware,
  // matching the app's other secondary-emerald buttons like Pantry's "+
  // Add"). Used to be a flat DS.colors.ink (near-black), a leftover from
  // before the Scanner panel's green redesign that never got updated here.
  favoriteInactive: {},
  // DS.colors.emerald doesn't exist — this previously resolved to
  // backgroundColor: undefined, making the "saved" button state invisible.
  favoriteActive: { backgroundColor: "#059669" },
  favoriteButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginLeft: 8,
  },
});
