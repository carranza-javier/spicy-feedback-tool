// GET /admin/question-templates
//
// Returns all question templates. Used by the admin's template-edit screen
// and by the "+ New exhibition" form to pre-populate its question list.

import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../lib/dynamoClient.mjs';

const QUESTION_TEMPLATES_TABLE = process.env.QUESTION_TEMPLATES_TABLE;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async () => {
  const { Items: templates = [] } = await dynamo.send(
    new ScanCommand({ TableName: QUESTION_TEMPLATES_TABLE })
  );

  return json(200, { templates });
};
