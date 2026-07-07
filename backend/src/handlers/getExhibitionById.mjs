// GET /exhibitions/{exhibitionId}
//
// Used by the public "which exhibition?" picker after the visitor chooses
// one from the overlapping-active list. Only ever returns data for an
// exhibition that is *currently active* — this is a public, unauthenticated
// route, so it must not become a way to enumerate/read arbitrary (e.g.
// finished) exhibitions' question data.

import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../lib/dynamoClient.mjs';

const EXHIBITIONS_TABLE = process.env.EXHIBITIONS_TABLE;

const todayUTC = () => new Date().toISOString().slice(0, 10);

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

  const { Item: exhibition } = await dynamo.send(
    new GetCommand({ TableName: EXHIBITIONS_TABLE, Key: { exhibitionId } })
  );

  if (!exhibition) {
    return json(404, { error: 'Exhibition not found' });
  }

  const today = todayUTC();
  const isActive = exhibition.startDate <= today && today <= exhibition.endDate;
  if (!isActive) {
    return json(404, { error: 'Exhibition not found' });
  }

  return json(200, { status: 'active', exhibition });
};
