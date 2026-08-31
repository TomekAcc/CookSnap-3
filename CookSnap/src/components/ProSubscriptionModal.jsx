import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { Crown, Check, Lock, ShieldCheck, Sparkles } from "lucide-react-native";
import { useModalState } from "../context/ModalContext";
import { useCookAI } from "../context/CookAIContext";
import StandardModal from "./StandardModal";

const SLATE = "#0F172A";
const SLATE_ROW = "#1E293B";
const SLATE_BORDER = "#334155";
const AMBER = "#F59E0B";
const AMBER_LIGHT = "#FBBF24";
const TEXT_PRIMARY = "#F8FAFC";
const TEXT_MUTED = "#94A3B8";

export const PLANS = {
  annual: {
    id: "annual",
    labelKey: "pro.annual",
    badgeKey: "pro.saveBadge",
    price: "$24.99",
    period: "/year",
    perMonthKey: "pro.annualPerMonth",
    perMonthValue: "$2.08/mo",
    trial: true,
  },
  monthly: {
    id: "monthly",
    labelKey: "pro.monthly",
    badgeKey: null,
    price: "$4.99",
    period: "/month",
    perMonthKey: "pro.monthlyPerMonth",
    perMonthValue: "$4.99/mo",
    trial: false,
  },
};

const COMPARISON_ROWS = [
  { labelKey: "pro.fridgeScans", freeKey: "pro.perDayLimit", proKey: "pro.unlimited" },
  { labelKey: "pro.pantryScans", freeKey: "pro.perDayLimit", proKey: "pro.unlimited" },
  { labelKey: "pro.recipeGenerations", freeKey: "pro.perDayLimit", proKey: "pro.unlimited" },
  { labelKey: "pro.recipesPerGeneration", freeKey: "pro.threeRecipes", proKey: "pro.fiveRecipes" },
  { labelKey: "pro.aiRecipeModifier", free: false, pro: true },
  { labelKey: "pro.fullMacroBreakdown", free: false, pro: true },
  { labelKey: "pro.aiAutoFillWeeklyPlan", free: false, pro: true },
];

/**
 * PRO paywall — built directly on StandardModal (not StandardSmoothModal)
 * so the dark slate/amber luxury chrome isn't fighting the light-theme
 * default. Dismiss is backdrop-tap or the built-in drag gesture only, no
 * close-X, matching the rest of the app's sheet convention.
 */
export default function ProSubscriptionModal() {
  const { proModalOpen, setProModalOpen } = useModalState();
  const {
    activatePro,
    showToast,
    dailyRecipeGenerationCount,
    freeDailyRecipeGenerations,
    t,
  } = useCookAI();
  const [selectedPlanId, setSelectedPlanId] = useState("annual");
  const close = () => setProModalOpen(false);
  const plan = PLANS[selectedPlanId];

  // Real usage beats a generic tagline — someone who just hit their daily
  // generation cap is a much warmer lead than someone who hasn't generated
  // recipes yet. Keyed off generations, not scans — see
  // FREE_DAILY_RECIPE_GENERATIONS in CookAIContext for why.
  const subtitle =
    dailyRecipeGenerationCount >= freeDailyRecipeGenerations
      ? t("profile.generationsUsedUp", { count: freeDailyRecipeGenerations })
      : dailyRecipeGenerationCount > 0
        ? t("pro.generationsUsedPartial", {
            used: dailyRecipeGenerationCount,
            count: freeDailyRecipeGenerations,
          })
        : t("pro.tagline");

  const handleSubscribe = () => {
    activatePro();
    close();
    showToast(
      plan.trial ? t("pro.trialStartedToast") : t("pro.welcomeToast"),
      "success"
    );
  };

  return (
    <StandardModal
      visible={!!proModalOpen}
      onClose={close}
      type="bottom-sheet"
      // The default 75% sheet cap fit every row before the "Recipes per
      // generation" comparison row was added — that pushed content past it,
      // introducing a real scroll where there wasn't one, right where a
      // paywall should feel like one clean, glanceable screen, not a list to
      // scroll through. More room here plus tighter spacing below (not a
      // removed row) is what gets back to no-scroll on a typical phone.
      maxHeight="88%"
      contentStyle={{ backgroundColor: SLATE, borderColor: SLATE_ROW }}
    >
      <View style={[styles.grabHandle, { backgroundColor: "rgba(255,255,255,0.25)" }]} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.crownBadge}>
            <Crown size={26} color={AMBER} fill={AMBER_LIGHT} />
          </View>
          <Text style={styles.title}>{t("pro.unlockTitle")}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
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

        <View style={styles.compareCard}>
          <View style={styles.compareHeaderRow}>
            <Text style={[styles.compareHeaderCell, { flex: 1.4, textAlign: "left" }]}> </Text>
            <Text style={styles.compareHeaderCell}>{t("pro.freeColumnHeader")}</Text>
            <Text style={[styles.compareHeaderCell, { color: AMBER }]}>{t("menu.proBadge")}</Text>
          </View>
          {COMPARISON_ROWS.map((row, i) => (
            <View
              key={row.labelKey}
              style={[
                styles.compareRow,
                i === COMPARISON_ROWS.length - 1 ? { borderBottomWidth: 0 } : null,
              ]}
            >
              <Text style={[styles.compareLabel, { flex: 1.4 }]}>{t(row.labelKey)}</Text>
              <View style={styles.compareCell}>
                {row.freeKey ? (
                  <Text style={styles.compareFreeText}>{t(row.freeKey)}</Text>
                ) : (
                  <Lock size={14} color={TEXT_MUTED} />
                )}
              </View>
              <View style={styles.compareCell}>
                {row.proKey ? (
                  <Text style={styles.compareProText}>{t(row.proKey)}</Text>
                ) : (
                  <Check size={16} color={AMBER} strokeWidth={2.5} />
                )}
              </View>
            </View>
          ))}
        </View>

        {/* NOTE: placeholder copy on purpose — swap in a real usage stat or
            rating once one exists, don't ship a fabricated number here. */}
        <Text style={styles.socialProof}>
          {t("pro.socialProof")}
        </Text>

        <TouchableOpacity onPress={handleSubscribe} activeOpacity={0.88} style={styles.ctaButton}>
          <Sparkles size={18} color="#0F172A" />
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

        <View style={styles.guaranteeRow}>
          <ShieldCheck size={14} color="#34D399" />
          <Text style={styles.guaranteeText}>{t("pro.cancelAnytimeGuarantee")}</Text>
        </View>
      </ScrollView>
    </StandardModal>
  );
}

/** Named alias matching the golden template export list. */
export function ProModal(props) {
  return <ProSubscriptionModal {...props} />;
}

const styles = StyleSheet.create({
  grabHandle: {
    width: 40,
    height: 4.5,
    borderRadius: 3,
    alignSelf: "center",
    marginVertical: 6,
  },
  scrollContent: { paddingTop: 4, paddingBottom: 20 },
  header: { alignItems: "center", marginBottom: 12 },
  crownBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
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
    letterSpacing: -0.4,
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
  planRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  planCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    paddingTop: 16,
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
  planBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 0.3,
  },
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
  compareCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SLATE_BORDER,
    backgroundColor: SLATE_ROW,
    paddingHorizontal: 12,
    marginBottom: 10,
    overflow: "hidden",
  },
  compareHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 5,
  },
  compareHeaderCell: {
    flex: 1,
    fontSize: 10,
    fontWeight: "800",
    color: TEXT_MUTED,
    textAlign: "center",
    letterSpacing: 0.4,
  },
  compareRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SLATE_BORDER,
  },
  compareLabel: { fontSize: 12.5, fontWeight: "600", color: TEXT_PRIMARY },
  compareCell: { flex: 1, alignItems: "center", justifyContent: "center" },
  compareFreeText: { fontSize: 11.5, fontWeight: "600", color: TEXT_MUTED },
  compareProText: { fontSize: 11.5, fontWeight: "700", color: AMBER },
  socialProof: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_MUTED,
    marginBottom: 8,
  },
  ctaButton: {
    backgroundColor: AMBER,
    borderRadius: 14,
    minHeight: 50,
    paddingVertical: 12,
    // Confirmed real failure, reported by a first-time tester: no
    // horizontal padding here meant a long translated CTA (e.g. German's
    // "7-tägige kostenlose Testphase starten") had nothing keeping it off
    // the button's rounded edges. Without flexShrink on the text below, RN
    // lets a Text sibling in a flex row overflow its container instead of
    // wrapping — so long strings could visually run past/into the corners
    // rather than dropping to a second line.
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  ctaButtonText: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.2,
    textAlign: "center",
    // Lets a long translation wrap to a second line (the button's minHeight
    // isn't a cap, so it grows to fit) instead of overflowing the pill.
    flexShrink: 1,
  },
  priceSubtext: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    color: TEXT_MUTED,
    marginTop: 8,
  },
  guaranteeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    marginBottom: 2,
  },
  guaranteeText: { fontSize: 11, fontWeight: "600", color: TEXT_MUTED },
});
