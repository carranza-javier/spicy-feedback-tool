// POST /admin/exhibitions
//
// Validates the request body, generates a unique exhibitionId, and stores
// the new exhibition in DynamoDB.

import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../lib/dynamoClient.mjs';
import { validateExhibition } from '../lib/validation.mjs';

const EXHIBITIONS_TABLE = process.env.EXHIBITIONS_TABLE;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
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

  const exhibitionId = `exhibition_${Date.now()}`;
  const createdAt    = new Date().toISOString();

  const item = { exhibitionId, createdAt, ...validated };

  await dynamo.send(new PutCommand({ TableName: EXHIBITIONS_TABLE, Item: item }));

  return json(201, { exhibition: item });
};
