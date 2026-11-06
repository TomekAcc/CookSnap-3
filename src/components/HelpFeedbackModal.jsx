import React, { useRef, useState } from "react";
import {
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
import { log } from "../utils/log";
import { FEEDBACK_KINDS } from "../services/feedback";
import { flushFeedbackOutbox, queueFeedback } from "../services/feedbackOutbox";
import { takeFeedbackPrefill } from "../utils/feedbackPrefill";

const KIND_LABEL_KEYS = {
  bug: "help.kindBug",
  idea: "help.kindIdea",
  recipe: "help.kindRecipe",
  other: "help.kindOther",
};

/**
 * Help & Feedback — StandardSmoothModal bottom-sheet. The message goes to our own server (the owner reads it on
 * a private page); if that fails the text is kept on the phone and sent later.
 */
export default function HelpFeedbackModal() {
  const { helpModalOpen, setHelpModalOpen } = useModalState();
  const { colors } = useTheme();
  const { t, recipeLanguageId } = useLanguage();
  // Taken once, when the sheet mounts (it is mounted fresh each time it opens).
  const prefill = useRef(takeFeedbackPrefill()).current;
  const [kind, setKind] = useState(prefill?.kind || "bug");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const recipeTitle = prefill?.recipeTitle || "";

  const handleClose = () => {
    setMessage("");
    setHelpModalOpen?.(false);
  };

  // The message is saved on the phone first, then sent. If the server cannot be reached it stays saved and goes out by
  // itself the next time the app is open with a connection, so nothing the person wrote is lost.
  const handleSend = async () => {
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const id = await queueFeedback({ kind, message: text, recipeTitle, language: recipeLanguageId });
      const waiting = await flushFeedbackOutbox();
      if (waiting.includes(id)) showToast(t("help.queued"), "info", 5000);
      else showToast(t("help.sent"), "success", 3000);
      handleClose();
    } catch (err) {
      log.warn("[CookSnap] Could not save feedback:", err?.message);
      showToast(t("help.sendFailed"), "error", 4500);
    } finally {
      setSending(false);
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
                  backgroundColor: selected ? EMERALD[700] : colors.fillMuted,
                  borderColor: selected ? EMERALD[700] : colors.cardBorder,
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

      <TouchableOpacity
        onPress={handleSend}
        disabled={!message.trim() || sending}
        style={[
          styles.sendButton,
          {
            backgroundColor: EMERALD[700],
            opacity: message.trim() && !sending ? 1 : 0.45,
          },
        ]}
        activeOpacity={0.85}
      >
        <Text style={[styles.sendButtonText, { color: WHITE }]}>
          {sending ? t("help.sending") : t("help.sendFeedback")}
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
