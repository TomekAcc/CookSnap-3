import React from "react";
import { Image, Modal, TouchableOpacity, View } from "react-native";
import { useLanguage } from "../../context/LanguageContext";
import PerfectCloseButton from "../PerfectCloseButton";

/** Full-screen view of the scanned fridge photo. */
export default function PhotoViewerModal({ open, uri, onClose }) {
  const { t } = useLanguage();
  if (!open) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      hardwareAccelerated
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "#000000" }}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel={t("a11y.dismissFullFridgePhoto")}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            source={{ uri }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <PerfectCloseButton
          isFullScreen
          onPress={onClose}
          accessibilityLabel={t("a11y.closeFullFridgePhoto")}
        />
      </View>
    </Modal>
  );
}
