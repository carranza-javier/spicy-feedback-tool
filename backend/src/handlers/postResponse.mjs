// POST /responses
//
// Validates the request body, confirms the target exhibition is currently
// active, then stores the response in the Responses table.
//
// responseId SK format: "<unix-ms>_<uuid-prefix>"
//   — unix-ms prefix makes items naturally sortable by submission time
//   — 8-char UUID suffix makes collisions impossible at this scale

import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import { dynamo } from '../lib/dynamoClient.mjs';
import { validateResponse } from '../lib/validation.mjs';

const EXHIBITIONS_TABLE = process.env.EXHIBITIONS_TABLE;
const RESPONSES_TABLE = process.env.RESPONSES_TABLE;

const todayUTC = () => new Date().toISOString().slice(0, 10);

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  // ── Parse body ─────────────────────────────────────────────────────────────
  let rawBody;
  try {
    rawBody = JSON.parse(event.body ?? '{}');
  } catch {
    return json(400, { error: 'Request body must be valid JSON' });
  }

  // ── Validate shape ─────────────────────────────────────────────────────────
  let validated;
  try {
    validated = validateResponse(rawBody);
  } catch (err) {
    return json(400, { error: err.message });
  }

  const { exhibitionId, fixedAnswers, variableAnswers } = validated;
  const today = todayUTC();

  // ── Confirm the exhibition exists and is currently active ──────────────────
  const { Item: exhibition } = await dynamo.send(
    new GetCommand({
      TableName: EXHIBITIONS_TABLE,
      Key: { exhibitionId },
    })
  );

  if (!exhibition) {
    return json(404, { error: 'Exhibition not found' });
  }

  const isActive = exhibition.startDate <= today && today <= exhibition.endDate;
  if (!isActive) {
    return json(409, {
      error: 'This exhibition is not currently active — feedback is closed',
    });
  }

  // ── Store the response ─────────────────────────────────────────────────────
  const submittedAt = new Date().toISOString();
  const responseId = `${Date.now()}_${randomUUID().slice(0, 8)}`;

  await dynamo.send(
    new PutCommand({
      TableName: RESPONSES_TABLE,
      Item: {
        exhibitionId, // PK
        responseId,   // SK — timestamp-prefixed for natural sort order
        fixedAnswers,
        variableAnswers,
        submittedAt,
      },
    })
  );

  return json(201, { responseId });
};
