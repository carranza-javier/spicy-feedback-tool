import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-checkbox-question',
  imports: [],
  templateUrl: './checkbox-question.html',
  styleUrl: './checkbox-question.scss',
})
export class CheckboxQuestion {
  readonly label    = input.required<string>();
  readonly options  = input.required<string[]>();
  readonly selected = input<string[]>([]);

  readonly selectedChange = output<string[]>();

  isSelected(opt: string): boolean {
    return this.selected().includes(opt);
  }

  toggle(opt: string): void {
    const current = this.selected();
    const next = current.includes(opt)
      ? current.filter(o => o !== opt)
      : [...current, opt];
    this.selectedChange.emit(next);
  }
}
