# Cook AI — Product Requirements Document

**Status:** Living document, reflects shipped app state
**Owner:** Tomasz Białasiewicz
**Platform:** iOS & Android (Expo / React Native)

---

## 1. Summary

Cook AI (marketed as "CookSnap") turns a photo of your fridge or pantry into a
ready-to-cook meal plan. A user photographs their shelves, an AI vision model
identifies the actionable ingredients, and an AI recipe engine turns that
inventory into real, appetizing, cookable recipes — scaled to servings, tuned
to hunger level, and filtered against dietary restrictions. The product's
core promise is speed and honesty: no typing in a grocery list, no recipes
that secretly need five ingredients you don't have.

## 2. Problem

- People default to takeout or the same 5 meals on rotation because deciding
  "what can I make with what I already have" has too much friction.
- Existing recipe apps assume a fully-stocked pantry and a shopping trip;
  they don't start from *what's actually in your fridge right now*.
- Food waste is a persistent, low-grade daily annoyance — produce and
  leftovers get forgotten and go bad because there was no fast path from
  "I have this" to "here's a good reason to cook it tonight."

## 3. Target User

Home cooks who want dinner solved in under a minute, not a cooking hobby.
Primary persona: a busy adult (student, young professional, or parent) who
already owns groceries and wants a decision made for them — not inspiration
browsing, not a recipe box to build over years.

## 4. Goals

| Goal | How it's measured |
|---|---|
| Get a user from "empty-handed" to "here's dinner" in one flow | Time from opening the Scanner tab to a generated recipe list |
| Make the free tier genuinely useful so word-of-mouth works | Daily scans used by free users; scan-to-generate completion rate |
| Convert habitual users into PRO subscribers | Free → PRO conversion rate; annual-plan attach rate |
| Keep AI output trustworthy | Rate of "bizarre"/rejected recipe reports; ingredient-hallucination rate |

## 5. Core User Flow

1. **Scan** — Open the Scanner tab, photograph the fridge (and optionally the
   pantry/cabinet separately). Gemini Vision identifies clearly-visible,
   actionable ingredients only — it is explicitly instructed to skip
   anything hidden, unlabeled, or ambiguous rather than guess.
2. **Confirm inventory** — Detected ingredients are added to the running
   list; the user can remove false positives or add pantry staples manually.
3. **Set preferences** — Meal type (breakfast/lunch/dinner/snack/dessert),
   servings count, hunger level (light/normal/hungry), and any active
   dietary restrictions.
4. **Generate** — The AI recipe engine returns 5 distinct recipes built
   strictly from the detected inventory plus pantry staples, respecting
   flavor harmony (it won't force ingredients together that don't belong)
   and any dietary guardrails.
5. **Cook** — Open a recipe for scaled ingredient quantities, step-by-step
   instructions, prep/cook time, and (PRO) a full macro breakdown.
6. **Save / revisit** — Favorite recipes for later, or open scan history to
   regenerate from a past fridge inventory.

## 6. Feature Set (Shipped)

### Scanning & Inventory
- Fridge photo scan via Gemini Vision, deterministic 5-zone inspection
  (top shelves, middle shelves, lower drawers, upper door, lower door).
- Pantry/shelf scan with a separate deep-shelf-recall prompt tuned for
  densely stacked dry goods, spices, oils, and canned goods.
- Manual "add ingredient" for anything the camera missed.
- Zero-guessing policy: ambiguous or hidden items are skipped, never invented.

### Recipe Generation
- Always exactly 5 recipes per generation request.
- Strict inventory lock — recipes only use what's actually on hand (plus
  assumed basics: water, oil/butter, salt, pepper).
- Flavor-harmony rule — the AI selects a coherent 3–5 item subset per dish
  rather than forcing every detected item into one recipe.
- Category diversity across the batch (not five variations of the same dish).
- Meal-type, servings, and hunger-level aware; recalculates ingredient
  quantities per request.
- Dietary restriction guardrail (vegetarian, vegan, gluten-free,
  lactose-free, dairy-free, keto, nut-free, pescatarian, diabetic) —
  treated as a hard constraint that overrides the inventory lock.

### Recipe Detail
- Scaled ingredient list with checkable "shopping-style" rows.
- Step-by-step instructions.
- Prep time / cook time / total time / calories / servings.
- Save to Favorites.
- **PRO:** AI Recipe Modifier — free-text edits to an existing recipe
  ("make it vegan," "swap chicken for tofu," "double the spice") that
  regenerate ingredients and steps consistently.
- **PRO:** full macro breakdown (calories are visible to all users; detailed
  macros are gated).

### Pantry
- Persistent pantry staple list, separate from the day's fridge scan.
- Categorized (Spices & Herbs, Oils & Sauces, Grains & Baking, Condiments).
- Feeds into every recipe generation as available "on-hand" inventory.

### Meal Planner (PRO)
- AI-generated multi-day plan of substantial lunches/dinners built from the
  same inventory + dietary rules as the main generator.
- Falls back to a local heuristic if the AI call fails, so the planner never
  returns empty.

### Saved / History
- Favorites list.
- Scan history — revisit and regenerate from a previous fridge inventory.

### Account & Settings
- Light/dark theme.
- Notifications drawer.
- Help & feedback.
- Meal preferences (servings, hunger level, dietary restrictions) persist
  across sessions.

### Monetization — Cook AI PRO
- **Free tier:** 3 fridge scans/day, 5 AI recipes per generation, full
  recipe detail, calories.
- **PRO tier:** unlimited fridge scans, AI Recipe Modifier, full macro
  breakdown, AI-generated Meal Planner.
- **Pricing:** Monthly $4.99/mo · Annual $24.99/yr (≈$2.08/mo, ~58% cheaper
  than monthly), 7-day free trial on the annual plan, which is the default
  pre-selected option in the paywall.
- Cancel anytime, 1 tap, standard App Store subscription management.

## 7. Non-Goals (for now)

- Grocery ordering / delivery integration.
- Social feed, following other users, or public recipe sharing.
- Manual full recipe authoring by users (the product is AI-first, not a
  recipe box).
- Nutrition tracking / diary beyond per-recipe macros.
- Barcode scanning for packaged goods (vision-based shelf scanning only).

## 8. Tech Stack

- **Client:** Expo (React Native, SDK 54), NativeWind (Tailwind for RN),
  React Context for state, `react-native-reanimated` +
  `react-native-gesture-handler` for UI-thread animations/gestures,
  AsyncStorage for local persistence.
- **AI — Vision:** Google Gemini (vision-capable models), structured JSON
  output, per-request timeouts with automatic retry on transient failures.
- **AI — Recipes:** Google Gemini (text), structured JSON output, a fixed
  system prompt encoding the culinary rules above, per-request dietary and
  inventory constraints layered on top.
- **Distribution:** EAS Update for over-the-air JS updates to Expo Go /
  installed builds without an app-store review cycle.

## 9. Risks & Open Questions

- **AI reliability:** vision/recipe quality is only as good as the
  underlying model; model deprecations (seen in practice — older Gemini
  versions returning 404) require an actively maintained candidate-model
  list, not a single hardcoded model.
- **Latency:** vision + recipe generation both call an external API; the
  product needs to keep failure/timeout handling (retry, graceful fallback
  to locally-built recipes) robust so a bad network moment never looks like
  a broken app.
- **Free-tier generosity:** 3 scans/day is a judgment call — needs real
  usage data to confirm it's generous enough to prove value but tight enough
  to drive conversion.
- **Trust in "zero guessing":** the vision prompt deliberately skips
  ambiguous items rather than guessing; this trades off completeness for
  accuracy and should be periodically validated against real fridge photos.

## 10. Success Metrics (suggested)

- Activation: % of new users who complete a scan → generate → open-recipe
  flow in their first session.
- Retention: % of users who return to scan again within 7 days.
- Conversion: free → PRO conversion rate, and annual vs. monthly plan split.
- Quality: recipe regeneration rate (a proxy for "the first batch wasn't
  good enough") and reported bad-detection rate on scans.
