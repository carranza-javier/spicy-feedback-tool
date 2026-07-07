import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api, AdminExhibition } from '../../core/services/api';

type ExhibitionStatus = 'active' | 'upcoming' | 'finished';

@Component({
  selector: 'app-exhibitions-list',
  imports: [],
  templateUrl: './exhibitions-list.html',
  styleUrl: './exhibitions-list.scss',
})
export class ExhibitionsList implements OnInit {
  private readonly api = inject(Api);
  // router is used directly in the template (nav buttons) so not marked private.
  readonly router = inject(Router);

  readonly exhibitions = signal<AdminExhibition[]>([]);
  readonly loading     = signal(true);
  readonly error       = signal<string | null>(null);

  ngOnInit(): void {
    this.api.listAdminExhibitions().subscribe({
      next: ({ exhibitions }) => {
        // Sort: active first, then upcoming by startDate, then finished by endDate desc.
        this.exhibitions.set(
          [...exhibitions].sort((a, b) => {
            const sa = this.status(a);
            const sb = this.status(b);
            const order: ExhibitionStatus[] = ['active', 'upcoming', 'finished'];
            const diff = order.indexOf(sa) - order.indexOf(sb);
            if (diff !== 0) return diff;
            // Within the same status, sort by startDate descending.
            return b.startDate.localeCompare(a.startDate);
          })
        );
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Fehler beim Laden der Ausstellungen.');
        this.loading.set(false);
      },
    });
  }

  status(ex: AdminExhibition): ExhibitionStatus {
    const today = new Date().toISOString().slice(0, 10);
    if (ex.startDate <= today && today <= ex.endDate) return 'active';
    if (ex.startDate > today) return 'upcoming';
    return 'finished';
  }

  statusLabel(ex: AdminExhibition): string {
    const s = this.status(ex);
    return s === 'active' ? 'Aktiv' : s === 'upcoming' ? 'Bevorstehend' : 'Abgeschlossen';
  }

  formatDate(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  }

  newExhibition(): void {
    this.router.navigate(['/admin/exhibitions/new']);
  }

  edit(ex: AdminExhibition): void {
    this.router.navigate(['/admin/exhibitions', ex.exhibitionId, 'edit'], {
      state: { exhibition: ex },
    });
  }

  viewDashboard(ex: AdminExhibition): void {
    this.router.navigate(['/admin/exhibitions', ex.exhibitionId, 'dashboard']);
  }
}
