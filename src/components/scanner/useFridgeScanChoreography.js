import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Image } from "react-native";
import { SCAN_DONE_HOLD_MS, SCAN_STATUS_AT_MS, TOTAL_SCAN_DURATION } from "../../constants/scanChoreography";
import { sampleFridgeFitHeight } from "../../constants/sampleFridge";
import { useInventory } from "../../context/InventoryContext";
import { useLanguage } from "../../context/LanguageContext";
import { useOnboarding } from "../../context/OnboardingContext";
import { useScan } from "../../context/ScanContext";
import { log } from "../../utils/log";
import { finishProgress, startScanProgress } from "../../utils/scanProgressCreep";
import { expectedScanMs, loadScanTimings, recordScanTiming } from "../../utils/scanTiming";
import { showToast } from "../../utils/toast";

/** Compact header after AI detection completes. */
const COMPACT_HEIGHT = 150;

/**
 * Tall scan card ≈ 55% of screen (capped at 420) so the Live Radar
 * dashboard fits below without empty whitespace.
 */
function getScanHeight() {
  const h = Dimensions.get("window").height;
  // Fill the screen: everything else on it (header, status card, bottom inset)
  // takes about 310pt, so the photo gets the rest instead of leaving a blank band.
  return Math.round(Math.max(300, Math.min(h - 310, 560)));
}

/**
 * Height the photo needs at the card's width to show whole (its own shape),
 * or null when the size can't be read quickly. Never rejects.
 */
function measureFitHeight(uri) {
  const contentWidth = Dimensions.get("window").width - 40;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 500);
    try {
      Image.getSize(
        uri,
        (w, h) => {
          clearTimeout(timer);
          resolve(w && h ? Math.max(240, Math.round((contentWidth * h) / w)) : null);
        },
        () => {
          clearTimeout(timer);
          resolve(null);
        }
      );
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

function resolveScanStage(hasScanned, isScanning) {
  if (!hasScanned) return "idle";
  if (isScanning) return "scanning";
  return "completed";
}

/**
 * Instant Scan + Vision Radar choreography for the fridge scanner.
 * Capture → laser/radar while AI runs → shrink → ingredients.
 *
 * Owns the derived `scanStage` ("idle" | "scanning" | "completed"), every Animated value the
 * scanner cards read, and `beginInstantScan` (measure the photo, then start the scan).
 */
export default function useFridgeScanChoreography() {
  const { ingredients, scanIsDemo, scanIsDemoRef } = useInventory();
  const {
    isScanning,
    scanRevealActive,
    setScanRevealActive,
    fridgePhoto,
    hasScanned,
    completeScan,
    endScanChoreography,
  } = useScan();
  const { t } = useLanguage();
  const { firstScanHintShown } = useOnboarding();

  // Confirmed real failure, reported directly by a user: the progress bar
  // "didn't go to 100%" and just closed/continued without it being visible
  // that it reached the full line. Root cause: scanStage used to be this
  // raw derived value directly, so the instant isScanning flipped false
  // (real completion), scanStage flipped straight to "completed" in the
  // SAME render — which unmounts the entire progress-bar block below
  // (everything gated on scanStage === "scanning") before the fill-to-100%
  // animation, or even the final "100%" text, ever gets a frame on screen.
  // scanRevealActive keeps the displayed scanStage pinned at "scanning" for
  // one deliberate beat after real completion, so the fill + hold effect
  // further down actually has a mounted bar to animate.
  //
  // scanRevealActive itself (and the render-phase correction that computes
  // it with no one-render gap) now lives in ScanContext, not here — see
  // its own long comment there for why: this used to be local state
  // (holdingAtComplete) mirrored out to context for ScannerScreen's
  // benefit, but mirroring between two separately-updated states always
  // left a one-render gap somewhere (first inside this component, then,
  // once that was fixed, one level up between this component and its
  // ScannerScreen parent). Reading the SAME context value both components
  // already share removes the relay — and the gap — entirely.
  const rawScanStage = resolveScanStage(hasScanned, isScanning);
  const completionHandledRef = useRef(false);
  const scanStage = scanRevealActive ? "scanning" : rawScanStage;
  // Confirmed real failure, found while verifying the identical fix on
  // PantryScannerHero: leaving this tab AFTER a scan finished, then coming
  // back, remounts this component fresh — completionHandledRef resets, so
  // the effect below saw an already-"completed" rawScanStage and (wrongly)
  // replayed the whole fill+hold+reveal choreography as if it had just
  // finished: the completed photo/pills briefly vanished, the card
  // re-grew, and the laser overlay's scanning veil flashed back over the
  // photo, before settling back to "completed" a moment later. Captured
  // once (useRef's initializer only runs on first render) so the effect
  // can tell "the scan finished during THIS mount, play the reveal" apart
  // from "we mounted straight into an already-finished scan, just show it".
  const mountedAlreadyCompleteRef = useRef(rawScanStage === "completed");
  const scanHeight = useMemo(() => getScanHeight(), []);

  // Show the photo in its own shape (a 3:4 camera photo whole, a wide gallery
  // image shorter) instead of always cropping it into one fixed frame: the
  // height the photo needs at the card's width, never above the screen cap.
  // Purely visual — the AI always receives the full original photo.
  // Starting straight into the onboarding sample: its size is known up front, so
  // the frame opens at its final height instead of resizing after the load.
  const [photoFitHeight, setPhotoFitHeight] = useState(() =>
    scanIsDemo ? sampleFridgeFitHeight(Dimensions.get("window").width - 40) : null
  );
  useEffect(() => {
    if (!fridgePhoto) {
      setPhotoFitHeight(null);
      return undefined;
    }
    let cancelled = false;
    measureFitHeight(fridgePhoto).then((fit) => {
      if (!cancelled && fit) setPhotoFitHeight(fit);
    });
    return () => {
      cancelled = true;
    };
  }, [fridgePhoto]);
  const scanDisplayHeight = photoFitHeight
    ? Math.min(scanHeight, photoFitHeight)
    : scanHeight;
  const scanDisplayHeightRef = useRef(scanDisplayHeight);
  scanDisplayHeightRef.current = scanDisplayHeight;
  // Once the photo's shape is known, settle the scanning frame onto it.
  useEffect(() => {
    if (scanStage !== "scanning") return;
    Animated.timing(photoHeightAnim, {
      toValue: scanDisplayHeightRef.current,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoFitHeight]);
  const hasFood = Array.isArray(ingredients) && ingredients.length > 0;
  const foodCount = hasFood ? ingredients.length : 0;
  // Read by the reveal animation without making its effect re-run on every edit.
  const ingredientCountRef = useRef(0);
  ingredientCountRef.current = foodCount;

  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  const photoHeightAnim = useRef(new Animated.Value(COMPACT_HEIGHT)).current;
  const ingredientsOpacity = useRef(new Animated.Value(0)).current;
  // 0 -> 1 once per fresh scan: drives the detected chips appearing one after
  // another. Starts at 1 so a restored or returning-to-the-tab list just shows.
  const chipReveal = useRef(new Animated.Value(1)).current;
  // Brief brightening of the photo at the moment the scan completes.
  const completionFlash = useRef(new Animated.Value(0)).current;
  const ingredientsTranslate = useRef(new Animated.Value(18)).current;
  const radarOpacity = useRef(new Animated.Value(0)).current;
  const radarTranslate = useRef(new Animated.Value(16)).current;
  const stepOpacity = useRef(new Animated.Value(1)).current;
  const stepTranslate = useRef(new Animated.Value(0)).current;
  const progressBarAnim = useRef(new Animated.Value(0)).current;
  // Icon "breathing" pulse (scale) — purely cosmetic, looped only while
  // scanStage === "scanning" via the same effect that already drives
  // badgePulse below, so they start/stop together with no separate
  // lifecycle to manage. (The progress-bar shimmer that used to live here
  // alongside it was removed per direct feedback — see the JSX below.)
  const iconPulse = useRef(new Animated.Value(1)).current;
  // First-launch highlight on the "Take Photo" button — see its own
  // comment at the JSX below for why this exists.
  const firstScanHintPulse = useRef(new Animated.Value(0)).current;
  const progressAnimRef = useRef(null);
  // Where the bar is right now (see startScanProgress); read when the real result lands.
  const progressEstimateRef = useRef(null);
  const progressSpeedRef = useRef(null);
  const scanStartedAtRef = useRef(0);
  useEffect(() => {
    loadScanTimings();
  }, []);
  const shrinkStartedRef = useRef(false);

  // Confirmed real feedback: a first-time user landing on this idle screen
  // right after onboarding didn't register that this is where you scan —
  // even though the card already has a clear title/subtitle/button. Rather
  // than add another onboarding screen to tap through (more friction, easy
  // to swipe past on autopilot), this puts a one-time soft pulsing glow
  // directly on the "Take Photo" button — the attention cue sits exactly
  // where the action needs to happen, at the moment it needs to happen.
  // Shown only once ever (firstScanHintShown persists via OnboardingContext,
  // same pattern as Settings' one-time "Done" hint), dismissed the moment
  // the user taps either scan action below.
  useEffect(() => {
    if (scanStage !== "idle" || firstScanHintShown) {
      firstScanHintPulse.stopAnimation();
      firstScanHintPulse.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(firstScanHintPulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(firstScanHintPulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scanStage, firstScanHintShown, firstScanHintPulse]);

  // Drives the real fill-to-100% + a brief visible hold, keyed off the RAW
  // (unheld) stage so it fires exactly once on true completion, independent
  // of the deliberately-delayed display `scanStage` above. Without this
  // being separate from the shrink/reveal effect below, the fill animation
  // and the view that unmounts it would land in the same tick — see
  // scanRevealActive's comment in ScanContext for the full failure this
  // fixes.
  useEffect(() => {
    if (rawScanStage !== "completed") {
      completionHandledRef.current = false;
      return undefined;
    }
    if (completionHandledRef.current) return undefined;
    completionHandledRef.current = true;

    if (mountedAlreadyCompleteRef.current) {
      // Already complete before this component even mounted (see the
      // comment on mountedAlreadyCompleteRef above) — snap straight to the
      // resting values with no motion instead of replaying a reveal that
      // already happened once, in a previous mount.
      progressBarAnim.setValue(1);
      return undefined;
    }

    // scanRevealActive is already true by now — set synchronously in
    // ScanContext's own render the instant rawScanStage became
    // "completed", not here. This effect only owns the actual fill
    // animation + hold timer + eventual release.
    let cancelled = false;
    // The creep is still ticking (scanStage reads "scanning" through the hold): stop it first, or its
    // next tick cancels the fill below.
    const from = progressEstimateRef.current?.();
    const speed = progressSpeedRef.current?.();
    if (!scanIsDemoRef.current && scanStartedAtRef.current) {
      recordScanTiming("fridge", Date.now() - scanStartedAtRef.current);
    }
    progressAnimRef.current?.stop?.();
    progressAnimRef.current = null;
    const cancelFill = finishProgress(progressBarAnim, () => {
      // A full bar means done: move on almost at once (see SCAN_DONE_HOLD_MS).
      setTimeout(() => {
        if (!cancelled) setScanRevealActive(false);
      }, SCAN_DONE_HOLD_MS);
    }, { from, speed });

    return () => {
      cancelled = true;
      cancelFill();
    };
  }, [rawScanStage, progressBarAnim, setScanRevealActive, scanIsDemoRef]);

  // Linear progress 0→1 over TOTAL_SCAN_DURATION → commit + shrink at 100%.
  useEffect(() => {
    if (scanStage !== "scanning") {
      progressAnimRef.current?.stop?.();
      progressAnimRef.current = null;
      if (scanStage !== "completed") {
        progressBarAnim.setValue(0);
        setCurrentStepIdx(0);
        shrinkStartedRef.current = false;
      }
      return undefined;
    }

    // Confirmed real regression, caught while testing the fill/hold fix
    // above: this effect also depends on endScanChoreography, whose
    // identity from context changes as a side effect of committing the
    // scanned ingredients — which fires DURING the post-completion hold
    // (scanStage still reads "scanning" on purpose, see scanRevealActive's
    // comment in ScanContext). Without this guard, that spurious re-run wiped
    // progressBarAnim back to 0 and restarted the whole 3.2s phase1 climb
    // from scratch, so the bar visibly dropped from 100% down to ~3%
    // before the completed view took over — worse than the original bug.
    // completionHandledRef is only ever true once real completion has
    // already been handled, so this can't block a genuine new scan (Effect
    // above resets it to false the moment a fresh scan starts).
    if (completionHandledRef.current) return undefined;

    photoHeightAnim.setValue(scanDisplayHeightRef.current);
    shrinkStartedRef.current = false;
    setCurrentStepIdx(0);
    progressBarAnim.setValue(0);


    // One continuous curve, never claiming 100% before the real result lands (see startScanProgress). The
    // scan always shows for TOTAL_SCAN_DURATION; at that point endScanChoreography runs, exactly as it did when
    // this was a two-phase animation, and if the real response is already in hand the completed effect above
    // fills the bar from wherever the curve has got to.
    scanStartedAtRef.current = Date.now();
    // The sample scan is scripted and quick; a real one takes what this phone's recent scans took.
    const progress = startScanProgress(progressBarAnim, {
      expectedMs: scanIsDemoRef.current ? 3400 : expectedScanMs("fridge"),
      useNativeDriver: true,
    });
    progressAnimRef.current = progress;
    progressEstimateRef.current = progress.estimate;
    progressSpeedRef.current = progress.speed;
    const endTimer = setTimeout(() => endScanChoreography(), TOTAL_SCAN_DURATION);

    const stepTimers = SCAN_STATUS_AT_MS.map((ms, idx) =>
      idx === 0 ? null : setTimeout(() => setCurrentStepIdx(idx), ms)
    );

    return () => {
      clearTimeout(endTimer);
      stepTimers.forEach((id) => id && clearTimeout(id));
      progressAnimRef.current?.stop?.();
      progressAnimRef.current = null;
    };
  }, [
    scanStage,
    scanHeight,
    progressBarAnim,
    photoHeightAnim,
    endScanChoreography,
    scanIsDemoRef,
  ]);

  useEffect(() => {
    if (scanStage !== "scanning") return;
    stepOpacity.setValue(0);
    stepTranslate.setValue(10);
    Animated.parallel([
      Animated.spring(stepOpacity, {
        toValue: 1,
        friction: 8,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.spring(stepTranslate, {
        toValue: 0,
        friction: 8,
        tension: 90,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentStepIdx, scanStage, stepOpacity, stepTranslate]);

  useEffect(() => {
    if (scanStage === "idle") {
      photoHeightAnim.setValue(COMPACT_HEIGHT);
      ingredientsOpacity.setValue(0);
      ingredientsTranslate.setValue(18);
      radarOpacity.setValue(0);
      radarTranslate.setValue(16);
      return;
    }

    if (scanStage === "scanning") {
      ingredientsOpacity.setValue(0);
      ingredientsTranslate.setValue(18);
      chipReveal.setValue(0);

      Animated.timing(photoHeightAnim, {
        toValue: scanDisplayHeightRef.current,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();

      Animated.parallel([
        Animated.timing(radarOpacity, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(radarTranslate, {
          toValue: 0,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
      ]).start();


      // Icon "breathing" — slow scale pulse so the Vision Radar icon reads
      // as actively working, not a static glyph. 1.6s cycle (slower than
      // badgePulse's 0.7s) so the two don't read as mechanically identical.
      const iconPulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(iconPulse, {
            toValue: 1.12,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(iconPulse, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      iconPulseLoop.start();

      return () => {
        iconPulseLoop.stop();
      };
    }

    if (!shrinkStartedRef.current) {
      shrinkStartedRef.current = true;
      // The fill-to-100% itself now happens earlier, in the effect above
      // keyed on rawScanStage — by the time this branch runs, scanRevealActive
      // has already flipped back to false specifically because that fill +
      // visible hold finished, so progressBarAnim/progressPct are already at
      // their real 100% here. Shrink and reveal together — the earlier
      // "minimizes but still
      // loading" bug was the fixed-timer premature trigger (fixed above by
      // gating this whole block on real completion), not the overlap
      // between these two animations. Waiting for the shrink to finish
      // before starting the reveal made the transition read as two steps
      // with a dead gap in between instead of one smooth motion — so these
      // stay simultaneous; per further direct feedback (twice now — 320ms/
      // friction8-tension60, then 420ms/friction9-tension45 — both still
      // "too fast"), what actually needed to change was the PACE of the
      // motion itself, pushed further this round: duration 420ms -> 600ms,
      // and Easing.out swapped for Easing.inOut so the shrink itself eases
      // in gently at the start too, instead of snapping into motion and
      // only decelerating at the end. The reveal springs are softened
      // further as well (friction 9/tension 45 -> 10/tension 30) for a
      // slower, more fluid settle.
      Animated.timing(photoHeightAnim, {
        toValue: COMPACT_HEIGHT,
        duration: 600,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }).start();

      completionFlash.setValue(0.4);
      Animated.timing(completionFlash, {
        toValue: 0,
        duration: 650,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();

      // The end of the wait is the payoff: let the detected items appear one
      // after another (~1s at most) instead of the whole list landing at once.
      Animated.timing(chipReveal, {
        toValue: 1,
        duration: 450 + Math.min(ingredientCountRef.current, 12) * 70,
        delay: 250,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();

      Animated.parallel([
        Animated.spring(ingredientsOpacity, {
          toValue: 1,
          friction: 10,
          tension: 30,
          useNativeDriver: true,
        }),
        Animated.spring(ingredientsTranslate, {
          toValue: 0,
          friction: 10,
          tension: 30,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Fallback: if this effect re-runs after completion was already
      // handled (e.g. returning to the tab), force ingredients visible
      // instead of leaving them at opacity 0 — otherwise the user sees a
      // blank page under the scanned photo.
      photoHeightAnim.setValue(COMPACT_HEIGHT);
      ingredientsOpacity.setValue(1);
      ingredientsTranslate.setValue(0);
      chipReveal.setValue(1);
      radarOpacity.setValue(0);
    }
  }, [
    scanStage,
    scanHeight,
    photoHeightAnim,
    ingredientsOpacity,
    ingredientsTranslate,
    chipReveal,
    completionFlash,
    iconPulse,
    radarOpacity,
    radarTranslate,
  ]);

  const beginInstantScan = async (uri, source) => {
    if (!uri) return;
    // Measure the photo first so the frame opens at its final shape; resizing
    // it after the scan starts read as a sudden zoom.
    const fit = await measureFitHeight(uri);
    if (fit) setPhotoFitHeight(fit);
    scanDisplayHeightRef.current = fit ? Math.min(scanHeight, fit) : scanHeight;
    photoHeightAnim.setValue(scanDisplayHeightRef.current);
    try {
      await completeScan?.(uri, source);
    } catch (err) {
      log.warn("[Cook AI] Instant scan failed:", err?.message);
      showToast?.(t("errors.analyzePhotoFailed"), "error");
    }
  };

  return {
    scanStage,
    hasFood,
    foodCount,
    scanDisplayHeight,
    photoHeightAnim,
    ingredientsOpacity,
    ingredientsTranslate,
    radarOpacity,
    radarTranslate,
    chipReveal,
    completionFlash,
    iconPulse,
    firstScanHintPulse,
    progressBarAnim,
    stepOpacity,
    stepTranslate,
    currentStepIdx,
    beginInstantScan,
  };
}
