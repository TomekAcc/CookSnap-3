# Legal and store documents

Drafts for the first store release. None of them is legal advice; have a lawyer read the final versions.

| File | What it is |
|---|---|
| `PRIVACY_POLICY.md` | Privacy policy (English). Needs a public URL for both stores and a link in the app. |
| `TERMS_OF_SERVICE.md` | Terms of service (English), including AI disclaimers and subscription terms. |
| `STORE_PRIVACY_ANSWERS.md` | Draft answers for Apple "App Privacy" and Google "Data safety", plus open questions. |
| `STORE_COMPLIANCE.md` | (Polish) Checklist of Apple/Google policies and the laws that apply (GDPR, consumer law, AI Act, health claims, taxes), with status ✅ / 🟡 / ⚖️ and the order of work before launch. |
| `DISCLAIMERS.md` | Copy-ready notices: in-app AI/allergy texts, store-description footer, subscription disclosure, App Review notes, age-rating guidance, words to avoid. |
| `INTERNAL_PROCEDURES.md` | (Polish) Records of processing, processor checklist, how to answer data requests (with reply templates), incident procedure (72 h), complaints, change log. Not published. |

## Fill in before publishing (search for `[` in the files)

- Company name and NIP are filled in (Tomasz Białasiewicz, NIP 9472021327). Address filled in: ul. Horacego Safrina 18, 91-177 Łódź (must match the address in CEIDG)
- Support address: done, `cooksnap.support@gmail.com` (the same as `SUPPORT_EMAIL` in `src/constants/contact.js`; change both if the name of the app changes)
- `[DATE]`, `[PRIVACY POLICY URL]`, subscription prices and limits (copy from `src/constants/limits.js` and
  the paywall), `[AMOUNT]` (liability cap, terms section 11.3), (no REGON and no phone number are published)
- Every `[VERIFY ...]` note, including ones that run over several lines (the final build refuses to run while any is left)
- The "Verify before publishing" list at the end of the privacy policy

## Where they are published

The pages live on the same Cloudflare Worker that fronts the AI, so there is nothing else to host:

- `https://cooksnap-proxy.cooksnap.workers.dev/privacy`
- `https://cooksnap-proxy.cooksnap.workers.dev/terms`
- `https://cooksnap-proxy.cooksnap.workers.dev/support` (contact and how to report a recipe)

Use these three addresses in the store forms (privacy policy URL, support URL) and, later, a custom domain if you
buy one. They are built from the texts in this folder.

### Publishing them (once the placeholders are filled in)

1. Fill every `[PLACEHOLDER]` in `PRIVACY_POLICY.md` and `TERMS_OF_SERVICE.md` (company, address, NIP, date,
   prices and limits, payment provider) and check the "Verify before publishing" list.
2. `cd proxy && npm run build:legal`. This refuses to run while a placeholder is left; it drops the draft notes
   and the "Verify" list. (`npm run build:legal:draft` builds a version with the placeholders and a "draft" banner,
   which is what is in the repository now. Do not deploy the draft publicly if you do not want it to be read.)
3. `npx wrangler deploy` in `proxy/`.
4. Turn on the links in the app: build or publish with `EXPO_PUBLIC_LEGAL_LIVE=1`. Settings > About then shows
   "Privacy Policy" and "Terms of Service" rows. Until then they are hidden, so nobody taps a dead link.
5. Open the three addresses once in a browser and read them.

## Before launch: have a lawyer look at these

Terms: sections 3, 4.7, 11, 14, 15. Privacy policy: the health-data consent (Art. 9) and the data-transfer
wording. And prepare **Polish versions** of both for Polish consumers. A single consultation of a couple of
hours is usually enough. `STORE_COMPLIANCE.md` lists everything else.

## Keep them true

If the app starts doing anything new with data (analytics, crash reporting, accounts, notifications, a
payment SDK, a second AI provider), update the policy and the store forms in the same release.


## Open points for the lawyer (checked once, not guaranteed; the texts above are written to be publishable)
- Terms 4.7 (right to withdraw from a digital subscription within 14 days): wording for digital services, and how Apple and Google
  apply it as the seller of the subscription.
- Terms 14: out-of-court dispute resolution. The EU Commission's online dispute resolution platform closed in July 2025 (do not link
  to it); check whether CookSnap must name an ADR body.
- Terms 16: Polish consumers should be offered a Polish text; the Polish versions of the Terms and the Privacy Policy must be added
  and the English-vs-Polish clause confirmed.
- Privacy Policy 5 (Google): abuse-monitoring logs of the paid Gemini API are kept 55 days and not used for training, per Google's
  documentation as read in November 2026; re-check before relaunch.
- Privacy Policy 6 (transfers outside the EEA): confirm that Google LLC and Cloudflare are listed on dataprivacyframework.gov (or
  rely on SCCs). The EU-US Data Privacy Framework stood in November 2026, with an appeal pending at the Court of Justice.


## Polish versions and the health notice (added November 2026)
- Polish texts: `docs/legal/pl/REGULAMIN.md` (terms, also the electronic-services terms with technical requirements, complaints and a model
  withdrawal form), `POLITYKA_PRYWATNOSCI.md` (privacy policy) and `OSTRZEZENIA_ZDROWOTNE.md` (health and food notice).
  English health notice: `HEALTH_AND_FOOD_DISCLAIMER.md`. Keep each pair in step: change both when a fact changes.
- Pages: `/privacy`, `/terms`, `/disclaimer`, `/support` and `/pl/privacy`, `/pl/terms`, `/pl/disclaimer`, `/pl/support`
  (built by `cd proxy && npm run build:legal`, deployed with `npx wrangler deploy`). The app links Polish users to the Polish pages
  and everyone else to the English ones (`src/constants/legal.js`).
- These texts were written by an AI model from what the app does, checked against the code; they are not legal advice. Have a lawyer
  (ideally a Polish consumer-law and GDPR specialist) read them before large-scale launch.
