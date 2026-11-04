# CookSnap — procedury wewnętrzne (RODO i bezpieczeństwo)

> **Nie jest poradą prawną.** Prosty zestaw dokumentów, które administrator danych powinien mieć pod ręką. Nie
> publikuj tego pliku; to materiał roboczy dla Ciebie. Wzory wiadomości są po angielsku, bo tak pisze użytkownik;
> w razie pytań po polsku odpowiadaj po polsku.

## 1. Rejestr czynności przetwarzania (RODO art. 30)

Mała firma bywa zwolniona z formalnego rejestru, ale przetwarzamy dane o zdrowiu (diety), więc **prowadź go w tej
prostej formie** i aktualizuj przy każdej zmianie.

Administrator: **[COMPANY NAME AS IN CEIDG]**, kontakt: cooksnap.support@gmail.com. Inspektor ochrony danych: nie
wyznaczono (nie jest wymagany przy tej skali).

| Czynność | Dane | Osoby | Cel i podstawa | Odbiorcy | Kraj | Czas |
|---|---|---|---|---|---|---|
| Rozpoznanie składników ze zdjęcia | Zdjęcie żywności (bez metadanych) | Użytkownicy | Świadczenie usługi, art. 6(1)(b) | Cloudflare (serwer), Google (Gemini) | UE/USA | Nie przechowujemy |
| Generowanie przepisów | Lista składników, posiłek, porcje, język, diety, tekst „unikaj/preferuj" | Użytkownicy | Usługa, art. 6(1)(b); diety zdrowotne: zgoda art. 9(2)(a) | Cloudflare, Google | UE/USA | Nie przechowujemy |
| Limit nadużyć | Losowy identyfikator instalacji, licznik dzienny | Użytkownicy | Prawnie uzasadniony interes, art. 6(1)(f) | Cloudflare | UE/USA | Do końca doby (UTC) |
| Opinie i zgłoszenia | Treść, rodzaj, opcjonalny e-mail, wersja, system, język, tytuł przepisu | Piszący | Obsługa i poprawa usługi, art. 6(1)(f) | Cloudflare, opcjonalnie Telegram | UE/USA | 90 dni |
| Sprawdzenie subskrypcji (po wdrożeniu) | Anonimowy identyfikator, status zakupu | Subskrybenci | Umowa, art. 6(1)(b) | RevenueCat, Apple, Google | USA/UE | Wg RevenueCat |
| Aktualizacje aplikacji | Adres IP, wersja | Użytkownicy | Art. 6(1)(f) | Expo (EAS Update) | USA | Wg Expo |

## 2. Podmioty przetwarzające — lista kontrolna umów

Dla każdego sprawdź, że obowiązuje umowa powierzenia (DPA) i mechanizm transferu danych poza EOG. Zapisz datę i link.

| Podmiot | Rola | DPA / transfer | Sprawdzono (data) |
|---|---|---|---|
| Google (Gemini API, **płatny** poziom) | Procesor | Gemini API Additional Terms / Cloud DPA; SCC lub DPF | [DATE] |
| Cloudflare | Procesor | Cloudflare DPA (zawarta w warunkach); SCC/DPF | [DATE] |
| Expo | Procesor (adres IP przy aktualizacji) | Expo DPA | [DATE] |
| Telegram (jeśli włączony) | Odbiorca powiadomień | Warunki Telegram; transfer do Dubaju/UK `[VERIFY]` — rozważ wyłączenie | [DATE] |
| RevenueCat (po wdrożeniu) | Procesor | RevenueCat DPA | [DATE] |
| Apple / Google Play | Samodzielni administratorzy (platformy) | Ich warunki | — |

## 3. Zasady zmian (kiedy aktualizować dokumenty)

Zmień politykę prywatności, regulamin i formularze sklepów **w tym samym wydaniu**, w którym aplikacja zaczyna:
analizować użycie, wysyłać raporty awarii, zakładać konta, wysyłać powiadomienia, używać drugiego dostawcy AI,
zbierać nowe dane (np. e-mail), zmienia ceny/limity, albo gdy zmieniają się warunki Google/Cloudflare/Expo.

Dziennik zmian:

| Data | Co się zmieniło | Dokumenty zaktualizowane |
|---|---|---|
| [DATE] | Pierwsza wersja | wszystkie |

## 4. Prośby osób (dostęp, usunięcie, sprzeciw) — procedura

1. Odpowiedz **w ciągu 1 miesiąca** (można przedłużyć o 2, jeśli skomplikowane, z informacją dlaczego).
2. Ustal, czego dotyczy prośba: **dane na telefonie** (użytkownik ma je sam; wskaż „Usuń wszystkie moje dane"),
   **opinia wysłana do nas**, czy **dane z subskrypcji** (Apple/Google/RevenueCat).
3. Opinie: wejdź w `/admin`, wyszukaj po treści/dacie, usuń. Zapisz w dzienniku, że prośbę obsłużono (bez treści).
4. Nie żądaj dowodu tożsamości, jeśli nie jest konieczny; nie zbieraj więcej danych niż trzeba do znalezienia wpisu.

Wzór odpowiedzi — **usunięcie**:

> Hello, thank you for writing to CookSnap. CookSnap has no accounts, and your saved recipes, pantry, scan history
> and settings are stored only on your phone. You can remove all of it yourself in Settings > About > "Delete all
> my data". The only data on our side is [a Help & Feedback message you sent / nothing that can be linked to you].
> [We have deleted the message you described.] Our install counter is deleted automatically after one day. If
> anything is unclear, reply to this email. — CookSnap Support

Wzór — **dostęp / kopia danych**:

> Hello, we hold no profile about you. The data we process is described in our Privacy Policy ([URL]). The
> only record on our side that could relate to you is any Help & Feedback message you sent; [we found one dated
> ___ and attach its text / we found none]. Everything else is on your phone and you can view or delete it
> in the app. — CookSnap Support

## 5. Incydent bezpieczeństwa (np. wyciek tokenu, nieuprawniony dostęp)

1. **Powstrzymaj:** unieważnij sekrety (`wrangler secret put` z nową wartością: `GEMINI_API_KEY`, `ADMIN_TOKEN`,
   `TELEGRAM_BOT_TOKEN`), usuń klucz w Google AI Studio, w razie potrzeby wyłącz Worker.
2. **Oceń:** jakie dane mogły wyciec (u nas głównie treść opinii i adresy e-mail), ilu osób, od kiedy. Zapisz.
3. **Zgłoś do UODO w ciągu 72 godzin** od stwierdzenia, jeśli istnieje ryzyko naruszenia praw osób: formularz na
   uodo.gov.pl (zakładka „Zgłoszenie naruszenia"). Jeśli ryzyko jest **wysokie**, powiadom też osoby, których to
   dotyczy (w aplikacji/e-mailem do tych, którzy podali adres).
4. **Udokumentuj** każde naruszenie (także niezgłoszone): co, kiedy, skutki, działania. Trzymaj w rejestrze.
5. **Napraw przyczynę** i zapisz zmianę w dzienniku zmian.

## 6. Reklamacje i skargi klientów

- Odpowiedz w **14 dniach** (ustawa o prawach konsumenta); zapisuj sprawy w prostym arkuszu: data, treść, odpowiedź.
- Zwroty płatności załatwiają Apple/Google; skieruj klienta do właściwego sklepu i pomóż, jeśli trzeba.
- Zgłoszenia o **szkodzie zdrowotnej** (reakcja alergiczna, zatrucie) traktuj poważnie: zachowaj wiadomość,
  odpowiedz życzliwie, zalecaj kontakt z lekarzem, nie przyznawaj winy na piśmie i powiadom ubezpieczyciela, jeśli
  masz **OC działalności** (rozważ jego wykupienie przed startem).

## 7. Bezpieczeństwo techniczne — rutyna

- Sekrety tylko jako sekrety Workera, nigdy w repozytorium ani w buildzie (`npm run check:bundle` przed publikacją).
- Co kwartał: `npm audit` (zależności), rotacja `ADMIN_TOKEN`, przegląd `/admin` i usunięcie testowych wpisów,
  sprawdzenie limitów kosztów w Google/Cloudflare.
- Kopie zapasowe niepotrzebne (serwer nie przechowuje danych użytkowników poza 90-dniowymi opiniami).
- Uwaga: zależności `npm audit` w narzędziach budowania (Expo CLI, glob, zod) nie trafiają do aplikacji; naprawia je
  aktualizacja Expo SDK przy najbliższej okazji.

## 8. Ubezpieczenie i formalności firmy (poza RODO)

- OC działalności gospodarczej (ochrona przy roszczeniach klientów) — zapytaj brokera.
- Księgowa: rozliczanie przychodów ze sklepów, VAT, ewentualnie ulgi.
- CEIDG: sprawdź, czy PKD pasuje do działalności (np. 62.01.Z — działalność związana z oprogramowaniem).
