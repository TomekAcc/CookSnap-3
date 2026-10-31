# Cook AI Gemini proxy

A small Cloudflare Worker that sits between the app and Google's Gemini API. The Gemini key
lives here, as a secret, and never ships inside the app.

What it does for every request from the app:

1. Only accepts `POST /v1beta/models/<model>:generateContent` for the three models the app uses.
2. Requires an `X-Device-Id` (a random id the app creates once per install).
3. Rejects any body that isn't one of the shapes the app sends (no tools, no safety overrides, at
   most 8 images, capped output and thinking size, 4 MB maximum). See `src/policy.js`.
4. Counts requests per device and for the whole app per UTC day, and answers `429` past the
   limits (`DEVICE_DAILY_LIMIT`, `GLOBAL_DAILY_LIMIT` in `wrangler.toml`).
5. Adds the real key and forwards the request; Google's reply is passed back unchanged.

## Deploy (once)

You need a free Cloudflare account and Node 18+ on a computer.

```bash
cd proxy
npx wrangler login                      # opens a browser to sign in
npx wrangler secret put GEMINI_API_KEY  # paste the key when asked (it is not shown or stored locally)
npx wrangler deploy                     # prints the proxy URL, https://cooksnap-proxy.<you>.workers.dev
curl https://cooksnap-proxy.<you>.workers.dev/health    # {"ok":true}
```

Use a NEW key for the secret (restricted to the Gemini API in Google Cloud Console), then delete
the old key once the app has switched over.

## Point the app at it

1. Put the URL in the EAS `preview` (and `production`) environment as a plain-text variable
   `EXPO_PUBLIC_GEMINI_PROXY_URL`, and remove `EXPO_PUBLIC_GEMINI_API_KEY` from EAS and from your
   local `.env`.
2. Build a bundle without a key and check it:
   ```bash
   npx expo export --platform android --no-bytecode --clear --output-dir /tmp/bundle-check
   npm run check:bundle -- /tmp/bundle-check      # must print "OK"
   ```
3. Publish with the cache cleared: `npx eas-cli update --branch preview --environment preview --clear-cache`.
4. Do one scan and one recipe generation in the app. Then run `npm run test:live` with
   `EXPO_PUBLIC_GEMINI_PROXY_URL` set, if you want the automated version.
5. Only now delete the old Google key (phones that haven't updated yet will start failing, which is
   the point, but wait until you've seen the new version work).

## Operating it

- Switch it off instantly: Cloudflare dashboard -> Workers -> cooksnap-proxy -> Settings ->
  Variables -> `PROXY_DISABLED` = `1` (or `npx wrangler deploy --var PROXY_DISABLED:1`).
- Change the limits: edit the `[vars]` in `wrangler.toml` and `npx wrangler deploy`.
- Watch usage: Cloudflare dashboard -> Workers -> Metrics, and AI Studio -> Spend.
- Logs: `npx wrangler tail` (request bodies are never logged).
- Tests: `npm run test:proxy` from the repo root (no account or key needed).
- Local run: `npx wrangler dev --var GEMINI_API_KEY:anything --var UPSTREAM_BASE:http://localhost:9000/v1beta`
  with a stub server on port 9000 stands in for Google.

## Limits of this design

A device id is not an identity: someone who reads the app can send their own random ids, so the
per-device limit stops casual abuse but not a determined one. The global daily limit and the Google
spend cap are the backstops. Stronger options (sign-in, Play Integrity / App Attest) are possible
later if usage or revenue justifies them.
