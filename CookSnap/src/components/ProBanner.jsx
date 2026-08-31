import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Crown, Sparkles, ChevronRight } from "lucide-react-native";
import { useCookAI } from "../context/CookAIContext";

/**
 * Dark elegant Pro card — gold accents, slate CTA (no system blue).
 */
export default function ProBanner({ onOpenProModal }) {
  const { t } = useCookAI();
  return (
    <TouchableOpacity
      onPress={() => onOpenProModal?.()}
      activeOpacity={0.92}
      style={styles.wrap}
    >
      <LinearGradient
        colors={["#0F172A", "#1E293B", "#0F172A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <View style={styles.crownBox}>
              <Crown size={16} color="#FBBF24" />
            </View>
            <Text style={styles.brandLabel}>{t("proBanner.brandLabel")}</Text>
          </View>
          <View style={styles.availPill}>
            <Text style={styles.availText}>{t("proBanner.moreCount")}</Text>
          </View>
        </View>

        <Text style={styles.headline}>{t("proBanner.headline")}</Text>
        <Text style={styles.body}>
          {t("proBanner.body")}
        </Text>

        <View style={styles.cta}>
          <Sparkles size={15} color="#0F172A" />
          <Text style={styles.ctaText}>{t("proBanner.cta")}</Text>
          <ChevronRight size={15} color="#0F172A" />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 20,
    overflow: "hidden",
  },
  card: {
    padding: 18,
    borderRadius: 20,
    overflow: "hidden",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  crownBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(251, 191, 36, 0.18)",
  },
  brandLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FBBF24",
    letterSpacing: 0.8,
  },
  availPill: {
    backgroundColor: "rgba(251, 191, 36, 0.14)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  availText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FBBF24",
  },
  headline: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 17,
    letterSpacing: -0.3,
    marginBottom: 5,
  },
  body: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 19,
    marginBottom: 14,
  },
  cta: {
    backgroundColor: "#FBBF24",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  ctaText: {
    color: "#0F172A",
    fontWeight: "700",
    fontSize: 14,
    textAlign: "center",
    // Sits between two fixed-size icons in a centered row — without this,
    // a long translation (Hindi/Thai run 35-48 chars here) has nothing
    // stopping it from overflowing past them instead of wrapping.
    flexShrink: 1,
  },
});
