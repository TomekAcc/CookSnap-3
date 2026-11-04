# CookSnap — zgodność ze sklepami i prawem (checklista)

> **To nie jest porada prawna.** To przegląd tego, czego wymagają sklepy i przepisy od aplikacji z AI,
> jedzeniem i subskrypcją, sprawdzony z tym, co aplikacja faktycznie robi. Punkty oznaczone ⚖️ warto
> pokazać prawnikowi (jednorazowa konsultacja wystarczy). Daty i wymogi sklepów się zmieniają, więc przy
> `[VERIFY]` sprawdź aktualny stan na stronach Apple/Google.

Legenda: ✅ zrobione w aplikacji/kodzie · 🟡 do zrobienia przez Ciebie · ⚖️ do sprawdzenia z prawnikiem.

## 1. Co aplikacja robi z danymi (fakty, na których opiera się reszta)

- Brak kont, reklam, śledzenia i analityki. Dane użytkownika (przepisy, spiżarnia, historia, ustawienia) są **tylko
  na telefonie**.
- Zdjęcie lodówki/spiżarni i lista składników idą przez nasz serwer (Cloudflare) do **Google Gemini**. Nic tego nie
  zostaje u nas.
- Opinie z „Pomoc i opinie" trafiają na nasz serwer na 90 dni (opcjonalnie kopia do Telegrama).
- Losowy identyfikator instalacji służy tylko do dziennego limitu zapytań.
- Subskrypcja (gdy ruszy): Apple/Google + RevenueCat.

## 2. Apple App Store — wytyczne i co z nimi zrobiliśmy

| Wymóg | Co to znaczy | Stan |
|---|---|---|
| **5.1.2(i)** — zgoda przed wysłaniem danych do zewnętrznej AI | Jasne wyjaśnienie, komu i po co idą zdjęcia, i zgoda przed pierwszym użyciem | ✅ okno „Przed pierwszym skanem", wycofanie w Ustawieniach |
| **5.1.1** — polityka prywatności | Link w App Store Connect **i** w aplikacji | 🟡 strony gotowe; potrzebne dane firmy, wdrożenie i `EXPO_PUBLIC_LEGAL_LIVE=1` |
| **5.1.1(v)** — usuwanie konta | Dotyczy aplikacji z kontami. U nas nie ma kont | ✅ i tak jest „Usuń wszystkie moje dane" |
| **5.1.1** — minimalizacja i cel uprawnień | Teksty uprawnień zgodne z prawdą; prosić tylko o to, co potrzebne | ✅ kamera; galeria przez systemowy wybierak bez pytania o całą bibliotekę; usunięty mikrofon |
| **Privacy Manifest** (iOS 17+) | Deklaracja używanych „required reason API" | ✅ `ios.privacyManifests` w `app.json` |
| **Export compliance** | Pytanie o szyfrowanie przy każdym buildzie | ✅ `ITSAppUsesNonExemptEncryption: false` (tylko HTTPS) |
| **App Privacy („etykieta")** | Formularz danych w App Store Connect | 🟡 odpowiedzi w `STORE_PRIVACY_ANSWERS.md` |
| **1.4.1** — zdrowie i fizyczne bezpieczeństwo | Aplikacje z informacjami zdrowotnymi są oceniane ostrzej; nie podawać wprowadzających w błąd danych medycznych; przypominać o konsultacji z lekarzem | ✅ ostrzeżenia o AI/alergiach/diecie w przepisie i przy dietach; w opisie sklepu: `DISCLAIMERS.md`. ⚖️ unikaj w opisie słów „leczy", „diagnozuje", „dla chorych na..." |
| **3.1.2** — subskrypcje | W aplikacji: cena, okres, automatyczne odnawianie, co dostaje użytkownik, **Przywróć zakupy**, linki do regulaminu i polityki | ✅ ekran PRO ma wszystko; linki pojawią się po `EXPO_PUBLIC_LEGAL_LIVE=1` |
| **3.1.1** — płatności | Cyfrowe treści tylko przez zakup w aplikacji | ✅ (RevenueCat → StoreKit) |
| **2.1 / 2.3** — kompletność i prawdziwe metadane | Aplikacja działa bez zapowiedzi „wkrótce"; opis i zrzuty zgodne z prawdą | 🟡 zrzuty z prawdziwej lodówki, opis w `docs/store/LISTING.md` |
| **4.1** — kopie / nazwa | Nazwa nie może mylić z cudzą aplikacją | 🟡 sprawdź „CookSnap" w App Store Connect i w bazie znaków (EUIPO/UPRP); w razie kolizji zmień nazwę wyświetlaną |
| **Notatki dla recenzenta** | Opisz, że nie ma logowania i jak przejść skan | 🟡 szablon w `DISCLAIMERS.md` (sekcja D) |
| **Ocena wiekowa** | Kwestionariusz | 🟡 wskazówki w `DISCLAIMERS.md` (sekcja E) |

## 3. Google Play — polityki i co z nimi zrobiliśmy

| Wymóg | Co to znaczy | Stan |
|---|---|---|
| **User Data / Data safety** | Link do polityki, formularz bezpieczeństwa danych zgodny z faktami | 🟡 odpowiedzi w `STORE_PRIVACY_ANSWERS.md` |
| **Usuwanie danych** | W formularzu trzeba opisać, jak usunąć dane | ✅ „Usuń wszystkie moje dane" + mail |
| **Uprawnienia** | Tylko to, co potrzebne; unikaj uprawnień do całej galerii | ✅ tylko `CAMERA`; zablokowane `RECORD_AUDIO`, `READ/WRITE_EXTERNAL_STORAGE` |
| **AI-Generated Content** | Aplikacja z treściami generowanymi przez AI musi pozwalać zgłaszać problematyczne treści w aplikacji | ✅ „Zgłoś problem z tym przepisem" |
| **Health Content and Services** | Treści zdrowotne nie mogą wprowadzać w błąd; ostrzeżenia gdy dotyczy | ✅ zastrzeżenia w aplikacji. 🟡 w Play Console wypełnij deklarację aplikacji zdrowotnych zgodnie z prawdą (aplikacja **nie** jest medyczna) |
| **Subskrypcje (Payments)** | Czytelne warunki, łatwe anulowanie, opis okresu próbnego | ✅ ekran PRO i regulamin §4 |
| **Grupa docelowa** | Wybierz **16+** (lub 18+). Nie zaznaczaj grup poniżej 13 lat (to wymusza reguły dla dzieci) | 🟡 w Play Console |
| **Ocena treści (IARC)** | Kwestionariusz | 🟡 |
| **Testy zamknięte dla nowych kont osobistych** | Nowe konta osobiste muszą przejść test zamknięty z min. kilkunastoma testerami przez 14 dni przed produkcją `[VERIFY aktualną liczbę testerów w Play Console]` | 🟡 zaplanuj z wyprzedzeniem; konto firmowe bywa wyjątkiem |
| **Weryfikacja dewelopera / adres** | Dane sprzedawcy (nazwa, adres, e-mail) bywają publiczne w sklepie (status „trader" w UE) | ⚖️ zdecyduj, jakiego adresu użyć (np. wirtualne biuro) |

## 4. Przepisy (UE / Polska / świat)

| Obszar | Co wynika dla CookSnap | Stan |
|---|---|---|
| **RODO** (UE) i UODO | Podstawy prawne, obowiązek informacyjny, prawa osób, 72 h na zgłoszenie naruszenia, rejestr czynności | ✅ polityka prywatności; ✅ `INTERNAL_PROCEDURES.md` (rejestr, procedura naruszeń, wzory odpowiedzi) |
| **Dane o zdrowiu (art. 9 RODO)** | Przełączniki diet („cukrzyca", „bez orzechów") mogą ujawniać stan zdrowia. Potrzebna wyraźna zgoda | ✅ komunikat przy dietach i zapis w polityce. ⚖️ rozważ jednorazowe okno zgody przy pierwszym włączeniu (patrz polityka, „Verify" pkt 4) |
| **ePrivacy / cookies** | Zapis na urządzeniu użytkownika (identyfikator instalacji) bez zgody tylko jeśli jest niezbędny | ✅ opisane w polityce §10; brak ciasteczek i śledzenia |
| **Prawa konsumenta** (UE; w Polsce ustawa o prawach konsumenta) | Informacje przed zakupem, prawo odstąpienia od umowy o treści cyfrowe (14 dni, z wyjątkiem po wyraźnej zgodzie na natychmiastowe wykonanie), zgodność treści cyfrowych z umową | ✅ regulamin §4.7, §11.2. ⚖️ potwierdź sformułowanie dla subskrypcji sprzedawanych przez Apple/Google |
| **Świadczenie usług drogą elektroniczną** (PL) | Regulamin udostępniany bezpłatnie, w formie umożliwiającej zapis | ✅ strony `/terms` i `/privacy` (można zapisać/wydrukować) |
| **Język dokumentów dla konsumentów** (PL) | Polscy konsumenci co do zasady mają prawo do dokumentów po polsku | 🟡⚖️ **zrób polskie wersje** regulaminu i polityki przed startem w Polsce |
| **AI Act** (UE, art. 50 — przejrzystość) | Użytkownik ma wiedzieć, że ma do czynienia z treścią generowaną przez AI. CookSnap to system o ograniczonym ryzyku; nie jest „wysokiego ryzyka" | ✅ oznaczenie „Wygenerowane przez AI" przy przepisie, zgoda na AI, polityka §4. `[VERIFY terminy stosowania art. 50]` |
| **Dostępność (European Accessibility Act)** | Dotyczy usług konsumenckich od 28.06.2025, ale **mikroprzedsiębiorstwa usługowe są zwolnione** | ⚖️ jednoosobowa działalność prawdopodobnie zwolniona; i tak zadbaliśmy o kontrast, rozmiar dotyku i etykiety |
| **Wyroby medyczne** (UE MDR) i FDA (USA) | Oprogramowanie jest wyrobem medycznym, jeśli deklaruje cel medyczny (diagnoza, leczenie, zarządzanie chorobą) | ✅ regulamin §3.3 i brak takich deklaracji. **Nie dodawaj** haseł typu „dla diabetyków pod kontrolą cukru", „leczy", „obniża ciśnienie" |
| **Oświadczenia żywieniowe/zdrowotne** (rozp. 1924/2006) | Dotyczą znakowania i reklamy żywności; unikaj „zdrowe", „odchudza", „detoks" w marketingu | 🟡 pilnuj opisów w sklepie i na stronie |
| **Prawo reklamy/konsumenckie USA** | FTC (prawdziwe reklamy), ROSCA i stanowe przepisy o automatycznym odnawianiu (np. Kalifornia): jasne warunki, łatwe anulowanie | ✅ ekran PRO i regulamin §4. Anulowanie jest w sklepie |
| **COPPA** (USA, dzieci <13) | Aplikacja nie jest skierowana do dzieci, nie zbieramy danych od znanych dzieci | ✅ polityka §8, regulamin §1 (16+) |
| **Podatki (VAT/PIT)** | Sprzedaż subskrypcji przez sklepy ma swoje reguły VAT; jako jednoosobowa firma rozliczasz przychód ze sklepów | 🟡⚖️ **księgowa** — zapytaj o rozliczanie przychodów z Apple/Google |
| **Znak towarowy / nazwa** | Ryzyko sporu o nazwę „CookSnap" (istnieje inna aplikacja o podobnej nazwie) | 🟡⚖️ sprawdź bazy UPRP/EUIPO/USPTO; rozważ rejestrację znaku |

## 5. Kolejność działań przed publikacją

1. Załóż konta (Apple Developer, Google Play) i ustal, jakie dane sprzedawcy będą publiczne.
2. Uzupełnij `[PLACEHOLDERY]` w `TERMS_OF_SERVICE.md` i `PRIVACY_POLICY.md`; sprawdź listy „Verify".
3. **Pokaż prawnikowi** regulamin §3, §4.7, §11, §14, §15, politykę (Art. 9) i polskie wersje. Zakres jednorazowej
   konsultacji: ok. 2–3 godziny.
4. `cd proxy && npm run build:legal` → `npx wrangler deploy` → `EXPO_PUBLIC_LEGAL_LIVE=1` w buildzie.
5. Wypełnij formularze sklepów według `STORE_PRIVACY_ANSWERS.md` i `DISCLAIMERS.md`.
6. Zbuduj aplikację przez `eas build` (zmiany w `app.json` — uprawnienia, manifest prywatności — działają **dopiero
   w nowym buildzie**, nie przez `eas update`).
7. Test na prawdziwym iPhonie i Androidzie, w tym: skan z galerii, zgoda na AI, „Usuń wszystkie moje dane",
   zakup testowy (Sandbox) i przywrócenie.
8. Po starcie: raz na kwartał przejrzyj `INTERNAL_PROCEDURES.md` (rejestr czynności, lista podmiotów, nowe funkcje).
