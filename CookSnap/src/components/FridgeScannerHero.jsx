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
  X,
  RefreshCw,
  CheckCircle2,
  Zap,
} from "lucide-react-native";
import { useCookAI } from "../context/CookAIContext";
import { useModalState } from "../context/ModalContext";
import { useTheme } from "../context/ThemeContext";
import {
  TOTAL_SCAN_DURATION,
  SCAN_STEPS,
} from "../constants/scanChoreography";
import { getIngredientStyle } from "../utils/imageUtils";
import { startAsymptoticCreep } from "../utils/scanProgressCreep";
import { translateCount } from "../i18n";
import PillTag from "./PillTag";
import PerfectCloseButton from "./PerfectCloseButton";
import ScanLaserOverlay from "./ScanLaserOverlay";
import ScanMoreSheet from "./ScanMoreSheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Compact header after AI detection completes. */
const COMPACT_HEIGHT = 150;

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
    paddingVertical: 6,
    paddingHorizontal: 14,
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
  return Math.round(Math.min(h * 0.55, 420));
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
    scanningLabel,
    cameraOpen,
    setCameraOpen,
    fridgePhoto,
    hasScanned,
    completeScan,
    endScanChoreography,
    resetScan,
    showToast,
    canScanFridge,
    t,
    recipeLanguageId,
  } = useCookAI();
  const { setScanMoreOpen, setProModalOpen } = useModalState();
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
  // holdingAtComplete keeps the displayed scanStage pinned at "scanning"
  // for one deliberate beat after real completion, so the fill + hold
  // effect further down actually has a mounted bar to animate.
  const rawScanStage = resolveScanStage(hasScanned, isScanning);
  const [holdingAtComplete, setHoldingAtComplete] = useState(false);
  const completionHandledRef = useRef(false);
  const scanStage = holdingAtComplete ? "scanning" : rawScanStage;
  // Confirmed real failure, found while verifying the identical fix on
  // PantryScannerHero: leaving this tab AFTER a scan finished, then coming
  // back, remounts this component fresh — completionHandledRef and
  // holdingAtComplete both reset, so the effect below saw an already-
  // "completed" rawScanStage and (wrongly) replayed the whole
  // fill+hold+reveal choreography as if it had just finished: the
  // completed photo/pills briefly vanished, the card re-grew, and the
  // laser overlay's scanning veil flashed back over the photo, before
  // settling back to "completed" a moment later. Captured once (useRef's
  // initializer only runs on first render) so the effect can tell "the
  // scan finished during THIS mount, play the reveal" apart from "we
  // mounted straight into an already-finished scan, just show it".
  const mountedAlreadyCompleteRef = useRef(rawScanStage === "completed");
  const scanHeight = useMemo(() => getScanHeight(), []);
  const hasFood = Array.isArray(ingredients) && ingredients.length > 0;
  const foodCount = hasFood ? ingredients.length : 0;
  const insets = useSafeAreaInsets();
  const shutterBottom = Math.max(insets.bottom + 28, 40);

  const [permission, requestPermission] = useCameraPermissions();
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [showAddInput, setShowAddInput] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [progressPct, setProgressPct] = useState(0);
  const cameraRef = useRef(null);

  const photoHeightAnim = useRef(new Animated.Value(COMPACT_HEIGHT)).current;
  const ingredientsOpacity = useRef(new Animated.Value(0)).current;
  const ingredientsTranslate = useRef(new Animated.Value(18)).current;
  const badgePulse = useRef(new Animated.Value(1)).current;
  const radarOpacity = useRef(new Animated.Value(0)).current;
  const radarTranslate = useRef(new Animated.Value(16)).current;
  const stepOpacity = useRef(new Animated.Value(1)).current;
  const stepTranslate = useRef(new Animated.Value(0)).current;
  const progressBarAnim = useRef(new Animated.Value(0)).current;
  const progressAnimRef = useRef(null);
  const shrinkStartedRef = useRef(false);

  // Drives the real fill-to-100% + a brief visible hold, keyed off the RAW
  // (unheld) stage so it fires exactly once on true completion, independent
  // of the deliberately-delayed display `scanStage` above. Without this
  // being separate from the shrink/reveal effect below, the fill animation
  // and the view that unmounts it would land in the same tick — see the
  // comment on holdingAtComplete above for the full failure this fixes.
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
      setProgressPct(100);
      return undefined;
    }

    setHoldingAtComplete(true);

    let cancelled = false;
    Animated.timing(progressBarAnim, {
      toValue: 1,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start(() => {
      if (cancelled) return;
      setProgressPct(100);
      // Hold the genuinely-full bar on screen for a beat before letting
      // the shrink/reveal effect below swap the view away — long enough
      // to actually register as "done", short enough not to feel laggy.
      setTimeout(() => {
        if (!cancelled) setHoldingAtComplete(false);
      }, 380);
    });

    return () => {
      cancelled = true;
    };
  }, [rawScanStage, progressBarAnim]);

  // Linear progress 0→1 over TOTAL_SCAN_DURATION → commit + shrink at 100%.
  useEffect(() => {
    if (scanStage !== "scanning") {
      progressAnimRef.current?.stop?.();
      progressAnimRef.current = null;
      if (scanStage !== "completed") {
        progressBarAnim.setValue(0);
        setProgressPct(0);
        setCurrentStepIdx(0);
        shrinkStartedRef.current = false;
      }
      return undefined;
    }

    // Confirmed real regression, caught while testing the fill/hold fix
    // above: this effect also depends on endScanChoreography, whose
    // identity from context changes as a side effect of committing the
    // scanned ingredients — which fires DURING the post-completion hold
    // (scanStage still reads "scanning" on purpose, see holdingAtComplete
    // above). Without this guard, that spurious re-run wiped
    // progressBarAnim back to 0 and restarted the whole 3.2s phase1 climb
    // from scratch, so the bar visibly dropped from 100% down to ~3%
    // before the completed view took over — worse than the original bug.
    // completionHandledRef is only ever true once real completion has
    // already been handled, so this can't block a genuine new scan (Effect
    // above resets it to false the moment a fresh scan starts).
    if (completionHandledRef.current) return undefined;

    photoHeightAnim.setValue(scanHeight);
    shrinkStartedRef.current = false;
    setCurrentStepIdx(0);
    setProgressPct(0);
    progressBarAnim.setValue(0);

    const listenerId = progressBarAnim.addListener(({ value }) => {
      setProgressPct(Math.min(100, Math.round(value * 100)));
    });

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
      toValue: 0.92,
      duration: TOTAL_SCAN_DURATION,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    progressAnimRef.current = phase1Anim;

    phase1Anim.start(({ finished }) => {
      if (!finished) return;
      setCurrentStepIdx(SCAN_STEPS.length - 1);
      endScanChoreography();
      const stopCreep = startAsymptoticCreep(progressBarAnim, { from: 0.92 });
      progressAnimRef.current = { stop: stopCreep };
    });

    const stepDuration = TOTAL_SCAN_DURATION / SCAN_STEPS.length;
    const stepInterval = setInterval(() => {
      setCurrentStepIdx((prev) =>
        prev < SCAN_STEPS.length - 1 ? prev + 1 : prev
      );
    }, stepDuration);

    return () => {
      clearInterval(stepInterval);
      progressBarAnim.removeListener(listenerId);
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

      Animated.timing(photoHeightAnim, {
        toValue: scanHeight,
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

      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(badgePulse, {
            toValue: 0.7,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(badgePulse, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();

      return () => {
        pulseLoop.stop();
      };
    }

    if (!shrinkStartedRef.current) {
      shrinkStartedRef.current = true;
      // The fill-to-100% itself now happens earlier, in the effect above
      // keyed on rawScanStage — by the time this branch runs, holdingAtComplete
      // has already flipped back to false specifically because that fill +
      // visible hold finished, so progressBarAnim/progressPct are already at
      // their real 100% here. Shrink and reveal together — the earlier
      // "minimizes but still
      // loading" bug was the fixed-timer premature trigger (fixed above by
      // gating this whole block on real completion), not the overlap
      // between these two animations. Waiting for the shrink to finish
      // before starting the reveal made the transition read as two steps
      // with a dead gap in between instead of one smooth motion.
      Animated.timing(photoHeightAnim, {
        toValue: COMPACT_HEIGHT,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();

      Animated.parallel([
        Animated.spring(ingredientsOpacity, {
          toValue: 1,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.spring(ingredientsTranslate, {
          toValue: 0,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [
    scanStage,
    scanHeight,
    photoHeightAnim,
    ingredientsOpacity,
    ingredientsTranslate,
    badgePulse,
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
      console.warn("[Cook AI] Failed to open camera:", err?.message);
      showToast?.(t("errors.openCameraFailed"), "error");
    }
  };

  const beginInstantScan = async (uri, source) => {
    if (!uri) return;
    photoHeightAnim.setValue(scanHeight);
    try {
      await completeScan?.(uri, source);
    } catch (err) {
      console.warn("[Cook AI] Instant scan failed:", err?.message);
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
      console.warn("[Cook AI] Failed to capture photo:", err?.message);
      setCameraOpen(false);
      showToast?.(t("errors.capturePhotoFailed"), "error");
    }
  };

  const handlePickFromGallery = async () => {
    if (!canScanFridge) {
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
      console.warn(
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
      <View style={{ marginHorizontal: 16, marginTop: 8, marginBottom: 8 }}>
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
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  backgroundColor: "#064E3B",
                  borderWidth: 1,
                  borderColor: "#065F46",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                  shadowColor: "#059669",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.18,
                  shadowRadius: 6,
                  elevation: 3,
                }}
              >
                <Camera size={26} color="#34D399" />
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
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  marginBottom: 14,
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
                    width: 64,
                    height: 64,
                    borderRadius: 20,
                    overflow: "hidden",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Camera size={26} color="#059669" />
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
              <TouchableOpacity
                onPress={handleOpenCamera}
                activeOpacity={0.9}
                style={{
                  flex: 1.15,
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

              <TouchableOpacity
                onPress={handlePickFromGallery}
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

              {/* 60fps Reanimated laser — UI thread, never blocks Gemini */}
              <ScanLaserOverlay
                active={scanStage === "scanning"}
                travelDistance={Math.max(scanHeight - 32, 80)}
              />

              {scanStage === "scanning" && (
                <Animated.View
                  style={{
                    position: "absolute",
                    top: 16,
                    left: 14,
                    right: 54,
                    opacity: badgePulse,
                    zIndex: 20,
                    backgroundColor: "rgba(15, 23, 42, 0.85)",
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 9999,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.2)",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <RefreshCw size={13} color="#34D399" />
                  <Text
                    numberOfLines={1}
                    style={{
                      color: "#FFFFFF",
                      fontSize: 12,
                      fontWeight: "800",
                      marginLeft: 8,
                      letterSpacing: 0.3,
                      flexShrink: 1,
                    }}
                  >
                    {t("scanner.scanningLabel")}
                  </Text>
                </Animated.View>
              )}

              {scanStage === "completed" && hasFood ? (
                // This count is the actual proof the scan worked — the most
                // important confirmation on this screen — so it gets a
                // solid brand-green badge with real weight, not a quiet
                // translucent chip that reads the same as any other label.
                <View
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
                </View>
              ) : null}

              {scanStage === "completed" ? (
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
                  }}
                >
                  <Text
                    style={{
                      color: "#0F172A",
                      fontSize: 11,
                      fontWeight: "800",
                      letterSpacing: 0.2,
                    }}
                  >
                    {t("scanner.scanMore")}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <PerfectCloseButton
                isFullScreen={false}
                corner={scanStage === "completed" ? "left" : "right"}
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
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 12,
                          backgroundColor: isDark ? "#064E3B" : "#ECFDF5",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 8,
                        }}
                      >
                        <Zap size={18} color="#059669" />
                      </View>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontWeight: "800",
                          fontSize: 14,
                        }}
                      >
                        {t("scanner.visionRadarTitle")}
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: isDark ? "#064E3B" : "#D1FAE5",
                        paddingHorizontal: 10,
                        paddingVertical: 3,
                        borderRadius: 999,
                      }}
                    >
                      <Text
                        style={{
                          color: isDark ? "#34D399" : "#065F46",
                          fontSize: 10,
                          fontWeight: "900",
                        }}
                      >
                        {t("scanner.activeScan")}
                      </Text>
                    </View>
                  </View>

                  <Animated.View
                    style={{
                      backgroundColor: colors.inputBg,
                      borderRadius: 16,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: colors.cardBorder,
                      flexDirection: "row",
                      alignItems: "center",
                      opacity: stepOpacity,
                      transform: [{ translateY: stepTranslate }],
                    }}
                  >
                    <Text style={{ fontSize: 22, marginRight: 12 }}>
                      {SCAN_STEPS[currentStepIdx].icon}
                    </Text>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontWeight: "800",
                        fontSize: 12,
                        flex: 1,
                      }}
                    >
                      {scanningLabel ||
                        t(SCAN_STEPS[currentStepIdx].textKey) ||
                        t("scanner.analyzingLabel")}
                    </Text>
                  </Animated.View>

                  <View style={{ gap: 6 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingHorizontal: 2,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontSize: 10,
                          fontWeight: "700",
                        }}
                      >
                        {t("scanner.scanProgress")}
                      </Text>
                      <Text
                        style={{
                          color: "#059669",
                          fontSize: 12,
                          fontWeight: "900",
                        }}
                      >
                        {progressPct}%
                      </Text>
                    </View>
                    <View
                      style={{
                        width: "100%",
                        backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                        height: 10,
                        borderRadius: 999,
                        overflow: "hidden",
                      }}
                    >
                      <Animated.View
                        style={{
                          height: "100%",
                          borderRadius: 999,
                          backgroundColor: "#10B981",
                          width: progressBarAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ["0%", "100%"],
                          }),
                        }}
                      />
                    </View>
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
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 13,
                      fontWeight: "600",
                      textAlign: "center",
                      paddingVertical: 16,
                    }}
                  >
                    {t("scanner.noItemsDetected")}
                  </Text>
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
                            fontWeight: "800",
                            fontSize: 16,
                            letterSpacing: -0.2,
                          }}
                        >
                          {t("scanner.detectedIngredients")}
                        </Text>
                        <View
                          style={{
                            backgroundColor: isDark ? "#064E3B" : "#D1FAE5",
                            paddingHorizontal: 10,
                            paddingVertical: 2,
                            borderRadius: 999,
                            marginLeft: 8,
                          }}
                        >
                          <Text
                            style={{
                              color: isDark ? "#34D399" : "#065F46",
                              fontSize: 12,
                              fontWeight: "900",
                            }}
                          >
                            {foodCount}
                          </Text>
                        </View>
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
                      </View>
                    )}

                    <View
                      style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                    >
                      {(ingredients || []).map((item) => {
                        const cleanName =
                          stripInlineEmojis(item?.name) ||
                          String(item?.name || "").trim() ||
                          "Item";
                        // Vision already returns an accurate, language-independent
                        // emoji per item (see MASTER_VISION_SYSTEM_PROMPT) — prefer
                        // that over the local English-keyword guesser, which can't
                        // match a name that's now in the user's selected language
                        // and was silently falling back to a generic jar icon for
                        // every item once names stopped being English.
                        const aiIcon =
                          (typeof item?.icon === "string" && item.icon.trim()) ||
                          (typeof item?.emoji === "string" && item.emoji.trim());
                        const style = getIngredientStyle(cleanName);
                        return (
                          <PillTag
                            key={item.id}
                            emoji={aiIcon || style.emoji || "🛒"}
                            label={cleanName}
                            onRemove={() => removeIngredient(item.id)}
                            style={getDetectedPillStyle(isDark, colors)}
                            labelStyle={{
                              color: isDark ? colors.textPrimary : "#1E293B",
                            }}
                          />
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
