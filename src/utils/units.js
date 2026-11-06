import * as Localization from "expo-localization";

/**
 * Measurement system to start from when nothing is saved yet: the device's own
 * setting (expo-localization), falling back to its region. Onboarding no longer
 * makes everyone pick units up front, so a Polish phone has to start on metric
 * rather than on the old US default.
 */
export function detectUnitSystem() {
  try {
    const locale = Localization.getLocales?.()?.[0];
    const system = locale?.measurementSystem;
    if (system === "us") return "us";
    if (system === "metric" || system === "uk") return "metric";
    const region = locale?.regionCode;
    if (region) return ["US", "LR", "MM"].includes(region) ? "us" : "metric";
  } catch {
    // fall through to the historical default
  }
  return "us";
}
