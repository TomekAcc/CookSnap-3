import React, { useRef, useState } from "react";
import {
  Linking,
  Platform,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  View,
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
import { FEEDBACK_KINDS, sendFeedback } from "../services/feedback";
import { takeFeedbackPrefill } from "../utils/feedbackPrefill";

const KIND_LABEL_KEYS = {
  bug: "help.kindBug",
  idea: "help.kindIdea",
  recipe: "help.kindRecipe",
  other: "help.kindOther",
};

/**
 * Help & Feedback — StandardSmoothModal bottom-sheet. The message goes to our own server (the owner reads it on
 * a private page); if that fails the text stays here and the person can email it instead.
 */
export default function HelpFeedbackModal() {
  const { helpModalOpen, setHelpModalOpen } = useModalState();
  const { colors } = useTheme();
  const { t, recipeLanguageId } = useLanguage();
  // Taken once, when the sheet mounts (it is mounted fresh each time it opens).
  const prefill = useRef(takeFeedbackPrefill()).current;
  const [kind, setKind] = useState(prefill?.kind || "bug");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [sending, setSending] = useState(false);
  const recipeTitle = prefill?.recipeTitle || "";

  const handleClose = () => {
    setMessage("");
    setContact("");
    setHelpModalOpen?.(false);
  };

  const handleSend = async () => {
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await sendFeedback({ kind, message: text, contact: contact.trim(), recipeTitle, language: recipeLanguageId });
      showToast(t("help.sent"), "success", 3000);
      handleClose();
    } catch (err) {
      log.warn("[CookSnap] Could not send feedback:", err?.message);
      showToast(t("help.sendFailed"), "error", 4500);
    } finally {
      setSending(false);
    }
  };

  // The fallback: the person's own mail app with the message already written.
  const handleEmail = async () => {
    const text = message.trim();
    const subject = `CookSnap feedback (${kind})`;
    const lines = [text, "", "--", `CookSnap ${appConfig.expo.version} (${Platform.OS} ${Platform.Version})`];
    if (recipeTitle) lines.push(`Recipe: ${recipeTitle}`);
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
    try {
      await Linking.openURL(url);
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

      <View style={styles.kindRow}>
        {FEEDBACK_KINDS.map((id) => {
          const selected = kind === id;
          return (
            <TouchableOpacity
              key={id}
              onPress={() => setKind(id)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.kindChip,
                {
                  backgroundColor: selected ? EMERALD[600] : colors.fillMuted,
                  borderColor: selected ? EMERALD[600] : colors.cardBorder,
                },
              ]}
            >
              <Text
                numberOfLines={2}
                style={[styles.kindText, { color: selected ? WHITE : colors.textPrimary }]}
              >
                {t(KIND_LABEL_KEYS[id])}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder={t("help.placeholder")}
        placeholderTextColor={colors.textSecondary}
        multiline
        numberOfLines={4}
        maxLength={2000}
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

      <TextInput
        value={contact}
        onChangeText={setContact}
        placeholder={t("help.contactPlaceholder")}
        placeholderTextColor={colors.textSecondary}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={120}
        style={[
          styles.contactInput,
          {
            backgroundColor: colors.inputBg,
            borderColor: colors.cardBorder,
            color: colors.textPrimary,
          },
        ]}
      />

      <TouchableOpacity
        onPress={handleSend}
        disabled={!message.trim() || sending}
        style={[
          styles.sendButton,
          {
            backgroundColor: EMERALD[600],
            opacity: message.trim() && !sending ? 1 : 0.45,
          },
        ]}
        activeOpacity={0.85}
      >
        <Text style={[styles.sendButtonText, { color: WHITE }]}>
          {sending ? t("help.sending") : t("help.sendFeedback")}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleEmail} activeOpacity={0.7} accessibilityRole="link" style={styles.emailLink}>
        <Text style={[styles.emailLinkText, { color: colors.textSecondary }]}>
          {t("help.emailInstead", { email: SUPPORT_EMAIL })}
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
  kindRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  kindChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  kindText: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: "500",
    minHeight: 132,
    marginBottom: 12,
  },
  contactInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "500",
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
  emailLink: {
    paddingVertical: 14,
    alignItems: "center",
  },
  emailLinkText: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
});
