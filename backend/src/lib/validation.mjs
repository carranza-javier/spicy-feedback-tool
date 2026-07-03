// Input validation helpers.
// Each function either returns the validated (and lightly normalised) data
// or throws an Error whose message is safe to forward to the caller as a 400.

const VALID_QUESTION_TYPES = ['scale', 'checkbox', 'text'];

// ── validateExhibition ────────────────────────────────────────────────────────

/**
 * Validate the body of a create or update exhibition request.
 *
 * Required fields: name, startDate, endDate
 * Optional fields: variableQuestions (array of question objects)
 *
 * Each question must have: { id (string), text (string), type ('scale'|'checkbox'|'text') }
 * Checkbox questions also require: { options: string[] }  (non-empty)
 */
export function validateExhibition(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Request body must be a JSON object');
  }

  const { name, startDate, endDate, variableQuestions = [] } = body;

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

  if (!Array.isArray(variableQuestions)) {
    throw new Error('variableQuestions must be an array');
  }

  for (const [i, q] of variableQuestions.entries()) {
    if (!q.id || typeof q.id !== 'string') {
      throw new Error(`variableQuestions[${i}].id is required and must be a string`);
    }
    if (!q.text || typeof q.text !== 'string') {
      throw new Error(`variableQuestions[${i}].text is required and must be a string`);
    }
    if (!VALID_QUESTION_TYPES.includes(q.type)) {
      throw new Error(
        `variableQuestions[${i}].type must be one of: ${VALID_QUESTION_TYPES.join(', ')}`
      );
    }
    if (q.type === 'checkbox') {
      if (!Array.isArray(q.options) || q.options.length === 0) {
        throw new Error(
          `variableQuestions[${i}].options must be a non-empty array for checkbox questions`
        );
      }
      if (!q.options.every((o) => typeof o === 'string')) {
        throw new Error(`variableQuestions[${i}].options must be an array of strings`);
      }
    }
  }

  return {
    name: name.trim(),
    startDate,
    endDate,
    variableQuestions,
  };
}

// ── validateResponse ──────────────────────────────────────────────────────────

/**
 * Validate the body of a POST /responses request.
 *
 * Required fields: exhibitionId, fixedAnswers, variableAnswers
 *
 * Deep validation of individual answer values is intentionally left to the
 * handler, which can compare against the actual exhibition's question list.
 */
export function validateResponse(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Request body must be a JSON object');
  }

  const { exhibitionId, fixedAnswers, variableAnswers } = body;

  if (!exhibitionId || typeof exhibitionId !== 'string') {
    throw new Error('exhibitionId is required and must be a string');
  }
  if (!fixedAnswers || typeof fixedAnswers !== 'object' || Array.isArray(fixedAnswers)) {
    throw new Error('fixedAnswers is required and must be an object');
  }
  if (!variableAnswers || typeof variableAnswers !== 'object' || Array.isArray(variableAnswers)) {
    throw new Error('variableAnswers is required and must be an object');
  }

  return { exhibitionId, fixedAnswers, variableAnswers };
}
