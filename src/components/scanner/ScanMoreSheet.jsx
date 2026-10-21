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
import { Camera, Image as ImageIcon } from "../../icons";
import { useModalState } from "../../context/ModalContext";
import { useTheme } from "../../context/ThemeContext";
import { EXIT_DURATION_MS } from "../../utils/bottomSheet";
import { log } from "../../utils/log";
import { pickImageFromLibrary } from "../../utils/imagePicker";
import { useEntitlements } from "../../context/EntitlementsContext";
import { useLanguage } from "../../context/LanguageContext";
import { useScan } from "../../context/ScanContext";
import { showToast } from "../../utils/toast";
import { BLACK } from "../../theme/palette";

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
 * Scan More — a compact floating popover anchored right under the "Scan More"
 * button on a scanned photo (fridge or pantry), not a bottom sheet. Deliberately
 * NOT built on StandardModal: that shared sheet machinery (backdrop fade,
 * slide-in, exit-duration buffering) exists for full sheets that need time for
 * their own animation to finish before unmounting. A 2-row dropdown has
 * nothing worth animating that long, and skipping that machinery is what lets
 * the Take Photo / Gallery actions fire with zero handoff delay.
 *
 * `kind` picks which scan it feeds: "fridge" (default) or "pantry". The two used
 * to be separate near-identical files; the only differences are which modal flag
 * it uses and which scan functions and daily limit it calls.
 */
export default function ScanMoreSheet({ kind = "fridge", anchor }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const scan = useScan();
  const entitlements = useEntitlements();
  const modal = useModalState();
  const { setProModalOpen, setProReason } = modal;

  const isPantry = kind === "pantry";
  const open = isPantry ? modal.pantryScanOpen : modal.scanMoreOpen;
  const setOpen = isPantry ? modal.setPantryScanOpen : modal.setScanMoreOpen;
  const canScan = isPantry ? entitlements.canScanPantry : entitlements.canScanFridge;
  const startCamera = isPantry ? scan.startPantryScanMore : scan.startScanMore;
  const importPhoto = isPantry ? scan.completePantryScan : scan.completeScan;
  const prepareImport = isPantry ? undefined : scan.prepareScanMore;
  const paywallReason = isPantry ? "pantryScan" : "scan";

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (open) {
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
  }, [open, opacity, scale]);

  const handleClose = () => setOpen?.(false);

  // Every action below first closes this popover and then waits
  // GALLERY_HANDOFF_MS before doing anything that mounts or presents another
  // native Modal (the camera, the photo picker, the paywall). Doing it in the
  // same tick as this popover's own Modal closing is the multi-Modal collision
  // that froze the app on-device.
  //
  // The free daily cap is actually gated and consumed inside the scan function
  // itself (the single choke point every real scan funnels through, so this
  // popover can't be a bypass). The `canScan` check here is only a read-only
  // early one: a capped-out free user sees the paywall immediately instead of
  // granting camera/gallery permission first for nothing, and a cancelled
  // permission prompt or picker never burns an allowance.
  const openProAfterClose = () => {
    setOpen?.(false);
    setTimeout(() => {
      setProReason?.(paywallReason);
      setProModalOpen?.(true);
    }, GALLERY_HANDOFF_MS);
  };

  const handleTakePhoto = () => {
    if (!canScan) {
      openProAfterClose();
      return;
    }
    setOpen?.(false);
    setTimeout(() => startCamera?.(), GALLERY_HANDOFF_MS);
  };

  const handlePickGallery = () => {
    if (!canScan) {
      openProAfterClose();
      return;
    }
    setOpen?.(false);
    setTimeout(() => {
      void (async () => {
        try {
          prepareImport?.();
          const picked = await pickImageFromLibrary();
          if (picked.status === "denied") {
            showToast?.(t("errors.galleryPermission"), "error");
            return;
          }
          if (picked.status !== "picked") return;
          await importPhoto?.(picked.uri, "gallery");
        } catch (err) {
          log.warn(`[Cook AI] ${isPantry ? "Pantry " : ""}Scan More gallery failed:`, err?.message);
          showToast?.(t("errors.loadPhotoFailed"), "error");
        }
      })();
    }, GALLERY_HANDOFF_MS);
  };

  if (!open || !anchor) return null;

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
            backgroundColor: colors.card,
            borderColor: colors.outline,
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
          style={[styles.divider, { backgroundColor: colors.outlineFaint }]}
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
        shadowColor: BLACK,
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
