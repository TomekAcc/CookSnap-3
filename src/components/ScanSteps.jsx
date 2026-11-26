import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Camera, SlidersHorizontal, Sparkles } from "../icons";
import { useTranslation } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";

const STEPS = [
  { Icon: Camera, titleKey: "scanner.step1Title", descKey: "scanner.step1Desc" },
  { Icon: SlidersHorizontal, titleKey: "scanner.step2Title", descKey: "scanner.step2Desc" },
  { Icon: Sparkles, titleKey: "scanner.step3Title", descKey: "scanner.step3Desc" },
];

/**
 * "How it works" for the empty Scanner screen — a three-step timeline (scan,
 * set preferences, get recipes). It is a real sequence, so the connecting line
 * says something true. Shown only while there is nothing scanned and no
 * recipes yet; it gives the empty lower half a destination instead of blank
 * space.
 */
export default function ScanSteps() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const dot = colors.accentGreenSoft;
  const ink = colors.greenStrong;

  return (
    <View style={styles.root}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {t("scanner.stepsTitle")}
      </Text>
      {STEPS.map(({ Icon, titleKey, descKey }, i) => (
        <View key={titleKey} style={styles.row}>
          <View style={styles.rail}>
            <View style={[styles.dot, { backgroundColor: dot }]}>
              <Icon size={18} color={ink} strokeWidth={2.2} />
            </View>
            {i < STEPS.length - 1 ? (
              <View style={[styles.line, { backgroundColor: colors.cardBorder }]} />
            ) : null}
          </View>
          <View style={[styles.text, i < STEPS.length - 1 && { paddingBottom: 18 }]}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t(titleKey)}</Text>
            <Text style={[styles.desc, { color: colors.textSecondary }]}>{t(descKey)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    gap: 14,
  },
  rail: {
    alignItems: "center",
    width: 40,
  },
  dot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  line: {
    flex: 1,
    width: 2,
    borderRadius: 1,
    marginTop: 4,
    marginBottom: 4,
  },
  text: {
    flex: 1,
    minWidth: 0,
    paddingTop: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  desc: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
    marginTop: 2,
  },
});
