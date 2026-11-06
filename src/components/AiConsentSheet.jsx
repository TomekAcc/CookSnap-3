import React from "react";
import { Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAiConsent } from "../context/AiConsentContext";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import StandardSmoothModal from "./StandardSmoothModal";
import { EMERALD, WHITE } from "../theme/palette";

/** The one-time "your photo goes to Google's AI" sheet. Mounted once in the app root; see AiConsentContext. */
export default function AiConsentSheet() {
  const { consentSheetOpen, answerAiConsent } = useAiConsent();
  const { t } = useLanguage();
  const { colors } = useTheme();
  return (
    <StandardSmoothModal
      visible={consentSheetOpen}
      onClose={() => answerAiConsent(false)}
      title={t("aiConsent.title")}
      type="bottom-sheet"
    >
      <Text style={[styles.body, { color: colors.textSecondary }]}>{t("aiConsent.body")}</Text>
      <TouchableOpacity
        onPress={() => answerAiConsent(true)}
        activeOpacity={0.85}
        accessibilityRole="button"
        style={[styles.agree, { backgroundColor: EMERALD[700] }]}
      >
        <Text style={styles.agreeText}>{t("aiConsent.agree")}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => answerAiConsent(false)}
        activeOpacity={0.7}
        accessibilityRole="button"
        style={styles.decline}
      >
        <Text style={[styles.declineText, { color: colors.textSecondary }]}>{t("aiConsent.decline")}</Text>
      </TouchableOpacity>
    </StandardSmoothModal>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 15, fontWeight: "500", lineHeight: 22, marginBottom: 18 },
  agree: { borderRadius: 16, minHeight: 52, alignItems: "center", justifyContent: "center" },
  agreeText: { color: WHITE, fontSize: 16, fontWeight: "700" },
  decline: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 6 },
  declineText: { fontSize: 15, fontWeight: "600" },
});
