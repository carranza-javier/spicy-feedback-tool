import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Api, AdminExhibition, ExhibitionPayload, VariableQuestion } from '../../core/services/api';

function makeQuestionGroup(vq?: VariableQuestion): FormGroup {
  return new FormGroup({
    id:          new FormControl(vq?.id ?? `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
    text:        new FormControl(vq?.text ?? '', Validators.required),
    type:        new FormControl<'scale' | 'checkbox' | 'text'>(vq?.type ?? 'text'),
    min:         new FormControl<number | null>(vq?.min ?? 0),
    max:         new FormControl<number | null>(vq?.max ?? 10),
    labelMin:    new FormControl(vq?.labelMin ?? ''),
    labelMax:    new FormControl(vq?.labelMax ?? ''),
    optionsText: new FormControl(vq ? (vq.options ?? []).join('\n') : ''),
  });
}

@Component({
  selector: 'app-exhibition-edit',
  imports: [ReactiveFormsModule],
  templateUrl: './exhibition-edit.html',
  styleUrl: './exhibition-edit.scss',
})
export class ExhibitionEdit implements OnInit {
  private readonly api   = inject(Api);
  private readonly route = inject(ActivatedRoute);
  // router is used in template (back button) so not marked private.
  readonly router = inject(Router);

  readonly mode    = signal<'create' | 'edit'>('create');
  readonly loading = signal(false);
  readonly saving  = signal(false);
  readonly error   = signal<string | null>(null);

  private exhibitionId: string | null = null;

  readonly form = new FormGroup({
    name:              new FormControl('', { nonNullable: true, validators: Validators.required }),
    startDate:         new FormControl('', { nonNullable: true, validators: Validators.required }),
    endDate:           new FormControl('', { nonNullable: true, validators: Validators.required }),
    variableQuestions: new FormArray<FormGroup>([]),
  });

  get vqArray(): FormArray<FormGroup> {
    return this.form.controls.variableQuestions;
  }

  // Returns the FormGroup at index i (used in the template to avoid casts there).
  questionGroup(i: number): FormGroup {
    return this.vqArray.at(i) as FormGroup;
  }

  getQuestionType(i: number): 'scale' | 'checkbox' | 'text' {
    return this.vqArray.at(i).get('type')?.value ?? 'text';
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return; // create mode

    this.mode.set('edit');
    this.exhibitionId = id;

    // Fast path: data may arrive via router state when navigating from the list.
    const state = window.history.state as { exhibition?: AdminExhibition };
    if (state?.exhibition?.exhibitionId === id) {
      this.populate(state.exhibition);
      return;
    }

    // Fallback: fetch full list and find the exhibition (direct URL access).
    this.loading.set(true);
    this.api.listAdminExhibitions().subscribe({
      next: ({ exhibitions }) => {
        const ex = exhibitions.find((e) => e.exhibitionId === id);
        if (ex) {
          this.populate(ex);
        } else {
          this.error.set('Ausstellung nicht gefunden.');
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Fehler beim Laden der Ausstellung.');
        this.loading.set(false);
      },
    });
  }

  private populate(ex: AdminExhibition): void {
    this.form.patchValue({ name: ex.name, startDate: ex.startDate, endDate: ex.endDate });
    this.vqArray.clear();
    for (const vq of ex.variableQuestions ?? []) {
      this.vqArray.push(makeQuestionGroup(vq));
    }
  }

  addQuestion(): void {
    this.vqArray.push(makeQuestionGroup());
  }

  removeQuestion(i: number): void {
    this.vqArray.removeAt(i);
  }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);

    const payload = this.buildPayload();
    const request$ = this.mode() === 'create'
      ? this.api.createAdminExhibition(payload)
      : this.api.updateAdminExhibition(this.exhibitionId!, payload);

    request$.subscribe({
      next: () => this.router.navigate(['/admin/exhibitions']),
      error: (err) => {
        this.saving.set(false);
        this.error.set(err.error?.error ?? 'Speichern fehlgeschlagen. Bitte versuche es nochmal.');
      },
    });
  }

  private buildPayload(): ExhibitionPayload {
    const { name, startDate, endDate } = this.form.getRawValue();
    const variableQuestions: VariableQuestion[] = this.vqArray.controls.map((ctrl) => {
      const v = ctrl.getRawValue() as {
        id: string; text: string; type: 'scale' | 'checkbox' | 'text';
        min: number | null; max: number | null;
        labelMin: string; labelMax: string; optionsText: string;
      };
      const q: VariableQuestion = { id: v.id, text: v.text, type: v.type };
      if (v.type === 'scale') {
        q.min      = v.min ?? 0;
        q.max      = v.max ?? 10;
        q.labelMin = v.labelMin;
        q.labelMax = v.labelMax;
      }
      if (v.type === 'checkbox') {
        q.options = v.optionsText.split('\n').map((s) => s.trim()).filter(Boolean);
      }
      return q;
    });
    return { name, startDate, endDate, variableQuestions };
  }
}
