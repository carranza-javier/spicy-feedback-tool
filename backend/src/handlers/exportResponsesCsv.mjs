// GET /admin/exhibitions/{exhibitionId}/responses/csv
//
// Returns all responses for an exhibition as a CSV file.
//
// Column layout:
//   responseId, submittedAt, <one column per question, in section+order,
//   header = question text>
//
// Every question — whether copied from a template or added freeform — lives
// in the exhibition's own `questions` array, so there's no fixed/variable
// split here anymore. Checkbox/slider answers are stored as option id(s);
// cells resolve them back to that question's own option text before writing.
// Array values (checkbox multi-select) are joined with ' | ' so they fit in
// a single cell without breaking the CSV structure.

import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../lib/dynamoClient.mjs';
import { SECTION_KEYS } from '../lib/sections.mjs';

const EXHIBITIONS_TABLE = process.env.EXHIBITIONS_TABLE;
const RESPONSES_TABLE   = process.env.RESPONSES_TABLE;

function csvCell(val) {
  if (val === null || val === undefined) return '';
  const str = Array.isArray(val) ? val.join(' | ') : String(val);
  // Wrap in double-quotes if the value contains a delimiter, quote, or newline.
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function resolveOptionText(q, optionId) {
  return q.options?.find((o) => o.id === optionId)?.text ?? optionId;
}

// Resolve a stored answer to its displayable form: checkbox answers are an
// array of option ids, slider answers are a single option id, everything
// else (scale numbers, free text) passes through unchanged.
function resolveAnswer(q, rawValue) {
  if (rawValue === null || rawValue === undefined) return rawValue;
  if (q.type === 'checkbox' && Array.isArray(rawValue)) {
    return rawValue.map((id) => resolveOptionText(q, id));
  }
  if (q.type === 'slider' && typeof rawValue === 'string') {
    return resolveOptionText(q, rawValue);
  }
  return rawValue;
}

function sortedQuestions(exhibition) {
  const questions = exhibition.questions ?? [];
  return [...questions].sort((a, b) => {
    const sectionDiff = SECTION_KEYS.indexOf(a.section) - SECTION_KEYS.indexOf(b.section);
    return sectionDiff !== 0 ? sectionDiff : a.order - b.order;
  });
}

function buildCsv(exhibition, responses) {
  const questions = sortedQuestions(exhibition);

  const headerRow = ['responseId', 'submittedAt', ...questions.map((q) => q.text)]
    .map(csvCell)
    .join(',');

  const dataRows = responses.map((r) => {
    const cells = questions.map((q) => csvCell(resolveAnswer(q, r.answers?.[q.id])));
    return [csvCell(r.responseId), csvCell(r.submittedAt), ...cells].join(',');
  });

  return [headerRow, ...dataRows].join('\r\n');
}

export const handler = async (event) => {
  const exhibitionId = event.pathParameters?.exhibitionId;
  if (!exhibitionId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'exhibitionId path parameter is required' }),
    };
  }

  const [{ Item: exhibition }, { Items: responses = [] }] = await Promise.all([
    dynamo.send(new GetCommand({ TableName: EXHIBITIONS_TABLE, Key: { exhibitionId } })),
    dynamo.send(
      new QueryCommand({
        TableName: RESPONSES_TABLE,
        KeyConditionExpression: 'exhibitionId = :id',
        ExpressionAttributeValues: { ':id': exhibitionId },
      })
    ),
  ]);

  if (!exhibition) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Exhibition not found' }),
    };
  }

  const filename = `responses_${exhibitionId}.csv`;
  const csv = buildCsv(exhibition, responses);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
    body: csv,
  };
};
