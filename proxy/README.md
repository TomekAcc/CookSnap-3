# CookSnap Gemini proxy

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

## Feedback inbox (Help & Feedback)

The same Worker keeps the messages from the app's Help & Feedback screen: `POST /feedback` (message, kind,
app version, OS, language, recipe title; at most 10 per phone and 500 in total per day,
kept 90 days). You read them on a private page, `https://cooksnap-proxy.<you>.workers.dev/admin`.

One-time setup, in this folder:

```bash
openssl rand -hex 24                     # prints a long random password; copy it somewhere safe
npx wrangler secret put ADMIN_TOKEN      # paste that password when asked
npx wrangler deploy
```

Open `/admin`, type the password (it stays only in that browser tab), and you see the messages newest first,
filter by kind, and delete one. Without `ADMIN_TOKEN` (or with one shorter than 24 characters) `/admin` does not
exist. Lost the password? Run `wrangler secret put ADMIN_TOKEN` again with a new one.

### Reliability: nothing the person writes is lost

- The app saves each message on the phone first and then sends it. If there is no connection (or the server
  is busy or down) it stays saved and is retried when the app opens or comes back to the front, for up to 30 days.
- Each message carries a random id, so a retry after a lost answer is stored once.
- The server answers "ok" only after the message is written.

### Instant copy on your phone (optional, recommended): Telegram

With a Telegram bot the Worker also sends a "new feedback" notice to your own chat, so you hear about it at once. If Telegram is down, the message is still stored.

1. In Telegram, open **@BotFather**, send `/newbot`, pick a name; it replies with a token (keep it private).
2. Open a chat with your new bot and send it any message (for example "hi").
3. In a browser open `https://api.telegram.org/bot<TOKEN>/getUpdates` (put your token in) and find
   `"chat":{"id":123456789` — that number is your chat id.
4. In this folder:
   ```bash
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put TELEGRAM_CHAT_ID
   npx wrangler deploy
   ```

Telegram receives only a short notice ("new feedback: kind, platform, app version, open the /admin page"), never the
message, the reply address or the recipe title, so no user text leaves the server. Read the message on /admin.

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
