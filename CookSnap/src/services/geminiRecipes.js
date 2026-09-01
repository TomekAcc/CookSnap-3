import { FALLBACK_RECIPES } from "../data/recipes";
import { FULL_DIETARY_OPTIONS } from "../data/dietaryOptions";
import {
  getDishEmojiAndColor,
  getIngredientStyle,
  stampRecipeEmojis,
} from "../utils/imageUtils";
import { getIngredientEmoji } from "../utils/ingredientEmoji";
import { translate } from "../i18n";
import { LANGUAGE_OPTIONS } from "../data/languageOptions";

/**
 * The offline/local-template fallback (buildSmartFallbackRecipes) has no
 * access to the app's React-bound `t()` — it's a plain service function,
 * sometimes called before any component has mounted. It only ever
 * receives `language` as an englishName string (the same convention as
 * every other Gemini call in this file), so it resolves that back to a
 * languageId and calls the same underlying `translate()` the app's `t()`
 * wraps — same dictionaries, same English-fallback-on-missing-key safety.
 */
function fallbackT(language, key, vars) {
  const entry = LANGUAGE_OPTIONS.find((l) => l.englishName === language);
  return translate(entry ? entry.id : "en", key, vars);
}

/** What each active diet forbids — used to make the guardrail concrete
 *  rather than just naming the diet. */
const DIET_FORBIDDEN_HINTS = {
  vegetarian: "meat, poultry, or fish",
  vegan:
    "meat, poultry, fish, dairy, eggs, or any animal-derived ingredient (honey included)",
  gluten_free:
    "wheat, barley, rye, pasta, bread, or any other gluten-containing grain",
  lactose_free:
    "milk, cheese, cream, butter, or any dairy product containing lactose",
  dairy_free: "milk, cheese, cream, butter, yogurt, or any dairy product",
  keto: "sugar, bread, pasta, rice, or other high-carb ingredients",
  nut_free: "peanuts, tree nuts, or any nut-derived ingredient",
  pescatarian: "meat or poultry (fish and seafood remain allowed)",
  diabetic: "high-sugar or high-glycemic ingredients",
};

/**
 * Builds the strict diet/allergy guardrail block from the active
 * dietaryRestrictions map (e.g. { vegan: true, lactose_free: true, ... }).
 * Returns "" when nothing is active so the prompt stays unchanged for the
 * common case. This guardrail OUTRANKS the inventory lock below it — a
 * fridge/pantry item that conflicts with an active restriction must be
 * skipped even though "only use what's in the fridge" would otherwise
 * allow it.
 *
 * `dietaryRestrictions.customAvoid` / `.customPrefer` / `.craving` ride
 * along on the same object rather than as separate params — every one of
 * this function's ~10 call sites already threads `dietaryRestrictions`
 * through untouched, so piggybacking here means zero signature changes
 * anywhere else in the file.
 *
 * customAvoid merges the persisted PRO Custom Diet list with the
 * free-for-everyone one-off "exclude this batch" quick-tag exclusion (see
 * CookAIContext's dietaryRestrictionsWithCustom) and gets the same hard
 * "STRICTLY FORBIDDEN" treatment as the preset diets — also covered by the
 * getDietViolation code-level safety net below, unlike a free-text diet
 * description would be. customPrefer and craving are both soft, separate
 * blocks that steer the model without overriding the guardrail above them
 * — craving is flavor-mood ("spicy", "comforting"), not an ingredient list,
 * so it never goes through the hard-enforcement safety net.
 */
function buildDietaryGuardrail(dietaryRestrictions) {
  const active = FULL_DIETARY_OPTIONS.filter(
    (d) => dietaryRestrictions && dietaryRestrictions[d.id]
  );
  const customAvoid = Array.isArray(dietaryRestrictions?.customAvoid)
    ? dietaryRestrictions.customAvoid
    : [];
  const customPrefer = Array.isArray(dietaryRestrictions?.customPrefer)
    ? dietaryRestrictions.customPrefer
    : [];
  const craving = Array.isArray(dietaryRestrictions?.craving)
    ? dietaryRestrictions.craving
    : [];

  const lines = [
    ...active.map(
      (d) => `- ${d.name}: absolutely NO ${DIET_FORBIDDEN_HINTS[d.id] || d.desc}.`
    ),
    ...(customAvoid.length
      ? [`- User-specified exclusion(s): absolutely NO ${customAvoid.join(", ")}.`]
      : []),
  ];

  const avoidBlock = lines.length
    ? `
═══ ABSOLUTE ALLERGY & DIET GUARDRAIL (HIGHEST PRIORITY — OVERRIDES INVENTORY LOCK) ═══
The user has the following requirement(s) — comply with ALL of them:
${lines.join("\n")}
You are STRICTLY FORBIDDEN from including a forbidden ingredient in any recipe's ingredients OR instructions — even if that exact ingredient was detected in the fridge scan or pantry list. If a fridge/pantry item conflicts with a requirement above, SKIP that item entirely and build the recipe only from the remaining compliant ingredients.
ALL 5 recipes must fully comply with every requirement above. Zero exceptions, regardless of what was scanned.
`
    : "";

  const preferBlock = customPrefer.length
    ? `
═══ INGREDIENT PREFERENCE (SOFT — favor when reasonable, never overrides the guardrail above) ═══
The user would like to see more of these ingredients when they fit the dish: ${customPrefer.join(", ")}. Lean toward using one or more of these across the batch where it makes sense, without forcing them into a dish that wouldn't naturally use them.
`
    : "";

  const cravingBlock = craving.length
    ? `
═══ CRAVING RIGHT NOW (SOFT — apply where it fits, never overrides the guardrail above) ═══
The user is in the mood for: ${craving.join(", ")}. Lean the whole batch toward these flavor notes where it's a reasonable fit for the available ingredients — don't force a dish into a mood it doesn't suit.
`
    : "";

  return `${avoidBlock}${preferBlock}${cravingBlock}`;
}

/**
 * CODE-LEVEL DIET/ALLERGY SAFETY NET — confirmed real failure, not a
 * hypothetical: even with the guardrail above worded as "HIGHEST PRIORITY /
 * STRICTLY FORBIDDEN / Zero exceptions", a live audit requesting a vegan
 * batch got chicken, cheese, milk, and eggs back in 4 of 5 recipes. Prompt
 * wording alone isn't reliable enough for a hard constraint, so every
 * recipe (from Gemini AND from the local fallback templates) gets checked
 * here after the fact — a real ingredient-keyword scan, not just a request.
 *
 * `qualifiers`, when present, are plant-based/gluten-free words that make an
 * otherwise-forbidden term compliant when they appear in the same
 * ingredient string (e.g. "coconut milk" is vegan even though bare "milk"
 * is forbidden) — without this, the checker would reject a large share of
 * genuinely compliant recipes.
 */
const DAIRY_PLANT_QUALIFIERS = [
  "coconut", "almond", "oat", "soy", "soya", "rice", "cashew", "hemp", "pea", "macadamia",
];
const BUTTER_PLANT_QUALIFIERS = [
  "peanut", "almond", "cashew", "cocoa", "shea", "sunflower", "coconut", "apple",
];
const GLUTEN_FREE_QUALIFIERS = [
  "gluten-free", "gluten free", "almond", "rice", "corn", "coconut", "chickpea",
  "buckwheat", "quinoa", "oat", "cassava", "tapioca", "potato", "lentil", "shirataki", "glass",
];

const DAIRY_TERMS = [
  { word: "milk", qualifiers: DAIRY_PLANT_QUALIFIERS },
  { word: "cheese", qualifiers: DAIRY_PLANT_QUALIFIERS },
  { word: "cream", qualifiers: DAIRY_PLANT_QUALIFIERS },
  { word: "butter", qualifiers: BUTTER_PLANT_QUALIFIERS },
  { word: "yogurt", qualifiers: DAIRY_PLANT_QUALIFIERS },
  { word: "yoghurt", qualifiers: DAIRY_PLANT_QUALIFIERS },
  { word: "ghee" },
  { word: "whey" },
  { word: "casein" },
];
const MEAT_POULTRY_TERMS = [
  { word: "chicken" }, { word: "beef" }, { word: "pork" }, { word: "turkey" },
  { word: "bacon" }, { word: "ham" }, { word: "sausage" }, { word: "lamb" },
  { word: "veal" }, { word: "duck" }, { word: "meat" },
];
const FISH_SEAFOOD_TERMS = [
  { word: "fish" }, { word: "salmon" }, { word: "tuna" }, { word: "shrimp" },
  { word: "prawn" }, { word: "crab" }, { word: "lobster" }, { word: "anchovy" }, { word: "anchovies" },
];

// Keto-safe substitutes for these staples that would otherwise false-positive.
const HIGH_GLYCEMIC_QUALIFIERS = [
  "cauliflower", "shirataki", "zucchini", "spaghetti squash", "konjac", "sugar-free", "sugar free",
];
// CODE-LEVEL KETO/DIABETIC SAFETY NET — confirmed real failure, not a
// hypothetical: these two were deliberately left prompt-only (see the old
// comment on getDietViolation below) on the reasoning that keto/diabetic
// are "avoid excess" guidance rather than a binary forbidden-ingredient
// list, unlike vegan/gluten-free/etc. A live verification sweep proved
// that reasoning doesn't hold up in practice — with keto active, 4 of 5
// generated recipes were built around a full serving of pasta, potatoes,
// or white rice as the dish's base, and with diabetic active, ALL 5 were
// — pasta, white bread, white rice, or potatoes appeared as a primary
// ingredient in every single one, completely indistinguishable from an
// unrestricted batch. The model isn't moderating portions of these staples
// under either restriction, it's ignoring them outright, so a keyword
// filter on the clearest, least controversial high-glycemic staples
// (plain rice, pasta, bread, potato, sugar, honey) is the right fix —
// same "code-level safety net" pattern used for every other diet here.
const HIGH_GLYCEMIC_STAPLE_TERMS = [
  { word: "rice", qualifiers: HIGH_GLYCEMIC_QUALIFIERS },
  { word: "pasta", qualifiers: HIGH_GLYCEMIC_QUALIFIERS },
  { word: "noodles", qualifiers: HIGH_GLYCEMIC_QUALIFIERS },
  { word: "bread", qualifiers: HIGH_GLYCEMIC_QUALIFIERS },
  { word: "potato" },
  { word: "potatoes" },
  { word: "sugar", qualifiers: HIGH_GLYCEMIC_QUALIFIERS },
  { word: "honey" },
];

const DIET_FORBIDDEN_TERMS = {
  vegetarian: [...MEAT_POULTRY_TERMS, ...FISH_SEAFOOD_TERMS, { word: "gelatin" }],
  pescatarian: MEAT_POULTRY_TERMS,
  vegan: [
    ...MEAT_POULTRY_TERMS,
    ...FISH_SEAFOOD_TERMS,
    ...DAIRY_TERMS,
    { word: "gelatin" },
    { word: "egg" },
    { word: "eggs" },
    { word: "honey" },
    { word: "mayonnaise" },
    { word: "mayo" },
  ],
  lactose_free: DAIRY_TERMS,
  dairy_free: DAIRY_TERMS,
  gluten_free: [
    { word: "wheat" }, { word: "barley" }, { word: "rye" }, { word: "couscous" },
    { word: "flour", qualifiers: GLUTEN_FREE_QUALIFIERS },
    { word: "bread", qualifiers: GLUTEN_FREE_QUALIFIERS },
    { word: "pasta", qualifiers: GLUTEN_FREE_QUALIFIERS },
    { word: "noodles", qualifiers: GLUTEN_FREE_QUALIFIERS },
    { word: "crouton" }, { word: "breadcrumb" }, { word: "breadcrumbs" },
  ],
  nut_free: [
    { word: "peanut" }, { word: "almond" }, { word: "cashew" }, { word: "walnut" },
    { word: "pecan" }, { word: "pistachio" }, { word: "hazelnut" }, { word: "macadamia" },
    { word: "pine nut" }, { word: "nut" },
  ],
  keto: HIGH_GLYCEMIC_STAPLE_TERMS,
  diabetic: HIGH_GLYCEMIC_STAPLE_TERMS,
};

function matchesForbiddenTerm(lowerText, term) {
  const idx = lowerText.indexOf(term.word);
  if (idx === -1) return false;
  const before = idx > 0 ? lowerText[idx - 1] : " ";
  const afterIdx = idx + term.word.length;
  let after = afterIdx < lowerText.length ? lowerText[afterIdx] : " ";
  // Allow one trailing "s" as a plural (confirmed real gap: "Almonds"
  // wasn't matching the singular "almond" term at all) — a real ingredient
  // list is at least as likely to say "Almonds" or "Walnuts" as the
  // singular form.
  if (after === "s") {
    after = afterIdx + 1 < lowerText.length ? lowerText[afterIdx + 1] : " ";
  }
  const isWholeWord = !/[a-z]/i.test(before) && !/[a-z]/i.test(after);
  if (!isWholeWord) return false;
  if (term.qualifiers && term.qualifiers.some((q) => lowerText.includes(q))) return false;
  return true;
}

/**
 * Scans a recipe's ingredientsList against every active dietary
 * restriction. Returns the first violation found ({ dietId, word,
 * ingredient }) or null when fully compliant. Keyword-based, not perfect —
 * but a keyword miss (false negative) is rare for how specifically these
 * ingredient strings are already formatted ("<Quantity> <Ingredient>
 * <Emoji>"), while the qualifier lists above keep false positives (e.g.
 * "coconut milk", "almond flour") from wrongly rejecting compliant
 * recipes. Covers all 9 PRD dietary restrictions, including keto and
 * diabetic — those two used to be prompt-only on the theory that they're
 * "avoid excess" guidance rather than a binary forbidden-ingredient list.
 * A live verification sweep disproved that in practice: with keto active,
 * 4 of 5 generated recipes were built around a full serving of pasta,
 * potatoes, or rice; with diabetic active, all 5 were. The model wasn't
 * moderating these staples, it was ignoring the restriction outright, so
 * they now share HIGH_GLYCEMIC_STAPLE_TERMS with every other diet here.
 */
export function getDietViolation(ingredientsList, dietaryRestrictions) {
  if (!dietaryRestrictions) return null;
  const activeDietIds = Object.keys(DIET_FORBIDDEN_TERMS).filter(
    (id) => dietaryRestrictions[id]
  );
  // PRO-only user-typed exclusions (see buildDietaryGuardrail above for why
  // these ride along on the same object instead of a new param). Unlike a
  // free-text diet description, a literal ingredient name is exactly what
  // this keyword scanner already knows how to check — no qualifiers, since
  // this is an exact word the user chose to exclude, not a category like
  // "dairy" with legitimate plant-based exceptions.
  const customAvoid = Array.isArray(dietaryRestrictions.customAvoid)
    ? dietaryRestrictions.customAvoid
        .map((w) => String(w || "").trim().toLowerCase())
        .filter(Boolean)
    : [];
  if (activeDietIds.length === 0 && customAvoid.length === 0) return null;

  const items = Array.isArray(ingredientsList) ? ingredientsList : [];
  for (const item of items) {
    const lower = String(item || "").toLowerCase();
    for (const dietId of activeDietIds) {
      for (const term of DIET_FORBIDDEN_TERMS[dietId]) {
        if (matchesForbiddenTerm(lower, term)) {
          return { dietId, word: term.word, ingredient: item };
        }
      }
    }
    for (const custom of customAvoid) {
      if (matchesForbiddenTerm(lower, { word: custom })) {
        return { dietId: "custom", word: custom, ingredient: item };
      }
    }
  }
  return null;
}

/**
 * Filters a list of {name} ingredient objects (scanned fridge items or
 * pantry staples) down to only those compliant with active dietary
 * restrictions — used to keep the LOCAL fallback templates (which have no
 * prompt/guardrail of their own, they just template in whatever's handed to
 * them) from ever surfacing a forbidden ingredient as a fallback recipe's
 * main ingredient.
 */
export function filterItemsForDiet(items, dietaryRestrictions) {
  const list = Array.isArray(items) ? items : [];
  if (!dietaryRestrictions) return list;
  return list.filter((item) => {
    const name = typeof item === "string" ? item : item?.name;
    return !getDietViolation([name], dietaryRestrictions);
  });
}

/**
 * CODE-LEVEL DISHTYPE-DIVERSITY SAFETY NET — same rationale as the diet
 * checker above: the prompt's own STRICT CATEGORY DIVERSITY RULE already
 * says "HARD RULE: no two recipes may share dishType" with a "confirmed
 * real failure" citation, and a live audit still got two separate recipes
 * both tagged dishType "rice" in the same batch. Drops every recipe past
 * the first with a given dishType so enforceExactlyFive backfills a
 * genuinely different one instead. "other" is exempted — it's the app's
 * catch-all bucket, and two dishes can both legitimately land there
 * without actually being similar (unlike two "rice" or "pudding" dishes).
 */
function dedupeDishType(recipes) {
  const seen = new Set();
  return (Array.isArray(recipes) ? recipes : []).filter((r) => {
    const dishType = r?.dishType;
    if (!dishType || dishType === "other") return true;
    if (seen.has(dishType)) return false;
    seen.add(dishType);
    return true;
  });
}

/**
 * CODE-LEVEL CUT/TECHNIQUE-MISMATCH SAFETY NET — same rationale as the
 * diet checker: the new MEAT/POULTRY/SEAFOOD DONENESS & TECHNIQUE prompt
 * rule only partially worked in a live verification pass. It reliably
 * fixed a beef stew's braise time and made a chicken skillet state a real
 * doneness temperature — but a "Savory Garlic Beef Skillet" recipe still
 * used beef chuck (a tough, collagen-rich cut that needs a real braise)
 * in an ~20-minute quick-sear method; the model added an internal
 * temperature check to satisfy the letter of the rule without actually
 * switching to a slow, moist-heat technique. Reaching 145°F tells you the
 * meat is cooked, not that its connective tissue has broken down — a
 * quick-seared chuck at 145°F is still genuinely tough. This is a
 * confirmed real gap prompt wording alone didn't close, so it's checked
 * directly: if a recipe's ingredients name a classic tough/braising cut
 * and its own stated cook time is too short for that cut to actually
 * tenderize, treat it as a violation the same way a diet violation is —
 * drop it and let enforceExactlyFive supply a genuinely different recipe.
 */
const TOUGH_BRAISING_CUT_TERMS = [
  "chuck", "brisket", "shank", "short rib", "shortrib", "oxtail",
  "stew meat", "stewing beef", "pork shoulder", "beef shoulder", "lamb shoulder",
];
const MIN_BRAISE_MINUTES_FOR_TOUGH_CUT = 50;

function parseLeadingMinutes(value) {
  const m = String(value || "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * First of the given time values that actually carries a number, else the
 * fallback. normalizeRecipe stamps a literal "—" in for any time a recipe
 * didn't supply, and "—" is a truthy string — so `a || b || "20 min"` picks
 * the dash and a planner card renders "—" where a real time belongs.
 */
function firstRealTime(values, fallback) {
  for (const v of values) {
    if (parseLeadingMinutes(v) != null) return v;
  }
  return fallback;
}

function hasCutTechniqueMismatch(recipe) {
  const ingredientsText = (Array.isArray(recipe?.ingredientsList) ? recipe.ingredientsList : [])
    .join(" ")
    .toLowerCase();
  const usesToughCut = TOUGH_BRAISING_CUT_TERMS.some((term) => ingredientsText.includes(term));
  if (!usesToughCut) return false;
  const cookMinutes =
    parseLeadingMinutes(recipe?.cookTime) ?? parseLeadingMinutes(recipe?.totalTime);
  if (cookMinutes == null) return false;
  return cookMinutes < MIN_BRAISE_MINUTES_FOR_TOUGH_CUT;
}

/**
 * CODE-LEVEL TITLE/FLAVOR-CONTENT MISMATCH SAFETY NET — same rationale as
 * every other checker in this file: prompt rule 11 (TITLE MUST MATCH
 * ACTUAL CONTENTS) already names this exact failure mode with a concrete
 * example, and it still wasn't reliable enough on its own — a live
 * verification pass produced "Creamy Mushroom Pasta" with an
 * ingredientsList of only flour, mushrooms, onion, and garlic: no cream,
 * milk, cheese, butter, or any dairy/fat at all, so nothing about the dish
 * was actually creamy. Each key below is a descriptor word that implies a
 * specific category of ingredient; if the title uses the word but none of
 * its qualifying ingredients appear anywhere in ingredientsList, the claim
 * is false and the recipe is dropped rather than shown as-is.
 */
const TITLE_FLAVOR_REQUIREMENTS = {
  creamy: ["cream", "milk", "yogurt", "yoghurt", "cheese", "butter", "mascarpone", "ricotta", "coconut milk", "sour cream", "half and half", "half-and-half"],
  cheesy: ["cheese", "cheddar", "mozzarella", "parmesan", "feta", "gouda", "provolone", "ricotta", "brie"],
  buttery: ["butter", "ghee"],
  garlicky: ["garlic"],
  garlic: ["garlic"],
  honey: ["honey"],
  lemony: ["lemon"],
  lemon: ["lemon"],
  spicy: ["chili", "chilli", "cayenne", "jalape", "hot sauce", "sriracha", "pepper flakes", "gochujang", "harissa", "habanero"],
  smoky: ["smoked", "smoke", "chipotle", "bacon", "paprika"],
  maple: ["maple"],
  herbed: ["basil", "parsley", "cilantro", "coriander", "dill", "thyme", "rosemary", "oregano", "mint", "chive", "sage", "herb"],
  // Added after a confirmed real failure: a "Vanilla ___" dessert title
  // with no vanilla anywhere in ingredientsList — this word was simply
  // missing from the list entirely, so the check couldn't have caught it
  // no matter what language the recipe was in.
  vanilla: ["vanilla"],
};

// Confirmed real failure, not a hypothetical, and a second bug on top of
// the missing "vanilla" entry above: this check used to substring-match
// English words (the TITLE_FLAVOR_REQUIREMENTS keys) directly against
// `recipe.title` — but title is written in whatever language the user
// selected. A Polish title using "Cytrynowy"/"Cytryna" (lemon) never
// contains the literal English substring "lemon", so this safety net was
// silently doing nothing for every one of the other 30 languages this app
// supports; only an English-language recipe could ever trigger it. Fixed
// by having the model self-report its own title's flavor claims as a
// small fixed set of ENGLISH tags (titleFlavorWords, normalized below) —
// the same "keep this one field in English internally" pattern already
// used for category/dishType/matchBadge — so the check runs against a
// language-independent signal instead of trying to pattern-match text in
// an unknown language.
function hasTitleFlavorMismatch(recipe) {
  const tags = Array.isArray(recipe?.titleFlavorWords) ? recipe.titleFlavorWords : [];
  if (!tags.length) return false;
  const ingredientsText = (Array.isArray(recipe?.ingredientsList) ? recipe.ingredientsList : [])
    .join(" | ")
    .toLowerCase();
  for (const tag of tags) {
    const requiredTerms = TITLE_FLAVOR_REQUIREMENTS[String(tag || "").toLowerCase()];
    if (!requiredTerms) continue;
    const satisfied = requiredTerms.some((term) => ingredientsText.includes(term));
    if (!satisfied) return true;
  }
  return false;
}

/**
 * CODE-LEVEL FROM-SCRATCH-DOUGH FEASIBILITY SAFETY NET — same rationale
 * again: prompt rule 14 already tells the model not to do this, but a
 * live verification pass produced exactly this failure anyway — a
 * "Creamy Mushroom Pasta" recipe had the user make fresh pasta dough from
 * flour and water, then boil and sauce it, all within a stated 15-minute
 * cookTime. Mixing, resting, rolling, and cutting a real dough is not
 * something a home cook can do in that time, regardless of how the steps
 * are worded. Only fires when the dish is actually pasta/noodles/bread
 * AND flour is used AND no real pasta/noodle/bread product is also listed
 * (i.e. flour is standing in for one, not just flouring a pan) AND the
 * stated time is too short for that to be honest.
 */
const FROM_SCRATCH_DOUGH_DISH_TYPES = new Set(["pasta", "noodles", "bread"]);
const FROM_SCRATCH_DOUGH_MIN_MINUTES = 30;
const REAL_PASTA_BREAD_PRODUCT_RE =
  /(pasta|spaghetti|fettuccine|penne|macaroni|linguine|lasagn|ravioli|noodle|ramen|udon|soba|bread\b|baguette|tortilla|pita|naan|bun\b|roll\b)/i;

function hasUnrealisticFromScratchDough(recipe) {
  if (!FROM_SCRATCH_DOUGH_DISH_TYPES.has(recipe?.dishType)) return false;
  const ingredientsText = (Array.isArray(recipe?.ingredientsList) ? recipe.ingredientsList : [])
    .join(" | ")
    .toLowerCase();
  if (!/\bflour\b/.test(ingredientsText)) return false;
  if (REAL_PASTA_BREAD_PRODUCT_RE.test(ingredientsText)) return false;
  const minutes =
    parseLeadingMinutes(recipe?.cookTime) ?? parseLeadingMinutes(recipe?.totalTime);
  if (minutes == null) return false;
  return minutes < FROM_SCRATCH_DOUGH_MIN_MINUTES;
}

/**
 * CODE-LEVEL OVEN-TEMPERATURE SAFETY NET — same rationale as every other
 * checker in this file: the prompt already has a MANDATORY rule (see
 * "OVEN/STOVE TEMPERATURE REQUIRED" in TEMPERATURE & UNIT ACCURACY) plus
 * two more reinforcements elsewhere in the prompt, all citing the same
 * confirmed real failure — a past "Creamy Tomato Lasagne Bake" said "Bake
 * in the preheated oven for 35 minutes" without ever stating what
 * temperature to preheat to anywhere in the recipe, leaving the user with
 * no idea what to set the oven to. Three separate prompt reinforcements
 * for the same rule is itself a signal that prompt wording alone hasn't
 * been fully reliable here, matching every other checker in this file —
 * so this scans the actual generated steps directly rather than trusting
 * the prompt followed its own instruction. Only fires when the recipe
 * genuinely uses the oven/broiler/grill (matching the prompt rule's own
 * scope) AND no step anywhere states a real temperature.
 */
const OVEN_ACTION_TERMS_RE = /\b(bake|baking|baked|roast|roasting|roasted|broil|broiling|broiled|grill|grilling|grilled)\b/i;
const TEMPERATURE_STATED_RE = /\d{2,3}\s*°\s*[FC]\b|\d{2,3}\s*degrees/i;
// Any step that actually applies heat to something — oven methods plus
// every common stovetop one. Used to gate hasMissingDonenessCue below: a
// recipe with turkey/chicken/salmon in its ingredient list but zero
// cooking actions anywhere in its steps was never bringing that protein to
// a safety-critical temperature in the first place (a deli-turkey
// sandwich, a canned-tuna salad, a smoked-salmon bagel), so there's
// nothing to state a doneness cue for.
// "sauté" is a separate top-level alternative, not inside the shared
// \b...\b group: JS's \b treats "é" as a non-word character, so a trailing
// \b right after "é" never matches (confirmed live — "Sauté the shrimp"
// failed to match while "Sautéing" and the unaccented "saute" both did,
// since those end in plain ASCII letters). The lookaround pair sidesteps
// that instead of relying on \b for this one term.
const HEAT_COOKING_ACTION_RE =
  /\b(cook|cooking|cooked|sear|searing|seared|saute|sauteing|sauteed|pan-fry|pan fry|panfry|fry|frying|fried|grill|grilling|grilled|bake|baking|baked|roast|roasting|roasted|broil|broiling|broiled|boil|boiling|boiled|simmer|simmering|simmered|poach|poaching|poached|braise|braising|braised|steam|steaming|steamed|stir-fry|stir fry|stir-frying|brown|browning|browned)\b|(?<![a-zA-Z])saut(?:é|e)(?:ing|ed)?(?![a-zA-Z])/i;

function hasMissingOvenTemp(recipe) {
  const stepsText = (Array.isArray(recipe?.steps) ? recipe.steps : []).join(" | ");
  if (!OVEN_ACTION_TERMS_RE.test(stepsText)) return false;
  return !TEMPERATURE_STATED_RE.test(stepsText);
}

/**
 * CODE-LEVEL BAKING DISH/PAN SIZE SAFETY NET — same "back up a prompt
 * rule with a real scan" pattern as hasMissingOvenTemp above. Deliberately
 * scoped to vessels a cook would actually need a size for (a casserole,
 * cake, loaf, muffin tin, pie, springform, gratin dish) — NOT a plain
 * baking sheet/tray, since any sheet that fits works for roasting and
 * requiring a size there would be a false positive on a genuinely
 * complete recipe. Only fires when one of those vessels is named in the
 * steps AND no dimension (inches/cm) or capacity (quart/liter) appears
 * anywhere in the steps.
 */
const SIZED_BAKING_VESSEL_RE =
  /\b(baking dish|baking pan|cake pan|loaf pan|casserole dish|casserole pan|muffin tin|muffin pan|springform pan|pie dish|pie pan|gratin dish)\b/i;
const PAN_SIZE_STATED_RE =
  /\d+\s*[x×]\s*\d+|\d+(\.\d+)?[\s-]?(inch|in\.?\b|cm\b|quart|qt\b|liter|litre)/i;

function hasMissingPanSize(recipe) {
  const stepsText = (Array.isArray(recipe?.steps) ? recipe.steps : []).join(" | ");
  if (!SIZED_BAKING_VESSEL_RE.test(stepsText)) return false;
  return !PAN_SIZE_STATED_RE.test(stepsText);
}

/**
 * CODE-LEVEL DONENESS-CUE SAFETY NET — same "back up a prompt rule with a
 * real scan" pattern as hasMissingOvenTemp/hasMissingPanSize above. The
 * prompt's own MEAT/POULTRY/SEAFOOD DONENESS & TECHNIQUE rule #1 already
 * cites a confirmed real failure (a chicken thigh skillet recipe whose
 * only doneness guidance was "simmer for 15 minutes until fully cooked" —
 * a genuine food-safety gap, since undercooked poultry is a real
 * salmonella risk) and is reinforced a second time in the steps-field
 * instructions. Two reinforcements for the same rule is the same signal
 * every other checker in this file was built on — prompt wording alone
 * isn't reliably followed, so this scans the actual steps directly.
 * Reuses MEAT_POULTRY_TERMS/FISH_SEAFOOD_TERMS + matchesForbiddenTerm
 * (the same word-boundary/plural-safe matcher the diet checker uses) to
 * detect whether the recipe contains meat/poultry/fish at all; only fires
 * when it does AND no step anywhere states either a real temperature or
 * one of the specific checkable visual/textural cues the rule requires.
 */
const DONENESS_VISUAL_CUES_RE =
  /(no longer pink|juices run clear|opaque|flakes? easily|no pink remains|firm to the touch|springs? back)/i;

function hasMissingDonenessCue(recipe) {
  const ingredientsList = Array.isArray(recipe?.ingredientsList) ? recipe.ingredientsList : [];
  const containsMeatPoultryFish = ingredientsList.some((item) => {
    const lower = String(item || "").toLowerCase();
    return [...MEAT_POULTRY_TERMS, ...FISH_SEAFOOD_TERMS].some((term) =>
      matchesForbiddenTerm(lower, term)
    );
  });
  if (!containsMeatPoultryFish) return false;
  const steps = Array.isArray(recipe?.steps) ? recipe.steps : [];
  // A recipe with genuinely no steps has a different, unrelated problem —
  // this checker is specifically about doneness cues, not step presence,
  // so it stays out of that call rather than piling an unrelated flag on.
  if (steps.length === 0) return false;
  const stepsText = steps.join(" | ");
  // Confirmed real failure, live-verified: this checker used to fire on
  // any recipe with a meat/poultry/fish ingredient, full stop — including
  // ones that never cook it. A "turkey and cheese sandwich" and a "warm
  // spinach salad with turkey" both use deli turkey cold, straight from the
  // package, with zero cooking steps; both got rejected as missing a
  // doneness cue on every single attempt, which is exactly why a real
  // 6-item turkey/spinach/tomato/cheese/bread/mayo fridge repeatedly
  // produced only 1-2 surviving recipes out of 5 even after 3 retries — the
  // checker was correctly-behaving code enforcing a rule that made no sense
  // for cold prep. A doneness cue only means something when the recipe is
  // actually cooking the protein to a safety-critical temperature.
  if (!HEAT_COOKING_ACTION_RE.test(stepsText)) return false;
  return !(TEMPERATURE_STATED_RE.test(stepsText) || DONENESS_VISUAL_CUES_RE.test(stepsText));
}

const TITLE_STOP_WORDS = new Set([
  "a", "an", "the", "and", "with", "of", "in", "on", "for", "style",
  "fresh", "quick", "easy", "simple", "classic", "homemade", "hearty",
  "light", "new", "warm", "cold",
]);

function significantTitleWords(title) {
  return new Set(
    String(title || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !TITLE_STOP_WORDS.has(w))
  );
}

/**
 * CODE-LEVEL REGENERATE-DUPLICATE SAFETY NET — confirmed real failure:
 * excluding a prior title ("Spinach Cheddar Omelet") from a regenerate
 * request didn't stop the model from returning "Spinach Cheddar Breakfast
 * Skillet" moments later — same core ingredients, same dish, just renamed
 * with one ingredient added. The prompt's own REGENERATE guardrail already
 * says swapping/renaming doesn't count as a fresh batch; this catches it
 * when the model does it anyway. Two or more shared significant words
 * (ingredient/flavor nouns, not filler words like "with" or "fresh") is
 * treated as too similar to count as a genuinely new dish.
 */
function isNearDuplicateOfExcluded(title, excludeTitles) {
  const words = significantTitleWords(title);
  if (words.size === 0) return false;
  return (excludeTitles || []).some((excluded) => {
    let overlap = 0;
    for (const w of significantTitleWords(excluded)) {
      if (words.has(w)) overlap++;
    }
    return overlap >= 2;
  });
}

/**
 * Cook AI Engine recipe generator.
 * Sends fridge scan (scannedIngredients) + pantry staples to Cook AI Vision Engine and ALWAYS
 * asks for exactly 5 distinct creative recipes (never 3 or 4).
 *
 * Goldilocks standard: step COUNT is dynamic (3-5) based on dish
 * complexity — see STEP_COUNT_MIN/MAX below — but every individual step is
 * still a complete imperative sentence ending with a period, never
 * truncated mid-word. ALL output is STRICTLY English; inventory lock on
 * fridge + pantry only.
 */

export const RECIPES_PER_SCAN = 5;
/** Dynamic step-count bounds — quick/cold dishes get the floor, full/complex
 *  dishes get the ceiling. Distinct from GOLDILOCKS_STEP_MIN/MAX below,
 *  which bound each step's own character length, not how many steps exist. */
export const STEP_COUNT_MIN = 3;
export const STEP_COUNT_MAX = 5;
/** Soft floor — short imperative lines are fine; pad only if empty/tiny. */
export const GOLDILOCKS_STEP_MIN = 55;
/**
 * Confirmed real failure, not a hypothetical: padStepToGoldilocks used
 * GOLDILOCKS_STEP_MIN (55) as the trigger for gluing a generic filler
 * clause onto a step — but a real, complete, correct instruction like
 * "Cube tofu and slice red bell pepper into strips." is only 50 characters
 * and got "Taste and adjust seasoning as you go." appended to it, a
 * non-sequitur since nothing is being seasoned while just cutting
 * vegetables. This affected EVERY recipe source that runs through this
 * function — Gemini output, the static curated FALLBACK_RECIPES, and the
 * local ingredient-matching templates alike, not just AI generations.
 * GOLDILOCKS_STEP_MIN's own comment already said "short imperative lines
 * are fine; pad only if empty/tiny" — this constant makes the code actually
 * match that stated intent: only steps this short are genuine fragments
 * that benefit from a completion nudge; anything above it is left alone.
 */
const STEP_PAD_TRIGGER_MIN = 25;
/** Soft ceiling — prefer full sentences over mid-word cuts. */
export const GOLDILOCKS_STEP_MAX = 220;

export const GEMINI_RECIPE_SYSTEM_PROMPT = `
You are an expert Executive Chef for Cook AI. Your goal is to write perfect, professional recipe instructions for everyday home cooking.

CRITICAL LANGUAGE RULE:
The per-request LANGUAGE section below names exactly one human language — titles, category labels, match badges, ingredient names, quantities, and every instruction step MUST be written in that language and that language only, never mixed with any other. This applies ONLY to natural-language text values. It does NOT apply to: JSON field keys (always the literal English key names given in REQUIRED FIELDS, e.g. "title", "steps" — never translate a key name), the "category" field's value (always exactly one of the fixed English tokens: "breakfast" | "lunch" | "dinner" | "snack" | "dessert" — never translated), or the "dishType" field's value (always exactly one of the fixed English tokens listed below — never translated). Those two fields are internal routing values the app matches in code; translating them breaks the app, not just the display.

NATIVE FLUENCY (not literal translation): write every sentence the way a native speaker of that language who cooks for a living would actually say it — not a word-for-word rendering of an English original. Use that language's own natural recipe-writing conventions, idioms, verb forms, and word order; a phrase that is grammatically correct but sounds stilted, foreign, or machine-translated to a native ear is a failure even if every word is technically right. Before finalizing, silently re-read each sentence and ask "would a native speaker actually phrase it this way, or does this read like a translation?" — rephrase anything that reads like the latter.

YOUR GOAL:
Generate exactly 5 distinct, appetizing, and realistic recipes based on the user's detected fridge items and pantry staples.

DIETARY PREFERENCES (userDiets):
Each request may include the user's active dietary restrictions (e.g. { lactose_free: true, vegan: false, gluten_free: true, ... }). When any restriction is active, it is an ABSOLUTE, non-negotiable constraint — every recipe must comply, even if that means leaving a scanned fridge/pantry item out entirely. The per-request prompt below spells out exactly which restrictions are active and what each one forbids; treat that section as higher priority than the inventory lock.

STRICT CULINARY HARMONY & TASTE PAIRING RULES:
1. FLAVOR HARMONY FIRST: Only combine ingredients that naturally taste wonderful together. NEVER force conflicting ingredients into a single dish just to use them up.
2. SMART SUB-SELECTION, NOT A FIXED COUNT: Out of 15-20 detected ingredients, pick however many genuinely belong together in a classic, popular meal — driven by what that real dish actually calls for, never by an artificial target count. A simple dish (a yogurt bowl, a fried egg) may only need 2-3; a properly built stir-fry, curry, or pasta sauce often legitimately needs 6-9 (protein, 2-3 vegetables, aromatics like garlic/onion, a sauce component, seasoning). Do NOT drop a relevant, available ingredient just to keep the list short — an authentic recipe that's missing an ingredient it should have (e.g. a stir-fry with no aromatics, a curry with no spice base) reads as thin and undercooked. Equally, do NOT pad in an irrelevant item just to look fuller. The right number is whatever a real version of that dish actually uses — nothing more, nothing less.
3. POPULAR & LOVED DISHES: Generate dishes people genuinely cook at home (e.g. Creamy Pesto Fettuccine, Fluffy Herb Omelet, Fresh Caprese Salad, Chicken Stir-Fry, Berry Parfait). This applies exactly as much to desserts as to every other category — a dessert should be just as real and well-made as a dinner dish, not an afterthought. When the available ingredients genuinely support a specific, well-known named dish (Tiramisu, Crème Brûlée, Panna Cotta, Cheesecake, a real Trifle), use that real name and treat it as equally valid as a generic descriptive title (e.g. "Berry Yogurt Parfait") — a specifically-named classic is not a special/rare category to reach for over a generic one, nor is it something to avoid in favor of always staying generic. Pick whichever, named or generic, actually and honestly matches what the ingredients support; never force a named classic's title onto a dish that doesn't genuinely have that dish's real components (e.g. never call something "Tiramisu" without coffee and mascarpone/ladyfingers actually present — that is the exact TITLE MUST MATCH ACTUAL CONTENTS failure from rule 11, just applied to a whole dish's identity instead of one descriptor word).
4. NO BIZARRE COMBINATIONS WHEN INVENTORY IS SPARSE: If very few ingredients are available (e.g. only yogurt, jam, or plain eggs), DO NOT force a bizarre or unappetizing combination (like jam stirred into cold yogurt with no logic, or a "yogurt soup"). Instead, elevate what's available into a comforting, popular, classic home dish (e.g. a Sweet Yogurt Bowl with a Jam Swirl, Simple Soft-Boiled Eggs with Buttered Toast, a Classic Omelet).
5. ASSUME BASIC KITCHEN STAPLES: Always assume water, standard cooking oil or butter, salt, and black pepper are available even if not explicitly scanned — use them freely. Do not invent obscure or rare ingredients the user hasn't shown you.
6. ACCURATE TIMES: Prep typically 5-15 min. Cook "0 min" for cold prep, 8-20 min for hot meals. Never invent impossible times.
7. PRECISE PORTIONS: Calculate exact quantities for the requested servings count.
8. NO BEVERAGES AS MEALS: NEVER generate a drink, beer, juice, or simple beverage as a standalone recipe (e.g. no "Beer", "Juice Smoothie", or "Oat Milk Glass" as a lunch/dinner/breakfast dish). Every recipe must be a real, solid, cooked or prepared culinary dish — a smoothie bowl or parfait eaten with a spoon is fine, a glass of something drunk on its own is not.
9. REAL DISH TEST (do this before finalizing every recipe): would a real person recognize this as an actual dish they'd search for, cook, and want to eat — or does it read as an invented mash-up nobody has heard of? If it fails, drop the odd-fitting ingredient rather than force it in, even if that lowers the match count. Specifically: don't drop a savory or vegetable ingredient into a sweet format just because it happens to be on hand — e.g. corn belongs in savory corn fritters or corn cakes, NOT folded into a stack of sweet pancakes meant to be eaten with syrup and butter. Sweet breakfast formats (pancakes, waffles, crepes, parfaits) should only take mix-ins that are conventionally sweet (fruit, chocolate, cinnamon, honey, nuts); savory formats (fritters, hash, frittata, omelet, skillet) are where vegetables and savory add-ins belong.
10. NEVER FABRICATE A MISSING MAIN INGREDIENT UNDER PRESSURE TO FILL 5 RECIPES: the ONLY items you may use beyond the scanned fridge/pantry list are water, cooking oil, butter, salt, and black pepper — nothing else, ever, no matter how sparse the real inventory is. This is a confirmed real failure, not a hypothetical: given only Ketchup + Mustard, a past batch invented "Tofu" and also named a dish "Omelet" that contained no eggs at all; given only Milk + Butter + Parmesan, a past batch invented Eggs and Pasta neither ingredient was in the fridge. Given only Yogurt, a past batch invented Honey and titled the dish "Vanilla Honey Yogurt Bowl" — honey and vanilla are NOT assumed staples (see rule 5's exact list), and the user doesn't own either. All three are unusable to the user — they don't own those ingredients. This mistake is easy to make specifically with common-feeling flavor add-ins (honey, sugar, garlic, vanilla, cinnamon, lemon) that feel "basic" but are NOT on the five-item assumed-staple list — treat them exactly like any other missing ingredient: not allowed unless actually scanned. When the true inventory is this thin, it is far better to write a smaller, simpler, 100%-honest recipe (a seasoned dip, a quick glaze, a simply-prepared single item) using ONLY what's actually available than to invent a fake ingredient — main or flavoring — just to make a fuller-looking dish.
11. TITLE MUST MATCH ACTUAL CONTENTS: never name a dish after a format or ingredient it doesn't really contain — e.g. never call something "Omelet," "Frittata," or "Scramble" unless eggs are genuinely in its ingredientsList. This applies just as strictly to FLAVOR/TECHNIQUE DESCRIPTOR WORDS, not just format words — this is a confirmed real failure, not a hypothetical: a past recipe was titled "Herbed Chicken Skillet" but contained zero herbs anywhere in its ingredientsList or steps (only chicken, onion, garlic, broccoli). A separate past recipe was titled "Creamy Mushroom Pasta" with an ingredientsList of only flour, mushrooms, onion, and garlic — no cream, milk, cheese, butter, or any dairy/fat of any kind, so nothing in the dish was actually creamy. A third, in a non-English recipe, used the target language's own word for "lemon" in the title with no lemon anywhere in ingredientsList; a fourth was a "Vanilla ___" dessert with no vanilla used at all. Before finalizing every title, check each descriptor word (Herbed, Spiced, Garlic, Honey, Lemon, Smoky, Buttery, Cheesy, Creamy, Vanilla, etc. — in whatever language the title is actually written) against the actual ingredientsList — if the word implies an ingredient or quality that isn't genuinely present, either add that real ingredient or remove the word from the title.

TITLE FLAVOR ACCURACY — "titleFlavorWords" FIELD (feeds a code-level check, this is not just a style note): after finalizing each title, translate any flavor/technique descriptor word it uses — in whatever language the title is actually written — into the matching English tag(s) from this fixed list: "creamy", "cheesy", "buttery", "garlicky", "garlic", "honey", "lemony", "lemon", "spicy", "smoky", "maple", "herbed", "vanilla". Put those tags in "titleFlavorWords" (empty array [] if the title makes no such claim — true for most titles). This is separate from the title text itself, which always stays in the recipe's own selected language — this field alone stays in English regardless of language, same as "category"/"dishType"/"matchBadge". Get this right: an app-level check drops any recipe whose titleFlavorWords tag isn't actually backed by a matching ingredient in ingredientsList, so an inaccurate tag here can silently cost the user a recipe that was otherwise fine. Example: a title translating to "Creamy Garlic Chicken", with cream and garlic both genuinely in ingredientsList, → titleFlavorWords: ["creamy", "garlic"]. A title translating to "Vanilla Bean Pudding" with no vanilla in ingredientsList is exactly the failure this exists to catch — either add real vanilla to ingredientsList or rewrite the title to not claim it.
12. "ingredientsList" MUST CONTAIN ONLY REAL INGREDIENT ENTRIES, NEVER AN INSTRUCTION: every string in "ingredientsList" must be exactly "<Quantity> <Ingredient> <Emoji>" — nothing else. This is a confirmed real failure, not a hypothetical: a past oven-based dessert recipe's ingredientsList opened with "Preheat the oven to 350°F. 🫙" as if it were an ingredient — a full instruction sentence with a random pantry emoji, not a quantity+ingredient at all. The preheat instruction belongs ONLY as its own step in "steps", never in "ingredientsList", no matter how central it is to the recipe. Before finalizing, check every ingredientsList entry: if it's a sentence, ends with a period, or names an oven/temperature/action rather than a food item, it does not belong there — remove it.
13. PROOFREAD SPELLING: before finalizing, re-read every title and ingredient name for a genuinely correct spelling of that word in the target language (e.g. "Crepes" not "Crpes") — a dropped or transposed letter in a dish name is a real, visible defect.
14. NO FROM-SCRATCH DOUGH ON A SHORT TIMELINE: if the fridge/pantry has no real pasta, noodles, or bread product, do not invent one by having the user mix flour and water into a dough and roll/cut/knead it — that is a genuine skill- and time-intensive technique (mixing, resting, rolling, cutting) that cannot honestly fit into a quick weeknight cookTime/totalTime. This is a confirmed real failure, not a hypothetical: a past "Creamy Mushroom Pasta" recipe had the user make fresh pasta dough from flour and water from scratch, then boil and sauce it, all within a stated 15-minute cookTime / 25-minute totalTime — not achievable by a home cook. If no real pasta/noodle/bread product was scanned, either write a totally different dish that doesn't need one (a stir-fry, a rice bowl, a skillet) or, if a from-scratch dough dish is genuinely the best fit, give it an honest totalTime (60+ minutes) that actually accounts for mixing, resting, and rolling the dough.

TEMPERATURE & UNIT ACCURACY (MANDATORY — confirmed real failure: a past "Creamy Tomato Lasagne Bake" recipe said "Bake in the preheated oven for 35 minutes" without ever stating what temperature to preheat to anywhere in the recipe — unusable, since the user has no idea what to set the oven to):
1. OVEN/STOVE TEMPERATURE REQUIRED: Any recipe using an oven, broiler, or grill MUST include its own explicit step stating the exact temperature, e.g. "Preheat the oven to 375°F." Never write "bake in the preheated oven" (or roast/broil/grill) without a real temperature having been stated first.
2. SINGLE UNIT SYSTEM ONLY — NEVER SHOW BOTH: Each request specifies exactly one measurement system to use (US customary or Metric) — see the UNIT SYSTEM section in the per-request instructions below. Every temperature and every ingredient quantity in that batch MUST use only that one system. Never mix systems within a recipe, and never write both units for the same value (e.g. never "375°F (190°C)" — pick the one system the request asked for).
3. THE UNIT SYSTEM AND THE RECIPE LANGUAGE ARE INDEPENDENT — TRANSLATE THE UNIT WORD TOO: "US customary" describes which measure SIZES to use (a cup, a tablespoon, a teaspoon), not which language to write them in. When the recipe's selected language is not English, the WORD for that unit must still be written in the target language, exactly like every other ingredient word is — confirmed real failure: a Polish recipe wrote "2 tbsp Masło" and "1/2 cup Ser" left as literal English abbreviations, while the rest of the recipe was correctly in Polish. "g" and "ml" (metric) are the exception — those write the same in virtually every language and should NOT be translated.
4. BAKING DISH/PAN SIZE REQUIRED WHENEVER ONE IS USED: any step that transfers a mixture into a baking dish, cake pan, loaf pan, casserole dish, muffin tin, springform pan, pie dish, or gratin dish MUST state that vessel's size (e.g. "a 9x13-inch baking dish," "an 8-inch round cake pan," "a 2-quart casserole dish," or the metric equivalent when the request is in Metric). A cook can't tell whether their own dish is the right size — and therefore whether the stated bake time will actually apply — if the recipe never says what size it was written for. This does not apply to a plain baking sheet/tray for roasting (no size needed there, any sheet that fits works).

MEAT/POULTRY/SEAFOOD DONENESS & TECHNIQUE (MANDATORY — a real cook's-eye review of live output found genuine culinary defects here, not just cosmetic ones):
1. DONENESS CUE REQUIRED, NOT JUST A TIME: never end a meat, poultry, or seafood cooking step with only a time estimate like "simmer for 15 minutes until fully cooked" — this is a confirmed real failure (a chicken thigh skillet recipe gave exactly this as its only doneness guidance) and a genuine food-safety gap, since thickness and stove variance change actual cook time and undercooked poultry is a real salmonella risk. Every step that finishes cooking meat, poultry, or seafood must pair the time with a real, checkable cue: an internal temperature (165°F/74°C for poultry, 145°F/63°C for whole cuts of pork/beef/lamb, 160°F/71°C for ground meat) OR a clear visual/textural signal ("juices run clear and no pink remains near the bone," "opaque and flakes easily with a fork" for fish, "no longer pink in the center").
2. MATCH TECHNIQUE AND TIME TO THE CUT: this is a confirmed real failure, not a hypothetical — beef chuck (a tough, connective-tissue-heavy braising cut) was used in a "Savory Beef Skillet" recipe with only a quick sear and a 15-minute simmer, nowhere near enough to tenderize it; the result would be chewy and genuinely poorly cooked, not just imperfectly described. Tough/collagen-rich cuts (chuck, brisket, shank, shoulder, short rib, bone-in dark-meat poultry) NEED low, slow, moist-heat cooking — a real braise or stew at a simmer for at least 60-90 minutes, often 1.5-2+ hours for a fully tender result — never a quick 15-20 minute sear-and-serve. Tender cuts (sirloin, tenderloin, ribeye, boneless chicken breast/thighs, fish) are the ones suited to quick high-heat methods (sear, grill, stir-fry, pan-fry). Before finalizing a recipe, check that the named cut and the cook time/technique actually match how that cut is really cooked.
3. STAGGER INGREDIENTS BY THEIR OWN COOK TIME: when a recipe combines a slow-braising meat with a faster-cooking vegetable (e.g., potatoes in a beef stew), do not add both at the very start of a long simmer — that either overcooks the vegetable to mush or forces you to undercook the meat to save it. Add the faster-cooking component partway through the meat's cook time (e.g., in the final 25-30 minutes of a 90-minute braise) so everything finishes tender together.

AROMATICS & SAUCE-BUILDING TECHNIQUE (MANDATORY — confirmed real failure, not a hypothetical: a past cannelloni recipe instructed adding raw onion directly into heavy cream, with the onion never sautéed or cooked first — the result is a harsh, crunchy, undercooked filling instead of a proper sauce, and the step order made no culinary sense):
1. COOK AROMATICS BEFORE ADDING DAIRY OR LIQUID: onion, garlic, shallot, leek, and other aromatics MUST always be sautéed in fat (butter or oil) until softened/translucent BEFORE being combined with cream, milk, cheese, stock, wine, or any other liquid or dairy component. Never write a step that adds a raw, uncooked aromatic directly into cream, milk, or a simmering liquid — that leaves it harsh and undercooked instead of building a real flavor base. The correct order is always: sauté the aromatics first → then add the liquid/dairy → then simmer/reduce to combine.
2. BUILD SAUCES AND FILLINGS IN REAL SEQUENCE: for any pan sauce, cream sauce, or filling that combines aromatics with dairy or stock, the steps must follow how it's actually cooked — soften aromatics, then deglaze or add the liquid, then reduce or simmer to the right consistency — never combine every sauce component in one step regardless of what each one actually needs before it's ready to be mixed in.

OPTIONAL "UPGRADE TIP" — "upgradeIngredient" AND "upgradeNote" FIELDS (RARE, NOT A REQUIRED FIELD — leave both null on most recipes):
The recipe itself must ALWAYS stay strictly limited to the fridge + pantry inventory — see rule 10 above, this never changes. Separately from that, and ONLY when it's genuinely true, you may name ONE real ingredient the user does not have that would make a *meaningfully* better version of this exact dish — never inside "ingredientsList" or "steps", only in these two dedicated fields, purely as an informational aside the app shows separately.
- Set BOTH "upgradeIngredient" (short name, e.g. "Fresh Basil", "Dry White Wine", "Parmesan") AND "upgradeNote" (one short sentence on what it would actually add, e.g. "adds real herbal brightness the dried version can't" or "deglazing with this builds a deeper pan sauce") — or leave BOTH as JSON null. Never fill in one and not the other.
- This is genuinely rare — leave both null on most recipes, especially anything already well-rounded with what's available (a real caprese salad, a good stir-fry with aromatics + protein + sauce already covered). Only set it when a specific, well-known ingredient would make a clear, non-generic difference — never a vague "this would be better with more seasoning" or something that could apply to almost any dish (that's the sign it doesn't belong here).
- NEVER suggest something already effectively present under a different name, and never suggest a base pantry item already assumed available (salt, pepper, cooking oil, basic spices — see PANTRY STAPLES above).

TITLE DISH-TYPE WORD (MANDATORY — confirmed real failure, and this is a hard blocker, not a style preference: given chicken, broccoli, rice, and garlic, a past batch titled the stir-fry "Warm Plate with Broccoli" and a rice-based dish "Rice Toast". Neither is a real dish anyone would recognize, search for, or want to cook — "Plate" names nothing at all, and pairing "Rice" with "Toast" describes no dish that exists. This is the single most common quality failure in this system — check it first, before any other title rule):
- The LAST word of every title (its dish-type word) MUST be a real, specific, recognizable format: Bowl, Skillet, Stir-Fry, Salad, Soup, Curry, Hash, Fritters, Casserole, Sandwich, Wrap, Pasta, Noodles, Rice, Omelet, Frittata, Pancakes, Crepes, Parfait, Pudding, Cake, Toast (ONLY when the dish is genuinely a slice of bread with a topping — never pair it with rice, meat, or anything that isn't a bread-based topping), or similar — never a vague container word that could describe any food: BANNED dish-type words are "Plate", "Dish", "Meal", "Medley", "Delight", "Creation", "Mix", "Bowl of [X]" used generically.
- The dish-type word must genuinely match what's cooked. Before finalizing every title, silently ask: "would a real person recognize this exact combination as a dish that exists?" — if the lead ingredient and the dish-type word together describe nothing real (like "Rice Toast"), rewrite the title entirely using a dish-type word that actually fits what the recipe is (a chicken/broccoli/rice stir-fry is a "Bowl", a "Skillet", or "Fried Rice" — never a "Plate" or "Toast").
- IN A NON-ENGLISH LANGUAGE, TRANSLATE THE CONCEPT, NOT THE NOUN: this word list is English so this rule is easy to check, but it names dish CONCEPTS (a pan-cooked one-dish meal, a bowl-format meal, etc.), not literal nouns to carry into every language unchanged. Confirmed real failure: a Polish title read "Aromatyczna Patelnia z Mięsem" — literally "Aromatic Frying-Pan with Meat," putting the physical cooking vessel as the title's head noun, which is not how a Polish speaker names a dish (a Polish speaker would use "z patelni" — "from the pan" — as a trailing descriptor, if at all, never as the subject of the title). English's "[descriptor] [ingredient] Skillet/Bowl" noun-final pattern does not map word-for-word onto every language's grammar. In each target language, express the same dish concept the way a native speaker actually titles that dish — which may mean a completely different word order, a different part of speech for the "dish-type" idea, or dropping the vessel/format word entirely if that language's own naming convention doesn't lean on it the way English does. Silently re-check every non-English title with the same NATIVE FLUENCY question used elsewhere in this prompt: would a native speaker who cooks for a living actually title a dish this way, or does this read as an English title translated word-for-word?
- UNIVERSAL DISH NAMES STAY AS THEMSELVES — DON'T FORCE-TRANSLATE THEM: some dish names are genuinely international loanwords that native speakers of most languages already use as-is, unchanged, when they cook and talk about that exact dish — Tiramisu, Crème Brûlée, Panna Cotta, Pizza, Lasagna, Paella, Sushi, Ramen, Risotto, Curry, and similar. When a recipe genuinely is one of these (see rule 3's naming guidance above), KEEP that name in its recognized form rather than inventing a native-language equivalent nobody actually uses — a forced native translation of an already-universal name is its own kind of unnatural title, the mirror image of the "Patelnia" failure above. This is a judgment call the same way everything else in NATIVE FLUENCY is: the test is always the same question — what would a real native speaker of the target language actually call this dish out loud? For a genuinely local/regional dish concept (a generic skillet, a bowl, a home-style soup) that has no single internationally-recognized name, use the natural construction in the target language instead, per the rule above.

OTHER TITLE NAMING RULES:
1. LENGTH CAP: 2–4 words. Never more than 4. Titles must fit on one line in a card UI — long titles wrap to two lines and break the visual rhythm of the recipe list.
2. CONSISTENT SHAPE: [optional 1 flavor/prep word] + [1-2 key ingredients] + [dish type]. E.g. "Honey Glazed Salmon", "Spring Onion Omelet", "Creamy Pesto Pasta". Do not stack three-plus descriptors before the dish type (avoid "Creamy Greek Yogurt Walnut Parfait" — prefer "Greek Yogurt Parfait" or "Honey Walnut Parfait").
3. NO INGREDIENT-LISTING: The "matchBadge" field already states how many fridge items are used — the title does not need to enumerate every ingredient. Name the dish, not its full contents.
4. NO "AND"/"WITH" CHAINS: Avoid "X and Y Salad with Z" — pick the single most defining ingredient or flavor instead.
5. NO REPEATED DESCRIPTOR ACROSS THE BATCH (applies to EVERY category — breakfast, lunch, dinner, snack, dessert alike): never reuse the same lead flavor/prep word (e.g. "Sweet") as the first word of more than one title in the same batch, even when several dishes genuinely skew sweet or savory. Pick a distinct descriptor per dish — Caramelized, Honeyed, Spiced, Vanilla, Golden, Zesty, Smoky, Herbed, Buttery, Toasted, Roasted, Savory, Tangy, etc. Five titles that all start with the same word read as lazy, not curated.
6. NO NON-DIFFERENTIATING LEAD INGREDIENT: never lead with an ingredient that's structurally inherent to the dish type and therefore tells the user nothing — e.g. "Flour Crepes" is meaningless (crepes are already flour-based) and reads as bad word order. Lead with what's actually distinctive: the standout flavor, technique, or filling/topping instead (e.g. "Honey Crepes", "Cinnamon Sugar Crepes").

STRICT CATEGORY DIVERSITY RULE:
Across the batch of 5 recipes, use distinct formats (e.g. 1 fruit/yogurt bowl, 1 egg/skillet, 1 pasta or stir-fry, plus other distinct styles). Avoid three near-identical dishes. HARD RULE: no two recipes in the same batch may share the same "dishType" value — this is a confirmed real failure, not a hypothetical: a past dessert batch returned both a "Creamy Strawberry Pudding" and a "Warm Milk Pudding", two separate recipes with dishType "pudding" in the same 5-recipe set. Before finalizing, list out all 5 dishType values and confirm none repeat; if two do, replace the weaker of the two with a genuinely different format.

REGENERATE MUST REACH FOR ACTUALLY DIFFERENT FORMATS, NOT REWORDED ONES: this applies with extra force whenever a REGENERATE guardrail (below) is active. Swapping one ingredient, renaming "Strawberry Pudding" to "Rice Pudding", or reusing the same parfait/crepe/pudding/cake skeleton with new adjectives does NOT count as a fresh batch — this is a confirmed real failure: a past regenerate of a dessert batch returned a parfait, a crepe, a pudding, and a cake again, identical in format to the batch just shown, only the flavor words changed. When the category is constrained (e.g. dessert-only), actively reach across the full range of real formats for that category — bowls/parfaits, baked goods (cake, crumble, cobbler, bars), stovetop creams (pudding, custard, mousse), no-bake bites, fruit-forward preparations (compote, baked fruit, galette) — rather than defaulting to the same few obvious ones every time.

DYNAMIC STEP COUNT (MANDATORY — adapt to dish complexity, do not always use 5):
- Quick / cold dishes (e.g. yogurt bowl, simple salad, sandwich, no-cook snack): EXACTLY 3 steps.
- Standard / pan dishes (e.g. omelet, scrambled eggs, tacos, stir-fry): EXACTLY 4 steps.
- Full / complex dishes (e.g. pasta with sauce, frittata, curry, casserole): EXACTLY 5 steps.
- Never pad a simple dish to 5 steps just to hit a number, and never compress a genuinely multi-stage dish into 3.

STRICT INSTRUCTIONS:
1. STRUCTURE: Follow the DYNAMIC STEP COUNT rule above — 3, 4, or 5 steps depending on the dish, never a fixed number regardless of complexity.
2. TONE: Imperative (command-based). E.g., "Boil the water.", "Saute the onions until golden."
3. READABILITY: Clear, simple English. Prefer two short sentences over one truncated long line.
4. NO TRUNCATION: Never cut off a sentence. Every step MUST end with a period.
5. QUANTITIES: Calculate exact portions for the provided servings.
6. LANGUAGE: the single language named in the per-request LANGUAGE section — titles, ingredients, and steps. (Field keys, "category", and "dishType" stay in their fixed English tokens regardless — see CRITICAL LANGUAGE RULE above.)
7. FORMAT: Return only a clean, valid JSON array — no markdown fences.
8. NO NON-SEQUITUR BOILERPLATE CLAUSES: never tack a generic-sounding tip onto a step it doesn't actually apply to. This is a confirmed real failure, not a hypothetical: "Taste and adjust seasoning as you go" has appeared attached to steps that only slice fruit or toast bread — nothing is being seasoned or tasted at that point — and "Stir occasionally so nothing sticks or burns" has appeared attached to a step that's just heating empty oil or cutting raw vegetables, before anything is even in the pan. Every clause in a step must describe something that is literally true of that exact action — if a clause could be pasted onto almost any step regardless of what it's doing, that's the sign it doesn't belong on this one. Only mention seasoning-to-taste on a step where something is actually being cooked/combined and could genuinely be tasted; only mention stirring-to-prevent-burning on a step where something is actually in a pan over heat.

REQUIRED FIELDS PER RECIPE OBJECT:
- "id": number (1..5)
- "title": Dish Name
- "dishType": one of "pasta" | "noodles" | "bread" | "pancake" | "oatmeal" | "salad" | "omelet" | "eggs" | "coffee" | "chocolate" | "pudding" | "cake" | "sweet_bowl" | "soup" | "rice" | "chicken" | "meat" | "sandwich" | "other" — pick whichever actually matches what the dish IS, independent of the title's wording or language. This drives the app's icon, so it must stay accurate on its own — never infer it should match a specific word in the title.
- "category": "breakfast" | "lunch" | "dinner" | "snack" | "dessert"
- "categoryLabel": English label
- "prepTime": "X min"
- "cookTime": "X min"
- "totalTime": "X min"
- "calories": "X kcal"
- "protein": "Xg" — estimate from the actual ingredientsList quantities, standard nutrition data for each ingredient.
- "carbs": "Xg" — same estimation basis as protein.
- "fat": "Xg" — same estimation basis as protein.
- "matchBadge": English (e.g. "Uses 4 fridge items")
- "titleFlavorWords": array of English tags (from the fixed list: "creamy","cheesy","buttery","garlicky","garlic","honey","lemony","lemon","spicy","smoky","maple","herbed","vanilla") — see TITLE FLAVOR ACCURACY below. Empty array [] on most recipes.
- "servings": "Serves X people"
- "ingredientsList": array of "Quantity Ingredient Emoji" strings (never 📦) — units must match the single selected system per TEMPERATURE & UNIT ACCURACY above, never both.
- "steps": 3 to 5 imperative English strings per the DYNAMIC STEP COUNT rule, each ending with a period. Any recipe using an oven/broiler/grill MUST have its own preheat step with an explicit temperature in the selected system — never assume the oven is already hot. Any step naming a baking dish/cake pan/loaf pan/casserole dish/muffin tin/pie dish MUST state that dish's size right there — never just "pour into a baking dish."
- "upgradeIngredient" / "upgradeNote": optional, JSON null on most recipes — see OPTIONAL "UPGRADE TIP" above.
`;

/** Local Soft UI stamp — emoji + vectorType via stampRecipeEmojis. */
function stampRecipeVisuals(recipes) {
  return stampRecipeEmojis(recipes);
}

/** Pad / trim so every successful generation yields exactly `count` emoji-stamped recipes. */
// Which of the 5 static FALLBACK_RECIPES' own categories are actually
// edible as a stand-in for a given requested mealType. Confirmed real
// failure, live-verified: enforceExactlyFive used to force-relabel EVERY
// filler's `category` to the requested mealType regardless of what the
// dish actually is — so a "dinner" request that ran out of real AI
// recipes on regenerate got served "Sweet Jam and Butter Toast Snack"
// (breakfast) and "Apple Yogurt Dessert Parfait" (dessert), both simply
// re-tagged "dinner". Relabeling a string doesn't make jam toast a
// reasonable dinner suggestion. A savory egg/stir-fry/pasta dish reads
// fine across breakfast/lunch/dinner; a dessert or a sweet snack doesn't
// belong as any savory meal's stand-in, so those are excluded rather than
// relabeled.
const FALLBACK_MEALTYPE_COMPATIBILITY = {
  breakfast: ["breakfast", "snack"],
  dinner: ["lunch", "dinner"],
  dessert: ["dessert", "snack"],
  lunch: ["lunch", "dinner"],
  snack: ["breakfast", "snack"],
};

function isFallbackCompatibleWithMealType(fillerCategory, mealType) {
  if (!mealType || mealType === "all") return true;
  const compatible = FALLBACK_MEALTYPE_COMPATIBILITY[fillerCategory];
  return compatible ? compatible.includes(mealType) : true;
}

// allowPadding controls what happens when fewer than `count` recipes
// survive filtering:
// - true (buildSmartFallbackRecipes' own call, used only by the offline
//   Meal Planner inventory builder — never by AI recipe generation): pad
//   up to `count` with the curated static pool and, if that's still
//   short, the synthetic "Quick Fridge Bowl" filler. The Planner's cards
//   are explicitly inventory-derived suggestions, not claimed to be
//   AI-personalized, so padding them is honest.
// - false (generateRecipesWithGemini's call, the normal path): return
//   however many real, filtered AI recipes survived — 1 through count,
//   never padded. A user asked for this directly: showing 3 or 4 honest,
//   fridge-personalized recipes beats topping a batch up to a fixed
//   number with a generic recipe wearing an "isSmartFallback" flag and a
//   banner explaining it isn't really personalized. The empty-batch case
//   (zero real recipes survive at all) and total request failure are both
//   thrown as GeminiRecipeError instead of silently swapping in fake
//   recipes — CookAIContext surfaces that as an honest "couldn't
//   generate" state rather than ever showing fabricated recipes as real.
function enforceExactlyFive(recipes, mealType, servings = 2, count = RECIPES_PER_SCAN, dietaryRestrictions = null, excludeTitles = [], scannedIngredients = [], allowPadding = true) {
  const incoming = Array.isArray(recipes) ? recipes : [];
  // Filter BEFORE trimming to `count` — a violating recipe dropped here
  // must still trigger the padding path below, not just quietly shrink a
  // batch that already looked "full enough" before the filter ran.
  const dietSafeIncoming = dietaryRestrictions
    ? incoming.filter((r) => !getDietViolation(r?.ingredientsList, dietaryRestrictions))
    : incoming;
  const batch = dietSafeIncoming.slice(0, count);
  if (batch.length >= count || !allowPadding) {
    return stampRecipeVisuals(batch);
  }

  const fillers = (FALLBACK_RECIPES || [])
    .filter((r) => isFallbackCompatibleWithMealType(r.category, mealType))
    .map((r, i) =>
    normalizeRecipe(
      {
        ...r,
        title: r.title,
        // Keep the filler's own true category — see
        // FALLBACK_MEALTYPE_COMPATIBILITY above for why this no longer
        // force-relabels every filler to the requested mealType.
        category: r.category,
        matchBadge: r.matchBadge || "Uses fridge staples",
        ingredientsList: Array.isArray(r.ingredients)
          ? r.ingredients.map(
              (ing) =>
                `${ing.amount}${ing.unit ? ` ${ing.unit}` : ""} ${ing.name}`
            )
          : Array.isArray(r.ingredientsList)
            ? r.ingredientsList
            : [],
        // Confirmed real bug: RAW_RECIPES entries never set this field, so
        // `...r` above left it undefined and normalizeRecipe's `!!safe.
        // isSmartFallback` computed false — every one of these pre-authored
        // static recipes was silently reporting as real AI output. That's
        // exactly backwards for the two things that key off this flag: the
        // RecipeFeed "not AI-personalized" notice never fired for them, and
        // (this is the one that actually explains "recipes feel repetitive
        // on regenerate") a user has no way to tell they're seeing the same
        // handful of canned recipes rather than fresh AI ideas.
        isSmartFallback: true,
      },
      batch.length + i,
      mealType,
      servings
    )
  );

  const merged = [...batch];
  for (const filler of fillers) {
    if (merged.length >= count) break;
    if (merged.some((r) => r.title === filler.title)) continue;
    // Static filler recipes have no diet-awareness of their own (they're
    // pre-authored, not built from the user's real inventory) — skip any
    // that would violate an active restriction rather than let a padding
    // recipe silently reintroduce the exact problem this function exists
    // to guard against.
    if (getDietViolation(filler.ingredientsList, dietaryRestrictions)) continue;
    // Confirmed real failure, not a hypothetical: this static 5-recipe
    // pool has no awareness of `excludeTitles` on its own, so 4 rounds of
    // regenerating in a row (each round dropping more Gemini recipes to
    // the near-duplicate/dishType filters above, which is working as
    // intended) fell back to this same padding path every time and
    // recycled the EXACT same static recipes verbatim, round after round
    // — by round 4 every single recipe in the batch was a repeat from an
    // earlier round. Skipping anything already excluded here is what
    // actually stops that; the earlier per-batch title check above only
    // ever caught same-batch collisions, not cross-regenerate repeats.
    if ((excludeTitles || []).includes(filler.title)) continue;
    merged.push(filler);
  }

  // Confirmed real failure, not a hypothetical: this synthetic last-resort
  // filler numbered itself purely from `merged.length` (always 1, 2, 3...
  // within a single call), so it generated the exact same "Quick Fridge
  // Bowl 1"-"5" titles on every regenerate — reached constantly once a
  // small inventory's real ideas run out after a few rounds of excluding
  // prior titles. An independent counter continuing from the highest
  // number already excluded (not tied to `merged.length`, which shifts
  // between calls depending on how many real/curated recipes happened to
  // survive first) is what actually keeps every round's numbers unique —
  // an earlier version based the offset on merged.length too, which still
  // collided whenever two rounds reached the synthetic tier with a
  // different number of real recipes already in `merged`.
  const priorFridgeBowlNumbers = (excludeTitles || [])
    .map((t) => t.match(/^Quick Fridge Bowl (\d+)$/)?.[1])
    .filter(Boolean)
    .map(Number);
  let nextFridgeBowlNumber =
    (priorFridgeBowlNumbers.length ? Math.max(...priorFridgeBowlNumbers) : 0) + 1;
  // Confirmed real failure, live-verified: this last-resort filler never
  // set ingredientsList at all, so a user who actually opened one of these
  // cards saw a title and three generic prep-motion steps ("Prep and
  // portion every ingredient...") with no ingredient list whatsoever —
  // about as close to an empty/broken recipe card as this app ships.
  // Pulling in a few of the user's own real scanned items (diet-filtered,
  // same as every other filler above) at least grounds it in what's
  // actually in their fridge instead of being content-free.
  const fridgeNamesForBowl = (scannedIngredients || [])
    .map((it) => (typeof it === "string" ? it : it?.name))
    .filter(Boolean)
    .filter((name) => !getDietViolation([name], dietaryRestrictions));

  while (merged.length < count) {
    // Rotate which 4 fridge items each bowl gets (instead of always the
    // same first 4) so back-to-back "Quick Fridge Bowl" cards in one
    // batch — or across regenerates, since the number keeps climbing —
    // don't show up with the literal same ingredient list under a
    // different number.
    const windowSize = Math.min(4, fridgeNamesForBowl.length);
    const offset =
      fridgeNamesForBowl.length > 0
        ? ((nextFridgeBowlNumber - 1) * 2) % fridgeNamesForBowl.length
        : 0;
    const bowlIngredients = Array.from({ length: windowSize }, (_, k) =>
      fridgeNamesForBowl[(offset + k) % fridgeNamesForBowl.length]
    );
    // Confirmed real failure, live-verified: this filler pulls in real
    // fridge items (fix above) but never set its own `steps`, so it always
    // fell through to enforceGoldilocksSteps' generic 3-line prep/heat/
    // aromatics template below — which has no doneness cue. Every other
    // safety-net check in normalizeAndFilter (including
    // hasMissingDonenessCue) only runs on the Gemini batch, before this
    // synthetic filler even exists, so a bowl built from real chicken/beef/
    // fish never got flagged. Giving it an explicit real cue here, whenever
    // its pulled-in ingredients contain meat/poultry/fish, closes that gap
    // at the source instead of trying to filter a filler recipe out after
    // the fact (there's nothing to top it up with at this point).
    const bowlHasMeatOrFish = bowlIngredients.some((name) => {
      const lower = String(name || "").toLowerCase();
      return [...MEAT_POULTRY_TERMS, ...FISH_SEAFOOD_TERMS].some((term) =>
        matchesForbiddenTerm(lower, term)
      );
    });
    merged.push(
      normalizeRecipe(
        {
          title: `Quick Fridge Bowl ${nextFridgeBowlNumber}`,
          category: mealType === "all" ? "lunch" : mealType,
          isSmartFallback: true,
          ingredientsList: bowlIngredients,
          ...(bowlHasMeatOrFish
            ? {
                steps: [
                  "Prep and portion every ingredient on a clean board.",
                  "Heat a lightly oiled pan over medium until it shimmers, then cook any meat, poultry, or fish first, stirring occasionally, until opaque throughout and any juices run clear.",
                  "Add the remaining aromatics and vegetables and stir until fragrant and lightly golden.",
                ],
              }
            : {}),
        },
        merged.length,
        mealType,
        servings
      )
    );
    nextFridgeBowlNumber += 1;
  }

  return stampRecipeVisuals(merged.slice(0, count));
}

// generateRecipesWithGemini tries up to 2 candidate models in sequence on
// failure (buildCandidateUrls), each now retried once in place on a
// failure (see the retry right below this in the candidateUrls loop) — so
// the real worst-case wait before falling back to the local heuristic is
// up to 4x this value, not 2x. 45s here once meant up to 90s of a caller's
// loading spinner with no feedback, which read as a frozen screen rather
// than a slow one (confirmed directly: Meal Planner's per-day
// Generate/Swap, a single small inline spinner with no other visual
// activity, was reported as "freezing"). That same "look frozen" risk is
// exactly why this ISN'T pushed much higher even after a confirmed real
// fallback on an actual device — live timing of the exact inventory that
// triggered it (see the retry comment below) showed a normal successful
// call finishing in ~13s, well inside even the OLD 20s budget, so the
// failure was a genuine blip, not this timeout being routinely too tight.
// The retry is the real fix for a blip; this only moved from 20s to 25s —
// modest extra headroom for a slow mobile connection, not a rewrite of
// the "don't let it look frozen" budget that 20s was chosen to protect.
const REQUEST_TIMEOUT_MS = 25000;

const KNOWN_MEAL_TYPES = new Set([
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "dessert",
]);

/** Mirrors DISH_TYPE_TO_EMOJI in imageUtils.js — kept in sync manually
 *  since one is prompt-facing text and the other is a JS object literal. */
const KNOWN_DISH_TYPES = new Set([
  "pasta",
  "noodles",
  "bread",
  "pancake",
  "oatmeal",
  "salad",
  "omelet",
  "eggs",
  "coffee",
  "chocolate",
  "pudding",
  "cake",
  "sweet_bowl",
  "soup",
  "rice",
  "chicken",
  "meat",
  "sandwich",
  "other",
]);

export class GeminiRecipeError extends Error {}

function buildPrompt(
  fridgeList,
  pantryListText,
  mealType,
  servings,
  hungerLevel,
  dietaryRestrictions,
  recipeCount = RECIPES_PER_SCAN,
  mainMealsOnly = false,
  excludeTitles = [],
  unitSystem = "us",
  language = "English",
  usedDishTypes = []
) {
  const isMetric = unitSystem === "metric";
  const isEnglish = language === "English";
  const mealTypeConstraint = mainMealsOnly
    ? `ALL ${recipeCount} recipes MUST be substantial "lunch" or "dinner" category main meals. Never "breakfast", "snack", or "dessert".`
    : mealType !== "all" && KNOWN_MEAL_TYPES.has(mealType)
      ? `ALL ${recipeCount} recipes MUST have "category" set to "${mealType}". Do not suggest dishes from other meal categories.`
      : `Recipes may vary across categories ("breakfast", "lunch", "dinner", "snack", "dessert") but each must still be realistic for the available ingredients.`;

  const dietaryGuardrail = buildDietaryGuardrail(dietaryRestrictions);

  // Ingredient Source Priority (Settings) — another field riding along on
  // the same dietaryRestrictions object, same reasoning as customAvoid/
  // customPrefer/craving in buildDietaryGuardrail: zero signature changes
  // needed elsewhere. Soft steering only (which list to lean on), never a
  // hard exclusion — the INVENTORY LOCK below already forbids inventing
  // anything not in either list, so this only changes the MIX, not what's
  // allowed at all.
  const ingredientPriority = dietaryRestrictions?.ingredientPriority;
  const ingredientPriorityLine =
    ingredientPriority === "fridge"
      ? `\n- INGREDIENT SOURCE PRIORITY: the user wants fresh fridge ingredients prioritized. Build each dish around the fridge items as the main components (protein, vegetables, base) — use pantry staples only as supporting seasoning/oil/base rather than a dish's primary ingredient, unless the fridge list is too sparse to build a real dish without leaning on pantry more.`
      : ingredientPriority === "pantry"
        ? `\n- INGREDIENT SOURCE PRIORITY: the user wants long-lasting pantry staples prioritized. Build each dish around the pantry staples as the main components — use fresh fridge ingredients as supporting/secondary where they fit, rather than the dish's primary focus, unless the pantry list is too sparse to build a real dish without leaning on fridge items more.`
        : "";

  const cleanExcludeTitles = Array.isArray(excludeTitles)
    ? excludeTitles.map((t) => String(t || "").trim()).filter(Boolean)
    : [];
  const regenerateGuardrail = cleanExcludeTitles.length
    ? `═══ REGENERATE — MUST BE A FRESH BATCH (MANDATORY) ═══
The user tapped "Regenerate" because they want ALL-NEW ideas, not the same recipes back again. The previous batch was: ${cleanExcludeTitles
        .map((t) => `"${t}"`)
        .join(", ")}. Every recipe in THIS batch must be a genuinely different dish from every one of those — not the same dish with a renamed title, not the same core ingredient pairing with one item swapped, not the same format (e.g. don't just turn "Garlic Herb Skillet Eggs" into "Onion Herb Skillet Eggs" — pick a different cooking method or dish type entirely, using different ingredients from the available inventory where possible). If you'd genuinely reach for the same dish again as the single best fit for the inventory, choose the next-best genuinely different one instead. THIS APPLIES TO THE WHOLE NEW BATCH AS A SET, NOT JUST EACH RECIPE AGAINST THE OLD LIST — this is a confirmed real failure: a past dessert regenerate returned a parfait, a crepe, a pudding, and a cake again, the exact same four formats as the batch it was replacing, just with different flavor words. Reusing the previous batch's overall shape with new adjectives is not a fresh batch.\n`
    : "";

  // Tells a top-up/shortfall call which dishType formats the OTHER recipes
  // already kept in this same batch used — not just which titles to avoid.
  // Confirmed real gap: the regenerate guardrail above only lists old
  // TITLES, so a top-up call asked to replace 1 dropped recipe had no way
  // to know the 4 recipes already kept included, say, a "stir_fry" — it
  // could pick a brand-new title that's still a stir-fry, pass the title
  // check, and then get thrown out anyway by the code-level dishType dedup
  // in the caller, burning the attempt for nothing. Naming the taken
  // dishTypes directly lets the model dodge that collision up front instead
  // of discovering it after the fact.
  const cleanUsedDishTypes = Array.isArray(usedDishTypes)
    ? [...new Set(usedDishTypes.map((d) => String(d || "").trim()).filter(Boolean))]
    : [];
  const usedDishTypesGuardrail = cleanUsedDishTypes.length
    ? `═══ DISH FORMATS ALREADY USED IN THIS BATCH (MANDATORY) ═══
The other recipes already kept for this same batch have these "dishType" values: ${cleanUsedDishTypes
        .map((d) => `"${d}"`)
        .join(", ")}. None of the recipe(s) you generate now may use any of these dishType values — pick a genuinely different format from the real range available for this meal, not just a different title on the same format.\n`
    : "";

  const withinCategoryFormats = {
    dessert:
      "bowls/parfaits, baked goods (cake, crumble, cobbler, bars), stovetop creams (pudding, custard, mousse), no-bake bites, fruit-forward preparations (compote, baked fruit, galette)",
    breakfast:
      "egg dishes, batter-based (pancakes, waffles, crepes), grain bowls (oatmeal, overnight oats), yogurt/fruit bowls, savory hash or skillet",
    snack:
      "dips/spreads with something to dip, energy/no-bake bites, toast-based, small skillet bites, fruit or yogurt-based",
    lunch:
      "pasta, stir-fry, skillet, soup/stew, hearty salad, wrap or sandwich, grain bowl",
    dinner:
      "pasta, stir-fry, skillet, soup/stew, casserole/bake, sheet-pan roast",
  };

  const diversityOrMainMealsRule = mainMealsOnly
    ? `═══ ABSOLUTE RULE FOR WEEKLY MEAL PLANNER (MANDATORY) ═══
Generate ONLY substantial, savory, satisfying main meals (lunches and dinners) like pastas, stir-fries, skillet bakes, soups, and hearty salads. STRICTLY FORBIDDEN: do NOT include sweet desserts, sugary breakfast bowls, parfaits, or pancakes anywhere in this batch. Every single recipe must be a proper, comforting home-cooked meal — vary the cooking style (pasta, stir-fry, skillet, soup/stew, hearty salad, casserole/bake) across the batch so it doesn't feel repetitive, but never break the savory-main-meal rule to do so.`
    : mealType !== "all" && KNOWN_MEAL_TYPES.has(mealType)
      ? `═══ STRICT WITHIN-CATEGORY DIVERSITY RULE (MANDATORY) ═══
Every recipe here is locked to the single category "${mealType}" (see MEAL TYPE CONSTRAINT above), so the usual cross-category mixing isn't possible — diversity instead means genuinely different FORMATS within "${mealType}". No two recipes in this batch may share the same "dishType". Actively reach across the real range of formats "${mealType}" actually has — for example: ${withinCategoryFormats[mealType] || "vary cooking method, protein/base, and flavor profile as widely as the inventory allows"}. Do not default to the same 3-4 "obvious" dishes for this category every time — that collapse is the single most common failure, especially on a regenerate.`
      : `═══ STRICT DIVERSITY RULE (MANDATORY) ═══
When generating exactly ${recipeCount} recipes, mix distinct categories: include at least one fresh fruit / dessert / cold cream or yogurt bowl when produce or dairy allows, plus skillet/egg, pasta or stir-fry, and protein or soup — never multiple of the exact same category. Avoid titles that all map to the same dish emoji.`;

  return `
CRITICAL HARD RULE: You MUST return EXACTLY ${recipeCount} distinct creative recipes in the JSON array — never fewer, never more. The array length MUST be exactly ${recipeCount} every single time.
${dietaryGuardrail}
Create exactly ${recipeCount} distinct, appetizing recipes for everyday home cooking based STRICTLY on these fridge ingredients: [${fridgeList || "Eggs, Milk, Vegetables"}] and pantry staples: [${pantryListText}]. Do not invent major ingredients not provided. Any inventory item that conflicts with the diet guardrail above must be left out.

MEAL TYPE: ${mealType}
MEAL TYPE CONSTRAINT: ${mealTypeConstraint}
SERVINGS: ${servings}
HUNGER LEVEL: ${hungerLevel} ("light", "normal", "hungry")

${regenerateGuardrail}${usedDishTypesGuardrail}═══ CULINARY HARMONY (MANDATORY) ═══
- Select ONLY ingredients that pair harmoniously in flavor for each dish.
- Do NOT force unrelated ingredients into one dish just to use them up.
- From a long fridge list, pick however many items genuinely belong in that classic meal — not a fixed count. A simple dish may only need 2-3; a proper stir-fry, curry, or pasta sauce often legitimately needs 6-9 (protein, vegetables, aromatics, sauce, seasoning). Never drop a relevant available ingredient just to keep the list artificially short, and never pad in an irrelevant one just to look fuller — match whatever a real version of that dish actually uses.
- Ensure dishes are well-known, comforting, and delicious (e.g. skillet scrambles, pastas, salads, wraps, parfaits, stir-fries, omelets).
- REAL DISH TEST: before finalizing each recipe, ask "would a real person recognize this as an actual dish and want to eat it?" If not, drop the odd-fitting ingredient instead of forcing it in, even if that lowers the match count. Do not drop a savory/vegetable ingredient into a sweet format just because it's on hand (e.g. corn belongs in savory corn fritters/corn cakes, NOT folded into sweet pancakes meant for syrup). Sweet breakfast formats (pancakes, waffles, crepes, parfaits) only take conventionally sweet mix-ins (fruit, chocolate, cinnamon, honey, nuts); vegetables and savory add-ins belong in savory formats (fritters, hash, frittata, omelet, skillet) instead.
- Prep/cook times must be realistic (prep typically 5–15 min; cook "0 min" for cold prep, ~8–20 min for hot meals).
- NEVER output a beverage, drink, beer, juice, or "glass of X" as a standalone recipe — every recipe must be a real cooked or prepared dish, not something simply poured and drunk.

═══ LANGUAGE (MANDATORY — ${language.toUpperCase()} ONLY) ═══
- The user's selected recipe language is: ${language}. ALL natural-language text fields ("title", "servings", "ingredientsList" ingredient names, "steps") MUST be written in ${language} and ${language} only — ${isEnglish ? "never any other language" : `never English, never any language other than ${language}`}. This is not optional for any one of these fields individually — do not leave "servings" in English while translating the rest, or vice versa. ("categoryLabel" and "matchBadge" are never shown to the user — leave them in English, it doesn't matter either way.)${isEnglish ? "" : ` Write it the way a native ${language}-speaking chef would naturally say it, not a literal translation of an English sentence — natural word order, natural verb choice, natural recipe phrasing for ${language}, even where that means restructuring the sentence rather than translating it word-for-word.`}
- Two fields are the ONLY exception and stay in their fixed English tokens regardless of the language above, because the app matches them in code: "category" (one of "breakfast"|"lunch"|"dinner"|"snack"|"dessert") and "dishType" (one of the fixed tokens in REQUIRED FIELDS). Do not translate either one.
- "title": appetizing catchy dish name in ${language} (MANDATORY). 2-4 words max, one flavor/prep word plus 1-2 key ingredients plus dish type — see TITLE NAMING RULES above (the naming SHAPE applies in any language; only the words themselves change). Never list every ingredient in the title. Across this batch of ${recipeCount}, every title's lead descriptor word must be DIFFERENT — do not open two or more titles with the same flavor/prep word, even if several dishes share a quality like sweetness. The title's LAST word (its dish-type word) must be a real, specific, recognizable format that genuinely matches what's cooked — never a vague word like "Plate", "Dish", or "Meal", and never paired with a lead ingredient that makes no real dish (see the TITLE DISH-TYPE WORD block above — this is the single most common quality failure, check it for every title before finalizing).
- Never invent ingredients outside the inventory lists above.

═══ INVENTORY LOCK (MANDATORY) ═══
- ONLY use ingredients from the fridge list and pantry staples above.
- Seasonings, oil, salt, and pepper from pantry are allowed if listed (or as basic pantry defaults) — nothing else may be added, no matter how thin the list above is. Do NOT invent eggs, pasta, flour, rice, tofu, or any other staple that isn't explicitly listed. If the real inventory is too sparse to naturally fill 5 substantial dishes, write smaller/simpler honest recipes instead of fabricating a main ingredient — a fabricated ingredient makes the recipe unusable since the user doesn't actually own it.
- Never title a dish after a format/ingredient it doesn't really contain (e.g. don't call it "Omelet" unless eggs are actually in its ingredientsList).
- EXCEPTION: this lock never overrides the diet guardrail above — if an inventory item conflicts with an active restriction, exclude it even though it's in the fridge/pantry list.${ingredientPriorityLine}

${diversityOrMainMealsRule}

═══ UNIT SYSTEM (MANDATORY — USE ONLY THIS ONE, NEVER BOTH) ═══
The user has selected: ${isMetric ? "METRIC" : "US CUSTOMARY"} units. Use ONLY this system for every temperature and every ingredient quantity in this entire batch — never the other system, and never show both units for the same value.
${
  isMetric
    ? `- Temperatures: Celsius only, e.g. "Preheat the oven to 190°C." Never write °F.
- Quantities: grams for dry/solid ingredients using real density (flour ≈120g/cup, sugar ≈200g/cup, butter ≈227g/cup, shredded cheese ≈110g/cup, rice/oats ≈180-190g/cup) and milliliters for liquids (1 cup=240ml, 1 tbsp=15ml, 1 tsp=5ml). Never write cups, tablespoons, teaspoons, or °F. "g" and "ml" are the correct abbreviations to write as-is in every language — do not translate them.`
    : `- Quantities: use US CUSTOMARY measure SIZES (a cup, a tablespoon, a teaspoon, an ounce, a pound) — never switch to grams/milliliters. ${isEnglish ? "" : `BUT the WORD for that unit MUST be written in ${language}, not English — this is not optional and is a confirmed real failure: a past batch wrote "2 tbsp Masło" and "1/2 cup Ser" in an otherwise-Polish recipe, because "tbsp"/"cup" are English abbreviations, not Polish words. The correct Polish words are "łyżka" (tablespoon), "łyżeczka" (teaspoon), "szklanka" (cup), "uncja" (ounce), "funt" (pound) — e.g. "2 łyżki Masło", "1/2 szklanki Ser". Apply the same principle for ${language}: use ${language}'s own real words for these measures, never the English abbreviation, exactly like you already correctly translate the ingredient name itself.`}`
}
- Any recipe using an oven, broiler, or grill MUST have its own explicit preheat step with a real temperature in the system above — never say "bake in the preheated oven" without a temperature ever being stated.

═══ DYNAMIC STEP COUNT (MANDATORY) ═══
- Step count MUST match dish complexity — NOT always 5:
  - Quick/cold dishes (yogurt bowl, simple salad, sandwich, no-cook snack): EXACTLY 3 steps.
  - Standard/pan dishes (omelet, scrambled eggs, tacos, stir-fry): EXACTLY 4 steps.
  - Full/complex dishes (pasta with sauce, frittata, curry, casserole): EXACTLY 5 steps.
- Across this batch of ${recipeCount}, expect a MIX of step counts if the dishes vary in complexity — do not force every recipe to 5.
- Tone: imperative commands ("Boil", "Slice", "Saute", "Stir", "Serve"). No fluff.
- Every step MUST be a complete sentence ending with a period. Never truncate mid-word.
- Prefer two short sentences in one step over one cut-off long sentence.
- "ingredientsList" format: "<Quantity> <Ingredient> <Emoji>" e.g. "3 Eggs 🥚", "150g Cheese 🧀"
- Recalculate ALL quantities for SERVINGS=${servings} and hunger="${hungerLevel}".
- Include "servings": "Serves ${servings} ${servings === 1 ? "person" : "people"}".
- Emoji rule: accurate food emoji, else category (🥦 veg, 🥩 meat, 🥛 dairy, 🌾 grain, 🫙 pantry, 🍳 egg) — NEVER 📦/box.

Return ONLY a raw JSON array of exactly ${recipeCount} objects with these exact keys:
- "id": number (1..${recipeCount})
- "title": string, in ${language} (see LANGUAGE above)
- "dishType": string, one of "pasta" | "noodles" | "bread" | "pancake" | "oatmeal" | "salad" | "omelet" | "eggs" | "coffee" | "chocolate" | "pudding" | "cake" | "sweet_bowl" | "soup" | "rice" | "chicken" | "meat" | "sandwich" | "other" — ALWAYS this exact English token regardless of ${language}, never translated. Whatever the dish actually is, drives the app's icon, must be accurate on its own.
- "category": string ("breakfast" | "lunch" | "dinner" | "snack" | "dessert") — ALWAYS this exact English token regardless of ${language}, never translated.
- "categoryLabel": string (English — never shown to the user, leave as English)
- "prepTime": string (e.g. "10 min")
- "cookTime": string (e.g. "15 min")
- "totalTime": string (e.g. "25 min")
- "calories": string (e.g. "420 kcal")
- "protein": string (e.g. "28g") — estimate from the actual ingredientsList quantities and standard nutrition data, scaled for ${servings}.
- "carbs": string (e.g. "35g") — same estimation basis as protein.
- "fat": string (e.g. "14g") — same estimation basis as protein.
- "matchBadge": string (English — never shown to the user, leave as English)
- "titleFlavorWords": array of English tags — see TITLE FLAVOR ACCURACY above. [] for most recipes; only include a tag when the title in ${language} genuinely uses that descriptor concept AND ingredientsList genuinely backs it up.
- "servings": string, written entirely in ${language} — translate both the number-word phrasing AND "Serves"/"people" (or whatever ${language}'s natural equivalent phrase is), not just the surrounding words. ${isEnglish ? `E.g. "Serves ${servings} people".` : `Do NOT leave this field in English — e.g. for Polish this would be "Dla ${servings} osób", for Spanish "Sirve a ${servings} personas"; produce the real ${language} equivalent, not a transliteration.`}
- "ingredientsList": array of Quantity + Ingredient + Emoji strings ONLY (inventory only, scaled for ${servings}, ingredient names in ${language}) — every entry must be a real food item, NEVER an instruction. Confirmed real failure: a past batch put "Preheat the oven to 350°F. 🫙" as an ingredientsList entry — that is a step, not an ingredient, and must never appear here even for oven recipes (the preheat instruction goes in "steps" only). Quantities MUST use ONLY the ${isMetric ? "METRIC (grams/ml)" : "US CUSTOMARY"} system per UNIT SYSTEM above${isMetric ? ` — e.g. "120g Mąka 🌾" (ingredient translated, "g"/"ml" written as-is)` : isEnglish ? ` — e.g. "1 cup Flour 🌾"` : ` — e.g. for Polish "1 szklanka Mąka 🌾" NOT "1 cup Mąka 🌾" (the unit WORD translates too — see UNIT SYSTEM above)`}.
- "steps": array of 3 to 5 imperative strings in ${language} per the DYNAMIC STEP COUNT rule above, each ending with a period. If the recipe uses an oven/broiler/grill, one step MUST be an explicit preheat instruction with a real ${isMetric ? "°C" : "°F"} temperature. Any step finishing meat/poultry/seafood must pair its time with a real doneness cue (temperature or a visual/textural check), never a time estimate alone — see MEAT/POULTRY/SEAFOOD DONENESS & TECHNIQUE above, which also governs matching the cook time/technique to the actual cut.
- "upgradeIngredient": JSON null on most recipes, or a short ${language} ingredient name (e.g. ${isEnglish ? `"Fresh Basil"` : `the real ${language} name, not a transliteration`}) — see OPTIONAL "UPGRADE TIP" above. This is rare; only set it when genuinely true, never fill it in "to be thorough."
- "upgradeNote": JSON null whenever "upgradeIngredient" is null, otherwise one short sentence in ${language} explaining what it would actually add. Both fields are null together or filled together, never just one.

Do NOT include an "image" field — Cook AI stamps emoji badges client-side.

Example JSON Output:
[
  {
    "id": 1,
    "title": "Scrambled Eggs with Hummus and Pepper",
    "dishType": "eggs",
    "category": "breakfast",
    "categoryLabel": "Breakfast",
    "prepTime": "5 min",
    "cookTime": "8 min",
    "totalTime": "13 min",
    "calories": "380 kcal",
    "protein": "22g",
    "carbs": "14g",
    "fat": "26g",
    "matchBadge": "Uses 3 fridge items",
    "titleFlavorWords": [],
    "servings": "Serves ${servings} ${servings === 1 ? "person" : "people"}",
    "ingredientsList": ["3 Eggs 🥚", "2 tbsp Hummus 🫙", "1/2 Red Bell Pepper 🫑"],
    "steps": [
      "Dice the red bell pepper into small, even cubes.",
      "Warm a lightly oiled skillet over medium heat until the surface shimmers.",
      "Saute the pepper for 2 minutes until soft.",
      "Crack in the eggs, fold in the hummus, and stir gently until just set.",
      "Season with salt and pepper, then serve immediately."
    ],
    "upgradeIngredient": "Feta Cheese",
    "upgradeNote": "Crumbled on top, it adds a salty, tangy edge that plain hummus-and-egg doesn't have on its own."
  },
  {
    "id": 2,
    "title": "Jam Swirl Yogurt Bowl",
    "dishType": "sweet_bowl",
    "category": "breakfast",
    "categoryLabel": "Breakfast",
    "prepTime": "5 min",
    "cookTime": "0 min",
    "totalTime": "5 min",
    "calories": "240 kcal",
    "protein": "11g",
    "carbs": "32g",
    "fat": "6g",
    "matchBadge": "Uses 2 fridge items",
    "titleFlavorWords": [],
    "servings": "Serves ${servings} ${servings === 1 ? "person" : "people"}",
    "ingredientsList": ["1 cup Greek Yogurt 🥣", "2 tbsp Jam 🍓"],
    "steps": [
      "Spoon the yogurt into a bowl.",
      "Swirl the jam through the top in a spiral.",
      "Serve immediately, chilled."
    ],
    "upgradeIngredient": null,
    "upgradeNote": null
  }
]

Note: the second example above is intentionally a quick/cold dish with only 3 steps — a real sparse-inventory case (just yogurt + jam) elevated into a classic comforting bowl, NOT padded to 5 steps and NOT forced into an odd combination. Match this pattern whenever the available ingredients are simple. It also shows "upgradeIngredient"/"upgradeNote" as null, null — this should be the outcome for MOST recipes; the first example's feta suggestion is the rare exception, not the default.

Note: whenever a recipe requires the oven, its steps MUST include its own preheat instruction with a real temperature in the ${isMetric ? "METRIC" : "US CUSTOMARY"} system only, e.g. ${isMetric ? '"Preheat the oven to 200°C."' : '"Preheat the oven to 400°F."'} — never a bake step with no temperature ever stated, and never mix in the other unit system. Format ingredient quantities in that same single system throughout, e.g. ${
  isMetric
    ? '"120g Mąka 🌾", "28g Masło 🧈", "120ml Śmietana 🥛" (ingredient name translated, "g"/"ml" unchanged — this example happens to be Polish, apply the same idea in whatever language is selected)'
    : isEnglish
      ? '"1 cup All-Purpose Flour 🌾", "2 tbsp Butter 🧈", "1/2 cup Cream 🥛"'
      : `"1 szklanka Mąka 🌾", "2 łyżki Masło 🧈", "1/2 szklanki Śmietana 🥛" — this example is Polish; for ${language} use ${language}'s own real word for cup/tablespoon/teaspoon, NOT the English "cup"/"tbsp"/"tsp". Confirmed real failure: a past batch left these as literal English abbreviations ("2 tbsp Masło") inside an otherwise-translated Polish recipe — the unit word must translate exactly like the ingredient name does.`
}.
${
  isEnglish
    ? ""
    : `\nNote: the example JSON above is written in English purely to show the required STRUCTURE (field names, format, naming shape) — every actual recipe in this response must apply that same structure while writing all natural-language values, INCLUDING unit words like "cup"/"tablespoon"/"teaspoon", in ${language}, per the LANGUAGE and UNIT SYSTEM sections above. Do not copy the example's English words into your output.\n`
}`;
}

// Temperature/context-neutral on purpose — these get appended to whatever
// step needs padding regardless of the dish, and a heat/warmth-specific
// phrase (the old "Keep the heat steady." / "Serve while still warm.")
// could land on a cold, no-cook step and produce a direct contradiction
// (confirmed: "...serve chilled. Serve while still warm.").
//
// Split by narrative position: plating/serving phrases only make sense on
// the actual last step. Picking a phrase by the step's index alone (the
// old behavior) could land "Plate carefully for each serving." on step 2
// of 4, before the dish was even cooked — confirmed from a live "Corn Egg
// Pancakes" recipe where step 2 said "...into the batter. Plate carefully
// for each serving." and step 3 said "...medium-high heat. Wipe the board
// and finish plating." MID phrases are safe at any position; FINAL
// phrases are reserved for the last step only.
// Keyed by the same englishName values as LANGUAGE_OPTIONS. These are
// POST-PROCESSING filler text — applied after the model responds, not
// part of the prompt — so a hardcoded English version silently mixed
// languages into an otherwise-translated step (confirmed live: a Polish
// step came back as "Nałóż gęsty jogurt grecki do dwóch głębokich misek.
// Taste and adjust seasoning as you go." — English tacked onto Polish).
// Every supported language needs its own real translation here, not a
// fallback to English, or the bug just reappears for that language.
const MID_STEP_PAD_PHRASES_BY_LANG = {
  English: [
    " Taste and adjust seasoning as you go.",
    " Stir occasionally so nothing sticks or burns.",
    " Keep an eye on it and adjust the heat as needed.",
    " Make sure everything is evenly combined.",
  ],
  Polish: [
    " Smakuj i dopraw w trakcie gotowania.",
    " Mieszaj od czasu do czasu, aby nic się nie przypaliło.",
    " Obserwuj i w razie potrzeby dostosuj temperaturę.",
    " Upewnij się, że wszystko jest równomiernie wymieszane.",
  ],
  Spanish: [
    " Prueba y ajusta el sazón mientras cocinas.",
    " Remueve de vez en cuando para que no se pegue ni se queme.",
    " Vigílalo y ajusta el fuego según sea necesario.",
    " Asegúrate de que todo esté bien combinado.",
  ],
  French: [
    " Goûtez et ajustez l'assaisonnement au fur et à mesure.",
    " Remuez de temps en temps pour que rien n'attache ou ne brûle.",
    " Surveillez et ajustez la chaleur si nécessaire.",
    " Assurez-vous que tout est bien mélangé.",
  ],
  German: [
    " Abschmecken und die Würzung nach Bedarf anpassen.",
    " Gelegentlich umrühren, damit nichts anbrennt.",
    " Im Auge behalten und die Hitze bei Bedarf anpassen.",
    " Sicherstellen, dass alles gleichmäßig vermischt ist.",
  ],
  Italian: [
    " Assaggia e regola il condimento durante la cottura.",
    " Mescola di tanto in tanto per evitare che si attacchi o bruci.",
    " Controlla e regola il calore se necessario.",
    " Assicurati che tutto sia ben amalgamato.",
  ],
  Portuguese: [
    " Prove e ajuste o tempero conforme necessário.",
    " Mexa de vez em quando para não grudar nem queimar.",
    " Fique de olho e ajuste o fogo conforme necessário.",
    " Certifique-se de que tudo esteja bem combinado.",
  ],
};

const FINAL_STEP_PAD_PHRASES_BY_LANG = {
  English: [
    " Plate carefully for each serving.",
    " Wipe the board and finish plating.",
    " Arrange everything neatly before serving.",
    " Double-check the portions look even.",
  ],
  Polish: [
    " Nałóż starannie na talerze.",
    " Wytrzyj deskę i wykończ podanie.",
    " Ułóż wszystko starannie przed podaniem.",
    " Sprawdź, czy porcje są równe.",
  ],
  Spanish: [
    " Sirve con cuidado en cada plato.",
    " Limpia la tabla y termina de emplatar.",
    " Coloca todo con cuidado antes de servir.",
    " Verifica que las porciones sean parejas.",
  ],
  French: [
    " Dressez soigneusement chaque assiette.",
    " Essuyez le plan de travail et terminez le dressage.",
    " Disposez soigneusement le tout avant de servir.",
    " Vérifiez que les portions sont égales.",
  ],
  German: [
    " Sorgfältig auf den Tellern anrichten.",
    " Das Brett abwischen und das Anrichten abschließen.",
    " Alles ordentlich anrichten, bevor serviert wird.",
    " Kontrollieren, dass die Portionen gleich groß sind.",
  ],
  Italian: [
    " Impiatta con cura ogni porzione.",
    " Pulisci il tagliere e completa l'impiattamento.",
    " Disponi tutto con cura prima di servire.",
    " Controlla che le porzioni siano uguali.",
  ],
  Portuguese: [
    " Sirva com cuidado em cada prato.",
    " Limpe a tábua e finalize o empratamento.",
    " Organize tudo com cuidado antes de servir.",
    " Verifique se as porções estão parecidas.",
  ],
};

const DEFAULT_GOLDILOCKS_STEPS_BY_LANG = {
  English: [
    "Prep and portion every ingredient on a clean board.",
    "Heat a lightly oiled pan over medium until the surface shimmers.",
    "Add aromatics and stir until fragrant and lightly golden.",
    "Add the main ingredients and cook until tender, stirring often.",
    "Season to taste, plate carefully, and serve immediately.",
  ],
  Polish: [
    "Przygotuj i odmierz wszystkie składniki na czystej desce.",
    "Rozgrzej lekko naoliwioną patelnię na średnim ogniu, aż powierzchnia zacznie błyszczeć.",
    "Dodaj aromaty i mieszaj, aż będą pachnące i lekko złociste.",
    "Dodaj główne składniki i gotuj, często mieszając, aż będą miękkie.",
    "Dopraw do smaku, ułóż na talerzu i podawaj natychmiast.",
  ],
  Spanish: [
    "Prepara y porciona cada ingrediente sobre una tabla limpia.",
    "Calienta una sartén ligeramente aceitada a fuego medio hasta que brille.",
    "Añade los aromáticos y remueve hasta que estén fragantes y ligeramente dorados.",
    "Añade los ingredientes principales y cocina hasta que estén tiernos, removiendo con frecuencia.",
    "Sazona al gusto, sirve con cuidado y disfruta de inmediato.",
  ],
  French: [
    "Préparez et portionnez chaque ingrédient sur une planche propre.",
    "Faites chauffer une poêle légèrement huilée à feu moyen jusqu'à ce que la surface brille.",
    "Ajoutez les aromates et remuez jusqu'à ce qu'ils soient parfumés et légèrement dorés.",
    "Ajoutez les ingrédients principaux et faites cuire jusqu'à tendreté, en remuant souvent.",
    "Assaisonnez à votre goût, dressez soigneusement et servez immédiatement.",
  ],
  German: [
    "Alle Zutaten auf einem sauberen Brett vorbereiten und abmessen.",
    "Eine leicht geölte Pfanne bei mittlerer Hitze erhitzen, bis die Oberfläche glänzt.",
    "Aromaten hinzufügen und rühren, bis sie duften und leicht golden sind.",
    "Die Hauptzutaten hinzufügen und unter häufigem Rühren garen, bis sie zart sind.",
    "Nach Geschmack würzen, sorgfältig anrichten und sofort servieren.",
  ],
  Italian: [
    "Prepara e porziona ogni ingrediente su un tagliere pulito.",
    "Scalda una padella leggermente oliata a fuoco medio finché la superficie non luccica.",
    "Aggiungi gli aromi e mescola finché non sono profumati e leggermente dorati.",
    "Aggiungi gli ingredienti principali e cuoci finché teneri, mescolando spesso.",
    "Regola di sale, impiatta con cura e servi subito.",
  ],
  Portuguese: [
    "Prepare e porcione cada ingrediente em uma tábua limpa.",
    "Aqueça uma frigideira levemente untada em fogo médio até a superfície brilhar.",
    "Adicione os aromáticos e mexa até ficarem perfumados e levemente dourados.",
    "Adicione os ingredientes principais e cozinhe até ficarem macios, mexendo com frequência.",
    "Tempere a gosto, sirva com cuidado e sirva imediatamente.",
  ],
};

// Never falls back to English for an unrecognized language — that
// fallback is exactly what caused two confirmed bugs: an English filler
// phrase glued onto an otherwise-translated step, and a fully English
// step substituted into an otherwise-translated recipe. The *_BY_LANG
// tables only cover the 7 languages translated with real confidence; for
// any other supported language (see the much longer LANGUAGE_OPTIONS
// list), callers treat a null return as "skip/drop, don't fabricate" —
// a slightly short step, or one fewer step, beats a wrong-language one.
function padPhrasesForStrict(map, language) {
  return map[language] || null;
}

// Sentence-ending punctuation isn't ASCII-only once recipes generate in
// other languages — confirmed live: a Japanese step ending in the correct
// full-width 。 still got an ASCII "." appended ("...盛り付けます。." ),
// because the old check only recognized [.!?]. Covers CJK full stops/
// marks (。！？), Arabic's question mark (؟), and Devanagari's danda (।)
// in addition to the original Latin punctuation.
const SENTENCE_END_RE = /[.!?。！？؟।]$/;

/** Ensure a complete sentence ending with punctuation. */
function ensureSentenceComplete(step) {
  let s = String(step || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return s;
  s = s.replace(/[,:;–—\-]+$/g, "").trim();
  if (!SENTENCE_END_RE.test(s)) s = `${s}.`;
  return s;
}

/** Hermes-safe box/blob glyphs — never use /u or \p{} here. */
const BOX_BLOB_CHARS = [
  "📦",
  "🗃",
  "⬜",
  "◻",
  "▪",
  "▫",
  "▪️",
  "▫️",
  "🔲",
  "🔳",
  "■",
  "□",
  "▢",
  "▣",
];

function stripBoxBlobEmojis(text) {
  let s = String(text || "");
  for (let i = 0; i < BOX_BLOB_CHARS.length; i += 1) {
    const ch = BOX_BLOB_CHARS[i];
    if (s.indexOf(ch) !== -1) s = s.split(ch).join("");
  }
  return s.replace(/\s+/g, " ").trim();
}

function isBoxBlobEmoji(ch) {
  return BOX_BLOB_CHARS.indexOf(ch) !== -1;
}

function extractTrailingEmoji(text) {
  const s = String(text || "").trim();
  // Hermes-safe (no /u, no \p{}). Matching only a bare surrogate pair missed
  // two real shapes and left the model's emoji sitting in the text, so our
  // own emoji got appended after it and the row rendered twice: a pair
  // followed by a variation selector ("Red pepper flakes 🌶️ 🫑", seen live
  // from a Modify-with-AI result) and single-unit BMP emoji that aren't
  // surrogate pairs at all ("Coffee ☕ ☕").
  //
  // The BMP ranges are deliberately narrow — Misc Symbols/Dingbats and the
  // arrows/stars block — and stop well short of U+2E80+, so no CJK character
  // can ever be mistaken for a trailing emoji and stripped off a Chinese or
  // Japanese ingredient name.
  const m = s.match(
    /((?:[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF\u2B00-\u2BFF])[\uFE0E\uFE0F]?)\s*$/
  );
  return m ? m[1] : null;
}

/**
 * Ensure "Quantity Ingredient Emoji" formatting; category emoji fallback (never 📦/box).
 */
export function formatIngredientsList(lines) {
  if (!Array.isArray(lines)) return [];
  return lines
    .map((line) => {
      const raw = stripBoxBlobEmojis(line);
      if (!raw) return null;

      // Loop rather than strip once: a line can arrive already carrying more
      // than one trailing emoji, and leaving the extras in the text is part of
      // what put a second glyph in the rendered row. `trailing` keeps the
      // rightmost one as the model's own choice, used only when our table has
      // no entry for the ingredient.
      let withoutEmoji = raw;
      let trailing = null;
      for (;;) {
        const next = extractTrailingEmoji(withoutEmoji);
        if (!next) break;
        if (!trailing) trailing = next;
        withoutEmoji = stripBoxBlobEmojis(
          withoutEmoji.slice(0, withoutEmoji.lastIndexOf(next))
        ).trim();
      }

      const qtyMatch = withoutEmoji.match(
        /^(?:\d+[\/\d]*\.?\d*\s*(?:x|g|ml|tbsp|tsp|pcs|cloves|cup|cups|pinch|handful)?\s+)?(.+)$/i
      );
      const name = (qtyMatch?.[1] || withoutEmoji).trim();
      const style = getIngredientStyle(name);
      const logical = style.emoji || getIngredientEmoji(name) || "🛒";

      // Confirmed real failure, not a hypothetical: this used to be
      // `emoji = logical; if (trailing) emoji = trailing;` — it computed our
      // own correct emoji and then discarded it for whatever the model had
      // tacked on. Live output included "Chicken Breasts 🥩" (steak),
      // "Salmon Fillets 🥩", "Olive Oil 🫙" (jar) and "Banana 🍖" (meat on
      // bone), in every case with the right emoji already in hand. Our table
      // is deterministic and curated, so it wins whenever it actually
      // recognises the ingredient; the model's guess is only a fallback for
      // things the table has no entry for.
      const mappedIsGeneric = !logical || logical === "🫙" || logical === "🛒";

      let emoji;
      if (!mappedIsGeneric) emoji = logical;
      else if (trailing && !isBoxBlobEmoji(trailing)) emoji = trailing;
      else emoji = logical || "🛒";

      return `${withoutEmoji} ${emoji || logical}`.trim();
    })
    .filter(Boolean);
}

/**
 * Normalize one step: complete sentence, imperative-friendly length.
 * NEVER hard-slices mid-word — prefers last sentence or last space.
 */
// Returns null when a step is unsalvageable AND no curated default exists
// for the language, so the caller can drop that slot instead of splicing
// in English (confirmed live: an uncurated language + one empty step from
// the model produced a step that was 100% English — "Prep and portion
// every ingredient on a clean board." — inside an otherwise-Japanese
// recipe). Fewer real steps beats one wrong-language step.
function padStepToGoldilocks(step, idx, isLastStep, language = "English") {
  const defaultSteps = padPhrasesForStrict(DEFAULT_GOLDILOCKS_STEPS_BY_LANG, language);
  let s = ensureSentenceComplete(step);
  if (!s) {
    if (!defaultSteps) return null;
    s = defaultSteps[idx % defaultSteps.length];
  }

  // A preheat-oven step is already a complete, correct instruction at
  // ~35 chars — padding it toward GOLDILOCKS_STEP_MIN with a generic MID
  // phrase produces a non-sequitur (confirmed live: "Preheat the oven to
  // 375°F (190°C). Taste and adjust seasoning as you go." — there's
  // nothing to season while just setting a temperature). Skip padding
  // for these on purpose; short-and-correct beats long-and-nonsensical.
  // Keyword check covers "preheat" and its stem in each supported
  // language, not just English, so the exemption still applies to a
  // translated recipe's preheat step.
  const isPreheatOnly =
    /preheat|rozgrzej|nagrzej|precalient|préchauff|vorheiz|preriscald|preaquec/i.test(
      s
    ) && /°|degrees/i.test(s);

  const pool = padPhrasesForStrict(
    isLastStep ? FINAL_STEP_PAD_PHRASES_BY_LANG : MID_STEP_PAD_PHRASES_BY_LANG,
    language
  );
  let guard = 0;
  while (pool && !isPreheatOnly && s.length < STEP_PAD_TRIGGER_MIN && guard < 4) {
    const pad = pool[(idx + guard) % pool.length];
    // `s` already ends with sentence punctuation (ensureSentenceComplete
    // guarantees it) and `pad` already starts with a leading space —
    // stripping s's own trailing period before concatenating (the old
    // behavior) merged the two sentences with no punctuation between them
    // ("...the yogurt Taste and adjust seasoning."). Just append directly.
    s = ensureSentenceComplete(`${s}${pad}`);
    guard += 1;
  }

  if (s.length > GOLDILOCKS_STEP_MAX) {
    const window = s.slice(0, GOLDILOCKS_STEP_MAX);
    const lastPeriod = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("! "),
      window.lastIndexOf("? ")
    );
    if (lastPeriod >= GOLDILOCKS_STEP_MIN - 10) {
      s = window.slice(0, lastPeriod + 1).trim();
    } else {
      const lastSpace = window.lastIndexOf(" ");
      s =
        lastSpace > 40
          ? window.slice(0, lastSpace).trim()
          : window.trim();
      s = ensureSentenceComplete(s);
    }
  }

  s = ensureSentenceComplete(s);
  // A too-short-but-real translated step is still better than swapping in
  // an unrelated English default — only substitute when we actually have
  // a curated default for this language.
  if (s.length < 20 && defaultSteps) {
    s = defaultSteps[idx % defaultSteps.length];
  }
  return s;
}

/**
 * Dynamic step count (3-5), matching whatever length the model actually
 * returned rather than always forcing exactly 5 — a quick/cold dish is
 * meant to come back with 3 steps, a full/complex one with 5. Only clamps
 * as a safety net: pads up to STEP_COUNT_MIN if the model returned too few
 * (or none), trims down to STEP_COUNT_MAX if it returned too many. Each
 * surviving step still goes through the same per-item sentence cleanup as
 * before. `language` picks the right filler-phrase set (see the *_BY_LANG
 * tables above) so a translated recipe never gets English text spliced in.
 */
export function enforceGoldilocksSteps(steps, language = "English") {
  const list = Array.isArray(steps) ? steps : [];
  const defaultSteps = padPhrasesForStrict(DEFAULT_GOLDILOCKS_STEPS_BY_LANG, language);
  const targetCount = Math.min(
    Math.max(list.length, STEP_COUNT_MIN),
    STEP_COUNT_MAX
  );
  const out = [];
  for (let i = 0; i < targetCount; i += 1) {
    const raw = list[i] || (defaultSteps ? defaultSteps[i % defaultSteps.length] : "");
    out.push(padStepToGoldilocks(raw, i, i === targetCount - 1, language));
  }
  // A dropped (null) slot only happens when the model returned nothing
  // for that step AND the language has no curated default to fall back
  // on — rare, and a shorter real step list beats a wrong-language one.
  return out.filter(Boolean);
}

/** Normalize calorie labels to "NNN kcal". */
export function formatCalories(value) {
  if (value == null || value === "") return "—";
  const s = String(value).trim();
  if (/kcal/i.test(s)) {
    return s.replace(/calories?/i, "").replace(/\s+/g, " ").trim();
  }
  const n = parseInt(s.replace(/[^0-9]/g, ""), 10);
  if (Number.isFinite(n) && n > 0) return `${n} kcal`;
  return s || "—";
}

/**
 * Normalize a macro gram value to "N g"; returns null when missing/invalid
 * rather than a placeholder — never fabricate a number for a recipe the AI
 * didn't actually estimate (e.g. local heuristic fallback recipes). Space
 * before the unit matches formatCalories' "NNN kcal" spacing above — the
 * two used to disagree (calories had a space, grams didn't), which read as
 * inconsistent on the same meta row.
 */
export function formatMacroGrams(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${Math.round(n)} g`;
}

/** Inventory name list from fridge scan + in-stock pantry staples. */
export function collectInventoryNames(scannedIngredients = [], pantryItems = []) {
  const fridge = (scannedIngredients || [])
    .map((i) =>
      typeof i?.name === "string"
        ? i.name.trim()
        : typeof i === "string"
          ? i.trim()
          : ""
    )
    .filter(Boolean);
  const pantry = (pantryItems || [])
    .filter((p) => p?.inStock !== false)
    .map((p) => (typeof p?.name === "string" ? p.name.trim() : ""))
    .filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const name of [...fridge, ...pantry]) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function categoryLabelFromCategory(category) {
  const labels = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snack: "Snack",
    dessert: "Dessert",
  };
  return labels[category] || category;
}

// Defensive safety net — catches the rare case where the model still puts
// an instruction sentence into ingredientsList despite the prompt
// guardrail against it (confirmed real failure: "Preheat the oven to
// 350°F. 🫙" showed up as an "ingredient" in a real generated recipe). A
// genuine ingredient entry is always short and never a full sentence;
// anything shaped like a step gets dropped here instead of reaching the
// UI looking broken.
function looksLikeInstructionNotIngredient(entry) {
  if (typeof entry !== "string") return true;
  const trimmed = entry.trim();
  if (!trimmed) return true;
  if (/\.\s*$/.test(trimmed)) return true;
  if (/\bpreheat\b|\bthe oven\b|\bdegrees\b/i.test(trimmed)) return true;
  if (trimmed.split(/\s+/).length > 10) return true;
  return false;
}

function normalizeRecipe(recipe, idx, mealType, servings = 2, language = "English") {
  const safe = recipe && typeof recipe === "object" ? recipe : {};
  const title =
    typeof safe.title === "string" && safe.title.trim()
      ? safe.title.trim()
      : "AI Recipe";
  const id = `ai-${Date.now()}-${idx}`;

  const category =
    mealType !== "all" && KNOWN_MEAL_TYPES.has(mealType)
      ? mealType
      : safe.category || "dinner";

  let ingredientsList = Array.isArray(safe.ingredientsList)
    ? safe.ingredientsList.filter((entry) => !looksLikeInstructionNotIngredient(entry))
    : [];

  if (
    ingredientsList.length === 0 &&
    Array.isArray(safe.ingredients) &&
    safe.ingredients.length > 0
  ) {
    const base = safe.baseServings || 2;
    const scale = (Number(servings) || 2) / base;
    ingredientsList = safe.ingredients.map((ing) => {
      const name = ing?.name || "Ingredient";
      const amount =
        ing?.amount != null
          ? Math.round(Number(ing.amount) * scale * 10) / 10
          : null;
      const unit = ing?.unit ? String(ing.unit) : "";
      const qty =
        amount == null
          ? ""
          : unit
            ? `${amount}${/^(g|ml)$/i.test(unit) ? unit : ` ${unit}`}`
            : String(amount);
      return `${qty} ${name}`.trim();
    });
  }

  const dishType =
    typeof safe.dishType === "string" && KNOWN_DISH_TYPES.has(safe.dishType)
      ? safe.dishType
      : undefined;
  const dishVisual = getDishEmojiAndColor(title, dishType);
  const servingsCount = Number(servings) || 2;
  // Sanity check is deliberately NOT English-specific (was `/serve/i.test`,
  // which silently rejected every translated "servings" string — e.g. a
  // Polish "Dla 2 osób" contains no "serve" substring — and always fell
  // back to the hardcoded English default regardless of the recipe
  // language). A digit is a language-agnostic proxy for "this looks like
  // a real serving-count string, not garbage."
  const servingsLabel =
    typeof safe.servings === "string" && /\d/.test(safe.servings)
      ? safe.servings
      : fallbackT(
          language,
          servingsCount === 1 ? "recipeDetail.servesOne" : "recipeDetail.servesOther",
          { count: servingsCount }
        );

  // Optional "upgrade tip" — code-level safety net backing up the prompt's
  // own "this is rare, leave both null" instruction. Both fields must be
  // present and non-empty together, and the suggested ingredient must
  // genuinely be absent from this exact recipe's own ingredientsList —
  // guards against the model echoing an inventory item back here instead
  // of actually leaving it null, which would otherwise render as "this
  // would be better with X" for an X already in the dish.
  const rawUpgradeIngredient =
    typeof safe.upgradeIngredient === "string" ? safe.upgradeIngredient.trim() : "";
  const rawUpgradeNote = typeof safe.upgradeNote === "string" ? safe.upgradeNote.trim() : "";
  const ingredientsListLower = ingredientsList.join(" ").toLowerCase();
  const upgradeIngredient =
    rawUpgradeIngredient &&
    rawUpgradeNote &&
    !ingredientsListLower.includes(rawUpgradeIngredient.toLowerCase())
      ? rawUpgradeIngredient
      : null;
  const upgradeNote = upgradeIngredient ? rawUpgradeNote : null;

  return {
    id,
    title,
    dishType,
    category,
    categoryLabel: categoryLabelFromCategory(category),
    prepTime: safe.prepTime || "—",
    cookTime: safe.cookTime || "—",
    totalTime: safe.totalTime || "—",
    calories: formatCalories(safe.calories || safe.kcal || "350 kcal"),
    protein: formatMacroGrams(safe.protein),
    carbs: formatMacroGrams(safe.carbs),
    fat: formatMacroGrams(safe.fat),
    matchBadge: typeof safe.matchBadge === "string" ? safe.matchBadge : "",
    // Sanitized against the fixed vocabulary rather than trusted as-is —
    // an unrecognized tag here would silently never match any
    // TITLE_FLAVOR_REQUIREMENTS key and just be dead weight, so drop
    // anything outside the known list instead of passing it through.
    titleFlavorWords: Array.isArray(safe.titleFlavorWords)
      ? safe.titleFlavorWords
          .filter((tag) => typeof tag === "string")
          .map((tag) => tag.toLowerCase().trim())
          .filter((tag) => TITLE_FLAVOR_REQUIREMENTS[tag])
      : [],
    servings: servingsLabel,
    emoji: dishVisual.emoji,
    emojiBgClass: dishVisual.bgClass,
    cardIndex: idx,
    baseServings: servingsCount,
    ingredientsList: formatIngredientsList(ingredientsList),
    steps: enforceGoldilocksSteps(safe.steps, language),
    upgradeIngredient,
    upgradeNote,
    isAiGenerated: true,
    isSmartFallback: !!safe.isSmartFallback,
    isPro: false,
    // The language this recipe's title/ingredients/steps are actually
    // written in — lets the app notice when a saved recipe no longer
    // matches the app's current language (after a switch) and needs
    // re-translating, instead of silently staying stuck in the old one.
    languageId: (LANGUAGE_OPTIONS.find((l) => l.englishName === language) || {}).id || "en",
  };
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Short, currently-verified candidate list — trimmed via
 * `node scripts/check-gemini-models.js`, which confirmed gemini-2.0-flash,
 * gemini-2.0-flash-lite, and gemini-2.5-flash-lite are all permanently
 * deprecated (HTTP 404 "no longer available"), not transient. A dead entry
 * here is pure wasted latency on every request that falls through to it —
 * see .claude/rules/ai-integration.md.
 */
function buildCandidateUrls(apiKey) {
  const models = ["gemini-flash-lite-latest", "gemini-flash-latest"];
  return models.map(
    (model) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  );
}

// thinkingConfig is only valid on models that actually support extended
// thinking — sending it to gemini-flash-lite-latest is a hard HTTP 400
// ("Request contains an invalid argument"), confirmed live (same as the
// fridge/pantry scanner in geminiVision.js). gemini-flash-lite-latest is
// deliberately absent from this set for that reason.
const THINKING_CAPABLE_RECIPE_MODELS = new Set(["gemini-flash-latest"]);

/**
 * Build 5 tailored fallback recipes from detected fridge + pantry items.
 * Never returns empty — always pads to exactly RECIPES_PER_SCAN.
 */
export function buildSmartFallbackRecipes(
  scannedIngredients = [],
  mealType = "all",
  servings = 2,
  pantryItems = [],
  // Same englishName convention as every Gemini call in this file
  // ("English", "Polish", ...) — see fallbackT above for why this takes
  // a plain string instead of the app's t() callback.
  language = "English",
  dietaryRestrictions = null
) {
  const tf = (key, vars) => fallbackT(language, key, vars);
  // Unlike the Gemini path, these templates have no prompt/guardrail of
  // their own — they just template in whatever inventory they're handed.
  // Filter out anything that conflicts with an active restriction BEFORE
  // it can become a template's "top ingredient" or land in its
  // ingredientsList, so this fallback can't reintroduce the exact diet
  // violation the code-level safety net exists to prevent.
  const dietSafeScanned = filterItemsForDiet(scannedIngredients, dietaryRestrictions);
  const dietSafePantry = filterItemsForDiet(pantryItems, dietaryRestrictions);
  const names = collectInventoryNames(dietSafeScanned, dietSafePantry);

  const top = names.slice(0, 6);
  const genericIngredient = tf("fallbackRecipe.genericIngredient");
  const label = top.length > 0 ? top.slice(0, 3).join(", ") : genericIngredient;
  const matchCount = Math.min(Math.max(top.length, 2), 6);

  const templates = [
    {
      title: tf("fallbackRecipe.title1", { ingredient: top[0] || genericIngredient }),
      category: mealType !== "all" ? mealType : "lunch",
      steps: [
        tf("fallbackRecipe.step1_1", { items: label }),
        tf("fallbackRecipe.step1_2"),
        tf("fallbackRecipe.step1_3"),
        tf(servings === 1 ? "fallbackRecipe.step1_4One" : "fallbackRecipe.step1_4Other", { count: servings }),
      ],
    },
    {
      title: tf("fallbackRecipe.title2", { ingredient: top[1] || genericIngredient }),
      category: mealType !== "all" ? mealType : "dinner",
      steps: [
        tf("fallbackRecipe.step2_1"),
        tf("fallbackRecipe.step2_2"),
        tf("fallbackRecipe.step2_3", { items: label }),
        tf("fallbackRecipe.step2_4"),
        tf("fallbackRecipe.step2_5"),
      ],
    },
    {
      title: tf("fallbackRecipe.title3", { ingredient: top[2] || genericIngredient }),
      category: mealType !== "all" ? mealType : "breakfast",
      steps: [
        tf("fallbackRecipe.step3_1"),
        tf("fallbackRecipe.step3_2", { items: label }),
        tf("fallbackRecipe.step3_3"),
      ],
    },
    {
      title: tf("fallbackRecipe.title4"),
      category: mealType !== "all" ? mealType : "breakfast",
      steps: [
        tf("fallbackRecipe.step4_1"),
        tf("fallbackRecipe.step4_2", { items: label }),
        tf("fallbackRecipe.step4_3"),
        tf("fallbackRecipe.step4_4"),
      ],
    },
    {
      title: tf("fallbackRecipe.title5"),
      category: mealType !== "all" ? mealType : "snack",
      steps: [
        tf("fallbackRecipe.step5_1", { items: label }),
        tf("fallbackRecipe.step5_2"),
        tf("fallbackRecipe.step5_3"),
      ],
    },
  ];

  const caloriePool = ["320 kcal", "380 kcal", "410 kcal", "450 kcal", "290 kcal"];
  const fromDetected = templates.map((t, idx) =>
    normalizeRecipe(
      {
        title: t.title,
        category: t.category,
        prepTime: "8 min",
        cookTime: "12 min",
        totalTime: "20 min",
        calories: caloriePool[idx % caloriePool.length],
        matchBadge: fallbackT(language, "recipeCard.usesFridgeItems", { count: matchCount }),
        ingredientsList: top.length
          ? top.map((n) => n)
          : ["Olive oil", "Salt", "Pepper"],
        steps: t.steps,
        isSmartFallback: true,
      },
      idx,
      mealType,
      servings,
      language
    )
  );

  // The 5 static curated recipes (FALLBACK_RECIPES) are hardcoded English
  // and not worth machine-translating in full (title + every ingredient +
  // every step, per recipe) — skip them entirely outside English rather
  // than inject an untranslatable English recipe into an otherwise
  // localized batch. fromDetected alone already produces exactly
  // RECIPES_PER_SCAN (5) templates, so this filler tier is effectively
  // English-only "extra" coverage for edge cases (e.g. a title collision),
  // never the primary content.
  const curated =
    language === "English"
      ? (FALLBACK_RECIPES || []).map((r, i) =>
          normalizeRecipe(
            {
              ...r,
              title: r.title,
              category: mealType !== "all" ? mealType : r.category,
              calories: r.calories || caloriePool[i % caloriePool.length],
              matchBadge:
                r.matchBadge || fallbackT(language, "recipeCard.usesFridgeItems", { count: matchCount }),
              // Remap to inventory when available — never invent foreign ingredients
              ingredientsList: top.length
                ? top
                : Array.isArray(r.ingredients)
                  ? r.ingredients.map(
                      (ing) =>
                        `${ing.amount}${ing.unit ? ` ${ing.unit}` : ""} ${ing.name}`
                    )
                  : r.ingredientsList || [],
              steps: r.steps,
              isSmartFallback: true,
            },
            fromDetected.length + i,
            mealType,
            servings,
            language
          )
        )
      : [];

  const merged = [];
  for (const recipe of [...fromDetected, ...curated]) {
    if (merged.length >= RECIPES_PER_SCAN) break;
    if (merged.some((m) => m.title === recipe.title)) continue;
    merged.push(recipe);
  }

  return enforceExactlyFive(
    merged,
    mealType,
    servings,
    RECIPES_PER_SCAN,
    dietaryRestrictions,
    [],
    scannedIngredients
  );
}

/**
 * Build planner meal cards strictly from fridge + pantry inventory.
 * Returns [] when fridge scan and pantry staples are both empty.
 */
export function buildPlannerMealsFromInventory(
  scannedIngredients = [],
  pantryItems = [],
  count = 7,
  servings = 2,
  language = "English",
  dietaryRestrictions = null
) {
  const inventory = collectInventoryNames(scannedIngredients, pantryItems);
  // Empty only when fridge scan AND pantry staples are both missing
  if (inventory.length === 0) return [];

  const recipes = buildSmartFallbackRecipes(
    scannedIngredients,
    "all",
    servings,
    pantryItems,
    language,
    dietaryRestrictions
  );

  const needed = Math.max(count, 1);
  const pool = [];
  let guard = 0;
  while (pool.length < needed && guard < needed * 3) {
    const recipe = recipes[guard % Math.max(recipes.length, 1)];
    guard += 1;
    if (!recipe) break;
    const ingredients =
      Array.isArray(recipe.ingredientsList) && recipe.ingredientsList.length > 0
        ? recipe.ingredientsList
        : inventory.slice(0, Math.min(5, inventory.length));
    pool.push({
      title: recipe.title,
      time: firstRealTime([recipe.totalTime, recipe.cookTime], "20 min"),
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      calories: recipe.calories,
      protein: recipe.protein,
      carbs: recipe.carbs,
      fat: recipe.fat,
      ingredients,
      steps: recipe.steps,
      recipe: {
        ...recipe,
        id: `${recipe.id}-plan-${pool.length}`,
      },
    });
  }
  return pool;
}

/**
 * Real AI-backed weekly planner — reuses generateRecipesWithGemini so the
 * planner gets the exact same Executive Chef harmony rules and dietary
 * guardrail as the main "Generate AI Recipes" flow, just asking for `count`
 * meals instead of a fixed 5. Falls back to the local inventory heuristic
 * (buildPlannerMealsFromInventory) if the API key is missing, the call
 * fails, or Gemini returns fewer meals than requested — the fallback pool
 * cycles to top up the remainder so the caller always gets `count` cards.
 */
export async function generatePlannerMealsWithGemini(
  scannedIngredients,
  pantryItems,
  count = 7,
  servings = 2,
  dietaryRestrictions = null,
  userApiKey = "",
  unitSystem = "us",
  language = "English"
) {
  // Same contract as the old buildPlannerMealsFromInventory — empty only
  // when fridge scan AND pantry staples are both missing. Callers (the
  // Meal Planner UI) treat [] as the signal to show "scan your fridge".
  const inventory = collectInventoryNames(scannedIngredients, pantryItems);
  if (inventory.length === 0) return [];

  const toPlannerCard = (recipe, idx) => ({
    title: recipe.title,
    time: firstRealTime([recipe.totalTime, recipe.cookTime], "20 min"),
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    calories: recipe.calories,
    protein: recipe.protein,
    carbs: recipe.carbs,
    fat: recipe.fat,
    ingredients: Array.isArray(recipe.ingredientsList) ? recipe.ingredientsList : [],
    steps: recipe.steps,
    recipe: {
      ...recipe,
      id: `${recipe.id}-plan-${idx}`,
    },
  });

  let cards = [];
  try {
    const recipes = await generateRecipesWithGemini(
      scannedIngredients,
      pantryItems,
      "all",
      servings,
      "normal",
      dietaryRestrictions,
      userApiKey,
      count,
      // Weekly planner slots are lunches/dinners — never breakfast/dessert.
      true,
      [],
      unitSystem,
      language
    );
    cards = (Array.isArray(recipes) ? recipes : [])
      .filter((r) => !r?.isSmartFallback)
      .map(toPlannerCard);
  } catch (err) {
    console.warn("[Cook AI] Planner Gemini generation failed:", err?.message);
  }

  if (cards.length >= count) return cards.slice(0, count);

  // Top up with the local inventory heuristic — cycles its (smaller) pool
  // so the caller still gets exactly `count` distinct-feeling cards.
  const fallbackPool = buildPlannerMealsFromInventory(
    scannedIngredients,
    pantryItems,
    count,
    servings,
    language,
    dietaryRestrictions
  );
  // Cycle the (smaller) fallback pool to top up the remainder — repeats
  // are acceptable here since this only runs when Gemini under-delivered.
  let cursor = 0;
  while (cards.length < count && fallbackPool.length > 0 && cursor < count * 3) {
    const candidate = fallbackPool[cursor % fallbackPool.length];
    cursor += 1;
    if (!candidate) break;
    cards.push({
      ...candidate,
      recipe: { ...candidate.recipe, id: `${candidate.recipe?.id || "fallback"}-${cards.length}` },
    });
  }

  return cards.slice(0, count);
}

export async function generateRecipesWithGemini(
  scannedIngredients,
  pantryItems,
  mealType,
  servings,
  hungerLevel,
  dietaryRestrictions = null,
  userApiKey = "",
  recipeCount = RECIPES_PER_SCAN,
  mainMealsOnly = false,
  // Titles from the batch being replaced — passed by the "Regenerate"
  // flow so the model is explicitly told not to reproduce them. At
  // temperature 0.2 with the same inventory, the model otherwise
  // converges on the same "best" 1-2 dishes almost every time (confirmed:
  // that's exactly what a regenerate looked like — a couple of titles
  // never changing). Empty for a first-time generate.
  excludeTitles = [],
  // "us" (cups/tbsp/°F) or "metric" (g/ml/°C) — user-selected in Settings.
  // Never both at once; see the UNIT SYSTEM block in buildPrompt.
  unitSystem = "us",
  // English name of the user's selected recipe language ("English",
  // "Polish", "Spanish", ...) — user-selected in Settings. Controls only
  // the natural-language text values; "category"/"dishType" always stay
  // fixed English tokens regardless (see LANGUAGE block in buildPrompt).
  language = "English"
) {
  const apiKey = (
    userApiKey ||
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ""
  )
    .trim()
    .replace(/['"]/g, "");

  if (!apiKey) {
    throw new GeminiRecipeError("Missing API key.");
  }

  const fridgeList = (scannedIngredients || []).map((i) => i.name).join(", ");
  const pantryNames = (pantryItems || [])
    .filter((p) => p?.inStock !== false)
    .map((p) => p.name)
    .join(", ");

  // Confirmed real gap, reported directly by a user: "assume basic
  // staples" used to apply ONLY when the pantry list was completely
  // empty — the instant a user scanned even one pantry item (e.g. just
  // flour), it vanished entirely, and the prompt below says recipes must
  // be based "STRICTLY" on the fridge + pantry lists — so salt, pepper,
  // and cooking oil silently stopped being available to the AI the
  // moment the pantry had anything else in it. Every home cook has these
  // on hand regardless of what they bothered to scan, so they're now
  // assumed unconditionally, layered on top of whatever's actually
  // scanned — unless the user explicitly scanned that exact staple and
  // marked it out of stock, a real "I don't have this" signal that
  // should win over the blind assumption.
  const BASIC_STAPLES = [
    { label: "salt", keyword: "salt" },
    { label: "pepper", keyword: "pepper" },
    { label: "cooking oil", keyword: "oil" },
    { label: "basic spices", keyword: "spice" },
  ];
  const outOfStockNames = (pantryItems || [])
    .filter((p) => p?.inStock === false)
    .map((p) => (p.name || "").toLowerCase());
  const assumedStaples = BASIC_STAPLES.filter(
    ({ keyword }) => !outOfStockNames.some((name) => name.includes(keyword))
  ).map(({ label }) => label);
  const pantryListText = [assumedStaples.join(", "), pantryNames]
    .filter(Boolean)
    .join(", ");

  const buildPromptTextFor = (count, excludeForCall, usedDishTypesForCall = []) =>
    `${GEMINI_RECIPE_SYSTEM_PROMPT.trim()}\n\n${buildPrompt(
      fridgeList,
      pantryListText,
      mealType,
      servings,
      hungerLevel,
      dietaryRestrictions,
      count,
      mainMealsOnly,
      excludeForCall,
      unitSystem,
      language,
      usedDishTypesForCall
    ).trim()}`;

  // One raw fetch + JSON parse against a specific model URL for a specific
  // recipe count/exclude list — shared by the main attempt and the top-up
  // retry below so both go through byte-identical request handling.
  async function fetchRawRecipes(url, count, excludeForCall, usedDishTypesForCall = []) {
    const modelName = url.split("models/")[1]?.split(":")[0];
    const generationConfig = {
      temperature: 0.2,
      responseMimeType: "application/json",
    };
    if (THINKING_CAPABLE_RECIPE_MODELS.has(modelName)) {
      // Confirmed real failure, not a hypothetical: gemini-flash-latest
      // spends an unrequested "thinking" pass on a plain recipe-generation
      // call (usageMetadata.thoughtsTokenCount ~558 on an unmodified call,
      // ~8.2s), the exact same class of bug already fixed for the fridge
      // scanner's gemini-3.7-flash. thinkingBudget: 0 cut it to ~4.3s with
      // no observed quality change. gemini-flash-lite-latest does NOT
      // support this field at all — sending it is a hard HTTP 400,
      // confirmed live — which is why this is gated per-model rather than
      // added to generationConfig unconditionally.
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }
    const response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: GEMINI_RECIPE_SYSTEM_PROMPT.trim() }],
          },
          contents: [{ parts: [{ text: buildPromptTextFor(count, excludeForCall, usedDishTypesForCall) }] }],
          generationConfig,
        }),
      },
      REQUEST_TIMEOUT_MS
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new GeminiRecipeError(`API Error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    try {
      return JSON.parse(rawText);
    } catch {
      throw new GeminiRecipeError("Failed to process the AI response.");
    }
  }

  // Runs every code-level safety net (dishType diversity, cut/technique
  // match, regenerate-duplicate, diet compliance) on one raw batch — shared
  // by the main attempt and the top-up retry so the retry gets the exact
  // same standard, not a weaker pass. Actually filters diet violations out
  // here (not just warns) so the caller can see the TRUE surviving count
  // across all four checks before deciding whether a retry is needed;
  // enforceExactlyFive's own diet filter later is a harmless no-op on an
  // already-diet-safe list, kept as defense in depth.
  function normalizeAndFilter(rawRecipes, count, excludeForCall, label) {
    let normalized = (Array.isArray(rawRecipes) ? rawRecipes : [])
      .slice(0, count)
      .map((r, i) => normalizeRecipe(r, i, mealType, servings, language));

    const beforeDishTypeDedupe = normalized.length;
    normalized = dedupeDishType(normalized);
    if (normalized.length < beforeDishTypeDedupe) {
      console.warn(
        `[Cook AI] ${label} returned ${beforeDishTypeDedupe - normalized.length} recipe(s) sharing a dishType with an earlier recipe in the same batch.`
      );
    }

    const beforeCutTechniqueFilter = normalized.length;
    normalized = normalized.filter((r) => !hasCutTechniqueMismatch(r));
    if (normalized.length < beforeCutTechniqueFilter) {
      console.warn(
        `[Cook AI] ${label} returned ${beforeCutTechniqueFilter - normalized.length} recipe(s) using a tough braising cut with a too-short cook time.`
      );
    }

    const beforeFlavorMismatchFilter = normalized.length;
    normalized = normalized.filter((r) => !hasTitleFlavorMismatch(r));
    if (normalized.length < beforeFlavorMismatchFilter) {
      console.warn(
        `[Cook AI] ${label} returned ${beforeFlavorMismatchFilter - normalized.length} recipe(s) whose title claimed a flavor/ingredient not actually in ingredientsList.`
      );
    }

    const beforeDoughFeasibilityFilter = normalized.length;
    normalized = normalized.filter((r) => !hasUnrealisticFromScratchDough(r));
    if (normalized.length < beforeDoughFeasibilityFilter) {
      console.warn(
        `[Cook AI] ${label} returned ${beforeDoughFeasibilityFilter - normalized.length} recipe(s) requiring from-scratch dough on an unrealistically short timeline.`
      );
    }

    const beforeOvenTempFilter = normalized.length;
    normalized = normalized.filter((r) => !hasMissingOvenTemp(r));
    if (normalized.length < beforeOvenTempFilter) {
      console.warn(
        `[Cook AI] ${label} returned ${beforeOvenTempFilter - normalized.length} recipe(s) using the oven/broiler/grill with no temperature stated anywhere in the steps.`
      );
    }

    const beforePanSizeFilter = normalized.length;
    normalized = normalized.filter((r) => !hasMissingPanSize(r));
    if (normalized.length < beforePanSizeFilter) {
      console.warn(
        `[Cook AI] ${label} returned ${beforePanSizeFilter - normalized.length} recipe(s) naming a baking dish/pan with no size stated anywhere in the steps.`
      );
    }

    const beforeDonenessCueFilter = normalized.length;
    normalized = normalized.filter((r) => !hasMissingDonenessCue(r));
    if (normalized.length < beforeDonenessCueFilter) {
      console.warn(
        `[Cook AI] ${label} returned ${beforeDonenessCueFilter - normalized.length} recipe(s) with meat/poultry/fish but no checkable doneness cue (temperature or visual/textural signal) anywhere in the steps.`
      );
    }

    if (excludeForCall && excludeForCall.length > 0) {
      const beforeDuplicateFilter = normalized.length;
      normalized = normalized.filter(
        (r) => !isNearDuplicateOfExcluded(r.title, excludeForCall)
      );
      if (normalized.length < beforeDuplicateFilter) {
        console.warn(
          `[Cook AI] ${label} returned ${beforeDuplicateFilter - normalized.length} recipe(s) too similar to an excluded title.`
        );
      }
    }

    if (dietaryRestrictions) {
      const beforeDietFilter = normalized.length;
      normalized = normalized.filter(
        (r) => !getDietViolation(r.ingredientsList, dietaryRestrictions)
      );
      if (normalized.length < beforeDietFilter) {
        // Confirmed real failure (see getDietViolation's doc comment) — the
        // prompt's own "HIGHEST PRIORITY / zero exceptions" guardrail isn't
        // reliable enough on its own, so this is not a hypothetical check.
        console.warn(
          `[Cook AI] ${label} returned ${beforeDietFilter - normalized.length} recipe(s) violating an active diet restriction.`
        );
      }
    }

    return normalized;
  }

  const candidateUrls = buildCandidateUrls(apiKey);
  let lastError = null;

  for (const url of candidateUrls) {
    const modelName = url.match(/models\/(.*?):/)?.[1] || "unknown-model";
    const apiVersion = url.includes("/v1beta/") ? "v1beta" : "v1";

    try {
      console.log(`[Cook AI] Generating recipes: ${apiVersion} -> ${modelName}`);
      let rawRecipes;
      try {
        rawRecipes = await fetchRawRecipes(url, recipeCount, excludeTitles);
      } catch (firstErr) {
        // One immediate retry of the SAME model before moving on — confirmed
        // real failure on an actual device, not a hypothetical: a user's own
        // phone landed on the full local-fallback batch (identifiable
        // because its titles matched the FALLBACK_RECIPES title templates
        // exactly, e.g. "Mayonnaise Skillet Bowl"), meaning BOTH candidate
        // models failed outright that call. Re-running the identical
        // request (same 11-item inventory) from this environment moments
        // later succeeded in ~13s with real AI output — the kind of gap
        // that points at a one-off network blip, not a structural failure
        // of this inventory or these models. A single retry absorbs a blip
        // like that without waiting for the second candidate model AND the
        // final static fallback to also be reached.
        console.warn(
          `[Cook AI] ${modelName} failed once (${firstErr?.message}) — retrying the same model once before moving on.`
        );
        rawRecipes = await fetchRawRecipes(url, recipeCount, excludeTitles);
      }

      if (Array.isArray(rawRecipes) && rawRecipes.length > 0) {
        if (rawRecipes.length !== recipeCount) {
          console.warn(
            `[Cook AI] Expected ${recipeCount} recipes, got ${rawRecipes.length} from ${modelName} — padding/trimming to ${recipeCount}`
          );
        }
        let normalized = normalizeAndFilter(rawRecipes, recipeCount, excludeTitles, modelName);

        // Confirmed real failure, not a hypothetical: before this retry
        // existed, any recipe dropped by the safety nets above (dishType
        // repeat, near-duplicate, tough-cut mismatch, diet violation) was
        // padded IMMEDIATELY with pre-written static content instead of a
        // second real AI attempt — a live audit found a user regenerating
        // a few times in a row ended up seeing the same handful of canned
        // recipes recycle, not fresh AI ideas, because every filtered slot
        // went straight to the static pool. Asking the same model again
        // for just the shortfall — excluding everything already kept or
        // dropped so far, on top of the caller's own excludeTitles — gets
        // a genuinely different real batch far more often.
        //
        // One retry isn't always enough, also confirmed live: on a
        // "regenerate" call with a narrow inventory (e.g. only a
        // beef/pasta/tomato combination on hand), the model's FIRST retry
        // attempt can itself land right back on near-duplicates of the
        // just-excluded titles, because there are only so many genuinely
        // different dishes that inventory supports at the model's usual
        // temperature. A second top-up attempt, excluding everything the
        // first retry also produced (kept or dropped), recovers real
        // recipes in that case rather than giving up after a single try.
        // MAX_TOPUP_ATTEMPTS caps this so a persistently narrow inventory
        // still bottoms out at the static pool instead of looping
        // indefinitely — the static pool remains the last-resort safety
        // net, not the first response to any single filtered slot. Raised
        // from 2 to 3 now that each attempt is meaningfully cheaper — see
        // the thinkingConfig fix on fetchRawRecipes above, which cut
        // gemini-flash-latest's real latency roughly in half. A live A/B
        // against the same real fridge scenarios (6 batches, 30 recipes)
        // found 5/6 batches carrying at least one fallback recipe at 2
        // attempts; the extra attempt is there to bring that down without
        // the proportional latency cost the same change would have had
        // before the thinking fix.
        const MAX_TOPUP_ATTEMPTS = 3;
        let cumulativeExclude = [...(excludeTitles || [])];
        const rawTitlesFirstRound = rawRecipes
          .map((r, i) => normalizeRecipe(r, i, mealType, servings, language).title)
          .filter(Boolean);
        cumulativeExclude.push(...rawTitlesFirstRound);

        for (
          let attempt = 1;
          attempt <= MAX_TOPUP_ATTEMPTS && normalized.length < recipeCount;
          attempt++
        ) {
          const shortfall = recipeCount - normalized.length;
          cumulativeExclude.push(...normalized.map((r) => r.title));
          const retryExclude = [...new Set(cumulativeExclude)];
          try {
            console.log(
              `[Cook AI] ${modelName} batch came up ${shortfall} short after safety filters — top-up attempt ${attempt}/${MAX_TOPUP_ATTEMPTS} for fresh replacements before falling back to static recipes.`
            );
            const usedDishTypesSoFar = normalized.map((r) => r.dishType).filter(Boolean);
            // Over-fetch a couple of extra candidates beyond the literal
            // shortfall — confirmed real failure, live-verified: a retry
            // asked for exactly 1 recipe (shortfall === 1) has only one
            // chance per attempt to land something that clears both the
            // near-duplicate-title and dishType checks, and at this low a
            // temperature the model can propose the same "obvious best fit"
            // multiple attempts in a row, burning all 3 top-ups on a single
            // slot. Asking for a few more candidates per call gives the
            // merge loop below multiple chances to find one that clears
            // both filters, without any extra round-trip.
            const requestCount = Math.min(shortfall + 2, recipeCount);
            const retryRaw = await fetchRawRecipes(url, requestCount, retryExclude, usedDishTypesSoFar);
            const retryTitlesThisAttempt = retryRaw
              .map((r, i) => normalizeRecipe(r, i, mealType, servings, language).title)
              .filter(Boolean);
            cumulativeExclude.push(...retryTitlesThisAttempt);
            const retryNormalized = normalizeAndFilter(
              retryRaw,
              requestCount,
              retryExclude,
              `${modelName} (top-up attempt ${attempt})`
            );
            for (const r of retryNormalized) {
              if (normalized.length >= recipeCount) break;
              if (normalized.some((n) => n.title === r.title)) continue;
              // Confirmed real failure, live-verified: normalizeAndFilter's
              // dishType dedup only checks a batch against itself, so a
              // retry batch was never checked against dishTypes the MAIN
              // attempt already kept — a live run produced "Spinach Cheddar
              // Omelet" (kept from the main attempt) and "Cheesy Mushroom
              // Omelet" (from the retry) in the same final 5, both
              // dishType "omelet". Same rule as dedupeDishType: only
              // "other"/unset dishTypes are exempt from the check.
              if (
                r.dishType &&
                r.dishType !== "other" &&
                normalized.some((n) => n.dishType === r.dishType)
              ) {
                continue;
              }
              normalized.push(r);
            }
          } catch (retryErr) {
            console.warn(
              `[Cook AI] Top-up attempt ${attempt} failed:`,
              retryErr?.message
            );
          }
        }

        // allowPadding: false — never top this batch up with static/filler
        // recipes. Whatever survived normalizeAndFilter + the top-up
        // attempts above is exactly what ships: real, fridge-personalized
        // AI output only, even if that means fewer than `recipeCount`.
        const finalBatch = enforceExactlyFive(
          normalized,
          mealType,
          servings,
          recipeCount,
          dietaryRestrictions,
          excludeTitles,
          scannedIngredients,
          false
        );
        // finalBatch can still be empty here — every raw recipe this model
        // returned got filtered out by the safety nets (diet violation,
        // dishType repeat, near-duplicate title) and the top-up attempts
        // above didn't recover any survivors either. That's not a success:
        // falling through to try the next candidate model (or the honest
        // failure at the end of this loop) beats returning an empty batch
        // as if it were a normal, if small, result.
        if (finalBatch.length > 0) {
          console.log(
            `[Cook AI] Generated ${finalBatch.length} recipes using ${modelName} (${apiVersion})`
          );
          return finalBatch;
        }
        lastError = new GeminiRecipeError(
          "Every candidate recipe was filtered out by the safety checks."
        );
      } else {
        lastError = new GeminiRecipeError(
          "No recipes were found in the AI response."
        );
      }
    } catch (err) {
      if (err?.name === "AbortError") {
        console.warn(
          `[Cook AI] ${modelName} timed out after ${REQUEST_TIMEOUT_MS}ms`
        );
        lastError = new GeminiRecipeError("The AI response timed out.");
      } else {
        console.warn(`[Cook AI] Fetch error for ${modelName}:`, err?.message);
        lastError = err;
      }
    }
  }

  console.warn(
    "[Cook AI] All Vision Engine endpoints failed:",
    lastError?.message || lastError
  );
  throw (
    lastError ||
    new GeminiRecipeError("Could not generate recipes. Please try again.")
  );
}

/**
 * PRO-only: AI Recipe Modifier. Takes an existing recipe + a free-text
 * instruction ("make this vegan", "swap chicken for tofu", "add more
 * spice") and returns a single updated recipe honoring the same dietary
 * guardrail as the main generator. Throws GeminiRecipeError on failure —
 * unlike the batch generator, this is a single interactive request, so a
 * silent generic fallback would be worse UX than a clear "try again" toast.
 */
export async function modifyRecipeWithGemini(
  recipe,
  instruction,
  dietaryRestrictions = null,
  userApiKey = "",
  unitSystem = "us",
  language = "English"
) {
  const apiKey = (
    userApiKey ||
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ""
  )
    .trim()
    .replace(/['"]/g, "");

  if (!apiKey) {
    throw new GeminiRecipeError(
      "AI recipe modification needs a configured Gemini API key."
    );
  }

  const cleanInstruction = String(instruction || "").trim();
  if (!cleanInstruction) {
    throw new GeminiRecipeError("Tell the AI what to change first.");
  }

  const dietaryGuardrail = buildDietaryGuardrail(dietaryRestrictions);
  const originalJson = JSON.stringify({
    title: recipe?.title,
    dishType: recipe?.dishType,
    servings: recipe?.servings,
    ingredientsList: recipe?.ingredientsList,
    steps: recipe?.steps,
  });

  const promptText = `
You are an expert Executive Chef helping a home cook adjust a recipe they already have — not inventing a new one from scratch.

ORIGINAL RECIPE (JSON):
${originalJson}

USER'S REQUESTED CHANGE: "${cleanInstruction}"
${dietaryGuardrail}
═══ MODIFICATION RULES (MANDATORY) ═══
- Apply the user's requested change faithfully (ingredient swaps, dietary conversion, spice level, portion tweaks, etc.).
- Keep everything else about the recipe as close to the original as sensible — this is an edit, not a rewrite.
- Unit system: use ONLY ${unitSystem === "metric" ? `METRIC units — grams/milliliters ("g"/"ml" written as-is in any language) and Celsius` : `US CUSTOMARY measure sizes (a cup, a tablespoon, a teaspoon) and Fahrenheit${language === "English" ? "" : ` — BUT write the unit WORD in ${language}, never the English abbreviation (confirmed real failure: "2 tbsp" / "1/2 cup" left untranslated inside an otherwise-${language} recipe). Translate "cup"/"tablespoon"/"teaspoon" into ${language} exactly like you translate the ingredient name`}`} for every quantity and temperature in the result, even if the original recipe (above) was written in the other system — convert it. Never mix systems or show both.
- If the change implies a new dish name (e.g. "make it vegan" changes the protein), update "title" to reflect that accurately — keep it to 2-4 words, same naming shape as the original generation (flavor/prep word + 1-2 key ingredients + dish type).
- "dishType" (one of "pasta" | "noodles" | "bread" | "pancake" | "oatmeal" | "salad" | "omelet" | "eggs" | "coffee" | "chocolate" | "pudding" | "cake" | "sweet_bowl" | "soup" | "rice" | "chicken" | "meat" | "sandwich" | "other") drives the app's icon — keep the original value unless the change genuinely turns it into a different kind of dish, in which case update it to match.
- Recalculate "ingredientsList" and "steps" so they're fully consistent with the change — never leave a stale ingredient or step that contradicts the new version.
- Step count is 3 to 5 depending on dish complexity (3 for quick/cold, 4 for standard/pan, 5 for full/complex) — match the ORIGINAL recipe's step count unless the requested change genuinely simplifies or complicates the dish (e.g. "make it a no-cook version" can drop to 3; "add a homemade sauce" can grow to 5).
- Every step must still be a complete imperative sentence ending with a period.
- NEVER output a beverage/drink as the result.
- Language: write "title", "servings", "ingredientsList" ingredient names, and "steps" in ${language} — ${language === "English" ? "the app's recipe language" : `the user's selected recipe language, even if the ORIGINAL recipe above happens to be in a different language (translate it)`}. "category" and "dishType" always stay their fixed English tokens regardless — never translate those two.

Return ONLY a single raw JSON object (not an array) with these exact keys:
- "title": string
- "dishType": string, one of "pasta" | "noodles" | "bread" | "pancake" | "oatmeal" | "salad" | "omelet" | "eggs" | "coffee" | "chocolate" | "pudding" | "cake" | "sweet_bowl" | "soup" | "rice" | "chicken" | "meat" | "sandwich" | "other"
- "category": string ("breakfast" | "lunch" | "dinner" | "snack" | "dessert")
- "categoryLabel": string
- "prepTime": string (e.g. "10 min")
- "cookTime": string (e.g. "15 min")
- "totalTime": string
- "calories": string (e.g. "420 kcal")
- "matchBadge": string
- "servings": string
- "ingredientsList": array of "Quantity Ingredient Emoji" strings
- "steps": array of 3 to 5 English imperative strings per the step-count rule above, each ending with a period
`.trim();

  const candidateUrls = buildCandidateUrls(apiKey);
  let lastError = null;

  for (const url of candidateUrls) {
    const modelName = url.match(/models\/(.*?):/)?.[1] || "unknown-model";
    try {
      console.log(`[Cook AI] Modifying recipe via ${modelName}: "${cleanInstruction}"`);
      const generationConfig = {
        temperature: 0.3,
        responseMimeType: "application/json",
      };
      if (THINKING_CAPABLE_RECIPE_MODELS.has(modelName)) {
        generationConfig.thinkingConfig = { thinkingBudget: 0 };
      }
      const response = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig,
          }),
        },
        REQUEST_TIMEOUT_MS
      );

      if (!response.ok) {
        lastError = new GeminiRecipeError(`API Error ${response.status}`);
        continue;
      }

      const data = await response.json();
      let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();

      let result;
      try {
        result = JSON.parse(rawText);
      } catch {
        lastError = new GeminiRecipeError("Failed to process the AI response.");
        continue;
      }

      if (result && typeof result === "object" && result.title) {
        // Same code-level safety net as the batch generator — a single
        // interactive modify request is exactly the kind of case where
        // silently returning a diet-violating result would be worse than
        // an honest "try again" (see getDietViolation's doc comment for
        // why prompt wording alone isn't trusted here).
        const violation = getDietViolation(result.ingredientsList, dietaryRestrictions);
        if (violation) {
          console.warn(
            `[Cook AI] ${modelName} modify result violated an active diet restriction — retrying:`,
            `"${violation.ingredient}" (${violation.word}, ${violation.dietId})`
          );
          lastError = new GeminiRecipeError(
            "Could not modify this recipe while keeping it compliant with your dietary restrictions. Please try again."
          );
          continue;
        }

        const servingsCount = parseInt(
          String(recipe?.servings || "").match(/\d+/)?.[0] || "2",
          10
        );
        return normalizeRecipe(
          result,
          0,
          recipe?.category || "dinner",
          servingsCount,
          language
        );
      }

      lastError = new GeminiRecipeError("The AI didn't return a usable recipe.");
    } catch (err) {
      lastError =
        err?.name === "AbortError"
          ? new GeminiRecipeError("The AI response timed out.")
          : err;
    }
  }

  throw lastError || new GeminiRecipeError("Could not modify this recipe. Please try again.");
}
