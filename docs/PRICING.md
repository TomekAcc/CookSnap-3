# CookSnap — koszt AI, cena PRO i limity

> Liczby poniżej pochodzą z **prawdziwego pomiaru** (`live/usage.live.js`, jeden skan i jedno generowanie przez
> nasz serwer). Ceny Google za milion tokenów są **założeniem**: sprawdź je w cenniku Gemini API dla modeli z
> tabeli i podstaw do wzoru na końcu. Te modele (`gemini-flash-lite-latest`, `gemini-flash-latest`,
> `gemini-3.7-flash`) mają zmienne ceny.

## 1. Ile tokenów kosztuje jedna czynność (pomiar)

| Czynność | Zapytań do AI | Tokeny wejściowe | Tokeny wyjściowe |
|---|---|---|---|
| Skan lodówki / spiżarni | 1 (`gemini-3.7-flash`) | ok. 2 800 | ok. 330 |
| Generowanie 5 przepisów | **9** (4 × `flash-lite` + 5 × `flash`) | **ok. 61 000** | ok. 5 700 |
| Zmiana przepisu przez AI | 1 | ok. 1 200 | ok. 300 |

Co z tego wynika:

- **Generowanie jest 20× droższe od skanu** i to ono rządzi kosztami.
- **Prompt do przepisów ma ok. 13 000 tokenów i jest wysyłany za każdym razem.** W tym pomiarze 3 z 4 dużych zapytań
  to **powtórki** (AI powtórzyło rodzaj dania albo dało słodkie danie na obiad, więc aplikacja prosi o zamiennik,
  znów z całym promptem). Powtórki to ok. 60% kosztu generowania.

## 2. Koszt w dolarach (dwa scenariusze cen Google)

| | Niskie ceny (jak Flash 2.5: lite 0,10/0,40; flash 0,30/2,50 USD za mln tokenów) | Wysokie ceny (2,5× więcej) |
|---|---|---|
| **Jedno generowanie** | **ok. 1,0 centa** | ok. 2,6 centa |
| **Jeden skan** | ok. 0,2 centa | ok. 0,4 centa |

## 3. Co zarabiamy na PRO (po prowizji sklepu 15%, program dla małych firm)

| Plan | Cena | Netto na miesiąc | Na AI można wydać (35% przychodu) | = generowań dziennie (niskie / wysokie ceny) |
|---|---|---|---|---|
| Roczny | 24,99 USD | ok. 1,77 USD | ok. 0,62 USD | **2,0 / 0,8** |
| Miesięczny | 4,99 USD | ok. 4,24 USD | ok. 1,48 USD | **4,7 / 1,9** |

(Nie liczę podatków, opłat RevenueCat — po przekroczeniu progu przychodu — ani kosztów serwera, więc realny zapas jest mniejszy.)

**Wniosek:** użytkownik roczny, który generuje przepisy codziennie 2–3 razy, **kosztuje tyle, ile zarabiamy** (albo
więcej). „Bez limitów" jest więc nieopłacalne przy obecnych kosztach, a darmowi użytkownicy (2 generowania + 4 skany
dziennie ≈ 3–7 centów dziennie przy codziennym użyciu) też nie są darmowi.

## 4. Rekomendacja (kolejność od najtańszej i najskuteczniejszej)

1. **Obniżyć koszt jednego generowania (cel: −50–70%)** zanim ustalimy limity:
   - Powtórki: zamiennik dostaje krótki prompt (tylko brakujące miejsce), nie cały 13-tysięczny. To samo dla
     poprawek jakości.
   - Odchudzić stały prompt i trzymać część niezmienną na początku, żeby Google mógł ją buforować (tańsze tokeny
     „cached"). Zacząć też mierzyć `cachedContentTokenCount`.
2. **Nie obiecywać „bez limitów".** Zmienić sformułowanie w ekranie PRO na liczby („do 10 skanów i 8 generowań
   dziennie") lub na „bardzo duże dzienne limity". Obietnica „unlimited", której nie spełniamy, to ryzyko
   konsumenckie (regulamin §4.8 mówi już o rozsądnym użyciu).
3. **Limity dzienne dla PRO** (proponuję): **10 skanów lodówki, 10 skanów spiżarni, 8 generowań, 20 zmian przepisu
   przez AI**. Najgorszy przypadek jednego użytkownika, który codziennie wyczerpuje wszystko:
   ok. 2,5–6 USD miesięcznie. Zwykle bywa to 5–15% limitu.
4. **Twardy sufit po stronie serwera, w tokenach** (nie w liczbie zapytań). Teraz serwer liczy zapytania (300 na
   telefon dziennie ≈ 40 generowań), co jest za luźne. Serwer powinien sumować tokeny z odpowiedzi Google i po
   przekroczeniu dziennego budżetu odpowiadać 429. Wartość da się zmieniać bez wydawania aplikacji
   (zmienna w `wrangler.toml`).
5. **Cena:** rozważ **roczna 29,99 USD / miesięczna 5,99 USD** (netto roczne ok. 2,12 USD/mies., +20%), zamiast
   24,99/4,99. Plakietka „oszczędzasz 58%" zostaje. Cena jest też najtańszą dźwignią: mniejsza liczba osób, ale
   zdrowsza marża.
6. **Łagodne przycięcie zamiast ściany:** po wyczerpaniu dziennego limitu PRO można dalej dawać przepisy z tańszej
   ścieżki (bez drugiego przejścia jakości) albo poprosić o powrót jutro.
7. **Czego jeszcze nie ma:** serwer nie wie, kto jest PRO (limity darmowe liczą się na telefonie i można je obejść).
   Pełne rozwiązanie to weryfikacja subskrypcji po stronie serwera przez RevenueCat (webhook). Do tego czasu
   chronią nas: limit dzienny na urządzenie, **globalny dzienny limit** (`GLOBAL_DAILY_LIMIT`) i **alert budżetu w
   Google Cloud** (ustaw go przed startem).

## 5. Jak policzyć z aktualnymi cenami

```
koszt = tokeny_wejściowe / 1 000 000 × cena_wejścia + tokeny_wyjściowe / 1 000 000 × cena_wyjścia
```

Zmierz własne liczby: `LIVE_USAGE=1 EXPO_PUBLIC_GEMINI_PROXY_URL=https://<proxy> npx jest --config live/jest.config.js live/usage.live.js`.
W aplikacji (Ustawienia > Testy > „Last model requests") każdy wiersz pokazuje teraz `in … out …` (tokeny).

## 6. Co zostało wdrożone (stan po zmianach)

- **Tańsze generowanie:** stały prompt z regułami szedł do AI dwa razy (w `systemInstruction` i jeszcze raz przed
  treścią zapytania), czyli ok. 3,5 tys. tokenów za darmo w każdym dużym zapytaniu. Usunięty duplikat: ok. **−27%
  tokenów na duże zapytanie**, w pomiarze ok. −37% na całe generowanie (z ok. 26 tys. do ok. 17 tys. tokenów
  wejściowych średnio). Jakość sprawdzona na żywo (po polsku, metryczne, bez glutenu: tytuły, małe litery, sól).
  Nadal otwarte: powtórki (zamienniki) dostają pełny prompt; buforowanie Google nie zadziałało w pomiarze
  (`cached 0`), więc nie liczymy na nie.
- **Limity dzienne PRO w aplikacji** (`src/constants/limits.js`): 10 skanów lodówki, 10 skanów spiżarni, 8
  generowań, 20 zmian przepisu przez AI. Po wyczerpaniu PRO widzi komunikat „wróć jutro", a nie ekran zakupu.
  W aplikacji zniknęły obietnice „bez limitów" (31 języków).
- **Twardy sufit na serwerze** (`proxy/wrangler.toml`): budżet „jednostek kosztu" na telefon (800 000 dziennie) i
  łącznie (12 000 000 dziennie), liczony z tokenów, które Google podaje w każdej odpowiedzi
  (`tokeny wejściowe + 6 × wyjściowe`). Zmiana wartości: edycja pliku i `npx wrangler deploy`, bez nowej wersji
  aplikacji. **Wymaga wdrożenia serwera (`cd proxy && npx wrangler deploy`)**; do tego czasu działa stary limit.
- **Limit zapytań na telefon:** 300 → 150 dziennie.

## 7. Test A/B: czy tańszy prompt pogorszył przepisy? (`live/ab.live.js`)

Te same 6 scenariuszy (angielski, polski bez glutenu, niemiecki wegetariańskie śniadanie, hiszpański, japoński bez
orzechów, francuski wegański), każdy raz ze starym zapytaniem (reguły dwa razy) i raz z nowym (reguły raz), przez
prawdziwe AI. Jedna seria, więc część różnic w liczbie powtórek to los; ważne jest, że nic nie wyszło gorzej.

| | Stare | Nowe |
|---|---|---|
| Przepisy z 6 prób (maks. 30) | 27 | **30** |
| Zapytania do AI | 44 | **28** |
| Tokeny wejściowe | 279 tys. | **139 tys.** |
| Linia soli w przepisie | 27/27 | 30/30 |
| Co najmniej 3 kroki | 27/27 | 30/30 |
| Kategoria zgodna z wyborem | 27/27 | 30/30 |
| Tytuł z wielkiej litery | 22/22 (bez japońskiego) | 25/25 |
| Różnych typów dań na próbę (śr.) | 3,8 | 4,2 |

Uwaga na marginesie (stara, nie nowa): po angielsku AI pisze składniki wielką literą („1 lb Chicken thighs"), choć
prompt prosi o małe. To samo było przed zmianą. Można to poprawić w kodzie (zamiana na małe litery), jeśli chcesz.

## 8. Model finansowy: 1000 aktywnych użytkowników miesięcznie, 5% płacących

Założenia (to są założenia, nie pomiary; zmieniaj je w obliczeniach, jeśli wiesz więcej):

- Koszt (z pomiaru A/B, nowy prompt): **generowanie 0,56–1,4 centa**, skan 0,17–0,42 centa, zmiana przepisu
  ok. 0,02–0,06 centa (niskie–wysokie ceny Google).
- **Darmowy użytkownik:** 5 wizyt w miesiącu, w każdej 1 skan i 1 generowanie (≈ 3,6–9,1 centa miesięcznie).
- **Typowy płacący:** 15 aktywnych dni w miesiącu, dziennie 1 skan, 2 generowania, 1 zmiana (≈ 0,20–0,49 USD).
- **Płacący na limicie codziennie** (najgorszy przypadek jednej osoby): ≈ 2,0–5,0 USD miesięcznie.
- **Przychód netto na płacącego:** po prowizji sklepu 15% i VAT (połowa sprzedaży z UE), mix 70% roczne / 30%
  miesięczne: **2,29 USD** przy 24,99/4,99 i **2,75 USD** przy 29,99/5,99.
- Koszty stałe ok. 15 USD miesięcznie (konto Apple, serwer); RevenueCat jest darmowy do progu przychodu.

**Wynik miesięczny na 1000 aktywnych, typowy płacący (USD):**

| Płacących | Przychód 24,99/4,99 | Wynik: niskie ceny Google | Wynik: wysokie ceny Google | Wynik 29,99/5,99 (niskie / wysokie) |
|---|---|---|---|---|
| 2% | 46 | −9 | −68 | 0 / −59 |
| 3% | 69 | +13 | −49 | +26 / −35 |
| **5%** | **115** | **+55** | **−11** | **+78 / +12** |
| 8% | 183 | +119 | +45 | +156 / +82 |

**Próg rentowności** (typowy płacący): przy obecnych cenach 2,4% (niskie ceny Google) lub 5,6% (wysokie);
przy 29,99/5,99: 2,0% lub 4,5%.

**Wnioski:**

1. Przy 5% płacących jest zysk tylko, jeśli ceny Google są bliżej niskich. Przy wysokich jesteśmy na zero, więc
   **trzeba sprawdzić prawdziwe ceny w cenniku Google**, to największa niewiadoma.
2. **Darmowi użytkownicy to ok. 75–80% rachunku za AI** (950 osób × kilka centów). Dźwignia to limity darmowe i
   koszt jednego generowania, nie limity PRO.
3. Limity PRO nie ratują marży, jeśli wszyscy płacący wyczerpują je codziennie (to −34 do −235 USD), ale tak się
   nie dzieje; od tego jest budżet serwera (800 000 jednostek na telefon dziennie).
4. **Cena 29,99/5,99 poprawia wynik o ok. 23–35 USD na 1000 użytkowników** przy 5% płacących i obniża próg
   rentowności o 0,4–1,1 punktu procentowego.
5. Kolejne oszczędności: powtórki z krótkim promptem (ok. −20% kosztu generowania), tańsza ścieżka po wyczerpaniu
   limitu darmowego, buforowanie promptu u Google.

## 9. Prawdziwy cennik Google (odczytany 2026-11-05) i przeliczony model

Źródło: https://aistudio.google.com/docs/pricing (stary adres ai.google.dev/gemini-api/docs/pricing przekierowuje tam).
**Sprawdź ją własnymi oczami przed decyzjami**: poniższe liczby odczytało narzędzie streszczające stronę.

| Model | Wejście / mln tokenów | Wyjście (z „myśleniem") / mln | Uwagi |
|---|---|---|---|
| Gemini 3.8 Flash (obecny „Flash") | 0,75 USD do końca 2026; **1,50 USD od 1.01.2027** | 3,75 USD; **7,50 USD od 1.01.2027** | `gemini-flash-latest` wskazuje na obecny Flash |
| Gemini 3.5 Flash-Lite (obecny „Flash-Lite", wnioskowane z kolejności na stronie) | 0,30 USD | 2,50 USD | `gemini-flash-lite-latest` |
| Gemini 3.1 Flash-Lite (starszy) | 0,25 USD | 1,50 USD | tańszy o 40% na wyjściu |
| `gemini-3.7-flash` (model skanowania w aplikacji) | **nie ma go na stronie cennika** | | cena nieznana; zakładam jak Flash |

To są ceny **2,5–3 razy wyższe od scenariusza „niskiego"** z sekcji 8. Skutki:

- Jedno generowanie (5 przepisów): **ok. 2,1 centa** (do końca 2026), **ok. 2,6 centa** od 2027; darmowe (3 przepisy) ok. 1,5–1,8 centa.
- Skan ok. 0,33 centa (2026) / 0,67 centa (2027, jeśli skan płaci jak Flash).

**Wynik miesięczny na 1000 aktywnych (USD), typowy płacący, mix 70/30, VAT i prowizja uwzględnione:**

| Scenariusz | Ceny | 3% płacących | **5%** | 8% | Próg |
|---|---|---|---|---|---|
| Ceny Google 2026 | 24,99/4,99 | −55 | **−22** | +29 | 6,3% |
| | 29,99/5,99 | −42 | **+1** | +66 | 4,9% |
| | 39,99/7,99 | −14 | **+47** | +139 | 3,5% |
| Ceny Google od 2027 | 24,99/4,99 | −92 | **−62** | −16 | 9,0% |
| | 29,99/5,99 | −79 | **−39** | +21 | 7,0% |
| | 39,99/7,99 | −51 | **+7** | +94 | 4,8% |
| 2027 + tańszy model do generowania i kontroli (3.1 Flash-Lite) | 24,99/4,99 | −37 | **+1** | +57 | 5,0% |
| | 29,99/5,99 | −23 | **+23** | +94 | 4,0% |
| | 39,99/7,99 | +4 | **+69** | +167 | 2,9% |

**Wniosek:** przy 5% płacących i obecnej konstrukcji kosztów wynik jest **na granicy zera lub na minusie**. To da się
naprawić trzema dźwigniami razem (kolejność wg opłacalności):

1. **Tańsze modele**: wyjście modelu Flash-Lite (2,50 USD/mln) to największy składnik kosztu generowania.
   Przetestować (A/B jak w sekcji 7) starszy `gemini-3.1-flash-lite` (1,50 USD) do generowania oraz Flash-Lite
   zamiast Flash do kontroli jakości. W obliczeniach to ok. −50% kosztu generowania.
2. **Przypiąć wersje modeli** zamiast `...-latest`: alias sam przeskakuje na nowszy, droższy model, a to zmienia
   koszt bez żadnej zmiany w aplikacji. (Sprawdzić też, czym naprawdę jest `gemini-3.7-flash` i ile kosztuje.)
3. **Cena 29,99/5,99 lub wyższa** i/lub przycięcie darmowego poziomu (np. 1 generowanie dziennie).

## 10. Test A/B: kontrola jakości na Flash-Lite zamiast Flash (`live/ab3.live.js`, 6 scenariuszy)

| | Kontrola na Flash (obecnie) | Kontrola na Flash-Lite |
|---|---|---|
| Przepisy | 30 / 30 | 30 / 30 |
| Zapytania do AI | 27 | 31 |
| Koszt 6 generowań (ceny z 2026) | 12,6 centa (**2,1 centa** na generowanie) | 13,6 centa (2,3 centa) |
| Przesolone przepisy (> 9 g soli) | 3 | 2 |
| Brak soli / min. 3 kroki | 0 / 30 z 30 | 0 / 30 z 30 |

**Wniosek:** jakość taka sama, ale **brak oszczędności**: kontrola jest tylko ok. 20–30% kosztu, a różnice w liczbie
powtórek (zamienników) między próbami są większe niż zysk. Zostajemy przy Flash do kontroli. Pomiar potwierdził też
model kosztów: średnio **2,1 centa na generowanie** przy cenach z 2026 roku (szacunek z sekcji 9 dawał 2,12).

Co zostaje jako realna dźwignia: tańszy model do **głównego** zapytania (wyjście Flash-Lite 3.5 kosztuje 2,50 USD
za mln tokenów, starszy 3.1 kosztuje 1,50 USD) i mniej powtórek. Serwer musi najpierw dopuścić ten model
(`proxy/src/policy.js`) i zostać wdrożony.

## 11. Test A/B: który model pisze przepisy (`live/ab4.live.js`, 5 scenariuszy doszło do końca)

Warianty: `gemini-flash-lite-latest` (było), ten sam model przypięty do wersji `gemini-3.5-flash-lite`, tańszy
starszy `gemini-3.1-flash-lite` (wyjście 1,50 zamiast 2,50 USD za mln tokenów). Ostatnie 3 scenariusze (z 8) zatrzymał
nowy budżet dzienny serwera (429), co przy okazji potwierdziło, że sufit działa.

| 5 scenariuszy (en, pl, de, es, it) | latest (było) | **3.5 przypięty** | 3.1 (tańszy) |
|---|---|---|---|
| Przepisy (maks. 25) | 25 | 25 | **24** |
| Przepisy z linią soli | 24 | 25 | **19** |
| Przepisy z min. 3 krokami | 25 | 25 | 24 |
| Zgodna kategoria | 25 | 25 | 24 |
| Różne typy dań (suma) | 22 | 21 | **19** |
| Średnia długość kroków (znaków) | 308 | 320 | **226** |
| Zapytania do AI / duże zapytania | 26 / 10 | 21 / 8 | **29 / 12** |
| Koszt 5 generowań | 11,4 centa | 9,9 centa | **13,3 centa** |

**Wniosek:**

- **3.1 jest gorszy i nie jest tańszy.** Pisze krótsze, uboższe kroki, często pomija sól (np. po hiszpańsku tylko 1 z 5
  przepisów miał linię soli), a więcej odrzuconych przepisów oznacza więcej powtórek, więc koszt wychodzi wyższy
  mimo niższej ceny za token. Odrzucony.
- **3.5 przypięty = to samo co alias** (te same jakość i cena; różnica kosztu to rozrzut powtórek). Wdrożony jako
  pierwszy model, z aliasem i Flash jako zapasem: cena przestaje zależeć od tego, na co Google przestawi `-latest`.
- Realne oszczędności trzeba więc szukać gdzie indziej: mniej powtórek (zamienników) i krótszy wynik modelu, albo
  wyższa cena subskrypcji.
