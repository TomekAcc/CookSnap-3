import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from "react-native";
import { Crown, Check, Sparkles, X, ChevronRight } from "lucide-react-native";
import { useModalState } from "../context/ModalContext";
import { useCookAI } from "../context/CookAIContext";
import StandardModal from "./StandardModal";

const SLATE = "#0F172A";
const SLATE_ROW = "#1E293B";
const SLATE_BORDER = "#334155";
const AMBER = "#F59E0B";
const AMBER_LIGHT = "#FBBF24";
// Matches ThemeContext's accentGreen / tokens.js's GREEN — the app's own
// logo/success color, reused here so the benefit checklist's checkmarks
// read as "included" without adding a 4th amber signal to the screen.
const GREEN = "#10B981";
const TEXT_PRIMARY = "#F8FAFC";
const TEXT_MUTED = "#94A3B8";

// periodUnit/perMonthPrice drive translated display text at render time
// (see PERIOD_SUFFIX_KEY below) — a plain "/year"/"/mo" literal here was a
// confirmed real bug: every OTHER string on this screen is localized via
// t(), but the price and perMonthValue read directly off this object, so
// the period suffix stayed hardcoded English in every language ("Then
// $24.99/year ($2.08/mo)" inside an otherwise-Polish sentence).
export const PLANS = {
  annual: {
    id: "annual",
    labelKey: "pro.annual",
    badgeKey: "pro.saveBadge",
    price: "$24.99",
    // What the same $4.99/mo would cost paid monthly for a year ($59.88) —
    // shown struck through next to the real price so "SAVE 58%" has a
    // concrete number behind it instead of being an abstract badge claim.
    anchorPrice: "$59.88",
    periodUnit: "year",
    perMonthKey: "pro.annualPerMonth",
    perMonthPrice: "$2.08",
    trial: true,
  },
  monthly: {
    id: "monthly",
    labelKey: "pro.monthly",
    badgeKey: null,
    price: "$4.99",
    periodUnit: "month",
    perMonthKey: "pro.monthlyPerMonth",
    perMonthPrice: "$4.99",
    trial: false,
  },
};

const PERIOD_SUFFIX_KEY = { year: "pro.yearSuffix", month: "pro.monthSuffix" };

// Benefit-led copy, not feature/limit labels — replaced the Free-vs-PRO
// comparison table entirely (see the render site's own comment for why).
// Each key states what PRO actually gets you, not what the free tier
// lacks; the underlying capabilities are unchanged from the old
// COMPARISON_ROWS, just reframed as reasons to upgrade instead of a spec
// sheet to parse.
const PRO_BENEFIT_KEYS = [
  "pro.benefitUnlimitedScans",
  "pro.benefitFiveRecipes",
  "pro.benefitAiModifier",
  "pro.benefitMacros",
  "pro.benefitAutoPlan",
];

// Blinkist's real case study (user-sourced): replacing a vague free-trial
// disclaimer with a concrete step-by-step "here's exactly what happens and
// when" timeline measurably reduced trial-cancellation complaints and
// increased signups — the fear isn't the trial, it's not knowing when
// you'll be charged or whether you'll remember to cancel. Only the last
// step needs the live price/period, interpolated at render time.
const TRIAL_STEP_KEYS = [
  "pro.trialDayZero",
  "pro.trialDayReminder",
  "pro.trialDayCharge",
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
  const planPeriod = t(PERIOD_SUFFIX_KEY[plan.periodUnit]);
  const planPerMonthValue = `${plan.perMonthPrice}${t("pro.moSuffix")}`;
  const screenHeight = Dimensions.get("window").height;
  const sheetHeight = screenHeight * 0.92 - 40;

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
    // The default 75% sheet cap fit every row before the "Recipes per
    // generation" comparison row was added — that pushed content past it,
    // introducing a real scroll where there wasn't one, right where a
    // paywall should feel like one clean, glanceable screen, not a list to
    // scroll through. maxHeight is a generous explicit numeric cap (not a
    // % of an already-constrained parent) so the inner `flex: 1` scroll
    // region has real bounds to work with once content actually reaches
    // that cap — but it's a CAP, not a forced size: contentStyle no longer
    // sets an explicit `height` here (it used to, which forced the sheet
    // to always BE maxHeight regardless of actual content — confirmed real
    // bug, reported directly by a user: on a shorter language/plan
    // combination the content didn't reach that height at all, leaving a
    // large dead gap between the social-proof line and the CTA). Without a
    // forced height, the sheet now shrinks to fit short content and only
    // engages the scroll+fixed-footer split once content genuinely
    // exceeds maxHeight — both the original overflow fix and this gap fix
    // hold at the same time.
    <StandardModal
      visible={!!proModalOpen}
      onClose={close}
      type="bottom-sheet"
      maxHeight={sheetHeight}
      contentStyle={{ backgroundColor: SLATE, borderColor: SLATE_ROW }}
      dragZoneRightInset={60}
    >
      <View style={[styles.grabHandle, { backgroundColor: "rgba(255,255,255,0.25)" }]} />

      {/* Close X — consistent with RecipeDetailModal pattern */}
      <TouchableOpacity
        onPress={close}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={[styles.closeButton, { backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.15)" }]}
      >
        <X size={16} color={TEXT_MUTED} strokeWidth={2.5} />
      </TouchableOpacity>

      {/* Confirmed real failure, reported directly by a user: on a
          smaller phone (measured live at iPhone-SE-class 375×667) with a
          longer language active (Polish, German), the comparison table
          alone pushed content roughly 250px past the visible area — which
          used to include the Subscribe button itself, since everything
          from the header through the CTA lived inside one ScrollView.
          That's a real, silent conversion loss: the one button this
          screen exists to get tapped could require scrolling to even
          find. A comparison table's height scales with row count AND
          language length, so no amount of spacing-only tuning can
          promise it always fits — the CTA needs to be structurally safe
          from that, not just usually safe. Split into a ScrollView
          (header/plans/comparison/social proof) plus a fixed section
          below (unaffected by scroll position) for the CTA + price
          subtext, mirroring OnboardingProScreen's identical, verified
          fix.

          maxHeight here, NOT flex: 1 — confirmed real regression from the
          very next fix (the dead-space gap below): once StandardModal's
          sheet stopped forcing an explicit `height` and switched to
          content-based auto-sizing capped by `maxHeight`, this wrapper's
          `flex: 1` sat inside a parent with no definite size. That's fine
          in CSS/react-native-web (an unbounded flex:1 just behaves like
          the child isn't flexing), but React Native's actual Yoga layout
          engine is stricter: flex:1 with no bounded ancestor can resolve
          to a height of 0, collapsing this whole wrapper — ScrollView AND
          the CTA button both invisible, which is exactly what "the PRO
          button doesn't open anything" looks like from the outside (the
          modal WAS opening, just rendering at ~0 height). An explicit
          maxHeight gives this wrapper its own genuine bound regardless of
          the parent's resolved size, so ScrollView's flexShrink below
          still has something real to shrink against once content exceeds
          it. minHeight: 0 stays for the same reason as before — without
          it a flex/shrink child in a column can refuse to shrink below
          its content size on web. */}
      <View style={{ maxHeight: sheetHeight, minHeight: 0 }}>
        <ScrollView
          style={{ flexShrink: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
        <View style={styles.header}>
          <View style={styles.crownBadge}>
            <Crown size={20} color={AMBER} fill={AMBER_LIGHT} />
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
                {/* Label + radio laid out as a real flex row rather than the
                    radio being position: "absolute" pinned to a fixed
                    physical edge — confirmed real bug in Arabic: RN
                    right-aligns short label text inside RTL content, which
                    put the radio circle (hardcoded right: 12) directly on
                    top of the Arabic label instead of beside it. A flex
                    row sizes both by their actual content, so they can
                    never occupy the same space regardless of script,
                    direction, or how long the translated label is. */}
                <View style={styles.planLabelRow}>
                  <Text style={styles.planLabel}>{t(p.labelKey)}</Text>
                  <View
                    style={[
                      styles.radioOuter,
                      { borderColor: selected ? AMBER : SLATE_BORDER },
                    ]}
                  >
                    {selected ? <View style={styles.radioInner} /> : null}
                  </View>
                </View>
                <View style={styles.planPriceRow}>
                  <Text style={styles.planPrice}>
                    {p.price}
                    <Text style={styles.planPeriod}>
                      {t(PERIOD_SUFFIX_KEY[p.periodUnit])}
                    </Text>
                  </Text>
                  {p.anchorPrice ? (
                    <Text style={styles.planAnchorPrice}>{p.anchorPrice}</Text>
                  ) : null}
                </View>
                <Text style={styles.planSub}>{t(p.perMonthKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Benefit checklist, not a Free-vs-PRO spec table — a comparison
            grid with lock icons sells by showing what you're denied, which
            reads as restrictive, not encouraging. Every line here states
            what you GET, with no "locked"/limit framing anywhere, no
            bordered card wrapper (floats straight on the sheet so there's
            one fewer box competing for attention), and its own green
            accent (GREEN, matching the app's own logo/success color)
            instead of reusing amber for yet another signal — amber here
            was diluted across 8+ elements before being brought back down
            to its 3 real focal points (badge, selected plan, CTA), and
            this list deliberately doesn't become a 4th. */}
        <View style={styles.benefitsList}>
          {PRO_BENEFIT_KEYS.map((key) => (
            <View key={key} style={styles.benefitRow}>
              <View style={styles.benefitCheckCircle}>
                <Check size={13} color={SLATE} strokeWidth={3.5} />
              </View>
              <Text style={styles.benefitText}>{t(key)}</Text>
            </View>
          ))}
        </View>

        {/* NOTE: placeholder copy on purpose — swap in a real usage stat or
            rating once one exists, don't ship a fabricated number here. */}
        <Text style={styles.socialProof}>
          {t("pro.socialProof")}
        </Text>
        </ScrollView>

        {/* Fixed, outside the ScrollView on purpose — see the comment
            above this section's opening View for why.

            Trial timeline replaces the old single-line "cancel anytime"
            guarantee when a trial is active (annual plan) — a concrete
            today/reminder/charge-date timeline is a stronger, more
            specific version of the same risk-reversal message (Blinkist's
            real case study: this exact swap measurably cut trial-cancel
            complaints and raised signups), so showing both would be
            redundant rather than additive. The monthly plan has no trial,
            so it keeps the plain guarantee line — a 3-step "timeline" with
            nothing time-based to show on day 5/7 wouldn't make sense. */}
        <View style={styles.ctaSection}>
          {plan.trial ? (
            <View style={styles.trialTimeline}>
              {TRIAL_STEP_KEYS.map((key, i) => (
                <View key={key} style={styles.trialStepRow}>
                  <View style={styles.trialStepIndicator}>
                    <View style={styles.trialDot} />
                    {i < TRIAL_STEP_KEYS.length - 1 ? (
                      <View style={styles.trialLine} />
                    ) : null}
                  </View>
                  <Text style={styles.trialStepText}>
                    {key === "pro.trialDayCharge"
                      ? t(key, { price: plan.price, period: planPeriod })
                      : t(key)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.guaranteeRow}>
              <Check size={12} color={TEXT_MUTED} strokeWidth={3} />
              <Text style={styles.guaranteeText}>
                {t("pro.cancelAnytimeGuarantee")}
              </Text>
            </View>
          )}
          <TouchableOpacity onPress={handleSubscribe} activeOpacity={0.88} style={styles.ctaButton}>
            <Sparkles size={18} color="#0F172A" />
            <Text style={styles.ctaButtonText}>
              {plan.trial
                ? t("pro.startTrial")
                : t("pro.subscribeCta", { price: plan.price, period: planPeriod })}
            </Text>
            <ChevronRight size={18} color="#0F172A" />
          </TouchableOpacity>

          <Text style={styles.priceSubtext}>
            {plan.trial
              ? t("pro.thenPriceCancelAnytime", {
                  price: plan.price,
                  period: planPeriod,
                  perMonthValue: planPerMonthValue,
                })
              : t("pro.billedMonthlyCancelAnytime")}
          </Text>
        </View>
      </View>
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
    marginVertical: 4,
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    zIndex: 10,
  },
  scrollContent: { paddingTop: 0, paddingBottom: 4 },
  header: { alignItems: "center", marginBottom: 10 },
  crownBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245,158,11,0.14)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.35)",
    marginBottom: 5,
  },
  title: {
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: TEXT_PRIMARY,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: TEXT_MUTED,
    marginTop: 2,
    textAlign: "center",
  },
  planRow: { flexDirection: "row", gap: 9, marginBottom: 4 },
  planCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 9,
    // Was 10 — too close to the badge-bearing card's "SAVE 58%" pill,
    // which straddles the card's top border (top: -9 below) and left
    // almost no clearance before the "Roczna" label underneath it.
    // Confirmed real complaint, visible on a real device.
    paddingTop: 15,
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
  planLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  planLabel: { fontSize: 12, fontWeight: "700", color: TEXT_MUTED, flexShrink: 1 },
  // Side-by-side with the struck-through anchor price — gives the "SAVE
  // 58%" badge a concrete number to back it up instead of being an
  // abstract claim nothing on the card actually shows.
  planPriceRow: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 6 },
  planPrice: { fontSize: 19.5, fontWeight: "800", color: TEXT_PRIMARY },
  planAnchorPrice: {
    fontSize: 11.5,
    fontWeight: "600",
    color: TEXT_MUTED,
    textDecorationLine: "line-through",
  },
  planPeriod: { fontSize: 12, fontWeight: "600", color: TEXT_MUTED },
  planSub: { fontSize: 11, fontWeight: "500", color: TEXT_MUTED, marginTop: 3 },
  radioOuter: {
    flexShrink: 0,
    marginLeft: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: AMBER },
  benefitsList: { marginBottom: 4 },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  benefitCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  benefitText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "600",
    color: TEXT_PRIMARY,
    lineHeight: 18,
  },
  socialProof: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    color: TEXT_MUTED,
    marginBottom: 3,
    lineHeight: 14,
  },
  ctaSection: {
    paddingTop: 1,
  },
  guaranteeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginBottom: 4,
  },
  guaranteeText: { fontSize: 11, fontWeight: "600", color: TEXT_MUTED },
  trialTimeline: { marginBottom: 6 },
  trialStepRow: { flexDirection: "row", alignItems: "flex-start" },
  trialStepIndicator: { width: 14, alignItems: "center" },
  trialDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: AMBER,
    marginTop: 3,
  },
  trialLine: {
    width: 1.5,
    flex: 1,
    minHeight: 7,
    backgroundColor: SLATE_BORDER,
    marginVertical: 1,
  },
  trialStepText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: "600",
    color: TEXT_PRIMARY,
    marginLeft: 8,
    marginBottom: 3,
  },
  ctaButton: {
    backgroundColor: AMBER,
    borderRadius: 14,
    minHeight: 44,
    paddingVertical: 9,
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
    marginTop: 6,
  },
});
