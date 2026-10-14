import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
const ON_AMBER = "#1D1D1F";
// Distance from the sheet's true top edge to where the ScrollView's content
// (and so the hero block) begins: StandardModal's sheet paddingTop (6) +
// the grab handle's height and vertical margins (4.5 + 4 + 4) + the
// ScrollView's own top padding (2). The hero wash adds this to the
// measured hero height so it reaches down to the bottom of the subtitle.
const HERO_WASH_TOP_OFFSET = 20.5;
// Used for the first frame, before onLayout has reported the real hero
// height — roughly a two-line title + two-line subtitle hero.
const HERO_WASH_FALLBACK_HEIGHT = 200;

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
  const { colors, isDark } = useTheme();
  // The app's own pastel-emerald icon-badge tokens — the same fill/border/
  // glyph colors used for the Profile, Pantry and Saved header badges and
  // the scan-card icon (see FridgeScannerHero), so the benefit icons here
  // read as part of the same system rather than a one-off.
  const benefitChipStyle = {
    backgroundColor: isDark ? "#064E3B" : "#ECFDF5",
    borderColor: isDark ? "#065F46" : "#A7F3D0",
  };
  const benefitIconColor = isDark ? "#34D399" : "#059669";
  const [selectedPlanId, setSelectedPlanId] = useState("annual");
  const [heroHeight, setHeroHeight] = useState(HERO_WASH_FALLBACK_HEIGHT);
  const close = () => setProModalOpen(false);
  const plan = PLANS[selectedPlanId];
  const planPeriod = t(PERIOD_SUFFIX_KEY[plan.periodUnit]);
  const planPerMonthValue = `${plan.perMonthPrice}${t("pro.moSuffix")}`;
  const screenHeight = Dimensions.get("window").height;
  const insets = useSafeAreaInsets();
  // Cap = everything below the status bar / notch / Dynamic Island, minus a
  // small gap — not an arbitrary fraction of the screen. This used to be
  // `screenHeight * 0.92 - 40` (736px on a 390×844 phone), which clipped the
  // Polish sheet — its content needs ~742px — by 5px on the exact phone size
  // the user tests on, and by 34px on 375×812 phones (X / 11 Pro / 12-13
  // mini). A real 5px scroll is what they described as "it's still
  // scrollable even though everything fits" (the earlier bounces={false}
  // only removed the elastic give, not the real 5px). The sheet is
  // content-sized, so raising the CAP doesn't make it taller on a roomy
  // phone; it only stops the cap from clipping content that would fit.
  // Genuinely small screens (iPhone SE) still scroll, which is correct.
  const sheetHeight = Math.round(screenHeight - Math.max(insets.top, 20) - 12);
  // The scroll+CTA wrapper below must be capped by what's LEFT of the sheet
  // after its own chrome, not by the sheet's full cap. Capping both at the
  // same number meant the sheet clamped but the wrapper (flexShrink 0, so it
  // never gives way) kept its natural height and spilled past the sheet's
  // bottom — through the safe-area padding and off-screen — instead of the
  // ScrollView shrinking and scrolling. That's why the price disclosure sat
  // against the home indicator on a real phone. Mirrors StandardModal's own
  // numbers: sheet paddingTop 6, bottom paddingBottom
  // max(insets.bottom + 16, 24), 1px top border, plus this file's grab handle
  // (4.5 height + 4 + 4 margins).
  const sheetBottomPad = Math.max(insets.bottom + 16, 24);
  const bodyMaxHeight = sheetHeight - (6 + 1 + 12.5 + sheetBottomPad);
  // Scroll only when the content truly overflows. A fixed `scrollEnabled`
  // would let a sub-pixel or few-px native text-metric difference turn into
  // a pointless nudge-scroll on a sheet that visually fits.
  const [scrollViewH, setScrollViewH] = useState(0);
  const [scrollContentH, setScrollContentH] = useState(0);
  const contentOverflows = scrollContentH > scrollViewH + 1;

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
      {/* Soft warm wash behind the hero (crown/title/subtitle) — direct
          feedback that the page read as flat/monochrome even after the
          benefit icon chips (pale by design, meant to sit quietly next to
          the icons rather than compete with them). Rather than pushing
          MORE color into every row (this sheet already went through — and
          recovered from — a "too much color, messy" complaint), this is
          ONE contained move: the same accent amber used everywhere else
          on the sheet, fading to fully transparent so it composites
          correctly over either theme's card background.

          It lives HERE, as a direct child of the sheet, not inside the
          ScrollView — an earlier version put the gradient on the hero
          block inside the ScrollView with a negative horizontal margin to
          bleed past StandardModal's 20px side padding. That never worked:
          a ScrollView clips anything that extends past its own frame, so
          the gradient stayed a rounded card inset by 20px on each side
          (confirmed on a real device screenshot, and in hindsight in the
          web screenshots too — I misread those). A follow-up flat "filler"
          strip above it then overlapped the gradient's first stop and
          drew a visibly darker band. One absolutely-positioned layer,
          sibling of the grab handle, is outside the ScrollView's clip and
          needs no seam to match. left/right: 0 is the sheet's outer edge
          (the sheet's paddingHorizontal only affects flow children, not
          absolute ones); the top radius is the sheet's own (30) so the
          wash follows the sheet's corners exactly.

          Its height follows the measured hero block (onLayout below), not
          a fixed number, since the title/subtitle wrap to a different
          number of lines per language; it fades to 0 at the bottom so
          there's never a hard edge either way. pointerEvents none keeps
          it from ever swallowing a tap or the sheet's drag gesture. */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,159,10,0.20)", "rgba(255,159,10,0.05)", "rgba(255,159,10,0)"]}
        locations={[0, 0.55, 1]}
        style={[
          styles.heroWash,
          { height: Math.round(heroHeight + HERO_WASH_TOP_OFFSET + 10) },
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
      <View style={{ maxHeight: bodyMaxHeight, minHeight: 0 }}>
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
          scrollEnabled={contentOverflows}
          onLayout={(e) => setScrollViewH(e.nativeEvent.layout.height)}
          onContentSizeChange={(_w, h) => setScrollContentH(h)}
        >
        {/* Hero block — transparent on purpose, the amber wash behind it is
            the sibling layer at the top of this sheet (see the comment
            there). onLayout reports its height so that layer can size
            itself to it. */}
        <View
          style={styles.header}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0) setHeroHeight((prev) => (Math.abs(prev - h) > 0.5 ? h : prev));
          }}
        >
          <View
            style={[
              styles.crownBadge,
              { backgroundColor: colors.accentAmber },
            ]}
          >
            <Crown size={22} color="#FFFFFF" fill="#FFFFFF" />
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
            one fewer box competing for attention).

            Each row's topic icon sits in a small pastel-EMERALD chip, the
            app's own icon-badge colors. That's deliberate: the sheet's
            amber is PRO's identity (crown, hero wash, selected plan, CTA),
            and with the benefit chips amber too, everything was the same
            pale peach — direct feedback that it read as monocolor. Pale
            amber chips also carried very little contrast (thin amber
            strokes on an amber tint), so the icons looked washed out.
            Emerald is the app's brand color and appears nowhere else on
            this sheet, so it gives the list real contrast and ties the
            paywall back to the rest of the app, while the CTA stays the
            only large saturated block. Rendered four variants side by
            side (current; emerald chips; emerald chips + solid crown;
            deeper amber chips + solid crown) and picked the third.
            Still ONE icon per row — a previous round confirmed a
            check-circle ALONGSIDE an icon read as two icons doing one
            job. The icon is a lucide vector icon, not the emoji the
            translated string still carries (stripped via
            splitLeadingEmoji), matching every other icon on this sheet. */}
        <View style={styles.benefitsList}>
          {PRO_BENEFIT_KEYS.map((key) => {
            const { text } = splitLeadingEmoji(t(key));
            const BenefitIcon = PRO_BENEFIT_ICONS[key];
            return (
              <View key={key} style={styles.benefitRow}>
                <View
                  style={[
                    styles.benefitIconChip,
                    benefitChipStyle,
                  ]}
                >
                  <BenefitIcon size={15} color={benefitIconColor} strokeWidth={2.25} />
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
  // See its own render-site comment. left/right: 0 already means the
  // sheet's outer edge — StandardModal's 20px paddingHorizontal only moves
  // normal-flow children, not absolutely positioned ones (the close button's
  // right: 16 sits 16px from the edge for the same reason). An earlier
  // version used -20 here on the wrong assumption and pushed the wash 20px
  // past the sheet on each side, past the sheet's rounded corner. The top
  // radius is the sheet's own (30). height is supplied at render time from
  // the measured hero.
  heroWash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
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
  // Vertical spacing was trimmed to keep the whole sheet at zero scroll on
  // a standard phone (re-measured with measure-pro-overflow.js after the
  // hero gained its own padding) — keep it in step with that measurement.
  // The amber wash behind this block is a separate layer (see heroWash).
  header: {
    alignItems: "center",
    marginBottom: 8,
    paddingTop: 18,
    paddingBottom: 12,
    paddingHorizontal: 10,
  },
  // Solid amber disc with a white crown and a soft amber glow — the one
  // saturated focal point at the top of the sheet (it used to be a pale
  // outline, so nothing up there drew the eye). backgroundColor comes from
  // colors.accentAmber at render time. The glow sits inside the ScrollView's
  // frame (12px margin + title below), so it isn't clipped.
  crownBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    shadowColor: "#FF9F0A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 5,
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
  planRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
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
  benefitsList: { marginBottom: 14, gap: 2 },
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
