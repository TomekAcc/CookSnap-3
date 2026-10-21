import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Animated,
  Easing,
  Platform,
} from "react-native";
import { Camera, Image as ImageIcon, CheckCircle2 } from "../icons";
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
import PrivacyNote from "./PrivacyNote";
import ScanMoreSheet from "./scanner/ScanMoreSheet";
import ScanCameraModal from "./scanner/ScanCameraModal";
import { useScanCapture } from "./scanner/useScanCapture";
import { useInventory } from "../context/InventoryContext";
import { useLanguage } from "../context/LanguageContext";
import { useScan } from "../context/ScanContext";

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
 * ScanContext (completePantryScan/endPantryScanChoreography/
 * resetPantryPhoto), mirroring fridge's identical architecture exactly,
 * holdingAtComplete fix included — see FridgeScannerHero's own comments on
 * that for the full reasoning, since it applies here unchanged.
 */
export default function PantryScannerHero() {
  const { pantryItems } = useInventory();
  const {
    isPantryScanning,
    hasPantryScanned,
    pantryPhoto,
    completePantryScan,
    endPantryScanChoreography,
    resetPantryPhoto,
  } = useScan();
  const { t, recipeLanguageId } = useLanguage();
  const { setPantryScanOpen } = useModalState();
  const { colors, isDark } = useTheme();
  const scanMoreButtonRef = useRef(null);
  const [scanMoreAnchor, setScanMoreAnchor] = useState(null);

  // See holdingAtComplete in FridgeScannerHero for the full reasoning —
  // identical fix, identical failure, applied here.
  const rawScanStage = resolveScanStage(hasPantryScanned, isPantryScanning);
  const [holdingAtComplete, setHoldingAtComplete] = useState(false);
  const completionHandledRef = useRef(false);
  // Confirmed real failure, caught via live instrumentation: the OLD code
  // called setHoldingAtComplete(true) from inside the useEffect below, in
  // response to rawScanStage becoming "completed". That leaves exactly one
  // render in between — rawScanStage has already flipped, but
  // holdingAtComplete's effect-driven update hasn't landed yet — where
  // `scanStage` (derived from both) reads "completed" a full hold-duration
  // too early. That one stray render was enough for the shrink/reveal
  // effect further down to fire its completion branch prematurely (marking
  // shrinkStartedRef "started" and kicking off the badge/button reveal
  // spring), only for the VERY NEXT render — once holdingAtComplete's real
  // update landed — to revert scanStage back to "scanning" and hard-reset
  // those same Animated.Values via the scanning branch, interrupting the
  // spring mid-flight. Because shrinkStartedRef was already consumed, the
  // real completion 500ms later never restarted it, leaving the badge
  // permanently stuck invisible — confirmed via a direct trace showing the
  // spring's own callback reporting `finished: false` at ~0.1% progress.
  //
  // Fixed with React's documented "adjust state during render" pattern:
  // comparing against the previous rawScanStage and calling
  // setHoldingAtComplete synchronously in the render body (not inside an
  // effect) folds the correction into the SAME commit, so scanStage can
  // never be derived as "completed" early — the flicker, and the stuck
  // animation it caused, can't happen.
  const prevRawScanStageRef = useRef(rawScanStage);
  if (prevRawScanStageRef.current !== rawScanStage) {
    prevRawScanStageRef.current = rawScanStage;
    if (rawScanStage === "completed" && !holdingAtComplete) {
      setHoldingAtComplete(true);
    }
  }
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

    // holdingAtComplete is already true by now — set synchronously during
    // render (see the comment above prevRawScanStageRef) the instant
    // rawScanStage became "completed", not here. This effect only owns the
    // actual fill animation + hold timer + eventual release.
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
      // Bumped twice now — see the identical change (and its reasoning)
      // in FridgeScannerHero's own hold timer.
      setTimeout(() => {
        if (!cancelled) setHoldingAtComplete(false);
      }, 650);
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
      // Duration + spring softness bumped again — see the identical change
      // (and its reasoning) in FridgeScannerHero's own shrink/reveal block.
      Animated.timing(photoHeightAnim, {
        toValue: COMPACT_HEIGHT,
        duration: 600,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }).start();

      Animated.parallel([
        Animated.spring(badgeOpacity, {
          toValue: 1,
          friction: 10,
          tension: 30,
          useNativeDriver: true,
        }),
        Animated.spring(badgeTranslate, {
          toValue: 0,
          friction: 10,
          tension: 30,
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

  const { camera, openCamera: handleOpenCamera, pickFromGallery: handlePickFromGallery } =
    useScanCapture("pantry", (uri, source) => completePantryScan(uri, source));

  return (
    <>
      {scanStage === "idle" ? (
        <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            onPress={handleOpenCamera}
            activeOpacity={0.85}
            style={{
              flex: 1,
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

          {/* Same pair as the Scanner tab's "Take photo" / "From gallery": two
              labelled buttons of equal weight class (one filled, one outlined)
              instead of a lone unlabeled gallery icon. Manual "+ Add" moved
              next to the search field, where it acts on the list. */}
          <TouchableOpacity
            onPress={handlePickFromGallery}
            activeOpacity={0.85}
            style={{
              flex: 1,
              height: 46,
              backgroundColor: isDark ? colors.card : "#FFFFFF",
              borderRadius: 13,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: isDark ? colors.cardBorder : "#E2E8F0",
            }}
            accessibilityLabel={t("a11y.pickPantryPhoto")}
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
        {(pantryItems || []).length === 0 ? <PrivacyNote style={{ marginTop: 10 }} /> : null}
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
                  // Same fade/rise as the "X items found" badge above it —
                  // it already uses badgeOpacity/badgeTranslate, but this
                  // button and the close button below were still plain,
                  // un-animated elements that snapped into existence on the
                  // exact frame the scan completed, while the badge right
                  // next to them was fading in smoothly — a mismatch that
                  // read as the whole completion moment feeling instant.
                  // Only rendered when scanStage === "completed" (never
                  // during "scanning"), so reusing badgeOpacity here can't
                  // hide it at a time it's supposed to be visible.
                  opacity: badgeOpacity,
                  transform: [{ translateY: badgeTranslate }],
                }}
              >
                <Text
                  style={{
                    color: "#0F172A",
                    fontSize: 11,
                    fontWeight: "700",
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
                // Same reasoning as the Scan More button just above — only
                // rendered in the "completed" branch, so this can't hide it
                // during scanning.
                style={{ opacity: badgeOpacity, transform: [{ translateY: badgeTranslate }] }}
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
                    style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 12, flex: 1 }}
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
                    <Text style={{ color: "#059669", fontSize: 12, fontWeight: "700" }}>
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

      <ScanCameraModal {...camera} hint={t("pantry.pointAtPantry")} />

      <ScanMoreSheet kind="pantry" anchor={scanMoreAnchor} />
    </>
  );
}
