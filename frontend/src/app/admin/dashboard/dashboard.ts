import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { ChartData, ChartOptions } from 'chart.js';
import { Api, AdminExhibition, Question, ResponseRecord } from '../../core/services/api';
import { BarChart } from '../../shared/bar-chart/bar-chart';
import { groupBySection } from '../../shared/question-defs';

// ── Result types ───────────────────────────────────────────────────────────────

interface QuestionEntry {
  question: Question;
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
// Admin-only — the public survey stays strictly black/white. Two sequential
// ramps + one accent, assigned by the JOB the question's data does:
//   Ocean  (blue → teal, light → dark)   — scale + slider distributions:
//     each BAR is shaded by its own bin POSITION (lightest at the low end,
//     deepest at the high end) — bin order is the meaning, so position is
//     what the ramp encodes.
//   Orchid (soft lilac → muted purple)   — checkbox multi-select: each BAR
//     is shaded by its own RESPONSE COUNT relative to that question's
//     min/max count (fewest = lightest lilac, most = deepest purple), not by
//     option position. This is a deliberate redundancy with bar length —
//     colour answers "which options are winning" at a glance, which reads
//     faster than comparing bar lengths one by one. Two options tied on
//     count render in the identical tone, reinforcing "equally popular"
//     instead of implying a false ranking between them. (Previously this
//     used one fixed tone per OPTION position instead — reverted per user
//     feedback: within one question, seeing the "winners" via colour was
//     judged more useful than a stable per-option identity, even though the
//     colour is now redundant with bar length.) Kept deliberately SOFT/
//     pastel rather than saturated — an internal admin screen still reads
//     better calm than loud.
//   Coral  (single accent)               — reserved exclusively for
//     flagging the average on scale charts (the bucket nearest the average
//     gets this colour instead of its ramp position, plus the Ø number),
//     never reused elsewhere, so it stays meaningful.
//
// Scale/slider stay BARS, not a connected line/area — the buckets are
// independent counts ("how many people picked X"), and a line between them
// would visually imply a trend or continuity that isn't there (worst for the
// distance slider, whose "values" are unrelated distance bands, not points
// on a continuum).
const OCEAN_LIGHT  = '#cfe1f5';
const OCEAN_MID    = '#5c93c9';
const OCEAN_DEEP   = '#0e8f6f';
const ORCHID_LIGHT = '#e7d3ee'; // soft pale lilac — fewest responses
const ORCHID_MID   = '#cda1d9';
const ORCHID_DEEP  = '#8f69ab'; // muted purple, not vivid — most responses
const CORAL        = '#e2543f'; // keep in sync with dashboard.scss's --db-coral

// ── Colour helpers ─────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  return '#' + [mix(r1, r2), mix(g1, g2), mix(b1, b2)]
    .map((v) => v.toString(16).padStart(2, '0')).join('');
}

// One hue family, light → dark, as a function of `t` in [0, 1]. Shared
// factory for both sequential ramps below — only the anchor colours differ.
function makeRamp(light: string, mid: string, deep: string) {
  return (t: number): string => {
    const clamped = Math.max(0, Math.min(1, t));
    return clamped <= 0.5
      ? mixHex(light, mid, clamped / 0.5)
      : mixHex(mid, deep, (clamped - 0.5) / 0.5);
  };
}

// Scale/slider: `t` = bin index / (stepCount - 1) — position in the ordered
// range is the meaning.
const rampColor = makeRamp(OCEAN_LIGHT, OCEAN_MID, OCEAN_DEEP);
// Checkbox: `t` = this option's count, normalised against the question's own
// min/max count — magnitude is the meaning here, not position.
const orchidRampColor = makeRamp(ORCHID_LIGHT, ORCHID_MID, ORCHID_DEEP);

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
        ticks: { font: { family: 'Work Sans, sans-serif', size: 13 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: '#eeeeee' },
        ticks: {
          stepSize: 1,
          precision: 0,
          font: { family: 'Work Sans, sans-serif', size: 13 },
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
          font: { family: 'Work Sans, sans-serif', size: 13 },
        },
      },
      y: {
        grid: { display: false },
        ticks: { font: { family: 'Work Sans, sans-serif', size: 13 } },
      },
    },
  };
}

// ── Aggregation helpers ────────────────────────────────────────────────────────

function aggregateQuestion(q: Question, rawValues: unknown[]): QuestionEntry {
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

    // Emphasis: every bucket takes its own Ocean-ramp position (light at the
    // low end, deep teal at the high end) except the one nearest the
    // average, which carries the Coral accent — the visual answer to
    // "where's the average" instead of just the number above the chart.
    const averageIndex = answeredCount > 0
      ? Math.min(steps.length - 1, Math.max(0, Math.round(average) - min))
      : -1;
    const rampSpan = Math.max(1, steps.length - 1);
    const backgroundColor = steps.map((_, i) => (i === averageIndex ? CORAL : rampColor(i / rampSpan)));

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
    // Counting is keyed by option ID, not text — an option's display text
    // can be edited later without silently dropping historical responses
    // that selected it (they still reference the same stable id).
    const options = q.options ?? [];
    const counts  = new Map<string, number>(options.map((o) => [o.id, 0]));
    let answeredCount = 0;

    for (const v of rawValues) {
      if (Array.isArray(v) && v.length > 0) {
        answeredCount++;
        for (const optId of v as string[]) {
          if (counts.has(optId)) counts.set(optId, (counts.get(optId) ?? 0) + 1);
        }
      }
    }

    // Multi-select — honest as a horizontal bar (percentages don't sum to
    // 100%, so a pie/donut here would misleadingly imply that they do).
    // Coloured by each option's own RESPONSE COUNT, normalised against this
    // question's min/max count (fewest → lightest lilac, most → deepest
    // purple) — same ramp technique as the Ocean scale/slider bars, just
    // keyed by count instead of position. Two options tied on count get the
    // identical tone; if every option is tied (including all-zero), there's
    // no spread to encode, so all render at the ramp's midpoint rather than
    // defaulting to either end.
    const counted = options.map((o) => counts.get(o.id) ?? 0);
    const countMin = counted.length ? Math.min(...counted) : 0;
    const countMax = counted.length ? Math.max(...counted) : 0;
    const countSpan = countMax - countMin;
    const backgroundColor = counted.map((c) =>
      orchidRampColor(countSpan > 0 ? (c - countMin) / countSpan : 0.5)
    );

    const chartData: ChartData<'bar'> = {
      labels: options.map((o) => o.text),
      datasets: [{
        data: counted,
        backgroundColor,
        borderRadius: 4,
        maxBarThickness: 22,
      }],
    };
    return { question: q, entryType: 'checkbox', chartData, chartOptions: checkboxChartOptions(answeredCount), answeredCount, texts: [] };
  }

  if (q.type === 'slider') {
    // Labelled-category distribution — one stored option id per response,
    // counted against the question's own stops in their natural (non-
    // alphabetical, non-numeric) order, e.g. distanceTravelled's
    // "20m" → "200km". No average: averaging category labels is meaningless,
    // unlike a real numeric scale. Same ordered-single-series shape as
    // scale, so it shares the Ocean ramp, one bar per stop, light→dark.
    const options = q.options ?? [];
    const counts  = new Map<string, number>(options.map((o) => [o.id, 0]));
    let answeredCount = 0;

    for (const v of rawValues) {
      if (typeof v === 'string' && counts.has(v)) {
        counts.set(v, (counts.get(v) ?? 0) + 1);
        answeredCount++;
      }
    }

    const rampSpan = Math.max(1, options.length - 1);
    const chartData: ChartData<'bar'> = {
      labels: options.map((o) => o.text),
      datasets: [{
        data: options.map((o) => counts.get(o.id) ?? 0),
        backgroundColor: options.map((_, i) => rampColor(i / rampSpan)),
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
  const pages = groupBySection(exhibition.questions ?? []);
  return pages.map((page) => ({
    title: page.title,
    questions: page.questions.map((q) => {
      const rawValues = responses.map((r) => r.answers[q.id]);
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

  // Free-browsing tabs, one per section — not a sequential Weiter/Zurück
  // flow like the survey. Total count + CSV stay outside this, in the
  // header, since they're exhibition-wide, not per-section.
  readonly activeTab = signal(0);
  readonly activeSection = computed<PageResult | null>(() => {
    const pages = this.pageResults();
    return pages[this.activeTab()] ?? pages[0] ?? null;
  });

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

  selectTab(i: number): void {
    this.activeTab.set(i);
  }

  onSectionSelect(event: Event): void {
    this.selectTab(Number((event.target as HTMLSelectElement).value));
  }

  // Height in px for a horizontal bar chart with n options.
  checkboxHeight(q: Question): number {
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
