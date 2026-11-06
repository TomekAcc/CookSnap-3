import { Platform } from "react-native";
import { SHOW_TESTING_TOOLS } from "../../config/flags";
import { createMockProvider } from "./mockProvider";
import { createRevenueCatProvider, loadPurchasesModule } from "./revenueCatProvider";

/**
 * Picks the payment provider for this build: RevenueCat when this platform has its API key and the native package is
 * present, otherwise the test provider. Keys are read as literal `process.env.EXPO_PUBLIC_*` names so the bundler can
 * inline them.
 */
export function createProvider({
  platform = Platform.OS,
  keys = { ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY, android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY },
  load = loadPurchasesModule,
  allowFreeActivation = typeof __DEV__ !== "undefined" && (__DEV__ || SHOW_TESTING_TOOLS),
} = {}) {
  const apiKey = (platform === "ios" ? keys.ios : platform === "android" ? keys.android : "") || "";
  const Purchases = apiKey ? load() : null;
  if (apiKey && Purchases) return createRevenueCatProvider({ apiKey, Purchases });
  return createMockProvider({ allowFreeActivation });
}

export const subscriptionManagementUrl = (platform = Platform.OS) =>
  platform === "ios" ? "https://apps.apple.com/account/subscriptions" : platform === "android" ? "https://play.google.com/store/account/subscriptions" : "";
