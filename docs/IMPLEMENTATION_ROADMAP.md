# Cook AI — Implementation Roadmap

**Purpose:** `docs/ROADMAP.md` says *what* and *why*. This document says
*how* — concrete, ordered, file-level steps for turning each tracked issue
into shipped, working code. Every item below ends in something you can
actually run and verify, not a restated goal.

Cross-referenced to the tracked issues in `TomekAcc/CookSnap`: #1–#3 (Now),
#4–#8 (Next).

---

## 1. Dynamic recipe step counts (#1)

**Current state:** `src/services/geminiRecipes.js` hardcodes every recipe to
exactly 5 steps — `GOLDILOCKS_STEP_COUNT = 5` (line 69), enforced by
`enforceGoldilocksSteps()` (line 447), called from `normalizeRecipe()`
(line 571) and reused by every recipe path (`generateRecipesWithGemini`,
`buildSmartFallbackRecipes`, `modifyRecipeWithGemini`).

**Steps:**
1. **Prompt changes** in `GEMINI_RECIPE_SYSTEM_PROMPT` (line 75) and
   `buildPrompt()` (line 198):
   - Replace the "5-STEP LEGO STANDARD" section with a dynamic rule: quick/
     cold dishes → 3 steps, standard/pan dishes → 4 steps, full/complex
     dishes → 5 steps.
   - Add a "no bizarre combinations" rule to the existing "STRICT CULINARY
     HARMONY" section: when very few ingredients are available, elevate
     them into a known comforting dish rather than forcing an odd pairing.
   - Add "assume basic staples are available" (water, oil/butter, salt,
     pepper) — already implied by the inventory-lock exception, make it
     explicit.
2. **Code-side enforcement** — replace the rigid always-5 logic:
   - Add `STEP_COUNT_MIN = 3`, `STEP_COUNT_MAX = 5` constants (distinct
     from the existing `GOLDILOCKS_STEP_MIN`/`MAX`, which are per-step
     *character length* bounds, not counts — keep both, don't collide the
     names).
   - Rewrite `enforceGoldilocksSteps(steps)` to: take whatever length the
     model returned, clamp to `[3, 5]` (pad up to 3 if fewer, trim down to
     5 if more), and keep running each surviving step through the existing
     `padStepToGoldilocks()` per-item cleanup (sentence completion, length
     bounds) unchanged.
3. **Thread it through every caller** of `normalizeRecipe()`:
   `generateRecipesWithGemini`, `buildSmartFallbackRecipes`'s local
   templates (currently 5 hardcoded steps each — trim the simplest
   templates like "Fresh Fridge Salad" to 3), and `modifyRecipeWithGemini`.
4. **Verify:** run a real generation (via the app or a direct curl against
   the Gemini endpoint with the updated prompt) for a sparse-inventory case
   (e.g. only yogurt + jam) and confirm it returns a 3-step comforting dish,
   not a forced 5-step one.

---

## 2. Production build for app store submission (#2)

**Steps:**
1. Confirm `app.json` has correct `ios.bundleIdentifier` and
   `android.package` values (placeholder values must be replaced before any
   store submission).
2. Run `eas build:configure` if `eas.json` doesn't already define
   `production` build profiles for both platforms.
3. `eas build --platform ios --profile production` and
   `eas build --platform android --profile production` — first real
   standalone builds, not Expo Go.
4. Install the resulting build on a physical device (via TestFlight for
   iOS, direct APK/internal track for Android) and re-run the full manual
   test pass (scan, generate, drag-to-dismiss, PRO paywall) on the actual
   standalone build — EAS Update-in-Expo-Go behavior is not guaranteed
   identical to a compiled build.
5. Only after that passes: create the App Store Connect / Play Console
   listing (screenshots, description, privacy details) and submit for
   review.

---

## 3. Automated web smoke testing in the normal workflow (#3)

**Current state:** `scripts/web-smoke-test.js` exists and works (verified:
catches crash-level bugs, checks 4-tab navigation).

**Steps:**
1. Add an npm script: `"smoke:web": "expo start --web & sleep 8 && node scripts/web-smoke-test.js"`
   in `package.json` (or a two-terminal manual step, documented in the
   script's header comment — already there).
2. Extend `TABS` coverage in the script to also open at least one modal
   (e.g. simulate opening the Pro paywall) so shared-component regressions
   in `StandardModal.jsx`/`bottomSheet.js` get caught, not just tab
   navigation.
3. Adopt as a personal pre-publish habit first (run it before any `eas
   update` that touches `src/components/StandardModal.jsx`,
   `src/utils/bottomSheet.js`, `Header.jsx`, `BottomNav.jsx`, or any
   context provider) — a git hook is a reasonable follow-up once that habit
   is established, not a prerequisite for value.

---

## 4. First-run onboarding flow (#4)

**Steps:**
1. Add a `hasOnboarded` boolean to `AsyncStorage`, mirroring the existing
   `PRO_STORAGE_KEY`/`isPro` persistence pattern already in
   `CookAIContext.jsx`.
2. Build a 3-screen `OnboardingModal.jsx` on top of the existing
   `StandardModal` (`type="center"`), reusing established chrome — no new
   modal system needed:
   - Screen 1: "Scan your fridge, get real recipes" (the core loop).
   - Screen 2: "3 free scans a day" (sets free-tier expectations honestly).
   - Screen 3: "Cook AI PRO" teaser (unlimited scans, modifier, macros,
     planner) with a "Maybe later" dismiss.
3. Gate it in `App.jsx`: show once when `hasOnboarded !== true`, set it
   true on dismiss/completion of the last screen.
4. Verify via the web smoke test (item #3) that first-load with a cleared
   AsyncStorage shows onboarding, and second load doesn't.

---

## 5. Resilient Gemini candidate-model list (#5)

**Steps:**
1. Write a small standalone script (`scripts/check-gemini-models.js`) that
   takes the current candidate model lists from `geminiVision.js` and
   `geminiRecipes.js` and does one `generateContent` call per model with a
   trivial prompt, printing pass/fail per model — this turns "manually curl
   each model when something breaks" (done ad hoc multiple times already)
   into a one-command check.
2. Run it now to confirm the current lists (`gemini-3.7-flash`,
   `gemini-flash-lite-latest`, etc.) are all still live.
3. Document in the script's header: re-run this whenever a scan/recipe
   generation starts failing silently — it's the fastest way to rule model
   deprecation in or out before touching any other code.

---

## 6. Validate free-tier limit & pricing with real data (#6)

**Steps (requires an actual analytics pipeline, currently absent):**
1. Add minimal event logging at the two decision points that already exist
   in code: `canScanFridge` / `dailyFridgeScanCount` hitting the cap in
   `CookAIContext.jsx`, and `handleSubscribe()` in
   `ProSubscriptionModal.jsx` (which plan was chosen).
2. Pick a lightweight analytics target (even a simple logging endpoint is
   enough to start) — this is a decision point, not a default to assume.
3. After 2–4 weeks of real usage: pull "% of free users who hit the daily
   cap" and "annual vs monthly plan split" and revisit the $4.99/$24.99
   pricing and the 3-scan limit against that data, not intuition.

---

## 7. Per-recipe / per-scan feedback mechanism (#7)

**Steps:**
1. Add a thumbs-up/down row to `RecipeDetailModal.jsx`'s sticky footer,
   next to the existing Favorite button.
2. Add a lightweight "Report a scan issue" affordance to
   `FridgeScannerHero.jsx`'s detected-ingredients view (tap an ingredient
   chip to flag "wasn't actually there").
3. Both write to a simple local log first (AsyncStorage, same pattern as
   scan history) — wiring to a real backend can follow once there's a
   destination for the data; the UI affordance is the part that unblocks
   collecting signal at all.

---

## 8. Android parity testing pass (#8)

**Steps:**
1. Build an Android dev client or use `eas build --platform android
   --profile preview` to get a real Android build (not just Expo Go on
   iOS).
2. Re-run the same manual test list already established this project cycle
   on a physical Android device: drag-to-dismiss on every modal type,
   `BlurView` rendering in `Header.jsx`/`BottomNav.jsx`, camera capture for
   fridge/pantry scanning, safe-area insets on at least one notched and one
   non-notched device.
3. File a tracked issue per concrete regression found (same pattern as
   #1–#8) rather than one large "Android is broken" catch-all.

---

## Suggested execution order

1. **#1** (dynamic steps) and **#3** (smoke test habit) first — both are
   self-contained, no external dependencies, and #3 directly de-risks
   every other change on this list.
2. **#5** (model check script) next — cheap to build, prevents the exact
   kind of silent breakage that's already happened more than once.
3. **#2** (production build) before #4/#8 — onboarding and Android testing
   are more valuable to verify against a real build than against Expo Go.
4. **#4, #7** as the next real feature work.
5. **#6, #8** last — both need infrastructure (#6: analytics; #8: an
   Android device/build) that the earlier steps set up.
