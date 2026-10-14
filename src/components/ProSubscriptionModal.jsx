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
// sheet to parse.
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
 * screen in the app that did this, confirmed real complaint ("not sure
 * about the colors... something feels off") that survived several rounds
 * of spacing/color-balance fixes within that dark skin, because the real
 * issue wasn't the balance, it was that this screen didn't match anything
 * else in CookSnap. Now pulls from useTheme() like every other modal
 * (RecipeDetailModal, etc.) — light or dark, it follows the same setting
 * the rest of the app does instead of overriding it. Dismiss is
 * backdrop-tap or the built-in drag gesture only, no close-X ambiguity —
 * wait, there IS a close-X here (unlike RecipeDetailModal's sheets),
 * kept from the original design since this is the one sheet where an
 * accidental backdrop-tap dismiss of a purchase decision screen is worth
 * guarding against with an explicit, deliberate close action.
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
    // hold at the same time. No custom contentStyle background here
    // anymore — StandardModal's own default (colors.card) matches every
    // other sheet in the app.
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
          <View
            style={[
              styles.crownBadge,
              { backgroundColor: AMBER_TINT_BADGE, borderColor: AMBER_TINT_BADGE_BORDER },
            ]}
          >
            <Crown size={20} color={colors.accentAmber} fill={AMBER_LIGHT_FILL} />
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
            one fewer box competing for attention), and its own green
            accent (colors.accentGreen, matching the app's own logo/success
            color) instead of reusing amber for yet another signal — amber
            here was diluted across 8+ elements before being brought back
            down to its 3 real focal points (badge, selected plan, CTA),
            and this list deliberately doesn't become a 4th. */}
        <View style={styles.benefitsList}>
          {PRO_BENEFIT_KEYS.map((key) => (
            <View key={key} style={styles.benefitRow}>
              <View style={[styles.benefitCheckCircle, { backgroundColor: colors.accentGreen }]}>
                <Check size={13} color="#FFFFFF" strokeWidth={3.5} />
              </View>
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

        {/* Fixed, outside the ScrollView on purpose — see the comment
            above this section's opening View for why.

            One line, not a 3-step timeline (see the comment on the old
            TRIAL_STEP_KEYS array above for why that version got cut) —
            still swaps copy based on whether a trial is active, same
            Bell-vs-Check icon distinction either way. */}
        <View style={styles.ctaSection}>
          <View style={styles.guaranteeRow}>
            {plan.trial ? (
              <Bell size={12} color={colors.textSecondary} strokeWidth={2.5} />
            ) : (
              <Check size={12} color={colors.textSecondary} strokeWidth={3} />
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
  scrollContent: { paddingTop: 0, paddingBottom: 4 },
  header: { alignItems: "center", marginBottom: 10 },
  crownBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 5,
  },
  title: {
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.4,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
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
    marginBottom: 5,
  },
  planLabel: { fontSize: 12, fontWeight: "700", flexShrink: 1 },
  // Side-by-side with the struck-through anchor price — gives the "SAVE
  // 58%" badge a concrete number to back it up instead of being an
  // abstract claim nothing on the card actually shows.
  planPriceRow: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 6 },
  planPrice: { fontSize: 19.5, fontWeight: "800" },
  planAnchorPrice: {
    fontSize: 11.5,
    fontWeight: "600",
    textDecorationLine: "line-through",
  },
  planPeriod: { fontSize: 12, fontWeight: "600" },
  planSub: { fontSize: 11, fontWeight: "500", marginTop: 3 },
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
  radioInner: { width: 10, height: 10, borderRadius: 5 },
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
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  benefitText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "600",
    lineHeight: 18,
  },
  socialProof: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
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
  guaranteeText: { fontSize: 11, fontWeight: "600" },
  ctaButton: {
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
    color: ON_AMBER,
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
    marginTop: 6,
  },
});
