// PUT /admin/question-templates/{templateId}
//
// Edits a question template's text/type/range/options/section. This never
// touches any exhibition — exhibitions only ever hold their own independent
// copy of a template's fields, made once at creation time.

import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo } from '../lib/dynamoClient.mjs';
import { validateQuestionTemplate } from '../lib/validation.mjs';

const QUESTION_TEMPLATES_TABLE = process.env.QUESTION_TEMPLATES_TABLE;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  const templateId = event.pathParameters?.templateId;
  if (!templateId) {
    return json(400, { error: 'templateId path parameter is required' });
  }

  let rawBody;
  try {
    rawBody = JSON.parse(event.body ?? '{}');
  } catch {
    return json(400, { error: 'Request body must be valid JSON' });
  }

  let validated;
  try {
    validated = validateQuestionTemplate(rawBody);
  } catch (err) {
    return json(400, { error: err.message });
  }

  try {
    // Several of these are DynamoDB reserved words (text, type, section,
    // order, min, max — the exact set is large and non-obvious), so every
    // attribute name is aliased rather than relying on a partial list.
    await dynamo.send(
      new UpdateCommand({
        TableName: QUESTION_TEMPLATES_TABLE,
        Key: { templateId },
        UpdateExpression:
          'SET #text = :text, #type = :type, #section = :section, #order = :order, ' +
          '#min = :min, #max = :max, #labelMin = :labelMin, #labelMax = :labelMax, ' +
          '#options = :options, #displayVariant = :displayVariant',
        ConditionExpression: 'attribute_exists(templateId)',
        ExpressionAttributeNames: {
          '#text': 'text',
          '#type': 'type',
          '#section': 'section',
          '#order': 'order',
          '#min': 'min',
          '#max': 'max',
          '#labelMin': 'labelMin',
          '#labelMax': 'labelMax',
          '#options': 'options',
          '#displayVariant': 'displayVariant',
        },
        ExpressionAttributeValues: {
          ':text': validated.text,
          ':type': validated.type,
          ':section': validated.section,
          ':order': validated.order,
          ':min': validated.min ?? null,
          ':max': validated.max ?? null,
          ':labelMin': validated.labelMin ?? null,
          ':labelMax': validated.labelMax ?? null,
          ':options': validated.options ?? null,
          ':displayVariant': validated.displayVariant ?? null,
        },
      })
    );
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return json(404, { error: 'Question template not found' });
    }
    throw err;
  }

  return json(200, { templateId, ...validated });
};
