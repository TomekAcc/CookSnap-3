
// periodUnit/perMonthPrice drive translated display text at render time
// (see PERIOD_SUFFIX_KEY in ProSubscriptionModal) — a plain "/year"/"/mo" literal here was a
// confirmed real bug: every OTHER string on this screen is localized via
// t(), but the price and perMonthValue read directly off this object, so
// the period suffix stayed hardcoded English in every language ("Then
// $29.99/year ($2.50/mo)" inside an otherwise-Polish sentence).
export const PLANS = {
  annual: {
    id: "annual",
    labelKey: "pro.annual",
    badgeKey: "pro.saveBadge",
    price: "$29.99",
    // What the same $5.99/mo would cost paid monthly for a year ($71.88) —
    // shown struck through next to the real price so "SAVE 58%" has a
    // concrete number behind it instead of being an abstract badge claim.
    anchorPrice: "$71.88",
    periodUnit: "year",
    perMonthKey: "pro.annualPerMonth",
    perMonthPrice: "$2.50",
    trial: true,
  },
  monthly: {
    id: "monthly",
    labelKey: "pro.monthly",
    badgeKey: null,
    price: "$5.99",
    periodUnit: "month",
    perMonthKey: "pro.monthlyPerMonth",
    perMonthPrice: "$5.99",
    trial: false,
  },
};

/** The two plans with the prices the store reported (or the fallback) in place of the fixed ones. */
export function plansFromOfferings(offerings) {
  const merge = (plan, o) => (o ? { ...plan, price: o.price, perMonthPrice: o.perMonth || o.price, anchorPrice: o.anchor || undefined, trial: !!o.trial } : plan);
  return { annual: merge(PLANS.annual, offerings?.annual), monthly: merge(PLANS.monthly, offerings?.monthly) };
}
