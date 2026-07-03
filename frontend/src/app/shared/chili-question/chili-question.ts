import { Component, computed, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-chili-question',
  imports: [],
  templateUrl: './chili-question.html',
  styleUrl: './chili-question.scss',
})
export class ChiliQuestion {
  readonly label = input.required<string>();
  readonly min   = input<number>(1);
  readonly max   = input<number>(5);
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

  select(step: number): void {
    this.valueChange.emit(step);
  }
}
