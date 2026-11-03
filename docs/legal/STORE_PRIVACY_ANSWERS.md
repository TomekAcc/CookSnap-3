# Store privacy forms — draft answers

Answers for Apple's **App Privacy** ("nutrition label") and Google Play's **Data safety** form, based on
what the app does today. They must match `PRIVACY_POLICY.md`. **Draft, not legal advice.** If you add
analytics, crash reporting, accounts, a payment SDK or push notifications, redo both forms.

## What the app does with data (the facts the answers rest on)

- No accounts, no sign-in, no ads, no third-party advertising or analytics SDKs.
- Photos (resized to about 1280 px) and request text (ingredients, diet switches, free text the user
  types) are sent over HTTPS to **our own server (Cloudflare Worker)**, which forwards them to **Google
  Gemini**. Our server stores nothing from the request; Google processes it as our service provider.
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
| Device ID (Identifiers) | Yes | No | App Functionality | Random install ID, used only for the per-phone daily limit |
| Purchases | **Add when subscriptions exist** | | App Functionality | Handled by Apple; add if you use a provider such as RevenueCat |
| Health & Fitness | **Open question** | | | Dietary preferences such as "diabetic" may count; see below |

Everything else: not collected (name, email, phone, contacts, location, browsing history, diagnostics,
usage data, financial info).

## Google Play — Data safety

- **Does the app collect or share required user data types?** Yes.
- **Is all of the collected data encrypted in transit?** Yes (HTTPS).
- **Do you provide a way for users to request that their data is deleted?** There is no account and no
  server-side profile; users can delete saved data in the app or by uninstalling. State that in the form
  and give [SUPPORT EMAIL] for any other request.

| Data type | Collected | Shared with third parties | Purpose | Optional? |
|---|---|---|---|---|
| Photos (Photos and videos) | Yes | No (Google acts as our service provider) | App functionality | No, needed to scan |
| Other in-app content | Yes | No (same) | App functionality | Diet text is optional |
| Device or other IDs | Yes | No | App functionality | Required |

Not collected: personal info, financial info, health info (see open question), location, messages,
contacts, calendar, app activity, web browsing, files, audio, device-level diagnostics.

## Open questions (resolve before submitting)

1. **Health data.** Diet switches such as "diabetic-friendly" or "nut-free" can reveal a health condition
   or allergy. They are sent with the recipe request, without identity. Decide (with a lawyer if you want
   certainty) whether to also declare "Health" in Apple's form and Google's Data safety. Declaring it is
   the conservative choice.
2. **Whether the photo counts as "collected".** Apple's definition covers data a third party can keep
   longer than the real-time request needs; Google may keep it briefly for abuse monitoring. The draft
   declares it as collected, which is the safe reading.
3. **AI consent (Apple).** Apple's guideline 5.1.2(i) expects an app to clearly disclose, and get
   explicit permission before, sharing personal data with a third-party AI. Today the app shows a
   one-line note under the scan buttons until the first scan and nothing to accept. A one-time consent
   screen before the first photo is sent is the safe fix.
4. **AI content reporting (Google Play).** Google's policy for apps that generate content with AI expects
   users to be able to flag or report offensive or harmful generated content inside the app. The current
   Help & Feedback screen does not send anything anywhere (see below), so it does not meet this.
5. **Payments:** add purchases (and the provider) to both forms once subscriptions are added.

## Known gap found while drafting: Help & Feedback sends nothing

The "Send" button in Help & Feedback only closes the window and shows a thank-you message; the message
text is discarded (`src/components/HelpFeedbackModal.jsx`, `handleSend`). A user who writes to us would
think we got it. It needs a real destination (for example opening a pre-filled email to [SUPPORT EMAIL],
or posting to our server) before release, and it is also what satisfies open question 4.
