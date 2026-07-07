// Input validation helpers.
// Each function either returns the validated (and lightly normalised) data
// or throws an Error whose message is safe to forward to the caller as a 400.

import { SECTION_KEYS } from './sections.mjs';

const VALID_QUESTION_TYPES = ['scale', 'checkbox', 'text', 'slider'];

// Shared shape rules for a single question object, used both for each entry
// in an exhibition's `questions` array and for a standalone question
// template. `label` is the field path used in error messages (e.g.
// `questions[2]` or `question`).
function validateQuestionShape(q, label) {
  if (!q.text || typeof q.text !== 'string') {
    throw new Error(`${label}.text is required and must be a string`);
  }
  if (!VALID_QUESTION_TYPES.includes(q.type)) {
    throw new Error(`${label}.type must be one of: ${VALID_QUESTION_TYPES.join(', ')}`);
  }
  if (!q.section || !SECTION_KEYS.includes(q.section)) {
    throw new Error(`${label}.section must be one of: ${SECTION_KEYS.join(', ')}`);
  }
  if (typeof q.order !== 'number') {
    throw new Error(`${label}.order is required and must be a number`);
  }
  if (q.type === 'checkbox' || q.type === 'slider') {
    if (!Array.isArray(q.options) || q.options.length === 0) {
      throw new Error(`${label}.options must be a non-empty array for ${q.type} questions`);
    }
    if (!q.options.every((o) => o && typeof o.id === 'string' && typeof o.text === 'string')) {
      throw new Error(`${label}.options must be an array of { id, text } objects`);
    }
  }
}

// ── validateExhibition ────────────────────────────────────────────────────────

/**
 * Validate the body of a create or update exhibition request.
 *
 * Required fields: name, startDate, endDate
 * Optional fields: questions (array of question objects)
 *
 * Each question must have:
 *   { id (string), text (string), type ('scale'|'checkbox'|'text'|'slider'),
 *     section (one of the fixed section keys), order (number) }
 * Checkbox/slider questions also require: { options: { id, text }[] }  (non-empty)
 */
export function validateExhibition(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Request body must be a JSON object');
  }

  const { name, startDate, endDate, questions = [] } = body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('name is required and must be a non-empty string');
  }
  if (!startDate || typeof startDate !== 'string' || isNaN(Date.parse(startDate))) {
    throw new Error('startDate is required and must be a valid ISO date string');
  }
  if (!endDate || typeof endDate !== 'string' || isNaN(Date.parse(endDate))) {
    throw new Error('endDate is required and must be a valid ISO date string');
  }
  if (Date.parse(endDate) <= Date.parse(startDate)) {
    throw new Error('endDate must be after startDate');
  }

  if (!Array.isArray(questions)) {
    throw new Error('questions must be an array');
  }

  for (const [i, q] of questions.entries()) {
    if (!q.id || typeof q.id !== 'string') {
      throw new Error(`questions[${i}].id is required and must be a string`);
    }
    validateQuestionShape(q, `questions[${i}]`);
  }

  return {
    name: name.trim(),
    startDate,
    endDate,
    questions,
  };
}

// ── validateResponse ──────────────────────────────────────────────────────────

/**
 * Validate the body of a POST /responses request.
 *
 * Required fields: exhibitionId, answers
 *
 * Deep validation of individual answer values is intentionally left to the
 * handler, which can compare against the actual exhibition's question list.
 */
export function validateResponse(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Request body must be a JSON object');
  }

  const { exhibitionId, answers } = body;

  if (!exhibitionId || typeof exhibitionId !== 'string') {
    throw new Error('exhibitionId is required and must be a string');
  }
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new Error('answers is required and must be an object');
  }

  return { exhibitionId, answers };
}

// ── validateQuestionTemplate ────────────────────────────────────────────────────

/**
 * Validate the body of a PUT /admin/question-templates/{templateId} request.
 * Same per-question shape rules as an exhibition's questions, minus `id`
 * (the templateId comes from the path, not the body).
 */
export function validateQuestionTemplate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Request body must be a JSON object');
  }

  validateQuestionShape(body, 'question');

  const { text, type, section, order, min, max, labelMin, labelMax, options, displayVariant } = body;

  return { text, type, section, order, min, max, labelMin, labelMax, options, displayVariant };
}
