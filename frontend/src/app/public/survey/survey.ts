import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api, Exhibition, SubmitResponsePayload } from '../../core/services/api';
import { ScaleQuestion } from '../../shared/scale-question/scale-question';
import { ChiliQuestion } from '../../shared/chili-question/chili-question';
import { DistanceSlider } from '../../shared/distance-slider/distance-slider';
import { CheckboxQuestion } from '../../shared/checkbox-question/checkbox-question';
import { TextQuestion } from '../../shared/text-question/text-question';
import {
  FIXED_PAGES,
  FIXED_QUESTION_KEYS,
  PageDef,
  QuestionDef,
  mapVariableQuestion,
} from '../../shared/question-defs';

@Component({
  selector: 'app-survey',
  imports: [ScaleQuestion, ChiliQuestion, DistanceSlider, CheckboxQuestion, TextQuestion],
  templateUrl: './survey.html',
  styleUrl: './survey.scss',
})
export class Survey implements OnInit {
  private readonly api    = inject(Api);
  private readonly router = inject(Router);

  readonly status      = signal<'loading' | 'active' | 'none'>('loading');
  readonly exhibition  = signal<Exhibition | null>(null);
  readonly currentPage = signal(1);
  readonly answers     = signal<Record<string, unknown>>({});
  readonly submitting  = signal(false);
  readonly submitError = signal(false);

  // Variable questions appended to page 1 (exhibition-specific context).
  readonly pages = computed<PageDef[]>(() => {
    const [p1, ...rest] = FIXED_PAGES;
    const vqs = this.exhibition()?.variableQuestions ?? [];
    return [
      { ...p1, questions: [...p1.questions, ...vqs.map(mapVariableQuestion)] },
      ...rest,
    ];
  });

  readonly progressPercent  = computed(() => (this.currentPage() / 4) * 100);
  readonly currentPageDef   = computed(() => this.pages()[this.currentPage() - 1]);
  readonly pageTitle        = computed(() => this.currentPageDef().title);
  readonly pageQuestions    = computed(() => this.currentPageDef().questions);

  ngOnInit(): void {
    this.api.getActiveExhibition().subscribe({
      next: (resp) => {
        if (resp.status === 'closed') {
          this.router.navigate(['/closed'], { state: { lastExhibition: resp.lastExhibition } });
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

    const all = this.answers();
    const fixedAnswers: Record<string, unknown> = {};
    const variableAnswers: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(all)) {
      if (FIXED_QUESTION_KEYS.has(k)) {
        fixedAnswers[k] = v;
      } else {
        variableAnswers[k] = v;
      }
    }

    const payload: SubmitResponsePayload = {
      exhibitionId: this.exhibition()!.exhibitionId,
      fixedAnswers,
      variableAnswers,
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
