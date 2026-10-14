import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from "react-native";
import { Crown, Check, Sparkles, X, ChevronRight, Bell } from "lucide-react-native";
import { useModalState } from "../context/ModalContext";
import { useCookAI } from "../context/CookAIContext";
import { useTheme } from "../context/ThemeContext";
import StandardModal from "./StandardModal";

// Amber is a fixed accent (ThemeContext's accentAmber is the SAME hex in
// both LIGHT_COLORS and DARK_COLORS), so its derived tints are safe as
// literals rather than computed per-theme. Content placed ON TOP of a
// filled amber surface (the CTA button, the save badge) always needs dark
// text/icons for contrast — that's true regardless of which theme is
// active, so ON_AMBER is also a fixed value, not a `colors.*` lookup.
const AMBER_TINT_SOFT = "rgba(255,159,10,0.10)";
const AMBER_TINT_BADGE = "rgba(255,159,10,0.14)";
const AMBER_TINT_BADGE_BORDER = "rgba(255,159,10,0.35)";
const AMBER_LIGHT_FILL = "#FFC877";
const ON_AMBER = "#1D1D1F";

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
// sheet to parse. Each string starts with its own topic emoji (added at
// the i18n layer, not here) — that emoji IS the row's visual marker now;
// see benefitRow below for why the green check-circle that used to sit
// next to it got removed rather than kept alongside it.
const PRO_BENEFIT_KEYS = [
  "pro.benefitUnlimitedScans",
  "pro.benefitFiveRecipes",
  "pro.benefitAiModifier",
  "pro.benefitMacros",
  "pro.benefitAutoPlan",
];

// Blinkist's real case study (user-sourced) said a concrete trial timeline
// cuts cancellation anxiety — true, but the full 3-step version (tried
// first) cost too much vertical space on a screen the user had just
// called "overcrowded" and that was sitting at exactly 0px of spare
// height. Kept the one genuinely new piece of information the full
// timeline added over the old plain guarantee — a proactive reminder
// before the trial ends, the actual psychological lever in Blinkist's
// case — as a single line instead of three. The exact charge date/price
// already lives in the required disclosure text right below the CTA, so
// repeating it here would just be the redundancy the user also flagged.

/**
 * PRO paywall — built directly on StandardModal (not StandardSmoothModal)
 * for the same "sheet + fixed CTA footer" split every other full-height
 * modal in the app uses. Previously hardcoded a one-off dark navy/amber
 * "luxury" skin regardless of the user's actual theme setting — the ONLY
 * screen in the app that did this; now pulls from useTheme() like every
 * other modal. Dismiss is backdrop-tap or the built-in drag gesture, plus
 * an explicit close-X — kept from the original design since this is the
 * one sheet where an accidental backdrop-tap dismiss of a purchase
 * decision is worth guarding against.
 *
 * Spacing philosophy, changed after repeated "overcrowded, things feel
 * mixed up" feedback that survived several rounds of trimming individual
 * margins down toward zero: this component used to treat "fits without
 * ever scrolling" as a hard requirement, inherited from a real old bug
 * where the CTA button could end up pushed off-screen and unreachable.
 * That bug is now solved structurally and independently — the CTA lives
 * outside the ScrollView in a fixed footer (see the View split below), so
 * it's reachable no matter how tall the scrollable content above it gets.
 * Once that's true, fighting to keep everything above it inside one
 * screen with no scroll stops being a real constraint and becomes the
 * thing CAUSING the crowding: every round of "make it fit" meant cutting
 * margins toward zero instead of giving sections real room. Real premium
 * paywalls (Calm, Headspace) commonly scroll — that's unremarkable to a
 * user. Generous spacing now; a short scroll on a small phone/long
 * language is an accepted, normal outcome, not a bug to engineer around.
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
  const { colors } = useTheme();
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
    // maxHeight is a generous cap (92% of screen), not a forced size — the
    // sheet shrinks to fit short content and only scrolls once content
    // genuinely exceeds it. See this component's own top comment for why
    // hitting that cap and scrolling is now an accepted outcome rather
    // than something fought with ever-smaller margins.
    <StandardModal
      visible={!!proModalOpen}
      onClose={close}
      type="bottom-sheet"
      maxHeight={sheetHeight}
      dragZoneRightInset={60}
    >
      <View
        style={[
          styles.grabHandle,
          { backgroundColor: colors.sheetHandle || colors.cardBorder },
        ]}
      />

      {/* Close X — consistent with RecipeDetailModal pattern */}
      <TouchableOpacity
        onPress={close}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={[
          styles.closeButton,
          { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
        ]}
      >
        <X size={16} color={colors.textSecondary} strokeWidth={2.5} />
      </TouchableOpacity>

      {/* ScrollView (header/plans/benefits/social proof) + a fixed section
          below (CTA + disclosure), unaffected by scroll position — see
          this file's top comment for why a scroll here is fine now.
          maxHeight on this wrapper (not flex: 1) still matters for a
          different, structural reason: once StandardModal's sheet stopped
          forcing an explicit `height` and switched to content-based
          auto-sizing capped by `maxHeight`, a `flex: 1` wrapper here would
          sit inside a parent with no definite size. That's harmless in
          CSS/react-native-web, but React Native's real Yoga layout engine
          is stricter — flex:1 with no bounded ancestor can resolve to 0
          height, collapsing this whole wrapper (confirmed real
          regression: "the PRO button doesn't open anything" turned out to
          be the modal opening at ~0 height, not failing to open at all).
          An explicit maxHeight gives this wrapper its own genuine bound
          regardless of the parent's resolved size. minHeight: 0 stays for
          the same reason as always — without it a flex/shrink child in a
          column can refuse to shrink below its content size on web. */}
      <View style={{ maxHeight: sheetHeight, minHeight: 0 }}>
        <ScrollView
          style={{ flexShrink: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
        <View style={styles.header}>
          <View
            style={[
              styles.crownBadge,
              { backgroundColor: AMBER_TINT_BADGE, borderColor: AMBER_TINT_BADGE_BORDER },
            ]}
          >
            <Crown size={22} color={colors.accentAmber} fill={AMBER_LIGHT_FILL} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t("pro.unlockTitle")}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
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
                    borderColor: selected ? colors.accentAmber : colors.cardBorder,
                    backgroundColor: selected ? AMBER_TINT_SOFT : colors.card,
                  },
                ]}
              >
                {p.badgeKey ? (
                  <View style={[styles.planBadge, { backgroundColor: colors.accentAmber }]}>
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
                  <Text style={[styles.planLabel, { color: colors.textSecondary }]}>
                    {t(p.labelKey)}
                  </Text>
                  <View
                    style={[
                      styles.radioOuter,
                      { borderColor: selected ? colors.accentAmber : colors.cardBorder },
                    ]}
                  >
                    {selected ? (
                      <View style={[styles.radioInner, { backgroundColor: colors.accentAmber }]} />
                    ) : null}
                  </View>
                </View>
                <View style={styles.planPriceRow}>
                  <Text style={[styles.planPrice, { color: colors.textPrimary }]}>
                    {p.price}
                    <Text style={[styles.planPeriod, { color: colors.textSecondary }]}>
                      {t(PERIOD_SUFFIX_KEY[p.periodUnit])}
                    </Text>
                  </Text>
                  {p.anchorPrice ? (
                    <Text style={[styles.planAnchorPrice, { color: colors.textSecondary }]}>
                      {p.anchorPrice}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.planSub, { color: colors.textSecondary }]}>
                  {t(p.perMonthKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Benefit checklist, not a Free-vs-PRO spec table — a comparison
            grid with lock icons sells by showing what you're denied, which
            reads as restrictive, not encouraging. Every line here states
            what you GET, with no "locked"/limit framing anywhere, no
            bordered card wrapper (floats straight on the sheet so there's
            one fewer box competing for attention). No green check-circle
            icon here either anymore — each benefit string now carries its
            own topic emoji (camera/plate/target/chart/calendar) added at
            the i18n layer, and having both a circle AND an emoji on the
            same short line was genuinely two icons doing one job,
            confirmed by the user looking at a real screenshot. */}
        <View style={styles.benefitsList}>
          {PRO_BENEFIT_KEYS.map((key) => (
            <View key={key} style={styles.benefitRow}>
              <Text style={[styles.benefitText, { color: colors.textPrimary }]}>
                {t(key)}
              </Text>
            </View>
          ))}
        </View>

        {/* NOTE: placeholder copy on purpose — swap in a real usage stat or
            rating once one exists, don't ship a fabricated number here. */}
        <Text style={[styles.socialProof, { color: colors.textSecondary }]}>
          {t("pro.socialProof")}
        </Text>
        </ScrollView>

        {/* Fixed, outside the ScrollView on purpose — see this file's top
            comment for why. One line, not a 3-step timeline — still swaps
            copy based on whether a trial is active, same Bell-vs-Check
            icon distinction either way. */}
        <View style={styles.ctaSection}>
          <View style={styles.guaranteeRow}>
            {plan.trial ? (
              <Bell size={13} color={colors.textSecondary} strokeWidth={2.5} />
            ) : (
              <Check size={13} color={colors.textSecondary} strokeWidth={3} />
            )}
            <Text style={[styles.guaranteeText, { color: colors.textSecondary }]}>
              {plan.trial
                ? t("pro.trialReminderGuarantee")
                : t("pro.cancelAnytimeGuarantee")}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleSubscribe}
            activeOpacity={0.88}
            style={[styles.ctaButton, { backgroundColor: colors.accentAmber }]}
          >
            <Sparkles size={18} color={ON_AMBER} />
            <Text style={styles.ctaButtonText}>
              {plan.trial
                ? t("pro.startTrial")
                : t("pro.subscribeCta", { price: plan.price, period: planPeriod })}
            </Text>
            <ChevronRight size={18} color={ON_AMBER} />
          </TouchableOpacity>

          <Text style={[styles.priceSubtext, { color: colors.textSecondary }]}>
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
  scrollContent: { paddingTop: 2, paddingBottom: 6 },
  header: { alignItems: "center", marginBottom: 22 },
  crownBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 12,
  },
  title: {
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.4,
    textAlign: "center",
    lineHeight: 26,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 18,
  },
  planRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  planCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    // Needs real clearance from the badge-bearing card's "SAVE 58%" pill,
    // which straddles the card's top border (top: -9 below) — confirmed
    // real complaint when this was too tight, visible on a real device.
    paddingTop: 22,
  },
  planBadge: {
    position: "absolute",
    top: -9,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  planBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: ON_AMBER,
    letterSpacing: 0.3,
  },
  planLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  planLabel: { fontSize: 12.5, fontWeight: "700", flexShrink: 1 },
  // Side-by-side with the struck-through anchor price — gives the "SAVE
  // 58%" badge a concrete number to back it up instead of being an
  // abstract claim nothing on the card actually shows.
  planPriceRow: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 6 },
  planPrice: { fontSize: 21, fontWeight: "800" },
  planAnchorPrice: {
    fontSize: 12,
    fontWeight: "600",
    textDecorationLine: "line-through",
  },
  planPeriod: { fontSize: 12.5, fontWeight: "600" },
  planSub: { fontSize: 11.5, fontWeight: "500", marginTop: 5 },
  radioOuter: {
    flexShrink: 0,
    marginLeft: 6,
    width: 19,
    height: 19,
    borderRadius: 9.5,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: { width: 11, height: 11, borderRadius: 5.5 },
  benefitsList: { marginBottom: 20, gap: 4 },
  benefitRow: {
    paddingVertical: 7,
  },
  benefitText: {
    fontSize: 14.5,
    fontWeight: "600",
    lineHeight: 21,
  },
  socialProof: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  ctaSection: {
    paddingTop: 16,
  },
  guaranteeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 10,
  },
  guaranteeText: { fontSize: 12, fontWeight: "600" },
  ctaButton: {
    borderRadius: 16,
    minHeight: 50,
    paddingVertical: 13,
    // Confirmed real failure, reported by a first-time tester: no
    // horizontal padding here meant a long translated CTA (e.g. German's
    // "7-tägige kostenlose Testphase starten") had nothing keeping it off
    // the button's rounded edges. Without flexShrink on the text below, RN
    // lets a Text sibling in a flex row overflow its container instead of
    // wrapping — so long strings could visually run past/into the corners
    // rather than dropping to a second line.
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  ctaButtonText: {
    color: ON_AMBER,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.2,
    textAlign: "center",
    // Lets a long translation wrap to a second line (the button's minHeight
    // isn't a cap, so it grows to fit) instead of overflowing the pill.
    flexShrink: 1,
  },
  priceSubtext: {
    textAlign: "center",
    fontSize: 11.5,
    fontWeight: "600",
    marginTop: 10,
  },
});
