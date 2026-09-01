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
import { useTheme } from "../context/ThemeContext";
import {
  TOTAL_SCAN_DURATION,
  PANTRY_SCAN_STEPS,
} from "../constants/scanChoreography";
import { startAsymptoticCreep } from "../utils/scanProgressCreep";
import { translateCount } from "../i18n";
import PerfectCloseButton from "./PerfectCloseButton";
import ScanLaserOverlay from "./ScanLaserOverlay";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Compact height for the captured photo once a scan finishes. */
const COMPACT_HEIGHT = 130;
const SCAN_HEIGHT = 220;

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
 * scanPantryPhoto() result.
 *
 * The real-time-vs-fixed-duration race that FridgeScannerHero solves with
 * a ref + polling interval (see endScanChoreography in CookAIContext) is
 * solved here with a simpler, self-contained Promise.all: the progress
 * animation and the real scanPantryPhoto() network call both run at once,
 * and "completed" only fires once both are done — never before the bar's
 * minimum choreography time, and never before real data is back. The bar
 * itself is two-phase (see beginScan below) so it also never sits showing
 * a literal 100% while genuinely still waiting on a slower response.
 */
export default function PantryScannerHero({ onManualAdd }) {
  const { scanPantryPhoto, showToast, t, recipeLanguageId } = useCookAI();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const shutterBottom = Math.max(insets.bottom + 28, 40);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const [scanStage, setScanStage] = useState("idle"); // idle | scanning | completed
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pantryPhoto, setPantryPhoto] = useState(null);
  const [detectedCount, setDetectedCount] = useState(0);
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

  useEffect(() => {
    if (scanStage !== "scanning") return undefined;
    const stepDuration = TOTAL_SCAN_DURATION / PANTRY_SCAN_STEPS.length;
    const stepInterval = setInterval(() => {
      setCurrentStepIdx((prev) =>
        prev < PANTRY_SCAN_STEPS.length - 1 ? prev + 1 : prev
      );
    }, stepDuration);

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
      clearInterval(stepInterval);
      pulseLoop.stop();
    };
  }, [scanStage, badgePulse]);

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

  const beginScan = async (uri) => {
    if (!uri) return;
    setPantryPhoto(uri);
    setScanStage("scanning");
    setCurrentStepIdx(0);
    setProgressPct(0);
    progressBarAnim.setValue(0);
    photoHeightAnim.setValue(SCAN_HEIGHT);
    radarOpacity.setValue(0);
    radarTranslate.setValue(16);
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

    const listenerId = progressBarAnim.addListener(({ value }) => {
      setProgressPct(Math.min(100, Math.round(value * 100)));
    });

    // Two-phase, never-lies-about-100% approach — same reasoning as
    // FridgeScannerHero's identical fix (see its own comment for the full
    // history). Phase 1 keeps the original TOTAL_SCAN_DURATION pacing
    // exactly as before, just capped at 92% instead of running all the way
    // to a literal 100% that may not be true yet. If scanPantryPhoto() is
    // already done by then, Promise.all resolves immediately after and the
    // 100%/reveal below fires in the same tick — a fast scan looks
    // identical to before. If it's still in flight, phase 2 keeps the bar
    // creeping slowly from 92% toward 99% for as long as it actually takes
    // — continuously moving, never frozen, never dishonestly full — until
    // the real response lands and this whole function proceeds to snap it
    // to the genuine 100% below.
    //
    // Phase 2 originally used ANOTHER fixed-duration Animated.timing
    // (0.92→0.99 over a flat 8000ms) — which just stopped moving once
    // those 8 seconds elapsed if the real scan wasn't done yet. That's the
    // exact "it still stops" a user reported after the first fix: a fixed
    // duration is a deadline, and a deadline is always eventually wrong
    // for a variable network call. startAsymptoticCreep drives the value
    // off Date.now() instead — no deadline to run out, so it keeps
    // creeping for as long as the real scan actually takes.
    let stopCreep = null;
    const animationDone = new Promise((resolve) => {
      Animated.timing(progressBarAnim, {
        toValue: 0.92,
        duration: TOTAL_SCAN_DURATION,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) {
          stopCreep = startAsymptoticCreep(progressBarAnim, { from: 0.92 });
        }
        resolve();
      });
    });

    let detected = [];
    try {
      const [, result] = await Promise.all([
        animationDone,
        scanPantryPhoto(uri),
      ]);
      detected = Array.isArray(result) ? result : [];
    } catch (err) {
      console.warn("[Cook AI] Pantry scan choreography failed:", err?.message);
    } finally {
      stopCreep?.();
      progressBarAnim.removeListener(listenerId);
    }

    progressBarAnim.setValue(1);
    setProgressPct(100);
    setDetectedCount(detected.length);
    setCurrentStepIdx(PANTRY_SCAN_STEPS.length - 1);

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

    setScanStage("completed");
  };

  const startScanAgain = () => {
    setScanStage("idle");
    setPantryPhoto(null);
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
      setCameraOpen(true);
    } catch {
      showToast?.(t("errors.openCameraFailed"), "error");
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      setCameraOpen(false);
      await beginScan(photo?.uri);
    } catch {
      setCameraOpen(false);
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
        await beginScan(result.assets[0].uri);
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
                  {detectedCount === 1
                    ? t("scanner.itemsFoundOne", { count: detectedCount })
                    : translateCount(recipeLanguageId, detectedCount, {
                        few: "scanner.itemsFoundFew",
                        many: "scanner.itemsFoundMany",
                        fallback: "scanner.itemsFoundOther",
                      })}
                </Text>
              </Animated.View>
            ) : null}

            {scanStage === "completed" ? (
              <PerfectCloseButton
                isFullScreen={false}
                corner="right"
                onPress={startScanAgain}
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
    </>
  );
}
