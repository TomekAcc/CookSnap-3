import { ENTITLEMENT_ID, FALLBACK_PRICES, PLAN_IDS, REVENUECAT_PACKAGES } from "./catalog";

/**
 * The real provider: RevenueCat, which talks to StoreKit (iOS) and Google Play Billing (Android) and tells us whether
 * the "pro" entitlement is active. It needs the `react-native-purchases` package in a development or store build (it is
 * not in Expo Go) and an API key per platform; see docs/PAYMENTS.md. The package is required inside a try block, so a
 * build without it still bundles and simply falls back to the test provider.
 */
export function loadPurchasesModule() {
  try {
    const mod = require("react-native-purchases");
    return mod?.default || mod;
  } catch {
    return null;
  }
}

const currency = (value, code) => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(value);
  } catch {
    return `${value.toFixed(2)} ${code}`;
  }
};

export function createRevenueCatProvider({ apiKey, Purchases = loadPurchasesModule() }) {
  if (!Purchases) throw new Error("react-native-purchases is not installed");
  const isPro = (info) => !!info?.entitlements?.active?.[ENTITLEMENT_ID];
  let packages = {};

  return {
    kind: "revenuecat",
    isReal: true,
    async init() {
      Purchases.configure({ apiKey });
    },
    async getOfferings() {
      const offerings = await Purchases.getOfferings();
      const out = {};
      packages = {};
      for (const id of PLAN_IDS) {
        const pkg = offerings?.current?.availablePackages?.find((p) => p.identifier === REVENUECAT_PACKAGES[id]);
        if (!pkg) continue;
        packages[id] = pkg;
        const product = pkg.product;
        const perMonth = id === "annual" ? product.price / 12 : product.price;
        const anchorPackage = offerings.current.availablePackages.find((p) => p.identifier === REVENUECAT_PACKAGES.monthly);
        out[id] = {
          price: product.priceString,
          perMonth: id === "annual" ? currency(perMonth, product.currencyCode) : product.priceString,
          anchor: id === "annual" && anchorPackage ? currency(anchorPackage.product.price * 12, product.currencyCode) : null,
          trial: !!product.introPrice,
        };
      }
      // Anything the store did not return keeps the fallback, so the paywall never shows an empty price.
      return { ...FALLBACK_PRICES, ...out };
    },
    async getStatus() {
      return { isPro: isPro(await Purchases.getCustomerInfo()) };
    },
    async purchase(planId) {
      const pkg = packages[planId];
      if (!pkg) return { status: "unavailable" };
      try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        return isPro(customerInfo) ? { status: "success" } : { status: "error" };
      } catch (err) {
        return err?.userCancelled ? { status: "cancelled" } : { status: "error", message: err?.message };
      }
    },
    async restore() {
      try {
        return isPro(await Purchases.restorePurchases()) ? { status: "restored" } : { status: "none" };
      } catch (err) {
        return { status: "error", message: err?.message };
      }
    },
  };
}
