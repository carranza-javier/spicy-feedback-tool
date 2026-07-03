// GET /admin/exhibitions/{exhibitionId}/responses/csv
//
// Returns all responses for an exhibition as a CSV file.
//
// Column layout:
//   responseId, submittedAt,
//   <fixed answer columns in spec order>,
//   <one column per variable question, header = question text>
//
// Array values (e.g. checkbox multi-select) are joined with ' | ' so they
// fit in a single cell without breaking the CSV structure.

import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../lib/dynamoClient.mjs';

const EXHIBITIONS_TABLE = process.env.EXHIBITIONS_TABLE;
const RESPONSES_TABLE   = process.env.RESPONSES_TABLE;

// Fixed answer keys in the order they appear in the spec.
const FIXED_KEYS = [
  'emotionExhibition',
  'noteToArtist',
  'whatYouValue',
  'chiliRating',
  'whatConvinces',
  'visitorType',
  'distanceTravelled',
  'websiteEase',
  'howToImprove',
];

function csvCell(val) {
  if (val === null || val === undefined) return '';
  const str = Array.isArray(val) ? val.join(' | ') : String(val);
  // Wrap in double-quotes if the value contains a delimiter, quote, or newline.
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function buildCsv(exhibition, responses) {
  const vqs = exhibition.variableQuestions ?? [];

  const headerRow = [
    'responseId',
    'submittedAt',
    ...FIXED_KEYS,
    ...vqs.map((vq) => vq.text),
  ]
    .map(csvCell)
    .join(',');

  const dataRows = responses.map((r) => {
    const fixedCells  = FIXED_KEYS.map((k) => csvCell(r.fixedAnswers?.[k]));
    const varCells    = vqs.map((vq) => csvCell(r.variableAnswers?.[vq.id]));
    return [csvCell(r.responseId), csvCell(r.submittedAt), ...fixedCells, ...varCells].join(',');
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
