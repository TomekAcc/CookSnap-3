import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  Animated,
  Easing,
  Dimensions,
  Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import {
  Camera,
  Image as ImageIcon,
  Plus,
  SearchX,
  X,
  CheckCircle2,
  Zap,
} from "../icons";
import { useCookAI } from "../context/CookAIContext";
import { useModalState } from "../context/ModalContext";
import { useTheme } from "../context/ThemeContext";
import { TOTAL_SCAN_DURATION } from "../constants/scanChoreography";
import { getIngredientStyle } from "../utils/imageUtils";
import { startAsymptoticCreep } from "../utils/scanProgressCreep";
import { translateCount } from "../i18n";
import PillTag from "./PillTag";
import PrivacyNote from "./PrivacyNote";
import { sampleFridgeFitHeight } from "../constants/sampleFridge";
import PerfectCloseButton from "./PerfectCloseButton";
import ScanLaserOverlay from "./ScanLaserOverlay";
import ScanMoreSheet from "./ScanMoreSheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { log } from "../utils/log";

// Placeholders the vision model is told never to use but sometimes does; a
// chip with no emoji reads better than a generic jar or box.
const GENERIC_EMOJI = new Set(["🫙", "🛒", "📦", "❓", "🍽️", "🍽"]);

// What the scan screen says while the AI works, and when each line appears
// (ms after the scan starts). Deliberately generic: the model sees the whole
// photo at once, so it never "scans shelves" one after another.
const SCAN_STATUS_KEYS = [
  "scanner.statusLooking",
  "scanner.statusSpotting",
  "scanner.statusAlmost",
  "scanner.statusSlow",
];
const SCAN_STATUS_AT_MS = [0, 2500, 6500, 14000];
// Where the bar sits when the scripted first phase ends; it creeps on from here.
const PHASE1_PROGRESS = 0.6;

/** Compact header after AI detection completes. */
const COMPACT_HEIGHT = 120;

// Detected-ingredient pills only — a scoped override on top of PillTag's
// shared defaults so PantryTab's category-filter pills stay untouched.
//
// This used to be visibly bigger AND a different shape from every other
// pill in the app: paddingVertical 8 (base is 6) and borderRadius 20 — a
// rounded rectangle, not the stadium/pill shape every other chip uses. On
// a detected-fridge scan that's routinely 10+ items wrapped across 5+
// rows, that extra 2px per side and the shape mismatch were both visible
// and both added real scroll height. Padding now matches the shared
// baseline; radius stays 999 (PillTag's own default, so no explicit value
// is even needed here) — background/border stay custom, since these tags
// need a visible boundary that a selectable filter pill doesn't.
function getDetectedPillStyle(isDark, colors) {
  return {
    paddingVertical: 5,
    paddingHorizontal: 11,
    backgroundColor: isDark ? colors.inputBg : "rgba(241, 245, 249, 0.7)",
    borderColor: isDark ? colors.cardBorder : "rgba(226, 232, 240, 0.8)",
  };
}

/** Hermes-safe: strip emoji/pictographs so pills show exactly one icon. */
function stripInlineEmojis(str) {
  return String(str || "")
    .replace(/(?:[\uD800-\uDBFF][\uDC00-\uDFFF])/g, "")
    .replace(/[\u2600-\u27BF]/g, "")
    .replace(/[\uFE0F\u200D]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

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
 * Instant Scan + Vision Radar choreography.
 * Capture → laser/radar while AI runs → shrink → ingredients.
 * Scan More appends de-duped items.
 */
export default function FridgeScannerHero() {
  const {
    ingredients,
    removeIngredient,
    addIngredient,
    isScanning,
    scanRevealActive,
    setScanRevealActive,
    scanningLabel,
    cameraOpen,
    setCameraOpen,
    fridgePhoto,
    scanHistory,
    hasScanned,
    completeScan,
    scanIsDemo,
    endScanChoreography,
    resetScan,
    showToast,
    canScanFridge,
    t,
    recipeLanguageId,
    firstScanHintShown,
    markFirstScanHintShown,
  } = useCookAI();
  const { setScanMoreOpen, setProModalOpen, setProReason } = useModalState();
  const { colors, isDark } = useTheme();
  const scanMoreButtonRef = useRef(null);
  const [scanMoreAnchor, setScanMoreAnchor] = useState(null);

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
  // it with no one-render gap) now lives in CookAIContext, not here — see
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
  const insets = useSafeAreaInsets();
  const shutterBottom = Math.max(insets.bottom + 28, 40);

  const [permission, requestPermission] = useCameraPermissions();
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [showAddInput, setShowAddInput] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const cameraRef = useRef(null);

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
  const [barWidth, setBarWidth] = useState(0);
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
  const shrinkStartedRef = useRef(false);

  // Confirmed real feedback: a first-time user landing on this idle screen
  // right after onboarding didn't register that this is where you scan —
  // even though the card already has a clear title/subtitle/button. Rather
  // than add another onboarding screen to tap through (more friction, easy
  // to swipe past on autopilot), this puts a one-time soft pulsing glow
  // directly on the "Take Photo" button — the attention cue sits exactly
  // where the action needs to happen, at the moment it needs to happen.
  // Shown only once ever (firstScanHintShown persists via CookAIContext,
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
  // scanRevealActive's comment in CookAIContext for the full failure this
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
    // CookAIContext's own render the instant rawScanStage became
    // "completed", not here. This effect only owns the actual fill
    // animation + hold timer + eventual release.
    let cancelled = false;
    Animated.timing(progressBarAnim, {
      toValue: 1,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      if (cancelled) return;
      // Hold the genuinely-full bar on screen for a beat before letting
      // the shrink/reveal effect below swap the view away — long enough
      // to actually register as "done", short enough not to feel laggy.
      //
      // Bumped twice now on direct feedback (380ms, then 480ms) — both
      // still read as "instant"/"rapid" rather than smooth and intentional.
      // 650ms is a deliberately bigger jump rather than another timid
      // increment: a pause under ~500ms doesn't give the eye enough time to
      // register "done" as its own distinct moment before the next motion
      // starts, no matter how smooth that next motion is.
      setTimeout(() => {
        if (!cancelled) setScanRevealActive(false);
      }, 650);
    });

    return () => {
      cancelled = true;
    };
  }, [rawScanStage, progressBarAnim, setScanRevealActive]);

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
    // comment in CookAIContext). Without this guard, that spurious re-run wiped
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


    // Two-phase, never-lies-about-100% approach. This has been "fixed"
    // twice before and regressed both times, so here's the actual
    // reasoning: a fixed-duration bar reaching literal 100% before the
    // real network response lands is a contradiction no matter how the
    // duration is tuned — either it's short enough to sometimes finish
    // early (and then sits at a frozen "100%" for however much longer the
    // real response actually takes, which is exactly what a user reported:
    // "it stops for a while at 100% without being scanned"), or it's
    // padded long enough to rarely finish early (which just reintroduces
    // the earlier "freezes at 92%" complaint under a different number,
    // since network latency varies run to run regardless of what constant
    // is picked). No fixed duration can win against a variable network.
    //
    // Phase 1 runs the original pacing unchanged — TOTAL_SCAN_DURATION,
    // linear, but capped at 92% instead of 100% — so the believable
    // multi-stage choreography (the rotating step labels below) keeps its
    // intended timing exactly as before. At that point endScanChoreography
    // runs exactly like it used to; if the real response is already in
    // hand, the scanStage === "completed" effect below fires within the
    // same tick and snaps straight to 100% — a fast scan still looks
    // identical to before this change.
    //
    // Phase 2 only matters when the real response ISN'T ready yet. Its
    // first version was ALSO a fixed-duration Animated.timing (0.92→0.99
    // over a flat 8000ms) — smooth for 8 seconds, then it simply stopped
    // moving, which is exactly the "it still stops" a user reported: any
    // fixed duration is just a deadline in disguise, and a deadline is
    // always eventually wrong for a variable network call. Fixed by
    // startAsymptoticCreep, which drives the value off Date.now() instead
    // of a timing duration — there is no deadline to run out, so it keeps
    // creeping (progressively more slowly) for as long as the real scan
    // actually takes, never claiming "100%" and never going visibly flat,
    // until real completion overrides it below.
    const phase1Anim = Animated.timing(progressBarAnim, {
      toValue: PHASE1_PROGRESS,
      duration: TOTAL_SCAN_DURATION,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    progressAnimRef.current = phase1Anim;

    phase1Anim.start(({ finished }) => {
      if (!finished) return;
      endScanChoreography();
      const stopCreep = startAsymptoticCreep(progressBarAnim, {
        from: PHASE1_PROGRESS,
        ceiling: 0.96,
        decayMs: 7000,
      });
      progressAnimRef.current = { stop: stopCreep };
    });

    const stepTimers = SCAN_STATUS_AT_MS.map((ms, idx) =>
      idx === 0 ? null : setTimeout(() => setCurrentStepIdx(idx), ms)
    );

    return () => {
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

  // The daily free-scan cap is actually gated and consumed inside
  // completeScan() (CookAIContext) — the single choke point every real
  // scan funnels through, regardless of entry point. This is only a
  // read-only early check so a capped-out free user hits the paywall
  // immediately instead of being walked through a camera-permission
  // prompt for nothing; it never itself consumes an allowance, so
  // denying the permission prompt or backing out of the camera without
  // capturing anything never burns a scan.
  const handleOpenCamera = async () => {
    if (!canScanFridge) {
      setProReason?.("scan");
      setProModalOpen(true);
      return;
    }
    try {
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          showToast?.(t("errors.cameraPermission"), "error");
          return;
        }
      }
      setCameraOpen(true);
    } catch (err) {
      log.warn("[Cook AI] Failed to open camera:", err?.message);
      showToast?.(t("errors.openCameraFailed"), "error");
    }
  };

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

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        imageType: "jpg",
      });
      setCameraOpen(false);
      await beginInstantScan(photo.uri, "camera");
    } catch (err) {
      log.warn("[Cook AI] Failed to capture photo:", err?.message);
      setCameraOpen(false);
      showToast?.(t("errors.capturePhotoFailed"), "error");
    }
  };


  const handlePickFromGallery = async () => {
    if (!canScanFridge) {
      setProReason?.("scan");
      setProModalOpen(true);
      return;
    }
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        showToast?.(t("errors.galleryPermission"), "error");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.9,
        exif: false,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        await beginInstantScan(result.assets[0].uri, "gallery");
      }
    } catch (err) {
      log.warn(
        "[Cook AI] Failed to pick photo from gallery:",
        err?.message
      );
      showToast?.(t("errors.loadPhotoFailed"), "error");
    }
  };

  const handleAddItem = () => {
    const trimmed = newItemName.trim();
    if (!trimmed) return;
    const style = getIngredientStyle(trimmed);
    const emoji = style.emoji || "🛒";
    addIngredient({
      id: `custom-${trimmed.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
      name: trimmed,
      emoji,
      icon: emoji,
    });
    setNewItemName("");
    setShowAddInput(false);
  };

  const startScanAgain = () => {
    setShowAddInput(false);
    setNewItemName("");
    resetScan();
  };

  const handleScanMore = () => {
    if (isScanning) return;
    scanMoreButtonRef.current?.measureInWindow((x, y, width, height) => {
      setScanMoreAnchor({ x, y, width, height });
      setScanMoreOpen?.(true);
    });
  };

  return (
    <>
      <View style={{ marginHorizontal: 20, marginTop: 16, marginBottom: 8 }}>
        {scanStage === "idle" && (
          <View
            style={{
              backgroundColor: isDark ? colors.card : "#FFFFFF",
              borderRadius: 22,
              padding: 20,
              borderWidth: 1,
              borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
              alignItems: "center",
            }}
          >
            {/* Same pastel-emerald tone every icon badge in the app uses
                (Profile, Pantry, Saved headers, IconBadge's own palette) —
                this was a flat navy/gray box with an amber-on-dark-mode
                accent that didn't match anything else on screen, reading
                as an unstyled placeholder next to the colorful icons in
                the cards right below it. Kept at 64px (not IconBadge's
                standard 44px) since this is the hero of the whole screen,
                not a small nav-row badge.

                Light mode uses a subtle gradient fill (matches the
                approved mockup exactly) instead of a flat tint — that
                gradient plus a tighter, closer-hugging shadow is what
                reads as a deliberately elevated card; the first pass's
                flat fill + wide, diffuse shadow read more like an
                unintentional haze than a real shadow. Dark mode keeps a
                flat fill (the light gradient's colors don't translate —
                they'd either wash out or muddy against a dark card). */}
            {isDark ? (
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  backgroundColor: "#064E3B",
                  borderWidth: 1,
                  borderColor: "#065F46",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 12,
                  shadowColor: "#059669",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.18,
                  shadowRadius: 6,
                  elevation: 3,
                }}
              >
                <Camera size={22} color="#34D399" />
              </View>
            ) : (
              // Split into two views on purpose: LinearGradient needs
              // overflow:"hidden" to clip its fill to the rounded corners,
              // but a shadow on that same view gets clipped away by that
              // same overflow:"hidden" — it's drawn outside the view's
              // bounds, which is exactly what overflow:hidden cuts off.
              // Confirmed real failure on-device: the gradient showed, the
              // shadow silently didn't. The shadow now lives on this outer
              // plain View (no overflow set, so nothing clips it); the
              // LinearGradient inside only owns the fill + clipping.
              //
              // Opacity dropped hard from the first pass (0.3 → 0.12) —
              // that one still read as a diffuse green "glow"/halo even
              // after the clipping fix, not a real shadow. Reason: RN's
              // shadow has no CSS "spread" property, so the mockup's
              // negative-spread box-shadow (which is what tightened it in
              // the browser) has no direct equivalent here — the same
              // nominal opacity/blur numbers spread out much further on
              // real iOS than in Chromium. This app's own proven card
              // shadow (designSystem.js DS.shadow.card) sits at just
              // 0.04–0.06 opacity; landing near there (with a bit more for
              // the emerald tint to still read at all) is what actually
              // keeps this looking like elevation instead of a glow.
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  marginBottom: 12,
                  shadowColor: "#059669",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.12,
                  shadowRadius: 5,
                  elevation: 3,
                }}
              >
                <LinearGradient
                  colors={["#D1FAE5", "#A7F3D0"]}
                  start={{ x: 0.15, y: 0 }}
                  end={{ x: 0.85, y: 1 }}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    overflow: "hidden",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Camera size={22} color="#059669" />
                </LinearGradient>
              </View>
            )}
            <Text
              style={{
                color: colors.textPrimary,
                fontWeight: "700",
                fontSize: 21,
                textAlign: "center",
                marginBottom: 6,
                letterSpacing: -0.5,
              }}
            >
              {t("scanner.title")}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 14,
                fontWeight: "400",
                textAlign: "center",
                lineHeight: 19,
                marginBottom: 18,
                paddingHorizontal: 8,
              }}
            >
              {t("scanner.subtitle")}
            </Text>

            <View style={{ flexDirection: "row", width: "100%", gap: 10 }}>
              {/* Emerald, not navy — "Generate AI Recipes" right after a
                  scan is the same color now too (see ScannerScreen's
                  ctaPrimary), so there's one consistent "this is the
                  primary action" color across the whole scan flow instead
                  of navy and the app's actual brand green both claiming
                  that role on the same screen. */}
              <View style={{ flex: 1.15 }}>
                {/* One-time glow halo — see the firstScanHintPulse effect
                    above for why. Sits behind the button (negative inset,
                    lower in paint order), pulses opacity + scale together
                    so it reads as a soft breathing highlight rather than a
                    hard outline. pointerEvents none so it never steals the
                    tap. */}
                {!firstScanHintShown && (
                  <Animated.View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      top: -6,
                      bottom: -6,
                      left: -6,
                      right: -6,
                      borderRadius: 19,
                      backgroundColor: "#059669",
                      opacity: firstScanHintPulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 0.35],
                      }),
                      transform: [
                        {
                          scale: firstScanHintPulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.94, 1.06],
                          }),
                        },
                      ],
                    }}
                  />
                )}
                <TouchableOpacity
                  onPress={() => {
                    markFirstScanHintShown();
                    handleOpenCamera();
                  }}
                  activeOpacity={0.9}
                  style={{
                    height: 46,
                    backgroundColor: "#059669",
                    borderRadius: 13,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                  }}
                >
                  <Camera size={16} color="#FFFFFF" />
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 15,
                      fontWeight: "600",
                      marginLeft: 8,
                    }}
                    numberOfLines={1}
                  >
                    {t("scanner.takePhoto")}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => {
                  markFirstScanHintShown();
                  handlePickFromGallery();
                }}
                activeOpacity={0.9}
                style={{
                  flex: 1,
                  height: 46,
                  backgroundColor: isDark ? colors.card : "#FFFFFF",
                  borderWidth: 1,
                  borderColor: isDark ? colors.cardBorder : "#E2E8F0",
                  borderRadius: 13,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                }}
              >
                <ImageIcon size={15} color="#059669" />
                <Text
                  style={{
                    color: isDark ? colors.textPrimary : "#0F172A",
                    fontSize: 15,
                    fontWeight: "600",
                    marginLeft: 8,
                  }}
                  numberOfLines={1}
                >
                  {t("scanner.fromGallery")}
                </Text>
              </TouchableOpacity>
            </View>
            {(scanHistory || []).length === 0 ? <PrivacyNote /> : null}
          </View>
        )}

        {scanStage !== "idle" && (
          <>
            <Animated.View
              style={[
                {
                  height: photoHeightAnim,
                  borderRadius: 28,
                  overflow: "hidden",
                  backgroundColor: "#1E293B",
                  marginBottom: 0,
                  position: "relative",
                },
                // Shadow purge: this View also sets overflow:"hidden" for its
                // rounded corners, and iOS shadows + clipsToBounds on the same
                // native layer is a documented conflict — clipping needs
                // clipsToBounds=true, shadows need it false. Combined with an
                // animated height, this was rendering as an unpredictable
                // stray shadow band elsewhere in the scroll instead of a
                // clean glow under the photo. Drop the shadow entirely rather
                // than fight the conflict.
                Platform.select({
                  ios: {
                    shadowColor: "transparent",
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0,
                    shadowRadius: 0,
                  },
                  android: { elevation: 0 },
                }),
              ]}
            >
              <TouchableOpacity
                activeOpacity={scanStage === "completed" ? 0.85 : 1}
                disabled={scanStage !== "completed"}
                onPress={() => setPhotoViewerOpen(true)}
                accessibilityLabel={t("a11y.viewFridgePhoto")}
                accessibilityRole="button"
                style={{ width: "100%", height: "100%" }}
              >
                <Image
                  source={{ uri: fridgePhoto }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              </TouchableOpacity>

              {/* A light fridge photo (white door, bright shelf) is nearly the page
                  colour, so its edge and rounded corners vanished and the white
                  Close / Scan More buttons looked like they floated past the
                  photo. A soft dark scrim behind the top controls keeps them
                  readable, and a hairline outline restores the photo's shape. */}
              <LinearGradient
                pointerEvents="none"
                colors={["rgba(15, 23, 42, 0.38)", "rgba(15, 23, 42, 0)"]}
                style={{ position: "absolute", top: 0, left: 0, right: 0, height: 72 }}
              />
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: 28,
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.14)",
                }}
              />

              {/* 60fps Reanimated laser — UI thread, never blocks Gemini */}
              <ScanLaserOverlay
                active={scanStage === "scanning"}
                travelDistance={Math.max(scanDisplayHeight - 32, 80)}
              />

              <Animated.View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "#FFFFFF",
                  opacity: completionFlash,
                  zIndex: 15,
                }}
              />

              {scanStage === "completed" && hasFood ? (
                // This count is the actual proof the scan worked — the most
                // important confirmation on this screen — so it gets a
                // solid brand-green badge with real weight, not a quiet
                // translucent chip that reads the same as any other label.
                //
                // Fades/rises in with the same ingredientsOpacity/
                // ingredientsTranslate values driving the ingredient-pill
                // card below, instead of popping in instantly. Confirmed
                // real complaint: this badge used to be a plain View with
                // no animation at all, so it snapped into existence on the
                // exact same frame the photo was mid-shrink — while the
                // ingredient list beneath it was already fading in smoothly
                // — and that mismatch is what read as "instant/too fast"
                // right after a scan, even though the actual shrink/reveal
                // motion itself takes a few hundred ms.
                <Animated.View
                  style={{
                    position: "absolute",
                    bottom: 12,
                    left: 12,
                    zIndex: 20,
                    backgroundColor: "#059669",
                    paddingHorizontal: 11,
                    paddingVertical: 6,
                    borderRadius: 999,
                    flexDirection: "row",
                    alignItems: "center",
                    maxWidth: "60%",
                    opacity: ingredientsOpacity,
                    transform: [{ translateY: ingredientsTranslate }],
                  }}
                >
                  <CheckCircle2 size={12} color="#FFFFFF" />
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 12,
                      fontWeight: "700",
                      marginLeft: 5,
                    }}
                    numberOfLines={1}
                  >
                    {foodCount === 1
                      ? t("scanner.itemsFoundOne", { count: foodCount })
                      : translateCount(recipeLanguageId, foodCount, {
                          few: "scanner.itemsFoundFew",
                          many: "scanner.itemsFoundMany",
                          fallback: "scanner.itemsFoundOther",
                        })}
                  </Text>
                </Animated.View>
              ) : null}

              {/* With nothing detected, Take Photo / From Gallery in the card below
                  already do what Scan More would, so it would only be a duplicate. */}
              {scanStage === "completed" && hasFood && !scanIsDemo ? (
                <TouchableOpacity
                  ref={scanMoreButtonRef}
                  onPress={handleScanMore}
                  activeOpacity={0.85}
                  accessibilityLabel={t("a11y.scanMoreShelves")}
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    zIndex: 30,
                    backgroundColor: "rgba(255, 255, 255, 0.96)",
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 999,
                    flexDirection: "row",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: "rgba(226, 232, 240, 0.95)",
                    // Same fade/rise as the badge above — see its comment.
                    // TouchableOpacity renders its own Animated.View under
                    // the hood, so an Animated.Value here animates exactly
                    // like it would on a plain Animated.View.
                    opacity: ingredientsOpacity,
                    transform: [{ translateY: ingredientsTranslate }],
                  }}
                >
                  <Text
                    style={{
                      color: "#0F172A",
                      fontSize: 12,
                      fontWeight: "700",
                      letterSpacing: 0.2,
                      flexShrink: 1,
                    }}
                    numberOfLines={1}
                  >
                    {t("scanner.scanMore")}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <PerfectCloseButton
                isFullScreen={false}
                corner="left"
                onPress={startScanAgain}
                accessibilityLabel={t("a11y.dismissFridgePhoto")}
              />
            </Animated.View>

            {/* CookSnap Vision Radar */}
            {scanStage === "scanning" && (
              <Animated.View
                style={{
                  marginTop: 16,
                  opacity: radarOpacity,
                  transform: [{ translateY: radarTranslate }],
                }}
              >
                <View
                  style={{
                    gap: 14,
                    backgroundColor: colors.card,
                    borderColor: colors.cardBorder,
                    borderWidth: 1,
                    borderRadius: 24,
                    padding: 16,
                  }}
                >
                  {/* One status area instead of four statements of the same
                      thing (pill on the photo, "Vision Radar" title, step box,
                      percent). The line says what is happening in plain words;
                      the bar carries no percent because the AI returns the whole
                      result at once, so any number would be an estimate. */}
                  <Animated.View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      opacity: stepOpacity,
                      transform: [{ translateY: stepTranslate }],
                    }}
                  >
                    <Animated.View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 14,
                        backgroundColor: isDark ? "#064E3B" : "#ECFDF5",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                        flexShrink: 0,
                        transform: [{ scale: iconPulse }],
                      }}
                    >
                      <Zap size={20} color="#059669" />
                    </Animated.View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontWeight: "700",
                          fontSize: 16,
                          letterSpacing: -0.2,
                        }}
                        numberOfLines={2}
                      >
                        {t(SCAN_STATUS_KEYS[currentStepIdx])}
                      </Text>
                      {/* Only when there is already a list to add to; on a first scan "adding new ingredients" is just noise. */}
                      {scanningLabel && hasFood ? (
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontWeight: "500",
                            fontSize: 13,
                            marginTop: 2,
                          }}
                          numberOfLines={2}
                        >
                          {scanningLabel}
                        </Text>
                      ) : null}
                    </View>
                  </Animated.View>

                  {/* Slides a full-width fill in with a native-driven transform
                      instead of animating its width, which re-laid the card out
                      on the JS thread every frame. */}
                  <View
                    onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
                    style={{
                      width: "100%",
                      backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                      height: 8,
                      borderRadius: 999,
                      overflow: "hidden",
                    }}
                  >
                    {barWidth > 0 ? (
                      <Animated.View
                        style={{
                          width: barWidth,
                          height: "100%",
                          borderRadius: 999,
                          backgroundColor: "#10B981",
                          transform: [
                            {
                              translateX: progressBarAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-barWidth, 0],
                              }),
                            },
                          ],
                        }}
                      />
                    ) : null}
                  </View>
                </View>
              </Animated.View>
            )}

            {/* Ingredients — only after scan fully completes */}
            {scanStage === "completed" && !isScanning && (
              <Animated.View
                style={{
                  opacity: ingredientsOpacity,
                  transform: [{ translateY: ingredientsTranslate }],
                  marginTop: 22,
                }}
              >
                {!hasFood ? (
                  <View
                    style={{
                      padding: 20,
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.cardBorder,
                      borderRadius: 24,
                      alignItems: "center",
                    }}
                  >
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 16,
                        backgroundColor: colors.accentGreenSoft || "#ECFDF5",
                        borderWidth: 1,
                        borderColor: colors.accentGreenBorder || "#D1FAE5",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 12,
                      }}
                    >
                      <SearchX size={26} color="#059669" />
                    </View>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: 17,
                        fontWeight: "700",
                        letterSpacing: -0.2,
                        textAlign: "center",
                      }}
                    >
                      {t("scanner.noItemsTitle")}
                    </Text>
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 14,
                        fontWeight: "500",
                        textAlign: "center",
                        lineHeight: 20,
                        marginTop: 6,
                      }}
                    >
                      {t("scanner.noItemsTip")}
                    </Text>

                    {/* The message offers "add manually", so the way to do it has
                        to be right here (the normal card's Add button only exists
                        once there is a list). */}
                    {showAddInput ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignSelf: "stretch",
                          marginTop: 14,
                          gap: 8,
                        }}
                      >
                        <TextInput
                          placeholder={t("scanner.addItemPlaceholder")}
                          placeholderTextColor={colors.textSecondary}
                          value={newItemName}
                          onChangeText={setNewItemName}
                          onSubmitEditing={handleAddItem}
                          returnKeyType="done"
                          autoFocus
                          style={{
                            flex: 1,
                            backgroundColor: colors.inputBg,
                            borderWidth: 1,
                            borderColor: colors.cardBorder,
                            borderRadius: 12,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            fontSize: 14,
                            color: colors.textPrimary,
                          }}
                        />
                        <TouchableOpacity
                          onPress={handleAddItem}
                          activeOpacity={0.85}
                          style={{
                            backgroundColor: "#10B981",
                            paddingHorizontal: 16,
                            justifyContent: "center",
                            borderRadius: 12,
                          }}
                        >
                          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 12 }}>
                            {t("scanner.add")}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            setShowAddInput(false);
                            setNewItemName("");
                          }}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel={t("recipeDetail.cancel")}
                          style={{
                            width: 38,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <X size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <>
                      <View
                        style={{
                          flexDirection: "row",
                          alignSelf: "stretch",
                          marginTop: 16,
                          gap: 10,
                        }}
                      >
                        <TouchableOpacity
                          onPress={handleOpenCamera}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          style={{
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "#059669",
                            paddingVertical: 13,
                            borderRadius: 16,
                          }}
                        >
                          <Camera size={17} color="#FFFFFF" />
                          <Text
                            style={{
                              color: "#FFFFFF",
                              fontSize: 15,
                              fontWeight: "700",
                              marginLeft: 8,
                              flexShrink: 1,
                            }}
                            numberOfLines={1}
                          >
                            {t("scanner.takePhoto")}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={handlePickFromGallery}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          style={{
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: colors.inputBg,
                            borderWidth: 1,
                            borderColor: colors.cardBorder,
                            paddingVertical: 13,
                            borderRadius: 16,
                          }}
                        >
                          <ImageIcon size={17} color="#059669" />
                          <Text
                            style={{
                              color: colors.textPrimary,
                              fontSize: 15,
                              fontWeight: "700",
                              marginLeft: 8,
                              flexShrink: 1,
                            }}
                            numberOfLines={1}
                          >
                            {t("scanner.fromGallery")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        onPress={() => setShowAddInput(true)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        style={{
                          marginTop: 12,
                          flexDirection: "row",
                          alignItems: "center",
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                        }}
                      >
                        <Plus size={15} color="#059669" />
                        <Text
                          style={{
                            color: "#059669",
                            fontSize: 14,
                            fontWeight: "700",
                            marginLeft: 5,
                          }}
                        >
                          {t("scanner.add")}
                        </Text>
                      </TouchableOpacity>
                      </>
                    )}
                  </View>
                ) : (
                  <View
                    style={{
                      // 14, matching MealPreferences' card padding — this
                      // card sat directly above that screen at 16, one of
                      // several small size mismatches between two cards a
                      // user scrolls past in the same flow.
                      padding: 14,
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.cardBorder,
                      borderRadius: 24,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 10,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          flex: 1,
                          paddingRight: 8,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.textPrimary,
                            fontWeight: "700",
                            fontSize: 16,
                            letterSpacing: -0.2,
                          }}
                        >
                          {t("scanner.detectedIngredients")}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => setShowAddInput(true)}
                        activeOpacity={0.75}
                        style={{
                          backgroundColor: colors.inputBg,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 999,
                          flexDirection: "row",
                          alignItems: "center",
                        }}
                      >
                        <Plus size={14} color={colors.textPrimary} />
                        <Text
                          style={{
                            color: colors.textPrimary,
                            fontSize: 12,
                            fontWeight: "700",
                            marginLeft: 4,
                          }}
                        >
                          {t("scanner.add")}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {showAddInput && (
                      <View
                        style={{
                          flexDirection: "row",
                          marginBottom: 12,
                          gap: 8,
                        }}
                      >
                        <TextInput
                          placeholder={t("scanner.addItemPlaceholder")}
                          placeholderTextColor={colors.textSecondary}
                          value={newItemName}
                          onChangeText={setNewItemName}
                          onSubmitEditing={handleAddItem}
                          returnKeyType="done"
                          autoFocus
                          style={{
                            flex: 1,
                            backgroundColor: colors.inputBg,
                            borderWidth: 1,
                            borderColor: colors.cardBorder,
                            borderRadius: 12,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            fontSize: 14,
                            color: colors.textPrimary,
                          }}
                        />
                        <TouchableOpacity
                          onPress={handleAddItem}
                          activeOpacity={0.85}
                          style={{
                            backgroundColor: "#10B981",
                            paddingHorizontal: 16,
                            justifyContent: "center",
                            borderRadius: 12,
                          }}
                        >
                          <Text
                            style={{
                              color: "#FFFFFF",
                              fontWeight: "700",
                              fontSize: 12,
                            }}
                          >
                            {t("scanner.add")}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            setShowAddInput(false);
                            setNewItemName("");
                          }}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel={t("recipeDetail.cancel")}
                          style={{
                            width: 38,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <X size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Real tester feedback: a top-down photo can't show an exact
                        cut of meat, so the scan can be wrong. One short line,
                        only for the first 3 scans (scanHistory is persisted):
                        after that people know the list is editable (the × and
                        Add are right there) and the line is just noise. */}
                    {scanIsDemo ? (
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontSize: 13,
                          fontWeight: "600",
                          lineHeight: 18,
                          marginBottom: 12,
                        }}
                      >
                        {t("scanner.sampleNote")}
                      </Text>
                    ) : (scanHistory || []).length <= 3 ? (
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontSize: 12,
                          fontWeight: "500",
                          lineHeight: 17,
                          marginBottom: 12,
                        }}
                      >
                        {t("scanner.verifyHint")}
                      </Text>
                    ) : null}

                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        justifyContent: "space-between",
                        rowGap: 5,
                      }}
                    >
                      {(ingredients || []).map((item, index, list) => {
                        const count = list.length;
                        const cleanName =
                          stripInlineEmojis(item?.name) ||
                          String(item?.name || "").trim() ||
                          "Item";
                        // Vision already returns an accurate, language-independent
                        // emoji per item (see MASTER_VISION_SYSTEM_PROMPT) — prefer
                        // that over the local English-keyword guesser, which can't
                        // match a name that's now in the user's selected language.
                        const aiIcon =
                          (typeof item?.icon === "string" && item.icon.trim()) ||
                          (typeof item?.emoji === "string" && item.emoji.trim());
                        const style = getIngredientStyle(cleanName);
                        const rawEmoji = aiIcon || style.emoji || "";
                        const slot = Math.min(index, 11) / Math.min(Math.max(count, 1), 12);
                        const revealStart = slot * 0.6;
                        return (
                          <Animated.View
                            key={item.id}
                            style={{
                              width: "49%",
                              opacity: chipReveal.interpolate({
                                inputRange: [revealStart, revealStart + 0.4],
                                outputRange: [0, 1],
                                extrapolate: "clamp",
                              }),
                              transform: [
                                {
                                  translateY: chipReveal.interpolate({
                                    inputRange: [revealStart, revealStart + 0.4],
                                    outputRange: [10, 0],
                                    extrapolate: "clamp",
                                  }),
                                },
                              ],
                            }}
                          >
                          <PillTag
                            emoji={GENERIC_EMOJI.has(rawEmoji) ? "" : rawEmoji}
                            label={cleanName}
                            onRemove={() => removeIngredient(item.id)}
                            // flexGrow: each row stretches to the card's edges, so
                            // the chips end flush on the right instead of ragged.
                            // Strict two-column grid: equal widths, content left-aligned,
                            // × pinned to the right edge of each chip, so emoji,
                            // names and × each line up in a column. Long names may
                            // use a second line instead of being cut.
                            labelLines={2}
                            fitLabel
                            reserveEmojiSpace
                            style={{
                              ...getDetectedPillStyle(isDark, colors),
                              width: "100%",
                              justifyContent: "flex-start",
                            }}
                            labelStyle={{
                              flex: 1,
                              minWidth: 0,
                              overflow: "hidden",
                              color: isDark ? colors.textPrimary : "#1E293B",
                            }}
                          />
                          </Animated.View>
                        );
                      })}
                    </View>
                  </View>
                )}
              </Animated.View>
            )}
          </>
        )}
      </View>

      {cameraOpen ? (
        <Modal
          visible
          animationType="slide"
          statusBarTranslucent
          presentationStyle="fullScreen"
          onRequestClose={() => setCameraOpen(false)}
        >
          <View style={{ flex: 1, backgroundColor: "#000000" }}>
            <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />

            <PerfectCloseButton
              isFullScreen
              onPress={() => setCameraOpen(false)}
              accessibilityLabel={t("a11y.closeCamera")}
            />

            <View
              pointerEvents="box-none"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: shutterBottom,
                alignItems: "center",
                zIndex: 50,
              }}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontWeight: "700",
                  fontSize: 17,
                  marginBottom: 24,
                  textAlign: "center",
                  paddingHorizontal: 24,
                }}
              >
                {t("scanner.pointAtFridge")}
              </Text>
              <TouchableOpacity
                onPress={handleCapture}
                activeOpacity={0.8}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: "#FFFFFF",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 4,
                  borderColor: "#10B981",
                }}
              >
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: "#10B981",
                  }}
                />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}

      {photoViewerOpen ? (
        <Modal
          visible
          transparent
          animationType="fade"
          statusBarTranslucent
          hardwareAccelerated
          presentationStyle="overFullScreen"
          onRequestClose={() => setPhotoViewerOpen(false)}
        >
          <View style={{ flex: 1, backgroundColor: "#000000" }}>
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => setPhotoViewerOpen(false)}
              accessibilityLabel={t("a11y.dismissFullFridgePhoto")}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Image
                source={{ uri: fridgePhoto }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            </TouchableOpacity>

            <PerfectCloseButton
              isFullScreen
              onPress={() => setPhotoViewerOpen(false)}
              accessibilityLabel={t("a11y.closeFullFridgePhoto")}
            />
          </View>
        </Modal>
      ) : null}

      <ScanMoreSheet anchor={scanMoreAnchor} />
    </>
  );
}
