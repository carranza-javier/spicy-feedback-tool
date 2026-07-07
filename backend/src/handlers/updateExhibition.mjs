// PUT /admin/exhibitions/{exhibitionId}
//
// Validates the request body and updates name, startDate, endDate, and
// questions on an existing exhibition.  Uses a ConditionExpression to
// detect missing items atomically — no separate GetCommand needed, except
// when the questions-locked check below needs the current stored value.
//
// Once an exhibition has ≥1 response, its `questions` are locked — no
// add/remove/edit of questions, type, range, or options, to prevent
// silently corrupting already-collected data. name/startDate/endDate stay
// editable regardless. The frontend also disables the questions UI in this
// case, but that's a convenience only — this check is the authoritative
// guard, since nothing stops a direct API call.

import { GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../lib/dynamoClient.mjs';
import { validateExhibition } from '../lib/validation.mjs';

const EXHIBITIONS_TABLE = process.env.EXHIBITIONS_TABLE;
const RESPONSES_TABLE   = process.env.RESPONSES_TABLE;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// Deterministic, order-independent comparison of two question lists —
// sorted by id and normalised to a fixed key order/shape so it isn't
// tripped up by incidental differences in array or object-key order
// between what's stored and what the client resubmits.
function canonicalizeQuestions(questions) {
  return [...(questions ?? [])]
    .map((q) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      section: q.section,
      order: q.order,
      min: q.min ?? null,
      max: q.max ?? null,
      labelMin: q.labelMin ?? null,
      labelMax: q.labelMax ?? null,
      options: (q.options ?? []).map((o) => ({ id: o.id, text: o.text })),
      displayVariant: q.displayVariant ?? null,
      sourceTemplateId: q.sourceTemplateId ?? null,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function questionsEqual(a, b) {
  return JSON.stringify(canonicalizeQuestions(a)) === JSON.stringify(canonicalizeQuestions(b));
}

export const handler = async (event) => {
  const exhibitionId = event.pathParameters?.exhibitionId;
  if (!exhibitionId) {
    return json(400, { error: 'exhibitionId path parameter is required' });
  }

  let rawBody;
  try {
    rawBody = JSON.parse(event.body ?? '{}');
  } catch {
    return json(400, { error: 'Request body must be valid JSON' });
  }

  let validated;
  try {
    validated = validateExhibition(rawBody);
  } catch (err) {
    return json(400, { error: err.message });
  }

  // Cheap existence check — Limit: 1, not a full count.
  const { Items: someResponse = [] } = await dynamo.send(
    new QueryCommand({
      TableName: RESPONSES_TABLE,
      KeyConditionExpression: 'exhibitionId = :id',
      ExpressionAttributeValues: { ':id': exhibitionId },
      Limit: 1,
    })
  );

  if (someResponse.length > 0) {
    const { Item: current } = await dynamo.send(
      new GetCommand({ TableName: EXHIBITIONS_TABLE, Key: { exhibitionId } })
    );
    if (current && !questionsEqual(current.questions, validated.questions)) {
      return json(409, {
        error: 'This exhibition already has responses — its questions can no longer be changed. Name and dates can still be edited.',
      });
    }
  }

  try {
    await dynamo.send(
      new UpdateCommand({
        TableName: EXHIBITIONS_TABLE,
        Key: { exhibitionId },
        // 'name' is a DynamoDB reserved word — alias it with #n.
        UpdateExpression:
          'SET #n = :name, startDate = :startDate, endDate = :endDate, questions = :questions',
        ConditionExpression: 'attribute_exists(exhibitionId)',
        ExpressionAttributeNames: { '#n': 'name' },
        ExpressionAttributeValues: {
          ':name':      validated.name,
          ':startDate': validated.startDate,
          ':endDate':   validated.endDate,
          ':questions': validated.questions,
        },
      })
    );
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return json(404, { error: 'Exhibition not found' });
    }
    throw err;
  }

  return json(200, { exhibitionId, ...validated });
};
