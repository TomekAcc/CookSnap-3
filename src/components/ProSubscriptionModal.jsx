import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Crown,
  Check,
  Sparkles,
  X,
  ChevronRight,
  Bell,
  Camera,
  UtensilsCrossed,
  Target,
  BarChart3,
  CalendarDays,
} from "lucide-react-native";
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
// Must stay identical to the header gradient's own first color stop (see
// the LinearGradient below) — this is a flat fill for the fixed-height
// strip directly above where that gradient starts, so the two need to
// meet at the exact same color for the seam between them to be invisible.
const AMBER_TINT_BADGE_TOP = "rgba(255,159,10,0.20)";

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

// Each benefit string carries its own leading emoji baked in at the i18n
// layer (see PRO_BENEFIT_KEYS below) — strips it back out so it doesn't
// render twice now that each row has its own proper vector icon (see
// PRO_BENEFIT_ICONS below) instead of the emoji itself. Direct feedback,
// and the right call: emoji glyphs are the one icon language on this
// whole sheet (every other icon — Crown, Sparkles, Bell, the close X —
// is a lucide vector icon) that isn't actually controlled by the app;
// Apple/Google/a browser each draw the SAME emoji differently, which
// undercuts exactly the "one consistent, designed" feel the rest of the
// sheet already has. Matches ONLY the fixed, known emoji set this app's
// i18n layer actually prepends (📸🍽️🎯📊🗓️, each either a plain
// surrogate-pair emoji or one followed by the U+FE0F variation selector)
// — same surrogate-pair-based matching already proven Hermes-safe
// elsewhere in this app (see stripInlineEmojis in FridgeScannerHero.jsx),
// not the \p{Extended_Pictographic} Unicode property syntax Hermes
// doesn't reliably support.
function splitLeadingEmoji(str) {
  const s = String(str || "").trim();
  const match = s.match(/^([\uD800-\uDBFF][\uDC00-\uDFFF]️?)\s*/);
  if (!match) return { text: s };
  return { text: s.slice(match[0].length) };
}

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

// One lucide icon per benefit, matching each row's meaning the same way
// its (now-stripped) emoji used to — a fixed app-level design choice, not
// translatable content, so this stays a plain object here rather than
// living in the i18n layer the way the emoji did.
const PRO_BENEFIT_ICONS = {
  "pro.benefitUnlimitedScans": Camera,
  "pro.benefitFiveRecipes": UtensilsCrossed,
  "pro.benefitAiModifier": Target,
  "pro.benefitMacros": BarChart3,
  "pro.benefitAutoPlan": CalendarDays,
};

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
      {/* Confirmed real feedback, on a screenshot: the header gradient
          below (styles.header) already bleeds full-width via its own
          negative margin, but it only starts where the ScrollView's
          content does — a short strip above it (StandardModal's own
          paddingTop + this grab handle's own height/margins + the
          ScrollView's small top padding) stayed plain white, right where
          the sheet's actual rounded top corners are. Over that short a
          distance the mismatch between the gradient card's own corner
          radius (22, deliberately smaller — see styles.header) and the
          sheet's real one (30) was visible as a white sliver right in the
          corners, exactly where the eye lands first. This fills that
          specific, fixed-height gap (NOT the variable-height hero text
          below it, which the existing gradient already handles safely
          across every language) with the same color the gradient itself
          starts at, so the two meet with no visible seam — and matches
          the sheet's own 30 corner radius exactly, since nothing is
          layered on top of IT to make a smaller radius look nested. */}
      <View
        style={[
          styles.headerTopFiller,
          { backgroundColor: AMBER_TINT_BADGE_TOP },
        ]}
      />
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
          // Confirmed real feedback, on a device where the content now
          // genuinely fits with no overflow: it still FELT scrollable —
          // iOS's elastic rubber-band bounce gives a little on any drag
          // regardless of whether there's anything to actually scroll to,
          // which reads as "huh, is there more below?" on a screen that's
          // supposed to feel complete. bounces/overScrollMode off removes
          // that give entirely when there's nothing to scroll, while real
          // dragging still works normally on a smaller screen or longer
          // language where content genuinely does overflow.
          bounces={false}
          overScrollMode="never"
        >
        {/* Soft warm wash behind the hero (crown/title/subtitle) — direct
            feedback that the page read as flat/monochrome even after the
            benefit icon chips (those are pale by design, meant to sit
            quietly next to full-color emoji glyphs rather than compete
            with them — fine on their own, but not enough color on their
            own to read as "attractive, makes me want to buy"). Rather than
            pushing MORE color into every row (this sheet already went
            through — and recovered from — a "too much color, messy"
            complaint earlier), this is ONE confident, contained move: a
            gradient card at the top, the same accent amber already used
            everywhere else on the sheet, fading to fully transparent so it
            composites correctly over either theme's card background
            without a hardcoded end color. */}
        <LinearGradient
          colors={["rgba(255,159,10,0.20)", "rgba(255,159,10,0.05)", "rgba(255,159,10,0)"]}
          locations={[0, 0.55, 1]}
          style={styles.header}
        >
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
        </LinearGradient>

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
            one fewer box competing for attention).

            Each row's own topic icon sits in a small amber-tinted chip
            (same tokens as the crown badge above, so the whole sheet reads
            as one consistent accent family) instead of floating as a bare
            character on white — confirmed real feedback that the page
            felt flat/monochrome with color only on the CTA and the
            selected plan card. This is still only ONE icon per row — a
            previous round already confirmed a check-circle ALONGSIDE an
            icon read as two icons doing one job. The icon itself is a
            lucide vector icon now, not the emoji the translated string
            still carries (stripped via splitLeadingEmoji) — every OTHER
            icon on this sheet (Crown, Sparkles, Bell, the close X) is
            already a lucide icon the app fully controls; emoji were the
            one icon language left that renders differently per platform
            instead of looking like a single, designed system. */}
        <View style={styles.benefitsList}>
          {PRO_BENEFIT_KEYS.map((key) => {
            const { text } = splitLeadingEmoji(t(key));
            const BenefitIcon = PRO_BENEFIT_ICONS[key];
            return (
              <View key={key} style={styles.benefitRow}>
                <View
                  style={[
                    styles.benefitIconChip,
                    { backgroundColor: AMBER_TINT_BADGE, borderColor: AMBER_TINT_BADGE_BORDER },
                  ]}
                >
                  <BenefitIcon size={15} color={colors.accentAmber} strokeWidth={2.25} />
                </View>
                <Text style={[styles.benefitText, { color: colors.textPrimary }]}>
                  {text}
                </Text>
              </View>
            );
          })}
        </View>
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
  // See its own render-site comment — fills the fixed-height gap between
  // the sheet's true top edge and where the header gradient itself
  // starts. left/right: -20 cancels StandardModal's sheet
  // paddingHorizontal (20), same trick as the gradient's own
  // marginHorizontal below, since position:"absolute" is relative to the
  // padding box by default, not the sheet's actual outer edge.
  // borderTopLeftRadius/Right match the sheet's own (30) exactly, not a
  // smaller "nested" radius — nothing sits on top of this one corner to
  // make a smaller radius read as intentional the way it does for the
  // gradient further down.
  headerTopFiller: {
    position: "absolute",
    top: 0,
    left: -20,
    right: -20,
    height: 36,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
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
  scrollContent: { paddingTop: 2, paddingBottom: 4 },
  // Trimmed from 22 — a real translated benefit list (Polish, German,
  // etc.) routinely wraps every line to 2 lines on a normal phone width,
  // which this fixed English-authored spacing never had to absorb.
  // Several small, considered trims across the sheet (here, planRow,
  // benefitsList below) do that job instead of one large cut anywhere —
  // confirmed by measurement (measure-pro-overflow.js) that this was
  // real, substantial overflow (235px in Polish on a 375×667 screen), not
  // a cosmetic nitpick.
  // marginBottom/paddingBottom trimmed to offset the paddingTop/Bottom this
  // gradient card adds (it used to be a plain, unpadded View) — re-measured
  // with measure-pro-overflow.js after adding it (12px of overflow crept
  // back in at a standard phone size) and trimmed until back to the
  // zero-scroll result.
  //
  // marginHorizontal: -20 cancels out StandardModal's own sheet
  // paddingHorizontal (20, applied to every child of the sheet) — direct
  // feedback that the gradient read as a card floating with a visible
  // white gutter on each side instead of a true wash reaching the sheet's
  // own edges, which looked cropped/unfinished rather than intentional.
  // paddingHorizontal below re-establishes inset spacing for the actual
  // content (crown/title/subtitle) now that the gradient background
  // itself bleeds full width. borderRadius on the gradient's own top
  // corners is deliberately a touch smaller than the sheet's (30) rather
  // than identical — the gradient sits a few px below the very top edge
  // (under the grab handle), and StandardModal's sheet doesn't clip
  // overflow, so a matching-or-larger radius here would let the
  // gradient's square corner show past the sheet's rounded one in that
  // small gap; a slightly smaller radius reads as intentionally nested
  // instead.
  header: {
    alignItems: "center",
    marginBottom: 10,
    marginHorizontal: -20,
    borderRadius: 22,
    paddingTop: 18,
    paddingBottom: 12,
    paddingHorizontal: 30,
  },
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
  planRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
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
  // Social proof line removed — it was deliberately non-numeric placeholder
  // copy ("Loved by home cooks who hate wasting food") with no concrete
  // stat behind it, the single weakest element on the page by actual
  // persuasive weight, and a full line + its own spacing for a claim that
  // reads as vague rather than convincing. Swap in a REAL stat/rating here
  // if one exists — don't bring back an unverifiable one just to fill the
  // space back in.
  benefitsList: { marginBottom: 16, gap: 2 },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 5,
  },
  benefitIconChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  benefitText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "600",
    lineHeight: 18.5,
  },
  ctaSection: {
    paddingTop: 13,
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
