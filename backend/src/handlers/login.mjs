// POST /auth/login  (public — no authorizer on this route)
//
// Looks up the admin record by username, compares the supplied password against
// the stored bcrypt hash, and returns a signed JWT on success.

import { GetCommand } from '@aws-sdk/lib-dynamodb';
import bcrypt from 'bcryptjs';
import { dynamo } from '../lib/dynamoClient.mjs';
import { signToken } from '../lib/jwtUtils.mjs';

const ADMINS_TABLE = process.env.ADMINS_TABLE;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return json(400, { error: 'Request body must be valid JSON' });
  }

  const { username, password } = body;
  if (!username || typeof username !== 'string') {
    return json(400, { error: 'username is required' });
  }
  if (!password || typeof password !== 'string') {
    return json(400, { error: 'password is required' });
  }

  const { Item: admin } = await dynamo.send(
    new GetCommand({ TableName: ADMINS_TABLE, Key: { username } })
  );

  if (!admin) {
    return json(401, { error: 'Invalid credentials' });
  }

  const match = await bcrypt.compare(password, admin.passwordHash);
  if (!match) {
    return json(401, { error: 'Invalid credentials' });
  }

  const token = signToken({ username });
  return json(200, { token });
};
