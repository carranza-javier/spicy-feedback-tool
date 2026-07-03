import { Component, OnInit, signal } from '@angular/core';

@Component({
  selector: 'app-closed',
  imports: [],
  templateUrl: './closed.html',
  styleUrl: './closed.scss',
})
export class Closed implements OnInit {
  readonly lastExhibition = signal<{ name: string; endDate: string } | null>(null);

  ngOnInit(): void {
    const state = window.history.state as { lastExhibition?: { name: string; endDate: string } };
    if (state?.lastExhibition) {
      this.lastExhibition.set(state.lastExhibition);
    }
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-CH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
}
