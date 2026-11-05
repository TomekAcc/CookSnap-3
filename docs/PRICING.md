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
