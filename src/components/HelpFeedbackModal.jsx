import React, { useState } from "react";
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from "react-native";
import { useModalState } from "../context/ModalContext";
import { useTheme } from "../context/ThemeContext";
import { useCookAI } from "../context/CookAIContext";
import StandardSmoothModal from "./StandardSmoothModal";

/**
 * Help & Feedback — StandardSmoothModal bottom-sheet (slide, synced with all sheets).
 */
export default function HelpFeedbackModal() {
  const { helpModalOpen, setHelpModalOpen } = useModalState();
  const { colors } = useTheme();
  const { t, showToast } = useCookAI();
  const [message, setMessage] = useState("");

  const handleClose = () => {
    setMessage("");
    setHelpModalOpen?.(false);
  };

  const handleSend = () => {
    if (!message.trim()) return;
    handleClose();
    showToast(t("help.thanksTitle"), "success", 2600);
  };

  return (
    <StandardSmoothModal
      visible={!!helpModalOpen}
      onClose={handleClose}
      title={t("menu.helpFeedback")}
      type="bottom-sheet"
      scrollProps={{ keyboardShouldPersistTaps: "handled" }}
    >
      <Text style={[styles.introText, { color: colors.textSecondary }]}>
        {t("help.introText")}
      </Text>

      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder={t("help.placeholder")}
        placeholderTextColor={colors.textSecondary}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        style={[
          styles.input,
          {
            backgroundColor: colors.inputBg,
            borderColor: colors.cardBorder,
            color: colors.textPrimary,
          },
        ]}
      />

      <TouchableOpacity
        onPress={handleSend}
        disabled={!message.trim()}
        style={[
          styles.sendButton,
          {
            backgroundColor: "#059669",
            opacity: message.trim() ? 1 : 0.45,
          },
        ]}
        activeOpacity={0.85}
      >
        <Text
          style={[
            styles.sendButtonText,
            { color: "#FFFFFF" },
          ]}
        >
          {t("help.sendFeedback")}
        </Text>
      </TouchableOpacity>
    </StandardSmoothModal>
  );
}

const styles = StyleSheet.create({
  introText: {
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 21,
    marginBottom: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: "500",
    minHeight: 132,
    marginBottom: 16,
  },
  sendButton: {
    borderRadius: 16,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
