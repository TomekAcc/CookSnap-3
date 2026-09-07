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
- Theme colors always come from `useTheme()`'s `colors` object, with an
  explicit fallback (`colors.card || "#FFFFFF"`) — never hardcode a color
  that should adapt to dark mode.

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

## Testing

### Current state of the art here (be honest about it)
There is no automated unit/integration test suite for this app yet. Testing
today is: (1) a Playwright-driven web smoke test for crash-level JS bugs,
and (2) manual on-device verification through Expo Go. Don't claim a change
is "tested" unless one of these actually ran.

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
- `EXPO_PUBLIC_GEMINI_API_KEY` and any other key lives only in `.env`
  (gitignored). Never hardcode a key in source, never print one in full to
  a terminal or log, never commit `.env`.
- Because this is an `EXPO_PUBLIC_*` variable, it ships inside the client
  bundle and is not truly secret from a determined attacker — treat key
  rotation as a real, periodic task, not a one-time setup step, and don't
  add anything more sensitive than a rate-limited AI API key to the
  `EXPO_PUBLIC_*` namespace.
- If a key is ever suspected exposed (posted in a log, a screenshot, a
  shared zip), rotate it — don't just delete the local reference.

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
- This project pulls from `generativelanguage.googleapis.com` directly
  from the client. Don't introduce a second AI provider or a proxy
  endpoint without checking it under the same scrutiny (timeout handling,
  key exposure, response validation).

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
- `app.json`'s `updates.url` and `runtimeVersion: "exposdk:54.0.0"` must
  stay in the classic SDK-string format for updates to open directly in
  Expo Go — the `{"policy": "appVersion"}` format only targets standalone/
  custom builds and will NOT work for Expo Go testing.
- Publish to the `preview` branch (`eas update --branch preview`) for all
  testing. Don't create new branches ad hoc without a reason — it
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
There is no CI and no standalone signed build yet. "Shipping" today means:
1. Edit source in `src/`.
2. Bump the version marker (see `versioning.md`).
3. `export EXPO_TOKEN=... && eas update --branch preview --message "..."`.
4. Confirm on a real device via Expo Go.

There is no automated gate between a code change and it reaching a real
user's phone. Treat that as a real risk, not a convenience — run the web
smoke test (`testing.md`) before every publish that touches shared code,
since nothing else will catch a crash before it ships.

### Before this project has real CI
- Any pre-publish check that CAN run without a full CI system should run
  manually every time: `node --check` / a Babel parse check on changed
  `.js`/`.jsx` files, and the web smoke test for shared-component changes.
- Don't skip these checks "just this once" because a change looks small —
  several real bugs shipped in this project were exactly the kind that
  looked too small to bother checking.

### When CI is built (roadmap item #2 groundwork)
- The web smoke test is already structured to be CI-runnable
  (`scripts/web-smoke-test.js`, exits non-zero on failure) — wire it into
  a GitHub Actions workflow on push/PR before building anything more
  elaborate.
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

### Model resilience (see roadmap issue #5)
- Gemini model versions get deprecated without much warning — this project
  has already broken in production because a hardcoded model (e.g.
  `gemini-2.0-flash-lite`) started returning 404. Always call through a
  candidate-model list (`candidateModels` in `geminiVision.js`,
  `CANDIDATE_MODELS`/`buildCandidateUrls` in `geminiRecipes.js`) that falls
  through to the next model on failure — never a single hardcoded model
  with no fallback.
- Before assuming a scan/generation bug is a prompt or code problem, test
  the current candidate models directly with `curl` against the Gemini
  endpoint. This has repeatedly been the fastest way to distinguish "the
  model changed" from "the code is wrong."
- Keep the candidate list short (1–2 models). Every extra candidate is a
  full timeout window of latency in the worst case — resilience should
  come from a maintained, currently-correct list, not from trying many
  models per request.

### Timeouts and retries
- Every network call to Gemini goes through `fetchWithTimeout` (an
  `AbortController`-based wrapper) — a bare `fetch()` has no timeout and
  will hang on a stalled connection far longer than acceptable.
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

