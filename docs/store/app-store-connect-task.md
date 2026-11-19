# Zadanie dla asystenta w przeglądarce: wypełnij App Store Connect dla CookSnap

Jesteś asystentem pracującym w przeglądarce Chrome użytkownika (Tomasz Białasiewicz). Użytkownik zalogował się już do
https://appstoreconnect.apple.com (hasło i kod 2FA wpisuje sam; NIGDY ich nie wpisuj i o nie nie proś).
Aplikacja: **CookSnap**, bundle id `com.tomekacc.cooksnap`, wersja 1.0. Rozmawiaj z użytkownikiem po polsku, krótko i prosto.
Użytkownik jest nowy w App Store Connect i woli jeden krok naraz.

## Zasady (ważne)
1. Działaj krok po kroku. **Przed każdym zapisem** pokaż użytkownikowi, co wpisałeś, i poczekaj na jego "OK".
2. **Nie klikaj** niczego związanego z: umowami (Paid Apps Agreement i inne), kontem bankowym, podatkami, płatnościami,
   zmianą danych firmy/nazwiska, statusem trader (DSA) ani **wysłaniem aplikacji do recenzji**. To robi użytkownik.
3. Jeśli pole wygląda inaczej niż opisano albo czegoś nie ma, nie zgaduj. Opisz, co widzisz, i zapytaj.
4. Nie zmieniaj niczego poza wymienionymi punktami. Nie usuwaj niczego.
5. Dane z dokumentów poniżej są prawdziwe: nie wymyślaj własnych wartości.

## Co wypełnić (wersja 1.0, angielski USA)
1. **App Information:** nazwa `CookSnap: AI Fridge Recipes`, podtytuł `Photo to dinner in seconds`, kategoria główna **Food & Drink**.
2. **Promotional Text:** `Take a photo of your fridge or pantry and get recipes made from what you already have. Try the sample scan first, no photo needed.`
3. **Keywords:** `recipes,fridge,pantry,meal planner,ingredients,cooking,dinner,what to cook,leftovers,scan,diet,vegan`
4. **Description:** pełny opis z sekcji "Full description" poniżej (angielski USA).
5. **Support URL:** https://cooksnap-proxy.cooksnap.workers.dev/support
   **Privacy Policy URL:** https://cooksnap-proxy.cooksnap.workers.dev/privacy
6. **App Privacy:** wypełnij według tabeli "Apple: App Privacy" w sekcji z odpowiedziami poniżej. W pytaniu o zdrowie (Health) zaznacz
   "Health", nie powiązane z tożsamością, cel: App Functionality.
7. **Age Rating:** odpowiedz zgodnie z zasadami: brak przemocy, hazardu, treści dla dorosłych; aplikacja z AI generującą przepisy; wiek 16+.
   Jeśli pytanie nie pasuje do żadnego z opisów, zapytaj użytkownika.
8. **In-App Purchases / Subscriptions:** utwórz grupę subskrypcji `CookSnap PRO` z dwoma produktami:
   - `cooksnap_pro_annual`: 1 rok, 29,99 USD, 7 dni darmowego okresu próbnego (introductory offer),
   - `cooksnap_pro_monthly`: 1 miesiąc, 5,99 USD.
   Nazwy wyświetlane: "CookSnap PRO Annual" i "CookSnap PRO Monthly". Opisy: "Full access to scans, recipes and the meal planner."
   Jeśli sklep nie pozwala jeszcze utworzyć produktów (np. brak umowy), nie omijaj tego, tylko poinformuj użytkownika.
9. **Notatki dla recenzenta (App Review Information):** `No account is needed. CookSnap scans photos of a fridge or pantry using Google's Gemini AI through our own server. A one-time consent sheet appears before the first photo is sent. Every recipe shows an "AI-generated" notice. To test the PRO paywall, tap the PRO pill at the top right.`

Po każdym punkcie napisz użytkownikowi jednym zdaniem, co zrobiłeś, i zapytaj, czy iść dalej.

---

## Pełny opis (Full description), angielski USA
What's for dinner? Open CookSnap, photograph your fridge, and get recipes built from what is actually on your shelves.

HOW IT WORKS
• Snap your fridge or pantry. The AI lists the ingredients it can clearly see, and skips anything it can't make out instead of guessing.
• Fix the list in a tap: remove a wrong item or add something the camera missed.
• Pick the meal, how many people, and how hungry you are.
• Get recipes that use your ingredients, with scaled quantities, step-by-step instructions and times.

BUILT AROUND WHAT YOU HAVE
CookSnap doesn't send you shopping first. Recipes are built from the ingredients on your list plus basics like water, oil, salt and pepper. Your pantry staples are remembered, so you only scan the fridge when it changes.

EAT THE WAY YOU LIVE
Switch on vegetarian, vegan, gluten-free, lactose-free, dairy-free, keto, nut-free, pescatarian or diabetic-friendly, and add your own "always avoid" and "prefer more of" notes. Recipes are written to respect them.

TRY IT BEFORE YOU SCAN
No groceries nearby? The sample scan shows the whole flow on a made-up fridge and pantry, with real generated recipes. It doesn't use up your free scans.

SAVE AND COME BACK
Keep favourites, and reopen an earlier scan to cook from it again.

COOKSNAP PRO (optional subscription)
• High daily limits on scans and recipe generations
• 5 recipes per generation instead of 3
• Meal Planner: a multi-day plan of lunches and dinners from your ingredients
• AI Recipe Modifier: "make it vegan", "swap the chicken for tofu", "double the spice"
• Full nutrition breakdown for every recipe

Free to try with a one-time sample: 3 fridge scans, 3 pantry scans and 3 recipe generations. Saved recipes, your pantry list and the shopping list stay free. PRO renews automatically until cancelled in your App Store or Google Play account settings.

PRIVACY
No account and no ads. Your saved recipes and pantry stay on your phone. To read a photo, the app sends it through our server to Google's AI; we don't keep it.

GOOD TO KNOW
Recipes and ingredient detection are generated by AI and can be wrong. If you have an allergy or a medical diet, always check the ingredients yourself. CookSnap does not give medical advice.

CookSnap speaks 31 languages, in light and dark mode.

Questions or ideas? Use Help & Feedback in the app.


---

## Odpowiedzi do formularza prywatności (App Privacy)

## Apple — App Privacy

**Data used to track you:** none. (No tracking, so no App Tracking Transparency prompt is needed.)

| Data type | Collected? | Linked to the user's identity? | Used for | Notes |
|---|---|---|---|---|
| Photos or Videos (User Content) | Yes | No (no accounts) | App Functionality | Photos of a fridge/pantry sent for ingredient detection |
| Other User Content | Yes | No | App Functionality | Ingredient lists, diet switches, free text typed in "Always avoid / Prefer" |
| Customer Support (User Content) | Yes | No | App Functionality | Help & Feedback messages, kept 90 days |
| Email Address (Contact Info) | No (the app asks for none; a person who writes to us by email on their own is handled outside the app) | No | n/a | n/a |
| Device ID (Identifiers) | Yes | No | App Functionality | Random install ID, used only for the per-phone daily limit |
| Purchases | **Yes** (the RevenueCat build is the store build) | No | App Functionality | Purchase history is read from Apple/Google through RevenueCat |
| User ID (Identifiers) | **Yes** (RevenueCat's anonymous app user ID, collected by a third-party SDK) | No | App Functionality | Not an account; not linked to a name or email |
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
| Purchase history (Financial info) | Yes, via RevenueCat | No | App functionality | Only whether a subscription is active; no card data |

Not collected: personal info (the app has no email, name or phone field), card or payment details, health info (see open question), location,
contacts, calendar, app activity, web browsing, files, audio, device-level diagnostics.

## Age and audience

Apple age rating: answer the questionnaire per `DISCLAIMERS.md` section E. Google Play target audience: 16+ (or
18+); do not select groups under 13. The app is not designed for children (terms: 16+).

## Open questions (resolve before submitting)

1. **Health data. Recommendation: declare it** (Apple: Health & Fitness > Health, not linked to identity, App Functionality; Google: Health info), because the conservative answer costs nothing and a missing declaration is the riskier mistake.
   Background: Diet switches such as "diabetic-friendly" or "nut-free" can reveal a health condition
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
5. **Payments:** purchases and RevenueCat's anonymous ID are already in the tables above; keep them in the forms.
6. **Notices in the app.** Done: every recipe shows an "AI-generated" notice, and the diet switches carry a note that
   they are not an allergen guarantee. Mention both in the App Review notes (`DISCLAIMERS.md` section D).
