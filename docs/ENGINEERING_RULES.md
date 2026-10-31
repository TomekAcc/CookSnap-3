# Cook AI — Engineering Rules

These are the working conventions for this codebase — grounded in real
incidents from this project's own history, not generic boilerplate. The
source files live individually under `.claude/rules/` (loaded automatically
as project context by Claude Code); this document is the same content
consolidated for anyone browsing `docs/` directly.

**Topics:** Code Quality · Testing · Git Hygiene · Documentation · Security ·
Versioning · CI/CD · Cross-Platform · AI Integration

---

## Code Quality

### Comments
- Default to no comments. Only write one when the WHY is non-obvious: a
  platform-specific workaround, a hidden constraint, a bug that already bit
  us once. If removing the comment wouldn't confuse a future reader, don't
  write it.
- Never explain WHAT the code does — good naming already does that. Never
  reference "the current fix" or an issue number in a comment; that belongs
  in the commit message, not the source.
- When a comment documents a real gotcha (e.g. the `overflow: "hidden"` +
  iOS shadow conflict, the Header/Modal same-commit re-render collision),
  keep it — it's cheaper than re-discovering the bug.

### Style conventions already established in this codebase
- Explicit "shadow purge" objects (`elevation: 0, shadowOpacity: 0,
  shadowColor: "transparent", shadowRadius: 0, shadowOffset: {width:0,
  height:0}`) wherever a native shadow must be fully suppressed — a bare
  absence of shadow styles is not enough on iOS; leftover style keys from a
  previous design still render.
- Prefer `position: "absolute"` floating overlays over flex-sibling
  "reserved space" patterns for floating CTAs/bottom bars — reserved-space
  layouts leave variable-size gaps that read as stray background color.
- Colors: no hex literals outside `src/theme/` (lint-enforced; the dish-badge
  table in `utils/imageUtils.js` is the one exception). Anything that differs
  between light and dark is a role in `src/theme/colors.js` and is read as
  `useTheme().colors.<role>` (`outline`, `ink`, `greenStrong`, `amberStrong`...);
  never write `isDark ? "#…" : "#…"` in a component. A color that is the same in
  both themes (white text on a green button) imports its name from
  `src/theme/palette.js`. Need a new role? Add it to BOTH `LIGHT_COLORS` and
  `DARK_COLORS` (`__tests__/theme.test.js` checks they match).

### Component structure
- A screen-sized component is a thin composition. Timelines, permissions and
  other stateful behavior go in a hook (`useFridgeScanChoreography`,
  `useScanCapture`, `useManualAdd`), and each visual stage is its own component
  that reads the domain state it shows and takes animation values and handlers
  as props. `FridgeScannerHero` (about 130 lines) and `src/components/scanner/`
  are the model.
- Fridge and pantry share one implementation of anything they both do (camera
  modal, capture hook, Scan More sheet, image picker). Don't copy one scanner
  into the other; give the shared piece a `kind` option instead.
- Icons are imported from `src/icons.js` only, and by an exported name
  (`Image as ImageIcon`, not `ImageIcon`). `__tests__/iconImports.test.js`
  fails on a missing one.

### No dead code
- Delete code that's confirmed unused (verified via grep across `src/`)
  rather than leaving it "just in case." This codebase has already
  accumulated and removed dead exports (`useSheetSlideIn`,
  `bottomSheetStyles`) — don't let it happen again.
- Don't add backwards-compatibility shims, unused `_prefixed` vars, or
  "removed" comments for deleted code.

### Scope discipline
- A bug fix doesn't need surrounding refactoring. Don't introduce a new
  abstraction for something used once. Three similar lines beat a premature
  helper.
- Don't add error handling for states that can't occur. Trust the
  guarantees this codebase already establishes (e.g. `normalizeRecipe`
  always returns a well-formed recipe object).

---

## Performance

Metro does no tree-shaking, so what you import is what ships. Measured on the
production iOS export: following these rules took the Hermes bundle from
5.13 MB to 3.77 MB and bundled assets from 1.5 MB to 0.58 MB.

- **Icons:** import from `src/icons.js`, never from `"lucide-react-native"`
  (the package root bundles all ~3,500 icons, ~1.3 MB). Add a new icon as one
  `export { default as X } from "lucide-react-native/icons/<kebab-name>"` line.
- **Font packages:** import one weight per file
  (`@expo-google-fonts/plus-jakarta-sans/400Regular`), never the package root
  (it bundles all 14 weights and italics).
- **Translations:** only English is imported eagerly; other languages are
  `require`d on first use in `src/i18n/index.js`. A new language is one line in
  `LOADERS`.
- **No NativeWind / `className`.** It was used once, yet its JSX runtime wrapped
  every element (about 15% more fibers and 16-30% slower tab switches). Style
  with `StyleSheet` / inline styles and the tokens in `src/theme/tokens.js`.
- **Context fan-out:** app state is split by domain (see "State architecture");
  a screen reads only the domain hooks it needs, so it re-renders only when
  those change. Keep transient UI state out of context entirely (the visible
  toast is `showToast()` from `src/utils/toast.js`, rendered from
  `toastStore.js`), and have leaf components that only need `t` use
  `useTranslation()`.
- **Lists:** rows of a list that can reach dozens of items (Pantry, Saved) are
  `React.memo` components with stable props (ids + stable callbacks, not inline
  closures from the parent). Verify with a render count before and after.

---

## State architecture

App state lives in nine domain providers, composed in `src/context/AppProviders.jsx`
(outermost first). Each owns its state, persistence and actions, and may use only
the providers above it:

| Provider (hook) | Owns |
|---|---|
| `NavigationContext` (`useNavigation`) | active tab, Scanner scroll bookkeeping |
| `OnboardingContext` (`useOnboarding`) | onboarding gate and the one-time hints |
| `LanguageContext` (`useLanguage`, alias `useTranslation`) | the one language setting: `t`, recipe language |
| `EntitlementsContext` (`useEntitlements`) | `isPro` and the free-tier daily limits |
| `PreferencesContext` (`usePreferences`) | meal type, servings, hunger, cravings, ingredient priority, diet (+ PRO custom diet), units |
| `LibraryContext` (`useLibrary`) | saved recipes and favorites |
| `InventoryContext` (`useInventory`) | fridge ingredients, pantry, and the "sample data showing" flag |
| `RecipesContext` (`useRecipes`) | the generated batch: generate, modify, translate, visible list |
| `ScanContext` (`useScan`) | fridge scan, pantry scan, history, the onboarding sample scan |

`ModalContext` (modal open/close) sits above all of these and is deliberately
separate; `ThemeContext` is separate too.

- **Where new state goes:** the domain that owns the concept. If nothing fits,
  that is a design question — do not add a catch-all. A domain never reads one
  below it; if it needs something from below, the lower domain should call it
  (that is why `ScanContext` calls `clearRecipes()` instead of `RecipesContext`
  watching scans).
- **Screens** import the specific hooks (`const { ingredients } = useInventory()`),
  never a merged object. There is intentionally no `useCookAI()` any more.
- **Expose actions, not raw setters,** across domains (`replaceSavedRecipe`,
  `clearRecipes`) so the owner keeps its invariants. `toggleFavorite` takes the
  recipe as an argument instead of reaching into the generated batch for the same
  reason.
- **Pure logic stays out of providers** (`utils/ingredients.js`, `utils/recipeLists.js`,
  `constants/limits.js`) so it can be tested without React.
- **Don't let callbacks in a context value close over fast-changing state** if
  consumers don't need it — it changes the function's identity and re-renders every
  consumer (`generateRecipes` and a few others still do; a stable-callback pass is a
  known follow-up).
- **Testing a domain:** `renderApp()` from `test-utils/renderApp.js` mounts the real
  provider tree (AsyncStorage mocked) and returns every domain's value; mock only
  the Gemini services. See `__tests__/scan.test.js`, `recipes.test.js`, etc.

---

## Persistence

Anything that must survive an app restart goes through the persistence layer —
never a bare `AsyncStorage` call, and never a hand-written
"hydrate in an effect, persist in another effect, `*Hydrated` flag" block (that
pattern was copied ~20 times in the old single provider and is what this replaced).

- **State:** `usePersistedState(STORAGE_KEYS.x, { initial, codec, fallback?, shouldPersist? })`
  in `src/hooks/usePersistedState.js` returns `[value, setValue, hydrated]`. It
  reads once on mount, validates with the codec (a missing or invalid value
  keeps `initial`, or `fallback()` — e.g. the device language), and only writes
  after the read has finished, so a default can never overwrite saved data.
  `shouldPersist` keeps a value in memory only (the onboarding sample scan).
- **Keys** live in `src/storage/keys.js`, versioned (`:v1`). Never rename a key
  (existing installs lose that data) — add a `:v2` and migrate on read. A test
  pins the exact strings.
- **Codecs** (`src/storage/codecs.js`): `arrayCodec`, `objectCodec(defaults)`,
  `enumCodec(...)`, `positiveIntCodec`, `booleanCodec`, `flagCodec` (true stored,
  false deletes the key), `textCodec`, `jsonCodec(validate)`. Parsing never
  throws; one corrupt key can never break startup. Prefer the strictest codec
  that fits.
- **Reads are batched:** `storage.getItem` calls made in the same tick become one
  native `multiGet`, so startup is one round trip instead of ~20 and related
  values appear together. Don't bypass it for startup reads.
- **Daily free-tier limits:** `useFreeTierCap(key, limit, isPro)` →
  `{ count, canUse, register }`. The count is per local day and is derived from
  the stored date, so it also resets when midnight passes while the app is open.
  Add a new limit with this hook, not a new state + effect block.
- `ErrorBoundary` is the one deliberate exception: it reads the saved language
  straight from AsyncStorage (using `STORAGE_KEYS`) so the crash screen works
  even if the providers are what crashed.
- A hook that stores a value is verified two ways: unit tests with the AsyncStorage
  mock (`__tests__/usePersistedState.test.js`), and — when you move existing
  persistence — a before/after diff of what localStorage holds across a scripted
  sequence of actions on the web build (this is how the migration was checked).

---

## Testing

### Current state of the art here (be honest about it)
Testing is three layers, none of which replaces the others:
1. **Unit tests** (`npm test`, Jest + `jest-expo`, files in `__tests__/`) for
   pure logic and hooks: diet/allergy filtering, i18n lookup and plural forms, a
   parity check that all 31 translation tables have the same keys and
   `{placeholders}` as English, time/calorie formatting, pantry text helpers, the
   Gemini client, the storage layer and persisted-state hooks (AsyncStorage is
   mocked in `jest.setup.js`), the daily-limit counter and the ingredient merge,
   and every state domain through the real providers (`test-utils/renderApp.js`):
   library, inventory, preferences/entitlements, recipes, scan; plus the scanner
   components rendered through each stage (`scannerScreens`, `scanMoreSheet`,
   `scanCapture`). When you move
   logic out of a component or the context (see the refactor plan), add its
   test in the same change.
2. A Playwright-driven **web smoke test** for crash-level JS bugs.
3. **Manual on-device verification** through Expo Go.
There is still no automated coverage of screens, gestures or the scan flow.
Don't claim a change is "tested" unless one of these actually ran.

### Visual refactors
- Before restructuring UI, capture deterministic screenshots of every state
  (fake clock, mocked Gemini) and compare them after; "pixel-identical" is the
  bar for a pure refactor. **Restart Metro with `--clear` first**: the dev
  server can keep serving an old bundle, which makes a broken refactor look
  identical to the baseline (this hid a crashing import until the smoke test).
  Make the capture fail if the page shows the error boundary.
- Jest's icon stub exports exactly the names in `src/icons.js`, so a bad icon
  import renders `undefined` there just as it does in the app.

### Lint (`npm run lint`)
- ESLint with `eslint-config-expo` (includes `react-hooks/exhaustive-deps`);
  it must stay at zero warnings. `no-console` is an error in app code: use
  `log.debug` / `log.warn` / `log.error` from `src/utils/log.js` (`debug` is
  stripped in production).
- A new `eslint-disable` needs a reason in the comment above it. The existing
  `react-hooks/exhaustive-deps` suppressions mark effects that intentionally
  run only when one value changes — don't copy the pattern for convenience.

### Web smoke test (`scripts/web-smoke-test.js`)
- Run it before publishing any change that touches a shared component —
  `StandardModal.jsx`, `bottomSheet.js`, `Header.jsx`, `BottomNav.jsx`, or
  any context provider. It has already caught a real bug (a temporal-dead-
  zone crash) that would otherwise have shipped.
- It only proves the app doesn't crash and navigation works. It CANNOT
  validate gesture feel, `BlurView` rendering, native `Modal` timing,
  camera capture, or anything else that's native-only or behaves
  differently on web. Don't treat a clean smoke-test run as proof a
  gesture/animation bug is fixed.
- Usage: `npx expo start --web` in one terminal, then
  `node scripts/web-smoke-test.js` in another.

### Manual on-device testing
- **Always bump the version marker** (`v10`, `v11`, ... in
  `Header.jsx`'s wordmark) before publishing, and ask for/confirm the new
  number is visible before trusting any bug report. Expo Go's update cache
  is aggressive enough that "still broken" reports are frequently stale
  builds, not real regressions — this has happened repeatedly on this
  project.
- When a report doesn't reproduce after confirming the version marker,
  suspect a fully deleted-and-reinstalled Expo Go is needed, not more code
  changes.
- Test gesture/animation changes with BOTH a fast and a deliberately
  hesitant/slow input — several real bugs here only showed up on one speed,
  not the other.

### Before claiming something is fixed
- Reproduce the reported symptom's exact wording as closely as possible
  before diagnosing — "freezes for a second" (release-time race) and
  "stops when my finger stops" (rigid 1:1 tracking) are different bugs that
  looked similar in the first sentence of a report.
- Prefer a live, direct test (curl the API, run the smoke test, read the
  actual render) over guessing from source code alone when a definitive
  check is available.

---

## Git Hygiene

### Commit discipline
- Never commit unless explicitly asked. Publishing to users happens via
  `eas update` and does not require a git commit — don't conflate "shipped
  to the phone" with "committed to git," and don't commit just because a
  change works.
- When asked to commit, stage only the files relevant to the request —
  don't sweep up unrelated in-progress changes with `git add -A`. Check
  `git status` after staging and confirm only the intended files are
  included before committing.
- Write commit messages that explain WHY, in 1–2 sentences. Don't restate
  the diff.
- Create new commits rather than amending, unless explicitly asked to
  amend.

### Branches and pushes
- `main` on `TomekAcc/CookSnap` is the working branch for this project —
  confirmed and used throughout. Fetch and confirm local/remote are in
  sync before pushing to avoid a rejected push or an accidental overwrite
  of someone else's work.
- Never force-push without explicit request.

### Secrets
- `.env` is gitignored and must stay that way. Never `cat`/`echo` a raw API
  key into a shell command's visible output — use the Read/Write tools for
  `.env` file operations instead of Bash, which avoids printing secrets
  into terminal history entirely.
- Before staging broad changes, scan for anything that looks like a
  credential or token, even in a file whose name looks innocuous.

### What NOT to do without being asked
- Don't open a pull request unprompted.
- Don't merge to `main` unprompted, even if a feature branch is ready —
  this project's convention has been explicit "do this" confirmation
  before a merge.

---

## Documentation

### Where things live
- `docs/PRD.md` — product requirements: problem, users, shipped feature
  set, monetization, non-goals. Update it when a shipped feature
  materially changes (e.g. pricing, a new tier gate) — it should describe
  reality, not aspiration.
- `docs/ROADMAP.md` — strategic Now/Next/Later horizons. Update when a
  roadmap item ships (move it out) or a new one is identified.
- `docs/IMPLEMENTATION_ROADMAP.md` — the tangible, file-level execution
  plan per roadmap item. This is the one to open before starting work on a
  tracked issue; it names the actual functions/line numbers to change.
- `docs/*.docx` — Word-doc mirrors of the above for sharing outside GitHub.
  When a `.md` source changes, regenerate the matching `.docx` (see the
  `docx` skill) rather than letting them drift out of sync.
- `.claude/rules/*.md` (this directory) — engineering conventions for
  working in this repo, loaded as project context.

### README
- Keep `README.md`'s project structure section honest — it's the first
  thing a new contributor reads. Update it when files move or a described
  component is renamed/removed.

### Docx generation
- Verify every generated `.docx` by rendering it to images
  (`soffice.py --convert-to pdf` → `pdftoppm`) and actually looking at the
  pages before publishing — a docx-js script can silently produce numbering
  that doesn't reset per section, broken hyperlinks, or other issues that
  only show up rendered.
- This sandbox's LibreOffice install is minimal by default — confirm
  `libreoffice-writer` is present (not just `libreoffice-core`) before
  assuming a conversion failure means the docx itself is broken.

### GitHub issues
- When a roadmap item is concrete enough to act on, open a tracked issue
  in `TomekAcc/CookSnap` rather than leaving it only in a markdown file —
  issues are what actually get referenced, assigned, and closed.

---

## Security

### API keys and secrets
- The Gemini key lives on the proxy only (`proxy/`, a Cloudflare Worker holding it as the
  `GEMINI_API_KEY` secret). The app is configured with `EXPO_PUBLIC_GEMINI_PROXY_URL` and
  sends an anonymous per-install device id; it never needs the key.
- `EXPO_PUBLIC_*` values are compiled into the bundle and readable by anyone who installs the
  app, so no secret may use that prefix in a build or publish environment. The key may sit in
  a local `.env` for development only; keep it out of EAS environment variables and empty it
  before publishing.
- Before every `eas update` or build: `npx expo export --platform android --no-bytecode --clear
  --output-dir <dir>`, then `npm run check:bundle -- <dir>` (fails if any Google key is in the
  bundle), and publish with `--clear-cache`. Metro caches inlined env values, so a key removed
  from `.env` can still ride along from a stale cache (seen while building the check).
- Never hardcode a key in source, never print one in full to a terminal or log, never commit
  `.env`. If a key is ever suspected exposed (posted in a log, a screenshot, a shared zip, or
  a published bundle), rotate it: deleting the local reference is not enough.
- Cost guards, in layers: the proxy's per-device and global daily limits (`proxy/wrangler.toml`),
  the monthly spend cap in AI Studio, and the Cloud Billing budget alert.

### Handling user data
- Fridge/pantry photos and detected ingredients are the most sensitive
  data this app touches. They're sent to Gemini for vision analysis;
  don't add any additional third-party destination for that image data
  without a clear reason and the user's awareness.
- No user account system or PII collection beyond what's needed for the
  PRO entitlement flag exists today — don't add tracking/analytics
  identifiers without deciding that deliberately (see the roadmap's
  usage-data item), not as a side effect of another change.

### Dependencies
- The app reaches Gemini through the proxy in `proxy/` (directly from the client only in local
  development with a key in `.env`). Don't introduce a second AI provider or another endpoint
  without the same scrutiny (timeout handling, key exposure, response validation). The proxy
  forwards only the request shapes the app sends (`proxy/src/policy.js`): when the app starts
  sending a new field or model, add it there in the same change.

### Input handling
- Never trust the AI's JSON output directly — `normalizeRecipe()` and the
  vision-response parsing already validate/coerce shape before it reaches
  UI state. Any new AI-backed feature should follow the same
  parse-then-validate pattern, not render raw model output.

---

## Versioning

### The "vN" header marker (until a real build pipeline exists)
- `Header.jsx`'s wordmark carries a visible red version marker (e.g.
  `v20`). Bump it by one on every `eas update` publish that changes user-
  visible behavior, and only that — it exists purely to let a human
  confirm they're looking at the build that actually contains the fix,
  given how aggressively Expo Go caches updates.
- Don't skip the bump "because it's a small change" — small changes are
  exactly the ones that produce ambiguous "is this still broken?" reports
  without it.
- Remove or replace this marker once the app has a real build number
  surfaced in Settings/Profile (see the production-build roadmap item) —
  it's a stopgap, not a permanent UI element.

### EAS Update
- `app.json`'s `updates.url` and `runtimeVersion: "exposdk:58.0.0"` must
  stay in the classic SDK-string format for updates to open directly in
  Expo Go — the `{"policy": "appVersion"}` format only targets standalone/
  custom builds and will NOT work for Expo Go testing.
- Expo Go on iOS always updates itself to the newest SDK and an older one
  cannot be installed, so the app has to follow: when Expo Go shows "Project
  is incompatible with this version of Expo Go", upgrade the SDK
  (`npx expo install expo@~NN.0.0`, then `npx expo install --fix`, then
  `npx expo-doctor`), set `runtimeVersion` to `exposdk:NN.0.0`, check that
  `npx expo export --platform ios --platform android` bundles (the jest icon
  stub hides broken icon imports), and only then publish.
- Publish to the `preview` branch (`eas update --branch preview`) for all
  testing, with `EXPO_PUBLIC_SHOW_TESTING=1` set in the shell of that command
  (or in the EAS preview environment): it is what shows the PRO switch and
  "Replay onboarding" in Settings (src/config/flags.js). A production publish
  must not have it. Don't create new branches ad hoc without a reason — it
  fragments where "the latest version" actually is.
- Write a real, specific `--message` on every publish — it's the only
  record of what changed in that update once several publishes have
  happened in a row.

### Semantic versioning (once a real release process exists)
- `package.json`'s `"version"` should track actual app-store releases, not
  every EAS Update publish — don't bump it per-publish; reserve it for
  versions that go through app review.

---

## CI/CD

### Current pipeline (honest state, see roadmap issue #2)
CI (`.github/workflows/ci.yml`) runs `npm run lint` and `npm test` on every
push and pull request. It does not run the web smoke test and does not publish
anything. There is no standalone signed build yet. "Shipping" today means:
1. Edit source in `src/`.
2. Bump the version marker (see `versioning.md`).
3. `export EXPO_TOKEN=... && eas update --branch preview --message "..."`.
4. Confirm on a real device via Expo Go.

CI only gates the pushed branch, not the `eas update` command, and it cannot
see crashes in rendering. Treat that as a real risk — run lint, tests and the
web smoke test (`testing.md`) before every publish that touches shared code.

### Before this project has real CI
- Any pre-publish check that CAN run without a full CI system should run
  manually every time: `node --check` / a Babel parse check on changed
  `.js`/`.jsx` files, and the web smoke test for shared-component changes.
- Don't skip these checks "just this once" because a change looks small —
  several real bugs shipped in this project were exactly the kind that
  looked too small to bother checking.

### When CI is built (roadmap item #2 groundwork)
- Add the web smoke test to the workflow (`scripts/web-smoke-test.js` exits
  non-zero on failure; it needs Metro running and a Chromium install) before
  building anything more elaborate.
- `eas build` profiles (`eas.json`) should exist for `preview` (internal
  testing) and `production` (store submission) before any store listing
  work starts — see `docs/IMPLEMENTATION_ROADMAP.md` item #2.
- Don't wire EAS Update publishing into an automated pipeline until there's
  at least the smoke test as a gate — automatic publishing with no check is
  strictly worse than the current manual-but-careful process.

---

## Cross-Platform (iOS / Android)

### Known gap (see roadmap issue #8)
The overwhelming majority of hands-on verification on this project has
been iOS/Expo Go on iPhone. Do not assume a fix confirmed on iOS behaves
identically on Android — several of the exact subsystems most recently
touched (gesture handling, `BlurView`) are the ones most likely to diverge.

### The browser build can hide breakage that the phone shows
Our browser checks run on react-native-web, which keeps some APIs React Native has removed. After the SDK 58 /
React Native 0.88 upgrade, `...StyleSheet.absoluteFillObject` (removed in RN 0.88, still in react-native-web)
silently became `{}` on the phone: every sheet's backdrop collapsed to zero size, so there was no dim and a tap above
a sheet did nothing, while web and jest looked fine. ESLint now bans it (use `StyleSheet.absoluteFill`). After any
React Native upgrade, check on a phone, and diff the names the app imports from `react-native` against its exports.

### Specific platform-divergent areas in this codebase
- **`expo-blur` `BlurView`** — rendering cost and visual intensity differ
  by platform. `Header.jsx` and `BottomNav.jsx` both gate their blur off
  while a modal is open for performance reasons; verify that optimization
  actually matters (or doesn't hurt) on Android too, not just iOS.
- **Gesture handling** (`react-native-gesture-handler` + Reanimated
  worklets in `StandardModal.jsx`) — drag-to-dismiss tuning
  (`activeOffsetY`, `failOffsetX`, spring parameters) was tuned entirely
  against iOS touch behavior. Re-verify on Android before assuming the
  same constants are correct there.
- **Safe area insets** — `useSafeAreaInsets()` values differ meaningfully
  between a notched iPhone, a non-notched Android device, and devices with
  gesture-navigation bars. Test layout-sensitive components (`Header.jsx`,
  `BottomNav.jsx`, `StandardModal.jsx`'s bottom padding) against more than
  one physical form factor before calling a layout fix "done."
- **Camera capture** for fridge/pantry scanning — `expo-camera` /
  `expo-image-manipulator` behavior (compression, orientation) is a common
  source of platform-specific bugs; don't assume an iOS-verified capture
  flow works identically on Android.

### Process
- When a UI/gesture/animation bug is fixed, note explicitly which
  platform(s) it was verified on. "Fixed" without a platform note defaults
  to meaning "iOS only" on this project today — say so rather than implying
  broader coverage than what was actually tested.

---

## AI Integration (Gemini)

### One client for every request (`src/services/geminiClient.js`)
- Nothing outside `geminiClient.js` may call `fetch` against Gemini, build a
  Gemini URL, read the API key, or hold a model name. Use `generateContent`
  (endpoint, `x-goog-api-key` header, one deadline covering connect + body),
  `resolveApiKey`, `buildGenerationConfig` (adds `thinkingConfig` only on
  models that accept it) and `parseModelJson` (strips ```json fences).
- The key goes in the header, never the URL: URLs end up in logs. When the
  key moves behind a backend proxy, `GEMINI_BASE_URL` and `authHeaders()` in
  that file are the only things that change.
- `geminiVision.js` / `geminiRecipes.js` keep the *what*: prompts, parsing,
  per-call retry policy and the safety filters.
- After any change to these files, a prompt, or the model lists, run
  `npm run test:live` (needs `EXPO_PUBLIC_GEMINI_API_KEY`; ~25 s, a few real
  requests). It runs every call path against the real API and fails if a path
  silently falls back instead of getting a 200. It is not part of CI.

### Model resilience (see roadmap issue #5)
- Gemini model versions get deprecated without much warning — this project
  has already broken in production because a hardcoded model (e.g.
  `gemini-2.0-flash-lite`) started returning 404. Always call through a
  candidate-model list (`VISION_MODELS` / `RECIPE_MODELS` in
  `geminiClient.js`) that falls through to the next model on failure — never
  a single hardcoded model with no fallback.
- Before assuming a scan/generation bug is a prompt or code problem, test
  the current candidate models directly with `curl` against the Gemini
  endpoint. This has repeatedly been the fastest way to distinguish "the
  model changed" from "the code is wrong."
- Keep the candidate list short (1–2 models). Every extra candidate is a
  full timeout window of latency in the worst case — resilience should
  come from a maintained, currently-correct list, not from trying many
  models per request.

### Timeouts and retries
- Every network call to Gemini goes through `generateContent`, whose
  `AbortController` deadline covers the response body as well as the headers —
  a bare `fetch()` has no timeout and will hang on a stalled connection far
  longer than acceptable.
- `expo-image-manipulator`'s `manipulateAsync` also has no built-in
  timeout — it's wrapped in `withTimeout`/`Promise.race` for the same
  reason. Any new native async call without a documented timeout guarantee
  should get the same treatment.
- On a real failure (not just a slow one), retry once with a short delay
  before surfacing an error to the user — confirmed via direct testing
  that Gemini's transient 503 "model overloaded" clears on a near-
  immediate retry most of the time. Don't retry indefinitely, and don't
  retry silently forever — surface a real error/toast if the retry also
  fails, rather than quietly returning an empty result.

### Prompt structure
- System prompts live as a single exported constant near the top of each
  service file (`MASTER_VISION_SYSTEM_PROMPT`, `GEMINI_RECIPE_SYSTEM_PROMPT`)
  — keep prompt logic here, not scattered inline in call sites.
- Dietary/allergy constraints are built as a guardrail block
  (`buildDietaryGuardrail`) that explicitly outranks the inventory lock —
  when adding a new hard constraint, follow this "guardrail overrides the
  default rule" pattern rather than trying to merge it into the base
  prompt.
- Always request `responseMimeType: "application/json"` and parse
  defensively (strip markdown fences, regex-extract the JSON array/object)
  — never assume the model's raw text is clean JSON.

### Validating output
- Never render raw model output directly. Every AI response goes through a
  normalization layer (`normalizeRecipe()`, the ingredient-array mapping in
  `geminiVision.js`) that enforces required fields, strips meta/invalid
  items (`isMetaIngredientName`), and provides safe fallbacks. Any new
  AI-backed feature must have an equivalent validation step before its
  output reaches UI state.
- When tuning prompt instructions (e.g. title length, step count), verify
  with a real generation against a real API key — prompt wording changes
  are easy to get subtly wrong and only show up in actual output, not in
  code review.
- Recipe batches also pass through an editor call
  (`reviewRecipesWithGemini`) that fixes doneness cues, salted-water
  amounts, incomplete ingredient lists, unavailable ingredients, broken
  methods and odd pairings in any language. The code-level checkers above
  only read English; the editor is what covers the other 30 languages.
  Judge quality changes with an independent model over a fixed set of
  inventories and languages, not by eyeballing one batch, and test with a
  key that has its own spending cap — a long evaluation once drained the
  app's production credits.

