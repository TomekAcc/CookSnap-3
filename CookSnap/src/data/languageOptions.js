/**
 * Recipe-language list — expanded to cover most major app-market
 * languages (not literally every language on Earth, which isn't a
 * coherent bounded set — thousands exist, many without established app
 * conventions). `id` doubles as the ISO 639-1 code so it matches
 * expo-localization's `languageCode` directly for auto-detection. `name`
 * is shown in the UI in its own language/script; `englishName` is what
 * gets interpolated into the Gemini prompt ("ALL output MUST be in
 * ${englishName}").
 *
 * Ordered by a blend of two real-world signals that genuinely disagree in
 * places: raw speaker population, and general app-market strength (how
 * much a market actually spends on apps — the same reason Apple/Google
 * treat their own language pickers this way, not per-app telemetry, which
 * we don't have). Population alone would bury German, Dutch, Swedish, and
 * Finnish near the bottom, but Germany/Netherlands/Sweden/Finland are
 * consistently among the highest-grossing app markets in the world despite
 * modest populations (Sweden/Finland in particular are major mobile-app
 * industry hubs — Spotify, King, Mojang, Supercell, Rovio) — so those get
 * pulled up well above where population alone would place them. Alphabetical
 * was tried first and reverted: with native-script display names, an
 * alphabetical order doesn't visually explain itself to someone scanning
 * it, even though it technically was sorted (by a hidden English-name key).
 */
export const LANGUAGE_OPTIONS = [
  { id: "en", name: "English", englishName: "English", flag: "🇬🇧" },
  { id: "es", name: "Español", englishName: "Spanish", flag: "🇪🇸" },
  { id: "zh", name: "中文", englishName: "Chinese", flag: "🇨🇳" },
  { id: "ja", name: "日本語", englishName: "Japanese", flag: "🇯🇵" },
  { id: "de", name: "Deutsch", englishName: "German", flag: "🇩🇪" },
  { id: "ko", name: "한국어", englishName: "Korean", flag: "🇰🇷" },
  { id: "hi", name: "हिन्दी", englishName: "Hindi", flag: "🇮🇳" },
  { id: "ar", name: "العربية", englishName: "Arabic", flag: "🇸🇦" },
  { id: "pt", name: "Português", englishName: "Portuguese", flag: "🇵🇹" },
  { id: "fr", name: "Français", englishName: "French", flag: "🇫🇷" },
  { id: "ru", name: "Русский", englishName: "Russian", flag: "🇷🇺" },
  { id: "it", name: "Italiano", englishName: "Italian", flag: "🇮🇹" },
  { id: "nl", name: "Nederlands", englishName: "Dutch", flag: "🇳🇱" },
  { id: "id", name: "Bahasa Indonesia", englishName: "Indonesian", flag: "🇮🇩" },
  { id: "sv", name: "Svenska", englishName: "Swedish", flag: "🇸🇪" },
  { id: "tr", name: "Türkçe", englishName: "Turkish", flag: "🇹🇷" },
  { id: "vi", name: "Tiếng Việt", englishName: "Vietnamese", flag: "🇻🇳" },
  { id: "th", name: "ไทย", englishName: "Thai", flag: "🇹🇭" },
  { id: "pl", name: "Polski", englishName: "Polish", flag: "🇵🇱" },
  { id: "fi", name: "Suomi", englishName: "Finnish", flag: "🇫🇮" },
  { id: "uk", name: "Українська", englishName: "Ukrainian", flag: "🇺🇦" },
  { id: "el", name: "Ελληνικά", englishName: "Greek", flag: "🇬🇷" },
  { id: "da", name: "Dansk", englishName: "Danish", flag: "🇩🇰" },
  { id: "no", name: "Norsk", englishName: "Norwegian", flag: "🇳🇴" },
  { id: "he", name: "עברית", englishName: "Hebrew", flag: "🇮🇱" },
  { id: "cs", name: "Čeština", englishName: "Czech", flag: "🇨🇿" },
  { id: "ro", name: "Română", englishName: "Romanian", flag: "🇷🇴" },
  { id: "hu", name: "Magyar", englishName: "Hungarian", flag: "🇭🇺" },
  { id: "sk", name: "Slovenčina", englishName: "Slovak", flag: "🇸🇰" },
  { id: "bg", name: "Български", englishName: "Bulgarian", flag: "🇧🇬" },
  { id: "hr", name: "Hrvatski", englishName: "Croatian", flag: "🇭🇷" },
];

export const DEFAULT_LANGUAGE_ID = "en";

export function getLanguageById(id) {
  return (
    LANGUAGE_OPTIONS.find((l) => l.id === id) ||
    LANGUAGE_OPTIONS.find((l) => l.id === DEFAULT_LANGUAGE_ID)
  );
}

/**
 * Matches a device locale's language code (e.g. from expo-localization's
 * getLocales()[0].languageCode) to a supported language, falling back to
 * English when the device language isn't in our list. Used once, on
 * first launch (no persisted preference yet) — see CookAIContext.
 */
export function matchDeviceLanguage(languageCode) {
  if (!languageCode) return DEFAULT_LANGUAGE_ID;
  const code = String(languageCode).toLowerCase();
  const match = LANGUAGE_OPTIONS.find((l) => l.id === code);
  return match ? match.id : DEFAULT_LANGUAGE_ID;
}
