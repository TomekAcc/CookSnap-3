import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, Image as ImageIcon } from "lucide-react-native";
import { useCookAI } from "../context/CookAIContext";
import { useModalState } from "../context/ModalContext";
import { useTheme } from "../context/ThemeContext";
import { EXIT_DURATION_MS } from "../utils/bottomSheet";

// launchImageLibraryAsync presents a real native iOS view controller.
// Confirmed via device logs: calling it right after this popover's own
// Modal flips to hidden makes the promise hang forever — iOS silently
// drops the presentation request because the previous Modal's dismissal
// transaction hasn't actually finished yet. InteractionManager doesn't
// track that transition at all, so it fired too early. EXIT_DURATION_MS is
// the same proven-safe gap already used elsewhere in this app for exactly
// this "wait for a native Modal to actually finish closing" handoff.
const GALLERY_HANDOFF_MS = EXIT_DURATION_MS + 40;

const SCREEN_WIDTH = Dimensions.get("window").width;
const MENU_WIDTH = 200;

/**
 * Scan More trigger — a compact floating popover anchored right under the
 * "Scan More" button, not a bottom sheet. Deliberately NOT built on
 * StandardModal: that shared sheet machinery (backdrop fade, slide-in,
 * exit-duration buffering) exists for full sheets that need time for their
 * own animation to finish before unmounting. A 2-row dropdown has nothing
 * worth animating that long, and skipping that machinery is what lets the
 * Take Photo / Gallery actions fire with zero handoff delay below.
 */
export default function ScanMoreSheet({ anchor }) {
  const { colors, isDark } = useTheme();
  const {
    prepareScanMore,
    startScanMore,
    completeScan,
    canScanFridge,
    showToast,
    t,
  } = useCookAI();
  const { scanMoreOpen, setScanMoreOpen, setProModalOpen } = useModalState();

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (scanMoreOpen) {
      opacity.setValue(0);
      scale.setValue(0.92);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 130,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 30,
          bounciness: 6,
        }),
      ]).start();
    }
  }, [scanMoreOpen]);

  const handleClose = () => setScanMoreOpen?.(false);

  // Take Photo stays instant — startScanMore() only flips React state
  // (cameraOpen=true), which mounts our own RN <Modal> via normal
  // reconciliation. That's not blocked by a still-transitioning previous
  // Modal the way a raw native module call (see handlePickGallery) is.
  // Scan More uses the exact same Vision-API scan path as the main
  // Take Photo / From Gallery buttons on the fridge photo itself, and that
  // shared completeScan() (CookAIContext) is where the free daily cap is
  // actually gated and consumed — this popover was previously a bypass of
  // it entirely (never checked at all). This is only a read-only early
  // check so a capped-out free user sees the paywall immediately instead
  // of granting camera/gallery permission first for nothing; the real
  // gate lives in completeScan, not here, so a cancelled permission
  // prompt or picker never burns an allowance.
  // Same "wait for the previous Modal to actually finish closing" handoff
  // documented above for the gallery picker — a bare setProModalOpen(true)
  // right after setScanMoreOpen(false) tried to mount a second native
  // Modal (ProSubscriptionModal) in the same tick this popover's own Modal
  // was still mid-dismissal, which froze the app on-device the exact same
  // way the undelayed gallery-picker call used to.
  const openProAfterClose = () => {
    setScanMoreOpen?.(false);
    setTimeout(() => setProModalOpen?.(true), GALLERY_HANDOFF_MS);
  };

  const handleTakePhoto = () => {
    if (!canScanFridge) {
      openProAfterClose();
      return;
    }
    // Same handoff as the gallery picker below and openProAfterClose above —
    // startScanMore() sets cameraOpen=true, which mounts FridgeScannerHero's
    // own native Modal. Calling it in the same tick this popover's Modal
    // closes is the identical multi-Modal collision already fixed
    // elsewhere; this one path was missed.
    setScanMoreOpen?.(false);
    setTimeout(() => startScanMore?.(), GALLERY_HANDOFF_MS);
  };

  const handlePickGallery = () => {
    console.log("[ScanMore] From Gallery pressed");
    if (!canScanFridge) {
      openProAfterClose();
      return;
    }
    setScanMoreOpen?.(false);
    setTimeout(() => {
      console.log("[ScanMore] handoff delay elapsed, starting picker flow");
      void (async () => {
        try {
          prepareScanMore?.();
          console.log("[ScanMore] requesting media library permission...");
          const permissionResult =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
          console.log("[ScanMore] permission result:", JSON.stringify(permissionResult));
          if (!permissionResult.granted) {
            showToast?.(t("errors.galleryPermission"), "error");
            return;
          }
          console.log("[ScanMore] launching image library...");
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.9,
            exif: false,
          });
          console.log("[ScanMore] picker result canceled:", result.canceled);
          if (result.canceled || !result.assets?.[0]?.uri) return;
          console.log("[ScanMore] got asset uri, calling completeScan");
          await completeScan?.(result.assets[0].uri, "gallery");
          console.log("[ScanMore] completeScan finished");
        } catch (err) {
          console.warn("[Cook AI] Scan More gallery failed:", err?.message, err?.stack);
          showToast?.(t("errors.loadPhotoFailed"), "error");
        }
      })();
    }, GALLERY_HANDOFF_MS);
  };

  if (!scanMoreOpen || !anchor) return null;

  const top = anchor.y + anchor.height + 6;
  const right = Math.max(12, SCREEN_WIDTH - (anchor.x + anchor.width));

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      <Animated.View
        style={[
          styles.menu,
          {
            top,
            right,
            width: MENU_WIDTH,
            backgroundColor: isDark ? colors.card : "#FFFFFF",
            borderColor: isDark ? colors.cardBorder : "#E2E8F0",
            opacity,
            transform: [{ scale }],
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleTakePhoto}
          activeOpacity={0.65}
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel={t("scanner.takePhoto")}
        >
          <Camera size={17} color={colors.textPrimary} strokeWidth={2} />
          <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
            {t("scanner.takePhoto")}
          </Text>
        </TouchableOpacity>

        <View
          style={[styles.divider, { backgroundColor: isDark ? colors.cardBorder : "#F1F5F9" }]}
        />

        <TouchableOpacity
          onPress={handlePickGallery}
          activeOpacity={0.65}
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel={t("scanner.fromGallery")}
        >
          <ImageIcon size={17} color={colors.textPrimary} strokeWidth={2} />
          <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
            {t("scanner.fromGallery")}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: "absolute",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 14,
  },
});
