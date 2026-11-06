# CookSnap — plan wypuszczenia (kolejność i zależności)

Zasada: **najpierw zaczynamy to, na co się czeka** (konta, weryfikacje, testy zamknięte), a w trakcie czekania robimy
resztę. Najdłuższa ścieżka to **Android: konto → build → 14 dni testów zamkniętych → publikacja**. iOS jest szybszy.

Oznaczenia: 👤 Ty · 🤖 ja · 👥 razem · ⏳ czekanie

## Faza 0 — od razu, równolegle (dzień 1–2)
- [ ] 👤 Adres z CEIDG (albo wirtualne biuro i zmiana adresu w CEIDG). Odpowiedź w czacie: adres + „tak/nie" dla Telegrama.
- [ ] 👤 Konto **Apple Developer** (99 USD, osoba fizyczna). ⏳ weryfikacja kilka dni.
- [ ] 👤 Konto **Google Play** (25 USD, osobiste). Potrzebny **telefon z Androidem** do weryfikacji. ⏳
- [ ] 👤 Zasilić konto Google AI Studio (np. 20 USD) i ustawić **alert budżetu**.
- [ ] 👤 Umówić **księgową** (VAT, faktury dla sklepów) i **prawnika** (regulamin i polityka, ok. 2–3 h).
- [ ] 👤 Wdrożyć serwer: `git pull`, `cd proxy`, `npx wrangler deploy`; napisać „wdrożone".

## Faza 1 — kod i dokumenty (tydzień 1), robię ja
- [ ] 🤖 Adres i NIP w dokumentach, **polskie wersje** regulaminu i polityki, build stron `/privacy` `/terms`.
- [x] 🤖 Telegram: samo powiadomienie bez treści (zrobione, wymaga wdrożenia serwera).
- [x] 🤖 Test tańszego modelu: odrzucony (3.1 gorszy, 2.5 niedostępny dla nowych użytkowników); zostaje 3.5 Flash-Lite.
- [x] 🤖 Darmowa próbka „na start" (3 skany + 3 skany spiżarni + 3 generowania raz w życiu), po niej ekran zakupu; ceny 29,99 / 5,99 USD; niski globalny budżet serwera (wymaga wdrożenia).
- [ ] 🤖 Włączenie linków do regulaminu i polityki w aplikacji (`EXPO_PUBLIC_LEGAL_LIVE=1`).

## Faza 2 — płatności i pierwszy prawdziwy build (tydzień 1–2), razem
Warunek: konta z fazy 0 są aktywne.
- [ ] 👥 Utworzyć aplikację w App Store Connect i Play Console (`com.tomekacc.cooksnap`).
- [ ] 👥 Dwie subskrypcje w obu sklepach: `cooksnap_pro_annual` (z 7 dniami próby) i `cooksnap_pro_monthly`.
- [ ] 👥 Konto RevenueCat, encja `pro`, klucze iOS/Android w zmiennych EAS; `npx expo install react-native-purchases`.
- [ ] 👥 **Pierwszy `eas build`** (iOS przez TestFlight, Android jako wersja wewnętrzna) i **test na prawdziwych telefonach**:
      skan z aparatu, z galerii, zgoda na AI, „Usuń moje dane", zakup testowy (Sandbox), przywracanie zakupów.
- [ ] 🤖 Poprawki tego, co wyjdzie w teście (to najbardziej nieprzewidywalny etap).

## Faza 3 — prezentacja w sklepach (tydzień 2–3)
- [ ] 👤 Zdjęcie prawdziwej lodówki i wybór stylu zrzutów; 🤖 składam zrzuty (`docs/store/screenshots`).
- [ ] 👥 Opis, słowa kluczowe, kategoria (`docs/store/LISTING.md`), formularze **App Privacy** i **Data safety**
      (`docs/legal/STORE_PRIVACY_ANSWERS.md`), ocena wiekowa i notatki dla recenzenta (`docs/legal/DISCLAIMERS.md`).
- [ ] 👤 **iOS: wysłać do recenzji.** ⏳ zwykle 1–3 dni.
- [ ] 👤 **Android: uruchomić test zamknięty** (zaprosić wymaganą liczbę testerów: znajomi, rodzina). ⏳ min. 14 dni.

## Faza 4 — start i pomiar
- [ ] 👤 Publikacja iOS po zatwierdzeniu; Android po zakończeniu testów.
- [ ] 👥 Co tydzień: koszt AI, liczba instalacji, rozpoczęte okresy próbne, powroty po 7 dniach (cele: > 2–3% rozpoczętych prób, > 15–20% powrotów).
- [ ] 👥 Po 4–8 tygodniach: decyzja, czy iść dalej i w którym kierunku (patrz `docs/PRICING.md`).
