import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  Animated,
  Easing,
  Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Camera, Image as ImageIcon, Plus, CheckCircle2 } from "lucide-react-native";
import { useCookAI } from "../context/CookAIContext";
import { useModalState } from "../context/ModalContext";
import { useTheme } from "../context/ThemeContext";
import {
  TOTAL_SCAN_DURATION,
  PANTRY_SCAN_STEPS,
} from "../constants/scanChoreography";
import { startAsymptoticCreep } from "../utils/scanProgressCreep";
import { translateCount } from "../i18n";
import PerfectCloseButton from "./PerfectCloseButton";
import ScanLaserOverlay from "./ScanLaserOverlay";
import PantryScanMoreSheet from "./PantryScanMoreSheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScanCompleteSound } from "../hooks/useScanCompleteSound";

/** Compact height for the captured photo once a scan finishes. */
const COMPACT_HEIGHT = 130;
// Was 220 — a flat, cramped square next to FridgeScannerHero's up-to-420
// hero photo. Not matching that full height on purpose (Pantry has a real
// In Stock / Out of Stock list right below that people need to reach
// quickly, so burying it under a near-full-screen photo would trade one
// complaint for another) — but 220 read as visibly smaller/lesser than
// fridge's treatment for no functional reason. 300 splits the difference:
// a noticeably fuller, more confident card without pushing the list far.
const SCAN_HEIGHT = 300;

function resolveScanStage(hasScanned, isScanning) {
  if (!hasScanned) return "idle";
  if (isScanning) return "scanning";
  return "completed";
}

/**
 * Pantry's own version of FridgeScannerHero's scan choreography — a
 * first-time tester found Pantry scanning noticeably plainer than Fridge's
 * (just a button swapping to a spinner, no photo, no progress, no sense of
 * what the AI was doing). This gives Pantry the same photo-capture +
 * laser-sweep + step-by-step "Vision Radar" + progress-bar treatment.
 *
 * Deliberately narrower in scope than FridgeScannerHero, though: it does
 * NOT also render a "Detected Ingredients" pill list after the scan, the
 * way Fridge does — Fridge's pills ARE its whole inventory (nothing else
 * shows the fridge's contents), but Pantry already has its own persistent,
 * categorized In Stock / Out of Stock list right below this component.
 * Duplicating a second ingredient list inside the hero would just be
 * redundant with what PantryTab already renders from the same
 * pantryItems state.
 *
 * Confirmed real failure, reported directly by a user: the scanned photo
 * (in progress OR just-completed) disappeared the instant they left the
 * Pantry tab and came back. Root cause: pantryPhoto/scanning state used to
 * live as this component's OWN useState — the app switches tabs via a
 * plain conditional render (see MainContent in App.jsx), not a persistent
 * navigator, so leaving the tab unmounts this whole component and wipes
 * that state. The actual scan result was never lost (mergePantryScanResults
 * writes straight into pantryItems, a context-level list, independent of
 * this component's lifecycle) — only the "here's what just happened" photo
 * summary was. Fixed by moving pantryPhoto/isPantryScanning into
 * CookAIContext (completePantryScan/endPantryScanChoreography/
 * resetPantryPhoto), mirroring fridge's identical architecture exactly,
 * holdingAtComplete fix included — see FridgeScannerHero's own comments on
 * that for the full reasoning, since it applies here unchanged.
 */
export default function PantryScannerHero({ onManualAdd }) {
  const {
    pantryItems,
    isPantryScanning,
    hasPantryScanned,
    pantryPhoto,
    pantryCameraOpen,
    setPantryCameraOpen,
    completePantryScan,
    endPantryScanChoreography,
    resetPantryPhoto,
    showToast,
    t,
    recipeLanguageId,
  } = useCookAI();
  const { setPantryScanOpen } = useModalState();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const shutterBottom = Math.max(insets.bottom + 28, 40);
  const scanMoreButtonRef = useRef(null);
  const [scanMoreAnchor, setScanMoreAnchor] = useState(null);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  // See holdingAtComplete in FridgeScannerHero for the full reasoning —
  // identical fix, identical failure, applied here.
  const rawScanStage = resolveScanStage(hasPantryScanned, isPantryScanning);
  const [holdingAtComplete, setHoldingAtComplete] = useState(false);
  const completionHandledRef = useRef(false);
  const scanStage = holdingAtComplete ? "scanning" : rawScanStage;
  // Confirmed real failure, caught while testing the persistence fix
  // itself: leaving the Pantry tab AFTER a scan finished, then coming
  // back, remounts this component fresh — completionHandledRef and
  // holdingAtComplete both reset to their initial values, so the effect
  // below saw an already-"completed" rawScanStage and (wrongly) replayed
  // the whole fill+hold+reveal choreography as if it had just finished:
  // the completed photo/badge briefly vanished, the card re-grew, and the
  // laser overlay's scanning veil flashed back over the photo, before it
  // settled back to "completed" a moment later. Captured once (useRef's
  // initializer only runs on first render) so the effect can tell "the
  // scan finished during THIS mount, play the reveal" apart from "we
  // mounted straight into an already-finished scan, just show it".
  const mountedAlreadyCompleteRef = useRef(rawScanStage === "completed");
  const playScanCompleteSound = useScanCompleteSound();

  const itemCount = Array.isArray(pantryItems) ? pantryItems.length : 0;

  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [progressPct, setProgressPct] = useState(0);

  const photoHeightAnim = useRef(new Animated.Value(COMPACT_HEIGHT)).current;
  const badgePulse = useRef(new Animated.Value(1)).current;
  const radarOpacity = useRef(new Animated.Value(0)).current;
  const radarTranslate = useRef(new Animated.Value(16)).current;
  const stepOpacity = useRef(new Animated.Value(1)).current;
  const stepTranslate = useRef(new Animated.Value(0)).current;
  const progressBarAnim = useRef(new Animated.Value(0)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const badgeTranslate = useRef(new Animated.Value(18)).current;
  const progressAnimRef = useRef(null);
  const shrinkStartedRef = useRef(false);

  // Drives the real fill-to-100% + a brief visible hold, keyed off the RAW
  // (unheld) stage so it fires exactly once on true completion — see
  // FridgeScannerHero's identical effect for the full reasoning.
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
      setCurrentStepIdx(PANTRY_SCAN_STEPS.length - 1);
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
      setCurrentStepIdx(PANTRY_SCAN_STEPS.length - 1);
      // Same audio cue as FridgeScannerHero's identical spot, same
      // reasoning — see its comment there for the full history.
      playScanCompleteSound();
      setTimeout(() => {
        if (!cancelled) setHoldingAtComplete(false);
      }, 380);
    });

    return () => {
      cancelled = true;
    };
  }, [rawScanStage, progressBarAnim, playScanCompleteSound]);

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

    // Guards against the exact regression caught (and fixed) in
    // FridgeScannerHero: endPantryScanChoreography's identity can change as
    // a side effect of committing the scan, which would otherwise re-fire
    // this whole setup during the post-completion hold and reset the bar
    // back to 0 mid-hold. completionHandledRef is only true once real
    // completion has already been handled, so a genuine new scan (which
    // resets it to false in the effect above) is never blocked by this.
    if (completionHandledRef.current) return undefined;

    photoHeightAnim.setValue(SCAN_HEIGHT);
    shrinkStartedRef.current = false;
    setCurrentStepIdx(0);
    setProgressPct(0);
    progressBarAnim.setValue(0);

    const listenerId = progressBarAnim.addListener(({ value }) => {
      setProgressPct(Math.min(100, Math.round(value * 100)));
    });

    // Two-phase, never-lies-about-100% approach — same reasoning as
    // FridgeScannerHero's identical fix (see its own comment for the full
    // history). Phase 1 keeps the original TOTAL_SCAN_DURATION pacing,
    // capped at 92% instead of running all the way to a literal 100% that
    // may not be true yet. Phase 2 (startAsymptoticCreep) keeps the bar
    // creeping slowly toward 99% for as long as it actually takes —
    // continuously moving, never frozen — until the real response lands.
    const phase1Anim = Animated.timing(progressBarAnim, {
      toValue: 0.92,
      duration: TOTAL_SCAN_DURATION,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    progressAnimRef.current = phase1Anim;

    phase1Anim.start(({ finished }) => {
      if (!finished) return;
      setCurrentStepIdx(PANTRY_SCAN_STEPS.length - 1);
      endPantryScanChoreography();
      const stopCreep = startAsymptoticCreep(progressBarAnim, { from: 0.92 });
      progressAnimRef.current = { stop: stopCreep };
    });

    const stepDuration = TOTAL_SCAN_DURATION / PANTRY_SCAN_STEPS.length;
    const stepInterval = setInterval(() => {
      setCurrentStepIdx((prev) =>
        prev < PANTRY_SCAN_STEPS.length - 1 ? prev + 1 : prev
      );
    }, stepDuration);

    return () => {
      clearInterval(stepInterval);
      progressBarAnim.removeListener(listenerId);
      progressAnimRef.current?.stop?.();
      progressAnimRef.current = null;
    };
  }, [scanStage, progressBarAnim, photoHeightAnim, endPantryScanChoreography]);

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
      badgeOpacity.setValue(0);
      badgeTranslate.setValue(18);
      radarOpacity.setValue(0);
      radarTranslate.setValue(16);
      return undefined;
    }

    if (scanStage === "scanning") {
      badgeOpacity.setValue(0);
      badgeTranslate.setValue(18);

      Animated.timing(photoHeightAnim, {
        toValue: SCAN_HEIGHT,
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
      // The fill-to-100% itself already happened in the effect above,
      // keyed on rawScanStage — by the time this branch runs,
      // holdingAtComplete has already flipped back to false specifically
      // because that fill + visible hold finished. Shrink and reveal
      // together for one smooth motion instead of two steps with a dead
      // gap in between.
      Animated.timing(photoHeightAnim, {
        toValue: COMPACT_HEIGHT,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();

      Animated.parallel([
        Animated.spring(badgeOpacity, {
          toValue: 1,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.spring(badgeTranslate, {
          toValue: 0,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();
    }
    return undefined;
  }, [
    scanStage,
    photoHeightAnim,
    badgeOpacity,
    badgeTranslate,
    radarOpacity,
    radarTranslate,
    badgePulse,
  ]);

  const handleScanMore = () => {
    if (isPantryScanning) return;
    scanMoreButtonRef.current?.measureInWindow((x, y, width, height) => {
      setScanMoreAnchor({ x, y, width, height });
      setPantryScanOpen?.(true);
    });
  };

  const handleOpenCamera = async () => {
    try {
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          showToast?.(t("errors.pantryCameraPermission"), "error");
          return;
        }
      }
      setPantryCameraOpen(true);
    } catch {
      showToast?.(t("errors.openCameraFailed"), "error");
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      setPantryCameraOpen(false);
      await completePantryScan(photo?.uri, "camera");
    } catch {
      setPantryCameraOpen(false);
      showToast?.(t("errors.capturePhotoFailed"), "error");
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        showToast?.(t("errors.galleryPermission"), "error");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        await completePantryScan(result.assets[0].uri, "gallery");
      }
    } catch {
      showToast?.(t("errors.loadPhotoFailed"), "error");
    }
  };

  return (
    <>
      {scanStage === "idle" ? (
        <View style={{ flexDirection: "row", marginBottom: 16, gap: 8 }}>
          <TouchableOpacity
            onPress={handleOpenCamera}
            activeOpacity={0.85}
            style={{
              flex: 1.3,
              height: 46,
              // Matches FridgeScannerHero's "Take Photo" button — same
              // primary scan action, was the old dark-navy+amber pairing
              // left over from before that redesign shipped.
              backgroundColor: "#059669",
              paddingHorizontal: 14,
              borderRadius: 13,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Camera size={16} color="#FFFFFF" />
            <Text
              style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "600", marginLeft: 8 }}
              numberOfLines={1}
            >
              {t("pantry.scanPantry")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handlePickFromGallery}
            activeOpacity={0.85}
            style={{
              width: 46,
              height: 46,
              backgroundColor: colors.card,
              borderRadius: 13,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1.5,
              borderColor: colors.cardBorder,
            }}
            accessibilityLabel={t("a11y.pickPantryPhoto")}
          >
            <ImageIcon size={18} color="#059669" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onManualAdd}
            activeOpacity={0.85}
            style={{
              flex: 0.85,
              height: 46,
              backgroundColor: isDark ? "#064E3B" : "#ECFDF5",
              paddingHorizontal: 12,
              borderRadius: 13,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1.5,
              borderColor: isDark ? "#059669" : "#D1FAE5",
            }}
            accessibilityLabel={t("a11y.addPantryStaple")}
          >
            <Plus size={18} color={isDark ? "#34D399" : "#059669"} strokeWidth={2.5} />
            <Text
              style={{ color: isDark ? "#34D399" : "#059669", fontSize: 14, fontWeight: "800", marginLeft: 5 }}
              numberOfLines={1}
            >
              {t("scanner.add")}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ marginBottom: 16 }}>
          <Animated.View
            style={[
              {
                height: photoHeightAnim,
                borderRadius: 22,
                overflow: "hidden",
                backgroundColor: "#1E293B",
                position: "relative",
              },
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
            <Image
              source={{ uri: pantryPhoto }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />

            <ScanLaserOverlay
              active={scanStage === "scanning"}
              travelDistance={Math.max(SCAN_HEIGHT - 32, 80)}
            />

            {scanStage === "completed" ? (
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
                  maxWidth: "70%",
                  opacity: badgeOpacity,
                  transform: [{ translateY: badgeTranslate }],
                }}
              >
                <CheckCircle2 size={12} color="#FFFFFF" />
                <Text
                  style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700", marginLeft: 5 }}
                  numberOfLines={1}
                >
                  {itemCount === 1
                    ? t("scanner.itemsFoundOne", { count: itemCount })
                    : translateCount(recipeLanguageId, itemCount, {
                        few: "scanner.itemsFoundFew",
                        many: "scanner.itemsFoundMany",
                        fallback: "scanner.itemsFoundOther",
                      })}
                </Text>
              </Animated.View>
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

            {scanStage === "completed" ? (
              <PerfectCloseButton
                isFullScreen={false}
                corner="left"
                onPress={resetPantryPhoto}
                accessibilityLabel={t("a11y.dismissPantryPhoto")}
              />
            ) : null}
          </Animated.View>

          {scanStage === "scanning" && (
            <Animated.View
              style={{
                marginTop: 12,
                opacity: radarOpacity,
                transform: [{ translateY: radarTranslate }],
              }}
            >
              <View
                style={{
                  gap: 12,
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                  borderWidth: 1,
                  borderRadius: 20,
                  padding: 14,
                }}
              >
                <Animated.View
                  style={{
                    backgroundColor: colors.inputBg,
                    borderRadius: 14,
                    padding: 11,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    flexDirection: "row",
                    alignItems: "center",
                    opacity: stepOpacity,
                    transform: [{ translateY: stepTranslate }],
                  }}
                >
                  <Text style={{ fontSize: 20, marginRight: 11 }}>
                    {PANTRY_SCAN_STEPS[currentStepIdx].icon}
                  </Text>
                  <Text
                    style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 12, flex: 1 }}
                  >
                    {t(PANTRY_SCAN_STEPS[currentStepIdx].textKey) || t("pantry.analyzingLabel")}
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
                    <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: "700" }}>
                      {t("scanner.scanProgress")}
                    </Text>
                    <Text style={{ color: "#059669", fontSize: 12, fontWeight: "900" }}>
                      {progressPct}%
                    </Text>
                  </View>
                  <View
                    style={{
                      width: "100%",
                      backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
                      height: 9,
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
        </View>
      )}

      {pantryCameraOpen ? (
        <Modal
          visible
          animationType="slide"
          statusBarTranslucent
          presentationStyle="fullScreen"
          onRequestClose={() => setPantryCameraOpen(false)}
        >
          <View style={{ flex: 1, backgroundColor: "#000000" }}>
            <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
            <PerfectCloseButton
              isFullScreen
              onPress={() => setPantryCameraOpen(false)}
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
                {t("pantry.pointAtPantry")}
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
                  style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#10B981" }}
                />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}

      <PantryScanMoreSheet anchor={scanMoreAnchor} />
    </>
  );
}
