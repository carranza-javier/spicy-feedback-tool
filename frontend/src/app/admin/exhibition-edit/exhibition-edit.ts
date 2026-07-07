import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Api,
  AdminExhibition,
  ExhibitionPayload,
  Question,
  QuestionOption,
  QuestionTemplate,
} from '../../core/services/api';
import { SECTIONS, SECTION_KEYS } from '../../shared/sections';

function makeOptionGroup(opt?: QuestionOption): FormGroup {
  return new FormGroup({
    id:   new FormControl(opt?.id ?? `opt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
    text: new FormControl(opt?.text ?? ''),
  });
}

function makeQuestionGroup(q?: Question): FormGroup {
  return new FormGroup({
    id:               new FormControl(q?.id ?? `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
    text:             new FormControl(q?.text ?? '', Validators.required),
    type:             new FormControl<Question['type']>(q?.type ?? 'text'),
    section:          new FormControl<string>(q?.section ?? SECTIONS[0].key),
    min:              new FormControl<number | null>(q?.min ?? 0),
    max:              new FormControl<number | null>(q?.max ?? 10),
    labelMin:         new FormControl(q?.labelMin ?? ''),
    labelMax:         new FormControl(q?.labelMax ?? ''),
    options:          new FormArray<FormGroup>((q?.options ?? []).map(makeOptionGroup)),
    // Not admin-editable through this form — carried through untouched so
    // saving an existing question never loses its cosmetic/provenance info.
    displayVariant:   new FormControl<'chili' | null>(q?.displayVariant ?? null),
    sourceTemplateId: new FormControl<string | null>(q?.sourceTemplateId ?? null),
  });
}

// A new exhibition's question list starts as fresh, independent copies of
// the question templates — copying happens here, client-side, not on the
// server. Each copy gets its own id; editing it afterwards never touches
// the template or any other exhibition.
function mapTemplateToQuestion(t: QuestionTemplate): Question {
  return {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    text: t.text,
    type: t.type,
    section: t.section,
    order: t.order,
    options: t.options,
    min: t.min,
    max: t.max,
    labelMin: t.labelMin,
    labelMax: t.labelMax,
    displayVariant: t.displayVariant,
    sourceTemplateId: t.templateId,
  };
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

  readonly sections = SECTIONS;

  readonly mode    = signal<'create' | 'edit'>('create');
  readonly loading = signal(false);
  readonly saving  = signal(false);
  readonly error   = signal<string | null>(null);

  // Once an exhibition has ≥1 response, its questions are locked — this is
  // a UX convenience only; updateExhibition.mjs enforces the same rule
  // server-side regardless. Reuses the responseCount already computed by
  // listExhibitions.mjs rather than issuing a separate count call.
  readonly questionsLocked = signal(false);

  private exhibitionId: string | null = null;

  readonly form = new FormGroup({
    name:      new FormControl('', { nonNullable: true, validators: Validators.required }),
    startDate: new FormControl('', { nonNullable: true, validators: Validators.required }),
    endDate:   new FormControl('', { nonNullable: true, validators: Validators.required }),
    questions: new FormArray<FormGroup>([]),
  });

  get questionsArray(): FormArray<FormGroup> {
    return this.form.controls.questions;
  }

  // Questions grouped by section, for display — position in the flat
  // FormArray still doubles as the per-section order (see buildPayload).
  controlsForSection(sectionKey: string): { control: FormGroup; index: number }[] {
    return this.questionsArray.controls
      .map((control, index) => ({ control: control as FormGroup, index }))
      .filter(({ control }) => control.get('section')?.value === sectionKey);
  }

  getQuestionType(control: FormGroup): Question['type'] {
    return control.get('type')?.value ?? 'text';
  }

  optionsArray(control: FormGroup): FormArray<FormGroup> {
    return control.get('options') as FormArray<FormGroup>;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      // Create mode — pre-populate the question list from the current
      // templates. This is a one-time copy: whatever gets saved becomes
      // this exhibition's own independent question list.
      this.loading.set(true);
      this.api.listQuestionTemplates().subscribe({
        next: ({ templates }) => {
          const sorted = [...templates].sort((a, b) => {
            const sd = SECTION_KEYS.indexOf(a.section) - SECTION_KEYS.indexOf(b.section);
            return sd !== 0 ? sd : a.order - b.order;
          });
          for (const t of sorted) {
            this.questionsArray.push(makeQuestionGroup(mapTemplateToQuestion(t)));
          }
          this.loading.set(false);
        },
        // Templates failing to load shouldn't block creating an exhibition —
        // the admin can still build the question list from scratch.
        error: () => this.loading.set(false),
      });
      return;
    }

    this.mode.set('edit');
    this.exhibitionId = id;

    // Fast path: data may arrive via router state when navigating from the list.
    const state = window.history.state as { exhibition?: AdminExhibition };
    if (state?.exhibition?.exhibitionId === id) {
      this.populate(state.exhibition);
      // Router state can be stale — the browser keeps it for that history
      // entry across a reload, and a response may have been submitted
      // since the admin navigated here. A false "unlocked" questions
      // section would defeat the point of the lock (the backend still
      // rejects the write either way, but the UI shouldn't let an admin
      // start editing questions it's about to reject). Always re-verify
      // the response count fresh before trusting it.
      this.api.listAdminExhibitions().subscribe({
        next: ({ exhibitions }) => {
          const fresh = exhibitions.find((e) => e.exhibitionId === id);
          if (fresh) this.applyLockState(fresh.responseCount);
        },
        error: () => {}, // keep whatever populate() already applied from the cache
      });
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
    this.questionsArray.clear();
    const sorted = [...(ex.questions ?? [])].sort((a, b) => {
      const sd = SECTION_KEYS.indexOf(a.section) - SECTION_KEYS.indexOf(b.section);
      return sd !== 0 ? sd : a.order - b.order;
    });
    for (const q of sorted) {
      this.questionsArray.push(makeQuestionGroup(q));
    }

    this.applyLockState(ex.responseCount ?? 0);
  }

  // Disabling here cascades through the whole FormArray/FormGroup tree,
  // including each question's own options FormArray — disabled controls
  // still submit their value via getRawValue(), so the payload sent back
  // on save is unchanged, which is exactly what the backend's equality
  // check expects.
  private applyLockState(responseCount: number): void {
    const locked = responseCount > 0;
    this.questionsLocked.set(locked);
    if (locked) {
      this.questionsArray.disable();
    } else {
      this.questionsArray.enable();
    }
  }

  addQuestion(sectionKey: string): void {
    if (this.questionsLocked()) return;
    const group = makeQuestionGroup();
    group.patchValue({ section: sectionKey });
    this.questionsArray.push(group);
  }

  removeQuestion(i: number): void {
    if (this.questionsLocked()) return;
    this.questionsArray.removeAt(i);
  }

  addOption(control: FormGroup): void {
    if (this.questionsLocked()) return;
    this.optionsArray(control).push(makeOptionGroup());
  }

  removeOption(control: FormGroup, i: number): void {
    if (this.questionsLocked()) return;
    this.optionsArray(control).removeAt(i);
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

    // order = position among same-section questions, in current array
    // order — there's no manual reorder control, so this is simply derived
    // fresh from array position every save.
    const orderBySection: Record<string, number> = {};

    const questions: Question[] = this.questionsArray.controls.map((ctrl) => {
      const v = ctrl.getRawValue() as {
        id: string; text: string; type: Question['type']; section: string;
        min: number | null; max: number | null; labelMin: string; labelMax: string;
        options: { id: string; text: string }[];
        displayVariant: 'chili' | null; sourceTemplateId: string | null;
      };

      const order = orderBySection[v.section] ?? 0;
      orderBySection[v.section] = order + 1;

      const q: Question = { id: v.id, text: v.text, type: v.type, section: v.section, order };
      if (v.type === 'scale') {
        q.min      = v.min ?? 0;
        q.max      = v.max ?? 10;
        q.labelMin = v.labelMin;
        q.labelMax = v.labelMax;
      }
      if (v.type === 'checkbox' || v.type === 'slider') {
        q.options = v.options
          .map((o) => ({ id: o.id, text: o.text.trim() }))
          .filter((o) => o.text);
      }
      if (v.displayVariant) q.displayVariant = v.displayVariant;
      if (v.sourceTemplateId) q.sourceTemplateId = v.sourceTemplateId;
      return q;
    });

    return { name, startDate, endDate, questions };
  }
}
