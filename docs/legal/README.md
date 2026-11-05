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

- Company name and NIP are filled in (Tomasz Białasiewicz, NIP 9472021327). Still open: `[BUSINESS ADDRESS]` (must match the address in CEIDG)
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
