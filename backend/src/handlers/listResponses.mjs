// GET /admin/exhibitions/{exhibitionId}/responses
//
// Queries all responses for a given exhibition (PK = exhibitionId).
// Items are returned in responseId order, which is timestamp-prefixed and
// therefore chronological.

import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../lib/dynamoClient.mjs';

const RESPONSES_TABLE = process.env.RESPONSES_TABLE;

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

  const { Items: responses = [] } = await dynamo.send(
    new QueryCommand({
      TableName: RESPONSES_TABLE,
      KeyConditionExpression: 'exhibitionId = :id',
      ExpressionAttributeValues: { ':id': exhibitionId },
    })
  );

  return json(200, { responses });
};
