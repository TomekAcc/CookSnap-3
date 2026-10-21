import React from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import { CameraView } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../../context/LanguageContext";
import PerfectCloseButton from "../PerfectCloseButton";

/** Full-screen camera with a close button, a hint line and the shutter. Props come from `useScanCapture().camera`. */
export default function ScanCameraModal({ open, cameraRef, onClose, onCapture, hint }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const shutterBottom = Math.max(insets.bottom + 28, 40);

  if (!open) return null;

  return (
    <Modal
      visible
      animationType="slide"
      statusBarTranslucent
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "#000000" }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />

        <PerfectCloseButton isFullScreen onPress={onClose} accessibilityLabel={t("a11y.closeCamera")} />

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
            {hint}
          </Text>
          <TouchableOpacity
            onPress={onCapture}
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
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#10B981" }} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
