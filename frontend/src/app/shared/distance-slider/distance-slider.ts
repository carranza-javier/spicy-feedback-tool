import { Component, computed, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-distance-slider',
  imports: [],
  templateUrl: './distance-slider.html',
  styleUrl: './distance-slider.scss',
})
export class DistanceSlider {
  readonly label   = input.required<string>();
  readonly options = input.required<string[]>();
  readonly value   = input<string | null>(null);

  readonly valueChange = output<string>();

  // Continuous raw position (float, [0, maxIndex]) — the native input uses
  // step="any" so the thumb itself glides freely under the pointer. Only
  // the STORED value snaps, to the nearest stop's index.
  // Set synchronously on every 'input' event during a drag — the native
  // element already moves its own thumb on every step, so this drives the
  // custom fill bar / label in lockstep instead of waiting a tick for the
  // value input to round-trip back from the parent.
  private readonly localRaw = signal<number | null>(null);

  readonly maxIndex = computed(() => this.options().length - 1);

  readonly currentRaw = computed(() => {
    const local = this.localRaw();
    if (local !== null) return local;
    const fromValue = this.options().indexOf(this.value() ?? '');
    return fromValue >= 0 ? fromValue : 0;
  });

  // Nearest stop to the current (possibly in-between) thumb position —
  // this is what gets displayed and stored, never the raw float.
  readonly nearestIndex = computed(() => Math.round(this.currentRaw()));

  readonly touched = computed(() => this.localRaw() !== null || this.value() !== null);

  readonly currentLabel = computed(() => this.options()[this.nearestIndex()] ?? '');

  // Fill bar tracks the raw continuous position, not the snapped index, so
  // it stays visually in sync with the native thumb's actual glide.
  readonly fillPercent = computed(() =>
    this.maxIndex() > 0 ? (this.currentRaw() / this.maxIndex()) * 100 : 0
  );

  onInput(event: Event): void {
    const raw = Number((event.target as HTMLInputElement).value);
    this.localRaw.set(raw);
    const label = this.options()[Math.round(raw)];
    if (label !== undefined) this.valueChange.emit(label);
  }
}
