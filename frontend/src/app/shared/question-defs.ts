import { Question } from '../core/services/api';
import { SECTIONS } from './sections';

export interface PageDef {
  title: string;
  questions: Question[];
}

/**
 * Groups a flat, exhibition-owned question list into per-section pages, in
 * SECTIONS order. Sections with no questions are skipped entirely — an
 * admin can remove every question from a section without leaving a blank
 * page in the survey/dashboard flow.
 */
export function groupBySection(questions: Question[]): PageDef[] {
  return SECTIONS.map((s) => ({
    title: s.title,
    questions: questions
      .filter((q) => q.section === s.key)
      .sort((a, b) => a.order - b.order),
  })).filter((page) => page.questions.length > 0);
}
