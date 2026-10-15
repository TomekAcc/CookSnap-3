# Cook AI — Roadmap

**Status:** Living document, reviewed alongside `docs/PRD.md`
**Horizon buckets, not dates:** Now (in progress / next up), Next (planned,
not started), Later (worth doing, not yet prioritized)

---

## Now

- **Dynamic recipe step counts.** Recipes currently always force exactly 5
  steps regardless of dish complexity. In progress: quick/cold dishes (e.g.
  yogurt bowl, sandwich) get 3 steps, standard pan dishes (omelet, tacos)
  get 4, full/complex dishes (pasta, curry, frittata) get 5 — plus explicit
  "no bizarre ingredient combinations" and "assume basic staples are
  available" rules in the recipe prompt. Needs the prompt update and the
  code-side step-count enforcement (currently hardcoded to exactly 5) to be
  finished together.
- **Production build for app store submission.** The app is currently only
  testable via Expo Go + EAS Update — there is no standalone signed build
  yet. Needed before any real store listing, TestFlight, or Play Console
  submission.
- **Automated web smoke testing in the normal workflow.** A Playwright-based
  smoke test (`scripts/web-smoke-test.js`) now exists and already caught a
  real crash-causing bug. Next: make running it a habit before every publish
  for anything touching shared components, not just an ad hoc check.

## Next

- **Onboarding for first-time users.** Right now a new user lands straight
  on the Scanner tab with no explanation of the free-tier limit (3 scans/
  day), how pantry staples factor into recipes, or what PRO unlocks. A short
  first-run flow would reduce "why didn't this work" confusion.
- **Gemini model resilience.** This has already required manual intervention
  more than once as Google deprecated model versions mid-project (a
  hardcoded model returning 404 broke scanning until it was caught and
  fixed). Needs to become a maintained, periodically-verified candidate
  model list rather than something that's only checked when a feature
  breaks.
- **Usage-informed tuning of the free tier and pricing.** The 3 scans/day
  limit and the $4.99/mo–$24.99/yr pricing are both reasoned judgment calls,
  not validated against real conversion data yet. Once there's real usage,
  revisit both against actual free→PRO conversion and scan-limit
  hit-rate.
- **Recipe/scan quality feedback loop.** No current way for a user to flag
  "this recipe was bad" or "this scan missed obvious items" beyond generic
  Help & Feedback. A lightweight per-recipe/per-scan signal would surface
  prompt-quality regressions faster than word-of-mouth bug reports.
- **Android parity pass.** Most hands-on testing this cycle has been
  iOS/Expo Go on iPhone; Android-specific behavior (gesture handling, blur
  rendering, safe-area insets) hasn't had the same level of direct
  verification and should get a dedicated pass before wider release.

## Later

- **Multi-language support.** The product is strictly English-only by
  design today (recipe titles, steps, everything) — worth reconsidering
  once there's a clear signal of demand from a specific market.
- **Barcode scanning for packaged goods.** Currently out of scope (vision-
  based shelf scanning only); would reduce ambiguity for sealed/packaged
  items the camera can't read a label on.
- **Nutrition tracking beyond per-recipe macros.** A running diary/log is
  explicitly a non-goal today; the product's core loop is "what can I cook
  now," not fitness tracking — revisit only if users ask for it directly.
- **Social / sharing.** No feed, no following, no public recipe sharing
  today. Worth reconsidering once there's a retained user base worth
  connecting to each other, not before.
- **Grocery delivery integration.** Out of scope — the Shopping List
  (already shipped, generated from out-of-stock pantry items) stops at "here's
  what to buy," not "buy it for me."

## Explicitly Not Planned

Carried over from the PRD's non-goals — listed here so they don't quietly
creep back onto the roadmap without a deliberate decision: manual full
recipe authoring by users, and anything that turns the product from
AI-first into a user-generated recipe box.
