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
import { matchesStapleCategory } from "../utils/assumedStaples";
import { log } from "../utils/log";
import {
  EDITOR_MODEL,
  RECIPE_MODELS,
  buildGenerationConfig,
  generateContent,
  parseModelJson,
  resolveApiKey,
} from "./geminiClient";

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
//
// THIRD bug, same root cause, found live: fixing the title side this way
// only moved the problem one field over. This check still substring-matched
// TITLE_FLAVOR_REQUIREMENTS' own English terms ("cream", "milk", "garlic", …)
// against `ingredientsList` — but ingredientsList is ALSO written in the
// user's language. A real Polish recipe with "100ml śmietana 18%" (cream)
// never contains the literal substring "cream", so every non-English
// "creamy"/"garlicky"/"herbed"/etc. recipe was being wrongly rejected
// regardless of whether it genuinely had the ingredient — live-confirmed:
// a Polish batch dropped 4 of 5 recipes per attempt on this exact mismatch.
// Fixed the same way as the title side: the model now self-reports which
// qualifying English ingredient-category terms are genuinely present via
// `flavorEvidenceTags`, so both sides of this comparison are
// language-independent fixed-English tokens instead of one being raw
// user-language text.
function hasTitleFlavorMismatch(recipe) {
  const tags = Array.isArray(recipe?.titleFlavorWords) ? recipe.titleFlavorWords : [];
  if (!tags.length) return false;
  const evidence = new Set(
    (Array.isArray(recipe?.flavorEvidenceTags) ? recipe.flavorEvidenceTags : []).map((t) =>
      String(t || "").toLowerCase().trim()
    )
  );
  for (const tag of tags) {
    const requiredTerms = TITLE_FLAVOR_REQUIREMENTS[String(tag || "").toLowerCase()];
    if (!requiredTerms) continue;
    const satisfied = requiredTerms.some((term) => evidence.has(term));
    if (!satisfied) return true;
  }
  return false;
}

// Flattened, deduplicated vocabulary the model is allowed to use for
// `flavorEvidenceTags` — single source of truth shared with
// TITLE_FLAVOR_REQUIREMENTS so the two can never drift out of sync.
const FLAVOR_EVIDENCE_VOCABULARY = [
  ...new Set(Object.values(TITLE_FLAVOR_REQUIREMENTS).flat()),
];

// CODE-LEVEL "THIN SOUP" SAFETY NET — confirmed real failure, live-verified
// twice: the prompt's own SOUP MINIMUM rule (CORE PRINCIPLES #6) explicitly
// requires 5+ real ingredients and 2+ aromatics for anything labeled a
// soup, using this exact "onion + passata + cream (+ water)" case as its
// own worked example of what's NOT acceptable — yet the live model still
// produced "potato, onion, cream, water" (4 items, one aromatic) for a
// "Zupa krem z pieczonych ziemniaków" after that rule was already in the
// prompt. Prompt instruction alone isn't reliable enough here, matching
// every other check in this file — so this backs it with a code-level
// floor. Deliberately simple (total ingredient count only, not an
// aromatics count) since detecting "is this just water" or "is this a
// real aromatic" by keyword would require per-language matching, the same
// class of bug hasTitleFlavorMismatch had before flavorEvidenceTags fixed
// it — a plain count threshold needs no language parsing and still
// directly catches the confirmed failure shape (it was 4, this requires 5).
function hasThinSoup(recipe) {
  if (recipe?.dishType !== "soup") return false;
  const count = Array.isArray(recipe?.ingredientsList) ? recipe.ingredientsList.length : 0;
  return count < 5;
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
  /(no longer pink|no pink|juices (?:run|are|ran) clear|clear juices|opaque|flakes? easily|firm to the touch|springs? back|internal temperature)/i;

// Protein that is already cooked, cured, or preserved by the time it's
// bought. Confirmed live: a canned-tuna pasta (tuna drained and folded in at
// the end, pasta boiled in another step) was rejected on every attempt as
// "missing a doneness cue" because the recipe contained a fish word and a
// "boil" verb somewhere — nothing in it was raw. English-only like the term
// lists above, which is also all hasMissingDonenessCue can see.
const PRECOOKED_PROTEIN_RE =
  /\b(canned|tinned|smoked|cured|cooked|deli|ham|salami|prosciutto|pepperoni|frankfurter|hot dogs?|cold cuts?|lox|surimi)\b/i;

function hasMissingDonenessCue(recipe) {
  const ingredientsList = Array.isArray(recipe?.ingredientsList) ? recipe.ingredientsList : [];
  const containsRawMeatPoultryFish = ingredientsList.some((item) => {
    const lower = String(item || "").toLowerCase();
    if (PRECOOKED_PROTEIN_RE.test(lower)) return false;
    return [...MEAT_POULTRY_TERMS, ...FISH_SEAFOOD_TERMS].some((term) =>
      matchesForbiddenTerm(lower, term)
    );
  });
  if (!containsRawMeatPoultryFish) return false;
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
      // Singular/plural count as the same word — "Beef Stuffed Peppers" and
      // "Cheesy Beef Stuffed Pepper" landed in the same live batch.
      .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w))
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
 * Stricter sibling of isNearDuplicateOfExcluded, for comparing a top-up
 * candidate against recipes ALREADY KEPT in the same batch. Confirmed live:
 * using the 2-shared-words rule there threw away every top-up candidate for
 * a shrimp/garlic inventory ("Tomato Garlic Shrimp Rice" vs "Creamy Garlic
 * Shrimp Pasta" share "garlic" + "shrimp" but are different dishes), so all
 * 3 top-up rounds were wasted (~20 s) and the batch shipped with 3 recipes.
 * Within one batch, dishType dedupe already keeps formats apart; this only
 * catches a genuine rename — nearly all of the shorter title's words shared.
 */
function isRenameOfKeptTitle(title, keptTitles) {
  const words = significantTitleWords(title);
  if (words.size === 0) return false;
  return (keptTitles || []).some((kept) => {
    const keptWords = significantTitleWords(kept);
    let overlap = 0;
    for (const w of keptWords) {
      if (words.has(w)) overlap++;
    }
    return overlap >= 2 && overlap / Math.min(words.size, keptWords.size) >= 0.75;
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
 * Soft ceiling, only ever applied at a sentence boundary. Raised from 220:
 * a judged live evaluation found steps cut mid-sentence with a period glued
 * on ("...until the cheese is melted and.", "...eine Kerntemperatur von.")
 * — the old cap fell back to cutting at the last space when a long step had
 * no sentence break, and dropping trailing sentences can also drop the very
 * doneness cue or salt amount a step exists to give. A long step is a
 * smaller problem than a broken or incomplete one.
 */
export const GOLDILOCKS_STEP_MAX = 420;

export const GEMINI_RECIPE_SYSTEM_PROMPT = `
You are an experienced home cook who loves to create delicious, well-rounded recipes. Your cooking is practical enough for a weekday dinner but thoughtful enough to impress — you stick to dishes people have actually cooked and loved, know how to build layers of flavor, and know which techniques make a real difference without being fussy.

CRITICAL LANGUAGE RULE:
The per-request LANGUAGE section below names exactly one human language — titles, category labels, match badges, ingredient names, quantities, and every instruction step MUST be written in that language and that language only. This applies to natural-language text values only. The JSON field keys, "category" field (always "breakfast" | "lunch" | "dinner" | "snack" | "dessert"), and "dishType" field (one of the fixed English tokens listed below) must stay as exact English tokens — the app matches against these in code, so translating them breaks the app. Write in the target language's natural recipe style, not a mechanical translation. Capitalize according to that language's rules, not English Title Case.

CAPITALIZATION OF INGREDIENTS AND TITLES (MANDATORY):
- INGREDIENT NAMES in "ingredientsList": write them in LOWERCASE (small letters) unless the word is a genuine proper noun that is always capitalized in that language — a brand name, a named cheese (Parmesan, Feta, Mozzarella), or a proper geographic/regional name. Common ingredient words must be lowercase no matter what precedes them: "2 pomidory", "1 cebula", "150g mąki" — never "2 Pomidory" or "1 Cebula". In German, however, ALL nouns are capitalized by that language's own grammatical rule (e.g. "2 Tomaten", "1 Zwiebel") — that is correct German, not an error. The quantity and the ingredient name must be separated by exactly one space — never glued together (e.g. "2pomidory" is wrong, "2 pomidory" is correct).
- RECIPE TITLES: a dish title is a NAME, so it MUST start with a capital letter using that language's normal sentence/name capitalization (never ALL-CAPS, never lowercase-first). A title like "kurczak z warzywami" looks like a typo — it must read "Kurczak z warzywami". Follow the same NATIVE FLUENCY and per-language capitalization rules described above (most languages: capitalize the first word and proper nouns; German: capitalize every noun).

YOUR GOAL:
Generate exactly 5 distinct, appetizing, and realistic recipes based on the user's detected fridge items and pantry staples.

DIETARY PREFERENCES:
When active, these are absolute, non-negotiable constraints — every recipe must comply, even if that means leaving an ingredient out.

CORE PRINCIPLES:
1. Use your culinary judgment. Combine ingredients that work well together in real dishes people love to cook and eat. The right number of ingredients for a dish is whatever that dish genuinely needs — nothing more, nothing less.
2. Assume basic kitchen staples are always available: water, cooking oil, butter, salt, black pepper, and plain sugar. Every savory recipe MUST include salt and pepper. Never assume honey, garlic, vanilla, or other flavorings are available unless scanned.
3. NEVER fabricate ingredients. Only use items from the fridge/pantry lists provided. If the inventory is sparse, write honest, simple recipes — a well-seasoned dip or a perfectly cooked egg is better than a dish built on invented ingredients. This is a hard rule: no invented meat, poultry, seafood, dairy, eggs, pasta, or flavorings.
4. Every title must honestly describe what's in the dish. Don't name a dish "Omelet" without eggs, or "Creamy Pasta" without cream. If a title uses a flavor word (herbed, garlic, honey, lemon, creamy, etc.), that ingredient must genuinely be in the dish.
5. Write recipes that are technically sound with COMPLETE, REAL CULINARY SEQUENCES. This means:
   - SAUTÉ ORDER: onions and aromatics ALWAYS go first (sweat until translucent) before adding vegetables that release water (mushrooms, zucchini, tomatoes) — otherwise the water prevents the onion from caramelizing.
   - CUTTING: never assume the user knows to cut ingredients. If a recipe involves meat, specify "cut into bite-sized pieces" or "slice into strips" before cooking. If a recipe involves vegetables to be cooked together, specify how they should be cut (diced, sliced, chopped). A step saying "fry the mushrooms and meat" without mentioning cutting first is incomplete.
   - MIXING/FLIPPING: when browning meat or vegetables in a pan, specify "turn occasionally" or "stir every 2-3 minutes until browned on all sides" — do not just say "brown".
   - GROUND/MINCED MEAT (MANDATORY, DISTINCT FROM THE SLICE/CUBE CASE ABOVE): confirmed real complaint — "throw the meat in the pan and fry it" leaves out the one thing an inexperienced cook genuinely doesn't know to do with ground meat specifically: break it apart as it cooks. Any step adding ground/minced meat to a pan MUST say to break it up with a spatula/spoon into small crumbled pieces while it cooks (not just "cook until browned"), and must say to keep breaking it apart and stirring until no raw/pink pieces remain — ground meat clumps into one solid mass if left alone, and a beginner has no way to know that unless the step says so.
   - Every step must be complete enough that someone cooking for the first time could follow it without guessing. This is not a "beginner mode" — even professional recipes (Ania Gotuje, Kwestia Smaku, BBC Good Food) specify these details because the cutting/order/flipping is the actual cooking technique, not a beginner concession.
6. A DISH MUST BE A COMPLETE, HONEST VERSION OF ITSELF — not a stripped-down fragment: a soup must actually be a soup, an omelet must be an omelet, a sauce must be a sauce. If the real inventory genuinely supports naming a dish, write it as a real, complete version of that dish. Never label a fragment as a full dish — either build the complete version with what's actually available, or rename it to what it really is.
   - SOUP MINIMUM (MANDATORY, STILL A CONFIRMED LIVE FAILURE — plain water does NOT fix this on its own): any dishType "soup" MUST have at least 5 real ingredients (not counting plain water) AND at least TWO aromatics (never onion alone — pair it with garlic, celery, carrot, leek, or a dried herb/spice). "Onion + tomato passata + cream + water" is still a thin fragment even with water added, because water alone has no flavor to contribute — it only counts as a liquid base when the aromatics and seasoning around it are already doing real work. If the available inventory can't support 5 real ingredients and 2 aromatics for a genuine soup, do NOT force a soup — pick a different dish entirely (a sauce, a dip, a pan dish) that's honest about being simple, rather than a thin dish wearing "soup" as its label.
7. REAL DISH TEST (MANDATORY — do this before finalizing every recipe): would a real person actually cook and eat this dish? Never generate a dish that is a bizarre combination, a "for-the-sake-of-it" mashup, or something that sounds unappetizing. Concretely: a "creamy orange dessert with chicken" is not a real dish — it's a mistake. A "sweet oatmeal bowl" with random savory ingredients is not a real dish. A "cashew oatmeal" without cashews in inventory is fabricated. Every recipe must pass this test: ask yourself "would this be served in a real home kitchen or restaurant?" — if not, it fails. A recipe that fails the REAL DISH TEST is worse than no recipe at all.
   - CLASSIC FIRST (MANDATORY): every recipe must be a recognizable, tried-and-tested dish — or a small, sensible variation of one — that a home cook could name ("tuna pasta in a creamy leek sauce", "chicken and vegetable rice skillet"). Before writing each recipe, silently name the classic it is a version of; if you can't, drop the odd ingredient or pick a different dish. Variety across the batch comes from choosing DIFFERENT classic dishes, never from unusual pairings; with a small inventory it is better for several recipes to be simple, honest takes on the same few classics than for one to be an experiment.
   - Sauces and condiments (Worcestershire, soy, ketchup, mustard, hot sauce, vinegar, jam) are seasoning, not the main event: use one only where that classic dish genuinely uses it, in a small amount, and never just because it was scanned. A splash of Worcestershire in a creamy tuna-and-leek sauce, or cream poured over a raw-vegetable "salad", is exactly the kind of pairing that fails this test.
8. PHYSICAL SENSE CHECK (MANDATORY — do this before finalizing every step): every step must be physically possible and use ingredients in their correct form. A raw ingredient must be raw when it's meant to be cooked, and a cooked ingredient must never be described as "poured", "poured in", or added as if it were a liquid when it can't be. Concretely: you pour RAW whisked eggs into a pan (they are liquid); you never "pour" a cooked/solid egg or a solid ingredient. Re-read each step and check "can a person actually do this with the ingredient in the state it would be in at that point?" — if not, fix it.
9. Use a single measurement system (US or Metric) as specified — never mix or show both. When the recipe language is not English, translate the unit words too (e.g. "łyżka" not "tbsp").
10. Match the step count to the dish's complexity — 3 steps for simple dishes, 4 for standard, 5 for more involved ones. Never pad a simple dish to 5 steps.
11. Write clear, imperative instructions. Every step must be a complete sentence ending with a period. Every ingredient used in a step must appear in the ingredientsList.
12. Across the batch of 5, vary the dish formats and avoid repeating the same dishType. Don't use the same lead flavor word in more than one title.
13. Titles: specific, recognizable, and SHORT (max 3-4 words — see the detailed title rule in the per-request instructions below for the full specification; this is not a suggestion, it's a hard cap kept deliberately tight so titles fit a small mobile card without wrapping or truncating). Name the dish what it actually is, but short doesn't mean generic — prefer one well-chosen texture/technique/flavor word over a bare ingredient list ("Kremowa owsianka", not "Owsianka na mleku"). In non-English languages, write the title in that language — never a translated English title shape. Use the language's own natural dish-naming convention.

MEAT/POULTRY/SEAFOOD DONENESS & TECHNIQUE (MANDATORY): name the protein exactly as the inventory does — never guess a species or cut, and never write alternatives like "chicken/turkey". Every step that finishes RAW meat, poultry, or fish gives its time AND a checkable cue: an internal temperature (poultry and ground meat 165°F/74°C, other whole cuts 145°F/63°C — in the batch's unit system only) or a visual cue ("no pink remains inside", "juices run clear", fish "flakes easily with a fork"); for a generic cut, cook until tender and no pink remains. Tough cuts (shoulder, chuck, shank) need 60-90+ minutes of braising. Canned, smoked, cured, or cooked protein (canned tuna, ham) is not raw: drain it and fold it in at the end, with no doneness cue.
SEASONING AMOUNTS (MANDATORY): never write just "boil in salted water" or "cook in salted water" — say how much salt for how much water, e.g. "boil the pasta in 2 litres of water with 20 g salt" (about 10 g per litre; US units 1 tablespoon per 2 quarts). Salt and every spice a step uses appear in "ingredientsList" with an amount.

REQUIRED FIELDS PER RECIPE OBJECT:
- "id": number (1..5)
- "title": Dish Name — any real, recognizable dish. Do NOT constrain yourself to a fixed list of formats.
- "dishType": AFTER you've chosen a real, recognizable dish, assign the CLOSEST fit from this fixed inventory: "pasta" | "noodles" | "bread" | "pancake" | "oatmeal" | "salad" | "omelet" | "eggs" | "coffee" | "chocolate" | "pudding" | "cake" | "sweet_bowl" | "soup" | "rice" | "chicken" | "meat" | "sandwich" | "other". IMPORTANT: this token is ONLY an internal icon label for the app — it must NOT limit the dish itself. Design the dish freely and openly; then map it to whichever token comes closest (use "other" freely when it doesn't cleanly fit any). Do not let this list constrain what you create.
- "category": "breakfast" | "lunch" | "dinner" | "snack" | "dessert"
- "categoryLabel": English label
- "prepTime": "X min"
- "cookTime": "X min"
- "totalTime": "X min"
- "calories": "X kcal"
- "protein": "Xg"
- "carbs": "Xg"
- "fat": "Xg"
- "matchBadge": English (e.g. "Uses 4 fridge items")
- "titleFlavorWords": array of English tags from ["creamy","cheesy","buttery","garlicky","garlic","honey","lemony","lemon","spicy","smoky","maple","herbed","vanilla"] — empty array [] on most recipes
- "flavorEvidenceTags": array of English ingredient-category terms from ${JSON.stringify(FLAVOR_EVIDENCE_VOCABULARY)} — list every one that genuinely corresponds to a real ingredient in THIS recipe's ingredientsList (even if the title doesn't mention it), always in English regardless of the recipe's language. This lets the app verify flavor claims without parsing a non-English ingredient list. [] if none apply.
- "servings": "Serves X people"
- "ingredientsList": array of "Quantity Ingredient Emoji" strings
- "steps": 3 to 5 imperative strings, each ending with a period
- "upgradeIngredient" / "upgradeNote": optional, JSON null on most recipes
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
// failure (RECIPE_MODELS), each now retried once in place on a
// failure (see the retry right below this in the model loop) — so
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
  // German capitalizes every noun as a normal, correct feature of the
  // language itself — that's not the same failure as English-style Title
  // Case applied to a language that doesn't use it. Kept separate from
  // isEnglish so the capitalization rule below can treat the two
  // differently instead of lumping German in with "every other language."
  const isGerman = language === "German";
  const mealTypeConstraint = mainMealsOnly
    ? `ALL ${recipeCount} recipes MUST be substantial "lunch" or "dinner" category main meals. Never "breakfast", "snack", or "dessert".`
    : mealType !== "all" && KNOWN_MEAL_TYPES.has(mealType)
      ? `ALL ${recipeCount} recipes MUST have "category" set to "${mealType}". Do not suggest dishes from other meal categories. CRITICAL: "${mealType}" defines the ENTIRE CHARACTER of the dish — if mealType is "breakfast", create BREAKFAST dishes (sweet OR savory breakfast foods). If mealType is "dessert", create DESSERTS (100% sweet dishes). If mealType is "lunch" or "dinner", create SAVORY MAIN DISHES (never sweets, never breakfast foods). USER'S MEAL TYPE PREFERENCE IS ABSOLUTE — respect it 100%.`
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

  const diversityOrMainMealsRule = mainMealsOnly
    ? `═══ ABSOLUTE RULE FOR WEEKLY MEAL PLANNER (MANDATORY) ═══
Generate ONLY substantial, savory, satisfying main meals (lunches and dinners) like pastas, stir-fries, skillet bakes, soups, and hearty salads. STRICTLY FORBIDDEN: do NOT include sweet desserts, sugary breakfast bowls, parfaits, or pancakes anywhere in this batch. Every single recipe must be a proper, comforting home-cooked meal — vary the cooking style (pasta, stir-fry, skillet, soup/stew, hearty salad, casserole/bake) across the batch so it doesn't feel repetitive, but never break the savory-main-meal rule to do so.`
    : mealType !== "all" && KNOWN_MEAL_TYPES.has(mealType)
      ? `═══ WITHIN-CATEGORY DIVERSITY (MANDATORY) ═══
Every recipe here is locked to the single category "${mealType}" (see MEAL TYPE CONSTRAINT above), so diversity means genuinely different DISHES within "${mealType}" — different cooking methods, different proteins/bases, different flavor profiles. No two recipes in this batch may be the same format. Do not default to the same 3-4 "obvious" dishes for this category every time — that collapse is the single most common failure, especially on a regenerate. Imagine a real cook with this inventory planning ${recipeCount} genuinely different meals — not variations of one.` 
      : `═══ TRUE DIVERSITY (MANDATORY) ═══
When generating exactly ${recipeCount} recipes, make each one a GENUINELY different dish — not five variations of the same template. Vary the cooking method (bake, pan-sear, roast, simmer, grill, cold-prep), the base (pasta, rice, grains, bread, vegetables, protein as the centerpiece), and the flavor direction (fresh, rich, spicy, herby, umami, bright). Imagine a real cook with this exact inventory planning a varied week of meals. Do NOT default to the same handful of formats (while a "bowl", "skillet", or "pasta" may be legitimate, they must not become the default for every batch). If two recipes would use the same method AND base, change one of them.`;

  return `
CRITICAL HARD RULE: You MUST return EXACTLY ${recipeCount} distinct recipes in the JSON array — never fewer, never more. The array length MUST be exactly ${recipeCount} every single time.
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
- The user's selected recipe language is: ${language}. ALL natural-language text fields ("title", "servings", "ingredientsList" ingredient names, "steps") MUST be written in ${language} and ${language} only — ${isEnglish ? "never any other language" : `never English, never any language other than ${language}`}. This is not optional for any one of these fields individually — do not leave "servings" in English while translating the rest, or vice versa. ("categoryLabel" and "matchBadge" are never shown to the user — leave them in English, it doesn't matter either way.)
- NATIVE GRAMMAR & FLUENCY (MANDATORY — THIS IS THE MOST COMMON FAILURE): When ${language} is not English, write everything the way a native ${language} speaker who cooks would naturally phrase it. This means:
  * CORRECT GRAMMAR AND WORD FORMS: Use the ${language}'s real grammatical rules — correct case endings (e.g. Polish genitive after numbers: "pięć przepisów" not "pięć przepisy"), correct verb conjugations, correct adjective-noun agreement. Every sentence must be in the target language's real grammar, not English grammar with ${language} words substituted in.
  * NATURAL WORD ORDER: ${language} has its own sentence structure — do not copy English word order. Things that sound natural in English may sound stiff or wrong when translated word-for-word.
  * NATIVE RECIPE VOCABULARY: Use the words and phrases a real cook using that language would actually use — not a dictionary translation of an English instruction. For example, Polish cooks say "dodaj" not "zaaduj", "mieszaj" not "miksuj", "smaż na złoty kolor" not "gotuj aż będzie złote".
  * NO LITERAL TRANSLATION: Before finalizing every sentence, silently ask yourself: "would a native ${language} speaker actually write it this way, or does this sound like a translation?" — if it sounds like a translation, rewrite it naturally.
  * ⚠️ CRITICAL: ZERO ENGLISH WORDS IN NON-ENGLISH RECIPES (MANDATORY — CONFIRMED REAL FAILURE HAPPENS CONSTANTLY): When ${language} is not English, EVERY SINGLE WORD in "title", "ingredientsList", and "steps" MUST be ${language}. This is NOT optional. CONFIRMED REAL FAILURES from production: Polish users saw "Lemon Yoghurt Bowl", "Zesty Lemon Egg", "Poached Egg with Herbs" — these are 100% ENGLISH titles in a Polish recipe. THIS IS COMPLETELY UNACCEPTABLE AND LOOKS BROKEN TO THE USER. BEFORE you finalize ANY title or ingredient name, you MUST check EVERY SINGLE WORD: if ANY word is English (Lemon, Yoghurt, Egg, Bowl, Poached, Zesty, etc.) and ${language} has its own word for it, you MUST USE THE ${language} WORD. Examples for Polish: "Lemon" → "Cytrynowy", "Yoghurt" → "Jogurt", "Egg" → "Jajko", "Poached" → "w koszulce", "Bowl" → "Miseczka" or use natural Polish dish vocabulary. For ${language}: translate EVERY food word, cooking word, and descriptive word. The ONLY English allowed: JSON field keys ("id", "title", etc.), "category" token, and "dishType" token. If you write "Lemon", "Egg", "Bowl", "Poached" or ANY English food/cooking word in a non-English recipe title or ingredient, YOU HAVE FAILED THIS REQUIREMENT.
  * QUANTITY + INGREDIENT: The quantity and ingredient name must be separated by exactly one space, never glued. Use the correct grammatical case for the ingredient after a number (e.g. Polish: "2 cebule" (nominative plural), "5 cebul" (genitive plural) — the case changes with the number).
- Two fields are the ONLY exception and stay in their fixed English tokens regardless of the language above, because the app matches them in code: "category" (one of "breakfast"|"lunch"|"dinner"|"snack"|"dessert") and "dishType" (one of the fixed tokens in REQUIRED FIELDS). Do not translate either one.
${isGerman ? `- GERMAN NOUN CAPITALIZATION (MANDATORY — confirmed in testing: batches came back with lowercase nouns like "hähnchenbrust", "salz", "die zwiebel"): in German EVERY noun starts with a capital letter wherever it appears — in "title", in every ingredient name in "ingredientsList" ("200g Hähnchenbrust", "1 Zwiebel", "2g Salz"), and inside every step. This overrides the lowercase-ingredient rule above, which is for languages that do not capitalize nouns.\n` : ""}- "title": create a real dish name that genuinely describes what this is. CRITICAL: Keep titles ULTRA-SHORT AND CONCISE (MAX 3-4 WORDS). Never write long, descriptive sentences. E.g. write "Makaron z pomidorami" instead of "Kremowy makaron z suszonymi pomidorami i mascarpone". Write "Jajecznica z papryką" instead of "Jajecznica z żółtą papryką i cebulą". The titles MUST fit elegantly on a small mobile UI card. SHORT DOES NOT MEAN GENERIC (confirmed real complaint): a short title still needs to sound like an appetizing, deliberately-named dish, not a bare ingredient list with a preposition. "Owsianka na mleku" (oatmeal with milk) is a flat, lifeless title — milk is the default liquid for oatmeal anyway, so naming it tells the user nothing appetizing. Prefer one well-chosen texture, technique, or flavor word instead: "Kremowa owsianka" or "Owsianka z cynamonem" — still 2-3 words, but it actually sounds like something worth eating. Across this batch of ${recipeCount}, every title's lead descriptor word must be DIFFERENT — do not open two or more titles with the same flavor/prep word, even if several dishes share a quality like sweetness. ${isEnglish ? `Name the dish naturally in English.` : `Name the dish in ${language} — use natural dish-naming conventions for that language, not a translated English title format.`} CAPITALIZATION: ${isEnglish ? `standard English Title Case — capitalize each major word ("Creamy Garlic Chicken").` : isGerman ? `German's own real rule — every noun is capitalized wherever it falls in the sentence (this is correct German grammar, not English Title Case); all other words follow German's own normal capitalization (first word of a sentence/title, proper nouns).` : `the language's own real capitalization rule — typically only the first word and proper nouns are capitalized, never every major word like English does.`}
- Never invent ingredients outside the inventory lists above.

═══ INVENTORY LOCK (MANDATORY) ═══
- ONLY use ingredients from the fridge list and pantry staples above.
- Seasonings, oil, salt, pepper, and sugar from pantry are allowed if listed (or the basic pantry defaults named in the pantry list above) — nothing else may be added, no matter how thin the list above is. Do NOT invent eggs, pasta, flour, rice, tofu, or any other staple that isn't explicitly listed. If the real inventory is too sparse to naturally fill 5 substantial dishes, write smaller/simpler honest recipes instead of fabricating a main ingredient — a fabricated ingredient makes the recipe unusable since the user doesn't actually own it.
- NO FAKE INGREDIENTS — ZERO TOLERANCE: Never invent meat, poultry, seafood, dairy, or expensive ingredients that were not actually scanned. This is a confirmed real failure: given only condiments, past batches invented "chicken", "tofu", "eggs", "pasta", and "honey" — none of which were in the actual inventory. If the user scanned only ketchup, mustard, and yogurt, do NOT generate a recipe that requires chicken, tofu, pasta, or eggs. Instead, generate a recipe that uses ONLY what was actually scanned (e.g., a seasoned dip, a yogurt sauce, a simple glaze). A sparse but 100% honest recipe is ALWAYS better than a fuller one built on invented ingredients.
- Never title a dish after a format/ingredient it doesn't really contain (e.g. don't call it "Omelet" unless eggs are actually in its ingredientsList).
- EXCEPTION: this lock never overrides the diet guardrail above — if an inventory item conflicts with an active restriction, exclude it even though it's in the fridge/pantry list.${ingredientPriorityLine}

═══ CULINARY HARMONY (MANDATORY) ═══
- NO BIZARRE COMBINATIONS: Just because an ingredient was scanned DOES NOT mean it must be used in every dish. Do not force mismatched ingredients together. Confirmed real failure: AI combined Eggs and Lemon to make "Lemon Eggs" because both were scanned. This is a gross hallucination. If a combination sounds strange, unappetizing, or weird to a real chef, DO NOT generate it.
- LESS IS MORE: It is ALWAYS better to write a simple, 2-ingredient or 3-ingredient traditional recipe than a 5-ingredient weird hallucination. Prioritize taste and culinary correctness above all else. If you have to drop a scanned ingredient to make the dish taste good, DROP IT.
- CONDIMENTS ARE NOT INGREDIENTS TO USE UP: a scanned sauce or condiment (Worcestershire, ketchup, mustard, soy sauce, hot sauce, vinegar) goes into a dish only if that classic dish genuinely contains it. Leave it out of most recipes, and never put the same condiment into more than two recipes of the batch. Confirmed real feedback from a tester: tuna pasta with Worcestershire sauce in the cream sauce read as a strange, untested pairing.

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
- Emoji rule: accurate food emoji, else category (🥦 veg, 🥩 meat, 🥛 dairy, 🌾 grain, 🫙 pantry, 🍳 egg) — NEVER 📦/box. For mushrooms specifically, use 🍄‍🟫 (brown mushroom), NEVER the plain 🍄 — confirmed real failure: 🍄 renders as a red-spotted toadstool (visually a poisonous Amanita muscaria) on most platforms, which is an alarming and wrong thing to show next to a recipe ingredient.

Return ONLY a raw JSON array of exactly ${recipeCount} objects with these exact keys:
- "id": number (1..${recipeCount})
- "title": string, in ${language} (see LANGUAGE above)
- "dishType": string, the CLOSEST fit from "pasta" | "noodles" | "bread" | "pancake" | "oatmeal" | "salad" | "omelet" | "eggs" | "coffee" | "chocolate" | "pudding" | "cake" | "sweet_bowl" | "soup" | "rice" | "chicken" | "meat" | "sandwich" | "other" — ALWAYS this exact English token regardless of ${language}, never translated. This token is ONLY an icon label for the app; it does NOT limit what dish you create. Design the dish openly and freely, then map it to the closest token (use "other" freely). Whatever the dish actually is, drives the app's icon, must be accurate on its own.
- "category": string ("breakfast" | "lunch" | "dinner" | "snack" | "dessert") — ALWAYS this exact English token regardless of ${language}, never translated.
- "categoryLabel": string (English — never shown to the user, leave as English)
- "prepTime": string (e.g. "10 min") — REALISTIC prep time only. Chopping vegetables: 5-10 min. Mixing ingredients: 3-5 min.
- "cookTime": string (e.g. "15 min") — REALISTIC cook time based on the ACTUAL technique and ingredient. CRITICAL VALIDATION: Hard-boiled eggs: minimum 10-12 min. Soft-boiled eggs: minimum 6-7 min. Scrambled eggs: 3-5 min. Chicken breast (pan): minimum 12-15 min. Never write unrealistic times like "3 min" for boiled eggs or "5 min" for chicken — these are dangerously wrong and will result in raw food.
- "totalTime": string (e.g. "25 min") — MUST equal prepTime + cookTime. Never write a totalTime that doesn't match.
- "calories": string (e.g. "420 kcal")
- "protein": string (e.g. "28g") — estimate from the actual ingredientsList quantities and standard nutrition data, scaled for ${servings}.
- "carbs": string (e.g. "35g") — same estimation basis as protein.
- "fat": string (e.g. "14g") — same estimation basis as protein.
- "matchBadge": string (English — never shown to the user, leave as English)
- "titleFlavorWords": array of English tags — [] for most recipes; only include a tag when the title in ${language} genuinely uses that descriptor concept AND ingredientsList genuinely backs it up.
- "flavorEvidenceTags": array of English ingredient-category terms, ONLY from this exact fixed list: ${FLAVOR_EVIDENCE_VOCABULARY.map((t) => `"${t}"`).join(", ")}. This is a SEPARATE self-check field, always in English regardless of ${language} (like "category"/"dishType"), that exists because ingredientsList is written in ${language} and the app cannot otherwise verify your flavor claims in a non-English language. List EVERY term from that fixed list whose real-world ingredient genuinely appears anywhere in THIS recipe's ingredientsList — e.g. if ingredientsList contains the ${language} word for cream (however it's spelled in ${language}), include "cream" here; if it contains the ${language} word for garlic, include "garlic". This is independent of titleFlavorWords — list every term that applies even if the title doesn't mention it. [] only when genuinely none apply. Any tag you put in titleFlavorWords whose matching term is missing here will cause the recipe to be silently discarded, so be accurate and complete, not conservative.
- "servings": string, written entirely in ${language} — translate both the number-word phrasing AND "Serves"/"people" (or whatever ${language}'s natural equivalent phrase is), not just the surrounding words. ${isEnglish ? `E.g. "Serves ${servings} people".` : `Do NOT leave this field in English — e.g. for Polish this would be "Dla ${servings} osób", for Spanish "Sirve a ${servings} personas"; produce the real ${language} equivalent, not a transliteration.`}
- "ingredientsList": array of Quantity + Ingredient + Emoji strings ONLY (inventory only, scaled for ${servings}, ingredient names in ${language}) — every entry must be a real food item, NEVER an instruction. Confirmed real failure: a past batch put "Preheat the oven to 350°F. 🫙" as an ingredientsList entry — that is a step, not an ingredient, and must never appear here even for oven recipes (the preheat instruction goes in "steps" only). Quantities MUST use ONLY the ${isMetric ? "METRIC (grams/ml)" : "US CUSTOMARY"} system per UNIT SYSTEM above${isMetric ? ` — e.g. "120g Mąka 🌾" (ingredient translated, "g"/"ml" written as-is)` : isEnglish ? ` — e.g. "1 cup Flour 🌾"` : ` — e.g. for Polish "1 szklanka Mąka 🌾" NOT "1 cup Mąka 🌾" (the unit WORD translates too — see UNIT SYSTEM above)`}.
- "steps": array of 3 to 5 imperative strings in ${language} per the DYNAMIC STEP COUNT rule above, each ending with a period. If the recipe uses an oven/broiler/grill, one step MUST be an explicit preheat instruction with a real ${isMetric ? "°C" : "°F"} temperature. Any step finishing meat/poultry/seafood must pair its time with a real doneness cue (temperature or a visual/textural check), never a time estimate alone — see MEAT/POULTRY/SEAFOOD DONENESS & TECHNIQUE above, which also governs matching the cook time/technique to the actual cut.
- "upgradeIngredient": JSON null on most recipes, or a short ${language} ingredient name (e.g. ${isEnglish ? `"Fresh Basil"` : `the real ${language} name, not a transliteration`}) — This is rare; only set it when genuinely true, never fill it in "to be thorough."
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
    "flavorEvidenceTags": [],
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
    "flavorEvidenceTags": ["yogurt"],
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

Note: the second example above is intentionally a quick/cold dish with only 3 steps — a real sparse-inventory case (just yogurt + jam) elevated into a classic comforting bowl, NOT padded to 5 steps and NOT forced into an odd combination. Match this pattern whenever the available ingredients are simple. It also shows "upgradeIngredient"/"upgradeNote" as null, null — this should be the outcome for MOST recipes; the first example's feta suggestion is the rare exception, not the default. Note its "flavorEvidenceTags": ["yogurt"] even though "titleFlavorWords" is empty — list every qualifying term that's genuinely true of the ingredients, independent of whether the title happens to mention it.

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
  //
  // Confirmed real failure, same root cause one level deeper: a single
  // "emoji unit" here didn't cover a ZWJ-joined COMPOUND emoji like 🍄‍🟫
  // (mushroom U+1F344 + ZERO WIDTH JOINER U+200D + brown square U+1F7EB —
  // three codepoints, one glyph). The old pattern only matched the LAST
  // unit of a compound (the 🟫 half); the outer loop's re-match on what
  // remained ("…pieczarki 🍄‍") then stopped at the bare ZWJ since it isn't
  // itself emoji-shaped, leaving "🍄‍" (mushroom + dangling joiner) stuck in
  // the ingredient NAME text with our own clean 🍄‍🟫 appended after it —
  // live result: "150g pieczarki 🍄‍ 🍄‍🟫". The repeated group's trailing
  // `‍?` below consumes an emoji unit together with its own following
  // joiner in the same pass, so a whole ZWJ chain comes off in one match.
  const m = s.match(
    /((?:(?:[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF\u2B00-\u2BFF])[\uFE0E\uFE0F]?\u200D?)+)\s*$/
  );
  return m ? m[1] : null;
}

// Confirmed real failure, same family as extractTrailingEmoji but at the
// OTHER end: the spec tells the model to put its emoji at the very end
// ("<Quantity> <Ingredient> <Emoji>"), but a live response put one right
// after the quantity too — "100g 🍄‍🟫 pieczarki 🍄‍🟫" — which the
// trailing-only stripper above never touches, since it isn't at the end of
// the string. Mirrors extractTrailingEmoji exactly, anchored at the start
// instead of the end.
function extractLeadingEmoji(text) {
  const s = String(text || "").trim();
  const m = s.match(
    /^((?:(?:[\uD800-\uDBFF][\uDC00-\uDFFF]|[☀-➿⬀-⯿])[︎️]?‍?)+)\s*/
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
      let name = (qtyMatch?.[1] || withoutEmoji).trim();

      // Strip a leading emoji the model put right after the quantity —
      // see extractLeadingEmoji's own comment for the confirmed live case.
      // withoutEmoji === <quantityPrefix><name> exactly (qtyMatch's group 1
      // is the string's own tail), so slicing off name's old length and
      // appending the cleaned version reconstructs it losslessly.
      const leadingEmoji = extractLeadingEmoji(name);
      if (leadingEmoji) {
        const cleanName = name.slice(leadingEmoji.length).trim();
        withoutEmoji =
          withoutEmoji.slice(0, withoutEmoji.length - name.length) + cleanName;
        name = cleanName;
      }

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
 * Normalize one step: complete sentence, never cut mid-sentence.
 */
// Returns null when a step is unsalvageable AND no curated default exists
// for the language, so the caller can drop that slot instead of splicing
// in English (confirmed live: an uncurated language + one empty step from
// the model produced a step that was 100% English — "Prep and portion
// every ingredient on a clean board." — inside an otherwise-Japanese
// recipe). Fewer real steps beats one wrong-language step.
function padStepToGoldilocks(step, idx, language = "English") {
  const defaultSteps = padPhrasesForStrict(DEFAULT_GOLDILOCKS_STEPS_BY_LANG, language);
  let s = ensureSentenceComplete(step);
  if (!s) {
    if (!defaultSteps) return null;
    s = defaultSteps[idx % defaultSteps.length];
  }

  // Real steps are never padded with generic filler any more. Every padding
  // rule tried (by length, by position, exempting preheat steps) still
  // produced non-sequiturs live — most recently "Mince the garlic. Stir
  // occasionally so nothing sticks or burns." before any pan was heated,
  // flagged by an independent recipe review. A short correct step is fine.

  // Never cut mid-sentence (see GOLDILOCKS_STEP_MAX): only trim a runaway
  // step back to its last complete sentence, otherwise keep it whole.
  if (s.length > GOLDILOCKS_STEP_MAX) {
    const window = s.slice(0, GOLDILOCKS_STEP_MAX);
    const lastPeriod = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("! "),
      window.lastIndexOf("? ")
    );
    if (lastPeriod >= GOLDILOCKS_STEP_MIN - 10) {
      s = window.slice(0, lastPeriod + 1).trim();
    }
  }

  s = ensureSentenceComplete(s);
  // Only a fragment with no real instruction in it gets a curated default —
  // "Mince the garlic." (17 chars) is a complete, correct step and used to
  // be swapped for a generic "Prep and portion every ingredient..." line at
  // the old 20-char threshold.
  if (s.length < 6 && defaultSteps) {
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
    out.push(padStepToGoldilocks(raw, i, language));
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
  // Language-independent: no ingredient carries an oven temperature —
  // confirmed live, a Polish batch listed "Rozgrzej piekarnik do 200°C"
  // (preheat the oven to 200°C) as an ingredient, which the English-only
  // checks above can't recognise.
  if (/\d{2,3}\s*°\s*[CF]?\b/.test(trimmed)) return true;
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
    // Sanitized the same way as titleFlavorWords, against the shared
    // FLAVOR_EVIDENCE_VOCABULARY — see hasTitleFlavorMismatch for why this
    // field exists (language-independent evidence for the claims above).
    flavorEvidenceTags: Array.isArray(safe.flavorEvidenceTags)
      ? safe.flavorEvidenceTags
          .filter((tag) => typeof tag === "string")
          .map((tag) => tag.toLowerCase().trim())
          .filter((tag) => FLAVOR_EVIDENCE_VOCABULARY.includes(tag))
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

/**
 * RECIPE QA PASS (generate -> verify -> repair) — a second, much narrower
 * model call that reads the freshly generated batch the way an editor
 * would and fixes the specific mistakes prompt wording alone could not make
 * go away. Real tester feedback and live measurement (see commit history)
 * showed the generator still sometimes (a) finishes raw meat/fish with only
 * "until cooked", (b) writes "boil in salted water" with no amount, and
 * (c) pairs ingredients no home cook would — and the code-level checkers
 * above can only read English, so for the other 30 languages nothing
 * stood between those slips and the user. An editor call works in every
 * language and returns language-independent verdicts.
 *
 * Contract: never throws, never blocks the batch. On any failure (timeout,
 * HTTP error, bad JSON, an edit that fails validation) the recipe goes
 * through exactly as generated. Edits are small and validated: step/ingredient
 * counts stay sane, and the unit system is never mixed. "reject" removes a
 * recipe so the existing top-up machinery regenerates a replacement.
 * EXPO_PUBLIC_RECIPE_QA=0 turns the whole pass off.
 */
const RECIPE_QA_ENABLED = process.env.EXPO_PUBLIC_RECIPE_QA !== "0";
// EDITOR_MODEL (gemini-flash-latest, thinking off) measured far better than
// flash-lite as an editor on the same recipes: ~7% vs ~24% of recipes still
// carrying an issue, at a median ~3.6 s vs ~1.5 s.
const RECIPE_QA_TIMEOUT_MS = 12000;
const RECIPE_QA_MAX_REJECTS = 2;

export const RECIPE_QA_SYSTEM_PROMPT = `
You are a meticulous recipe editor. AI-written recipes reach paying users only after you check them. You receive a JSON array of recipes (id, title, ingredientsList, steps), the recipe LANGUAGE, the UNIT SYSTEM, the user's AVAILABLE INVENTORY and any DIET restrictions. Check every recipe against ALL rules below and fix each violation with the smallest possible edit. Never rewrite a recipe that already complies.

RULES
1. DONENESS: every step that finishes cooking RAW meat, poultry, fish or seafood must give a checkable doneness cue — an internal temperature (poultry and ground meat 74°C / 165°F; other whole meat, fish and seafood 63°C / 145°F — use ONLY the UNIT SYSTEM's unit) and/or a visual cue (no pink remains inside, juices run clear, fish is opaque and flakes easily). "Until cooked", "until browned" or a time on its own is NOT enough: add the cue to that step. Canned, smoked, cured or already-cooked protein (canned tuna, ham, deli slices, cooked sausage) is not raw: it needs no cue, and a step that "cooks it through" should just warm it.
2. SALT IN WATER: a step that salts cooking water (pasta, rice, potatoes, vegetables, eggs) must say how much salt for how much water — about 10 g per litre (US units: 1 tablespoon per 2 quarts). "Salted water" on its own is a violation: add the amount and the water volume.
3. COMPLETE INGREDIENT LIST: every ingredient a step uses — including oil, butter, salt, pepper, spices, herbs, sugar and cooking water or stock — must appear in ingredientsList with an amount, in the same "<amount> <name> <emoji>" format and language as the other entries. Add what is missing. Amounts must add up: the salt entry covers all the salt the steps use (water salt included). An entry that is an instruction (e.g. "preheat the oven to 200°C") is not an ingredient: remove it.
4. ONLY WHAT THE USER HAS: every ingredient must come from the AVAILABLE INVENTORY or the ALWAYS-AVAILABLE BASICS. If a recipe uses something that is not available, remove it from ingredientsList and from every step; if the dish cannot work without it, verdict "reject". Never turn an inventory item into a different one: a generic item such as "diced meat" stays diced meat in the list and the steps (it is not minced meat, and not specifically beef or pork). Never add anything that breaks a DIET restriction.
5. A COMPLETE, WORKING METHOD: the steps must really make the dish in the title. Every ingredient in the list is used in a step, and every ingredient a step uses — garnish and serving included — is in the list. If the oven is preheated, a later step actually puts the dish in the oven with a time. Raw potatoes, rice, pasta and dough are actually cooked before serving. A bake, gratin or casserole has an oven step with a temperature and a time, and a baking dish, pan or tin named in a step states its size (e.g. 20×20 cm / 8×8 inch, in the UNIT SYSTEM). A stuffed dish is actually stuffed. No step is cut off mid-sentence. Fix gaps by completing or extending an existing step (never more than 5 steps in total); if small edits cannot fix it, verdict "reject".
6. CLASSIC DISH: every recipe must be a recognizable, tried-and-tested dish a home cook would make. Odd pairings are a violation — a condiment that does not belong (e.g. Worcestershire sauce in a creamy tuna sauce), cream or sauce poured over a raw-vegetable "salad", black pepper or other savory seasoning in a sweet dish (jam, desserts, sweet pancakes), sweet-and-savory clashes. First try removing the odd ingredient from ingredientsList AND every step that mentions it, if the dish is still a complete classic without it. If it is fundamentally not a real dish, verdict "reject".
7. Change nothing else. Keep the recipe's language, wording, units, capitalization conventions (German nouns capitalized; other ingredient names lowercase) and step style. Steps stay 3-5 complete sentences ending with a period. Never translate, shorten or restyle what is already correct.

OUTPUT: a raw JSON array with one object per input recipe, same order: {"id": <same id>, "verdict": "ok" | "fixed" | "reject", "steps": [...] (only when changed — the complete corrected array), "ingredientsList": [...] (only when changed — the complete corrected array), "reason": "<= 12 words, English"}. For a compliant recipe return just {"id", "verdict": "ok"}.
`.trim();

function isSaneQaEdit(original, edited, unitSystem) {
  if (!Array.isArray(edited) || edited.length === 0) return false;
  if (!edited.every((x) => typeof x === "string" && x.trim().length >= 8 && x.length <= 600)) {
    return false;
  }
  if (
    edited.length < Math.max(STEP_COUNT_MIN, original.length - 1) ||
    edited.length > Math.min(STEP_COUNT_MAX, original.length + 1)
  ) {
    return false;
  }
  const text = edited.join(" ");
  if (unitSystem === "metric" && /°\s*F\b/.test(text)) return false;
  if (unitSystem !== "metric" && /°\s*C\b/.test(text)) return false;
  return true;
}

export async function reviewRecipesWithGemini(rawRecipes, options = {}) {
  const {
    apiKey,
    language = "English",
    unitSystem = "us",
    inventoryText = "",
    dietText = "",
    model = EDITOR_MODEL,
    thinkingBudget = 0,
    maxRejects = RECIPE_QA_MAX_REJECTS,
  } = options;
  if (!RECIPE_QA_ENABLED || !apiKey) return rawRecipes;
  if (!Array.isArray(rawRecipes) || rawRecipes.length === 0) return rawRecipes;

  const payload = rawRecipes.map((r, i) => ({
    id: i + 1,
    title: r?.title,
    ingredientsList: Array.isArray(r?.ingredientsList) ? r.ingredientsList : [],
    steps: Array.isArray(r?.steps) ? r.steps : [],
  }));

  try {
    const sendQa = () =>
      generateContent({
        apiKey,
        model,
        timeoutMs: RECIPE_QA_TIMEOUT_MS,
        body: {
          systemInstruction: { parts: [{ text: RECIPE_QA_SYSTEM_PROMPT }] },
          contents: [
            {
              parts: [
                {
                  text: `LANGUAGE: ${language}\nUNIT SYSTEM: ${unitSystem === "metric" ? "metric (Celsius, grams, ml)" : "US customary (Fahrenheit, cups, tbsp)"}\nAVAILABLE INVENTORY: ${inventoryText || "not provided — skip rule 4"}\nALWAYS-AVAILABLE BASICS: water, cooking oil, butter, salt, black pepper, plain sugar, basic dried spices\nDIET: ${dietText || "none"}\n\nRECIPES:\n${JSON.stringify(payload)}`,
                },
              ],
            },
          ],
          generationConfig: buildGenerationConfig(model, { temperature: 0 }, thinkingBudget),
        },
      });
    let reply = await sendQa();
    // Google answers 503/429 under load now and then (seen live: a 0.2 s 503
    // silently skipped the whole editor pass). One short retry is cheap.
    if (reply.status === 503 || reply.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      reply = await sendQa();
    }
    if (!reply.ok) throw new Error(`HTTP ${reply.status}`);
    const verdicts = parseModelJson(reply.text);
    if (!Array.isArray(verdicts)) throw new Error("not an array");

    let fixed = 0;
    let rejected = 0;
    const result = [];
    rawRecipes.forEach((recipe, i) => {
      const v = verdicts.find((x) => Number(x?.id) === i + 1);
      if (!v || v.verdict === "ok" || !recipe) {
        result.push(recipe);
        return;
      }
      if (v.verdict === "reject") {
        if (rejected < maxRejects) {
          rejected += 1;
          log.debug(`[Cook AI] Recipe QA rejected "${recipe.title}": ${v.reason || "no reason given"}`);
          return;
        }
        result.push(recipe);
        return;
      }
      if (v.verdict === "fixed") {
        const next = { ...recipe };
        let changed = false;
        if (v.steps !== undefined && isSaneQaEdit(payload[i].steps, v.steps, unitSystem)) {
          next.steps = v.steps;
          changed = true;
        }
        if (
          v.ingredientsList !== undefined &&
          Array.isArray(v.ingredientsList) &&
          v.ingredientsList.length >= Math.max(1, payload[i].ingredientsList.length - 2) &&
          v.ingredientsList.length <= payload[i].ingredientsList.length + 6 &&
          v.ingredientsList.every((x) => typeof x === "string" && x.trim().length > 0)
        ) {
          next.ingredientsList = v.ingredientsList;
          changed = true;
        }
        if (changed) fixed += 1;
        result.push(next);
        return;
      }
      result.push(recipe);
    });
    if (fixed || rejected) {
      log.debug(`[Cook AI] Recipe QA: fixed ${fixed}, rejected ${rejected} of ${rawRecipes.length}.`);
    }
    return result;
  } catch (err) {
    log.warn(`[Cook AI] Recipe QA skipped (${err?.message}) — using the batch as generated.`);
    return rawRecipes;
  }
}

/**
 * Same editor pass, but the batch is reviewed as two halves in parallel. The
 * editor's time is almost entirely the model writing out corrected text, so it
 * scales with the number of recipes: measured live, one call over 6 recipes
 * took ~6.6 s, which was nearly half of the whole wait. Each recipe is judged
 * on its own, so splitting changes nothing about the verdicts. At most one
 * rejection per half keeps the overall cap at two.
 */
async function reviewRecipesInParallel(rawRecipes, options) {
  if (!Array.isArray(rawRecipes) || rawRecipes.length < 4) {
    return reviewRecipesWithGemini(rawRecipes, options);
  }
  const mid = Math.ceil(rawRecipes.length / 2);
  const halves = await Promise.all([
    reviewRecipesWithGemini(rawRecipes.slice(0, mid), { ...options, maxRejects: 1 }),
    reviewRecipesWithGemini(rawRecipes.slice(mid), { ...options, maxRejects: 1 }),
  ]);
  return halves.flat();
}

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
    log.warn("[Cook AI] Planner Gemini generation failed:", err?.message);
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
  const apiKey = resolveApiKey(userApiKey);

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
  // "category" uses matchesStapleCategory, which checks every supported
  // language's word for that staple (not just English) — a Pantry item's
  // name could be an English quick-add chip OR text kept from whatever
  // recipe language was active when the user marked it out of stock via
  // RecipeDetailModal's "I don't have this" confirm. "basic spices" has no
  // such table (see assumedStaples.js's own comment on why) and keeps the
  // original plain English-keyword check.
  const BASIC_STAPLES = [
    { label: "salt", category: "salt" },
    { label: "pepper", category: "pepper" },
    { label: "cooking oil", category: "oil" },
    { label: "basic spices", keyword: "spice" },
  ];
  const outOfStockNames = (pantryItems || [])
    .filter((p) => p?.inStock === false)
    .map((p) => (p.name || "").toLowerCase());
  const assumedStaples = BASIC_STAPLES.filter(({ category, keyword }) =>
    category
      ? !outOfStockNames.some((name) => matchesStapleCategory(name, category))
      : !outOfStockNames.some((name) => name.includes(keyword))
  ).map(({ label }) => label);
  const pantryListText = [assumedStaples.join(", "), pantryNames]
    .filter(Boolean)
    .join(", ");

  // Plain-language diet summary for the QA editor (rule 4) — names of the
  // active restrictions plus any user-typed exclusions.
  const qaDietText = [
    ...FULL_DIETARY_OPTIONS.filter((d) => dietaryRestrictions && dietaryRestrictions[d.id]).map(
      (d) => d.name
    ),
    ...(Array.isArray(dietaryRestrictions?.customAvoid) && dietaryRestrictions.customAvoid.length
      ? [`no ${dietaryRestrictions.customAvoid.join(", ")}`]
      : []),
  ].join("; ");

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
  async function fetchRawRecipes(modelName, count, excludeForCall, usedDishTypesForCall = []) {
    // buildGenerationConfig turns the "thinking" pass off for models that
    // support it, and only for them.
    //
    // Confirmed real failure, not a hypothetical: gemini-flash-latest
      // spends an unrequested "thinking" pass on a plain recipe-generation
      // call (usageMetadata.thoughtsTokenCount ~558 on an unmodified call,
      // ~8.2s), the exact same class of bug already fixed for the fridge
      // scanner's gemini-3.7-flash. thinkingBudget: 0 cut it to ~4.3s with
      // no observed quality change. gemini-flash-lite-latest does NOT
      // support this field at all — sending it is a hard HTTP 400,
      // confirmed live — which is why this is gated per-model rather than
    // added to generationConfig unconditionally.
    const result = await generateContent({
      apiKey,
      model: modelName,
      timeoutMs: REQUEST_TIMEOUT_MS,
      body: {
        systemInstruction: {
          parts: [{ text: GEMINI_RECIPE_SYSTEM_PROMPT.trim() }],
        },
        contents: [{ parts: [{ text: buildPromptTextFor(count, excludeForCall, usedDishTypesForCall) }] }],
        generationConfig: buildGenerationConfig(modelName, { temperature: 0.2 }),
      },
    });

    if (!result.ok) {
      throw new GeminiRecipeError(`API Error ${result.status}: ${result.errorText}`);
    }

    let parsed;
    try {
      parsed = parseModelJson(result.text || "[]");
    } catch {
      throw new GeminiRecipeError("Failed to process the AI response.");
    }
    // Editor pass (see reviewRecipesWithGemini) — fixes missing doneness
    // cues, unmeasured salted water and odd pairings in ANY language before
    // the code-level checkers below decide what survives. Never throws.
    return reviewRecipesInParallel(parsed, {
      apiKey,
      language,
      unitSystem,
      inventoryText: `${fridgeList}${pantryListText ? `, ${pantryListText}` : ""}`,
      dietText: qaDietText,
    });
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
      log.warn(
        `[Cook AI] ${label} returned ${beforeDishTypeDedupe - normalized.length} recipe(s) sharing a dishType with an earlier recipe in the same batch.`
      );
    }

    // Same dish twice under two names inside one batch — dedupeDishType
    // exempts "other", so two "other" stuffed-pepper recipes both survived.
    const beforeRenameDedupe = normalized.length;
    normalized = normalized.filter(
      (r, i) => !isRenameOfKeptTitle(r.title, normalized.slice(0, i).map((n) => n.title))
    );
    if (normalized.length < beforeRenameDedupe) {
      log.warn(
        `[Cook AI] ${label} returned ${beforeRenameDedupe - normalized.length} recipe(s) that repeat an earlier recipe in the same batch under a new name.`
      );
    }

    const beforeCutTechniqueFilter = normalized.length;
    normalized = normalized.filter((r) => !hasCutTechniqueMismatch(r));
    if (normalized.length < beforeCutTechniqueFilter) {
      log.warn(
        `[Cook AI] ${label} returned ${beforeCutTechniqueFilter - normalized.length} recipe(s) using a tough braising cut with a too-short cook time.`
      );
    }

    const beforeFlavorMismatchFilter = normalized.length;
    normalized = normalized.filter((r) => !hasTitleFlavorMismatch(r));
    if (normalized.length < beforeFlavorMismatchFilter) {
      log.warn(
        `[Cook AI] ${label} returned ${beforeFlavorMismatchFilter - normalized.length} recipe(s) whose title claimed a flavor/ingredient not actually in ingredientsList.`
      );
    }

    const beforeThinSoupFilter = normalized.length;
    normalized = normalized.filter((r) => !hasThinSoup(r));
    if (normalized.length < beforeThinSoupFilter) {
      log.warn(
        `[Cook AI] ${label} returned ${beforeThinSoupFilter - normalized.length} recipe(s) labeled "soup" with fewer than 5 ingredients.`
      );
    }

    const beforeDoughFeasibilityFilter = normalized.length;
    normalized = normalized.filter((r) => !hasUnrealisticFromScratchDough(r));
    if (normalized.length < beforeDoughFeasibilityFilter) {
      log.warn(
        `[Cook AI] ${label} returned ${beforeDoughFeasibilityFilter - normalized.length} recipe(s) requiring from-scratch dough on an unrealistically short timeline.`
      );
    }

    const beforeOvenTempFilter = normalized.length;
    normalized = normalized.filter((r) => !hasMissingOvenTemp(r));
    if (normalized.length < beforeOvenTempFilter) {
      log.warn(
        `[Cook AI] ${label} returned ${beforeOvenTempFilter - normalized.length} recipe(s) using the oven/broiler/grill with no temperature stated anywhere in the steps.`
      );
    }

    const beforePanSizeFilter = normalized.length;
    normalized = normalized.filter((r) => !hasMissingPanSize(r));
    if (normalized.length < beforePanSizeFilter) {
      log.warn(
        `[Cook AI] ${label} returned ${beforePanSizeFilter - normalized.length} recipe(s) naming a baking dish/pan with no size stated anywhere in the steps.`
      );
    }

    const beforeDonenessCueFilter = normalized.length;
    normalized = normalized.filter((r) => !hasMissingDonenessCue(r));
    if (normalized.length < beforeDonenessCueFilter) {
      log.warn(
        `[Cook AI] ${label} returned ${beforeDonenessCueFilter - normalized.length} recipe(s) with meat/poultry/fish but no checkable doneness cue (temperature or visual/textural signal) anywhere in the steps.`
      );
    }

    if (excludeForCall && excludeForCall.length > 0) {
      const beforeDuplicateFilter = normalized.length;
      normalized = normalized.filter(
        (r) => !isNearDuplicateOfExcluded(r.title, excludeForCall)
      );
      if (normalized.length < beforeDuplicateFilter) {
        log.warn(
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
        log.warn(
          `[Cook AI] ${label} returned ${beforeDietFilter - normalized.length} recipe(s) violating an active diet restriction.`
        );
      }
    }

    return normalized;
  }

  let lastError = null;

  for (const modelName of RECIPE_MODELS) {
    try {
      log.debug(`[Cook AI] Generating recipes with ${modelName}`);
      // Ask for one spare recipe up front. Measured live: the most common
      // reason a batch ran short was a single recipe dropped by the safety
      // filters (usually a repeated dishType), and each top-up round to
      // replace it costs a full generation + QA round trip (~8 s). One extra
      // recipe in the first call costs about a second and usually covers it;
      // enforceExactlyFive trims the batch back to recipeCount.
      const mainRequestCount = recipeCount + 1;
      let rawRecipes;
      try {
        rawRecipes = await fetchRawRecipes(modelName, mainRequestCount, excludeTitles);
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
        log.warn(
          `[Cook AI] ${modelName} failed once (${firstErr?.message}) — retrying the same model once before moving on.`
        );
        rawRecipes = await fetchRawRecipes(modelName, mainRequestCount, excludeTitles);
      }

      if (Array.isArray(rawRecipes) && rawRecipes.length > 0) {
        if (rawRecipes.length !== mainRequestCount) {
          log.warn(
            `[Cook AI] Expected ${mainRequestCount} recipes, got ${rawRecipes.length} from ${modelName} — padding/trimming to ${recipeCount}`
          );
        }
        let normalized = normalizeAndFilter(rawRecipes, mainRequestCount, excludeTitles, modelName).slice(
          0,
          recipeCount
        );

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
            log.debug(
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
            const retryRaw = await fetchRawRecipes(modelName, requestCount, retryExclude, usedDishTypesSoFar);
            const retryTitlesThisAttempt = retryRaw
              .map((r, i) => normalizeRecipe(r, i, mealType, servings, language).title)
              .filter(Boolean);
            cumulativeExclude.push(...retryTitlesThisAttempt);
            // The prompt still gets retryExclude (so the model steers away
            // from everything seen this round), but the hard near-duplicate
            // filter only uses the user's own Regenerate list — see
            // isRenameOfKeptTitle for why the kept titles get a stricter test.
            const retryNormalized = normalizeAndFilter(
              retryRaw,
              requestCount,
              excludeTitles,
              `${modelName} (top-up attempt ${attempt})`
            );
            for (const r of retryNormalized) {
              if (normalized.length >= recipeCount) break;
              if (normalized.some((n) => n.title === r.title)) continue;
              if (isRenameOfKeptTitle(r.title, normalized.map((n) => n.title))) continue;
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
            log.warn(
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
          log.debug(
            `[Cook AI] Generated ${finalBatch.length} recipes using ${modelName}`
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
        log.warn(
          `[Cook AI] ${modelName} timed out after ${REQUEST_TIMEOUT_MS}ms`
        );
        lastError = new GeminiRecipeError("The AI response timed out.");
      } else {
        log.warn(`[Cook AI] Fetch error for ${modelName}:`, err?.message);
        lastError = err;
      }
    }
  }

  log.warn(
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
  const apiKey = resolveApiKey(userApiKey);

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
- "dishType": string, the closest fit from "pasta" | "noodles" | "bread" | "pancake" | "oatmeal" | "salad" | "omelet" | "eggs" | "coffee" | "chocolate" | "pudding" | "cake" | "sweet_bowl" | "soup" | "rice" | "chicken" | "meat" | "sandwich" | "other" — an icon label only, never a constraint on the dish itself
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

  let lastError = null;

  for (const modelName of RECIPE_MODELS) {
    try {
      log.debug(`[Cook AI] Modifying recipe via ${modelName}: "${cleanInstruction}"`);
      const response = await generateContent({
        apiKey,
        model: modelName,
        timeoutMs: REQUEST_TIMEOUT_MS,
        body: {
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: buildGenerationConfig(modelName, { temperature: 0.3 }),
        },
      });

      if (!response.ok) {
        lastError = new GeminiRecipeError(`API Error ${response.status}`);
        continue;
      }

      let result;
      try {
        result = parseModelJson(response.text || "{}");
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
          log.warn(
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
