import { proxyUrl } from "../services/geminiClient";

// The privacy policy and terms are pages on the same server that fronts the AI (/privacy, /terms). Settings > About
// only links to them once they are really published: set EXPO_PUBLIC_LEGAL_LIVE=1 for that build or update (see
// docs/legal/README.md). Until then no row is shown, so nobody taps a link to a page that does not exist.
export const legalLinksLive = () => process.env.EXPO_PUBLIC_LEGAL_LIVE === "1" && !!proxyUrl();
export const privacyPolicyUrl = () => `${proxyUrl()}/privacy`;
export const termsUrl = () => `${proxyUrl()}/terms`;
