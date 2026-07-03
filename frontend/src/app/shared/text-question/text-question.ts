import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-text-question',
  imports: [],
  templateUrl: './text-question.html',
  styleUrl: './text-question.scss',
})
export class TextQuestion {
  readonly label = input.required<string>();
  readonly value = input<string>('');

  readonly valueChange = output<string>();

  readonly uid = Math.random().toString(36).slice(2, 8);

  onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLTextAreaElement).value);
  }
}
