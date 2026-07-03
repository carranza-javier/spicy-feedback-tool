import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-scale-question',
  imports: [],
  templateUrl: './scale-question.html',
  styleUrl: './scale-question.scss',
})
export class ScaleQuestion {
  readonly label    = input.required<string>();
  readonly min      = input.required<number>();
  readonly max      = input.required<number>();
  readonly labelMin = input.required<string>();
  readonly labelMax = input.required<string>();
  readonly value    = input<number | null>(null);

  readonly valueChange = output<number>();

  readonly steps = computed<number[]>(() => {
    const result: number[] = [];
    for (let i = this.min(); i <= this.max(); i++) result.push(i);
    return result;
  });

  select(n: number): void {
    this.valueChange.emit(n);
  }
}
