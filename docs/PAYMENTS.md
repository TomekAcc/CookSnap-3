# Płatności za PRO — jak to działa i co trzeba zrobić

## Stan na dziś
Kod płatności jest gotowy, ale **nic nie jest jeszcze podłączone do sklepów**. Aplikacja ma dwa tryby:

| Tryb | Kiedy | Co robi |
|---|---|---|
| **Testowy** (mock) | Expo Go, wersje testowe (`EXPO_PUBLIC_SHOW_TESTING=1`), development | „Zakup" włącza PRO na telefonie, nic nie kosztuje. |
| **Prawdziwy** (RevenueCat) | Build sklepowy z kluczami `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `…_ANDROID_KEY` i zainstalowanym `react-native-purchases` | Prawdziwy zakup przez App Store / Google Play, ceny ze sklepu. |

**Zabezpieczenie:** build produkcyjny bez kluczy nie nadaje PRO za darmo — pokazuje komunikat „Zakupy nie są dostępne w tej wersji aplikacji".

## Gdzie jest kod
- `src/services/purchases/` — `catalog.js` (identyfikatory), `plans.js` (plany i ceny awaryjne), `mockProvider.js`, `revenueCatProvider.js`, `index.js` (wybór trybu).
- `src/context/PurchasesContext.jsx` — kupno, przywracanie, synchronizacja PRO ze sklepem (przy starcie i po powrocie do aplikacji; wygasła subskrypcja wyłącza PRO).
- `src/components/ProSubscriptionModal.jsx` — ekran PRO: ceny ze sklepu, kółko ładowania, „Przywróć zakupy", linki do regulaminu i polityki (gdy `EXPO_PUBLIC_LEGAL_LIVE=1`).
- `src/screens/SettingsScreen.jsx` — „Zarządzaj subskrypcją" (tylko przy prawdziwym sklepie i aktywnym PRO).
- Testy: `__tests__/purchases.test.js`.

## Co musisz zrobić (kolejność)
1. **Konta:** Apple Developer (99 USD/rok) i Google Play Console (25 USD jednorazowo). Umowy płatne + dane bankowe/podatkowe w obu.
2. **Produkty w sklepach** (subskrypcje, jedna grupa „CookSnap PRO"):
   - `cooksnap_pro_annual` — roczna, 24,99 USD (lub lokalny odpowiednik), 7 dni próbnych.
   - `cooksnap_pro_monthly` — miesięczna, 4,99 USD.
3. **RevenueCat** (revenuecat.com, darmowy do pewnego progu przychodu):
   - projekt + aplikacje iOS i Android, wklej klucze sklepów,
   - *Entitlement* o identyfikatorze **`pro`** (podepnij oba produkty),
   - *Offering* „default" z pakietami **`$rc_annual`** i **`$rc_monthly`**,
   - skopiuj publiczne klucze SDK (iOS `appl_…`, Android `goog_…`).
4. **Kod/build:**
   - `npx expo install react-native-purchases`,
   - ustaw `EXPO_PUBLIC_REVENUECAT_IOS_KEY` i `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` w EAS (zmienne środowiskowe),
   - zrób build sklepowy (`eas build`) — **Expo Go tego nie obsługuje**.
5. **Testy zakupu:** konto testowe (Apple Sandbox / Google licence testers), kup, przywróć, anuluj, sprawdź że PRO się wyłącza po wygaśnięciu.
6. **Prawo (wymagane przez Apple/Google):** uzupełnij dane firmy w `docs/legal/*`, zbuduj strony (`cd proxy && npm run build:legal`), wdróż (`npx wrangler deploy`), ustaw `EXPO_PUBLIC_LEGAL_LIVE=1`. Ekran PRO musi pokazywać cenę, okres, automatyczne odnawianie, „Przywróć zakupy" oraz linki do regulaminu i polityki prywatności — wszystko to już jest w kodzie.

## Ograniczenia, o których warto wiedzieć
- Limity darmowe (skany, generowania) liczone są **na telefonie**, a serwer (proxy) nie wie, kto jest PRO. Wystarcza na start; jeśli pojawią się nadużycia, trzeba dodać weryfikację po stronie serwera (RevenueCat webhook / API).
- Cena i okres próbny pochodzą ze sklepu; ceny w `plans.js` to tylko awaryjne wartości, gdy sklep nie odpowiada.
- Zakup jest przypisany do konta Apple/Google, nie do konta w CookSnap (aplikacja nie ma kont). „Przywróć zakupy" przenosi PRO na nowy telefon.
