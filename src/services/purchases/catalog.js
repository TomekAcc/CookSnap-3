// What CookSnap PRO sells. The ids here must match the products created in App Store Connect, Google Play Console and
// RevenueCat (see docs/PAYMENTS.md). Prices shown to people come from the store (localized); the FALLBACK_PRICES are only
// what the paywall shows before the store has answered, and what the test (mock) provider offers.

export const ENTITLEMENT_ID = "pro";
export const PLAN_IDS = ["annual", "monthly"];
export const STORE_PRODUCT_IDS = { annual: "cooksnap_pro_annual", monthly: "cooksnap_pro_monthly" };
// RevenueCat's default package identifiers inside the "default" offering.
export const REVENUECAT_PACKAGES = { annual: "$rc_annual", monthly: "$rc_monthly" };

export const FALLBACK_PRICES = {
  annual: { price: "$29.99", perMonth: "$2.50", anchor: "$71.88", trial: true },
  monthly: { price: "$5.99", perMonth: "$5.99", anchor: null, trial: false },
};
