# Store screenshots

Finished drafts with captions, in English and Polish, ready to upload once the app name is final.

| Folder | Size | For |
|---|---|---|
| `final/ios-6.9/en`, `final/ios-6.9/pl` | 1290 x 2796 | App Store, 6.9" iPhone (Apple scales it down for the smaller sizes) |
| `final/google/en`, `final/google/pl` | 1080 x 2160 (2:1) | Google Play phone screenshots |

Seven slides each, in this order: 01 scan, 02 recipes, 03 steps, 04 diets, 05 planner (PRO), 06 pantry, 07 Modify with AI (PRO).

How they were made: the app's real screens captured in a phone-sized browser window (the sample scan, real AI recipes
and a real AI week plan, in each language), cropped of the empty status-bar band, put in a phone frame on the brand
green with a caption. The Polish set shows the Polish app with Polish recipes.

Known limits, to fix before submitting:
- No clock, battery or signal bar (the browser has none). Captures from a real phone (TestFlight / an Android build)
  would be more convincing, and Apple's review may prefer them.
- The sample-scan slide still says "This is a sample fridge".
- The captions are drafts; a lawyer is not needed for them, but check the PRO wording once real prices exist.
- If the app is renamed, the screens that show the "CookSnap" wordmark need recapturing.
- The capture scripts are in `tools/` (see below).

## How slides 01 and 02 are made now (`tools/`)

1. Start the app's web build: `EXPO_PUBLIC_GEMINI_PROXY_URL=https://cooksnap-proxy.cooksnap.workers.dev npx expo start --web --port 8081`.
2. `NODE_PATH=<dir with playwright> node tools/capture.js <scan|recipes> <en|pl> out.png [fridge-photo]` takes the REAL screen at
   430 x 873 pt @3x and draws the iOS status bar (9:41, signal, Wi-Fi, full battery) on top. `recipes` really taps
   "Generate AI Recipes", so the recipes are written by the AI through the proxy (PRO state, so the badge reads
   "7 of 8 generations left today"). `scan` shows the "just scanned" screen with the given photo and the 14 ingredients.
   Nothing in the app is changed or faked: the screen is put in its state by writing the app's own saved data.
3. `python tools/compose.py <old-slide.jpg> capture.png <new-slide.jpg>` swaps the screen inside the phone frame, draws the iPhone details (Dynamic Island, home indicator, side buttons) and keeps
   the green background, caption and frame as they are (1290 x 2796).

Source photo for slide 01: `source/ai-fridge-argolink.png` (AI-generated; keep the prompt, date and the site's terms with it).
