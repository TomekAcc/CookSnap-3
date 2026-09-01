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

  const scanStage = resolveScanStage(hasScanned, isScanning);
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

    photoHeightAnim.setValue(scanHeight);
    shrinkStartedRef.current = false;
    setCurrentStepIdx(0);
    setProgressPct(0);
    progressBarAnim.setValue(0);

    const listenerId = progressBarAnim.addListener(({ value }) => {
      setProgressPct(Math.min(100, Math.round(value * 100)));
    });

    // Runs the full 0->100% at a constant rate — no cap partway through.
    // This used to stop at 92% and hold there until the real network
    // response landed, which is exactly the "freezes at 92%" a user
    // reported: real scan latency had crept up to 6-10s against this bar's
    // fixed ~3.2s fill, so it sat capped and waiting for several seconds on
    // every single scan. Now that the Vision request itself runs in ~1-2.5s
    // (disabled an unrequested "thinking" pass on the model — see
    // geminiVision.js), the real response is normally already in hand well
    // before this animation even finishes, so letting it run all the way to
    // 100% at the same rate (duration scaled up so the fill speed is
    // unchanged, just extended past where 92% used to be) means the common
    // case is a single smooth fill with no stall at all. The rare case
    // where the network is still slower than this animation is still
    // covered — see the scanStage === "completed" effect below, which
    // forces the bar to exactly 100% the instant real data actually
    // commits, however it got there.
    progressAnimRef.current = Animated.timing(progressBarAnim, {
      toValue: 1,
      duration: TOTAL_SCAN_DURATION / 0.92,
      easing: Easing.linear,
      useNativeDriver: false,
    });

    progressAnimRef.current.start(({ finished }) => {
      if (!finished) return;
      setCurrentStepIdx(SCAN_STEPS.length - 1);
      endScanChoreography();
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
      // Real completion — snap straight to 100% right as the shrink starts,
      // so there's never a visible "waiting at 100%" gap.
      progressBarAnim.setValue(1);
      setProgressPct(100);
      // Shrink and reveal together — the earlier "minimizes but still
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
                  shadowOffset: { width: 0, height: 5 },
                  shadowOpacity: 0.4,
                  shadowRadius: 8,
                  elevation: 5,
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
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  marginBottom: 14,
                  shadowColor: "#059669",
                  shadowOffset: { width: 0, height: 5 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 5,
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
