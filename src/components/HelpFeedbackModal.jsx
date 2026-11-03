import React, { useState } from "react";
import {
  Linking,
  Platform,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from "react-native";
import { useModalState } from "../context/ModalContext";
import { useTheme } from "../context/ThemeContext";
import StandardSmoothModal from "./StandardSmoothModal";
import { useLanguage } from "../context/LanguageContext";
import { showToast } from "../utils/toast";
import { EMERALD, WHITE } from "../theme/palette";
import { SUPPORT_EMAIL } from "../constants/contact";
import appConfig from "../../app.json";
import { log } from "../utils/log";

/**
 * Help & Feedback — StandardSmoothModal bottom-sheet (slide, synced with all sheets).
 */
export default function HelpFeedbackModal() {
  const { helpModalOpen, setHelpModalOpen } = useModalState();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [message, setMessage] = useState("");

  const handleClose = () => {
    setMessage("");
    setHelpModalOpen?.(false);
  };

  // Opens the person's own mail app with the message already written, addressed to us. Nothing is sent until
  // they press send there, so there is no "thanks" here, and the text is kept if no mail app can be opened.
  const handleSend = async () => {
    const text = message.trim();
    if (!text) return;
    const subject = "CookSnap feedback";
    const body = `${text}\n\n--\nCookSnap ${appConfig.expo.version} (${Platform.OS} ${Platform.Version})`;
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      await Linking.openURL(url);
      handleClose();
    } catch (err) {
      log.warn("[CookSnap] Could not open the mail app for feedback:", err?.message);
      showToast(t("help.noMailApp", { email: SUPPORT_EMAIL }), "error", 5000);
    }
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
            backgroundColor: EMERALD[600],
            opacity: message.trim() ? 1 : 0.45,
          },
        ]}
        activeOpacity={0.85}
      >
        <Text
          style={[
            styles.sendButtonText,
            { color: WHITE },
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
