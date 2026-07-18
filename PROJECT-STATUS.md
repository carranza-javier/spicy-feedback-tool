# spicy Feedback Tool — Project Status

> **Purpose:** living progress log. Read this at the start of every session to
> know exactly where we are and what to do next.
> **Rule:** update this file at the end of any session that changes the project.

---

## Current phase / next step

**Phase:** Question-system redesign complete and verified live against AWS
(terraform applied, templates seeded, full e2e pass done). Ready for
production GitHub Pages deploy + real admin password handoff.

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
4. **Create the real exhibition(s) through the admin panel** — the
   `Exhibitions`/`Responses` tables currently hold **demo data only** (see
   `backend/scripts/seed-demo.mjs` below), not a real exhibition. Before
   going live, re-run `node backend/scripts/seed-demo.mjs` one last time (or
   just delete the 5 `exhibition_demo_*` items) to clear the demo state, then
   create Simon's first real exhibition through "+ Neu" so its question list
   is populated from the current templates.

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
- [x] **Repo pushed to GitHub — version control established.** Previously
      the whole project only existed as a local working directory with no
      git history. Ran a security check before anything was committed:
      audited `.gitignore` against Terraform state/vars/crash-logs, Node
      `node_modules`/build output, and secrets — found `frontend/dist/`
      and `frontend/.angular/` were **not** covered (only `backend/dist/`
      was), and there was no `.env`/`.pem`/`.key` rule at all. Patched
      `.gitignore` to close those gaps before running `git init`. Verified
      with `git add -A -n` (dry run) that none of the sensitive/build
      paths appeared in what would be staged, and manually checked the
      handful of borderline files (`frontend/.vscode/mcp.json` — just the
      Angular CLI MCP launch command, no tokens; `environment.ts` /
      `environment.development.ts` — only the public API Gateway URL, not
      a secret) before getting sign-off on the full 89-file list.
      Initialized git, committed as `9145618` ("Working state before
      question-system redesign"), added remote `origin` →
      `https://github.com/carranza-javier/spicy-feedback-tool.git`, and
      pushed to `main`. The JWT secret was never in a local file to begin
      with (lives only in AWS SSM Parameter Store — see Notes/gotchas
      below), so it was never at risk of being committed.
- [x] **Fixed scale questions standardised to a 1–6 range.**
      `question-defs.ts`'s three `type: 'scale'` fixed questions —
      `emotionExhibition` (was 0–10), `chiliRating` (was 1–5), `websiteEase`
      (was 0–10) — all now `min: 1, max: 6`. Matching fallback defaults
      updated in `survey.html` (`q.min ?? 1` / `q.max ?? 6` for both the
      `app-chili-question` and `app-scale-question` branches) and
      `ChiliQuestion`'s own default `max` input (was 5). No backend or
      dashboard changes needed: `postResponse.mjs`/`validation.mjs` never
      constrain fixed-answer numeric ranges, and `dashboard.ts`'s scale
      aggregation already derives `min`/`max` from `q.min ?? 0` /
      `q.max ?? 10` per question rather than hardcoding 0–10 or 1–5, so it
      picks up the new range automatically. Admin-created (variable)
      scale questions are untouched — their range stays admin-configurable
      per exhibition (`exhibition-edit.ts` default 0–10), not a fixed spec
      value. `SPEC.md` §4 and §8 updated to say 1–6 instead of 1–5/0–10.
      Verified `tsc --noEmit` clean.
- [x] **MAJOR REDESIGN — question system is now fully DB-driven and
      admin-editable; overlapping-active exhibitions get a picker screen.**
      Previously 9 questions were hardcoded in the frontend
      (`FIXED_PAGES`/`FIXED_QUESTION_KEYS` in `question-defs.ts`, duplicated
      again as `FIXED_KEYS` in `exportResponsesCsv.mjs`) and not editable by
      Simon at all; only admin-added "variable" questions were DB-stored.
      That whole split is gone. Plan file (for full design rationale):
      `curious-leaping-oasis.md` in the Claude plans directory.

      **Data model.** New DynamoDB table `QuestionTemplates` (PK
      `templateId`) holds Simon's 9 questions as reusable templates —
      `{ templateId, text, type, section, order, min?, max?, labelMin?,
      labelMax?, options?: {id,text}[], displayVariant? }`. `Exhibitions`'
      `variableQuestions` field is renamed/generalised to `questions:
      Question[]` — one flat, per-exhibition-owned list combining
      template-derived and freeform questions alike, disambiguated only by
      `section`/`order`. `Responses`' `fixedAnswers`/`variableAnswers` split
      collapsed into a single `answers: Record<string, unknown>` keyed by
      question id. Checkbox/slider options are now stable `{id, text}`
      pairs — stored answers reference the **id**, never the text — which
      fixes a real fragility flagged in this file previously (renaming an
      option's text used to silently drop historical responses from
      aggregation, because counting was keyed by text).

      **Sections are a fixed constant, not DB data** — new
      `frontend/src/app/shared/sections.ts` (and a duplicate
      `backend/src/lib/sections.mjs`, matching this codebase's existing
      `FIXED_KEYS`-style duplication pattern): `exhibition`/`spicy`/
      `person`/`homepage`, same 4 titles as the old hardcoded pages. Admins
      can reassign which section any question belongs to; the 4 sections
      themselves aren't editable.

      **Copy-on-create is client-side, not server-side** — this was the key
      simplification found during planning. Opening "+ New exhibition"
      fetches `GET /admin/question-templates` and pre-populates the
      question form from them (fresh per-exhibition ids generated right
      there). Whatever gets saved becomes that exhibition's own independent
      question list forever after; `createExhibition.mjs` needed no special
      template-copying logic at all — it's the same validate-and-store path
      as before, just with `questions` instead of `variableQuestions`.
      Editing a template later (new `admin/question-templates/` screen,
      list + edit only, no create/delete since the set of 9 stays fixed)
      never touches any existing exhibition.

      **Overlap picker.** `getActiveExhibition.mjs` used to `.find()` the
      first active exhibition with zero handling for two being active at
      once (overlapping date ranges) — a real gap, not hypothetical, found
      during exploration. Now collects *all* matches: 0 → same closed/none
      logic; 1 → `status: 'active'` as before; 2+ → new `status: 'multiple'`
      with a lightweight exhibitions list. New public route `GET
      /exhibitions/{exhibitionId}` (enforces the active-date check
      server-side, 404s otherwise — it's unauthenticated, so it must not
      become a way to probe non-active exhibitions) backs a new
      `public/exhibition-picker/` screen (`/pick` route) the visitor lands
      on when multiple exhibitions are active; picking one routes to the
      new parametrized `survey/:exhibitionId` route.

      **Backend files touched:** `getActiveExhibition.mjs` (overlap
      detection), `getExhibitionById.mjs` / `listQuestionTemplates.mjs` /
      `updateQuestionTemplate.mjs` (new), `postResponse.mjs` /
      `createExhibition.mjs` / `updateExhibition.mjs` (field renames),
      `exportResponsesCsv.mjs` (rewritten — no more hardcoded fixed-key
      list; iterates `exhibition.questions` uniformly, resolves option ids
      back to text for cells), `validation.mjs` (unified `validateExhibition`
      question-shape rules, shared between exhibition questions and
      standalone templates via a new `validateQuestionShape` helper),
      `sections.mjs` (new). **Gotcha hit during verification:** DynamoDB has
      a large, non-obvious reserved-word list — `section`, `order`, `min`,
      and more collided with plain `UpdateExpression` attribute names in
      `updateQuestionTemplate.mjs` (500s, one word at a time, via
      `ValidationException: ... reserved keyword: X`). Fixed by aliasing
      **every** attribute name in that expression rather than guessing which
      ones are safe.

      **Frontend files touched:** `core/services/api.ts` (types), shared
      `sections.ts` (new), `question-defs.ts` (shrunk to just a
      `groupBySection()` helper — `FIXED_PAGES`/`FIXED_QUESTION_KEYS`/
      `mapVariableQuestion` deleted), `checkbox-question`/`distance-slider`
      (contract changed from plain option text to `{id,text}`, selecting/
      emitting by id, rendering `.text`), `public/survey/` (dynamic page
      count via `groupBySection`, not a hardcoded `4`; chili detection via
      `q.displayVariant === 'chili'` instead of a `q.key === 'chiliRating'`
      magic string; `submit()` builds one flat `answers` object),
      `public/exhibition-picker/` (new), `admin/exhibition-edit/` (question
      FormArray gained a `section` select and a nested `{id,text}` options
      FormArray instead of a textarea; create mode pre-populates from
      templates), `admin/question-templates/` (new), `admin/dashboard/`
      (`buildPageResults` groups by section; checkbox/slider aggregation
      counts by option id, resolving display text at read time — this is
      what actually fixes the rename-drops-history bug).

      **Verified live end-to-end** against the real deployed AWS API
      (`terraform apply`: 16 added/10 changed/0 destroyed; ran
      `backend/scripts/seed-templates.mjs` to seed the 9 templates and wipe
      the pre-redesign test Exhibitions/Responses data — confirmed
      disposable beforehand) via a scripted Playwright session: template
      edit + revert, exhibition creation pre-populated correctly from all 9
      templates grouped into 4 sections, reassigning a question's section
      persisted correctly, a freeform variable checkbox question, the
      overlap picker triggered correctly with 2 simultaneously-active test
      exhibitions, full survey submission, and the dashboard aggregating
      correctly — including confirming checkbox/slider counts still
      resolve correctly by id. CSV export spot-checked directly: headers
      and cells show resolved option text, not raw ids. Test
      exhibitions/response created during verification were deleted
      afterward (no delete API exists yet, so this was done via direct
      `aws dynamodb delete-item`).
- [x] **Questions locked once an exhibition has ≥1 response.** Addendum to
      the redesign above — prevents an admin from corrupting already-
      collected data by editing/adding/removing questions, type, range, or
      options after responses exist. name/startDate/endDate stay editable
      regardless, and viewing results is always allowed.
      **Backend is the authoritative guard** (`updateExhibition.mjs`): a
      cheap `Limit: 1` Query against `Responses` checks existence; if found,
      fetches the currently-stored `questions` and rejects the request with
      `409` unless the submitted `questions` array is deep-equal to what's
      stored (order-independent comparison, sorted by id, via a new
      `canonicalizeQuestions`/`questionsEqual` helper in the handler — not
      naive `JSON.stringify`, since object/array key order isn't guaranteed
      to round-trip identically). This is enforced regardless of what the
      frontend does — verified directly with a raw `fetch()` PUT bypassing
      the UI entirely, confirmed `409` with the expected message.
      **Frontend reuses `AdminExhibition.responseCount`** (already computed
      by `listExhibitions.mjs`, no separate count call) to disable the
      question `FormArray` (`exhibition-edit.ts`'s new `applyLockState()`)
      and hide all add/remove buttons, showing a notice instead. Angular's
      `FormArray.disable()` cascades to every nested control including each
      question's own options sub-array; disabled controls still submit
      their value via `getRawValue()`, so a locked exhibition's unchanged
      `questions` round-trips through `buildPayload()` exactly as stored,
      satisfying the backend's equality check on save (e.g. a name-only
      edit while locked still succeeds).
      **Real bug caught during verification, not hypothetical:** the
      existing "fast path" (router state passed from the exhibitions list,
      read via raw `window.history.state`) can go stale — the browser keeps
      that state for a given history entry indefinitely, including across a
      page reload, and it reflects whatever `responseCount` was true at the
      moment the admin clicked "Bearbeiten," not now. A scripted test that
      submitted a response *after* opening the edit screen and then
      reloaded caught this directly: the questions section stayed
      incorrectly unlocked. Fixed by always re-verifying the response count
      fresh via `listAdminExhibitions()` after using the fast path for
      content — `populate()` applies the (possibly-stale) cached lock state
      immediately for fast initial render, then a follow-up fetch corrects
      it moments later if needed. This means there's a brief window where a
      just-locked exhibition can render as editable before the correction
      lands — accepted as fine given the backend rejects any actual save
      regardless, and this project's admin panel is used only a few times a
      year (not worth blocking the whole form on that round-trip).
- [x] **Chili fire-burst effect — attempted, then reverted.** Tried a
      one-shot CSS particle "flame burst" on `chili-question` commit
      (adapted from a reference fire/smoke demo — smoke, `filter: blur()`,
      `mix-blend-mode: screen`, and the `infinite` loop were stripped out;
      kept a one-shot `rise` keyframe anchored per filled chili). First pass
      spawned particles spread across the whole track (sized for the
      original room-scale demo container), which read as sparks scattered
      around the screen rather than fire on the chilies. Second pass fixed
      that — particles anchored tightly to each filled box's own center
      (verified within ±5px via `getBoundingClientRect()`), elongated
      flame-tongue shapes instead of round balls — and visually confirmed
      via cropped screenshots at several animation timestamps to actually
      look like fire on the peppers. Still reverted anyway: visually it
      didn't hold up well enough to keep. `chili-question.ts`/`.html`/`.scss`
      restored to exactly their pre-experiment (post-redesign) state via
      `git checkout` — confirmed clean (`git status` shows no diff against
      the last commit) and re-verified live (plain numbers pristine, full
      emoji preview on hover, correct filled/empty split on select, zero
      leftover particle DOM, filled boxes render with no filter — i.e.
      identical behaviour to before the experiment). **Next**: replace with
      a custom animation built on our own asset instead of a particle
      system.
- [x] **Chili fire-burst — switched to a Lottie asset, replacing the
      abandoned CSS-particle experiment above.** Same trigger/guard as
      before (fires only from a real `select()`, never on mount/back-
      navigation, never on hover) and same one-shot semantics (`loop:
      false`, plays once, cleans itself up) — only the rendering mechanism
      changed, from generated CSS particles to `lottie-web` playing
      `frontend/src/assets/fire-animation.json` (a 725KB, self-contained —
      no external image assets — 400×490 SVG-shape Lottie file, ~1.33s at
      24fps, confirmed transparent background).
      **One shared player, not one per filled chili** (explicit performance
      ask, since this runs on phones for ~95% of visitors): a single
      `AnimationItem` is created per burst, sized close to the source
      asset's own aspect ratio (74×90px, ≈400:490) and positioned by its
      own center over the horizontal midpoint of the currently-filled span
      — not stretched across it. **First attempt at sizing got this wrong**
      and needed a visible fix, same lesson as the particle experiment
      (verify visually, don't trust that it renders): stretched the player
      to span the full filled width using `preserveAspectRatio: "xMidYMid
      slice"` (cover + crop), on the assumption the flame art filled its
      canvas edge-to-edge. It doesn't — it's one tapered flame shape with
      transparent margins — so "slice" mostly showed empty space with a
      sliver of flame lost in the middle of a wide box. Fixed by sizing the
      container to the asset's native ratio and switching to the default
      `"xMidYMid meet"` (contain, undistorted); confirmed via screenshots
      at value 1 (single filled chili — flame fills that one box
      dramatically) and value 6 (all filled — flame centered over the
      group) that it now renders as one whole, undistorted flame burst in
      both cases.
      **Data is fetched once and cached** (a `static` field on the
      component class, not per-burst `path:` loading) — confirmed via
      network-request counting across three separate bursts in one session
      (1 request total). A generation-token guard prevents a narrow race
      where two rapid selections during that very first (pre-cache) fetch
      could otherwise both resolve and each try to create an instance;
      confirmed no stacking via a rapid re-select mid-animation (exactly 1
      `<svg>` present, not 2). `ngOnDestroy` / the `'complete'` event / a
      fresh `select()` all route through one `stopBurst()` that calls
      `.destroy()` on the Lottie instance — confirmed zero console errors
      destroying the component mid-animation (navigating away and back)
      and zero leftover DOM after a burst completes naturally.
      `prefers-reduced-motion` is checked in JS before ever fetching/
      creating anything — reduced-motion users get the instant filled-red
      state with no animation attempted at all, same pattern as the
      earlier particle version.
      **Two supporting changes outside `chili-question/` were required and
      are the only exceptions to the "scoped only to chili-question"
      constraint**, both pure enablement, no behaviour of their own:
      `frontend/package.json`/`package-lock.json` gained the `lottie-web`
      dependency (ships its own TypeScript types, no `@types` package
      needed), and `frontend/angular.json`'s build `assets` array gained a
      `{ glob: "**/*", input: "src/assets", output: "assets" }` entry —
      without it, `fire-animation.json` 404s at runtime, since this
      project's existing asset convention is the `public/` folder (that's
      where `favicon.ico` lives), which Angular 17+'s default schematic
      does not automatically extend to also cover `src/assets/`.
      Verified end-to-end live (not just that it compiles): created a real
      test exhibition, drove the survey through Playwright, and confirmed
      via screenshots at several timestamps that the flame genuinely fades
      in, peaks, and fades out — not a frozen frame — plus all the
      guard/cleanup behaviour above. Noted in passing, not acted on: the
      `survey` lazy chunk grew from ~22KB to ~76KB raw (~9KB → ~71KB
      estimated transfer) for this one decorative effect, and the build
      emits a benign "lottie-web is not ESM" warning (CommonJS dependency,
      disables some tree-shaking — not a build error).
- [x] **Lottie fire burst — corrected to fire on every filled chili, then
      abandoned for a measured performance reason (not a guess).** The
      single-shared-player version above only ever showed fire on one
      chili regardless of how many were filled, and it was visibly
      off-center — confirmed via screenshot, e.g. selecting value 5 lit
      only chili #3. Fixed properly: one `AnimationItem` **per filled
      chili**, each anchored inside its own `.chq__box` via `viewChildren()`
      collecting one `#burstEl` per `@for` iteration (matched to `steps()`
      by array index). Confirmed via DOM query — `[1,1,1,1,1,0]` SVGs per
      box at value 5 — and via `getBoundingClientRect()` — every burst's
      center within 0px of its own box's center.
      **Then measured, and dropped anyway.** Worst case (all 6 filled) at
      4x CPU throttling (mobile approximation): **~3.9s** from click to all
      6 players mounted, **~4.75s** total main-thread blocking time (one
      single block was 3.77s — the page is frozen for most of that
      window). Even at full desktop speed: one ~490ms block just to create
      6 instances. Tried the `canvas` renderer as a cheap alternative —
      only ~25% better (~2.9s / ~3.7s blocked), not a fix; the cost is
      inherent to building 6 independent render trees from a 12-layer
      vector animation, not the SVG-vs-canvas choice. Reported these
      numbers rather than pre-emptively working around them, since a
      single-player tradeoff had already been rejected once for not
      actually doing what was asked.
- [x] **Fire burst — replaced Lottie entirely with a plain animated SVG**
      (`frontend/src/assets/fire-animation.svg`, 669KB, same 400×490
      viewBox and ~1.333s duration as the old Lottie source — reads as a
      native SVG/SMIL re-export of the same asset). `lottie-web` is fully
      removed: no import, no `AnimationItem`, no `viewChildren()`-driven
      player lifecycle. `npm uninstall lottie-web` brought
      `package.json`/`package-lock.json` back to an exact byte-for-byte
      match with the pre-Lottie commit (confirmed via `git diff` showing
      no change to either file) — confirmed nothing else in the project
      imports it first.
      **The positioning fix from the per-box Lottie version was reused
      as-is**, per instruction — `position: relative` on `&__box`, burst
      centered via `top/left/transform` — none of that CSS changed.
      **Mechanism**: the SVG's own SMIL `<animate>` elements all use
      `repeatCount="indefinite"` — it loops forever natively once parsed
      into the DOM, so "one-shot" is enforced here, not by the asset. Each
      burst sets every currently-filled box's container `innerHTML` to a
      cached copy of the fetched markup (fresh DOM nodes get a fresh SMIL
      timeline starting at insertion — merely toggling visibility on an
      already-inserted copy would *not* restart it), then a single
      `setTimeout` at 1333ms (matching the SVG's own `dur`) clears every
      container back to `''`. Same generation-token guard and
      `stopAllBursts()`-on-destroy/re-select pattern as the Lottie version,
      adapted from instance `.destroy()` calls to `innerHTML = ''` — no
      instances to leak now, just DOM nodes, which vanish the moment their
      container's `innerHTML` is cleared.
      Verified visually and via DOM: 0 SVGs before any click; exactly 5 at
      value 5 (`[1,1,1,1,1,0]` per box, matching the fill pattern); 6 at
      value 6 (every chili on fire simultaneously); 0 again ~1.55s after
      click (past the 1333ms loop — proves the teardown actually runs, not
      just that the fetch/insert works); exactly 1 network fetch across
      multiple bursts (cached); no stacking on rapid re-select mid-
      animation; 0 under `prefers-reduced-motion`; 0 on revisiting an
      already-answered question; 0 console errors including a destroy-mid-
      animation test. Screenshots at 350ms/650ms show bright flame at peak
      fading to embers on every filled box at once, correctly centered.
      `frontend/angular.json`'s `src/assets` build-assets entry (added for
      the Lottie JSON) stays — still needed, now for the `.svg` file at the
      same path. The old `fire-animation.json` (725KB) was initially left
      in `src/assets/` untouched, then deleted in a follow-up once
      confirmed (via a repo-wide grep) it had no references left anywhere
      except this file's own historical notes above — `src/assets/` now
      holds only `fire-animation.svg`.
- [x] **Fire burst — small follow-up sizing tweak.** `.chq__burst` shrunk
      from 74×90px to 44×54px (same ~0.816 aspect ratio) so the chili emoji
      stays clearly visible through the flame instead of being dominated by
      it. A `z-index: -1` was briefly tried to push the burst behind the
      emoji, then removed again at the next request — final state has no
      explicit `z-index` on `.chq__burst` (relies on plain DOM order/normal
      stacking, same as before this tweak). Committed and pushed to `main`
      at `f2d7420` together with the Lottie-to-SVG replacement above.
- [x] **Fixed "login fails on first attempt" — Lambda timeout too low for
      cold starts.** Root cause confirmed via CloudWatch logs + tfstate: the
      default AWS/Terraform Lambda timeout is 3s (`"timeout": 3` in
      `terraform.tfstate`, never set explicitly in the `.tf` files), and
      `login.mjs`'s cold-start path (SSM secret fetch + `bcrypt.compare` +
      JWT signing) exceeds that on a cold container — warm invocations are
      fine, only the first request after idle fails, matching the reported
      symptom exactly.
      Added `timeout = 8` to both `aws_lambda_function.handlers` (the
      `for_each` block covering all route handlers in `main.tf`) and the
      separately-declared `aws_lambda_function.authorizer` — the authorizer
      also reads the SSM secret on cold start and was equally exposed, so it
      needed the same fix even though it isn't part of the `handlers` map.
      **Scope correction made during this fix:** `local.handlers` has grown
      to 11 entries since the question-template redesign (the map's own
      comment still said "eight," now corrected) — so this change touches
      12 Lambdas total (11 handlers + authorizer), not 9/8 as originally
      estimated when the bug was first diagnosed.
      `terraform plan` reviewed before applying: `0 to add, 12 to change, 0
      to destroy`, every change a single `timeout: 3 -> 8` in-place update,
      nothing else. Applied cleanly (`Apply complete! Resources: 0 added, 12
      changed, 0 destroyed`).
- [x] **Exhibition-name badge (page 1) + type scale bump, survey then
      extended to the whole admin panel.** Two rounds:
      1. **Public survey (`public/survey/`):** the exhibition name moved out
         of a small italic `<p class="exhibition-name">` nested under the
         page-1 header into its own element **above** `<h2 class="section-
         title">` — new `.exhibition-badge` class, borderless/unpadded
         (padding and border were tried first, then explicitly removed per
         follow-up), `font-size: 1rem`, uppercase, `letter-spacing: 0.05em`,
         colour `#e5007e` (the one intentional colour exception on the
         otherwise black/white public survey, alongside the chili emoji).
         "Zur Ausstellung" itself and pages 2–4 headers untouched. Separately,
         all survey type sizes bumped ~15–20% (rem-based, no layout-logic
         changes, mobile-first ~400px behaviour preserved): section titles
         `1.5rem→1.75rem`, question labels across all five shared question
         components (`scale-question`, `checkbox-question`, `text-question`,
         `distance-slider`, `chili-question`) `0.95rem→1.1rem`, nav buttons
         `1rem→1.15rem`, plus proportional bumps to end-labels, error/state
         text, the distance-slider's Comfortaa readout, and the chili emoji
         sizes. Global `html { font-size: 16px }` in `styles.scss` was left
         alone since it's shared with the admin panel — each survey-specific
         class was scaled individually instead.
      2. **Admin panel, on explicit follow-up request ("same size as the
         survey"):** the same ~15–20% bump applied to `admin/exhibitions-
         list.scss` (page title, table body/header text, dates, status
         badges, header/row buttons), `admin/exhibition-edit.scss` (page
         title, section subheads, field labels, inputs/selects/textareas,
         hints/errors, variable-question-card numbers, all buttons), and
         `admin/dashboard.scss` (page title/subtitle, the big total-response
         number `2.5rem→2.9rem`, section titles, question labels, average-
         score number `1.5rem→1.75rem`, answered-count, empty/no-text states,
         text-answer list items, back/CSV buttons). All three admin screens
         now sit on the same type scale as the public survey.
      `ng build --configuration production` verified clean after each round.
      Committed and pushed to `main`.
- [x] **Reusable demo-data seed script** —
      `backend/scripts/seed-demo.mjs`, run against the live AWS account (only
      environment that exists; no separate dev/staging). Always wipes
      `Exhibitions`/`Responses` first, then rebuilds 5 exhibitions covering
      every lifecycle state from the 9 `QuestionTemplates` rows (same
      client-side copy shape `exhibition-edit.ts` produces) plus 2 thematic
      freeform questions each: **Las 12 Lunas** and **Für die Katz** (closed,
      ~75–150 days in the past, 18/16 responses), **BioInformatik 3D** and
      **Graffiti 2030** (both active now, dates deliberately overlapping so
      the `/pick` overlap-picker screen has something to exercise, 13/14
      responses), **Raum des Schweigens** (starts in 14 days, fully
      configured, 0 responses since it can't have any yet). Dates are
      relative day-offsets from "today," not hardcoded — stays correct
      whenever re-run.
      **Fully deterministic, confirmed by direct comparison, not assumption**:
      a `mulberry32` PRNG seeded per exhibition drives response generation
      (which scale value, which checkbox options, which free-text line, and
      the submission timestamp all derive from the same seeded stream in a
      fixed order), so answers/timestamps are byte-identical run over run —
      verified by scanning one exhibition's responses before and after a
      second run and diffing order-independently (identical; only
      DynamoDB's unordered map-attribute serialization differed, not the
      actual data). Only `responseId`'s random-UUID suffix legitimately
      differs between runs (uses real `crypto.randomUUID()`, not the seeded
      RNG — harmless, it's never displayed).
      Text answers are hand-written German, thematically matched per
      exhibition; some responses skip a question (probability per type) so
      the dashboard's answered-count/blank handling has real variance to
      show, not 100%-complete data.
      **Ran directly against the live AWS tables** (confirmed with the user
      first, since this is the only environment and it had two prior
      test/dev exhibitions — "GO ANYWHERE - DO ANYTHING" and "Graffiti
      Ausstellung" — with real response rows in it; user chose to wipe
      rather than export first). See item 4 under "Resume here" — this
      demo data needs clearing again before Simon's real launch.
- [x] **Question-templates admin screen brought onto the app-wide type
      scale + standard button style.** `admin/question-templates/` was
      missed in the earlier "type scale bump across survey and admin panel"
      pass (`f52a840`) and still had the pre-bump sizes; also its per-card
      "Speichern" button used the old outlined/light `.btn-row` style
      instead of the solid black/white primary style used everywhere else.
      Scoped entirely to `question-templates.scss` (no template/logic
      changes). Since this screen shares identical BEM class names with
      `exhibition-edit.scss` (`.ae__title`, `.ae__sub`, `.ae__error`,
      `.field__label`, `.field__input`/`.field__select`, `.btn-back`,
      `.btn-remove`, `.btn-add-q`), font sizes were mapped 1:1 from that
      file: title 1.35rem→1.6rem, section heading 1.05rem→1.25rem, error
      banner 0.9rem→1.05rem, field labels 0.875rem→1.05rem, inputs/selects
      0.95rem→1.1rem, back link 0.875rem→1.05rem, remove-option button
      0.8rem→0.95rem, add-option/step button 0.875rem→1.05rem. The intro
      hint text and "Gespeichert." confirmation (`.qt__hint`/`.qt__saved`)
      have no `exhibition-edit` counterpart, so both were bumped
      0.85rem/0.8rem→0.95rem to stay proportionate with the rest.
      `.btn-row` (the Speichern button, used only here) restyled from
      outlined/bg-coloured to solid `background: var(--color-text)` /
      `color: var(--color-bg)`, no border, `font-weight: 600` — same
      solid black/white treatment as `.btn-primary` elsewhere. Kept as an
      inline, content-width button (same pattern as `.btn-new` on the
      exhibitions list) rather than copying `exhibition-edit`'s full-width
      block `.btn-primary`, since it sits per-card next to the
      "Gespeichert." confirmation text, not alone as a page-level submit.
      `ng build --configuration production` verified clean.
- [x] **Button hover/press feedback made clearly perceptible app-wide.**
      Existing hover/press states (survey's Weiter/Zurück/Absenden) were
      judged too subtle to notice; the admin panel's solid black CTA
      buttons (Anmelden, both Speichern buttons, + Neu, CSV) had **no**
      hover rule at all. Fixed consistently across every solid/outlined CTA
      button in both the public survey and admin panel — deliberately
      scoped to CTA buttons only, not the small text/outline utility
      buttons (`.btn-back` links, `.btn-remove`, `.btn-add-q`,
      exhibitions-list's outlined per-row `.btn-row` "Bearbeiten"), which
      keep their existing, separate, more minimal pattern.
      **New/changed shared vars in `styles.scss`:** `--color-btn-primary-
      hover` bumped `#2c2c2c` → **`#404040`** (a clearly bigger jump off the
      `#111111` base than before) and a new **`--color-btn-secondary-hover-
      bg: #e0e0e0`** added — kept deliberately separate from the existing
      `--color-hover-bg`/`--color-hover-border` (`#f2f2f2`/`#999999`) used
      by the public survey's answer option boxes (scale/checkbox/chili) and
      `exhibition-picker`, so darkening a button's hover doesn't also
      darken unrelated answer-option hover states — those were intentionally
      left untouched, out of scope for this button-only request.
      **Lift + press transform**, layered on top of the colour change, on
      every button covered below: `&:hover { transform: translateY(-1px); }`
      / `&:active { transform: translateY(0); }` (cancels the lift, reads as
      being pushed in) — `transform` added to each button's existing
      `transition` list alongside the ~0.15s `ease` duration already in use
      (unchanged), so this rides the same existing global
      `prefers-reduced-motion` block in `styles.scss` with no new media
      query needed.
      **`.btn-primary` (survey Weiter/Absenden, login Anmelden,
      exhibition-edit Speichern, question-templates Speichern, exhibitions-
      list + Neu, dashboard CSV):** hover → `background:
      var(--color-btn-primary-hover)` (`#404040`, was `#2c2c2c`) + lift;
      active → back to `var(--color-text)` (`#111111`, true black,
      unchanged) + lift cancelled.
      **`.btn-secondary` (survey Zurück only):** hover → `background:
      var(--color-btn-secondary-hover-bg)` (`#e0e0e0`, new — was
      `--color-hover-bg` `#f2f2f2`) + lift; **border-color hover override
      removed** (previously lightened the already-black border to `#999999`
      on hover, which read as reducing contrast, not increasing it — border
      now stays solid `var(--color-text)` black always); active → unchanged
      `var(--color-border)` (`#cccccc`) + lift cancelled.
      `ng build --configuration production` verified clean.
- [x] **Spicy logo added to the thank-you screen.** New
      `frontend/src/assets/spicy-logo.webp` (500×421 native, pure black
      linework on transparent background — already matches the black/white
      scheme natively, no colour/filter override needed) rendered below the
      "Danke!" message in `public/thank-you/thank-you.html`/`.scss`.
      Picked up automatically by the existing `src/assets` build-assets
      glob in `angular.json` (added earlier for the fire-animation SVG) —
      no config change needed.
      **Placement:** appended as the last child inside `.ty`
      (`display: flex; flex-direction: column; align-items: center`,
      already the mechanism centering "Danke!" and the message text) —
      centering came for free from that existing layout, no new
      margin-auto/text-align needed. `margin-top: 2.5rem` gives it a clear
      visual pause below the message so it reads as a closing touch, not
      part of the message block.
      **Responsive sizing — relative + capped, no fixed px width:**
      `.ty__logo { width: 34%; max-width: 150px; height: auto; }`. Width is
      a percentage of the `.page` container (not the viewport), so it
      follows the page shell's own existing responsive behaviour
      (`--width-form`, 700px cap) rather than needing its own breakpoints:
      **~360px mobile** (page content ≈ 320px) → logo ≈ 109px; **desktop**
      (page content capped at 620px, i.e. `--width-form` 700px minus
      2×2.5rem padding) → 34% would be ≈ 211px, but the 150px `max-width`
      caps it there instead, keeping it a modest closing touch rather than
      competing with "Danke!" for attention on wide screens. `height: auto`
      preserves the native ~1.19:1 aspect ratio at every width; `width`/
      `height` attributes (500/421) on the `<img>` tag reserve that ratio
      immediately (no layout shift) before CSS/the image itself loads.
      `ng build --configuration production` verified clean; confirmed
      `spicy-logo.webp` present in `dist/.../browser/assets/`.
- [x] **Thank-you logo entrance animation — went through several tuning
      passes; a real root-cause bug was found and fixed, then the sequence
      was extended to a proper two-step text-then-logo entrance.**
      `thank-you.scss` + `styles.scss` (one shared-rule addition, see below).
      **History up to `12s cubic-bezier(0.16, 1, 0.3, 1) 2s backwards`:**
      started as a combined scale+opacity "emerge from depth" effect
      (`scale(0.6)→1`, `0.7s ease-out`) — too fast/abrupt; slowed to `1.8s`
      with a deeper start (`scale(0.3)`) and a softer
      `cubic-bezier(0.16, 1, 0.3, 1)` curve — still too fast; duration
      tripled to `5.4s`; mechanism changed to a pure opacity fade per
      explicit request (scale/transform dropped, logo stays full-size); a
      2s `animation-delay` was added and duration bumped to `6s`; still
      judged too fast, duration doubled to `12s`.
      **Root cause finally diagnosed, not just guessed at another number:**
      even at `12s` it still looked like it "jumped" to mostly-visible fast.
      Verified via the actual compiled production CSS (not just source) and
      a numeric evaluation of the shipped `cubic-bezier(0.16, 1, 0.3, 1)`
      curve — confirmed no leftover `transform`/scale, correct single
      `@keyframes` (not a `transition`), `backwards` correctly holding
      `opacity: 0` through the delay — but the curve itself pins both
      control points' y-value at `1` with low x-values, which mathematically
      front-loads ~90% of the opacity change into the first ~30% of
      whatever the duration is (confirmed: at only 4s into the old 12s
      animation, opacity was already 0.90). That's why every duration
      increase "didn't fix" the jump — the curve's shape is
      duration-independent, so a longer duration only ever lengthened the
      already-imperceptible tail, never softened the front-loaded jump.
      **Fixed by swapping the curve, not the duration:** `ease-in-out`
      (verified numerically to sit at exactly 0.50 opacity at the 6s
      midpoint of the 12s duration — i.e. genuinely even pacing) replaces
      `cubic-bezier(0.16, 1, 0.3, 1)` for the logo's fade. Duration (`12s`)
      and `backwards` fill-mode are unchanged.
      **Extended to a real two-step sequence per follow-up request:** title
      + message now fade in together as **step 1**
      (`animation: ty-text-fade 1.5s ease-out backwards;` on both
      `.ty__title` and `.ty__message`, new `@keyframes ty-text-fade`,
      identical opacity-only shape to the logo's), then the logo fades in
      as **step 2** — its `animation-delay` changed from the old fixed `2s`
      to `1.5s`, deliberately matching the text fade's own duration exactly
      so the logo starts the instant the text finishes, not racing it in
      parallel and not leaving an arbitrary gap.
      **Final values:** `.ty__title`/`.ty__message`:
      `animation: ty-text-fade 1.5s ease-out backwards;`. `.ty__logo`:
      `animation: ty-logo-emerge 12s ease-in-out 1.5s backwards;`.
      `animation-fill-mode: backwards` is used on all three for the same
      reason established earlier in this file — holds each element's
      `opacity: 0` starting keyframe through its delay window (zero delay
      for the text, 1.5s for the logo) instead of flashing visible first.
      **`prefers-reduced-motion` needed one small addition to the existing
      global rule** in `styles.scss` — it previously zeroed
      `transition-duration`/`animation-duration`/`animation-iteration-count`
      but not `animation-delay`/`transition-delay`; without also zeroing
      those, a reduced-motion user would still sit through the full delay
      window (held by `backwards`) before the near-instant collapsed
      animation played. Added `transition-delay: 0s !important;
      animation-delay: 0s !important;` alongside the existing declarations
      in the same `@media (prefers-reduced-motion: reduce)` block — this
      one shared rule automatically covers all three animations (text ×2,
      logo) with no per-element media queries needed, and collapses all of
      them to instant/fully-visible with no perceptible delay or fade.
      Verified via the actual compiled production CSS
      (`dist/.../chunk-*.js`) that both keyframes and all three animation
      declarations shipped correctly.
      `ng build --configuration production` verified clean.
- [x] **Dashboard redesign — tabs, three-family tonal colour system, area
      charts, font-scale parity.** Planned with the user first (approved plan
      before any code), driven by feedback that the old dashboard was one
      long scroll, monotonous (one flat blue + one orange accent everywhere),
      all-bar-charts, and had noticeably smaller text than the rest of the
      admin panel.
      **Tabs, not a sequential flow.** `admin/dashboard/dashboard.ts` gained
      `activeTab`/`activeSection` (a plain signal + computed, no routing) —
      free browsing between the 4 sections, mirroring the survey's own
      section split but explicitly not Weiter/Zurück. `pageResults()` (still
      built by the unchanged `groupBySection()`) now renders as a tab strip
      (`db__tabs`/`db__tab`) plus only the active section's questions, instead
      of all 4 stacked. Total response count and the CSV button stay in the
      header, unaffected by tab switching (exhibition-wide, not per-section).
      Removed the now-redundant in-content section-title heading (the tab
      itself already names the section).
      **Colour, assigned by the job the data does (dataviz skill method), not
      decoration — three tonal families, validated with the skill's
      `validate_palette.js` six-check categorical validator (all pass, light
      + dark surface, on representative swatches from all three families
      together, since they can appear side by side in one tab):**
      **Ocean** (`#cfe1f5` → `#5c93c9` → `#0e8f6f`, blue→teal) for scale +
      slider distributions — both are genuinely ordinal (bin position IS the
      meaning), so a new `rampColor(t)` helper interpolates light→dark across
      however many bins the question has (works for any range, not just
      1–6). **Orchid** (`#8a4f9c`/`#b06fbc`/`#6b3679`) for checkbox
      multi-select — deliberately flat, not a gradient, since reordering
      nominal options doesn't change their meaning (a gradient there would
      falsely imply rank); cycled per-section (not global) so 2+ checkbox
      questions in the same tab stay visually distinct from each other.
      **Coral** (`#e2543f`) — a single reserved accent, used only to flag the
      average on scale charts and colour-match the existing `Ø` number above
      it (unchanged link, just re-tuned to coordinate with Ocean/Orchid
      instead of clashing as flat orange-on-blue did before).
      **Chart-type variety, same honesty rules as before.** Scale and slider
      distributions moved from vertical bar to a filled **area/line** chart
      (new `shared/area-chart/area-chart.ts`, a Chart.js `type: 'line'`
      sibling to the existing `shared/bar-chart/bar-chart.ts`, same
      create-in-`ngAfterViewInit`/destroy-in-`ngOnDestroy` lifecycle shape) —
      still an honest single-series ordered distribution, just filled instead
      of barred; `tension: 0` (straight segments only) so nothing is visually
      invented between real, discrete bins. The area fill itself is a
      horizontal canvas gradient built from `rampColor` samples
      (`areaGradient()` in `dashboard.ts`), computed from the chart's own
      `chartArea` once Chart.js has measured it. The average marker changed
      from recolouring one bar orange to a single highlighted **point** on
      the line (`pointRadius`/`pointBackgroundColor` arrays, Chart.js's
      built-in per-point styling, no annotation plugin needed) — keeps the
      ramp doing one job (bin position) and the point doing the other (flag
      the mean) instead of overloading one colour channel with both.
      Checkbox multi-select **stays horizontal bar** (recoloured to Orchid) —
      explicitly the one case that does NOT get the gradient/area treatment,
      since it's nominal data and pie/donut is still ruled out (percentages
      don't sum to 100%), matching the honesty rule already established for
      this question type.
      **Font-scale parity:** most `db__*` HTML text sizes already matched
      their `exhibition-edit` counterparts from an earlier app-wide type-scale
      pass — the actual mismatch was Chart.js's own internal tick fonts,
      hardcoded at `size: 11`/`size: 12`, visibly smaller than the
      surrounding ~1.05rem HTML text. Bumped to `size: 13` in both chart
      option factories (`lineChartOptions()`/`checkboxChartOptions()`).
      **Verified live** against the dev server (demo data from
      `backend/scripts/seed-demo.mjs` already had real response counts —
      "Las 12 Lunas", 18 responses) via a scripted Playwright session
      (`playwright` installed standalone in the scratchpad, not added to
      `frontend/package.json`, since this was a one-off verification, not a
      project dependency): logged in, confirmed all 4 tabs render and switch
      correctly, total count/CSV stay visible across tab switches, scale/
      slider render as Ocean gradient area charts with the Coral average
      point where applicable, checkbox stays horizontal bar in Orchid with
      distinct tones for 2+ questions in one tab, CSV export still downloads
      correctly, zero console errors. Checked both 1280px and 375px — at
      375px the 4-tab strip overflows to a horizontal scroll (same
      `overflow-x: auto` pattern already used by the exhibitions-list table),
      confirmed the last tab is genuinely reachable and clickable via scroll,
      not just visually clipped. `ng build --configuration production`
      verified clean.
- [x] **Dashboard scale/slider charts reverted from area/line back to bars**
      — the area/line treatment from the redesign above was judged confusing
      on user feedback, not clearer: a connecting line between independent
      response buckets ("how many people picked X") visually implies a trend
      or continuity that isn't there. Worst for the distance slider, whose
      "values" are unrelated distance bands (20m, 500m, 1km…), not points on
      a continuum — a line there falsely suggested a trajectory between
      unrelated categories. Affected all four: `emotionExhibition`,
      `chiliRating`, `websiteEase`, `distanceTravelled`.
      **What was kept, per explicit instruction:** the Ocean tonal ramp — now
      applied **per bar** (each bar shaded by its own position, lightest at
      the low end, deepest teal at the high end) instead of as an area-fill
      gradient. The Coral average-highlight is back to being a distinctly
      coloured **bar** at the average bucket (the original technique), not a
      floating point on a line. Checkbox charts (Orchid, horizontal bars) and
      all the tab/font/palette-family work from the entry above are
      untouched.
      **Mechanically:** `dashboard.ts`'s `scale`/`slider` branches of
      `aggregateQuestion` rebuild `ChartData<'bar'>` with
      `backgroundColor: steps.map((_, i) => rampColor(i / rampSpan))` (Coral
      substituted at the average index for scale), reusing the same
      `rampColor()` helper unchanged from the area-chart version — only the
      *application* (per-bar vs. gradient-fill) changed, not the ramp itself.
      `areaGradient()` and `lineChartOptions()` deleted (dead code once
      nothing produces `ChartData<'line'>` anymore); `scaleChartOptions()`
      restored as the one bar-options factory shared by scale + slider (still
      with the `size: 13` tick-font fix from the original redesign). The
      `QuestionEntry`/component accessor types collapsed back to a single
      `ChartData<'bar'>`/`ChartOptions<'bar'>` pair (`chartData()`/
      `chartOpts()`) instead of the separate bar/line accessor pairs, since
      every chart on the dashboard is a bar chart again. The now-unused
      `shared/area-chart/area-chart.ts` component (only ever consumed by
      dashboard.ts) was deleted outright rather than left dead.
      `dashboard.html`/`dashboard.scss`: `app-area-chart` swapped back to
      `app-bar-chart` for the scale/slider cases; `chart-wrap--area` renamed
      back to `chart-wrap--bar`.
      **Verified live** against the dev server with the same demo exhibition
      ("Las 12 Lunas") — confirmed scale bars now show individual light→dark
      bars with the average bucket in Coral (no connecting line), and the
      distance-slider chart shows independent bars per distance band with no
      false continuity between them. Zero console errors.
      `ng build --configuration production` verified clean.
- [x] **Checkbox charts — per-OPTION colour, extended Orchid family to 8
      tones.** Follow-up to the two entries above: checkbox multi-select
      charts previously used one flat Orchid tone for the whole question
      (cycled per checkbox *question*, not per option). Changed to colour
      each **option** by its fixed position in the option list — never by its
      response count, so colour stays a pure visual identifier, stable
      across re-renders, with no implied ranking and no redundancy with what
      bar length already shows.
      **Palette extended from 3 flat tones to 8 fixed ones**, spanning
      purple → lilac → pink (deep purple, lilac, medium purple, orchid,
      violet magenta, light orchid, magenta pink, light pink) — sized to the
      actual longest real question in this app ("Womit überzeugt dich der
      Kunstraum spicy", `tpl_whatConvinces`, has exactly 8 options — checked
      directly in `backend/scripts/seed-templates.mjs` rather than assumed),
      so that one covers with zero repeats; shorter questions (e.g. the
      6-option "Du bist…") just use the first N tones in the same fixed
      order, cycling back to tone 1 only past 8 options.
      **Order is a deliberate zigzag in lightness** (dark/light/dark/light…),
      not a smooth monotonic gradient, even though hue still sweeps
      purple→pink across the set — a smooth gradient would put adjacent
      tones too close together (low OKLab ΔE) to reliably tell neighbouring
      bars apart; alternating lightness keeps adjacent contrast high while
      the set still *reads* as one coordinated family when viewed together.
      **Re-validated with the dataviz skill's `validate_palette.js`**, this
      time in **adjacent-pairs mode** (not `--pairs all`) — matching how the
      skill itself classifies bar/list charts, where only neighbouring bars
      are ever visually compared, which is also literally what was asked
      ("adjacent bars… must stay distinguishable"). All 8 tones pass in this
      fixed order (worst adjacent CVD ΔE 17.7 deutan, normal-vision floor
      20.3), including the wrap-around pair (tone 8 → tone 1, relevant once a
      question exceeds 8 options). Sub-3:1 contrast on the four lightest
      tones is a documented WARN, legal here because every bar always
      carries a visible option-text label to its left (the relief channel) —
      never colour-alone identification.
      `dashboard.ts`: `ORCHID_TONES` grew from 3 to 8 hexes; the checkbox
      branch of `aggregateQuestion` now builds `backgroundColor` as
      `options.map((_, i) => ORCHID_TONES[i % ORCHID_TONES.length])` instead
      of a single flat tone; the per-section `checkboxToneIndex` cycling
      counter in `buildPageResults` (needed under the old per-*question*
      scheme) was removed as dead complexity — colour no longer depends on
      which/how-many other checkbox questions share a tab.
      **Verified live** against the dev server: the real 8-option question
      ("Zu spicy" tab) shows 8 distinct tones, no repeats; the 6-option
      question ("Zur Person" tab) uses the first 6 tones in the identical
      order (option 1 is the same deep-purple in both charts), confirming
      assignment is by fixed position, not per-question or per-count. Zero
      console errors. `ng build --configuration production` verified clean.
- [x] **Checkbox charts — reverted to colour-by-response-count, palette
      softened to pastel.** Follow-up to the entry above: per-option fixed
      identity colour was reverted per user feedback — seeing which options
      are "winning" via colour, at a glance, was judged more useful here than
      a stable per-option identity, even though it's now deliberately
      redundant with bar length (that redundancy is the point: fast visual
      scanning, not a new dimension of information).
      **Mechanism**, same technique as the Ocean scale/slider ramp, just
      keyed differently: each checkbox bar is shaded by its own response
      count, normalised against *that question's own* min/max count (not a
      global range, not option position) — fewest responses → lightest
      lilac, most → deepest purple. Two options tied on count get the exact
      same tone (ties are literal equality of the normalised `t` value, so
      this falls out for free); if every option is tied, including the
      degenerate all-zero case, there's no spread to encode at all, so
      everything renders at the ramp's midpoint rather than defaulting to
      either end.
      **Palette softened** — the prior 8-tone set (`#8a4f9c`-family) was
      judged too saturated. Replaced the 8 fixed hues with 3 ramp anchors,
      reusing the exact same interpolation shape as the Ocean ramp via a new
      shared `makeRamp(light, mid, deep)` factory (`rampColor` and the new
      `orchidRampColor` are now both just calls to this one factory — the
      only thing that ever differed between them was the anchor colours):
      `#e7d3ee` (pale lilac) → `#cda1d9` → `#8f69ab` (muted purple, not
      vivid) — confirmed via the same OKLCH probe used for earlier palette
      tuning that lightness decreases monotonically (0.891 → 0.768 → 0.585)
      while chroma stays soft throughout (0.04–0.11, well below the prior
      deep tone's 0.13+), i.e. genuinely pastel, not just darker.
      `dashboard.ts`: the checkbox branch of `aggregateQuestion` computes
      `countMin`/`countMax`/`countSpan` from that question's own counted
      values and maps each bar's `t` through `orchidRampColor`; the old fixed
      `ORCHID_TONES` array and its position-based cycling are gone.
      **Verified live** against the dev server: the 8-option question shows
      its highest-count bar in deep purple, several visually-tied mid-count
      bars sharing one identical tone, and its lowest bars in pale lilac; the
      6-option question shows the same pattern (two tied bars rendering
      pixel-identical). Zero console errors.
      `ng build --configuration production` verified clean.
- [x] **Dashboard tab bar — fixed a spurious desktop scrollbar, added a
      mobile dropdown.** Two issues in the tab strip from the dashboard
      redesign above, both scoped to `admin/dashboard/`:
      1. **Desktop**: `.db__tabs` had `overflow-x: auto` left over from when
         it was designed to double as the mobile solution too — on desktop
         this created a scroll affordance even though the 4 short section
         titles never actually need one (measured directly: `.db__tabs`
         `scrollWidth === clientWidth` exactly, i.e. never truly
         overflowing) inside the `--width-wide` container. Removed
         `overflow-x`/`-webkit-overflow-scrolling` entirely — no longer
         needed once mobile got its own dedicated control (below), so
         `.db__tabs` is a plain flex row at desktop widths with nothing to
         scroll.
      2. **Mobile**: a horizontal-scroll tab strip is a bad pattern here
         regardless of the bug above — the 4th tab was invisible with no
         visual cue it existed. Replaced with a native `<select>` dropdown
         (`db__tab-select`, new markup in `dashboard.html`, new
         `onSectionSelect()` handler in `dashboard.ts` calling the existing
         `selectTab()`) shown only below the app's one existing mobile/
         desktop breakpoint (640px — same breakpoint already used by
         `.chart-wrap--bar`'s height bump and the global `.page` padding
         step, not a new one). `.db__tabs` and `.db__tab-select-wrap` are
         simple mirror-image `display: none` / `@media (min-width: 640px)`
         pairs — mobile-first, no JS breakpoint watching needed.
      **Verified live**: at 1280px, `.db__tabs` computed `display: flex`,
      `scrollWidth === clientWidth` (1020 = 1020, confirmed via direct DOM
      measurement — no overflow), select-wrap `display: none`. At 390px,
      `.db__tabs` `display: none`, select-wrap `display: block`, all 4
      section titles present as `<option>`s, and exercising the dropdown
      (`selectOption` to index 3) correctly swapped the rendered content to
      the "Zur Homepage" section's questions. Zero console errors.
      `ng build --configuration production` verified clean.
- [x] **Real favicon set installed, replacing the default Angular one.**
      The 7 generated files (`favicon.ico`, `favicon-16x16.png`,
      `favicon-32x32.png`, `apple-touch-icon.png`,
      `android-chrome-192x192.png`, `android-chrome-512x512.png`,
      `site.webmanifest`) had been dropped into `src/assets/`, which builds
      to `/assets/...` (per `angular.json`'s existing asset-glob entry) — but
      the provided `site.webmanifest` already hardcodes its icon `src`s as
      root-relative (`/android-chrome-*.png`), so the whole set needed to
      live at the site root instead. Moved all 7 into `public/` (the
      project's existing root-output folder, confirmed via `angular.json`:
      `{ glob: "**/*", input: "public" }` has no `output` key, i.e. maps to
      `/`), overwriting the old default Angular `favicon.ico` that lived
      there. `index.html` gained the standard link set (`icon` ×3 for
      `.ico`/32/16px, `apple-touch-icon`, `manifest`) alongside the existing
      Google Fonts links; PNG dimensions double-checked by reading each
      file's PNG `IHDR` chunk directly (not assumed from filename) —
      confirmed 16×16/32×32/180×180/192×192/512×512 all correct.
      **Verified live** against the dev server after a reload: all 5 link
      tags resolve to 200 with the expected `rel`/`sizes` values, and
      `favicon.ico` serves at exactly the new file's byte size (15406,
      distinct from the old default's 15086) — confirming the new icon, not
      a stale cached default, is what the browser tab picks up.
      `ng build --configuration production` verified clean; dist output
      confirmed to contain all 7 files at its root alongside `index.html`.
- [x] **First production deploy to GitHub Pages.** Committed/pushed the
      batch of finished work sitting on `main` (dashboard redesign, favicon
      set, thank-you animation — commit `54ea323`), built
      `ng build --configuration production`, and pushed the
      `dist/spicy-feedback/browser/` output to a new orphan `gh-pages`
      branch (via a temporary `git worktree --orphan`, so the `main`
      checkout was never disturbed) with a `CNAME` file
      (`feedback.spicy-kunstraum.ch`) and a `.nojekyll` file added at the
      branch root. Confirmed the CORS config already live on the API
      Gateway matched `variables.tf`/`main.tf` exactly
      (`terraform plan` → "No changes") before this deploy, so no infra
      change was needed at that point.
- [x] **CORS fix — added the plain-`http://` production origin.** The
      browser console showed a live CORS block right after the deploy
      above: `Access-Control-Allow-Origin` missing for requests from
      `http://feedback.spicy-kunstraum.ch` (note: **http, not https** —
      GitHub Pages was still provisioning the TLS cert for the custom
      domain at that point, so the site was being served over plain http).
      `main.tf`'s `cors_configuration.allow_origins` only listed
      `var.frontend_origin` (`https://feedback.spicy-kunstraum.ch`) +
      `http://localhost:4200` — the `http://` production origin was
      genuinely missing, not a propagation-delay red herring. Added
      `"http://feedback.spicy-kunstraum.ch"` alongside the existing two,
      with a `TODO` comment to remove it once GitHub Pages' "Enforce HTTPS"
      is confirmed active. `terraform plan` reviewed before applying: `0 to
      add, 1 to change, 0 to destroy` (a single in-place update to
      `aws_apigatewayv2_api.main`'s `cors_configuration.allow_origins`).
      Applied; confirmed directly against the live API Gateway
      (`aws apigatewayv2 get-api`) that `AllowOrigins` now lists all three
      origins.
- [x] **Clean `/admin` entry URL for Simon.** New static file
      `frontend/public/admin/index.html` — a plain HTML page (not part of
      the Angular app/router) with an instant `location.replace('/#/admin/
      login')` plus a `<meta http-equiv="refresh">` fallback. `public/`
      builds to the site root (same mechanism as the favicon set), so this
      lands at `dist/.../browser/admin/index.html` and, once deployed,
      GitHub Pages serves it directly for `feedback.spicy-kunstraum.ch/admin`
      — no change to the app's hash routing anywhere else.
      **Verified before deploying, against the actual static-hosting
      behaviour, not the dev server**: `ng serve`'s dev server has its own
      SPA-fallback middleware that intercepts `/admin` and serves the app
      shell instead of the static file — not representative of GitHub
      Pages. Served the real `dist/.../browser` output with a plain static
      file server (`http-server`) instead: confirmed `/admin` → 302 → `
      /admin/` → 200 with the redirect page's HTML, then drove it with a
      headless browser and confirmed it lands on `.../#/admin/login` with
      the real login form rendered.
      **Redeployed `gh-pages`**: this time by checking out the *existing*
      branch in a worktree (not a fresh orphan — that was only for the very
      first deploy) and doing a clean `git rm -r .` + re-copy of the fresh
      `dist/.../browser` output + regenerated `CNAME`/`.nojekyll`, so stale
      content-hashed chunk filenames from the previous build don't
      accumulate. Only `admin/index.html` actually differed from the prior
      deploy — every other file rebuilt byte-identical, confirmed via `git
      status` showing just the one new file staged.
      **Share this URL with Simon**: `https://feedback.spicy-kunstraum.ch/admin`
      (or the bare `http://` form until GitHub Pages' HTTPS enforcement is
      confirmed — see the CORS entry above) — redirects instantly to the
      admin login screen.
- [x] **DynamoDB tables renamed with a `spicy-` prefix** (matching the
      Lambda naming convention, avoiding future name collisions with other
      projects in the same AWS account): `Exhibitions` → `spicy-Exhibitions`,
      `Responses` → `spicy-Responses`, `Admins` → `spicy-Admins`,
      `QuestionTemplates` → `spicy-QuestionTemplates`. Only the `name`
      attribute changed in each `aws_dynamodb_table` resource in `main.tf` —
      hash/range keys untouched — but `name` forces replacement for this
      resource type, so this was a genuine destroy+recreate, confirmed
      acceptable beforehand since the tables held only disposable test/demo
      data (no migration performed, by design).
      Lambda env vars (`EXHIBITIONS_TABLE` etc.) already referenced
      `aws_dynamodb_table.*.name` rather than hardcoded strings, so they
      picked up the new values automatically — no handler source changes
      needed. The only hardcoded table-name strings anywhere in the backend
      were in the two local operator scripts (`backend/scripts/seed-demo.mjs`,
      `seed-templates.mjs`, both read local AWS credentials directly, not
      Lambda env vars) — updated to the new names. `SPEC.md` §4 and
      `terraform/outputs.tf`'s output descriptions updated too for
      consistency; confirmed via a repo-wide grep that no other bare
      references to the old names remained.
      **Plan reviewed before applying**: `4 to add, 12 to change, 4 to
      destroy` — exactly the 4 tables (destroy+recreate, `name` forcing
      replacement, all other attributes/keys unchanged) + 11 Lambda handlers
      updating their table-name env vars in-place + `aws_iam_role_policy.
      dynamo_access` updating its `Resource` ARN list to the new table
      ARNs (same actions/effect). Confirmed zero mentions of API Gateway
      (routes/integrations/stage/authorizer), Lambda permissions, the IAM
      role itself, or CloudWatch log groups anywhere in the plan. Applied
      cleanly, matching the plan exactly; spot-checked live afterward
      (`aws dynamodb list-tables`, a Lambda's resolved env vars) that the 4
      new tables exist, the old 4 are gone, and env vars resolve correctly.
- [x] **JWT signing secret rotated, after an accidental exposure.** While
      spot-checking the table rename above, a verification command
      (`aws lambda get-function-configuration ... --query
      "Environment.Variables"`) printed the live JWT secret in plaintext —
      a raw AWS CLI call bypasses Terraform's own redaction entirely, unlike
      `terraform plan`/`apply` output. Caught and flagged immediately;
      treated the exposed value as compromised and rotated it rather than
      leaving it live.
      **Before rotating**, confirmed via `terraform providers schema -json`
      that the AWS provider itself marks `aws_ssm_parameter.jwt_secret.value`
      as `sensitive: true` in its schema — meaning `terraform plan`/`apply`
      diffs involving this value show `(sensitive value)`, never the real
      secret; the leak was specific to the raw CLI spot-check, not a gap in
      the normal terraform workflow.
      **Rotation mechanism** — the new value was never printed anywhere:
      generated with `openssl rand -base64 48` inside a `$(...)` command
      substitution and piped directly into
      `aws ssm put-parameter --name /spicy/jwt-secret --overwrite` in one
      shell command (needed `MSYS_NO_PATHCONV=1` on this Windows/Git-Bash
      setup — MSYS otherwise mangles the leading-slash parameter name into
      a Windows path). `put-parameter` only returns `{Version, Tier}`, never
      the value.
      **`terraform plan` reviewed and confirmed sensitive-redacted before
      applying**, per the value.sensitive check above: `Plan: 0 to add, 2 to
      change, 0 to destroy` — only `aws_lambda_function.authorizer` and
      `aws_lambda_function.handlers["login"]` (the only two functions that
      ever touch `JWT_SECRET`; every other admin route is gated by the
      Lambda Authorizer rather than holding the secret itself), each
      showing `"JWT_SECRET" = (sensitive value)`. Applied, matching the plan
      exactly (`0 added, 2 changed, 0 destroyed`) — no secret value appeared
      in any command output at any point in the rotation.
      **Consequence, expected**: any previously-issued admin JWT is now
      invalid; the next admin login will need to re-authenticate (the
      `Admins` table is also currently empty post-rename regardless — see
      the table-rename entry above, Simon/the developer still needs to
      (re)create the admin user manually in `spicy-Admins`).

---

## In progress

- [ ] **Confirm GitHub Pages "Enforce HTTPS" is active for
      feedback.spicy-kunstraum.ch, then remove the temporary
      `http://feedback.spicy-kunstraum.ch` CORS origin** added above
      (`main.tf`, has a `TODO` marking it) — it only exists to cover the
      window before the custom domain's TLS cert finished provisioning.
- [ ] **Real admin user** — the `spicy-Admins` table is currently empty
      (wiped by the table-rename destroy/recreate above, by design). The
      developer needs to (re)create the admin user directly in
      `spicy-Admins` — same process as before (generate a bcrypt hash
      locally, never share it in chat) — before anyone can log into the
      admin panel again. Old note about a throwaway `test1234` hash no
      longer applies; that row/table is gone.

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
  To rotate **without ever printing the secret**: generate it inside a
  `$(...)` substitution so it's never a separate, echoable value —
  `aws ssm put-parameter --name /spicy/jwt-secret --value "$(openssl rand -base64 48)" --type SecureString --overwrite --region eu-central-1`
  — then `terraform plan` (confirm the diff shows `"JWT_SECRET" =
  (sensitive value)`, never the real value — the AWS provider marks
  `aws_ssm_parameter.value` sensitive) and `apply` to push it into the
  `login`/`authorizer` Lambdas (the only two that ever hold this secret).
  **On Windows/Git-Bash**, prefix with `MSYS_NO_PATHCONV=1` — MSYS otherwise
  mangles the leading-slash parameter name into a Windows path and the call
  fails with "Parameter name must be a fully qualified name."
  **Never** fetch this value back via a raw AWS CLI call (e.g. `aws lambda
  get-function-configuration ... --query Environment.Variables`) to
  "verify" it — unlike Terraform's own plan/apply output, the CLI does not
  redact sensitive values, and doing exactly this once already leaked the
  secret into a chat transcript, forcing an unplanned rotation.

- **`terraform/lambda.zip` should be in `.gitignore`** — it is a build
  artifact produced by `terraform plan/apply`, not source.

- **First-time Terraform init:** run `terraform init` inside `terraform/`
  before plan/apply. No remote backend is configured yet; state is local.
  Consider adding an S3 backend before the first real deploy.

- **Admin user** — the `spicy-Admins` table (renamed from `Admins`, see the
  table-rename log entry above) is currently **empty** — the old `simon` /
  `test1234` row is gone, destroyed along with the old table, not carried
  over (no migration was performed, by design — the data was disposable
  test data). Create the real admin user directly in `spicy-Admins`:
  generate a bcrypt hash offline (rounds=10), then put the item via the AWS
  console or CLI. The app has no self-registration flow by design (spec
  § 9.1).

- **CORS** is currently set to `https://feedback.spicy-kunstraum.ch`. During
  development, override with `terraform apply -var='frontend_origin=*'` or
  add a `staging` tfvar file — do not commit a wildcard origin to the default.

- **GitHub Pages routing:** Angular must use hash routing (`#/`) or include a
  `404.html` that redirects to `index.html`, otherwise deep links return 404
  on reload (spec § 12).

- **Data region:** default is `eu-central-1` (Frankfurt) — closest to
  Switzerland, satisfies GDPR/DSGVO locality requirement (spec § 12).
