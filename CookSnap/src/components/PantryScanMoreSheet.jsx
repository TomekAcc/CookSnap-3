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

// Same native-Modal-handoff reasoning as ScanMoreSheet.jsx (fridge's
// identical popover) — see that file's own comment for the full history.
const GALLERY_HANDOFF_MS = EXIT_DURATION_MS + 40;

const SCREEN_WIDTH = Dimensions.get("window").width;
const MENU_WIDTH = 200;

/**
 * Pantry's own version of ScanMoreSheet — same compact floating popover,
 * anchored under the pantry photo's top-right "Scan More" pill, letting a
 * user add another pantry photo without losing the one currently shown.
 * Kept as its own file (not a shared/parameterized component) because the
 * two need genuinely different context functions underneath
 * (completePantryScan/canScanPantry vs. completeScan/canScanFridge) —
 * same reasoning ScanMoreSheet's own header comment gives for not building
 * this on StandardModal.
 */
export default function PantryScanMoreSheet({ anchor }) {
  const { colors, isDark } = useTheme();
  const {
    startPantryScanMore,
    completePantryScan,
    canScanPantry,
    showToast,
    t,
  } = useCookAI();
  const { pantryScanOpen, setPantryScanOpen, setProModalOpen } = useModalState();

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (pantryScanOpen) {
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
  }, [pantryScanOpen]);

  const handleClose = () => setPantryScanOpen?.(false);

  const openProAfterClose = () => {
    setPantryScanOpen?.(false);
    setTimeout(() => setProModalOpen?.(true), GALLERY_HANDOFF_MS);
  };

  const handleTakePhoto = () => {
    if (!canScanPantry) {
      openProAfterClose();
      return;
    }
    setPantryScanOpen?.(false);
    setTimeout(() => startPantryScanMore?.(), GALLERY_HANDOFF_MS);
  };

  const handlePickGallery = () => {
    if (!canScanPantry) {
      openProAfterClose();
      return;
    }
    setPantryScanOpen?.(false);
    setTimeout(() => {
      void (async () => {
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
          if (result.canceled || !result.assets?.[0]?.uri) return;
          await completePantryScan?.(result.assets[0].uri, "gallery");
        } catch (err) {
          console.warn("[Cook AI] Pantry Scan More gallery failed:", err?.message);
          showToast?.(t("errors.loadPhotoFailed"), "error");
        }
      })();
    }, GALLERY_HANDOFF_MS);
  };

  if (!pantryScanOpen || !anchor) return null;

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
