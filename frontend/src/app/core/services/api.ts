import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// ── Domain types ───────────────────────────────────────────────────────────────
// These mirror the shapes returned/accepted by the Lambda handlers.

export interface VariableQuestion {
  id: string;
  text: string;
  type: 'scale' | 'checkbox' | 'text';
  options?: string[];   // checkbox
  min?: number;         // scale
  max?: number;         // scale
  labelMin?: string;    // scale
  labelMax?: string;    // scale
}

export interface Exhibition {
  exhibitionId: string;
  name: string;
  startDate: string;
  endDate: string;
  variableQuestions: VariableQuestion[];
  createdAt: string;
}

export interface ActiveExhibitionResponse {
  status: 'active' | 'closed' | 'none';
  // Present when status === 'active'
  exhibition?: Exhibition;
  // Present when status === 'closed'
  lastExhibition?: { exhibitionId: string; name: string; endDate: string };
}

export interface SubmitResponsePayload {
  exhibitionId: string;
  fixedAnswers: Record<string, unknown>;
  variableAnswers: Record<string, unknown>;
}

export interface AdminExhibition extends Exhibition {
  responseCount: number;
}

export type ExhibitionPayload = Pick<Exhibition, 'name' | 'startDate' | 'endDate' | 'variableQuestions'>;

export interface ResponseRecord {
  exhibitionId: string;
  responseId: string;
  fixedAnswers: Record<string, unknown>;
  variableAnswers: Record<string, unknown>;
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
}
