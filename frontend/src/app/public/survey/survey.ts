import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Api, Exhibition, SubmitResponsePayload } from '../../core/services/api';
import { ScaleQuestion } from '../../shared/scale-question/scale-question';
import { ChiliQuestion } from '../../shared/chili-question/chili-question';
import { DistanceSlider } from '../../shared/distance-slider/distance-slider';
import { CheckboxQuestion } from '../../shared/checkbox-question/checkbox-question';
import { TextQuestion } from '../../shared/text-question/text-question';
import { groupBySection, PageDef } from '../../shared/question-defs';

@Component({
  selector: 'app-survey',
  imports: [ScaleQuestion, ChiliQuestion, DistanceSlider, CheckboxQuestion, TextQuestion],
  templateUrl: './survey.html',
  styleUrl: './survey.scss',
})
export class Survey implements OnInit {
  private readonly api    = inject(Api);
  private readonly router = inject(Router);
  private readonly route  = inject(ActivatedRoute);

  readonly status      = signal<'loading' | 'active' | 'none'>('loading');
  readonly exhibition  = signal<Exhibition | null>(null);
  readonly currentPage = signal(1);
  readonly answers     = signal<Record<string, unknown>>({});
  readonly submitting  = signal(false);
  readonly submitError = signal(false);

  // Every question — template-derived or freeform — lives in the
  // exhibition's own `questions` array; grouped into pages by section.
  readonly pages = computed<PageDef[]>(() => groupBySection(this.exhibition()?.questions ?? []));

  readonly totalPages      = computed(() => this.pages().length);
  readonly progressPercent = computed(() => (this.currentPage() / (this.totalPages() || 1)) * 100);
  readonly currentPageDef  = computed(() => this.pages()[this.currentPage() - 1]);
  readonly pageTitle       = computed(() => this.currentPageDef()?.title ?? '');
  readonly pageQuestions   = computed(() => this.currentPageDef()?.questions ?? []);

  ngOnInit(): void {
    // Arrived from the exhibition picker (overlapping-active case) — fetch
    // that specific exhibition directly, still enforcing it's active.
    const exhibitionId = this.route.snapshot.paramMap.get('exhibitionId');
    if (exhibitionId) {
      this.api.getExhibitionById(exhibitionId).subscribe({
        next: (resp) => {
          this.status.set('active');
          this.exhibition.set(resp.exhibition);
        },
        error: () => this.status.set('none'),
      });
      return;
    }

    this.api.getActiveExhibition().subscribe({
      next: (resp) => {
        if (resp.status === 'closed') {
          this.router.navigate(['/closed'], { state: { lastExhibition: resp.lastExhibition } });
          return;
        }
        if (resp.status === 'multiple') {
          this.router.navigate(['/pick'], { state: { exhibitions: resp.exhibitions } });
          return;
        }
        this.status.set(resp.status === 'active' ? 'active' : 'none');
        if (resp.status === 'active' && resp.exhibition) {
          this.exhibition.set(resp.exhibition);
        }
      },
      error: () => this.status.set('none'),
    });
  }

  getScaleAnswer(key: string): number | null {
    const v = this.answers()[key];
    return typeof v === 'number' ? v : null;
  }

  getCheckboxAnswer(key: string): string[] {
    const v = this.answers()[key];
    return Array.isArray(v) ? (v as string[]) : [];
  }

  getTextAnswer(key: string): string {
    const v = this.answers()[key];
    return typeof v === 'string' ? v : '';
  }

  getSliderAnswer(key: string): string | null {
    const v = this.answers()[key];
    return typeof v === 'string' ? v : null;
  }

  setAnswer(key: string, value: unknown): void {
    this.answers.update(prev => ({ ...prev, [key]: value }));
  }

  next(): void {
    this.currentPage.update(p => p + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  back(): void {
    this.currentPage.update(p => Math.max(1, p - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  submit(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.submitError.set(false);

    const payload: SubmitResponsePayload = {
      exhibitionId: this.exhibition()!.exhibitionId,
      answers: this.answers(),
    };

    this.api.submitResponse(payload).subscribe({
      next: () => this.router.navigate(['/thank-you']),
      error: () => {
        this.submitting.set(false);
        this.submitError.set(true);
      },
    });
  }
}
