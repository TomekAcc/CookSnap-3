# CookSnap — Roadmap

**Status:** Living document, reviewed alongside `docs/PRD.md`
**Horizon buckets, not dates:** Now (in progress / next up), Next (planned,
not started), Later (worth doing, not yet prioritized)

Last full revision: November 2026. Shipped since the previous revision: first-run onboarding with a
sample fridge and pantry, 31 languages, dynamic recipe step counts, the Gemini proxy (no key in the
app), SDK 58, the web smoke test in the normal workflow.

---

## Now — before the first store release

- **App name and identifiers: decided.** Display name "CookSnap", iOS bundle id and Android package
  `com.tomekacc.cooksnap` (they cannot be changed after the first store upload), iPad support off for
  the first release (it would need iPad screenshots and an iPad layout pass). The EAS project slug
  stays `cook-ai`: it is registered at Expo, and a different slug means a new Expo project (new project
  id, variables re-entered, new update links). Stored data uses the `cooksnap:` key prefix (renamed from
  `cookai:` while only the owner's phone held data; after a release such a rename needs a migration).
- **Real payments: code done, store side open.** The paywall, purchase/restore flow and a RevenueCat
  integration are written and tested (`docs/PAYMENTS.md`); without keys the app uses a test provider and
  production builds refuse to grant PRO. Still needs Apple Developer and Google Play accounts, the two
  subscriptions (`cooksnap_pro_annual` with a 7-day trial, `cooksnap_pro_monthly`), a RevenueCat project
  (entitlement `pro`), `react-native-purchases` installed and a store build with the keys. The daily
  free-tier limits are counted on the phone and can be bypassed; move them somewhere that can be trusted.
- **Compliance review (done, needs you and a lawyer).** Terms rewritten (AI/allergy/food-safety/health limits,
  subscriptions, withdrawal right, Apple's minimum EULA terms), privacy policy extended (deletion, Art. 9 consent,
  age 16+, AI transparency, incidents), new `STORE_COMPLIANCE.md`, `DISCLAIMERS.md`, `INTERNAL_PROCEDURES.md`. In the
  app: "AI-generated" notice on every recipe, a note under the diet switches, "Delete all my data", scan photos
  deleted when no longer used, no full-library photo permission, no microphone permission, privacy manifest and
  export-compliance flag. Still open: Polish versions of both documents, one lawyer consultation, company details,
  and a native build (the `app.json` changes need a new build, not an update).
- **Privacy policy, terms and support contact.** Drafts are in `docs/legal/` (policy, terms, and draft
  answers for Apple's "App Privacy" and Google's "Data safety"); they need the company details, a support
  mailbox, a lawyer's read and a public URL. Photos go to Google's AI, which has to be stated plainly.
  Settings > About has the rows for the links (hidden until `EXPO_PUBLIC_LEGAL_LIVE=1`). Hosting is solved: the
  pages are served by the proxy Worker at `/privacy`, `/terms`, `/support`, built from `docs/legal` by
  `npm run build:legal` (see `docs/legal/README.md`); what is missing is the company data and a lawyer's read.
- **Help & Feedback inbox: done and live.** The app saves each message on the phone, sends it to the proxy (kept 90
  days, no duplicates, retried until confirmed), and the owner reads it at `/admin` of the proxy with an instant
  copy to Telegram (the Telegram bot is optional: delete the two Telegram secrets to switch it off). Recipes have a
  "Report a problem with this recipe" link. If Telegram stays on in the store release, the privacy policy must name
  it (it does, in the draft). Store forms list the optional reply email.
- **Consent before the first photo goes to the AI.** Done: a one-time sheet ("Before your first scan")
  appears before the camera or gallery is used for a scan (all three entry points, including Scan More);
  agreeing is stored (`cooksnap:aiConsent:v1`), "Not now" asks again next time. The sample scan sends no
  photo, so it asks nothing. Settings > About has a "Send photos to AI" switch to withdraw it (and to give it again).
- **Production builds and a real-device pass.** `eas.json` has a `production` profile but no build
  has been made. Build iOS and Android, install via TestFlight / internal track, re-run the whole
  manual pass (scan, recipes, payments) on the compiled app.
- **Android parity pass.** Nearly all hands-on testing so far was iPhone in Expo Go.
- **Store listing.** Texts (EN + PL) are drafted in `docs/store/LISTING.md` with a length checker. Screenshots with captions (EN + PL, App Store and Google sizes) are in
  `docs/store/screenshots/final/`. Still to do: icon check, age rating and category answers, the support and privacy URLs.
- **Finish the key clean-up.** Google Cloud Billing budget alert; confirm the old Worker is gone.

## Next

- **Crash reporting and basic analytics** (e.g. Sentry). None known to be in the app; without it
  failures on users' phones are invisible.
- **Gemini model resilience.** The proxy allows exactly the three models the app uses
  (`proxy/src/policy.js`); a deprecation means changing both. Needs a periodic check rather than
  discovery by breakage.
- **Slow or stuck scans.** A first scan has been seen hanging with the bar at the end. Settings >
  Testing > "Last model requests" records what each request did; use it to decide whether the
  per-request limit (10 s) is too tight or a request really hangs.
- **Recipe and scan quality feedback.** No way to flag "this recipe was bad" or "the scan missed
  obvious items" beyond Help & Feedback.
- **Usage-informed tuning of the free tier and pricing.** The limits and the $5.99/mo - $29.99/yr
  prices are judgment calls until there is conversion data.

## Later

- **Barcode scanning for packaged goods** (today: vision-based shelf scanning only).
- **Nutrition tracking beyond per-recipe macros** (a diary is a non-goal today).
- **Social / sharing.** Worth reconsidering once there is a retained user base.
- **Grocery delivery integration.** The Shopping List stops at "here's what to buy".
- **Stronger abuse protection for the proxy** (sign-in, App Attest / Play Integrity) if usage or
  revenue justifies it; today a device id plus global limits and a Google spend cap are the guards.

## Explicitly Not Planned

Carried over from the PRD's non-goals: manual full recipe authoring by users, and anything that
turns the product from AI-first into a user-generated recipe box.

## Tried and not shipped

- **Writing the first recipe batch as two parallel requests** (to cut the generation wait). Measured on the real
  proxy, same inventory, 4 runs each: one request 9.3 s on average (7.7 to 12.7 s), two parallel requests 8.5 s
  (7.1 to 9.7 s). About 1 s gained, mostly fewer slow outliers, but it sends the 51 KB instruction twice (about a
  third more tokens per generation) and risks two halves picking the same dishes. Not worth it; reverted.
  Remaining ideas, if real phone timings say the wait matters: show recipes before the quality pass finishes (saves
  3 to 5 s, but a recipe may change or disappear after being shown) or shorten the 51 KB instruction.

## Done: recipes that differ from the ones just shown

- The app remembers the titles it showed in the last 24 hours (up to 15, on the phone only, key
  `cooksnap:recentRecipeTitles:v1`) and asks the next batch to differ from them: right after a scan or a
  regenerate the dishes change, a scan days later starts fresh. The onboarding sample batch is left out.
- The "too similar to an earlier title" filter used to drop a recipe that shared just two words with any earlier
  title, which with a narrow fridge removed 3 to 5 of 5 candidates and a regenerate often shipped 1 or 2 recipes.
  It now drops near-copies only (three shared words making up most of the longer title, or one title being the other
  plus a word). Measured live on two fridges, four rounds each: 4.4 recipes per round on average, and 5 of 5 on the
  first regenerate every time (before: 3.4, and 1 to 2 on the first regenerate).
- Still true: after three or four generations in a row on a very narrow fridge, the number of genuinely different
  dishes runs out and a batch can come back with fewer than five.

## Decision: the app keeps the name CookSnap

Decided by the owner. Known risk, accepted: App Store has "CookSnap: Recipe Saver" (ELKAWEB LLC), same category, similar
features. What this means in practice:
- The store name is the longer "CookSnap: Fridge Recipes" (Polish "CookSnap: Przepisy z lodówki"), see `docs/store/LISTING.md`.
- Reserve the name in App Store Connect as early as possible: Apple refuses a name that is already taken, and that is
  the first real answer. If it is refused, the fallback is a different store name with the same in-app wordmark, or a rename
  (in-app texts, translations, store texts, legal pages, support address).
- Search the trademark registers (UPRP in Poland, EUIPO, USPTO) for "CookSnap" in classes 9 and 42 before spending money
  on a release. Not legal advice; ask a trademark attorney if anything similar is registered.
