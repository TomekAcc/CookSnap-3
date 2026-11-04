# Store privacy forms — draft answers

Answers for Apple's **App Privacy** ("nutrition label") and Google Play's **Data safety** form, based on
what the app does today. They must match `PRIVACY_POLICY.md`. **Draft, not legal advice.** If you add
analytics, crash reporting, accounts, a payment SDK or push notifications, redo both forms.

## What the app does with data (the facts the answers rest on)

- No accounts, no sign-in, no ads, no third-party advertising or analytics SDKs.
- Photos (resized to about 1280 px) and request text (ingredients, diet switches, free text the user
  types) are sent over HTTPS to **our own server (Cloudflare Worker)**, which forwards them to **Google
  Gemini**. Our server stores nothing from the request; Google processes it as our service provider.
- Messages from Help & Feedback (text, kind, app version, OS, language, recipe title for a recipe report, and an
  optional reply email the person types) go to **our own server**, which keeps them 90 days for the owner to read.
- A **random install ID** (made by the app, not an advertising ID, not linked to a person) is sent to our
  server only, to count daily requests per phone. The counter is deleted the next day.
- Everything else (saved recipes, pantry, scan history, photos kept, settings) is on the phone only.
- The app checks Expo's update server for new app code.

## Apple — App Privacy

**Data used to track you:** none. (No tracking, so no App Tracking Transparency prompt is needed.)

| Data type | Collected? | Linked to the user's identity? | Used for | Notes |
|---|---|---|---|---|
| Photos or Videos (User Content) | Yes | No (no accounts) | App Functionality | Photos of a fridge/pantry sent for ingredient detection |
| Other User Content | Yes | No | App Functionality | Ingredient lists, diet switches, free text typed in "Always avoid / Prefer" |
| Customer Support (User Content) | Yes | No | App Functionality | Help & Feedback messages, kept 90 days |
| Email Address (Contact Info) | Yes, only if the person types one | No | App Functionality | Optional reply address in Help & Feedback; not used for anything else |
| Device ID (Identifiers) | Yes | No | App Functionality | Random install ID, used only for the per-phone daily limit |
| Purchases | **Yes, once the RevenueCat build ships** | | App Functionality | Purchase history is read from Apple/Google through RevenueCat (anonymous ID, not linked to identity) |
| Health & Fitness | **Open question** | | | Dietary preferences such as "diabetic" may count; see below |

Everything else: not collected (name, email, phone, contacts, location, browsing history, diagnostics,
usage data, financial info).

## Google Play — Data safety

- **Does the app collect or share required user data types?** Yes.
- **Is all of the collected data encrypted in transit?** Yes (HTTPS).
- **Do you provide a way for users to request that their data is deleted?** There is no account and no
  server-side profile. Users can delete everything the app stores on the phone in the app (Settings > About >
  "Delete all my data") or by uninstalling; a Help & Feedback message can be deleted on request. State that in the
  form and give cooksnap.support@gmail.com for any other request.

| Data type | Collected | Shared with third parties | Purpose | Optional? |
|---|---|---|---|---|
| Photos (Photos and videos) | Yes | No (Google acts as our service provider) | App functionality | No, needed to scan |
| Other in-app content | Yes | No (same) | App functionality | Diet text is optional |
| Device or other IDs | Yes | No | App functionality | Required |
| Other in-app messages (Messages) | Yes | No | App functionality, customer support | Optional |
| Email address (Personal info) | Yes, only if typed | No | App functionality (reply) | Optional |

Not collected: personal info, financial info, health info (see open question), location, messages,
contacts, calendar, app activity, web browsing, files, audio, device-level diagnostics.

## Age and audience

Apple age rating: answer the questionnaire per `DISCLAIMERS.md` section E. Google Play target audience: 16+ (or
18+); do not select groups under 13. The app is not designed for children (terms: 16+).

## Open questions (resolve before submitting)

1. **Health data.** Diet switches such as "diabetic-friendly" or "nut-free" can reveal a health condition
   or allergy. They are sent with the recipe request, without identity. Decide (with a lawyer if you want
   certainty) whether to also declare "Health" in Apple's form and Google's Data safety. Declaring it is
   the conservative choice.
2. **Whether the photo counts as "collected".** Apple's definition covers data a third party can keep
   longer than the real-time request needs; Google may keep it briefly for abuse monitoring. The draft
   declares it as collected, which is the safe reading.
3. **AI consent (Apple).** Done in the app: a one-time consent sheet appears before the first photo is
   sent (camera, gallery, Scan More). It can be withdrawn in Settings > About.
4. **AI content reporting (Google Play).** Done in the app: recipes have a "Report a problem with this recipe" link
   that opens Help & Feedback with the kind and the recipe title filled in; the owner reads these on the private
   feedback page (`/admin` of the proxy).
5. **Payments:** add purchases (and the provider) to both forms once subscriptions are added.
6. **Notices in the app.** Done: every recipe shows an "AI-generated" notice, and the diet switches carry a note that
   they are not an allergen guarantee. Mention both in the App Review notes (`DISCLAIMERS.md` section D).
