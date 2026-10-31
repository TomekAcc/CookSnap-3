import React, { createContext, useContext, useState, useMemo, useCallback, useRef } from "react";
import { analyzeFridgeImage, analyzePantryImage } from "../services/geminiVision";
import { persistPhotoToDevice } from "../utils/photoStorage";
import { useModalState } from "./ModalContext";
import { EXIT_DURATION_MS } from "../utils/bottomSheet";
import { SAMPLE_FRIDGE_ITEMS } from "../constants/sampleFridge";
import { showToast } from "../utils/toast";
import { STORAGE_KEYS } from "../storage/keys";
import { arrayCodec, jsonCodec } from "../storage/codecs";
import { usePersistedState } from "../hooks/usePersistedState";
import { mergeUniqueIngredients } from "../utils/ingredients";
import { log } from "../utils/log";
import { useNavigation } from "./NavigationContext";
import { useLanguage } from "./LanguageContext";
import { useEntitlements } from "./EntitlementsContext";
import { useInventory } from "./InventoryContext";
import { useRecipes } from "./RecipesContext";

const ScanContext = createContext(null);

/**
 * The scan flows: fridge scan (photo -> analysis -> reveal -> ingredients, plus history) and the
 * pantry scan, including the onboarding sample scan. Sits below every other domain because a
 * scan sets ingredients, clears recipes, spends a free-tier scan and may open the paywall.
 */
export function ScanProvider({ children }) {
  const { setProModalOpen, setProReason } = useModalState();
  const { setActiveTab } = useNavigation();
  const { t, tLatestRef, recipeLanguageName } = useLanguage();
  const { registerFridgeScanAttempt, registerPantryScanAttempt } = useEntitlements();
  const { setIngredients, mergePantryScanResults, markScanDemo, scanIsDemoRef } = useInventory();
  const { clearRecipes } = useRecipes();
  const [isScanning, setIsScanning] = useState(false);
  // Confirmed real failure, reported directly by a user: right as a scan
  // finished, the Generate Recipes button (and the recipe feed / meal
  // preferences below it) would already be showing on ScannerScreen while
  // FridgeScannerHero's own card was still visually mid-reveal — laser
  // overlay fading, progress bar holding at 100%, ingredient pills not
  // faded in yet. Root cause: isScanning flips false the INSTANT the real
  // Vision result is committed (see endScanChoreography below), but
  // FridgeScannerHero deliberately keeps its own displayed scanStage pinned
  // at "scanning" for a few hundred ms longer after that — a hold so the
  // progress bar visibly reaches 100% and the shrink/reveal motion has time
  // to play, instead of snapping straight to the finished state.
  // ScannerScreen's gating was never told about that hold — it only ever
  // watched raw isScanning — so for that whole window, two screens
  // disagreed about whether the scan was "done".
  //
  // First fix attempt kept the hold flag local to FridgeScannerHero and
  // mirrored it out to a second context state via a render-phase update
  // (the same trick used below for computing the hold itself). That still
  // left a one-render flicker: ScannerScreen is FridgeScannerHero's PARENT
  // and renders first in any commit, so by the time a CHILD's render-phase
  // update corrects an ancestor's/context's state, the parent has already
  // rendered once in this same pass using the stale value — React's
  // "immediate retry, no visible gap" guarantee covers a component
  // correcting its OWN state (or a not-yet-rendered ancestor's), not
  // patching a parent's already-produced output. Confirmed live: the
  // Generate Recipes button and bottom nav flickered back into view for a
  // single frame before disappearing again, roughly 1 run in 3.
  //
  // Fixed by computing the hold itself here — the one place both
  // FridgeScannerHero and ScannerScreen read it from, in the same render
  // pass, with no relay between two separately-updated states at all.
  const [scanRevealActive, setScanRevealActive] = useState(false);
  // null until an append-mode ("Scan More") scan sets an explicit label —
  // the render side falls back to the translated default/step text so
  // this never needs a value baked in before `t` exists.
  const [scanningLabel, setScanningLabel] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  // Stores a permanent Paths.document URI (see persistPhotoToDevice), so a
  // restored URI still resolves to a real file after an app restart. Persisting
  // the photo along with the ingredients it produced (above) matters: a photo
  // next to an empty list is a more confusing state than neither.
  const [fridgePhoto, setFridgePhoto] = usePersistedState(STORAGE_KEYS.fridgePhoto, {
    initial: null,
    codec: jsonCodec(),
    shouldPersist: () => !scanIsDemoRef.current,
  });
  // See the comment on scanRevealActive above: this is the single place
  // that decides "the real scan just finished, hold the completed state
  // for a beat before anything outside the scan card treats it as done."
  // A render-phase conditional update (not a useEffect) so the correction
  // always lands in the SAME commit that flipped isScanning false — no
  // consumer of scanRevealActive, however deep, can ever observe a stale
  // "not holding" value for even one frame.
  //
  // Confirmed real failure, reported directly by a user: opening the app
  // fresh (with a fridge photo already scanned in a PAST session) dropped
  // straight into what looked like an active scan — BottomNav hidden,
  // ScannerScreen's preferences/recipes/CTA all suppressed — with no way
  // to navigate anywhere. Root cause: fridgePhoto starts null and only
  // hydrates from AsyncStorage inside a useEffect, well after first
  // mount — so on a cold start with an existing scan, rawScanStageForHold
  // goes "idle" (first render, before hydration) -> "completed" (once
  // hydration lands), with NO "scanning" render ever in between. That
  // idle->completed jump looked identical, to this code, as a real scan
  // finishing, so it fired setScanRevealActive(true) on every single cold
  // start for any returning user — permanently (the 480ms timer that's
  // supposed to release it never even starts, since nothing in
  // FridgeScannerHero is actually running a scan to trigger its release).
  // A genuine live scan ALWAYS passes through "scanning" before reaching
  // "completed"; hydrating pre-existing data never does. sawScanningRef
  // requires having actually observed "scanning" at least once this
  // session before "completed" is allowed to trigger the hold — the same
  // idle-hydration-vs-real-completion distinction FridgeScannerHero's own
  // mountedAlreadyCompleteRef already made locally before this logic moved
  // here, which got dropped in the move and needed restoring.
  const rawScanStageForHold = !fridgePhoto ? "idle" : isScanning ? "scanning" : "completed";
  const sawScanningForHoldRef = useRef(rawScanStageForHold === "scanning");
  const prevRawScanStageForHoldRef = useRef(rawScanStageForHold);
  if (prevRawScanStageForHoldRef.current !== rawScanStageForHold) {
    prevRawScanStageForHoldRef.current = rawScanStageForHold;
    if (rawScanStageForHold === "scanning") {
      sawScanningForHoldRef.current = true;
    }
    if (
      rawScanStageForHold === "completed" &&
      !scanRevealActive &&
      sawScanningForHoldRef.current
    ) {
      setScanRevealActive(true);
    }
  }
  /** Next capture appends to existing ingredients (Scan More) instead of replacing. */
  const scanAppendModeRef = useRef(false);

  // Pantry's counterparts to isScanning/cameraOpen/fridgePhoto above — see
  // the pantryScanSessionIdRef comment further down for why these live
  // here instead of as PantryScannerHero component state.
  const [isPantryScanning, setIsPantryScanning] = useState(false);
  const [pantryCameraOpen, setPantryCameraOpen] = useState(false);
  const [pantryPhoto, setPantryPhoto] = useState(null);

  const [scanHistory, setScanHistory] = usePersistedState(STORAGE_KEYS.scanHistory, {
    initial: [],
    codec: arrayCodec,
  });
  const scanSessionIdRef = useRef(0);
  const pendingDetectedRef = useRef(null);
  const ingredientsCommittedRef = useRef(false);
  const scanAwaitTimerRef = useRef(null);
  const scanMetaRef = useRef({ photoUri: null, source: "camera" });
  // Pantry's own copy of the fridge scan refs directly above — same
  // fire-and-forget-then-poll pattern, kept in context (not component-local
  // state) for the same reason: confirmed real complaint, a user leaves the
  // Pantry tab mid- or right-after a scan and the scanned photo/result
  // vanishes on return, even though the items were actually detected and
  // merged. Component-local state gets wiped the instant PantryTab
  // unmounts (this app switches tabs via a plain conditional render, not a
  // persistent navigator); these refs and the pantryPhoto/isPantryScanning
  // state below live on the provider instead, so an in-flight or just-
  // finished scan survives navigating away and back exactly like fridge.
  const pantryScanSessionIdRef = useRef(0);
  const pantryPendingDetectedRef = useRef(null);
  const pantryIngredientsCommittedRef = useRef(false);
  const pantryScanAwaitTimerRef = useRef(null);
  const [scanStartedAt, setScanStartedAt] = useState(null);

  const hasScanned = !!fridgePhoto;
  const hasPantryScanned = !!pantryPhoto;

  const pushScanHistory = useCallback((photoUri, source, itemCount, snapshotIngredients) => {
    setScanHistory((prev) => [
      {
        id: `${Date.now()}`,
        photoUri,
        source,
        itemCount,
        // Full ingredient snapshot at scan time — lets restoreScan bring
        // back exactly what this scan detected, not just a photo + count.
        ingredients: Array.isArray(snapshotIngredients) ? snapshotIngredients : [],
        date: new Date().toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      },
      ...prev,
    ].slice(0, 10));
  }, [setScanHistory]);

  /**
   * Bring back a past scan from history — restores its photo + the
   * ingredients detected at that time as the active scan. Older history
   * entries saved before ingredient snapshots existed fall back to just
   * restoring the photo (their `ingredients` array is empty).
   */
  const restoreScan = useCallback(
    (scanId) => {
      const entry = scanHistory.find((s) => s.id === scanId);
      if (!entry) return;
      markScanDemo(false);
      setFridgePhoto(entry.photoUri);
      if (entry.ingredients?.length) setIngredients(entry.ingredients);
      clearRecipes();
      scanMetaRef.current = { photoUri: entry.photoUri, source: entry.source || "camera" };
      setActiveTab("scanner");
    },
    [scanHistory, markScanDemo, setFridgePhoto, setIngredients, setActiveTab, clearRecipes]
  );

  /** Remove one past scan (and its stored photo) from the history. */
  const deleteScan = useCallback((scanId) => {
    setScanHistory((prev) => (prev || []).filter((s) => s.id !== scanId));
  }, [setScanHistory]);

  /**
   * Instant Vision scan — AI runs immediately; UI choreography (laser/radar)
   * commits ingredients via endScanChoreography when progress hits 100%.
   * Scan More sets append mode → new items merge into existing list.
   */
  const completeScan = useCallback(async (photoUri, source = "camera") => {
    const rawUri = Array.isArray(photoUri) ? photoUri[0] : photoUri;
    if (!rawUri || typeof rawUri !== "string") {
      log.warn("[Cook AI] completeScan called with no photo");
      return;
    }
    // Every real scan funnels through here regardless of entry point (main
    // Take Photo/Gallery on the fridge photo, or the Scan More popover's
    // Take Photo/Gallery) — gating the free daily cap at this single choke
    // point means no current or future entry point can bypass it (an
    // earlier version of Scan More did exactly that), and the allowance is
    // only ever consumed once a real photo exists to scan, never burned on
    // a permission denial or a cancelled camera/picker upstream.
    if (!registerFridgeScanAttempt()) {
      // completeScan() runs right after the camera Modal closes (see
      // handleCapture in FridgeScannerHero) — a bare setProModalOpen(true)
      // here would try to mount a second native Modal while that one is
      // still mid-dismissal, the same proven-on-device iOS multi-Modal
      // freeze already fixed for Meal Planner and Scan More.
      setTimeout(() => {
        setProReason?.("scan");
        setProModalOpen?.(true);
      }, EXIT_DURATION_MS + 40);
      return;
    }
    markScanDemo(false);
    // Copy into permanent app storage immediately — the original camera/
    // gallery URI lives in an OS-managed cache/temp location that isn't
    // guaranteed to survive an app restart. Everything downstream (vision
    // analysis, fridgePhoto display, scan history) uses this permanent URI.
    const uri = persistPhotoToDevice(rawUri);

    // Always Smart Append — never wipe the list on a new photo.
    // Explicit clear only happens via resetScan().
    const append = true;
    scanAppendModeRef.current = false;

    setFridgePhoto(uri);
    // Keep existing ingredients; only clear recipe results for a fresh generate pass
    clearRecipes();

    const sessionId = Date.now();
    scanSessionIdRef.current = sessionId;
    if (scanAwaitTimerRef.current) {
      clearInterval(scanAwaitTimerRef.current);
      scanAwaitTimerRef.current = null;
    }
    pendingDetectedRef.current = null;
    ingredientsCommittedRef.current = false;
    scanMetaRef.current = {
      photoUri: uri,
      source: source || "camera",
      append,
    };
    setScanStartedAt(sessionId);
    setIsScanning(true);
    setScanningLabel(t("scanner.appendScanningLabel"));

    try {
      let detected;
      try {
        detected = await analyzeFridgeImage(uri, "", recipeLanguageName);
      } catch (firstErr) {
        // Gemini occasionally returns a transient "model overloaded" (503)
        // on every candidate model in the same beat — confirmed live via
        // direct testing. One retry after a short pause clears it almost
        // every time, instead of the scan silently finishing with zero
        // ingredients and no explanation.
        log.warn(
          "Cook AI Vision scan failed, retrying once:",
          firstErr?.message
        );
        await new Promise((resolve) => setTimeout(resolve, 900));
        detected = await analyzeFridgeImage(uri, "", recipeLanguageName);
      }
      if (scanSessionIdRef.current !== sessionId) return;
      if (ingredientsCommittedRef.current) return;
      pendingDetectedRef.current = Array.isArray(detected) ? detected : [];
    } catch (err) {
      if (scanSessionIdRef.current !== sessionId) return;
      if (ingredientsCommittedRef.current) return;
      log.warn("Cook AI Vision scan failed after retry:", err?.message);
      pendingDetectedRef.current = [];
      showToast(t("errors.readPhotoFailed"), "error", 4200);
    }
  }, [t, recipeLanguageName, registerFridgeScanAttempt, setProModalOpen, setProReason, markScanDemo, setFridgePhoto, clearRecipes]);

  /**
   * The onboarding "sample scan". Runs the same choreography as a real scan on
   * a bundled illustration, with a fixed list as the "detection" — no vision
   * call, no daily free scan used, no scan-history entry (photoUri stays null)
   * and nothing saved (see the persistence guards). A real scan afterwards drops
   * the sample items instead of merging into them (endScanChoreography).
   */
  const completeDemoScan = useCallback(
    (photoUri) => {
      if (!photoUri || typeof photoUri !== "string") return;
      markScanDemo(true);
      scanAppendModeRef.current = false;
      setFridgePhoto(photoUri);
      setIngredients([]);
      clearRecipes();

      const sessionId = Date.now();
      scanSessionIdRef.current = sessionId;
      if (scanAwaitTimerRef.current) {
        clearInterval(scanAwaitTimerRef.current);
        scanAwaitTimerRef.current = null;
      }
      pendingDetectedRef.current = null;
      ingredientsCommittedRef.current = false;
      scanMetaRef.current = { photoUri: null, source: "demo", append: false };
      setScanStartedAt(sessionId);
      setIsScanning(true);
      setScanningLabel(null);

      // The "detection" lands after a believable beat; the on-screen scan
      // choreography decides when it is actually committed.
      setTimeout(() => {
        if (scanSessionIdRef.current !== sessionId || ingredientsCommittedRef.current) return;
        pendingDetectedRef.current = SAMPLE_FRIDGE_ITEMS.map((item) => ({
          id: `sample-${item.id}`,
          name: tLatestRef.current(`sampleFridge.${item.id}`),
          icon: item.icon,
          emoji: item.icon,
        }));
      }, 1400);
    },
    [markScanDemo, setFridgePhoto, setIngredients, tLatestRef, clearRecipes]
  );

  /**
   * Called when laser/radar progress hits 100%.
   * Waits for Vision API (pendingDetectedRef) before committing —
   * prevents empty-state flash while the request is still in flight.
   */
  const endScanChoreography = useCallback(() => {
    if (ingredientsCommittedRef.current) {
      setIsScanning(false);
      setScanStartedAt(null);
      return;
    }

    if (pendingDetectedRef.current === null) {
      if (scanAwaitTimerRef.current) return;
      const startedAt = Date.now();
      scanAwaitTimerRef.current = setInterval(() => {
        const timedOut = Date.now() - startedAt > 60000;
        if (pendingDetectedRef.current !== null || timedOut) {
          clearInterval(scanAwaitTimerRef.current);
          scanAwaitTimerRef.current = null;
          if (timedOut && pendingDetectedRef.current === null) {
            pendingDetectedRef.current = [];
          }
          endScanChoreography();
        }
      }, 120);
      return;
    }

    if (scanAwaitTimerRef.current) {
      clearInterval(scanAwaitTimerRef.current);
      scanAwaitTimerRef.current = null;
    }

    const fullList = Array.isArray(pendingDetectedRef.current)
      ? pendingDetectedRef.current
      : [];

    ingredientsCommittedRef.current = true;
    pendingDetectedRef.current = fullList;

    // STRICT Smart Append — never overwrite the NAME of an existing item;
    // case-insensitive dedupe.
    //
    // Confirmed real failure, reported by a first-time tester: delete an
    // item, then immediately rescan, and the deleted item could reappear
    // (sometimes duplicated). Root cause was reading `ingredientsRef.current`
    // here — that ref is kept current by a useEffect (see its declaration
    // above), which only runs AFTER React commits a render, i.e.
    // asynchronously relative to the delete's own setIngredients call. A
    // scan finishing in that same window read the ref before the delete's
    // effect had flushed, so `prevItems` below still contained the
    // just-deleted item and the merge silently resurrected it.
    //
    // Fixed by computing the merge inside setIngredients' own functional
    // updater instead, which React always calls with the true latest state
    // — no stale ref involved. The updater runs synchronously as part of
    // this call (React invokes it immediately, only the resulting re-render
    // is deferred), so `mergedIngredients` is populated by the time
    // setIngredients() returns below, preserving the original need for a
    // synchronous merged list to snapshot into scan history right after.
    const isDemoRun = scanMetaRef.current?.source === "demo";
    const newScannedItems = fullList.map((i) => ({
      ...i,
      source: isDemoRun ? "demo" : "scan",
    }));
    const normalizeName = (n) => String(n || "").toLowerCase().trim();

    let mergedIngredients = [];
    setIngredients((rawPrevItems) => {
      // A real scan replaces leftover sample items rather than merging into them.
      const prevItems = isDemoRun
        ? rawPrevItems
        : rawPrevItems.filter((item) => item?.source !== "demo");
      // A name match against an existing item still gets its ICON refreshed
      // from this fresh detection — a rescan re-photographs the same food,
      // so the new icon is at least as trustworthy as whatever was stored
      // before (and self-heals any item whose icon was assigned back when
      // the icon-matching logic was worse, without the user having to
      // manually delete and rescan it).
      const refreshedPrevItems = prevItems.map((existing) => {
        const match = newScannedItems.find(
          (n) => normalizeName(n?.name) === normalizeName(existing?.name)
        );
        const freshIcon =
          match &&
          ((typeof match.icon === "string" && match.icon.trim()) ||
            (typeof match.emoji === "string" && match.emoji.trim()));
        if (!freshIcon || freshIcon === existing.icon) return existing;
        return { ...existing, icon: freshIcon, emoji: freshIcon };
      });

      const uniqueNew = newScannedItems.filter(
        (newItem) => !prevItems.some((existing) => normalizeName(existing?.name) === normalizeName(newItem?.name))
      );
      // Collapse dupes inside Gemini batch + assign stable ids, then append
      const uniqueNewItems = mergeUniqueIngredients([], uniqueNew);
      mergedIngredients = [...refreshedPrevItems, ...uniqueNewItems];
      return mergedIngredients;
    });

    setIsScanning(false);
    setScanStartedAt(null);

    const { photoUri, source } = scanMetaRef.current || {};
    if (photoUri) {
      const addedCount = fullList.length;
      pushScanHistory(photoUri, source || "camera", addedCount, mergedIngredients);
    }
  }, [pushScanHistory, setIngredients]);

  /** Next completeScan will APPEND (de-duped). */
  const prepareScanMore = useCallback(() => {
    scanAppendModeRef.current = true;
  }, []);

  /** Open camera — next completeScan APPENDs (de-duped). */
  const startScanMore = useCallback(() => {
    scanAppendModeRef.current = true;
    setCameraOpen(true);
  }, []);

  /** Pantry's own version — every pantry scan already merges/appends (see
   * mergePantryScanResults), so there's no separate "append mode" flag to
   * set here, just open the camera. */
  const startPantryScanMore = useCallback(() => {
    setPantryCameraOpen(true);
  }, []);

  const resetScan = useCallback(() => {
    if (scanAwaitTimerRef.current) {
      clearInterval(scanAwaitTimerRef.current);
      scanAwaitTimerRef.current = null;
    }
    scanAppendModeRef.current = false;
    markScanDemo(false);
    setFridgePhoto(null);
    setIngredients([]);
    clearRecipes();
    setIsScanning(false);
    scanSessionIdRef.current = 0;
    pendingDetectedRef.current = null;
    ingredientsCommittedRef.current = false;
    scanMetaRef.current = { photoUri: null, source: "camera" };
    setScanStartedAt(null);
  }, [markScanDemo, setFridgePhoto, setIngredients, clearRecipes]);

  /**
   * Fire-and-forget, mirroring completeScan's fridge counterpart above:
   * kicks off the real Vision analysis immediately and returns, without
   * waiting for it. The result lands in pantryPendingDetectedRef, and
   * endPantryScanChoreography (below) is what actually commits it — called
   * by PantryScannerHero's own local progress-bar timing effect once its
   * choreography finishes, same split as the fridge scan.
   */
  const completePantryScan = useCallback(
    async (photoUri, source = "camera") => {
      if (!photoUri) return;
      // Single choke point, same reasoning as completeScan's fridge-cap
      // check above: every pantry scan entry point funnels through here,
      // so gating right here (rather than in each call site) means none of
      // them can bypass the cap. The allowance is only consumed once a real
      // photo is about to be analyzed, never burned on a permission denial
      // or a cancelled camera/picker upstream.
      if (!registerPantryScanAttempt()) {
        // Same native-Modal-collision avoidance as completeScan: this runs
        // right after the pantry camera Modal closes (see handleCapture in
        // PantryScannerHero), so a bare setProModalOpen(true) here would
        // try to mount a second native Modal while that one is still
        // mid-dismissal.
        setTimeout(() => {
          setProReason?.("pantryScan");
          setProModalOpen?.(true);
        }, EXIT_DURATION_MS + 40);
        return;
      }

      setPantryPhoto(photoUri);
      const sessionId = Date.now();
      pantryScanSessionIdRef.current = sessionId;
      if (pantryScanAwaitTimerRef.current) {
        clearInterval(pantryScanAwaitTimerRef.current);
        pantryScanAwaitTimerRef.current = null;
      }
      pantryPendingDetectedRef.current = null;
      pantryIngredientsCommittedRef.current = false;
      setIsPantryScanning(true);

      try {
        const detected = await analyzePantryImage(photoUri, "", recipeLanguageName);
        if (pantryScanSessionIdRef.current !== sessionId) return;
        if (pantryIngredientsCommittedRef.current) return;
        pantryPendingDetectedRef.current = Array.isArray(detected) ? detected : [];
      } catch (err) {
        if (pantryScanSessionIdRef.current !== sessionId) return;
        if (pantryIngredientsCommittedRef.current) return;
        log.warn("[Cook AI] Pantry scan failed:", err?.message);
        pantryPendingDetectedRef.current = [];
        showToast(t("errors.analyzePantryFailed"), "error");
      }
    },
    [t, recipeLanguageName, registerPantryScanAttempt, setProModalOpen, setProReason]
  );

  /**
   * Called when the pantry progress bar choreography hits 100%. Waits for
   * the Vision API (pantryPendingDetectedRef) before committing — prevents
   * an empty-state flash while the request is still in flight. Being a
   * context function (not component state) means this still runs and
   * still merges the real result even if PantryScannerHero has since
   * unmounted (the user left the Pantry tab mid-scan) — the merge and the
   * "added N staples" toast are not lost, only the visual choreography
   * that led up to them.
   */
  const endPantryScanChoreography = useCallback(() => {
    if (pantryIngredientsCommittedRef.current) {
      setIsPantryScanning(false);
      return;
    }

    if (pantryPendingDetectedRef.current === null) {
      if (pantryScanAwaitTimerRef.current) return;
      const startedAt = Date.now();
      pantryScanAwaitTimerRef.current = setInterval(() => {
        const timedOut = Date.now() - startedAt > 60000;
        if (pantryPendingDetectedRef.current !== null || timedOut) {
          clearInterval(pantryScanAwaitTimerRef.current);
          pantryScanAwaitTimerRef.current = null;
          if (timedOut && pantryPendingDetectedRef.current === null) {
            pantryPendingDetectedRef.current = [];
          }
          endPantryScanChoreography();
        }
      }, 120);
      return;
    }

    if (pantryScanAwaitTimerRef.current) {
      clearInterval(pantryScanAwaitTimerRef.current);
      pantryScanAwaitTimerRef.current = null;
    }

    const fullList = Array.isArray(pantryPendingDetectedRef.current)
      ? pantryPendingDetectedRef.current
      : [];
    pantryIngredientsCommittedRef.current = true;

    const count = mergePantryScanResults(fullList);
    showToast(
      t(
        count === 1 ? "toast.addedPantryStaplesOne" : "toast.addedPantryStaplesOther",
        { count }
      ),
      "success"
    );
    setIsPantryScanning(false);
  }, [mergePantryScanResults, t]);

  /** Dismiss the just-scanned photo/summary and return to the idle Scan
   * Pantry prompt — does NOT touch pantryItems, matching the existing "X"
   * button's contract (it dismisses the scan summary, not the inventory). */
  const resetPantryPhoto = useCallback(() => {
    if (pantryScanAwaitTimerRef.current) {
      clearInterval(pantryScanAwaitTimerRef.current);
      pantryScanAwaitTimerRef.current = null;
    }
    setPantryPhoto(null);
    setIsPantryScanning(false);
    pantryScanSessionIdRef.current = 0;
    pantryPendingDetectedRef.current = null;
    pantryIngredientsCommittedRef.current = false;
  }, []);

  const value = useMemo(
    () => ({
      isScanning,
      scanRevealActive,
      setScanRevealActive,
      scanningLabel,
      scanStartedAt,
      cameraOpen,
      setCameraOpen,
      fridgePhoto,
      hasScanned,
      completeScan,
      completeDemoScan,
      endScanChoreography,
      resetScan,
      prepareScanMore,
      startScanMore,
      scanHistory,
      restoreScan,
      deleteScan,
      isPantryScanning,
      pantryCameraOpen,
      setPantryCameraOpen,
      pantryPhoto,
      hasPantryScanned,
      completePantryScan,
      endPantryScanChoreography,
      startPantryScanMore,
      resetPantryPhoto,
    }),
    [isScanning, scanRevealActive, setScanRevealActive, scanningLabel, scanStartedAt, cameraOpen, setCameraOpen, fridgePhoto, hasScanned, completeScan, completeDemoScan, endScanChoreography, resetScan, prepareScanMore, startScanMore, scanHistory, restoreScan, deleteScan, isPantryScanning, pantryCameraOpen, setPantryCameraOpen, pantryPhoto, hasPantryScanned, completePantryScan, endPantryScanChoreography, startPantryScanMore, resetPantryPhoto]
  );

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
}

export function useScan() {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error("useScan must be used within ScanProvider");
  return ctx;
}
