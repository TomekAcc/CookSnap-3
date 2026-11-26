// Every AsyncStorage key the app uses, in one place. Keys are versioned
// ("...:v1"): to change what a key stores in an incompatible way, add a new
// key (":v2") and migrate on read — never reuse the old name.
export const STORAGE_KEYS = {
  // Recipes and inventory
  favorites: "cooksnap:favorites:v1",
  savedRecipes: "cooksnap:savedRecipes:v1",
  // Titles shown in the last 24 hours, so the next batch can differ from them (see utils/recentRecipeTitles.js).
  recentRecipeTitles: "cooksnap:recentRecipeTitles:v1",
  pantryItems: "cooksnap:pantryItems:v1",
  ingredients: "cooksnap:ingredients:v1",
  fridgePhoto: "cooksnap:fridgePhoto:v1",
  scanHistory: "cooksnap:scanHistory:v1",
  // How long this phone's last few scans took, so the progress bar can be paced to the real thing.
  scanTimings: "cooksnap:scanTimings:v1",
  weeklyPlan: "cooksnap:weeklyPlan:v1",
  // Preferences
  servings: "cooksnap:servings:v1",
  hungerLevel: "cooksnap:hungerLevel:v1",
  unitSystem: "cooksnap:unitSystem:v1",
  ingredientPriority: "cooksnap:ingredientPriority:v1",
  recipeLanguage: "cooksnap:recipeLanguage:v1",
  dietaryRestrictions: "cooksnap:dietaryRestrictions:v1",
  customDietAvoid: "cooksnap:customDietAvoid:v1",
  customDietPrefer: "cooksnap:customDietPrefer:v1",
  theme: "cooksnap:theme:v1",
  // Random id created once per install; sent to the Gemini proxy so it can rate-limit per phone.
  deviceId: "cooksnap:deviceId:v1",
  // Help & Feedback messages not yet accepted by the server; retried until they are (see feedbackOutbox.js).
  feedbackOutbox: "cooksnap:feedbackOutbox:v1",
  // Entitlement and free-tier limits
  isPro: "cooksnap:isPro:v1",
  // The test payment provider's remembered subscription (never used by the real provider).
  mockSubscription: "cooksnap:mockSubscription:v1",
  dailyFridgeScans: "cooksnap:dailyFridgeScans:v1",
  dailyPantryScans: "cooksnap:dailyPantryScans:v1",
  dailyRecipeGenerations: "cooksnap:dailyRecipeGenCount:v1",
  dailyRecipeModifications: "cooksnap:dailyRecipeModifyCount:v1",
  // The free sample: uses since install (never refilled), see constants/limits.js
  freeSampleFridgeScans: "cooksnap:freeSampleFridgeScans:v1",
  freeSamplePantryScans: "cooksnap:freeSamplePantryScans:v1",
  freeSampleRecipeGenerations: "cooksnap:freeSampleRecipeGenerations:v1",
  // One-time flags
  onboardingComplete: "cooksnap:onboardingComplete:v1",
  settingsDoneHintShown: "cooksnap:settingsDoneHintShown:v1",
  firstScanHintShown: "cooksnap:firstScanHintShown:v1",
  // Append-only signal log — no UI reads this back; it exists so a future
  // analytics pass has real "was this detection right" data (see
  // docs/IMPLEMENTATION_ROADMAP.md #7).
  feedbackLog: "cooksnap:feedbackLog:v1",
  // Whether the person agreed to their photos going to the AI (see AiConsentContext).
  aiConsent: "cooksnap:aiConsent:v1",
};
