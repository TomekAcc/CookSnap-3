// Free-tier limits. PRO has none of the daily caps and gets the full batch size.

// Scanning a fridge is inherently infrequent — it rarely changes more than
// once every few days — so a low free cap barely constrains real usage.
// Regenerating recipe suggestions is what people actually repeat within a
// single session, and each one is its own Gemini text-generation call,
// making it the meaningful usage-based (and cost-based) lever. See
// FREE_DAILY_RECIPE_GENERATIONS below.
export const FREE_DAILY_FRIDGE_SCANS = 2;
// Pantry scanning used to be deliberately left free/unlimited (see the old
// comment this replaced) — reversed after confirming pantry scans hit
// gemini-3.7-flash, the same pricier vision model fridge scans use, with no
// cap and no PRO gate at all. An unmetered path to the most expensive call
// in the app was a real, unbounded cost exposure (anyone could script
// repeated "scans" all day for free), not just a monetization gap. Same
// cap as fridge scans — no reason for pantry to be more or less restricted.
export const FREE_DAILY_PANTRY_SCANS = 2;
export const FREE_DAILY_RECIPE_GENERATIONS = 2;

// A single Scanner "generation" returns RECIPES_PER_SCAN (5) recipes at
// once, while a single Meal Planner day-generate returns exactly 1 — so
// the same 2-generations/day allowance is worth 5x more spent on Scanner
// than on Meal Planner. At the full 5, a free user could pull up to 10
// AI recipes a day indefinitely via Scanner alone, which made "unlimited"
// a weak PRO benefit (the free daily volume was already generous). This
// gives PRO a second, immediate, day-one benefit beyond just no daily cap
// — a fuller batch every time, not just more of them over time.
export const FREE_RECIPES_PER_GENERATION = 3;
