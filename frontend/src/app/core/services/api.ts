import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// ── Domain types ───────────────────────────────────────────────────────────────
// These mirror the shapes returned/accepted by the Lambda handlers.

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  text: string;
  type: 'scale' | 'checkbox' | 'text' | 'slider';
  section: string;       // one of the fixed SECTION_KEYS
  order: number;         // position within its section
  options?: QuestionOption[]; // checkbox / slider
  min?: number;          // scale
  max?: number;          // scale
  labelMin?: string;     // scale
  labelMax?: string;     // scale
  displayVariant?: 'chili'; // cosmetic — chili rating renders as 🌶️ icons
  sourceTemplateId?: string; // informational only, set when copied from a template
}

export interface QuestionTemplate {
  templateId: string;
  text: string;
  type: 'scale' | 'checkbox' | 'text' | 'slider';
  section: string;
  order: number;
  options?: QuestionOption[];
  min?: number;
  max?: number;
  labelMin?: string;
  labelMax?: string;
  displayVariant?: 'chili';
}

export interface Exhibition {
  exhibitionId: string;
  name: string;
  startDate: string;
  endDate: string;
  questions: Question[];
  createdAt: string;
}

export interface ActiveExhibitionResponse {
  status: 'active' | 'multiple' | 'closed' | 'none';
  // Present when status === 'active'
  exhibition?: Exhibition;
  // Present when status === 'multiple' (overlapping active exhibitions)
  exhibitions?: { exhibitionId: string; name: string; startDate: string; endDate: string }[];
  // Present when status === 'closed'
  lastExhibition?: { exhibitionId: string; name: string; endDate: string };
}

export interface ExhibitionByIdResponse {
  status: 'active';
  exhibition: Exhibition;
}

export interface SubmitResponsePayload {
  exhibitionId: string;
  answers: Record<string, unknown>;
}

export interface AdminExhibition extends Exhibition {
  responseCount: number;
}

export type ExhibitionPayload = Pick<Exhibition, 'name' | 'startDate' | 'endDate' | 'questions'>;

export type QuestionTemplatePayload = Omit<QuestionTemplate, 'templateId'>;

export interface ResponseRecord {
  exhibitionId: string;
  responseId: string;
  answers: Record<string, unknown>;
  submittedAt: string;
}

// ── Service ────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  // ── Public endpoints ────────────────────────────────────────────────────────

  getActiveExhibition(): Observable<ActiveExhibitionResponse> {
    return this.http.get<ActiveExhibitionResponse>(`${this.base}/exhibitions/active`);
  }

  getExhibitionById(exhibitionId: string): Observable<ExhibitionByIdResponse> {
    return this.http.get<ExhibitionByIdResponse>(`${this.base}/exhibitions/${exhibitionId}`);
  }

  submitResponse(payload: SubmitResponsePayload): Observable<{ responseId: string }> {
    return this.http.post<{ responseId: string }>(`${this.base}/responses`, payload);
  }

  // ── Admin endpoints ────────────────────────────────────────────────────────

  login(username: string, password: string): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${this.base}/auth/login`, { username, password });
  }

  listAdminExhibitions(): Observable<{ exhibitions: AdminExhibition[] }> {
    return this.http.get<{ exhibitions: AdminExhibition[] }>(`${this.base}/admin/exhibitions`);
  }

  createAdminExhibition(payload: ExhibitionPayload): Observable<{ exhibition: Exhibition }> {
    return this.http.post<{ exhibition: Exhibition }>(`${this.base}/admin/exhibitions`, payload);
  }

  updateAdminExhibition(id: string, payload: ExhibitionPayload): Observable<unknown> {
    return this.http.put(`${this.base}/admin/exhibitions/${id}`, payload);
  }

  listResponses(exhibitionId: string): Observable<{ responses: ResponseRecord[] }> {
    return this.http.get<{ responses: ResponseRecord[] }>(
      `${this.base}/admin/exhibitions/${exhibitionId}/responses`
    );
  }

  exportCsv(exhibitionId: string): Observable<string> {
    return this.http.get(
      `${this.base}/admin/exhibitions/${exhibitionId}/responses/csv`,
      { responseType: 'text' }
    );
  }

  listQuestionTemplates(): Observable<{ templates: QuestionTemplate[] }> {
    return this.http.get<{ templates: QuestionTemplate[] }>(`${this.base}/admin/question-templates`);
  }

  updateQuestionTemplate(templateId: string, payload: QuestionTemplatePayload): Observable<unknown> {
    return this.http.put(`${this.base}/admin/question-templates/${templateId}`, payload);
  }
}
