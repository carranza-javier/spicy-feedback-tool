// PUT /admin/exhibitions/{exhibitionId}
//
// Validates the request body and updates name, startDate, endDate, and
// variableQuestions on an existing exhibition.  Uses a ConditionExpression
// to detect missing items atomically — no separate GetCommand needed.

import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../lib/dynamoClient.mjs';
import { validateExhibition } from '../lib/validation.mjs';

const EXHIBITIONS_TABLE = process.env.EXHIBITIONS_TABLE;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

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

  try {
    await dynamo.send(
      new UpdateCommand({
        TableName: EXHIBITIONS_TABLE,
        Key: { exhibitionId },
        // 'name' is a DynamoDB reserved word — alias it with #n.
        UpdateExpression:
          'SET #n = :name, startDate = :startDate, endDate = :endDate, variableQuestions = :vqs',
        ConditionExpression: 'attribute_exists(exhibitionId)',
        ExpressionAttributeNames: { '#n': 'name' },
        ExpressionAttributeValues: {
          ':name':      validated.name,
          ':startDate': validated.startDate,
          ':endDate':   validated.endDate,
          ':vqs':       validated.variableQuestions,
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
