import { Component, ElementRef, OnDestroy, computed, input, output, signal, viewChildren } from '@angular/core';

const FIRE_ANIMATION_PATH = 'assets/fire-animation.svg';
// The SVG's own SMIL <animate> elements all use dur="1.333s" with
// repeatCount="indefinite" — it loops forever on its own once inserted, so
// this is how long one loop takes before we tear it back out again.
const FIRE_ANIMATION_DURATION_MS = 1333;

@Component({
  selector: 'app-chili-question',
  imports: [],
  templateUrl: './chili-question.html',
  styleUrl: './chili-question.scss',
})
export class ChiliQuestion implements OnDestroy {
  readonly label = input.required<string>();
  readonly min   = input<number>(1);
  readonly max   = input<number>(6);
  readonly value = input<number | null>(null);

  readonly valueChange = output<number>();

  // Mouse-hover preview (desktop "star rating" style). Never set on
  // touch — taps go straight to select() and commit via the value input.
  private readonly hoverValue = signal<number | null>(null);

  readonly steps = computed<number[]>(() => {
    const result: number[] = [];
    for (let i = this.min(); i <= this.max(); i++) result.push(i);
    return result;
  });

  // Pristine (no hover, no committed value yet) → plain numbers.
  // Any hover or a committed value → chili emojis.
  readonly touched = computed(() => this.hoverValue() !== null || this.value() !== null);

  readonly displayValue = computed(() => this.hoverValue() ?? this.value() ?? 0);

  isFilled(step: number): boolean {
    return this.touched() && step <= this.displayValue();
  }

  isEmpty(step: number): boolean {
    return this.touched() && step > this.displayValue();
  }

  hover(step: number | null): void {
    this.hoverValue.set(step);
  }

  // ── One-shot fire burst on commit ──────────────────────────────────────
  // Only from a real select() in THIS instance, never on mount — a naive
  // "value() != null" check would also fire when navigating back to an
  // already-answered question, since isFilled() must reflect restored
  // state on mount too. Gating burst playback inside select() (never in a
  // computed/effect keyed off value()) is what keeps it strictly a
  // response to a user action.
  //
  // Plain animated SVG now, not Lottie — one copy PER filled chili
  // (1..step), each injected into ITS OWN .chq__box via a #burstEl
  // rendered once per @for iteration. viewChildren() collects them in the
  // same order steps() iterates, so burstEls()[i] always corresponds to
  // steps()[i] — no data-attribute matching needed. The positioning this
  // relies on (position: relative on &__box, centered via top/left/
  // transform in the .scss) is unchanged from the Lottie version — that
  // part was already correct.
  //
  // The SVG's own SMIL animations loop indefinitely once parsed into the
  // DOM, so "one-shot" is enforced here, not by the asset: each burst sets
  // the container's innerHTML fresh (a brand-new set of DOM nodes gets its
  // own SMIL timeline starting at insertion — merely toggling visibility
  // on an already-inserted copy would NOT restart it) and a timeout clears
  // it back to empty after exactly one loop.
  private readonly burstEls = viewChildren<ElementRef<HTMLElement>>('burstEl');

  // Which steps currently have a burst playing — drives the
  // chq__burst--active class (template has no direct access to the DOM
  // manipulation below).
  readonly activeSteps = signal<ReadonlySet<number>>(new Set());

  private burstTimeout?: ReturnType<typeof setTimeout>;
  // Guards the fetch-in-flight race: if a second select() happens before
  // the first-ever markup fetch resolves, only the call that's still
  // "current" once the await settles is allowed to insert anything.
  private burstGeneration = 0;

  // Cached across instances of this component (e.g. if it ever renders
  // more than once) — the fetch only ever happens once per page load, not
  // once per burst, and not on initial render either (only when the first
  // burst actually needs it). The SAME markup string is reused for every
  // simultaneous filled chili — each gets its own innerHTML assignment
  // (and thus its own independent DOM nodes/timeline), not a shared node.
  private static cachedSvgMarkup: string | null = null;
  private static cachedSvgPromise: Promise<string> | null = null;

  private static loadSvgMarkup(): Promise<string> {
    if (ChiliQuestion.cachedSvgMarkup) {
      return Promise.resolve(ChiliQuestion.cachedSvgMarkup);
    }
    ChiliQuestion.cachedSvgPromise ??= fetch(FIRE_ANIMATION_PATH)
      .then((res) => res.text())
      .then((text) => (ChiliQuestion.cachedSvgMarkup = text));
    return ChiliQuestion.cachedSvgPromise;
  }

  async select(step: number): Promise<void> {
    this.valueChange.emit(step);
    await this.spawnBurst(step);
  }

  private async spawnBurst(step: number): Promise<void> {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return; // instant filled-red state only, per isFilled() — no animation at all
    }

    // Never stack copies — a rapid re-select clears every currently
    // playing burst and replaces the whole set cleanly.
    this.stopAllBursts();

    const generation = ++this.burstGeneration;
    const targetSteps: number[] = [];
    for (let s = this.min(); s <= step; s++) targetSteps.push(s);

    const markup = await ChiliQuestion.loadSvgMarkup();
    if (generation !== this.burstGeneration) return; // a newer select() already took over

    const els = this.burstEls();
    for (const s of targetSteps) {
      const container = els[s - this.min()]?.nativeElement;
      if (!container) continue; // shouldn't happen — steps() and burstEls() are always in lockstep
      container.innerHTML = markup;
    }
    this.activeSteps.set(new Set(targetSteps));

    this.burstTimeout = setTimeout(() => {
      if (generation === this.burstGeneration) this.stopAllBursts();
    }, FIRE_ANIMATION_DURATION_MS);
  }

  private stopAllBursts(): void {
    // Bumping the generation here too (not just in spawnBurst) closes the
    // same race for ngOnDestroy: if the component is destroyed while the
    // first-ever fetch is still in flight, the pending spawnBurst call
    // sees a stale generation once it resolves and bails instead of
    // inserting markup nothing will ever clear.
    this.burstGeneration++;
    clearTimeout(this.burstTimeout);
    for (const el of this.burstEls()) {
      el.nativeElement.innerHTML = '';
    }
    this.activeSteps.set(new Set());
  }

  ngOnDestroy(): void {
    this.stopAllBursts();
  }
}
