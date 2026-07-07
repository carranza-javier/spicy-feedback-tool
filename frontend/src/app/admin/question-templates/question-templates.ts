import { Component, OnInit, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Api, QuestionOption, QuestionTemplate, QuestionTemplatePayload } from '../../core/services/api';
import { SECTIONS, SECTION_KEYS } from '../../shared/sections';

function makeOptionGroup(opt?: QuestionOption): FormGroup {
  return new FormGroup({
    id:   new FormControl(opt?.id ?? `opt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
    text: new FormControl(opt?.text ?? ''),
  });
}

function makeTemplateGroup(t: QuestionTemplate): FormGroup {
  return new FormGroup({
    templateId:     new FormControl(t.templateId),
    text:           new FormControl(t.text, Validators.required),
    type:           new FormControl<QuestionTemplate['type']>(t.type),
    section:        new FormControl<string>(t.section),
    order:          new FormControl<number>(t.order),
    min:            new FormControl<number | null>(t.min ?? 0),
    max:            new FormControl<number | null>(t.max ?? 10),
    labelMin:       new FormControl(t.labelMin ?? ''),
    labelMax:       new FormControl(t.labelMax ?? ''),
    options:        new FormArray<FormGroup>((t.options ?? []).map(makeOptionGroup)),
    displayVariant: new FormControl<'chili' | null>(t.displayVariant ?? null),
  });
}

@Component({
  selector: 'app-question-templates',
  imports: [ReactiveFormsModule],
  templateUrl: './question-templates.html',
  styleUrl: './question-templates.scss',
})
export class QuestionTemplates implements OnInit {
  private readonly api = inject(Api);
  readonly router = inject(Router);

  readonly sections = SECTIONS;
  readonly loading  = signal(true);
  readonly error    = signal<string | null>(null);
  readonly savingId = signal<string | null>(null);
  readonly savedId  = signal<string | null>(null);

  readonly groups = signal<FormGroup[]>([]);

  ngOnInit(): void {
    this.api.listQuestionTemplates().subscribe({
      next: ({ templates }) => {
        const sorted = [...templates].sort((a, b) => {
          const sd = SECTION_KEYS.indexOf(a.section) - SECTION_KEYS.indexOf(b.section);
          return sd !== 0 ? sd : a.order - b.order;
        });
        this.groups.set(sorted.map(makeTemplateGroup));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Fehler beim Laden der Vorlagen.');
        this.loading.set(false);
      },
    });
  }

  groupsForSection(sectionKey: string): FormGroup[] {
    return this.groups().filter((g) => g.get('section')?.value === sectionKey);
  }

  getType(g: FormGroup): QuestionTemplate['type'] {
    return g.get('type')?.value ?? 'text';
  }

  optionsArray(g: FormGroup): FormArray<FormGroup> {
    return g.get('options') as FormArray<FormGroup>;
  }

  addOption(g: FormGroup): void {
    this.optionsArray(g).push(makeOptionGroup());
  }

  removeOption(g: FormGroup, i: number): void {
    this.optionsArray(g).removeAt(i);
  }

  save(g: FormGroup): void {
    g.markAllAsTouched();
    if (g.invalid) return;

    const v = g.getRawValue() as {
      templateId: string; text: string; type: QuestionTemplate['type']; section: string; order: number;
      min: number | null; max: number | null; labelMin: string; labelMax: string;
      options: { id: string; text: string }[]; displayVariant: 'chili' | null;
    };

    this.savingId.set(v.templateId);
    this.savedId.set(null);

    const payload: QuestionTemplatePayload = {
      text: v.text,
      type: v.type,
      section: v.section,
      order: v.order,
      ...(v.type === 'scale'
        ? { min: v.min ?? 0, max: v.max ?? 10, labelMin: v.labelMin, labelMax: v.labelMax }
        : {}),
      ...(v.type === 'checkbox' || v.type === 'slider'
        ? { options: v.options.map((o) => ({ id: o.id, text: o.text.trim() })).filter((o) => o.text) }
        : {}),
      ...(v.displayVariant ? { displayVariant: v.displayVariant } : {}),
    };

    this.api.updateQuestionTemplate(v.templateId, payload).subscribe({
      next: () => {
        this.savingId.set(null);
        this.savedId.set(v.templateId);
      },
      error: () => {
        this.savingId.set(null);
        this.error.set('Speichern fehlgeschlagen. Bitte versuche es nochmal.');
      },
    });
  }
}
