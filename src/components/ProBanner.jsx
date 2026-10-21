import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Crown, ChevronRight } from "../icons";
import { useTranslation } from "../context/CookAIContext";
import { useTheme } from "../context/ThemeContext";

const ON_AMBER = "#1D1D1F";

// The paywall benefit strings carry a leading emoji (the sheet swaps it for a
// vector icon). Same surrogate-pair match ProSubscriptionModal uses — proven
// Hermes-safe, unlike \p{...} property escapes.
function withoutLeadingEmoji(text) {
  const s = String(text || "").trim();
  const match = s.match(/^([\uD800-\uDBFF][\uDC00-\uDFFF]\uFE0F?)\s*/);
  return match ? s.slice(match[0].length) : s;
}

// Binds the last two words with a no-break space so a wrapped headline never
// leaves a single orphan word ("...not just / 3") on its own line.
function noOrphan(text) {
  return String(text || "").replace(/\s+(\S+)$/, "\u00A0$1");
}

/**
 * Upsell card at the bottom of the recipe list — the same warm amber identity
 * as the paywall sheet (amber wash, solid crown disc, amber CTA), on the
 * app's normal card surface instead of the old dark-navy block that matched
 * nothing else in the app.
 *
 * The copy is true and concrete: PRO gets 5 recipes per generation (free gets
 * 3) and unlimited scans. It used to say "Unlock the full recipe library"
 * (there is no library — recipes are generated) next to a hardcoded "+12 MORE"
 * pill that was not a real number. Both lines reuse the paywall's own benefit
 * strings, so every language is already translated.
 */
export default function ProBanner({ onOpenProModal, usedUp = false, limit = 0 }) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => onOpenProModal?.()}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={t("profile.upgradeToPro")}
      style={[
        styles.wrap,
        { backgroundColor: colors.card, borderColor: "rgba(255,159,10,0.35)" },
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,159,10,0.16)", "rgba(255,159,10,0.04)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.topRow}>
        <View style={[styles.crownDisc, { backgroundColor: colors.accentAmber }]}>
          <Crown size={16} color="#FFFFFF" fill="#FFFFFF" />
        </View>
        <Text style={[styles.brandLabel, { color: isDark ? "#FCD34D" : "#B45309" }]}>
          {t("proBanner.brandLabel")}
        </Text>
      </View>

      {/* At the moment the daily free generations run out, say exactly that
          (with the real number) instead of the generic pitch — it is the
          warmest moment to ask. Otherwise lead with the concrete benefit. */}
      <Text style={[styles.headline, { color: colors.textPrimary }]}>
        {usedUp
          ? noOrphan(t("profile.generationsUsedUp", { count: limit }))
          : noOrphan(withoutLeadingEmoji(t("pro.benefitFiveRecipes")))}
      </Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        {withoutLeadingEmoji(t(usedUp ? "pro.benefitAutoPlan" : "pro.benefitUnlimitedScans"))}
      </Text>

      <View style={[styles.cta, { backgroundColor: colors.accentAmber }]}>
        <Text style={styles.ctaText}>{t("profile.upgradeToPro")}</Text>
        <ChevronRight size={16} color={ON_AMBER} strokeWidth={2.5} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    overflow: "hidden",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  crownDisc: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  brandLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  headline: {
    fontWeight: "700",
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 14,
  },
  cta: {
    borderRadius: 14,
    minHeight: 46,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  ctaText: {
    color: ON_AMBER,
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
    flexShrink: 1,
  },
});
