import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useSharedValue } from "react-native-reanimated";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Sparkles,
  Plus,
  RefreshCw,
  Trash2,
  BookOpen,
  Star,
  Camera,
  Refrigerator,
  Lock,
  Crown,
} from "../icons";
import { useCookAI } from "../context/CookAIContext";
import { useModalState } from "../context/ModalContext";
import { useTheme } from "../context/ThemeContext";
import { getDishEmojiAndColor } from "../utils/imageUtils";
import StandardSmoothModal from "./StandardSmoothModal";
import SwipeToDeleteRow from "./SwipeToDeleteRow";
import { EXIT_DURATION_MS } from "../utils/bottomSheet";
import { animateLayout } from "../utils/layoutMotion";
import { formatTimeLabel, cookTimeLabel } from "../utils/timeFormat";
import { log } from "../utils/log";

const PLANNER_STORAGE_KEY = "cookai:weeklyPlan:v1";

// This modal's own native Modal (via StandardSmoothModal) stays mounted for
// EXIT_DURATION_MS after `visible` flips false so its own exit animation can
// play — opening a SECOND native Modal (RecipeDetailModal, the Camera)
// before that finishes is the classic iOS multi-Modal collision that has
// frozen the app elsewhere this session. A bare requestAnimationFrame
// (~16ms) is nowhere near long enough; this is the same proven-safe delay
// used for every other Modal-to-Modal handoff in this codebase.
const HANDOFF_MS = EXIT_DURATION_MS + 40;

const DAYS_OF_WEEK = [
  { id: "mon", nameKey: "dayShort.mon", fullNameKey: "dayFull.mon" },
  { id: "tue", nameKey: "dayShort.tue", fullNameKey: "dayFull.tue" },
  { id: "wed", nameKey: "dayShort.wed", fullNameKey: "dayFull.wed" },
  { id: "thu", nameKey: "dayShort.thu", fullNameKey: "dayFull.thu" },
  { id: "fri", nameKey: "dayShort.fri", fullNameKey: "dayFull.fri" },
  { id: "sat", nameKey: "dayShort.sat", fullNameKey: "dayFull.sat" },
  { id: "sun", nameKey: "dayShort.sun", fullNameKey: "dayFull.sun" },
];

const EMPTY_PLAN = {
  mon: null,
  tue: null,
  wed: null,
  thu: null,
  fri: null,
  sat: null,
  sun: null,
};

/** Minimal recipe object compatible with RecipeDetailModal. */
function toRecipe(meal, dayId, t) {
  if (meal.recipe) return meal.recipe;
  return {
    id: `planned-${dayId}-${meal.title}`,
    title: meal.title,
    isAiGenerated: true,
    categoryLabel: t("mealPlanner.plannedMealLabel"),
    prepTime: meal.prepTime || "—",
    cookTime: meal.cookTime || meal.time || "—",
    totalTime: meal.time,
    calories: meal.calories || "—",
    ingredientsList: meal.ingredients || [],
    steps: meal.steps || [],
  };
}

// A week of dinners should not repeat itself: two tortilla dishes, or the same
// salad with one ingredient fewer. Picks cards from the pool in order but skips
// one whose dish type is already planned or whose title is mostly the same
// words as one already picked; if the pool is too small for that, the rules are
// relaxed (dish type first, then title similarity) so every day still gets a meal.
const TITLE_STOPWORDS = new Set(["with", "and", "from", "bowl", "z", "i", "ze", "und", "mit", "con", "avec"]);
function titleWords(title) {
  return new Set(
    String(title || "")
      .toLowerCase()
      .split(/[^\p{L}]+/u)
      .filter((w) => w.length > 2 && !TITLE_STOPWORDS.has(w))
  );
}
function titleSimilarity(a, b) {
  if (!a.size || !b.size) return 0;
  let common = 0;
  a.forEach((w) => {
    if (b.has(w)) common += 1;
  });
  return common / Math.min(a.size, b.size);
}
function pickVariedCards(pool, count, taken) {
  const picked = [];
  const usedIdx = new Set();
  const seen = taken.map((m) => ({ words: titleWords(m.title), type: m.dishType || null }));
  for (let n = 0; n < count; n += 1) {
    let choice = -1;
    for (const relax of [0, 1, 2]) {
      for (let i = 0; i < pool.length; i += 1) {
        if (usedIdx.has(i)) continue;
        const card = pool[i];
        const type = card?.recipe?.dishType;
        const words = titleWords(card?.title);
        const typeClash = relax < 1 && type && type !== "other" && seen.some((x) => x.type === type);
        const similar = relax < 2 && seen.some((x) => titleSimilarity(words, x.words) >= 0.6);
        if (!typeClash && !similar) {
          choice = i;
          break;
        }
      }
      if (choice >= 0) break;
    }
    if (choice < 0) {
      // pool exhausted: start reusing from the top
      choice = n % Math.max(pool.length, 1);
    } else {
      usedIdx.add(choice);
    }
    const card = pool[choice];
    picked.push(card);
    seen.push({ words: titleWords(card?.title), type: card?.recipe?.dishType || null });
  }
  return picked;
}

function mealFromInventoryCard(card, minUnit) {
  if (!card) return null;
  const { emoji } = getDishEmojiAndColor(card.title, card.recipe?.dishType);
  return {
    title: card.title,
    emoji,
    dishType: card.recipe?.dishType || null,
    time: formatTimeLabel(card.time || card.cookTime, minUnit, `20 ${minUnit}`),
    prepTime: card.prepTime,
    cookTime: card.cookTime,
    calories: card.calories,
    protein: card.protein,
    carbs: card.carbs,
    fat: card.fat,
    ingredients: card.ingredients || [],
    steps: card.steps || [],
    recipe: card.recipe,
  };
}

// Only title/ingredient-names/step-text actually change between languages —
// ensureRecipeLanguage's translate prompt explicitly preserves quantities,
// times, and macros, so those fields are left as they were rather than
// rebuilding the whole meal from scratch (which would also require
// re-deriving `time` the way toPlannerCard does, duplicating logic this
// file doesn't otherwise need).
function applyTranslatedRecipeToMeal(meal, translated) {
  if (!translated) return meal;
  return {
    ...meal,
    title: translated.title,
    emoji: getDishEmojiAndColor(translated.title, translated.dishType).emoji,
    ingredients: Array.isArray(translated.ingredientsList)
      ? translated.ingredientsList
      : meal.ingredients,
    steps: Array.isArray(translated.steps) ? translated.steps : meal.steps,
    recipe: translated,
  };
}

export default function MealPlannerModal() {
  const {
    scannedIngredients,
    pantryItems,
    savedRecipes,
    setActiveTab,
    setCameraOpen,
    getPlannerMealsFromInventory,
    showToast,
    isPro,
    hasScanned,
    registerRecipeGenerationAttempt,
    dailyRecipeGenerationCount,
    freeDailyRecipeGenerations,
    recipeLanguageId,
    ensureRecipeLanguage,
    t,
  } = useCookAI();
  const minUnit = t("cookingTime.minUnit");
  const { mealPlannerOpen, setMealPlannerOpen, setSelectedRecipe, setProModalOpen } =
    useModalState();
  const { colors, isDark } = useTheme();

  const [weeklyPlan, setWeeklyPlan] = useState(EMPTY_PLAN);
  const [expandedDay, setExpandedDay] = useState(null);
  // Which day's card currently has its swipe-to-delete action revealed —
  // same "only one open at a time" pattern as PantryTab's openSwipeId.
  const [openSwipeDayId, setOpenSwipeDayId] = useState(null);
  const [customName, setCustomName] = useState("");
  const [isGeneratingWeek, setIsGeneratingWeek] = useState(false);
  // Which single day is mid AI-generate/swap — drives inline spinners now
  // that these are real network calls instead of instant local picks.
  const [loadingDayId, setLoadingDayId] = useState(null);
  // Gates the persist effect so we never overwrite a saved plan with the
  // empty default before the AsyncStorage read has resolved.
  const [planHydrated, setPlanHydrated] = useState(false);
  const handoffTimerRef = useRef(null);
  const mealPoolRef = useRef([]);
  const isMountedRef = useRef(true);

  // Hydrate the saved weekly plan once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PLANNER_STORAGE_KEY);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            setWeeklyPlan({ ...EMPTY_PLAN, ...parsed });
          }
        }
      } catch (err) {
        log.warn("[Cook AI] Weekly plan hydrate failed:", err?.message);
      } finally {
        if (!cancelled) setPlanHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist on every change, once hydrated.
  useEffect(() => {
    if (!planHydrated) return;
    AsyncStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(weeklyPlan)).catch(
      (err) => log.warn("[Cook AI] Weekly plan persist failed:", err?.message)
    );
  }, [planHydrated, weeklyPlan]);

  // Confirmed real gap: CookAIContext already re-translates the Saved list
  // and the current Recipe Feed batch the moment the language changes (see
  // its recipeLangTrackerRef effect), but this modal's weeklyPlan is its
  // own local state, persisted separately — a day assigned while Polish was
  // active stayed in Polish forever, even after switching to English,
  // because nothing here ever re-ran ensureRecipeLanguage against it.
  // RecipeDetailModal's own per-open translate doesn't fix this either: it
  // only patches its local `displayRecipe`, never writes back into
  // weeklyPlan, so the collapsed day row stayed stale even after opening
  // and closing the detail view. Same tracker-ref pattern as CookAIContext:
  // skip the very first render (that's hydration, not a language change),
  // then walk every day whose embedded recipe is stale and update it in
  // place, one at a time.
  const plannerLangTrackerRef = useRef(null);
  useEffect(() => {
    if (!planHydrated) return;
    if (plannerLangTrackerRef.current === null) {
      plannerLangTrackerRef.current = recipeLanguageId;
      return;
    }
    if (plannerLangTrackerRef.current === recipeLanguageId) return;
    plannerLangTrackerRef.current = recipeLanguageId;

    let cancelled = false;
    (async () => {
      const staleDayIds = Object.keys(weeklyPlan).filter((dayId) => {
        const meal = weeklyPlan[dayId];
        return (
          meal?.recipe?.isAiGenerated &&
          meal.recipe.languageId &&
          meal.recipe.languageId !== recipeLanguageId
        );
      });
      for (const dayId of staleDayIds) {
        if (cancelled) return;
        const meal = weeklyPlan[dayId];
        if (!meal) continue;
        const translated = await ensureRecipeLanguage(meal.recipe);
        if (cancelled) return;
        setWeeklyPlan((prev) => {
          const current = prev[dayId];
          // The day may have been cleared/reassigned while this was in
          // flight — don't resurrect it or overwrite newer content.
          if (!current || current.recipe?.id !== meal.recipe?.id) return prev;
          return { ...prev, [dayId]: applyTranslatedRecipeToMeal(current, translated) };
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately excludes weeklyPlan — read from the closure at switch
    // time, same reasoning as CookAIContext's own language-switch effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeLanguageId, planHydrated, ensureRecipeLanguage]);

  const pantryStaples = useMemo(
    () => (pantryItems || []).filter((p) => p.inStock),
    [pantryItems]
  );
  const fridgeCount = (scannedIngredients || []).length;
  // Only force "Scan Fridge" when both fridge scan AND pantry staples are empty
  const fridgeEmpty = fridgeCount === 0 && pantryStaples.length === 0;

  // Per-day Generate/Swap draws from the SAME daily cap as the Scanner's
  // Generate button (see registerRecipeGenerationAttempt in CookAIContext)
  // — surfaced here too, not just on Scanner, so a free user isn't
  // surprised by the paywall on a tap when they never used a generation
  // in this screen specifically (confirmed real confusion: "I didn't use
  // any in the meal planner" after spending both on Scanner).
  const remainingGenerations = Math.max(
    0,
    freeDailyRecipeGenerations - dailyRecipeGenerationCount
  );

  const plannedCount = useMemo(
    () => Object.values(weeklyPlan).filter(Boolean).length,
    [weeklyPlan]
  );
  // A previously-generated weekly plan is persisted (see the hydrate/persist
  // effects below) and must stay visible even when the CURRENT session has
  // no active fridge scan or pantry staples — e.g. right after an app
  // restart, since scannedIngredients itself isn't persisted. Only fall
  // back to the "scan first" placeholder when there's truly nothing to
  // show: no saved plan AND no current inventory to generate one from.
  // Per-day generate/swap/auto-fill actions still correctly stay disabled
  // via their own fridgeEmpty checks until a fresh scan exists.
  const showEmptyState = fridgeEmpty && plannedCount === 0;
  // Which row is today (the plan is Mon-Sun): getDay() is 0 for Sunday.
  const todayId = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];

  const refreshMealPool = useCallback(async () => {
    try {
      const pool = (await getPlannerMealsFromInventory?.(14)) || [];
      if (isMountedRef.current) mealPoolRef.current = pool;
      return pool;
    } catch (err) {
      log.warn("[Cook AI] Meal pool refresh failed:", err?.message);
      return mealPoolRef.current;
    }
  }, [getPlannerMealsFromInventory]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (handoffTimerRef.current) {
        clearTimeout(handoffTimerRef.current);
        handoffTimerRef.current = null;
      }
    };
  }, []);

  // Rebuild inventory pool when fridge / pantry changes while open. PRO
  // only — this is a real Gemini call (14 meals) fired automatically on
  // every open/inventory change, not something a free user ever taps or
  // is told about, so it must not be a free, uncapped side door around the
  // generation limit. Free users still get a pool lazily, one gated call
  // at a time, inside nextInventoryMeal()'s own fetch-if-empty path.
  useEffect(() => {
    if (!mealPlannerOpen || !isPro) return;
    if (fridgeEmpty) {
      mealPoolRef.current = [];
      return;
    }
    void refreshMealPool();
  }, [mealPlannerOpen, isPro, fridgeEmpty, scannedIngredients, pantryStaples, refreshMealPool]);

  // True while the weekly list is scrolled to the very top: then a pull down
  // anywhere on the sheet moves the whole sheet (see StandardModal.scrollTopSignal).
  const listAtTop = useSharedValue(true);
  useEffect(() => {
    if (mealPlannerOpen) listAtTop.value = true;
  }, [mealPlannerOpen, listAtTop]);

  const handleClose = useCallback(() => {
    if (handoffTimerRef.current) {
      clearTimeout(handoffTimerRef.current);
      handoffTimerRef.current = null;
    }
    setIsGeneratingWeek(false);
    setLoadingDayId(null);
    setExpandedDay(null);
    setCustomName("");
    // Clean exit: setter clears activeModalId for this slot
    setMealPlannerOpen(false);
  }, [setMealPlannerOpen]);

  const handleScanFridge = useCallback(() => {
    handleClose();
    handoffTimerRef.current = setTimeout(() => {
      handoffTimerRef.current = null;
      setActiveTab("scanner");
      setCameraOpen?.(true);
    }, HANDOFF_MS);
  }, [handleClose, setActiveTab, setCameraOpen]);

  // Every "show the PRO paywall from inside Meal Planner" tap MUST go
  // through this same close-first-then-open handoff, never a bare
  // setProModalOpen(true) — that would mount a second native Modal while
  // this one (a real Modal, via StandardSmoothModal) is still open, which
  // is the exact "iOS multi-Modal collision" this codebase already had to
  // solve once for the Scan Fridge handoff above. Confirmed directly: a
  // free user hitting the daily generation cap on a per-day Generate/Swap
  // tap — which called setProModalOpen(true) without closing this sheet
  // first — froze the entire app on-device (invisible to web testing,
  // since RN Web's Modal has no equivalent native presentation collision).
  const handleOpenProFromPlanner = useCallback(() => {
    handleClose();
    handoffTimerRef.current = setTimeout(() => {
      handoffTimerRef.current = null;
      setProModalOpen(true);
    }, HANDOFF_MS);
  }, [handleClose, setProModalOpen]);

  const setDay = (dayId, meal) => {
    setWeeklyPlan((prev) => ({ ...prev, [dayId]: meal }));
    setExpandedDay(null);
    setCustomName("");
  };

  const nextInventoryMeal = useCallback(
    async (excludeTitle) => {
      let pool = mealPoolRef.current;
      if (!pool.length) pool = await refreshMealPool();
      if (!pool.length) return null;
      const filtered = excludeTitle
        ? pool.filter((m) => m.title !== excludeTitle)
        : pool;
      const source = filtered.length ? filtered : pool;
      const card = source[Math.floor(Math.random() * source.length)];
      return mealFromInventoryCard(card, minUnit);
    },
    [refreshMealPool, minUnit]
  );

  const handleAutoFillWeek = async (regenerate = false) => {
    if (isGeneratingWeek || fridgeEmpty) return;
    setIsGeneratingWeek(true);
    setExpandedDay(null);
    // Deliberately do NOT clear weeklyPlan here — the old plan stays fully
    // visible (with the button showing a spinner) for the whole fetch, and
    // gets replaced atomically in one state update the instant the new
    // data arrives. Clearing upfront was what caused the empty-then-refill
    // flash.
    try {
      const pool = await refreshMealPool();
      if (!pool.length) {
        showToast?.(t("mealPlanner.scanFirstToast"), "error");
        return;
      }
      animateLayout();
      setWeeklyPlan((prev) => {
        const base = regenerate ? EMPTY_PLAN : prev;
        const next = { ...base };
        const emptyDays = DAYS_OF_WEEK.filter((day) => !next[day.id]);
        const alreadyPlanned = DAYS_OF_WEEK.map((day) => next[day.id]).filter(Boolean);
        const varied = pickVariedCards(pool, emptyDays.length, alreadyPlanned);
        emptyDays.forEach((day, i) => {
          next[day.id] = mealFromInventoryCard(varied[i], minUnit);
        });
        return next;
      });
      showToast?.(
        regenerate ? t("mealPlanner.freshWeekToast") : t("mealPlanner.weekPlannedToast"),
        "success"
      );
    } catch (err) {
      log.warn("[Cook AI] Auto-fill week failed:", err?.message);
      showToast?.(t("mealPlanner.planWeekFailed"), "error");
    } finally {
      if (isMountedRef.current) setIsGeneratingWeek(false);
    }
  };

  const handleGenerateForDay = async (dayId) => {
    if (fridgeEmpty || loadingDayId) return;
    // Same real Gemini call the Scanner's "Generate Recipes" button makes —
    // must draw from the same daily cap, or the paywall's "2 free
    // generations/day" claim is false (this was a real, unmetered bypass).
    if (!registerRecipeGenerationAttempt()) {
      handleOpenProFromPlanner();
      return;
    }
    setLoadingDayId(dayId);
    try {
      const meal = await nextInventoryMeal();
      if (!meal) {
        showToast?.(t("mealPlanner.noMealsAvailable"), "error");
        return;
      }
      setDay(dayId, meal);
    } catch (err) {
      log.warn("[Cook AI] Generate day meal failed:", err?.message);
      showToast?.(t("mealPlanner.generateMealFailed"), "error");
    } finally {
      if (isMountedRef.current) setLoadingDayId(null);
    }
  };

  const handleSwapMeal = async (dayId) => {
    if (fridgeEmpty || loadingDayId) return;
    if (!registerRecipeGenerationAttempt()) {
      handleOpenProFromPlanner();
      return;
    }
    const current = weeklyPlan[dayId];
    setLoadingDayId(dayId);
    try {
      const meal = await nextInventoryMeal(current?.title);
      if (!meal) return;
      setDay(dayId, meal);
      showToast?.(t("mealPlanner.mealSwappedToast"), "info");
    } catch (err) {
      log.warn("[Cook AI] Swap meal failed:", err?.message);
      showToast?.(t("mealPlanner.swapMealFailed"), "error");
    } finally {
      if (isMountedRef.current) setLoadingDayId(null);
    }
  };

  const handleClearDay = (dayId) => {
    setWeeklyPlan((prev) => ({ ...prev, [dayId]: null }));
    setExpandedDay(null);
  };

  const handleAssignSavedRecipe = (dayId, recipe) => {
    setDay(dayId, {
      title: recipe.title,
      emoji: getDishEmojiAndColor(recipe.title, recipe.dishType).emoji,
      // cookTimeLabel, not a raw totalTime||cookTime pick: a saved curated
      // recipe carries a "—" totalTime placeholder, which is truthy and
      // formatted to the "20 min" fallback here — inventing a time when
      // prep+cook were both known and summable.
      time: cookTimeLabel(recipe, minUnit),
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      calories: recipe.calories,
      ingredients: Array.isArray(recipe.ingredientsList)
        ? recipe.ingredientsList
        : Array.isArray(recipe.ingredients)
          ? recipe.ingredients.map((i) => i?.name).filter(Boolean)
          : [],
      steps: Array.isArray(recipe.steps) ? recipe.steps : [],
      recipe,
    });
  };

  const handleAddCustomMeal = (dayId) => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    setDay(dayId, {
      title: trimmed,
      emoji: getDishEmojiAndColor(trimmed).emoji,
      time: `— ${minUnit}`,
      ingredients: [],
      isCustom: true,
    });
  };

  const handleViewRecipe = (dayId, meal) => {
    const recipe = toRecipe(meal, dayId, t);
    handleClose();
    handoffTimerRef.current = setTimeout(() => {
      handoffTimerRef.current = null;
      setSelectedRecipe(recipe);
    }, HANDOFF_MS);
  };

  const renderFridgeEmpty = () => (
    <View
      style={[
        styles.emptyFridgeCard,
        {
          backgroundColor: colors.inputBg,
          borderColor: colors.cardBorder,
        },
      ]}
    >
      <View
        style={[
          styles.emptyFridgeIcon,
          { backgroundColor: isDark ? "#064E3B" : "#ECFDF5" },
        ]}
      >
        <Refrigerator size={28} color="#059669" />
      </View>
      <Text style={[styles.emptyFridgeTitle, { color: colors.textPrimary }]}>
        {t("mealPlanner.fridgeEmptyTitle")}
      </Text>
      <Text style={[styles.emptyFridgeBody, { color: colors.textSecondary }]}>
        {t("mealPlanner.fridgeEmptyBody")}
      </Text>
      <TouchableOpacity
        onPress={handleScanFridge}
        activeOpacity={0.88}
        style={styles.scanCta}
        accessibilityRole="button"
        accessibilityLabel={t("a11y.scanFridge")}
      >
        <Camera size={18} color="#FFFFFF" />
        <Text style={styles.scanCtaText}>{t("scanner.title")}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderActionPanel = (day) => {
    const meal = weeklyPlan[day.id];
    const isDayLoading = loadingDayId === day.id;
    const panelStyle = [
      styles.actionPanel,
      {
        backgroundColor: colors.inputBg,
        borderColor: colors.cardBorder,
      },
    ];

    if (meal) {
      return (
        <View style={panelStyle}>
          <TouchableOpacity
            onPress={() => handleViewRecipe(day.id, meal)}
            style={styles.actionRow}
            activeOpacity={0.8}
          >
            <BookOpen size={18} color="#059669" />
            <Text style={[styles.actionText, { color: colors.textPrimary }]}>
              {t("mealPlanner.viewFullRecipe")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleSwapMeal(day.id)}
            style={styles.actionRow}
            activeOpacity={0.8}
            disabled={fridgeEmpty || isDayLoading}
          >
            {isDayLoading ? (
              <ActivityIndicator size="small" color="#D97706" />
            ) : (
              <RefreshCw size={18} color="#D97706" />
            )}
            <Text style={[styles.actionText, { color: colors.textPrimary }]}>
              {isDayLoading ? t("mealPlanner.askingCookSnap") : t("mealPlanner.swapMealWithAI")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleClearDay(day.id)}
            style={[styles.actionRow, styles.actionRowLast]}
            activeOpacity={0.8}
          >
            <Trash2 size={18} color="#E11D48" />
            <Text style={[styles.actionText, { color: "#E11D48" }]}>
              {t("mealPlanner.clearDay")}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={panelStyle}>
        <TouchableOpacity
          onPress={() => handleGenerateForDay(day.id)}
          style={styles.actionRow}
          activeOpacity={0.8}
          disabled={fridgeEmpty || isDayLoading}
        >
          {isDayLoading ? (
            <ActivityIndicator size="small" color="#059669" />
          ) : (
            <Sparkles size={18} color="#059669" />
          )}
          <Text style={[styles.actionText, { color: colors.textPrimary }]}>
            {isDayLoading
              ? t("mealPlanner.askingCookSnap")
              : t("mealPlanner.generateAiMealFor", { day: t(day.fullNameKey) })}
          </Text>
        </TouchableOpacity>

        {savedRecipes?.length > 0 && (
          <View style={styles.savedSection}>
            <View style={styles.savedLabelRow}>
              <Star size={14} color="#D97706" />
              <Text style={[styles.savedLabel, { color: colors.textSecondary }]}>
                {t("mealPlanner.chooseFromSaved")}
              </Text>
            </View>
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 8, paddingRight: 8 }}
            >
              {savedRecipes.slice(0, 10).map((recipe) => (
                <TouchableOpacity
                  key={recipe.id}
                  onPress={() => handleAssignSavedRecipe(day.id, recipe)}
                  style={[
                    styles.savedChip,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.cardBorder,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 16 }}>
                    {getDishEmojiAndColor(recipe.title, recipe.dishType).emoji}
                  </Text>
                  <Text
                    style={[styles.savedChipText, { color: colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {recipe.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={[styles.customRow, styles.actionRowLast]}>
          <TextInput
            value={customName}
            onChangeText={setCustomName}
            placeholder={t("mealPlanner.customMealPlaceholder")}
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.customInput,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                color: colors.textPrimary,
              },
            ]}
            returnKeyType="done"
            onSubmitEditing={() => handleAddCustomMeal(day.id)}
          />
          <TouchableOpacity
            onPress={() => handleAddCustomMeal(day.id)}
            disabled={!customName.trim()}
            style={[
              styles.customAddBtn,
              { opacity: customName.trim() ? 1 : 0.4 },
            ]}
            activeOpacity={0.85}
          >
            <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <StandardSmoothModal
      visible={!!mealPlannerOpen}
      onClose={handleClose}
      scrollTopSignal={listAtTop}
      maxHeight="90%"
      // Default drag-to-dismiss zone (110px) reached past the grab handle +
      // header row into the Auto-Fill Week banner right below it — its
      // higher z-index silently absorbed taps on the banner's top half
      // before they could reach its own TouchableOpacity. Same fix
      // RecipeDetailModal already applies for the same reason.
      dragZoneHeight={80}
      title={t("menu.mealPlanner")}
      subtitle={
        showEmptyState
          ? t("mealPlanner.subtitleEmpty")
          : fridgeEmpty
            ? t("mealPlanner.subtitleScanMore", { count: plannedCount })
            : fridgeCount > 0
              ? t(
                  fridgeCount === 1
                    ? "mealPlanner.subtitleFridgeOne"
                    : "mealPlanner.subtitleFridgeOther",
                  { count: plannedCount, items: fridgeCount }
                )
              : t(
                  pantryStaples.length === 1
                    ? "mealPlanner.subtitlePantryOne"
                    : "mealPlanner.subtitlePantryOther",
                  { count: plannedCount, items: pantryStaples.length }
                )
      }
      type="bottom-sheet"
      scroll={false}
    >
      {showEmptyState ? (
        renderFridgeEmpty()
      ) : (
        <>
          <TouchableOpacity
            onPress={() => {
              if (!hasScanned) return;
              if (!isPro) {
                handleOpenProFromPlanner();
                return;
              }
              handleAutoFillWeek(plannedCount === 7);
            }}
            disabled={isGeneratingWeek || !hasScanned}
            activeOpacity={0.88}
            style={[
              styles.autoFillBanner,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
              },
              !hasScanned ? { opacity: 0.55 } : null,
            ]}
          >
            <View
              style={[
                styles.autoFillIconBox,
                {
                  backgroundColor:
                    !hasScanned || !isPro
                      ? isDark
                        ? colors.inputBg
                        : "#F3F5F8"
                      : isDark
                        ? "#064E3B"
                        : "#ECFDF5",
                },
              ]}
            >
              {isGeneratingWeek ? (
                <ActivityIndicator size="small" color="#059669" />
              ) : !hasScanned || !isPro ? (
                <Sparkles size={17} color={colors.textSecondary} />
              ) : plannedCount === 7 ? (
                <RefreshCw size={17} color="#059669" />
              ) : (
                <Sparkles size={17} color="#059669" />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.autoFillTitle, { color: colors.textPrimary }]}>
                {isGeneratingWeek
                  ? t("mealPlanner.creatingPlan")
                  : plannedCount === 7
                    ? t("mealPlanner.regenerateWeek")
                    : t("mealPlanner.autoFillWeek")}
              </Text>
              <Text
                style={[styles.autoFillSubtitle, { color: colors.textSecondary }]}
                numberOfLines={2}
              >
                {!hasScanned
                  ? t("mealPlanner.scanFirstSubtitle")
                  : plannedCount === 7
                    ? t("mealPlanner.clearAndBuildSubtitle")
                    : t("mealPlanner.mealsBuiltFromInventorySubtitle")}
              </Text>
            </View>
            {hasScanned && !isPro ? (
              // The same small amber "lock PRO" tag as the locked Custom Diet row
              // on Profile; the one place this screen says PRO, instead of a
              // locked chip on every meal.
              <View style={styles.proTag}>
                <Lock size={11} color={isDark ? "#FCD34D" : "#B45309"} strokeWidth={2.6} />
                <Text style={[styles.proTagText, { color: isDark ? "#FCD34D" : "#B45309" }]}>
                  PRO
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>

          {!isPro ? (
            <View style={styles.generationUsageRow}>
              {isPro ? (
                <Crown size={12} color="#D97706" />
              ) : (
                <Sparkles size={12} color="#059669" />
              )}
              <Text
                style={[
                  styles.generationUsageText,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                  isPro ? { color: "#D97706" } : null,
                ]}
              >
                {isPro
                  ? t("scanner.unlimitedGenerations")
                  : remainingGenerations > 0
                    ? t("scanner.generationsLeftToday", {
                        count: remainingGenerations,
                        total: freeDailyRecipeGenerations,
                      })
                    : t("scanner.generationsUsedUpToday")}
              </Text>
            </View>
          ) : null}

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            onScroll={(e) => {
              listAtTop.value = e.nativeEvent.contentOffset.y <= 0;
            }}
            onScrollBeginDrag={() => setOpenSwipeDayId(null)}
            contentContainerStyle={{ paddingVertical: 8, paddingBottom: 24 }}
          >
            {DAYS_OF_WEEK.map((day) => {
              const meal = weeklyPlan[day.id];
              const isExpanded = expandedDay === day.id;

              return (
                <View key={day.id} style={{ marginBottom: 8 }}>
                  <View style={styles.dayRowContainer}>
                    {/* Today is the one filled badge (language-neutral, no extra
                        word needed); other days are plain text, so the column
                        stops looking like a stack of grey buttons. */}
                    <View
                      style={[
                        styles.dayBadge,
                        day.id === todayId && { backgroundColor: "#10B981", borderColor: "#10B981" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayBadgeText,
                          { color: day.id === todayId ? "#FFFFFF" : colors.textSecondary },
                        ]}
                      >
                        {t(day.nameKey)}
                      </Text>
                    </View>

                    {meal ? (
                      // Confirmed real failure, not a hypothetical: the old
                      // tiny × button (16px icon in a 36px hit box, crammed
                      // against the card's edge) was an easy mis-tap target
                      // sitting right next to the much larger "expand day"
                      // touch area. Swipe-to-delete is the same pattern
                      // already used for Pantry rows — reveals a full-height
                      // delete action instead of a tiny corner button.
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <SwipeToDeleteRow
                          isOpen={openSwipeDayId === day.id}
                          onOpenChange={(open) =>
                            setOpenSwipeDayId(open ? day.id : null)
                          }
                          onDelete={() => handleClearDay(day.id)}
                          borderRadius={14}
                        >
                          <TouchableOpacity
                            onPress={() =>
                              setExpandedDay(isExpanded ? null : day.id)
                            }
                            activeOpacity={0.8}
                            style={[
                              styles.assignedMealCard,
                              {
                                backgroundColor: colors.card,
                                borderColor: colors.cardBorder,
                              },
                              isExpanded && styles.cardExpanded,
                            ]}
                          >
                        <View style={styles.mealInfoGroup}>
                          <Text style={{ fontSize: 22, flexShrink: 0 }}>
                            {meal.emoji}
                          </Text>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text
                              style={[
                                styles.mealTitle,
                                { color: colors.textPrimary },
                              ]}
                              numberOfLines={2}
                            >
                              {meal.title}
                            </Text>
                            <View style={styles.metaRow}>
                              <Text
                                style={[
                                  styles.mealTime,
                                  { color: colors.textSecondary },
                                ]}
                              >
                                {/* Re-derived live from the current unit
                                    word, not trusted as-is — meal.time is
                                    baked in once when the day gets assigned,
                                    so a language switch after that point
                                    would otherwise leave it frozen in
                                    whatever language/unit was active then. */}
                                {formatTimeLabel(meal.time, minUnit)}
                              </Text>
                              {meal.calories ? (
                                isPro ? (
                                  <Text
                                    style={[
                                      styles.mealCalories,
                                      { color: colors.textSecondary },
                                    ]}
                                  >
                                    {meal.calories}
                                  </Text>
                                ) : null
                              ) : null}
                            </View>
                            {/* Macro breakdown — PRO only, and only when the
                                AI actually estimated it (formatMacroGrams
                                returns null rather than a fabricated number
                                for recipes that predate this field, e.g.
                                local heuristic fallbacks). No separate lock
                                chip here — the calories chip above already
                                signals the paywall for free users. */}
                            {isPro && (meal.protein || meal.carbs || meal.fat) ? (
                              <Text
                                style={[
                                  styles.mealMacros,
                                  { color: colors.textSecondary },
                                ]}
                                numberOfLines={1}
                              >
                                {[
                                  meal.protein
                                    ? t("mealPlanner.macroProtein", { value: meal.protein })
                                    : null,
                                  meal.carbs
                                    ? t("mealPlanner.macroCarbs", { value: meal.carbs })
                                    : null,
                                  meal.fat
                                    ? t("mealPlanner.macroFat", { value: meal.fat })
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join("  ·  ")}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                          </TouchableOpacity>
                        </SwipeToDeleteRow>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => {
                          setCustomName("");
                          setExpandedDay(isExpanded ? null : day.id);
                        }}
                        activeOpacity={0.7}
                        style={[
                          styles.emptyMealCard,
                          {
                            backgroundColor: "transparent",
                            borderColor: colors.cardBorder,
                          },
                          isExpanded && styles.cardExpanded,
                        ]}
                      >
                        <Text
                          style={[
                            styles.emptyText,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {t("mealPlanner.notPlannedYet")}
                        </Text>
                        <View style={styles.addPill}>
                          <Plus size={14} color="#059669" strokeWidth={2.6} />
                          <Text style={styles.addPillText}>{t("scanner.add")}</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>

                  {isExpanded ? renderActionPanel(day) : null}
                </View>
              );
            })}
          </ScrollView>
        </>
      )}
    </StandardSmoothModal>
  );
}

const styles = StyleSheet.create({
  emptyFridgeCard: {
    marginTop: 4,
    marginBottom: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  emptyFridgeIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    position: "relative",
  },
  emptyFridgeTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 6,
  },
  emptyFridgeBody: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 14,
  },
  scanCta: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: "#059669",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  scanCtaText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  autoFillBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 10,
    marginBottom: 10,
    minHeight: 52,
  },
  autoFillIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F5F8",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  autoFillTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  autoFillSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 2,
  },
  proTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(245,158,11,0.14)",
  },
  proTagText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  generationUsageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  generationUsageText: {
    fontSize: 11,
    fontWeight: "600",
  },
  dayRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dayBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  dayBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  assignedMealCard: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    minHeight: 56,
  },
  mealInfoGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  mealTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  mealTime: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  mealCalories: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  mealMacros: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 3,
  },
  emptyMealCard: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
    minHeight: 52,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
  },
  addPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
    minHeight: 32,
  },
  addPillText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#059669",
  },
  cardExpanded: {
    borderColor: "#10B981",
  },
  actionPanel: {
    marginLeft: 52,
    marginTop: 6,
    marginBottom: 2,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 10,
    overflow: "hidden",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  actionRowLast: {
    borderBottomWidth: 0,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
  },
  savedSection: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  savedLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  savedLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#92400E",
  },
  savedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: 180,
    minHeight: 40,
  },
  savedChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
  },
  customInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
    minHeight: 44,
  },
  customAddBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
