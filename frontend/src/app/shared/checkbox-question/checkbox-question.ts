import { Component, input, output } from '@angular/core';
import { QuestionOption } from '../../core/services/api';

@Component({
  selector: 'app-checkbox-question',
  imports: [],
  templateUrl: './checkbox-question.html',
  styleUrl: './checkbox-question.scss',
})
export class CheckboxQuestion {
  readonly label    = input.required<string>();
  readonly options  = input.required<QuestionOption[]>();
  readonly selected = input<string[]>([]); // selected option ids

  readonly selectedChange = output<string[]>();

  isSelected(opt: QuestionOption): boolean {
    return this.selected().includes(opt.id);
  }

  toggle(opt: QuestionOption): void {
    const current = this.selected();
    const next = current.includes(opt.id)
      ? current.filter(id => id !== opt.id)
      : [...current, opt.id];
    this.selectedChange.emit(next);
  }
}
