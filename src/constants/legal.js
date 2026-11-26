import { proxyUrl } from "../services/geminiClient";

// The privacy policy, terms and health notice are pages on the same server that fronts the AI (/privacy, /terms,
// /disclaimer, and Polish versions under /pl/...). Polish gets the Polish texts, everyone else English.
//
// Two switches, both read when the bundle is built (so they change with the next `eas update` / build, no store review):
//  - EXPO_PUBLIC_LEGAL_LIVE=1  shows the legal rows in Settings > About and under the PRO button. Anything else
//    (unset, "0") hides them, so nobody taps a link to a page that does not exist. Switching it off = set it to 0
//    in the EAS environment and publish an update (see docs/legal/README.md, "After publishing").
//  - EXPO_PUBLIC_LEGAL_BASE_URL  optional. Serve the pages from another address (for example a company website)
//    instead of the proxy. Same paths (/privacy, /terms, /disclaimer, /pl/...). No trailing slash needed.
// Fixing the wording of a page needs neither: redeploy the proxy (`cd proxy && npx wrangler deploy`) and every
// installed copy of the app shows the new text at once.
const baseUrl = () => (process.env.EXPO_PUBLIC_LEGAL_BASE_URL || proxyUrl() || "").replace(/\/+$/, "");
export const legalLinksLive = () => process.env.EXPO_PUBLIC_LEGAL_LIVE === "1" && !!baseUrl();
const page = (name, languageId) => `${baseUrl()}${languageId === "pl" ? "/pl" : ""}/${name}`;
export const privacyPolicyUrl = (languageId) => page("privacy", languageId);
export const termsUrl = (languageId) => page("terms", languageId);
export const disclaimerUrl = (languageId) => page("disclaimer", languageId);
