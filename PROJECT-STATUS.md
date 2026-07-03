# spicy Feedback Tool — Project Status

> **Purpose:** living progress log. Read this at the start of every session to
> know exactly where we are and what to do next.
> **Rule:** update this file at the end of any session that changes the project.

---

## Current phase / next step

**Phase:** Phase 7 complete — AWS backend is live, local dev wired to it.
Ready for production GitHub Pages deploy + real admin password handoff.

**Resume here:**

1. **GitHub Pages deploy** — build the Angular app (`ng build`) and push
   `frontend/dist/spicy-feedback-tool/browser/` to the `gh-pages` branch.
   Configure Pages in the repo settings. Point CNAME `feedback.spicy-kunstraum.ch`
   to `<org>.github.io`.
2. **Real admin password** — Simon generates a bcrypt hash offline:
   ```
   node -e "import('bcryptjs').then(m => m.default.hash('REAL_PASSWORD', 10).then(console.log))"
   ```
   Then update the `simon` item in the `Admins` DynamoDB table with the new hash.
   (Current `test1234` hash is throwaway — never use in production.)
3. **End-to-end test on production URL** — QR code → survey → thank-you →
   admin login → exhibitions list → dashboard → CSV.

---

## Done

- [x] Repo structure created: `frontend/`, `backend/`, `terraform/`,
      `SPEC.md` at root.
- [x] `frontend/README.md` placeholder.
- [x] `backend/src/handlers/` — eight stub handler files (all throw
      `Not implemented`).
- [x] `backend/src/lib/dynamoClient.mjs` — DynamoDB Document Client wrapper
      (functional, just needs the package installed).
- [x] `terraform/providers.tf` — AWS + archive providers, Terraform ≥ 1.6.
- [x] `terraform/variables.tf` — region, environment, frontend_origin,
      jwt_secret_ssm_path, log_retention_days.
- [x] `terraform/main.tf` — all infrastructure defined (updated to nodejs22.x
      and esbuild dist packaging):
  - Three DynamoDB tables (Exhibitions, Responses, Admins).
  - Nine Lambda functions (8 handlers + authorizer), nodejs22.x / arm64.
  - CloudWatch log group per Lambda, 14-day retention.
  - Shared IAM execution role + DynamoDB policy.
  - API Gateway HTTP API (v2) with CORS.
  - `$default` stage, auto-deploy.
  - REQUEST-type Lambda Authorizer (JWT), payload v2.0, simple responses,
    300 s TTL.
  - Eight integrations + eight routes (3 public, 5 admin).
- [x] `terraform/outputs.tf` — api_url, table names.
- [x] SAM `backend/template.yaml` removed (replaced by Terraform).
- [x] `SPEC.md` updated and cross-audited — all routes, table schemas,
      authorizer config, SSM path, CORS origin confirmed consistent.
- [x] `backend/package.json` — runtime deps: `@aws-sdk/client-dynamodb`,
      `@aws-sdk/lib-dynamodb`, `bcryptjs`; dev dep: `esbuild`.
- [x] `backend/build.mjs` — esbuild script: bundles all 9 entry points (8
      handlers + authorizer) to `backend/dist/`, preserving directory structure.
      AWS SDK v3 is bundled (not external) because Node 22 Lambda runtime does
      not include it.
- [x] `backend/src/lib/jwtUtils.mjs` — implemented: `signToken` / `verifyToken`
      using Node native `crypto` (HS256, 7-day expiry, `timingSafeEqual`).
- [x] `backend/src/lib/validation.mjs` — implemented: `validateExhibition` /
      `validateResponse` with descriptive error messages safe to return as 400.
- [x] `backend/src/authorizer/index.mjs` — implemented: REQUEST-type Lambda
      Authorizer, extracts Bearer token, calls `verifyToken`, returns
      `{ isAuthorized: true/false }`.
- [x] `.gitignore` — excludes `backend/dist/`, `terraform/lambda.zip`,
      `.terraform/`, state files, `*.tfvars`, `node_modules/`.
- [x] **Admin area gets its own responsive container**, independent from the
      public survey's mobile-first `.page` (480px). New `.admin-page` class in
      `frontend/src/styles.scss` (`--admin-max-width: 1100px`, desktop-first,
      degrades to the same padding as `.page` on narrow viewports). Swapped
      into exhibitions-list, dashboard, and exhibition-edit templates only —
      login and all public screens (survey/thank-you/closed) untouched.
      Exhibition-edit additionally caps its own form width at 700px (inside
      the wider container) so single-column inputs don't stretch to 1100px.
      Dashboard bar charts get a taller fixed height (240px vs 180px) above
      640px so the extra width is actually useful. Verified with Playwright
      against the live dev server (login → exhibitions list → edit →
      dashboard) at 1280px (no horizontal scroll, Bearbeiten fully visible)
      and 375px (still usable, table scrolls horizontally as before).
- [x] **Dashboard chart redesign** (`admin/dashboard/dashboard.ts` + `.scss`) —
      admin-only, soft muted colour palette; public survey untouched
      (still strictly black/white). Chart type chosen per question's honesty,
      not decoration:
      - **Scale questions** (emotion, chili rating, distance, website ease,
        `vq_design`) → distribution bars, one calm soft-blue hue
        (`#5598e7`), with the bucket nearest the average picked out in a
        warm orange accent (`#eb6834`) — "emphasis," not a full rainbow.
        The `Ø` average number above the chart is coloured to match, so the
        two visual cues read as one.
      - **Multi-select checkbox questions** (`whatConvinces`, `visitorType`,
        `vq_highlights`) → horizontal bars, NOT pie/donut, because
        percentages don't sum to 100% (respondents can pick several
        options) — a pie there would misleadingly imply otherwise.
      - **No single-select (radio-style) questions exist anywhere in this
        app** — the `checkbox` question type is always multi-select
        (`checkbox-question.ts` toggles freely, no single-select
        constraint) — so no pie/donut is used anywhere on the dashboard.
      - Bars: 4px rounded data-end / square baseline, capped thickness
        (28px scale / 22px checkbox) per the skill's mark spec.
      - **Palette refined** after first pass looked like a "fruit salad"
        (unrelated saturated blue/green/violet/magenta). Now one calm
        soft-blue family runs through the *entire* dashboard: `#5598e7`
        for every scale distribution, `#6da7ec` (one step lighter, same
        hue) for every multi-select bar — same tone across all
        multi-select questions now, no more per-question colour rotation.
        The warm orange `#eb6834` is the dashboard's only accent, reserved
        exclusively for the scale charts' average-highlight, so it stays
        meaningful. Both blues are documented steps of the dataviz skill's
        sequential blue ramp, not eyeballed hex values.
- [x] **Dashboard header layout fix** — "CSV" and "← Zurück" were cramped
      together with no gap, and the back-arrow visually pointed at the CSV
      button, reading as one confusing group. Split them: "← Zurück" is now
      a standalone back-nav row (`.db__back-nav`) at the top-left, above the
      title; "CSV" stays alone on the right of the title/subtitle row. Same
      black/white styling and fonts, dashboard-only change. Verified at
      1280px and 375px.
- [x] **Fixed-question fidelity fix** — `FIXED_PAGES` in
      `frontend/src/app/shared/question-defs.ts` was paraphrased/drifted from
      Simon's canonical wording (shortened labels, invented `chiliRating`
      end-labels "mild"/"extrascharf 🌶" that don't exist in his doc, reworded
      questions, gender-neutral `:in`/`:r` option forms instead of his
      gendered forms). Rewritten to match his document 100% literally —
      exact wording, capitalisation, punctuation, hyphenation, gendered
      forms. `chiliRating` now has no end-labels at all (removed, not just
      reworded — none exist in the source). Structure (4 pages, 9 questions,
      all keys) was already correct; only text/labels/options changed, so
      `FIXED_QUESTION_KEYS` and downstream code needed no changes.
      **Mechanism note (matters for any future option-text edit):** checkbox
      answers are stored as the literal selected option *strings*, not
      indices/IDs (`checkbox-question.ts` toggle emits the option text
      itself; `postResponse.mjs`/`validation.mjs` store it as-is). The
      dashboard's checkbox aggregation (`dashboard.ts` ~line 151) builds its
      count map keyed by the *current* `question-defs.ts` option text and
      does `counts.has(opt)` against stored values — any old response whose
      stored text doesn't exactly match a current option is silently
      excluded from that chart's counts (not an error, just dropped from
      aggregation). CSV export is unaffected — it dumps stored array values
      raw via `join(' | ')`, no re-matching against `options`. The one
      seeded test exhibition's responses (if any use `whatConvinces` /
      `visitorType`) are stale relative to the new option text and are
      disposable per prior agreement — no migration performed.
- [x] **Survey back button** — `frontend/src/app/public/survey/` had no way
      to return to a previous page to fix an answer. Added `back()` in
      `survey.ts` (mirrors `next()`: clamps `currentPage` to a minimum of 1,
      scrolls to top). "Zurück" renders in `survey.html` only when
      `currentPage() > 1` (pages 2–4), on the left; "Weiter"/"Absenden" stays
      on the right — DOM order does the left/right placement, no extra
      layout logic needed. No data-loss risk: `answers` is a signal on the
      `Survey` component instance keyed by question key, untouched by page
      navigation — going back and forward just re-renders `pageQuestions()`
      for the new `currentPage`, and each question component receives its
      existing value back via `getScaleAnswer`/`getCheckboxAnswer`/
      `getTextAnswer` reading from that same `answers` map. `.nav-row`
      switched from a single full-width block button to a flex row
      (`gap: 0.75rem`); both `.btn-primary` and new `.btn-secondary` use
      `flex: 1`, so a lone button (page 1) still fills the row exactly as
      before, and two buttons split it 50/50 — verified this fits without
      overflow down to ~360px content width (400px viewport minus page
      padding), no stacking needed. `.btn-secondary` is the outlined/lighter
      secondary style (white bg, black border+text, `:hover` fills
      `--color-border`) vs. `.btn-primary`'s solid black-on-white — same
      black/white system, no new colours introduced.
- [x] **Chili rating component** — new `shared/chili-question/` component,
      used only for `chiliRating` (public survey). `survey.html`'s
      `@case ('scale')` branches on `q.key === 'chiliRating'` to render
      `<app-chili-question>` instead of the normal `<app-scale-question>`;
      every other scale question (`emotionExhibition`, `distanceTravelled`,
      `websiteEase`, any variable scale question) is untouched. Data model
      unchanged — still emits/reads a plain number 1–5 via the same
      `getScaleAnswer`/`setAnswer(q.key, …)` path, so the dashboard's scale
      aggregation and CSV export needed zero changes.
      Behaviour: pristine state shows plain numbers 1–5 (`touched()` false
      when nothing hovered and no value committed yet); on desktop,
      `mouseenter` per box sets a local `hoverValue` signal for a live
      preview-fill, `mouseleave` on the track clears it back to the
      committed value; the emitted `valueChange` on click commits exactly
      like `ScaleQuestion`. On touch there's no hover event, so a tap goes
      straight to `select()` and the committed value renders immediately —
      same code path, no touch-specific branching needed.
      Uses the 🌶️ emoji directly (no SVG) — filled positions get no colour
      override (the glyph is natively red), unfilled positions beyond the
      hovered/selected value get `filter: grayscale(1); opacity: 0.4` so
      only the filled ones read as red. This is the one intentional colour
      exception on the public survey — everything else stays black/white
      (matches Simon's own 🌶️🌶️🌶️🌶️🌶️ in his document).
      Boxes sized `height: 56px` with `flex: 1 1 0` — with only 5 steps
      (vs. 11 on a normal scale) each box comes out to roughly 68px wide at
      360px content width, well past the 44px touch-target minimum.
- [x] **Distance slider (`distanceTravelled`)** — replaced the numeric
      0–10 scale with a real labelled-category slider. `QuestionDef.type` in
      `question-defs.ts` gained a fourth variant, `'slider'` (distinct from
      `'scale'`), and `distanceTravelled` is now defined as
      `{ type: 'slider', options: ['20m','500m','2km','5km','10km','25km',
      '50km','100km','200km'] }` — no more `min`/`max`/`labelMin`/
      `labelMax`. `VariableQuestion.type` (admin-created questions) was
      **not** widened — sliders are fixed-question-only, admins still only
      get scale/checkbox/text.
      **Stored value shape — confirmed:** the field now stores the
      selected stop's **label string** (e.g. `"5km"`), not a number. This
      required zero backend changes: `fixedAnswers`/`variableAnswers` are
      `Record<string, unknown>` end-to-end (`api.ts`), and
      `validateResponse` in `backend/src/lib/validation.mjs` never deep-
      validates fixed-answer value types by design (fixed questions are
      frontend-only, comment already says so) — `postResponse.mjs` stores
      whatever shape it's given, and `exportResponsesCsv.mjs` stringifies
      generically (`String(val)`), so CSV already prints `"5km"` correctly
      with no changes there either.
      New `shared/distance-slider/` component (public survey only), wired
      into `survey.html` via a new `@case ('slider')` next to scale/
      checkbox/text — `survey.ts` gained `getSliderAnswer()` (mirrors
      `getScaleAnswer`/`getCheckboxAnswer`/`getTextAnswer`, one accessor
      per question type). Built on a native `<input type="range" min="0"
      [max]="8" step="1">` (index into the 9-label array) rather than a
      custom pointer-drag implementation — gets free native drag AND
      tap-anywhere-on-track-to-jump behaviour on both desktop and mobile
      with zero extra code, and integer steps space themselves evenly by
      construction (no manual math needed for "evenly spaced, not linear
      by real distance"). No `<datalist>` is bound, so no tick marks render.
      The native track is fully transparent; a `.ds__rail` (grey, full
      width) + `.ds__fill` (black, width = current index / max index) pair
      absolutely-positioned underneath draw the visible minimal bar, and
      only the thumb is styled (`::-webkit-slider-thumb` /
      `::-moz-range-thumb`, 28px circle) — sized well past the 44px touch
      minimum, input height itself is 44px for a large vertical hit area.
      Current stop label renders prominently above the track
      (`.ds__current`, Comfortaa, 1.4rem) and updates on every native
      `input` event during a drag — muted grey until first interaction,
      black once `touched()`, matching the same pristine-vs-touched visual
      language used by the chili component, so an unanswered slider doesn't
      visually read as already-answered. A local `localIndex` signal drives
      the fill bar / label directly from each `input` event rather than
      waiting on the round-trip through the parent's `value` input — matters
      here specifically because a drag fires many rapid `input` events, not
      one click like the other question types.
      **Dashboard:** `dashboard.ts`'s `QuestionEntry.entryType` gained
      `'slider'`; `aggregateQuestion()` got a new branch that counts exact
      string matches against `q.options` (same technique as the checkbox
      branch, but for a single string value per response instead of an
      array) and renders a **vertical** bar chart in the options' natural
      order (20m → 200km) — reuses `scaleChartOptions()` for the same
      look as every other distribution chart, but with **no average**
      (`entryType 'slider'` has no `average` field — averaging category
      labels is meaningless). `dashboard.html` got a matching
      `@case ('slider')`, same `chart-wrap--bar` fixed-height container as
      scale charts. The numeric 0–10 rendering path for every other scale
      question (`emotionExhibition`, `chiliRating`, `websiteEase`, any
      variable scale question) is completely untouched.
- [x] **Distance slider — continuous drag + 13 stops.** Two follow-up
      changes to `distance-slider.ts`/`.html`:
      1. **Smooth glide, snapped storage.** The native `<input type="range">`
         switched from `step="1"` (which quantized the thumb itself to only
         9, now 13, discrete pixel positions — the "harsh snapping" being
         fixed) to `step="any"`, so the thumb now moves continuously,
         1:1 with the pointer/finger, across the full track. A new
         `currentRaw` computed holds that continuous float position
         (`[0, maxIndex]`); a separate `nearestIndex = Math.round(currentRaw)`
         is what actually gets displayed (`currentLabel`) and stored
         (`valueChange.emit(options[nearestIndex])`) — so the handle glides
         freely but the saved answer is always exactly one of the defined
         stop labels, snapping to the nearest one in real time as you drag.
         The `.ds__fill` bar intentionally tracks `currentRaw` (not the
         snapped index) so it stays visually glued to the native thumb's
         actual continuous position — if it tracked the snapped index
         instead, the custom fill bar and the real (smooth) thumb would
         visibly disagree mid-drag. `step="any"` also means arrow-key
         input falls back to the browser's default increment of 1 — i.e.
         keyboard users still move exactly one stop per press, continuous
         dragging is a pointer-only concern.
      2. **13 stops, not 9.** `question-defs.ts`'s `distanceTravelled`
         options replaced with the new exact list, in order: `20m, 500m,
         1km, 3km, 5km, 10km, 25km, 50km, 75km, 100km, 150km, 200km,
         200km+`. No other code changed for this — `maxIndex` is derived
         from `options().length`, and the dashboard's slider aggregation
         branch (`dashboard.ts`) already counts against `q.options`
         generically, so it picked up the new 13-label set with zero
         changes. Bar chart still renders in this natural stop order
         (20m → 200km+), still no average, still black/white.
- [x] **Chili golden shimmer on commit.** `chili-question.ts`/`.html`/`.scss`
      only — public survey, chili rating question only, nothing else touched.
      On `select()` (tap/click commit, not hover-preview), all currently-
      filled chilies (1..N) play a single 2s gold glow-in/glow-out, then
      settle back to their normal red state automatically.
      **CSS-only animation, minimal JS:** the component's JS does exactly
      two things on commit — flips a `shimmerParity` signal (`0`/`1`) and
      sets `shimmerActive = true`. No JS timers of any kind; the 2s
      lifecycle (start, peak, end, revert) is entirely CSS (`animation:
      … 2s ease-in-out`, default `iteration-count: 1`), which naturally
      "settles back" on its own without any JS needing to remove a class
      afterward — because the keyframes return to `filter: none` at 100%
      and there's no `animation-fill-mode: forwards`, the box's computed
      style reverts to its normal (non-animated) rule the instant the
      animation ends.
      **Two identical keyframes (`chq-shimmer-0` / `chq-shimmer-1`), not
      one:** a browser only replays a CSS animation when `animation-name`
      actually *changes* value — re-applying the same name while an
      animation is already assigned is a no-op. Reselecting the same chili
      count, or changing it, mid-animation both need to restart the glow,
      so `select()` always flips `shimmerParity` and the template binds
      `[style.animation-name]` to `chq-shimmer-{parity}` — guaranteed to
      differ from whatever was there a moment ago, forcing a genuine
      restart in both cases, "for the new set" simultaneously since all
      filled boxes read the same parity value at once.
      **Shimmer only from a real select() in this instance — never on
      mount:** a naive `step <= displayValue()` check (used for the plain
      fill/empty classes, which *should* reflect an already-answered value
      on mount, e.g. navigating back to this question) would also make the
      shimmer replay just from remounting an already-answered question.
      Guarded with a separate `shimmerActive` signal, `false` by default,
      flipped `true` only inside `select()` — so the golden glow is strictly
      an explicit user action, never a side effect of restoring saved state.
      Also gated off hover: `shimmerNameFor(step)` checks the *committed*
      `value()`, not `displayValue()` (which mixes in hover preview), so
      hovering across boxes on desktop never triggers gold, only an actual
      click/tap does.
      **Gentle glow, not a strobe:** single `ease-in-out` hump
      (0% → 50% → 100%, `filter: none` → hue-rotate/saturate/brightness +
      gold `drop-shadow` → `filter: none`) over the full 2s — one smooth
      pulse, not a flicker.
      **`prefers-reduced-motion` respected:** `animation-duration` /
      `animation-timing-function` are declared only inside
      `@media (prefers-reduced-motion: no-preference)`; with no duration
      set anywhere else, a 0s animation resolves instantly to its end state
      (`filter: none`, i.e. normal red) — reduced-motion users get the
      correct final state with no visible glow at all, no separate code
      path needed.
      Colour stays scoped to the emoji glyph via `filter` (same technique
      as the existing grayscale-empty state) — no `color`/`background`
      change anywhere, so the gold is the only colour exception on the
      chili question and the rest of the black/white survey is untouched.
- [x] **Unified responsive width system — survey widened from 480px, two
      shared width tiers across the whole app.** The public survey was
      stuck at the mobile-only `--max-width: 480px` even on desktop, while
      the admin area had its own separate `--admin-max-width: 1100px` plus
      `exhibition-edit` had a *third*, component-local `max-width: 700px`
      — three inconsistent widths. Replaced with exactly two CSS custom
      properties in `styles.scss`, used everywhere:
      `--width-wide: 1100px` (content that should spread on desktop —
      public survey, admin exhibitions list, admin dashboard) and
      `--width-form: 700px` (single-column forms/short centred messages —
      login, exhibition-edit, closed, thank-you). `--max-width` and
      `--admin-max-width` are gone; nothing in the app defines its own
      max-width anymore.
      **One shared `.page` shell, not two.** `.admin-page` was deleted;
      `.page` now defaults to `--width-form` and gets a `.page--wide`
      modifier for the wider tier. Every template updated to pick one:
      `survey.html` → `page page--wide`; `exhibitions-list.html` /
      `dashboard.html` → `page page--wide`; `exhibition-edit.html` → `page`
      (its old local `max-width: 700px; margin: 0 auto;` in
      `exhibition-edit.scss` was deleted — redundant now that `.page`
      itself provides exactly that). `login.html` / `closed.html` /
      `thank-you.html` already used plain `.page` and needed no template
      change, just inherited the new default width and a slightly larger
      desktop padding step (see below) they didn't have before.
      **Still genuinely responsive, not a fixed width:** `.page` is
      `width: 100%; max-width: var(--width-form|wide); margin: 0 auto;
      padding: var(--page-padding)`, with `padding: 2rem 2.5rem` from
      `min-width: 640px` — the same breakpoint value already used
      elsewhere in the app (e.g. the dashboard's chart height bump). Above
      the cap, content stops growing and centers with empty space either
      side; between mobile and the cap, `width: 100%` means it simply
      shrinks to fit with no forced minimum and no overflow; at mobile
      width it's the same small-padding full-bleed layout the survey
      always had — one rule set, no separate mobile-only styles needed.
      **Survey desktop nav-row — buttons separated to opposite edges, not
      stretched to fill.** Below 640px, `.btn-primary`/`.btn-secondary`
      keep the existing mobile behaviour exactly (`flex: 1`, 50/50 fill).
      At `min-width: 640px` they switch to `flex: 0 0 auto; min-width:
      200px` (content-sized, not stretched) and `.btn-primary` gets
      `margin-left: auto` — this pushes it to the far right whether it's
      alone (page 1, no `.btn-secondary` sibling) or paired with
      `.btn-secondary` (which has no auto margin, so it stays pinned at
      the far left) — one rule handles both the 1-button and 2-button
      cases without the template needing to know which. `survey.scss`'s
      pre-existing `.page { padding-top: calc(var(--page-padding) +
      0.5rem) }` override (progress-bar clearance) is untouched and still
      wins on that one property via Angular's per-component style scoping;
      it doesn't fight the new shared left/right/bottom padding.
      Scale boxes (`scale-question.scss`) needed no changes at all — they
      were already `flex: 1 1 0` filling their track, so widening the
      parent container to `--width-wide` on desktop is what makes them
      spread across the width; the box markup/height is unchanged.
      **Verified with Playwright** (no dedicated project run-skill exists
      yet for this repo) against the live dev server at 1920×1080,
      800×1000, and 375×812: `document.documentElement.scrollWidth` vs.
      `clientWidth` checked (no horizontal scroll) on the survey (both
      page 1 and page 2, to exercise both the 1-button and 2-button
      nav-row case), login, exhibitions list, dashboard, and
      exhibition-edit at all three sizes — all clean, zero console errors.
      Screenshots confirm: desktop survey shows Zurück far left / Weiter
      far right with a wide gap, scale boxes 0–10 spread edge-to-edge;
      exhibitions-list/dashboard cap at 1100px with visible side margin at
      1920px and shrink cleanly at 800px; exhibition-edit/login cap at the
      narrower 700px form width at both sizes; the admin table's existing
      internal horizontal scroll (`.al__table-wrap { overflow-x: auto }`)
      at 375px is unchanged/expected, contained to the table only. Public
      survey remains strictly black/white — only widths and button
      layout changed, no colour was introduced.
- [x] **Public survey — hover/press interaction polish.** CSS-only, no
      logic changes; public survey components + global styles only
      (`styles.scss`, `scale-question.scss`, `checkbox-question.scss`,
      `chili-question.scss`, `survey.scss`). State changes were previously
      instant (nothing → solid-black selected, no in-between), which read
      as unpolished next to reference surveys' discreet transitions.
      Two new shared CSS custom properties in `styles.scss`:
      `--color-hover-bg` (`#f2f2f2`, soft grey) and `--color-hover-border`
      (`#999999`, darker than the default `#cccccc` border) — reused
      identically by scale boxes, checkbox cards, and chili boxes so the
      "about to commit" feel is one consistent in-between state across all
      three question types, still strictly greyscale (no accent colour
      added). `--color-btn-primary-hover` (`#2c2c2c`) is button-only: the
      primary button's resting background is already near-black
      (`--color-text`, `#111111`), so literally "darkening" further isn't
      visible — hover instead lifts to this dark grey and `:active` sinks
      back to the true-black resting colour, which reads as press feedback
      without introducing a lighter/louder hover colour.
      **Hover vs. active split to avoid sticky-hover on touch:** every
      hover rule is wrapped in `@media (hover: hover)` so it only applies
      on devices with a real pointer; `:active` (not `:hover`) carries the
      equivalent feedback for touch, using the *same* hover values — so
      mobile taps never leave a stuck grey state after lifting a finger
      (a plain `:hover` would otherwise "stick" until the next tap
      elsewhere, which is the classic mobile-hover bug). Buttons use
      `:hover:not(:disabled)` / `:active:not(:disabled)` since disabled
      already owns the dimmed-opacity look.
      Transitions bumped from the prior ad hoc `0.1s`/none to a consistent
      `0.15s ease` across `background`, `border-color`, `color`, and (chili
      only) `filter`/`opacity` — the filter/opacity addition is what makes
      a chili glide smoothly from grey-desaturated-empty into full-colour-
      filled as the hover position moves, instead of the previous hard
      instant switch.
      **`prefers-reduced-motion` handled globally, once** — a single
      `@media (prefers-reduced-motion: reduce)` block added to
      `styles.scss`'s reset section forces
      `transition-duration`/`animation-duration` to `0.01ms` and
      `animation-iteration-count: 1` on `*`, rather than repeating the
      media query in every component file; verified via Playwright with
      `page.emulateMedia({ reducedMotion: 'reduce' })` that computed
      `transitionDuration` collapses to effectively zero.
      Verified end-to-end with a scripted Playwright session against the
      live dev server (`localhost:4200` — CORS only allows this origin,
      not arbitrary dev ports) driving real hover/click sequences:
      scale-box hover → soft grey + darker border → solid-black on select;
      checkbox-card hover → same soft grey → solid-black on select;
      chili-box hover/select → smooth fill transition; primary button
      hover → `#2c2c2c`, confirmed via computed styles and screenshots.
      No console errors. Admin panel, dashboard, and every other public
      screen untouched.
- [x] **Chili golden shimmer removed.** Wasn't rendering when tested live
      (debugging traced it to a transient compile error mid-edit — the
      dev-server bundle itself checked out correct afterward), and it was
      judged not worth the added complexity for a purely decorative detail.
      Fully reverted `shared/chili-question/` to its pre-shimmer state:
      removed `shimmerActive`/`shimmerParity`/`shimmerName`/
      `shimmerNameFor` and the parity-toggling from `select()` in
      `chili-question.ts`; removed the `[style.animation-name]` binding
      from `chili-question.html`; removed the `@keyframes chq-shimmer-0`/
      `chq-shimmer-1` and the `@media (prefers-reduced-motion)` block (it
      existed only to gate the shimmer's duration) from
      `chili-question.scss`. Kept the `isFilled(step)`/`isEmpty(step)`
      helper methods — they're not shimmer-specific, just the plain fill-
      state logic the shimmer had piggybacked on. Everything else is
      unchanged: numbers turn into filled red 🌶️ on select, hover-preview
      on desktop, tap-to-select on mobile, stored value is still a plain
      number 1–5. Verified `tsc --noEmit` clean and confirmed directly
      against the dev server's freshly rebuilt bundle that zero `shimmer`
      references remain.

---

## In progress

- [ ] **GitHub Pages deploy** — push dist to gh-pages branch, configure CNAME.
- [ ] **Real admin password** — Simon replaces test1234 hash in Admins table at handoff.

---

## To do

Roughly in the order from SPEC.md § 12:

### Backend foundation
- [x] `backend/package.json` with runtime deps and esbuild build script.
- [x] Implement `jwtUtils.mjs` (sign / verify, HS256, 7-day expiry, native crypto).
- [x] Implement `validation.mjs` (exhibition shape, response shape).
- [x] Implement `authorizer/index.mjs` (verify JWT → simple response).

### Public endpoints (step 2)
- [x] `getActiveExhibition.mjs` — scans Exhibitions, applies date logic, returns
      `{ status: 'active'|'closed'|'none', ... }` per spec § 10.
- [x] `postResponse.mjs` — validates body, confirms exhibition is active (409 if
      not), writes to Responses table with `responseId = "<unix-ms>_<uuid-prefix>"`.`

### Public survey frontend (step 3)
- [x] Angular 21 project initialised in `frontend/` (standalone, hash routing,
      SCSS, `@angular/build:application` builder).
- [x] Google Fonts: Comfortaa + Work Sans loaded via `<link>` in `index.html`.
- [x] Mobile-first global styles in `src/styles.scss` (`--max-width: 480px`,
      CSS custom properties for colours and fonts, `.page` layout shell).
- [x] `src/app/core/services/api.ts` — `Api` service with `getActiveExhibition`,
      `submitResponse`, and `login` stubs; typed response interfaces.
- [x] `src/app/core/interceptors/auth-interceptor.ts` — functional JWT interceptor
      (reads `spicy_admin_jwt` from sessionStorage, adds `Authorization: Bearer`).
- [x] All routed component shells generated (empty):
      `Survey`, `ThankYou`, `Closed`, `Login`, `ExhibitionsList`,
      `ExhibitionEdit`, `Dashboard`.
- [x] `src/app/app.routes.ts` — hash routing, all public + admin routes wired
      with `loadComponent` / `loadChildren` lazy loading.
- [x] `src/app/admin/admin.routes.ts` — admin child routes (login, exhibitions
      list, create/edit, dashboard).
- [x] `src/environments/environment.ts` + `environment.development.ts` —
      `apiBaseUrl` placeholder; `ng generate environments` wired `fileReplacements`
      in `angular.json`.
- [x] Three shared question components: `scale-question`, `checkbox-question`,
      `text-question`. Scale takes `min`/`max`/`labelMin`/`labelMax` as inputs
      (no hardcoded 0–10); boxes flex-fill the row so any range fits on 400px.
- [x] Four-page survey flow with fixed progress bar at top. Variable questions
      appended to page 1 (exhibition-specific context). Status branching:
      'closed' → /closed (router state), 'none' → inline message, 'active' → flow.
- [x] Thank-you screen (German copy, Comfortaa heading).
- [x] Closed screen (reads lastExhibition from `window.history.state`,
      formats end date in de-CH locale).

### Admin auth + admin endpoints (step 4)
- [x] `login.mjs` — GetCommand on Admins by username, bcrypt.compare, signToken.
- [x] `listExhibitions.mjs` — parallel Scan Exhibitions + projected Scan Responses
      (PK only); merges responseCount onto each exhibition.
- [x] `createExhibition.mjs` — validateExhibition, `exhibition_<timestamp>` id, PutCommand.
- [x] `updateExhibition.mjs` — validateExhibition, UpdateCommand with
      `ConditionExpression: attribute_exists(exhibitionId)` → 404 if missing.
      Uses `#n` alias for `name` (DynamoDB reserved word).
- [x] `listResponses.mjs` — QueryCommand by exhibitionId PK.
- [x] `exportResponsesCsv.mjs` — parallel Get exhibition + Query responses;
      fixed columns in spec order + one column per variable question (header =
      question text); array values joined with ` | `; RFC 4180 cell escaping.

### Admin panel (step 5)
- [x] Auth guard (`core/guards/auth.guard.ts`) — checks sessionStorage JWT;
      redirects to /admin/login if absent. Applied to all admin routes except login.
- [x] `AdminExhibition` + `ExhibitionPayload` types; `listAdminExhibitions`,
      `createAdminExhibition`, `updateAdminExhibition` added to `Api` service.
- [x] Login screen — FormsModule + ngModel, 401 vs network error messages.
- [x] Exhibitions list — sorted (active → upcoming → finished), status badges
      (solid/outlined/muted), active row highlighted, responseCount column,
      Edit passes exhibition via router state to avoid extra fetch.
- [x] ExhibitionEdit — ReactiveFormsModule + FormArray for variable questions.
      Create and edit modes share the same component (route param `id` present =
      edit). Type-selector shows scale config (min/max/labels) or checkbox options
      textarea (one option per line). Falls back to list fetch on direct URL access.

### Dashboard + CSV (step 6)
- [x] `chart.js@4.5.1` installed. ng2-charts skipped — it requires Angular 22+;
      thin `BarChart` wrapper component (`shared/bar-chart/bar-chart.ts`) manages
      the Chart.js instance lifecycle directly (AfterViewInit → create, OnDestroy → destroy).
- [x] `shared/question-defs.ts` extracted — `QuestionDef`, `PageDef`, `FIXED_PAGES`,
      `FIXED_QUESTION_KEYS`, `mapVariableQuestion` shared by survey and dashboard.
- [x] `ResponseRecord` type + `listResponses` + `exportCsv` added to `Api` service.
- [x] Dashboard: `forkJoin` loads exhibition (router state fast-path or list fetch) +
      responses in parallel. Aggregates per question: scale → bar chart + Ø average;
      checkbox → horizontal bar chart with count/% tooltip; text → scrollable list.
      Empty-state handled. CSV button triggers blob download (works with auth header).

### Final wiring (step 7)
- [x] Angular routing for GitHub Pages — hash routing (`withHashLocation()`) already in place.
- [x] CORS — `https://feedback.spicy-kunstraum.ch` locked in `variables.tf`; `http://localhost:4200`
      also added for local dev.
- [x] `terraform apply` — 52 resources created in `eu-central-1` (Frankfurt).
      API URL: `https://q72698iyz6.execute-api.eu-central-1.amazonaws.com/`
- [x] Both environment files (`environment.ts` + `environment.development.ts`) set to real API URL.
- [x] esbuild format fixed: changed `format: 'esm'` → `format: 'cjs'` in `backend/build.mjs`.
      (ESM `.js` output caused `SyntaxError: Cannot use import statement outside a module` on Lambda.)
- [x] Admin user `simon` seeded in Admins table (temporary `test1234` hash — replace at handoff).
- [x] Test exhibition `exhibition_1782994642831` seeded in Exhibitions table:
      "Testausstellung 1", 2026-07-02 → 2026-08-01, three variable questions
      (scale 1–5, checkbox×4, text).
- [x] JWT secret stored in SSM Parameter Store at `/spicy/jwt-secret` (SecureString, eu-central-1).
- [ ] GitHub Pages deploy + CNAME.
- [ ] Real admin password set.

---

## Key decisions log

| Decision | Choice | Reason |
|---|---|---|
| IaC | **Terraform** (not AWS SAM) | Consistency with developer's other projects |
| API Gateway | **HTTP API v2** (not REST API v1) | Consistency; lower cost; simpler routing |
| Auth | **Lambda Authorizer, REQUEST type** | Decouples JWT logic from handlers; one place to change |
| Authorizer response | **Simple response** (`isAuthorized` bool, payload v2.0) | Cleaner than IAM policy documents for HTTP API |
| JWT secret storage | **SSM Parameter Store** (`/spicy/jwt-secret`) | Never in source or env literals in Terraform |
| JWT algorithm / expiry | **HS256, 7 days** | Admins log in rarely; symmetric key is fine for single-tenant |
| Password hashing | **bcrypt** | Spec requirement |
| Frontend | **Angular SPA** → GitHub Pages | Spec requirement; client already on GitHub |
| Angular routing for GH Pages | **Hash routing** (`/#/route`, `withHashLocation()`) | Visitors arrive via QR code (root URL only); no SEO need; zero-config vs 404.html redirect hack |
| Angular version | **Angular 21** (CLI 21.1.5) | Latest stable; uses standalone components, `@angular/build:application` (esbuild) |
| DB | **DynamoDB on-demand** (PAY_PER_REQUEST, no GSIs) | Free tier covers ~400 responses/year; no capacity planning |
| Lambda packaging | **esbuild bundles each handler** → `backend/dist/` → ZIP | AWS SDK v3 must be bundled; esbuild output is smaller than including all of `node_modules` |
| Lambda runtime | **Node.js 22.x, arm64** | Upgraded from 20.x for consistency with developer's other projects |
| JWT implementation | **Node native `crypto`** (no `jsonwebtoken` lib) | Consistent with developer's other projects; HS256 is straightforward to implement natively |
| IAM | **Single shared execution role** | Acceptable for this scale; all functions need the same tables |
| Log retention | **14 days** | Enough for debugging; avoids unbounded CloudWatch cost |
| Active-exhibition logic | **Derived from dates at request time** (not a manual toggle) | Prevents forgotten-toggle failure mode (spec § 10) |
| Variable questions | **Embedded in the Exhibition item** (not a separate table) | Always read together; simplifies queries |
| Fixed questions | **Frontend-only** (not stored in DB, not editable in admin) | Spec requirement § 6 |
| Language | **English** (all routes, fields, table names, code) | Spec requirement; German only for question wording in UI |

---

## Notes / gotchas

- **Build before deploying.** Run `npm install && npm run build` in `backend/`
  before `terraform plan/apply`. The Terraform `archive_file` zips
  `backend/dist/` (esbuild output), not `backend/src/`. Without the build step,
  Terraform will error because `dist/` doesn't exist.

- **Node.js 22 does NOT bundle AWS SDK v3.** This is handled: esbuild bundles
  the AWS SDK into each handler file, so no `node_modules` is needed in the ZIP.

- **SSM parameter** — already created at `/spicy/jwt-secret` (SecureString, eu-central-1).
  To rotate: `aws ssm put-parameter --name /spicy/jwt-secret --value "<new-secret>" --type SecureString --overwrite --region eu-central-1`
  then `terraform apply` to push the new value into Lambda env vars.

- **`terraform/lambda.zip` should be in `.gitignore`** — it is a build
  artifact produced by `terraform plan/apply`, not source.

- **First-time Terraform init:** run `terraform init` inside `terraform/`
  before plan/apply. No remote backend is configured yet; state is local.
  Consider adding an S3 backend before the first real deploy.

- **Admin user** — `simon` is seeded with a temporary `test1234` hash.
  Replace at handoff: generate hash offline with bcryptjs (rounds=10), then
  update the item in the `Admins` table via the AWS console or CLI.
  The app has no self-registration flow by design (spec § 9.1).

- **CORS** is currently set to `https://feedback.spicy-kunstraum.ch`. During
  development, override with `terraform apply -var='frontend_origin=*'` or
  add a `staging` tfvar file — do not commit a wildcard origin to the default.

- **GitHub Pages routing:** Angular must use hash routing (`#/`) or include a
  `404.html` that redirects to `index.html`, otherwise deep links return 404
  on reload (spec § 12).

- **Data region:** default is `eu-central-1` (Frankfurt) — closest to
  Switzerland, satisfies GDPR/DSGVO locality requirement (spec § 12).
