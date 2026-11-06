/**
 * Testing tools (the PRO switch and "replay onboarding" in Settings) are for builds the team tests with:
 * development, and the `preview` update channel, which sets EXPO_PUBLIC_SHOW_TESTING=1 in its EAS
 * environment. A published (production) build has neither, so they are not even rendered there.
 * (`__DEV__` alone is not enough: it is false in every published update, including preview ones.)
 */
export const SHOW_TESTING_TOOLS = __DEV__ || process.env.EXPO_PUBLIC_SHOW_TESTING === "1";
