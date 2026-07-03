import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { ChartData, ChartOptions } from 'chart.js';
import { Api, AdminExhibition, ResponseRecord } from '../../core/services/api';
import { BarChart } from '../../shared/bar-chart/bar-chart';
import {
  FIXED_PAGES,
  FIXED_QUESTION_KEYS,
  QuestionDef,
  mapVariableQuestion,
} from '../../shared/question-defs';

// ── Result types ───────────────────────────────────────────────────────────────

interface QuestionEntry {
  question: QuestionDef;
  entryType: 'scale' | 'checkbox' | 'text' | 'slider';
  // scale + checkbox + slider: defined when entryType !== 'text'
  chartData?: ChartData<'bar'>;
  chartOptions?: ChartOptions<'bar'>;
  answeredCount: number;
  // scale only
  average?: number;
  // text only
  texts: string[];
}

interface PageResult {
  title: string;
  questions: QuestionEntry[];
}

// ── Palette ──────────────────────────────────────────────────────────────────
// Admin-only — the public survey stays strictly black/white. One calm, soft-
// blue family runs across every chart on the dashboard (scale distributions
// and multi-select bars alike), so nothing competes with anything else; the
// warm orange accent is reserved exclusively for the average-highlight on
// scale charts, so it stays meaningful instead of becoming "another color."
const SCALE_BASE     = '#5598e7'; // soft blue (sequential step 350) — every distribution bar
const SCALE_AVERAGE  = '#eb6834'; // warm orange — the ONLY accent; the bucket nearest the average
const CHECKBOX_BASE  = '#6da7ec'; // soft blue (sequential step 300) — one tone, every multi-select chart

// ── Chart option factories ─────────────────────────────────────────────────────

function scaleChartOptions(): ChartOptions<'bar'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => `${ctx.raw} Antwort(en)` } },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { family: 'Work Sans, sans-serif', size: 11 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: '#eeeeee' },
        ticks: {
          stepSize: 1,
          precision: 0,
          font: { family: 'Work Sans, sans-serif', size: 11 },
        },
      },
    },
  };
}

function checkboxChartOptions(answeredCount: number): ChartOptions<'bar'> {
  return {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const count = ctx.raw as number;
            const pct = answeredCount > 0 ? Math.round((count / answeredCount) * 100) : 0;
            return `${count} (${pct}%)`;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { display: false },
        ticks: {
          stepSize: 1,
          precision: 0,
          font: { family: 'Work Sans, sans-serif', size: 11 },
        },
      },
      y: {
        grid: { display: false },
        ticks: { font: { family: 'Work Sans, sans-serif', size: 12 } },
      },
    },
  };
}

// ── Aggregation helpers ────────────────────────────────────────────────────────

function aggregateQuestion(q: QuestionDef, rawValues: unknown[]): QuestionEntry {
  if (q.type === 'scale') {
    const min   = q.min ?? 0;
    const max   = q.max ?? 10;
    const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    const counts = new Map<number, number>(steps.map((s) => [s, 0]));
    let sum = 0;
    let answeredCount = 0;

    for (const v of rawValues) {
      if (typeof v === 'number' && v >= min && v <= max) {
        counts.set(v, (counts.get(v) ?? 0) + 1);
        sum += v;
        answeredCount++;
      }
    }

    const average = answeredCount > 0 ? Math.round((sum / answeredCount) * 10) / 10 : 0;

    // Emphasis: every bucket is the calm base hue except the one nearest the
    // average, which carries the warm accent — the visual answer to "where's
    // the average" instead of just the number above the chart.
    const averageIndex = answeredCount > 0
      ? Math.min(steps.length - 1, Math.max(0, Math.round(average) - min))
      : -1;
    const backgroundColor = steps.map((_, i) => (i === averageIndex ? SCALE_AVERAGE : SCALE_BASE));

    const chartData: ChartData<'bar'> = {
      labels: steps.map(String),
      datasets: [{
        data: steps.map((s) => counts.get(s) ?? 0),
        backgroundColor,
        borderRadius: 4,
        maxBarThickness: 28,
      }],
    };
    return { question: q, entryType: 'scale', chartData, chartOptions: scaleChartOptions(), average, answeredCount, texts: [] };
  }

  if (q.type === 'checkbox') {
    const options = q.options ?? [];
    const counts  = new Map<string, number>(options.map((o) => [o, 0]));
    let answeredCount = 0;

    for (const v of rawValues) {
      if (Array.isArray(v) && v.length > 0) {
        answeredCount++;
        for (const opt of v as string[]) {
          if (counts.has(opt)) counts.set(opt, (counts.get(opt) ?? 0) + 1);
        }
      }
    }

    // Multi-select — honest as a horizontal bar (percentages don't sum to
    // 100%, so a pie/donut here would misleadingly imply they do). One
    // shared soft tone across every multi-select question — no legend box
    // needed, the question label is the title, and the accent stays
    // reserved for the scale charts' average.
    const chartData: ChartData<'bar'> = {
      labels: options,
      datasets: [{
        data: options.map((o) => counts.get(o) ?? 0),
        backgroundColor: CHECKBOX_BASE,
        borderRadius: 4,
        maxBarThickness: 22,
      }],
    };
    return { question: q, entryType: 'checkbox', chartData, chartOptions: checkboxChartOptions(answeredCount), answeredCount, texts: [] };
  }

  if (q.type === 'slider') {
    // Labelled-category distribution — one stored string value per response,
    // counted against the question's own stops in their natural (non-
    // alphabetical, non-numeric) order, e.g. distanceTravelled's
    // "20m" → "200km". No average: averaging category labels is meaningless,
    // unlike a real numeric scale.
    const options = q.options ?? [];
    const counts  = new Map<string, number>(options.map((o) => [o, 0]));
    let answeredCount = 0;

    for (const v of rawValues) {
      if (typeof v === 'string' && counts.has(v)) {
        counts.set(v, (counts.get(v) ?? 0) + 1);
        answeredCount++;
      }
    }

    const chartData: ChartData<'bar'> = {
      labels: options,
      datasets: [{
        data: options.map((o) => counts.get(o) ?? 0),
        backgroundColor: SCALE_BASE,
        borderRadius: 4,
        maxBarThickness: 28,
      }],
    };
    return { question: q, entryType: 'slider', chartData, chartOptions: scaleChartOptions(), answeredCount, texts: [] };
  }

  // text
  const texts = rawValues.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  return { question: q, entryType: 'text', answeredCount: texts.length, texts };
}

function buildPageResults(exhibition: AdminExhibition, responses: ResponseRecord[]): PageResult[] {
  const [p1, ...rest] = FIXED_PAGES;
  const vqs  = exhibition.variableQuestions ?? [];
  const pages = [
    { ...p1, questions: [...p1.questions, ...vqs.map(mapVariableQuestion)] },
    ...rest,
  ];

  return pages.map((page) => ({
    title: page.title,
    questions: page.questions.map((q) => {
      const isFixed   = FIXED_QUESTION_KEYS.has(q.key);
      const rawValues = responses.map((r) => isFixed ? r.fixedAnswers[q.key] : r.variableAnswers[q.key]);
      return aggregateQuestion(q, rawValues);
    }),
  }));
}

// ── Component ──────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-dashboard',
  imports: [BarChart],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private readonly api  = inject(Api);
  private readonly route = inject(ActivatedRoute);
  readonly router        = inject(Router);

  readonly exhibition  = signal<AdminExhibition | null>(null);
  readonly loading     = signal(true);
  readonly error       = signal<string | null>(null);
  readonly pageResults = signal<PageResult[]>([]);
  readonly totalCount  = signal(0);
  readonly downloading = signal(false);

  private exhibitionId = '';

  ngOnInit(): void {
    this.exhibitionId = this.route.snapshot.paramMap.get('id') ?? '';

    // Fast path: the list screen passes the exhibition via router state.
    const state = window.history.state as { exhibition?: AdminExhibition };
    const cachedEx = state?.exhibition?.exhibitionId === this.exhibitionId
      ? state.exhibition
      : null;

    const exhibition$ = cachedEx
      ? of(cachedEx)
      : this.api.listAdminExhibitions().pipe(
          map(({ exhibitions }) => {
            const ex = exhibitions.find((e) => e.exhibitionId === this.exhibitionId);
            if (!ex) throw new Error('not found');
            return ex;
          })
        );

    forkJoin([exhibition$, this.api.listResponses(this.exhibitionId)]).subscribe({
      next: ([exhibition, { responses }]) => {
        this.exhibition.set(exhibition);
        this.totalCount.set(responses.length);
        this.pageResults.set(buildPageResults(exhibition, responses));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Fehler beim Laden der Daten.');
        this.loading.set(false);
      },
    });
  }

  // Height in px for a horizontal bar chart with n options.
  checkboxHeight(q: QuestionDef): number {
    return Math.max(120, (q.options?.length ?? 4) * 36 + 24);
  }

  // Angular templates don't narrow union types inside @switch, so these
  // typed accessors let us pass the correct type to [data] and [options].
  chartData(e: QuestionEntry): ChartData<'bar'>    { return e.chartData!; }
  chartOpts(e: QuestionEntry): ChartOptions<'bar'> { return e.chartOptions!; }

  downloadCsv(): void {
    if (this.downloading()) return;
    this.downloading.set(true);

    this.api.exportCsv(this.exhibitionId).subscribe({
      next: (csvText) => {
        this.downloading.set(false);
        const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `responses_${this.exhibitionId}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
      error: () => this.downloading.set(false),
    });
  }
}
