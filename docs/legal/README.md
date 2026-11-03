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

## Where to host them

Both stores need a public web address for the privacy policy (and for support). Free options that need no
server of our own: GitHub Pages from this repository, or Cloudflare Pages on the account that already runs
the proxy. Put the final text on a plain page and link it from the store listings and from Settings >
About.

## Keep them true

If the app starts doing anything new with data (analytics, crash reporting, accounts, notifications, a
payment SDK, a second AI provider), update the policy and the store forms in the same release.
