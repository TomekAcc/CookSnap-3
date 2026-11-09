import { proxyUrl } from "../services/geminiClient";

// The privacy policy, terms and health notice are pages on the same server that fronts the AI (/privacy, /terms,
// /disclaimer, and Polish versions under /pl/...). Settings > About and the PRO screen only link to them once they are
// really published: set EXPO_PUBLIC_LEGAL_LIVE=1 for that build or update (see docs/legal/README.md). Until then no row
// is shown, so nobody taps a link to a page that does not exist. Polish gets the Polish texts, everyone else English.
export const legalLinksLive = () => process.env.EXPO_PUBLIC_LEGAL_LIVE === "1" && !!proxyUrl();
const page = (name, languageId) => `${proxyUrl()}${languageId === "pl" ? "/pl" : ""}/${name}`;
export const privacyPolicyUrl = (languageId) => page("privacy", languageId);
export const termsUrl = (languageId) => page("terms", languageId);
export const disclaimerUrl = (languageId) => page("disclaimer", languageId);
