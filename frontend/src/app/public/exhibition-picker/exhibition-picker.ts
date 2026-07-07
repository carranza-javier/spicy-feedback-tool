import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from '../../core/services/api';

interface PickerExhibition {
  exhibitionId: string;
  name: string;
  startDate: string;
  endDate: string;
}

@Component({
  selector: 'app-exhibition-picker',
  imports: [],
  templateUrl: './exhibition-picker.html',
  styleUrl: './exhibition-picker.scss',
})
export class ExhibitionPicker implements OnInit {
  private readonly api    = inject(Api);
  private readonly router = inject(Router);

  readonly exhibitions = signal<PickerExhibition[]>([]);
  readonly loading     = signal(true);

  ngOnInit(): void {
    const state = window.history.state as { exhibitions?: PickerExhibition[] };
    if (state?.exhibitions?.length) {
      this.exhibitions.set(state.exhibitions);
      this.loading.set(false);
      return;
    }

    // Direct navigation or reload — no router state, re-fetch.
    this.api.getActiveExhibition().subscribe({
      next: (resp) => {
        this.exhibitions.set(resp.status === 'multiple' ? (resp.exhibitions ?? []) : []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  choose(exhibitionId: string): void {
    this.router.navigate(['/survey', exhibitionId]);
  }

  formatRange(ex: PickerExhibition): string {
    const fmt = (iso: string) =>
      new Date(iso).toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' });
    return `${fmt(ex.startDate)} – ${fmt(ex.endDate)}`;
  }
}
