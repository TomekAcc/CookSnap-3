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
- **Real payments.** PRO is a local mock (`EntitlementsContext.activatePro`); nobody can pay.
  Needs Apple Developer and Google Play accounts, the two subscriptions (monthly, annual with a
  7-day trial) in both stores, and an integration (RevenueCat is the usual route). The daily free-tier
  limits are counted on the phone and can be bypassed; move them somewhere that can be trusted.
- **Privacy policy, terms and support contact.** Drafts are in `docs/legal/` (policy, terms, and draft
  answers for Apple's "App Privacy" and Google's "Data safety"); they need the company details, a support
  mailbox, a lawyer's read and a public URL. Photos go to Google's AI, which has to be stated plainly.
  Settings > About has the place for the links.
- **Help & Feedback: create the support mailbox.** Done in the app: Send opens the person's mail app with
  a pre-filled message (version and OS appended) to `SUPPORT_EMAIL` in `src/constants/contact.js`, and the
  text is kept with a toast if no mail app exists. Still open: create that mailbox, and consider a server
  endpoint later so reports do not depend on a mail app. Google Play also expects in-app reporting of
  harmful AI content; this is the current route.
- **Consent before the first photo goes to the AI.** Done: a one-time sheet ("Before your first scan")
  appears before the camera or gallery is used for a scan (all three entry points, including Scan More);
  agreeing is stored (`cooksnap:aiConsent:v1`), "Not now" asks again next time. The sample scan sends no
  photo, so it asks nothing. Settings > About has a "Send photos to AI" switch to withdraw it (and to give it again).
- **Production builds and a real-device pass.** `eas.json` has a `production` profile but no build
  has been made. Build iOS and Android, install via TestFlight / internal track, re-run the whole
  manual pass (scan, recipes, payments) on the compiled app.
- **Android parity pass.** Nearly all hands-on testing so far was iPhone in Expo Go.
- **Store listing.** Texts (EN + PL) are drafted in `docs/store/LISTING.md` with a length checker. Still to do:
  screenshots, icon check, age rating and category answers, the support and privacy URLs.
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
- **Usage-informed tuning of the free tier and pricing.** The limits and the $4.99/mo - $24.99/yr
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
