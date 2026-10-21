// Every AsyncStorage key the app uses, in one place. Keys are versioned
// ("...:v1"): to change what a key stores in an incompatible way, add a new
// key (":v2") and migrate on read — never reuse the old name.
export const STORAGE_KEYS = {
  // Recipes and inventory
  favorites: "cookai:favorites:v1",
  savedRecipes: "cookai:savedRecipes:v1",
  pantryItems: "cookai:pantryItems:v1",
  ingredients: "cookai:ingredients:v1",
  fridgePhoto: "cookai:fridgePhoto:v1",
  scanHistory: "cookai:scanHistory:v1",
  weeklyPlan: "cookai:weeklyPlan:v1",
  // Preferences
  servings: "cookai:servings:v1",
  hungerLevel: "cookai:hungerLevel:v1",
  unitSystem: "cookai:unitSystem:v1",
  ingredientPriority: "cookai:ingredientPriority:v1",
  recipeLanguage: "cookai:recipeLanguage:v1",
  dietaryRestrictions: "cookai:dietaryRestrictions:v1",
  customDietAvoid: "cookai:customDietAvoid:v1",
  customDietPrefer: "cookai:customDietPrefer:v1",
  theme: "cookai:theme:v1",
  // Entitlement and free-tier limits
  isPro: "cookai:isPro:v1",
  dailyFridgeScans: "cookai:dailyFridgeScans:v1",
  dailyPantryScans: "cookai:dailyPantryScans:v1",
  dailyRecipeGenerations: "cookai:dailyRecipeGenCount:v1",
  // One-time flags
  onboardingComplete: "cookai:onboardingComplete:v1",
  settingsDoneHintShown: "cookai:settingsDoneHintShown:v1",
  firstScanHintShown: "cookai:firstScanHintShown:v1",
  // Append-only signal log — no UI reads this back; it exists so a future
  // analytics pass has real "was this detection right" data (see
  // docs/IMPLEMENTATION_ROADMAP.md #7).
  feedbackLog: "cookai:feedbackLog:v1",
};
