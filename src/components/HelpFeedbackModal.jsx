import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
} from "react-native";
import { MessageCircle } from "lucide-react-native";
import { useModalState } from "../context/ModalContext";
import { useTheme } from "../context/ThemeContext";
import { useCookAI } from "../context/CookAIContext";
import StandardSmoothModal from "./StandardSmoothModal";

/**
 * Help & Feedback — StandardSmoothModal bottom-sheet (slide, synced with all sheets).
 */
export default function HelpFeedbackModal() {
  const { helpModalOpen, setHelpModalOpen } = useModalState();
  const { colors, isDark } = useTheme();
  const { t } = useCookAI();
  const [message, setMessage] = useState("");

  const handleClose = () => {
    setMessage("");
    setHelpModalOpen?.(false);
  };

  const handleSend = () => {
    if (!message.trim()) return;
    Alert.alert(t("help.thanksTitle"), t("help.thanksMessage"));
    handleClose();
  };

  return (
    <StandardSmoothModal
      visible={!!helpModalOpen}
      onClose={handleClose}
      title={t("menu.helpFeedback")}
      type="bottom-sheet"
      headerLeft={
        <View
          style={[
            styles.iconBadge,
            {
              backgroundColor: isDark ? "#064E3B" : "#ECFDF5",
            },
          ]}
        >
          <MessageCircle size={18} color="#10B981" />
        </View>
      }
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
            backgroundColor: "#1E293B",
            opacity: message.trim() ? 1 : 0.5,
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
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  introText: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: "500",
    minHeight: 88,
    marginBottom: 12,
  },
  sendButton: {
    borderRadius: 14,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonText: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
});
