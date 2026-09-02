import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Crown, Check, Sparkles, X } from "lucide-react-native";
import { useCookAI } from "../context/CookAIContext";
import { PLANS } from "../components/ProSubscriptionModal";

const SLATE = "#0F172A";
const SLATE_ROW = "#1E293B";
const SLATE_BORDER = "#334155";
const AMBER = "#F59E0B";
const AMBER_LIGHT = "#FBBF24";
const TEXT_PRIMARY = "#F8FAFC";
const TEXT_MUTED = "#94A3B8";

const BENEFIT_KEYS = [
  "onboarding.proBenefitScans",
  "onboarding.proBenefitGenerations",
  "onboarding.proBenefitMealPlan",
  "onboarding.proBenefitMacros",
];

/**
 * Soft, skippable PRO intro — shown once, right after the language/units
 * step and before the first real onboarding screen ever mounts. Not a
 * hard gate: "Maybe later" completes onboarding exactly like subscribing
 * does, just without activating PRO. Reuses ProSubscriptionModal's PLANS
 * so pricing never drifts between the two paywalls.
 */
export default function OnboardingProScreen({ onFinish }) {
  const insets = useSafeAreaInsets();
  const { activatePro, showToast, t } = useCookAI();
  const [selectedPlanId, setSelectedPlanId] = useState("annual");
  const plan = PLANS[selectedPlanId];

  const handleSubscribe = () => {
    activatePro();
    showToast(
      plan.trial ? t("pro.trialStartedToast") : t("pro.welcomeToast"),
      "success"
    );
    onFinish();
  };

  return (
    <View style={{ flex: 1, backgroundColor: SLATE }}>
      {/* Confirmed real failure from live user testing: on a screen this
          dark and CTA-dominant, "Maybe later" — small, muted gray text
          buried at the very bottom under a bold paid button — didn't read
          as tappable at all. Testers reported not knowing what to do next
          right after finishing language/units, because nothing above the
          fold looked like a way into the free app. A persistent top-right
          X is the standard, unambiguous "skip this" affordance almost
          every app's paywall uses, visible the instant this screen mounts
          without needing to scroll past the whole pitch first. */}
      <TouchableOpacity
        onPress={onFinish}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t("onboarding.maybeLater")}
        hitSlop={12}
        style={[styles.closeButton, { top: insets.top + 12 }]}
      >
        <X size={20} color={TEXT_MUTED} />
      </TouchableOpacity>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingTop: insets.top + 14,
          paddingHorizontal: 20,
          paddingBottom: 10,
        }}
      >
        <View style={styles.header}>
          <View style={styles.crownBadge}>
            <Crown size={30} color={AMBER} fill={AMBER_LIGHT} />
          </View>
          <Text style={styles.title}>{t("onboarding.proIntroTitle")}</Text>
          <Text style={styles.subtitle}>{t("onboarding.proIntroSubtitle")}</Text>
        </View>

        <View style={styles.benefitList}>
          {BENEFIT_KEYS.map((key) => (
            <View key={key} style={styles.benefitRow}>
              <View style={styles.benefitCheck}>
                <Check size={12} color={SLATE} strokeWidth={2.5} />
              </View>
              <Text style={styles.benefitText}>{t(key)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.planRow}>
          {[PLANS.annual, PLANS.monthly].map((p) => {
            const selected = p.id === selectedPlanId;
            return (
              <TouchableOpacity
                key={p.id}
                activeOpacity={0.85}
                onPress={() => setSelectedPlanId(p.id)}
                style={[
                  styles.planCard,
                  {
                    borderColor: selected ? AMBER : SLATE_BORDER,
                    backgroundColor: selected ? "rgba(245,158,11,0.10)" : SLATE_ROW,
                  },
                ]}
              >
                {p.badgeKey ? (
                  <View style={styles.planBadge}>
                    <Text style={styles.planBadgeText}>{t(p.badgeKey)}</Text>
                  </View>
                ) : null}
                <Text style={styles.planLabel}>{t(p.labelKey)}</Text>
                <Text style={styles.planPrice}>
                  {p.price}
                  <Text style={styles.planPeriod}>{p.period}</Text>
                </Text>
                <Text style={styles.planSub}>{t(p.perMonthKey)}</Text>
                <View
                  style={[
                    styles.radioOuter,
                    { borderColor: selected ? AMBER : SLATE_BORDER },
                  ]}
                >
                  {selected ? <View style={styles.radioInner} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.socialProof}>{t("pro.socialProof")}</Text>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: insets.bottom + 16,
        }}
      >
        <TouchableOpacity onPress={handleSubscribe} activeOpacity={0.88} style={styles.ctaButton}>
          <Sparkles size={18} color={SLATE} />
          <Text style={styles.ctaButtonText}>
            {plan.trial
              ? t("pro.startTrial")
              : t("pro.subscribeCta", { price: plan.price, period: plan.period })}
          </Text>
        </TouchableOpacity>

        <Text style={styles.priceSubtext}>
          {plan.trial
            ? t("pro.thenPriceCancelAnytime", {
                price: plan.price,
                period: plan.period,
                perMonthValue: plan.perMonthValue,
              })
            : t("pro.billedMonthlyCancelAnytime")}
        </Text>

        <TouchableOpacity onPress={onFinish} activeOpacity={0.7} style={styles.skipButton}>
          <Text style={styles.skipText}>{t("onboarding.maybeLater")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    position: "absolute",
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SLATE_ROW,
    borderWidth: 1,
    borderColor: SLATE_BORDER,
  },
  // Confirmed real failure, reported directly by a user: on a smaller
  // phone (measured live at iPhone-SE-class 375×667) with a longer
  // language active — Polish, German — this screen's scrollable middle
  // section ran ~160px past the visible area, needing a scroll to see the
  // rest of the pitch even though the actual controls people need
  // (subscribe / "Maybe later") are in the fixed section below and were
  // never actually hidden. Margins/gaps here were sized for English's
  // shorter strings and never re-checked against a longer language on a
  // smaller device. Tightened throughout (not just for Polish specifically
  // — German runs comparably long) plus the redundant guaranteeRow removed
  // below (its "cancel anytime" message already appears in priceSubtext,
  // in the always-visible fixed section) — verified live to bring the
  // measured overflow to zero on the same device.
  header: { alignItems: "center", marginBottom: 14 },
  crownBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245,158,11,0.14)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.35)",
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: TEXT_PRIMARY,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: TEXT_MUTED,
    marginTop: 4,
    textAlign: "center",
  },
  benefitList: {
    backgroundColor: SLATE_ROW,
    borderWidth: 1,
    borderColor: SLATE_BORDER,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  benefitCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: AMBER,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: { fontSize: 13, fontWeight: "600", color: TEXT_PRIMARY, flex: 1 },
  planRow: { flexDirection: "row", gap: 10 },
  planCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    paddingTop: 14,
  },
  planBadge: {
    position: "absolute",
    top: -9,
    left: 10,
    backgroundColor: AMBER,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  planBadgeText: { fontSize: 9, fontWeight: "900", color: SLATE, letterSpacing: 0.3 },
  planLabel: { fontSize: 12, fontWeight: "700", color: TEXT_MUTED, marginBottom: 4 },
  planPrice: { fontSize: 19, fontWeight: "800", color: TEXT_PRIMARY },
  planPeriod: { fontSize: 12, fontWeight: "600", color: TEXT_MUTED },
  planSub: { fontSize: 11, fontWeight: "500", color: TEXT_MUTED, marginTop: 2 },
  radioOuter: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: AMBER },
  socialProof: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_MUTED,
    marginTop: 10,
  },
  ctaButton: {
    backgroundColor: AMBER,
    borderRadius: 14,
    minHeight: 50,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  ctaButtonText: { color: SLATE, fontSize: 15, fontWeight: "900", letterSpacing: -0.2 },
  priceSubtext: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    color: TEXT_MUTED,
    marginTop: 8,
  },
  skipButton: { alignItems: "center", paddingVertical: 14, marginTop: 2 },
  skipText: { fontSize: 14, fontWeight: "700", color: TEXT_MUTED },
});
