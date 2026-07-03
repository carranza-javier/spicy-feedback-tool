// GET /admin/exhibitions
//
// Returns all exhibitions with a responseCount computed from a projected Scan
// of the Responses table (PK only, so minimal read cost).

import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../lib/dynamoClient.mjs';

const EXHIBITIONS_TABLE = process.env.EXHIBITIONS_TABLE;
const RESPONSES_TABLE   = process.env.RESPONSES_TABLE;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async () => {
  const [{ Items: exhibitions = [] }, { Items: responsePks = [] }] = await Promise.all([
    dynamo.send(new ScanCommand({ TableName: EXHIBITIONS_TABLE })),
    // Project only the PK so we read minimal data when counting responses.
    dynamo.send(new ScanCommand({
      TableName: RESPONSES_TABLE,
      ProjectionExpression: 'exhibitionId',
    })),
  ]);

  const countByExhibition = {};
  for (const r of responsePks) {
    countByExhibition[r.exhibitionId] = (countByExhibition[r.exhibitionId] ?? 0) + 1;
  }

  const result = exhibitions.map((ex) => ({
    ...ex,
    responseCount: countByExhibition[ex.exhibitionId] ?? 0,
  }));

  return json(200, { exhibitions: result });
};
