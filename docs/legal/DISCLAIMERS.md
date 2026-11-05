# CookSnap — standard notices and disclaimers (copy-ready)

Ready-to-paste texts. None of this is legal advice; have a lawyer read the final versions. Texts in the app are
already translated into all 31 languages (see the translation keys named below); the store texts are English
masters you can translate.

## A. Inside the app (already shipped)

| Where | Text (English) | Translation key |
|---|---|---|
| Bottom of every recipe | **AI-generated recipe.** It can be wrong. Check every ingredient for allergens and cook food safely. | `recipeDetail.aiNotice` |
| Under the diet switches (Profile) | Diet switches are a convenience, not a guarantee. If you have an allergy or medical diet, always check the ingredients yourself. | `profile.dietDisclaimer` |
| Before the first scan | To find ingredients, CookSnap sends your photo through our server to Google's AI. We don't keep it. Please photograph food and shelves, not people or documents. | `aiConsent.*` |
| Settings > About | "Send photos to AI" switch (withdraw consent) and "Delete all my data" | `settings.aiConsentLabel`, `settings.deleteData` |
| Paywall | Price, period, "renews automatically, cancel anytime", Restore purchases, links to Terms and Privacy | `pro.*` |
| Recipe, "Report a problem with this recipe" | Opens Help & Feedback with the recipe title filled in (Google Play AI-content reporting) | `recipeDetail.reportRecipe` |

## B. App Store / Google Play description footer

Paste at the end of the long description (keep it near the end, not as the first lines):

> **Important.** CookSnap uses artificial intelligence to read photos and write recipes. AI can make mistakes.
> It is not medical, dietary or allergy advice. If you have an allergy, intolerance or medical condition, always
> check ingredients and labels yourself and ask a qualified professional. Nutrition figures are estimates.
> CookSnap PRO is an optional auto-renewing subscription: payment is charged to your Apple ID / Google Play
> account, the subscription renews unless cancelled at least 24 hours before the end of the period, and you can
> manage or cancel it in your account settings. Terms: [TERMS URL] · Privacy: [PRIVACY POLICY URL]

Apple also requires, in the description or in App Store Connect, the links to the Terms of Use (EULA) and the
privacy policy. Use the same addresses as in the app.

**Words to avoid in any store text or ad** (they can turn the app into a "medical" or "health claim" product):
cures, treats, heals, diagnoses, prevents disease, lowers blood sugar / cholesterol, "safe for diabetics",
"allergy-proof", "guaranteed allergen-free", "detox", "burns fat". Prefer: "suggests recipes", "supports your
dietary preferences", "estimates".

## C. Short disclaimers for other places

- **Website / social media footer:** *CookSnap recipes are AI-generated and can contain errors. Always check
  ingredients for allergens. Not medical advice.*
- **Email signature for support:** *CookSnap is an AI cooking assistant and not a source of medical or allergy
  advice.*
- **Screenshot captions:** no health claims; mention only what the screen shows.

## D. Notes for the App Review team (App Store Connect > App Review Information)

> CookSnap has no accounts or login, so there are no credentials to provide. To test: open the app, tap "Try a
> sample scan" on the first screen (works without a camera or network photo), or tap "I'll scan my own fridge"
> and choose a photo of food from the library. The app sends the photo through our own server to Google's Gemini
> API to list the ingredients, then writes recipes. Before the first photo is sent, the app shows a consent
> screen naming Google's AI; consent can be withdrawn in Settings > About ("Send photos to AI"). "Delete all my
> data" in the same place removes everything stored on the phone. Recipes carry an "AI-generated" notice and a
> "Report a problem with this recipe" link. CookSnap PRO is an auto-renewing subscription (monthly and yearly,
> yearly includes a 7-day trial) shown on the paywall with price, period, Restore purchases and links to the
> Terms and Privacy Policy. The app does not give medical advice and makes no medical claims.

## E. Age-rating answers (guidance)

Answer the questionnaires honestly; these are the answers that match what the app does:

- **Violence, sexual content, profanity, gambling, horror, alcohol/tobacco/drug references:** none.
  (Recipes can mention alcohol as an ingredient if the AI writes one; if the questionnaire asks about
  alcohol references, choose "infrequent/mild".)
- **Medical/health information:** the app has recipes and diet preferences but no medical advice. Where the
  questionnaire asks about "medical or treatment information" or "health or wellness topics", choose the lowest
  level that applies truthfully (diet preferences count as wellness topics).
- **User-generated content / chat with AI:** photos and choices go to AI, and the AI returns recipes. There is no
  open chat, no sharing between users and no public content. If asked about "AI-generated content", say yes and
  point to the reporting link.
- **Target audience (Google Play):** 16+ (or 18+). Do not tick groups under 13.
- Expected result: a low age rating (for example 4+ / 12+ on Apple, Everyone / 10+ on IARC).

## F. Subscription disclosure (for App Store Connect and Play Console)

> CookSnap PRO unlocks much higher daily limits for scans and recipe generations, AI recipe changes, a weekly meal planner and
> nutrition details. Payment will be charged to your Apple ID / Google Play account at confirmation of purchase
> (after the free trial, if offered). The subscription renews automatically unless it is cancelled at least 24
> hours before the end of the current period. Manage or cancel it in your account settings after purchase.
> Terms: [TERMS URL] · Privacy: [PRIVACY POLICY URL]

## G. Responding to a user who reports a harmful or wrong recipe

1. Thank them and ask for the recipe title and, if they want, the date and what went wrong.
2. If someone reports an **allergic reaction or illness**, reply with care, advise them to contact a doctor or
   emergency services if they still have symptoms, and keep the message (it may matter later). Do not discuss
   fault in writing; tell your insurer if you have liability insurance.
3. Fix the cause where possible (a prompt rule in `src/services/geminiRecipes.js`) and note it in the
   change log in `INTERNAL_PROCEDURES.md`.
