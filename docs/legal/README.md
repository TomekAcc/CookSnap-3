# Legal and store documents

Drafts for the first store release. None of them is legal advice; have a lawyer read the final versions.

| File | What it is |
|---|---|
| `PRIVACY_POLICY.md` | Privacy policy (English). Needs a public URL for both stores and a link in the app. |
| `TERMS_OF_SERVICE.md` | Terms of service (English), including AI disclaimers and subscription terms. |
| `STORE_PRIVACY_ANSWERS.md` | Draft answers for Apple "App Privacy" and Google "Data safety", plus open questions. |

## Fill in before publishing (search for `[` in the files)

- `[COMPANY NAME AS IN CEIDG]`, `[BUSINESS ADDRESS]`, `[NIP]`
- Support address: done, `cooksnap.support@gmail.com` (the same as `SUPPORT_EMAIL` in `src/constants/contact.js`; change both if the name of the app changes)
- `[DATE]`, `[PRIVACY POLICY URL]`, subscription prices and limits (copy from `src/constants/limits.js` and
  the paywall), `[PAYMENT PROVIDER]`
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

## Keep them true

If the app starts doing anything new with data (analytics, crash reporting, accounts, notifications, a
payment SDK, a second AI provider), update the policy and the store forms in the same release.
